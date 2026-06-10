# -*- coding: utf-8 -*-
"""Camada de persistência (Sink) do dashboard-api.

Abstrai PARA ONDE os dados vão. Hoje só existe `CsvSink` (grava os mesmos
output/*.csv de sempre, com upsert incremental). No futuro um `SupabaseSink`
implementa a MESMA interface `upsert(...)` e troca o destino sem mexer no resto.

Upsert incremental (idempotente):
  1. carrega o CSV existente;
  2. REMOVE as linhas cuja data ∈ [since, until] das contas que acabaram de ser
     sincronizadas (evita órfãos quando um anúncio para de rodar no meio da janela);
  3. INSERE as linhas novas;
  4. reescreve ordenado, mesmo cabeçalho/formato (csv.QUOTE_ALL).
"""
import csv
import os
import sys

import requests

import config

# Coluna de data e de conta por canal (espelha os cabeçalhos das planilhas).
_DATE_KEY = {"meta": "Dia", "google": "Data", "google_terms": "Data"}
_ACCT_KEY = {"meta": "Nome da conta", "google": "Nome da conta", "google_terms": "Nome da conta"}

# Chave de identidade de cada linha (upsert no Supabase). Inclui ad_id no Meta
# porque anúncios distintos podem ter o MESMO nome no mesmo conjunto — sem o id,
# o dedup colapsaria os dois e perderia conversões.
_KEY_COLS = {
    "meta": ["Nome da conta", "Dia", "Nome da campanha", "Conjunto de Anúncio", "Nome do Anúncio", "ad_id"],
    "google": ["Nome da conta", "Data", "Campanha", "Grupo de palavras"],
    "google_terms": ["Nome da conta", "Data", "Campanha", "Grupo de palavras", "Termo de pesquisa"],
}


class Sink:
    """Interface. Implementações: CsvSink (atual), SupabaseSink (futuro)."""
    def upsert(self, channel, headers, rows, since, until, accounts):
        raise NotImplementedError


class CsvSink(Sink):
    def __init__(self, out_dir):
        self.out_dir = out_dir

    def _path(self, channel):
        return os.path.join(self.out_dir, f"{channel}.csv")

    def _load(self, channel, headers):
        path = self._path(channel)
        if not os.path.exists(path):
            return []
        with open(path, newline="", encoding="utf-8") as f:
            return list(csv.DictReader(f))

    def accounts_in(self, channel):
        """Nomes de conta já presentes no CSV — universo do incremental (pula
        contas que nunca produziram dado, cortando ~metade das chamadas)."""
        acct_key = _ACCT_KEY[channel]
        return sorted({r.get(acct_key, "") for r in self._load(channel, None) if r.get(acct_key)})

    def upsert(self, channel, headers, rows, since, until, accounts):
        """Mescla `rows` no CSV do canal. `accounts` = nomes de conta sincronizados
        nesta rodada (para remover só o que foi reprocessado). Se None, substitui a
        janela de TODAS as contas presentes em `rows`."""
        date_key, acct_key = _DATE_KEY[channel], _ACCT_KEY[channel]
        existing = self._load(channel, headers)

        synced = set(accounts) if accounts else {r.get(acct_key, "") for r in rows}

        def in_window(r):
            d = r.get(date_key, "")
            return since <= d <= until

        # Mantém INTACTAS as linhas FORA da janela (ou de contas não sincronizadas
        # agora) e ANEXA as recém-coletadas. A idempotência vem do "apaga-janela +
        # reinsere" — NÃO se faz dedup por nome (anúncios distintos podem ter o mesmo
        # nome; a planilha não tem coluna de ID para distingui-los).
        kept = [r for r in existing if not (r.get(acct_key, "") in synced and in_window(r))]
        out = kept + list(rows)

        os.makedirs(self.out_dir, exist_ok=True)
        path = self._path(channel)
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=headers, quoting=csv.QUOTE_ALL, extrasaction="ignore")
            w.writeheader()
            for r in out:
                w.writerow(r)
        return path, len(out), len(rows)


class SupabaseSink(Sink):
    """Grava as linhas na tabela public.dash_insights via PostgREST (upsert por
    channel+row_key) usando a SERVICE_ROLE key. RLS é ignorada pela service role;
    a leitura no app é gated por /api/dash-data (valida o JWT do usuário)."""
    def __init__(self):
        self.url = config.SUPABASE_URL
        self.key = config.SUPABASE_SERVICE_ROLE_KEY
        if not self.url or not self.key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes (ver config.py).")

    def accounts_in(self, channel):
        # Sem otimização de escopo no incremental por Supabase → sincroniza todas
        # as contas ativas (retorno vazio faz o sync.py usar only_accounts=None).
        return []

    def _row_key(self, channel, r):
        return "|".join(str(r.get(c, "")) for c in _KEY_COLS[channel])

    def upsert(self, channel, headers, rows, since, until, accounts):
        date_key = _DATE_KEY[channel]
        acct_key = _ACCT_KEY[channel]
        # Dedup por row_key (nomes de anúncio podem colidir; PostgREST recusa
        # chave duplicada no MESMO batch). Última ocorrência vence.
        by_key = {}
        for r in rows:
            by_key[self._row_key(channel, r)] = r
        payload = [{
            "channel": channel,
            "row_key": k,
            "account": r.get(acct_key, ""),
            "day": (r.get(date_key) or None),
            "data": r,
        } for k, r in by_key.items()]

        endpoint = f"{self.url}/rest/v1/dash_insights"
        hdrs = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        sent = 0
        for i in range(0, len(payload), 500):
            chunk = payload[i:i + 500]
            try:
                resp = requests.post(endpoint, json=chunk, headers=hdrs, timeout=180)
                if resp.status_code in (200, 201, 204):
                    sent += len(chunk)
                else:
                    print(f"    ⚠️  Supabase upsert HTTP {resp.status_code} (chunk {i}): {resp.text[:300]}", file=sys.stderr)
            except Exception as e:
                print(f"    ⚠️  Supabase upsert erro (chunk {i}): {e}", file=sys.stderr)
        return f"supabase:dash_insights[{channel}]", sent, sent

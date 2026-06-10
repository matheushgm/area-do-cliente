#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Orquestrador do dashboard-api.

Puxa Meta e/ou Google via API e grava CSVs idênticos às planilhas atuais em
output/. Esses CSVs são drop-in: o mesmo parser do dashboard React
(src/lib/dashboardData.js) consegue lê-los sem nenhuma alteração.

Modos:
  - INCREMENTAL (padrão): puxa só os últimos INCREMENTAL_DAYS (default 3) e faz
    upsert no CSV existente (rápido, ideal para cron). Idempotente.
  - BACKFILL (--backfill): puxa a janela inteira (--days, default 30) e mescla.

Coleta em PARALELO (ThreadPoolExecutor, --workers / MAX_WORKERS, default 8).

Uso:
  python3 sync.py                      # incremental (últimos 3 dias), ambos canais
  python3 sync.py --backfill --days 30 # carga completa de 30 dias
  python3 sync.py --channel meta       # só Meta
  python3 sync.py --start 2026-05-01 --end 2026-05-31
  python3 sync.py --accounts "Matheus Business" 1307754696082194
  python3 sync.py --workers 12
"""
import argparse
import datetime
import sys

import config
from store import CsvSink, SupabaseSink
from meta_sync import META_HEADERS, fetch_all as meta_fetch
from google_sync import (
    GOOGLE_HEADERS, GOOGLE_TERMS_HEADERS,
    fetch_all as google_fetch, fetch_terms_all as google_terms_fetch,
)


def daterange(args):
    if args.start and args.end:
        return args.start, args.end
    today = datetime.date.today()
    until = today - datetime.timedelta(days=1)  # ontem (dia fechado)
    days = args.days if args.backfill else config.INCREMENTAL_DAYS
    since = until - datetime.timedelta(days=days - 1)
    return since.isoformat(), until.isoformat()


def main():
    ap = argparse.ArgumentParser(description="Sincroniza Meta/Google Ads -> CSV (formato planilha).")
    ap.add_argument("--channel", choices=["meta", "google", "both"], default="both")
    ap.add_argument("--incremental", action="store_true", help="(padrão) puxa só os últimos INCREMENTAL_DAYS e faz upsert")
    ap.add_argument("--backfill", action="store_true", help="carga completa (--days); sem isso = incremental")
    ap.add_argument("--days", type=int, default=config.DEFAULT_DAYS, help="janela do backfill (default 30)")
    ap.add_argument("--start", help="YYYY-MM-DD (sobrepõe o modo)")
    ap.add_argument("--end", help="YYYY-MM-DD")
    ap.add_argument("--accounts", nargs="*", help="filtra por nome ou id (default: todas ativas)")
    ap.add_argument("--workers", type=int, help="paralelismo (default MAX_WORKERS)")
    ap.add_argument("--sink", choices=["csv", "supabase"], default="csv", help="destino dos dados")
    ap.add_argument("--out", default=config.OUTPUT_DIR)
    args = ap.parse_args()

    if args.workers:
        config.MAX_WORKERS = args.workers

    since, until = daterange(args)
    is_incremental = not (args.backfill or (args.start and args.end))
    mode = "INCREMENTAL" if is_incremental else "BACKFILL"
    print(f"\n📅 {mode} · período: {since} → {until} · sink: {args.sink}\n", file=sys.stderr)

    sink = SupabaseSink() if args.sink == "supabase" else CsvSink(args.out)
    results = {}

    def scope(channel):
        """Universo de contas: --accounts explícito > (incremental) só as contas
        já presentes no CSV > todas as ativas (backfill / 1ª carga)."""
        if args.accounts:
            return args.accounts
        if is_incremental:
            known = sink.accounts_in(channel)
            if known:
                return known
        return None  # backfill ou 1ª carga (CSV vazio) → todas as contas ativas

    if args.channel in ("meta", "both"):
        print("▶ Coletando Meta Ads...", file=sys.stderr)
        rows, accts = meta_fetch(since, until, only_accounts=scope("meta"))
        path, total, n = sink.upsert("meta", META_HEADERS, rows, since, until, accts)
        results["meta"] = (path, n, total)
        print(f"  ✅ {n} linhas novas · {total} no CSV -> {path}\n", file=sys.stderr)

    if args.channel in ("google", "both"):
        print("▶ Coletando Google Ads...", file=sys.stderr)
        rows, accts = google_fetch(since, until, only_accounts=scope("google"))
        path, total, n = sink.upsert("google", GOOGLE_HEADERS, rows, since, until, accts)
        results["google"] = (path, n, total)
        print(f"  ✅ {n} linhas novas · {total} no CSV -> {path}\n", file=sys.stderr)

        print("▶ Coletando Termos de pesquisa (Google)...", file=sys.stderr)
        trows, taccts = google_terms_fetch(since, until, only_accounts=scope("google_terms"))
        path, total, n = sink.upsert("google_terms", GOOGLE_TERMS_HEADERS, trows, since, until, taccts)
        results["google_terms"] = (path, n, total)
        print(f"  ✅ {n} linhas novas · {total} no CSV -> {path}\n", file=sys.stderr)

    print("─" * 56, file=sys.stderr)
    for ch, (path, n, total) in results.items():
        print(f"  {ch.upper():7} +{n:5} novas · {total:6} total  {path}", file=sys.stderr)
    print("✨ Concluído.\n", file=sys.stderr)


if __name__ == "__main__":
    main()

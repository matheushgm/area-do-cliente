# -*- coding: utf-8 -*-
"""Configuração central do dashboard-api.

TODOS os segredos vêm de variáveis de ambiente (ou do .env.local local, como
conveniência de dev). NADA de segredo hardcoded — este código vai para um
repositório público e roda também no GitHub Actions (secrets via env)."""
import os


# ─── .env.local (conveniência local; no CI os segredos vêm do ambiente) ──────
def _load_env_local():
    """Carrega chaves do .env.local da Área do Cliente, se existir."""
    p = "/Users/matheus/Desktop/Claude/Área do Cliente/revenue-lab/.env.local"
    out = {}
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    out[k.strip()] = v.strip().strip('"')
    return out


_ENVL = _load_env_local()


def _env(key, default=None):
    return os.environ.get(key) or _ENVL.get(key) or default


# ─── Meta Ads ────────────────────────────────────────────────────────────────
META_API_VERSION = "v19.0"
META_BASE_URL = f"https://graph.facebook.com/{META_API_VERSION}"
META_TOKEN = _env("META_TOKEN")  # obrigatório (env ou .env.local)

# ─── Google Ads ──────────────────────────────────────────────────────────────
# Lê de ~/.config/google-ads/google-ads.yaml (local e no CI, onde o workflow
# gera esse arquivo a partir dos secrets).
GOOGLE_YAML = os.path.expanduser("~/.config/google-ads/google-ads.yaml")
GOOGLE_MCC_ID = _env("GOOGLE_MCC_ID", "2695121976")  # [MCC] - Revenue Lab (não é segredo)

# ─── Supabase (destino do SupabaseSink — escrita via chave secreta) ──────────
# A legada service_role (JWT) foi desativada em 2026-04-28 → usar SUPABASE_SECRET_KEY (sb_secret_...).
SUPABASE_URL = _env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SECRET_KEY") or _env("SUPABASE_SERVICE_ROLE_KEY")

# ─── Janela / paralelismo / saída ────────────────────────────────────────────
DEFAULT_DAYS = int(_env("SYNC_DAYS", "30"))
INCREMENTAL_DAYS = int(_env("INCREMENTAL_DAYS", "8"))  # 8 = cobre a janela de atribuição (7d) p/ recontar conversas/leads atribuídos retroativamente
MAX_WORKERS = int(_env("MAX_WORKERS", "16"))
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "output"))

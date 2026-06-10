# -*- coding: utf-8 -*-
"""Formatadores no padrão BR — replicam EXATAMENTE o que aparece nas planilhas
atuais (vírgula decimal, "R$ ", "%"). O dashboard React faz o parse inverso em
src/lib/dashboardData.js (função `num`), então o formato precisa casar."""


def _f(v):
    """Converte qualquer coisa para float, tolerando None/''/strings BR."""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").replace("%", "").strip()
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def money(v):
    """8.89 -> 'R$ 8,89'. Vazio -> ''."""
    f = _f(v)
    if f is None:
        return ""
    return "R$ " + f"{f:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def dec(v, n=2):
    """1.0426 -> '1,04'. Vazio -> ''."""
    f = _f(v)
    if f is None:
        return ""
    return f"{f:.{n}f}".replace(".", ",")


def pct(v, n=2):
    """v JÁ em pontos percentuais. 4.62 -> '4,62%'. Vazio -> ''."""
    f = _f(v)
    if f is None:
        return ""
    return f"{f:.{n}f}".replace(".", ",") + "%"


def pct_from_ratio(v, n=2):
    """v é razão 0..1. 0.813 -> '81,30%'. Vazio -> ''."""
    f = _f(v)
    if f is None:
        return ""
    return pct(f * 100, n)


def integer(v):
    """12.0 -> '12'. Vazio -> ''."""
    f = _f(v)
    if f is None:
        return ""
    return str(int(round(f)))

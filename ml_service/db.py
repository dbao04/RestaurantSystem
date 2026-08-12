"""Ket noi CSDL dung chung cho toan bo ML service.

Doc cau hinh tu file .env o thu muc goc du an (dung chung voi ung dung Node)
nen khong phai khai bao thong tin ket noi o hai noi.
"""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

GOC_DU_AN = Path(__file__).resolve().parent.parent
load_dotenv(GOC_DU_AN / ".env")

_engine: Engine | None = None


def lay_engine() -> Engine:
    """Tra ve engine dung chung (tao mot lan)."""
    global _engine
    if _engine is None:
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "3306")
        user = os.getenv("DB_USER", "root")
        mat_khau = os.getenv("DB_PASS", "")
        ten_db = os.getenv("DB_NAME", "gs_restaurant")
        # quote_plus de mat khau co ky tu dac biet khong lam hong URL.
        from urllib.parse import quote_plus

        url = (
            f"mysql+pymysql://{user}:{quote_plus(mat_khau)}@{host}:{port}/{ten_db}"
            "?charset=utf8mb4"
        )
        _engine = create_engine(url, pool_pre_ping=True, pool_recycle=3600)
    return _engine


def doc_sql(cau_lenh: str, tham_so: dict | None = None) -> pd.DataFrame:
    """Chay SELECT va tra ve DataFrame."""
    with lay_engine().connect() as conn:
        return pd.read_sql(text(cau_lenh), conn, params=tham_so or {})


def chay_sql(cau_lenh: str, tham_so: dict | list[dict] | None = None) -> None:
    """Chay INSERT/UPDATE/DELETE (co commit)."""
    with lay_engine().begin() as conn:
        conn.execute(text(cau_lenh), tham_so or {})

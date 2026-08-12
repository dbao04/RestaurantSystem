"""Huan luyen va danh gia mo hinh du bao.

Diem quan trong ve phuong phap (can neu ro trong bao cao):

1. KHONG dung train_test_split ngau nhien. Day la du lieu chuoi thoi gian; chia
   ngau nhien se cho mo hinh "nhin thay tuong lai" va lam chi so dep gia tao.
   Ta chia theo moc thoi gian: phan dau huan luyen, phan duoi kiem thu.

2. Luon so sanh voi mo hinh nen (baseline) "seasonal naive" - lay gia tri cung
   thu tuan truoc. Neu mo hinh hoc may khong thang duoc baseline nay thi no
   khong co gia tri thuc te. Day la cau hoi hoi dong hay hoi nhat.

3. Bao cao dong thoi MAE, RMSE, MAPE va R^2:
   - MAE  : sai so trung binh, cung don vi voi dai luong du bao
   - RMSE : phat nang cac sai so lon
   - MAPE : sai so tuong doi, tien so sanh giua cac nguyen lieu khac don vi
   - R^2  : ty le phuong sai giai thich duoc
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor


@dataclass
class KetQua:
    """Ket qua danh gia mot mo hinh tren tap kiem thu."""

    ten: str
    mae: float
    rmse: float
    mape: float
    r2: float
    so_mau_train: int
    so_mau_test: int
    mo_hinh: object = field(default=None, repr=False)
    du_bao_test: np.ndarray | None = field(default=None, repr=False)


def mape(y_that: np.ndarray, y_du_bao: np.ndarray) -> float:
    """MAPE bo qua cac diem co gia tri that bang 0 (chia cho 0)."""
    y_that = np.asarray(y_that, dtype=float)
    y_du_bao = np.asarray(y_du_bao, dtype=float)
    khac_khong = np.abs(y_that) > 1e-9
    if not khac_khong.any():
        return float("nan")
    return float(
        np.mean(np.abs((y_that[khac_khong] - y_du_bao[khac_khong]) / y_that[khac_khong])) * 100
    )


def tinh_chi_so(y_that, y_du_bao) -> dict:
    return {
        "mae": float(mean_absolute_error(y_that, y_du_bao)),
        "rmse": float(np.sqrt(mean_squared_error(y_that, y_du_bao))),
        "mape": mape(y_that, y_du_bao),
        "r2": float(r2_score(y_that, y_du_bao)) if len(y_that) > 1 else float("nan"),
    }


def danh_sach_mo_hinh(nho: bool = False) -> dict:
    """Bo mo hinh dem so sanh. `nho=True` dung cho chuoi ngan (tung nguyen lieu)."""
    if nho:
        return {
            "Ridge": Pipeline([("chuan_hoa", StandardScaler()), ("mh", Ridge(alpha=1.0))]),
            "RandomForest": RandomForestRegressor(
                n_estimators=200, max_depth=12, min_samples_leaf=2,
                random_state=42, n_jobs=-1
            ),
            "XGBoost": XGBRegressor(
                n_estimators=300, max_depth=5, learning_rate=0.06,
                subsample=0.9, colsample_bytree=0.9, random_state=42,
                n_jobs=-1, verbosity=0,
            ),
        }
    return {
        "Ridge": Pipeline([("chuan_hoa", StandardScaler()), ("mh", Ridge(alpha=1.0))]),
        "RandomForest": RandomForestRegressor(
            n_estimators=400, max_depth=None, min_samples_leaf=2,
            random_state=42, n_jobs=-1
        ),
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=300, max_depth=4, learning_rate=0.05, random_state=42
        ),
        "XGBoost": XGBRegressor(
            n_estimators=500, max_depth=6, learning_rate=0.05,
            subsample=0.9, colsample_bytree=0.9, random_state=42,
            n_jobs=-1, verbosity=0,
        ),
    }


def du_bao_nen(df: pd.DataFrame, cot_muc_tieu: str, chi_so_test) -> np.ndarray:
    """Baseline 'seasonal naive': gia tri cung thu tuan truoc (lag_7)."""
    return df.loc[chi_so_test, "lag_7"].to_numpy(dtype=float)


def huan_luyen_va_danh_gia(
    df: pd.DataFrame,
    cot_muc_tieu: str,
    cot_dac_trung: list[str],
    ty_le_test: float = 0.2,
    so_ngay_test_toi_da: int = 60,
    nho: bool = False,
) -> tuple[list[KetQua], KetQua | None]:
    """Chia theo thoi gian, huan luyen tat ca mo hinh, tra ve ket qua + mo hinh tot nhat.

    Tra ve (danh_sach_ket_qua_sap_xep_theo_mae, ket_qua_tot_nhat).
    """
    n = len(df)
    if n < 40:
        return [], None

    so_test = int(min(max(round(n * ty_le_test), 7), so_ngay_test_toi_da))
    cat = n - so_test

    X = df[cot_dac_trung].astype(float).fillna(0.0)
    y = df[cot_muc_tieu].astype(float)

    X_train, X_test = X.iloc[:cat], X.iloc[cat:]
    y_train, y_test = y.iloc[:cat], y.iloc[cat:]

    ket_qua: list[KetQua] = []

    # --- Baseline ---
    nen = du_bao_nen(df, cot_muc_tieu, df.index[cat:])
    if not np.isnan(nen).all():
        cs = tinh_chi_so(y_test, np.nan_to_num(nen, nan=float(y_train.mean())))
        ket_qua.append(
            KetQua("SeasonalNaive", **cs, so_mau_train=len(y_train), so_mau_test=len(y_test))
        )

    # --- Cac mo hinh hoc may ---
    for ten, mh in danh_sach_mo_hinh(nho=nho).items():
        try:
            mh.fit(X_train, y_train)
            du_bao = np.clip(mh.predict(X_test), 0, None)
            cs = tinh_chi_so(y_test, du_bao)
            ket_qua.append(
                KetQua(
                    ten, **cs,
                    so_mau_train=len(y_train), so_mau_test=len(y_test),
                    mo_hinh=mh, du_bao_test=du_bao,
                )
            )
        except Exception as loi:  # mot mo hinh hong khong duoc lam sap ca quy trinh
            print(f"    [!] {ten} that bai: {loi}")

    if not ket_qua:
        return [], None

    ket_qua.sort(key=lambda k: k.mae)
    # Mo hinh tot nhat phai la mo hinh hoc may (baseline khong du bao duoc tuong lai xa).
    tot_nhat = next((k for k in ket_qua if k.mo_hinh is not None), None)
    return ket_qua, tot_nhat


def huan_luyen_lai_toan_bo(mo_hinh, df: pd.DataFrame, cot_muc_tieu: str, cot_dac_trung: list[str]):
    """Sau khi chon duoc mo hinh, huan luyen lai tren TOAN BO du lieu de du bao thuc te."""
    X = df[cot_dac_trung].astype(float).fillna(0.0)
    y = df[cot_muc_tieu].astype(float)
    mo_hinh.fit(X, y)
    return mo_hinh

"""Xay dung dac trung (feature engineering) cho cac bai toan du bao.

Bai toan du bao nhu cau nha hang la chuoi thoi gian co tinh mua vu manh. Ta
khong dung mo hinh chuoi thoi gian thuan (ARIMA/Prophet) ma chuyen ve bai toan
hoi quy co giam sat, vi cach nay cho phep:
  - dua them bien ngoai sinh (ngay le, khuyen mai) mot cach tu nhien,
  - dung chung mot bo dac trung cho ca du bao luot khach lan du bao nguyen lieu,
  - so sanh nhieu thuat toan hoi quy tren cung mot bang dac trung.

Nhom dac trung:
  1. Lich      : thu, thang, ngay trong thang, tuan trong nam, cuoi tuan
  2. Ngay le   : co phai ngay le khong, cach Tet bao nhieu ngay
  3. Tre (lag) : gia tri t-1, t-7, t-14 (t-7 quan trong nhat vi chu ky tuan)
  4. Truot     : trung binh/do lech chuan 7 va 28 ngay gan nhat
  5. Xu huong  : chi so ngay tang dan de mo hinh bat duoc tang truong
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Ngay le duong lich anh huong manh den luong khach nha hang tai Viet Nam.
# Dung chung danh sach voi bo sinh du lieu (config/migrations/003).
NGAY_LE = {
    "2025-09-02", "2025-10-20", "2025-11-20", "2025-12-24", "2025-12-25",
    "2025-12-31", "2026-01-01", "2026-02-14", "2026-02-16", "2026-02-17",
    "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-03-08",
    "2026-04-26", "2026-04-30", "2026-05-01", "2026-06-01",
    # Cac nam ke tiep de mo hinh van dung duoc khi du bao tuong lai.
    "2026-09-02", "2026-10-20", "2026-11-20", "2026-12-24", "2026-12-25",
    "2026-12-31", "2027-01-01",
}

# Mung 1 Tet Am lich (de tinh khoang cach den Tet).
TET = pd.to_datetime(["2026-02-17", "2027-02-06"])

LAG = [1, 7, 14]
CUA_SO_TRUOT = [7, 28]


def them_dac_trung_lich(df: pd.DataFrame, cot_ngay: str = "ngay") -> pd.DataFrame:
    """Them cac dac trung lich va ngay le. `cot_ngay` phai la datetime."""
    df = df.copy()
    d = pd.to_datetime(df[cot_ngay])

    df["thu"] = d.dt.dayofweek                 # 0 = thu Hai
    df["thang"] = d.dt.month
    df["ngay_trong_thang"] = d.dt.day
    df["tuan_trong_nam"] = d.dt.isocalendar().week.astype(int)
    df["cuoi_tuan"] = (d.dt.dayofweek >= 5).astype(int)
    df["ngay_le"] = d.dt.strftime("%Y-%m-%d").isin(NGAY_LE).astype(int)

    # Ma hoa chu ky bang sin/cos: giup mo hinh tuyen tinh hieu duoc thu 7 va
    # Chu nhat la ke nhau, thang 12 va thang 1 cung ke nhau.
    df["thu_sin"] = np.sin(2 * np.pi * df["thu"] / 7)
    df["thu_cos"] = np.cos(2 * np.pi * df["thu"] / 7)
    df["thang_sin"] = np.sin(2 * np.pi * df["thang"] / 12)
    df["thang_cos"] = np.cos(2 * np.pi * df["thang"] / 12)

    # Khoang cach (ngay) toi Tet gan nhat, chan trong [-30, 30].
    khoang = np.array([np.min(np.abs((t - TET).days)) for t in d])
    huong = np.array([(t - TET[np.argmin(np.abs((t - TET).days))]).days for t in d])
    df["cach_tet"] = np.clip(np.where(khoang > 30, 30, huong), -30, 30)

    df["chi_so_ngay"] = (d - d.min()).dt.days
    return df


def them_dac_trung_tre(df: pd.DataFrame, cot_muc_tieu: str) -> pd.DataFrame:
    """Them lag va thong ke truot. Yeu cau df da sap xep tang dan theo ngay."""
    df = df.copy()
    for k in LAG:
        df[f"lag_{k}"] = df[cot_muc_tieu].shift(k)
    for w in CUA_SO_TRUOT:
        # shift(1) truoc khi tinh de KHONG dung gia tri cua chinh ngay do
        # (tranh ro ri du lieu tuong lai vao dac trung).
        df[f"tb_{w}"] = df[cot_muc_tieu].shift(1).rolling(w, min_periods=2).mean()
        df[f"dlc_{w}"] = df[cot_muc_tieu].shift(1).rolling(w, min_periods=2).std()
    # Trung binh cung thu trong 4 tuan gan nhat - dac trung manh nhat cho
    # du lieu nha hang.
    df["tb_cung_thu_4t"] = (
        df[cot_muc_tieu].shift(7).rolling(4, min_periods=1).mean()
    )
    return df


def cot_dac_trung(df: pd.DataFrame, cot_muc_tieu: str, cot_ngay: str = "ngay") -> list[str]:
    """Danh sach cot dung lam dau vao mo hinh."""
    loai_tru = {cot_ngay, cot_muc_tieu, "id_nl", "ten_nl"}
    return [c for c in df.columns if c not in loai_tru]


def chuan_bi(df: pd.DataFrame, cot_muc_tieu: str, cot_ngay: str = "ngay") -> pd.DataFrame:
    """Pipeline day du: lich -> lag -> bo cac dong thieu lag."""
    df = df.sort_values(cot_ngay).reset_index(drop=True)
    df = them_dac_trung_lich(df, cot_ngay)
    df = them_dac_trung_tre(df, cot_muc_tieu)
    # Bo phan dau chuoi chua du lich su de tinh lag.
    return df.dropna(subset=[f"lag_{max(LAG)}"]).reset_index(drop=True)

"""Hai bai toan du bao chinh cua he thong.

  Bai toan 1: du bao luot khach / so don theo ngay
  Bai toan 2: du bao nhu cau nguyen lieu theo ngay

Ca hai deu du bao NHIEU BUOC (multi-step) bang phuong phap de quy: du bao ngay
t+1, dua ket qua do vao lam gia tri lag de du bao t+2, va cu the. Cach nay giu
duoc tinh nhat quan cua cac dac trung tre nhung sai so se tich luy dan theo tam
du bao - day la han che can neu ro trong bao cao.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import features as ft
from . import models as md
from .db import chay_sql, doc_sql

# --------------------------------------------------------------------------
# Nap du lieu
# --------------------------------------------------------------------------

SQL_LUOT_KHACH = """
    SELECT ngay_dat AS ngay,
           COUNT(DISTINCT sesis)                       AS so_don,
           SUM(soluong)                                AS so_mon,
           SUM(thanhtien)                              AS doanh_thu
    FROM hopdong
    WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat IS NOT NULL
    GROUP BY ngay_dat
    ORDER BY ngay_dat
"""

SQL_KHACH_THEO_NGAY = """
    SELECT ngay, SUM(so_khach) AS so_khach FROM (
        SELECT ngay_dat AS ngay, sesis,
               MAX(CAST(NULLIF(TRIM(so_user), '') AS UNSIGNED)) AS so_khach
        FROM hopdong
        WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat IS NOT NULL
        GROUP BY ngay_dat, sesis
    ) t
    GROUP BY ngay ORDER BY ngay
"""

SQL_NGUYEN_LIEU = """
    SELECT x.ngay_xuat AS ngay, x.id_nl, nl.ten_nl, SUM(x.so_luong) AS so_luong
    FROM xuat_kho x
    JOIN nguyen_lieu nl ON nl.id_nl = x.id_nl
    WHERE x.ngay_xuat IS NOT NULL
    GROUP BY x.ngay_xuat, x.id_nl, nl.ten_nl
    ORDER BY x.ngay_xuat
"""


def _nap_chuoi_ngay() -> pd.DataFrame:
    """Chuoi so don + luot khach theo ngay, da dien day du cac ngay trong."""
    don = doc_sql(SQL_LUOT_KHACH)
    khach = doc_sql(SQL_KHACH_THEO_NGAY)
    df = don.merge(khach, on="ngay", how="left")
    df["ngay"] = pd.to_datetime(df["ngay"])

    # Dien du moi ngay trong khoang: ngay khong ban duoc coi la 0 chu khong
    # phai "khong co du lieu", neu bo trong se lam lech cac dac trung tre.
    day_du = pd.DataFrame({"ngay": pd.date_range(df["ngay"].min(), df["ngay"].max(), freq="D")})
    df = day_du.merge(df, on="ngay", how="left").fillna(0)
    for c in ["so_don", "so_mon", "so_khach"]:
        df[c] = df[c].astype(float)
    return df


# --------------------------------------------------------------------------
# Du bao de quy nhieu buoc
# --------------------------------------------------------------------------
def _du_bao_de_quy(
    lich_su: pd.DataFrame,
    cot_muc_tieu: str,
    mo_hinh,
    cot_dac_trung: list[str],
    so_ngay: int,
) -> pd.DataFrame:
    """Du bao `so_ngay` ngay tiep theo bang cach lan luot noi dai chuoi."""
    lam_viec = lich_su[["ngay", cot_muc_tieu]].copy()
    ket_qua = []

    for _ in range(so_ngay):
        ngay_moi = lam_viec["ngay"].max() + pd.Timedelta(days=1)
        # Them mot dong tam voi gia tri NaN roi tinh lai dac trung.
        tam = pd.concat(
            [lam_viec, pd.DataFrame({"ngay": [ngay_moi], cot_muc_tieu: [np.nan]})],
            ignore_index=True,
        )
        tam = ft.them_dac_trung_lich(tam, "ngay")
        tam = ft.them_dac_trung_tre(tam, cot_muc_tieu)

        dong = tam.iloc[[-1]]
        X = dong[cot_dac_trung].astype(float).fillna(0.0)
        gia_tri = float(np.clip(mo_hinh.predict(X)[0], 0, None))

        ket_qua.append({"ngay": ngay_moi, "du_bao": gia_tri})
        # Ghi gia tri vua du bao vao chuoi de buoc sau dung lam lag.
        lam_viec = pd.concat(
            [lam_viec, pd.DataFrame({"ngay": [ngay_moi], cot_muc_tieu: [gia_tri]})],
            ignore_index=True,
        )

    return pd.DataFrame(ket_qua)


# --------------------------------------------------------------------------
# Bai toan 1: luot khach
# --------------------------------------------------------------------------
def du_bao_luot_khach(so_ngay: int = 14, cot_muc_tieu: str = "so_khach", luu_db: bool = True) -> dict:
    """Huan luyen, danh gia va du bao luot khach cho `so_ngay` ngay toi."""
    tho = _nap_chuoi_ngay()
    if len(tho) < 60:
        raise ValueError(f"Chi co {len(tho)} ngay du lieu, can it nhat 60 ngay.")

    df = ft.chuan_bi(tho, cot_muc_tieu, "ngay")
    cot = ft.cot_dac_trung(df, cot_muc_tieu, "ngay")
    cot = [c for c in cot if c not in ("so_don", "so_mon", "doanh_thu", "so_khach")]

    ket_qua, tot_nhat = md.huan_luyen_va_danh_gia(df, cot_muc_tieu, cot)
    if tot_nhat is None:
        raise ValueError("Khong huan luyen duoc mo hinh nao.")

    # Huan luyen lai tren toan bo du lieu roi moi du bao tuong lai.
    mo_hinh = md.huan_luyen_lai_toan_bo(tot_nhat.mo_hinh, df, cot_muc_tieu, cot)
    du_bao = _du_bao_de_quy(tho, cot_muc_tieu, mo_hinh, cot, so_ngay)

    # Khoang tin cay xap xi tu RMSE tren tap kiem thu (+-1.96 sigma).
    bien = 1.96 * tot_nhat.rmse
    du_bao["can_duoi"] = np.clip(du_bao["du_bao"] - bien, 0, None)
    du_bao["can_tren"] = du_bao["du_bao"] + bien

    if luu_db:
        _luu_du_bao_khach(du_bao, tot_nhat.ten)
        _luu_danh_gia(f"du_bao_{cot_muc_tieu}", ket_qua)

    return {
        "muc_tieu": cot_muc_tieu,
        "mo_hinh_chon": tot_nhat.ten,
        "chi_so": {
            "mae": round(tot_nhat.mae, 3),
            "rmse": round(tot_nhat.rmse, 3),
            "mape": round(tot_nhat.mape, 2),
            "r2": round(tot_nhat.r2, 4),
        },
        "so_mau_train": tot_nhat.so_mau_train,
        "so_mau_test": tot_nhat.so_mau_test,
        "so_sanh_mo_hinh": [
            {
                "ten": k.ten, "mae": round(k.mae, 3), "rmse": round(k.rmse, 3),
                "mape": round(k.mape, 2), "r2": round(k.r2, 4),
            }
            for k in ket_qua
        ],
        "du_bao": [
            {
                "ngay": r["ngay"].strftime("%Y-%m-%d"),
                "gia_tri": round(r["du_bao"], 1),
                "can_duoi": round(r["can_duoi"], 1),
                "can_tren": round(r["can_tren"], 1),
            }
            for _, r in du_bao.iterrows()
        ],
    }


def _luu_du_bao_khach(du_bao: pd.DataFrame, ten_mo_hinh: str) -> None:
    chay_sql(
        """INSERT INTO du_bao_luot_khach
             (ngay_du_bao, so_khach_du_bao, can_duoi, can_tren, mo_hinh)
           VALUES (:ngay, :gt, :cd, :ct, :mh)
           ON DUPLICATE KEY UPDATE
             so_khach_du_bao = VALUES(so_khach_du_bao),
             can_duoi = VALUES(can_duoi), can_tren = VALUES(can_tren),
             tao_luc = CURRENT_TIMESTAMP""",
        [
            {
                "ngay": r["ngay"].strftime("%Y-%m-%d"),
                "gt": float(r["du_bao"]),
                "cd": float(r["can_duoi"]),
                "ct": float(r["can_tren"]),
                "mh": ten_mo_hinh,
            }
            for _, r in du_bao.iterrows()
        ],
    )


def _luu_danh_gia(bai_toan: str, ket_qua: list[md.KetQua]) -> None:
    chay_sql("DELETE FROM danh_gia_mo_hinh WHERE bai_toan = :bt", {"bt": bai_toan})
    chay_sql(
        """INSERT INTO danh_gia_mo_hinh
             (bai_toan, mo_hinh, mae, rmse, mape, r2, so_mau_train, so_mau_test)
           VALUES (:bt, :mh, :mae, :rmse, :mape, :r2, :tr, :te)""",
        [
            {
                "bt": bai_toan, "mh": k.ten,
                "mae": None if np.isnan(k.mae) else float(k.mae),
                "rmse": None if np.isnan(k.rmse) else float(k.rmse),
                "mape": None if np.isnan(k.mape) else float(k.mape),
                "r2": None if np.isnan(k.r2) else float(k.r2),
                "tr": k.so_mau_train, "te": k.so_mau_test,
            }
            for k in ket_qua
        ],
    )


# --------------------------------------------------------------------------
# Bai toan 2: nhu cau nguyen lieu
# --------------------------------------------------------------------------
def du_bao_nguyen_lieu(so_ngay: int = 7, toi_thieu_ngay: int = 90, luu_db: bool = True) -> dict:
    """Du bao luong tieu hao tung nguyen lieu cho `so_ngay` ngay toi.

    Moi nguyen lieu duoc huan luyen mot mo hinh rieng. Nguyen lieu co chuoi qua
    ngan (moi them vao, it xuat hien) se dung trung binh truot thay vi hoc may -
    ep mo hinh hoc tren 20 quan sat chi tao ra so lieu vo nghia.
    """
    tho = doc_sql(SQL_NGUYEN_LIEU)
    if tho.empty:
        raise ValueError("Bang xuat_kho chua co du lieu.")
    tho["ngay"] = pd.to_datetime(tho["ngay"])

    # Ton kho hien tai de tinh "can nhap them".
    ton = doc_sql(
        """SELECT nl.id_nl, nl.ten_nl, nl.so_luong AS ton, dv.ten_dvt
           FROM nguyen_lieu nl LEFT JOIN don_vi_tinh dv ON dv.id_dvt = nl.id_dvt"""
    ).set_index("id_nl")

    ket_qua_nl = []
    ban_ghi_db = []
    chi_so_gop = []

    for id_nl, nhom in tho.groupby("id_nl"):
        ten_nl = nhom["ten_nl"].iloc[0]
        chuoi = nhom[["ngay", "so_luong"]].copy()

        # Dien day du ngay (ngay khong dung = 0).
        day_du = pd.DataFrame(
            {"ngay": pd.date_range(tho["ngay"].min(), tho["ngay"].max(), freq="D")}
        )
        chuoi = day_du.merge(chuoi, on="ngay", how="left").fillna({"so_luong": 0.0})

        if len(chuoi) < toi_thieu_ngay or chuoi["so_luong"].sum() <= 0:
            continue

        df = ft.chuan_bi(chuoi, "so_luong", "ngay")
        cot = [c for c in ft.cot_dac_trung(df, "so_luong", "ngay") if c != "so_luong"]

        ket_qua, tot_nhat = md.huan_luyen_va_danh_gia(df, "so_luong", cot, nho=True)

        if tot_nhat is None:
            # Du phong: trung binh 28 ngay gan nhat.
            tb = float(chuoi["so_luong"].tail(28).mean())
            du_bao = pd.DataFrame(
                {
                    "ngay": pd.date_range(
                        chuoi["ngay"].max() + pd.Timedelta(days=1), periods=so_ngay, freq="D"
                    ),
                    "du_bao": tb,
                }
            )
            ten_mo_hinh = "TrungBinhTruot28"
            mae = float("nan")
        else:
            mo_hinh = md.huan_luyen_lai_toan_bo(tot_nhat.mo_hinh, df, "so_luong", cot)
            du_bao = _du_bao_de_quy(chuoi, "so_luong", mo_hinh, cot, so_ngay)
            ten_mo_hinh = tot_nhat.ten
            mae = tot_nhat.mae
            chi_so_gop.append(
                {"id_nl": int(id_nl), "ten_nl": ten_nl, "mo_hinh": tot_nhat.ten,
                 "mae": tot_nhat.mae, "rmse": tot_nhat.rmse, "mape": tot_nhat.mape,
                 "r2": tot_nhat.r2}
            )

        tong_can = float(du_bao["du_bao"].sum())
        ton_ht = float(ton.loc[id_nl, "ton"]) if id_nl in ton.index else 0.0
        don_vi = ton.loc[id_nl, "ten_dvt"] if id_nl in ton.index else None

        ket_qua_nl.append(
            {
                "id_nl": int(id_nl),
                "ten_nl": ten_nl,
                "don_vi": don_vi,
                "mo_hinh": ten_mo_hinh,
                "mae": None if np.isnan(mae) else round(mae, 4),
                "ton_hien_tai": round(ton_ht, 2),
                "tong_can_du_bao": round(tong_can, 2),
                "can_nhap_them": round(max(tong_can - ton_ht, 0.0), 2),
                "du_ngay": round(ton_ht / (tong_can / so_ngay), 1) if tong_can > 0 else None,
                "chi_tiet_ngay": [
                    {"ngay": r["ngay"].strftime("%Y-%m-%d"), "so_luong": round(r["du_bao"], 3)}
                    for _, r in du_bao.iterrows()
                ],
            }
        )

        for _, r in du_bao.iterrows():
            ban_ghi_db.append(
                {
                    "ngay": r["ngay"].strftime("%Y-%m-%d"),
                    "id_nl": int(id_nl),
                    "sl": float(r["du_bao"]),
                    "ton": ton_ht,
                    "nhap": max(tong_can - ton_ht, 0.0),
                    "mh": ten_mo_hinh,
                }
            )

    if luu_db and ban_ghi_db:
        chay_sql(
            """INSERT INTO du_bao_nguyen_lieu
                 (ngay_du_bao, id_nl, so_luong_can, ton_hien_tai, can_nhap_them, mo_hinh)
               VALUES (:ngay, :id_nl, :sl, :ton, :nhap, :mh)
               ON DUPLICATE KEY UPDATE
                 so_luong_can = VALUES(so_luong_can),
                 ton_hien_tai = VALUES(ton_hien_tai),
                 can_nhap_them = VALUES(can_nhap_them),
                 tao_luc = CURRENT_TIMESTAMP""",
            ban_ghi_db,
        )

    if luu_db and chi_so_gop:
        chay_sql("DELETE FROM danh_gia_mo_hinh WHERE bai_toan = 'du_bao_nguyen_lieu'")
        # Luu chi so tong hop theo tung mo hinh duoc chon.
        bang = pd.DataFrame(chi_so_gop)
        gop = bang.groupby("mo_hinh").agg(
            mae=("mae", "mean"), rmse=("rmse", "mean"),
            mape=("mape", "mean"), r2=("r2", "mean"), n=("id_nl", "count")
        ).reset_index()
        chay_sql(
            """INSERT INTO danh_gia_mo_hinh
                 (bai_toan, mo_hinh, mae, rmse, mape, r2, so_mau_train, so_mau_test)
               VALUES ('du_bao_nguyen_lieu', :mh, :mae, :rmse, :mape, :r2, :n, :n)""",
            [
                {
                    "mh": r["mo_hinh"], "mae": float(r["mae"]), "rmse": float(r["rmse"]),
                    "mape": None if np.isnan(r["mape"]) else float(r["mape"]),
                    "r2": float(r["r2"]), "n": int(r["n"]),
                }
                for _, r in gop.iterrows()
            ],
        )

    ket_qua_nl.sort(key=lambda x: x["can_nhap_them"], reverse=True)
    return {
        "so_ngay": so_ngay,
        "so_nguyen_lieu": len(ket_qua_nl),
        "mape_trung_binh": (
            round(float(np.nanmean([c["mape"] for c in chi_so_gop])), 2) if chi_so_gop else None
        ),
        "nguyen_lieu": ket_qua_nl,
    }

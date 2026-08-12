"""Khai pha luat ket hop bang thuat toan Apriori (tu cai dat).

Bai toan: tu lich su goi mon, tim ra cac mon thuong duoc goi cung nhau, de khi
khach chon mon A thi he thong goi y mon B.

Vi sao tu cai dat thay vi goi mlxtend: thuat toan Apriori la phan trong tam cua
de tai, tu cai dat cho phep giai thich ro tung buoc khi bao ve va kiem soat
duoc cach xu ly du lieu dac thu (gio hang nha hang thuong rat nho, 3-8 mon).

Ba do do:
  support(X)     = so giao dich chua X / tong so giao dich
                   -> muc do pho bien
  confidence(X→Y)= support(X ∪ Y) / support(X)
                   -> xac suat goi Y khi da goi X
  lift(X→Y)      = confidence(X→Y) / support(Y)
                   -> muc do "thuc su lien quan". lift > 1 nghia la goi X LAM
                      TANG kha nang goi Y so voi ngau nhien. Chi so nay quan
                      trong nhat: mot mon ai cung goi (nuoc suoi) se co
                      confidence cao voi moi thu nhung lift ~ 1, tuc la khong
                      mang thong tin goi y.
"""
from __future__ import annotations

from itertools import combinations

import pandas as pd

from .db import chay_sql, doc_sql

SQL_GIO_HANG = """
    SELECT sesis, id_mon
    FROM hopdong
    WHERE id_mon > 0 AND tinhtrang IN (1, 3, 5, 6)
    GROUP BY sesis, id_mon
"""


def nap_giao_dich() -> tuple[list[frozenset], dict[int, str]]:
    """Doc gio hang tu DB, tra ve (danh sach giao dich, ten mon theo id)."""
    df = doc_sql(SQL_GIO_HANG)
    ten = doc_sql("SELECT id_mon, name_mon FROM monan")
    ten_theo_id = dict(zip(ten["id_mon"].astype(int), ten["name_mon"].str.strip()))

    giao_dich = [
        frozenset(nhom["id_mon"].astype(int))
        for _, nhom in df.groupby("sesis")
        if len(nhom) >= 2  # gio chi 1 mon khong dong gop gi cho luat ket hop
    ]
    return giao_dich, ten_theo_id


def dem_ho_tro(giao_dich: list[frozenset], ung_vien: list[frozenset]) -> dict[frozenset, int]:
    """Dem so giao dich chua tung tap ung vien."""
    dem = {uv: 0 for uv in ung_vien}
    for gd in giao_dich:
        for uv in ung_vien:
            if uv <= gd:
                dem[uv] += 1
    return dem


def sinh_ung_vien(tap_thuong_xuyen: list[frozenset], k: int) -> list[frozenset]:
    """Sinh tap ung vien kich thuoc k tu cac tap thuong xuyen kich thuoc k-1.

    Ap dung tinh chat Apriori: moi tap con kich thuoc k-1 cua mot tap thuong
    xuyen kich thuoc k cung phai thuong xuyen. Nho vay loai bot rat nhieu ung
    vien truoc khi phai quet lai du lieu.
    """
    tap_set = set(tap_thuong_xuyen)
    ung_vien = set()
    for a, b in combinations(tap_thuong_xuyen, 2):
        hop = a | b
        if len(hop) != k:
            continue
        # Cat tia: kiem tra moi tap con (k-1) deu thuong xuyen.
        if all(frozenset(c) in tap_set for c in combinations(hop, k - 1)):
            ung_vien.add(hop)
    return list(ung_vien)


def apriori(
    giao_dich: list[frozenset], ho_tro_toi_thieu: float = 0.02, kich_thuoc_toi_da: int = 3
) -> dict[frozenset, float]:
    """Tim tat ca tap muc thuong xuyen. Tra ve {tap muc: support}."""
    n = len(giao_dich)
    if n == 0:
        return {}
    nguong = ho_tro_toi_thieu * n

    # L1
    dem_1: dict[frozenset, int] = {}
    for gd in giao_dich:
        for m in gd:
            k = frozenset([m])
            dem_1[k] = dem_1.get(k, 0) + 1

    thuong_xuyen = {k: v for k, v in dem_1.items() if v >= nguong}
    tat_ca = dict(thuong_xuyen)

    hien_tai = list(thuong_xuyen.keys())
    k = 2
    while hien_tai and k <= kich_thuoc_toi_da:
        ung_vien = sinh_ung_vien(hien_tai, k)
        if not ung_vien:
            break
        dem = dem_ho_tro(giao_dich, ung_vien)
        thuong_xuyen = {t: c for t, c in dem.items() if c >= nguong}
        tat_ca.update(thuong_xuyen)
        hien_tai = list(thuong_xuyen.keys())
        k += 1

    return {t: c / n for t, c in tat_ca.items()}


def sinh_luat(
    tap_thuong_xuyen: dict[frozenset, float],
    tin_cay_toi_thieu: float = 0.25,
    lift_toi_thieu: float = 1.05,
    ve_phai_mot_mon: bool = True,
) -> list[dict]:
    """Sinh luat X -> Y tu cac tap muc thuong xuyen.

    `ve_phai_mot_mon=True`: chi sinh luat co ve phai la MOT mon. Voi bai toan
    goi y mon an thi day la dang dung duoc truc tiep ("goi them mon gi").
    """
    luat = []
    for tap, ho_tro in tap_thuong_xuyen.items():
        if len(tap) < 2:
            continue
        for r in range(1, len(tap)):
            if ve_phai_mot_mon and r != 1:
                continue
            for ve_phai in combinations(tap, r):
                ve_phai = frozenset(ve_phai)
                ve_trai = tap - ve_phai
                if not ve_trai:
                    continue
                ht_trai = tap_thuong_xuyen.get(ve_trai)
                ht_phai = tap_thuong_xuyen.get(ve_phai)
                if not ht_trai or not ht_phai:
                    continue
                tin_cay = ho_tro / ht_trai
                lift = tin_cay / ht_phai
                if tin_cay >= tin_cay_toi_thieu and lift >= lift_toi_thieu:
                    luat.append(
                        {
                            "ve_trai": sorted(ve_trai),
                            "ve_phai": sorted(ve_phai)[0] if ve_phai_mot_mon else sorted(ve_phai),
                            "ho_tro": ho_tro,
                            "tin_cay": tin_cay,
                            "lift": lift,
                        }
                    )
    luat.sort(key=lambda x: (x["lift"], x["tin_cay"]), reverse=True)
    return luat


def khai_pha_va_luu(
    ho_tro_toi_thieu: float = 0.02,
    tin_cay_toi_thieu: float = 0.25,
    lift_toi_thieu: float = 1.05,
    kich_thuoc_toi_da: int = 3,
) -> dict:
    """Chay toan bo quy trinh va ghi luat vao bang `luat_ket_hop`."""
    giao_dich, ten_theo_id = nap_giao_dich()
    if not giao_dich:
        raise ValueError("Khong co gio hang nao co tu 2 mon tro len.")

    tap = apriori(giao_dich, ho_tro_toi_thieu, kich_thuoc_toi_da)
    luat = sinh_luat(tap, tin_cay_toi_thieu, lift_toi_thieu)

    chay_sql("DELETE FROM luat_ket_hop")
    if luat:
        chay_sql(
            """INSERT INTO luat_ket_hop
                 (mon_ve_trai, mon_ve_phai, do_ho_tro, do_tin_cay, do_nang, so_giao_dich)
               VALUES (:trai, :phai, :ht, :tc, :lift, :n)""",
            [
                {
                    "trai": ",".join(str(x) for x in r["ve_trai"]),
                    "phai": int(r["ve_phai"]),
                    "ht": float(r["ho_tro"]),
                    "tc": float(r["tin_cay"]),
                    "lift": float(r["lift"]),
                    "n": len(giao_dich),
                }
                for r in luat
            ],
        )

    return {
        "so_giao_dich": len(giao_dich),
        "kich_thuoc_gio_tb": round(sum(len(g) for g in giao_dich) / len(giao_dich), 2),
        "so_tap_thuong_xuyen": len(tap),
        "so_luat": len(luat),
        "tham_so": {
            "min_support": ho_tro_toi_thieu,
            "min_confidence": tin_cay_toi_thieu,
            "min_lift": lift_toi_thieu,
        },
        "top_luat": [
            {
                "neu_goi": [ten_theo_id.get(i, str(i)) for i in r["ve_trai"]],
                "goi_y_them": ten_theo_id.get(r["ve_phai"], str(r["ve_phai"])),
                "ho_tro": round(r["ho_tro"], 4),
                "tin_cay": round(r["tin_cay"], 4),
                "lift": round(r["lift"], 3),
            }
            for r in luat[:30]
        ],
    }


def goi_y(id_mon_dang_chon: list[int], so_luong: int = 5) -> list[dict]:
    """Tra ve goi y mon dua tren cac luat da khai pha.

    Chi dung cac luat ma TOAN BO ve trai nam trong gio hang hien tai, va mon
    goi y chua co san trong gio.
    """
    if not id_mon_dang_chon:
        return []

    dang_chon = set(int(x) for x in id_mon_dang_chon)
    df = doc_sql(
        """SELECT l.mon_ve_trai, l.mon_ve_phai, l.do_ho_tro, l.do_tin_cay, l.do_nang,
                  m.name_mon, m.gia_mon, m.images
           FROM luat_ket_hop l
           JOIN monan m ON m.id_mon = l.mon_ve_phai
           WHERE m.tinhtrang = 1
           ORDER BY l.do_nang DESC"""
    )
    if df.empty:
        return []

    diem: dict[int, dict] = {}
    for _, r in df.iterrows():
        ve_trai = {int(x) for x in str(r["mon_ve_trai"]).split(",") if x}
        ve_phai = int(r["mon_ve_phai"])
        if not ve_trai <= dang_chon or ve_phai in dang_chon:
            continue
        # Mot mon co the duoc nhieu luat de xuat; giu luat manh nhat (lift cao nhat).
        cu = diem.get(ve_phai)
        if cu is None or r["do_nang"] > cu["lift"]:
            diem[ve_phai] = {
                "id_mon": ve_phai,
                "name_mon": str(r["name_mon"]).strip(),
                "gia_mon": float(r["gia_mon"]),
                "images": r["images"],
                "ho_tro": round(float(r["do_ho_tro"]), 4),
                "tin_cay": round(float(r["do_tin_cay"]), 4),
                "lift": round(float(r["do_nang"]), 3),
                "so_luat_ho_tro": 1,
            }
        else:
            cu["so_luat_ho_tro"] += 1

    ds = sorted(diem.values(), key=lambda x: (x["lift"], x["tin_cay"]), reverse=True)
    return ds[:so_luong]


def mon_pho_bien(so_luong: int = 5) -> list[dict]:
    """Du phong khi gio hang trong hoac chua co luat nao khop: mon ban chay."""
    df = doc_sql(
        """SELECT h.id_mon, m.name_mon, m.gia_mon, m.images, SUM(h.soluong) AS sl
           FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon
           WHERE h.tinhtrang = 3 AND h.id_mon > 0 AND m.tinhtrang = 1
             AND h.ngay_dat >= (SELECT DATE_SUB(MAX(ngay_dat), INTERVAL 60 DAY) FROM hopdong)
           GROUP BY h.id_mon, m.name_mon, m.gia_mon, m.images
           ORDER BY sl DESC LIMIT :n""",
        {"n": so_luong},
    )
    return [
        {
            "id_mon": int(r["id_mon"]),
            "name_mon": str(r["name_mon"]).strip(),
            "gia_mon": float(r["gia_mon"]),
            "images": r["images"],
            "ly_do": "ban_chay",
        }
        for _, r in df.iterrows()
    ]

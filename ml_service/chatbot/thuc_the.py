"""Tang 3 - Trich xuat THUC THE (slot filling).

Biet y dinh thoi thi chua tra loi duoc. "Doanh thu tuan truoc" va "doanh thu
thang nay" cung mot y dinh nhung hai cau tra loi khac han. Tang nay rut ra cac
THAM SO can thiet:

    thoi_gian   khoang ngay -> WHERE ngay_dat BETWEEN ? AND ?
    mon         id mon an
    nguyen_lieu id nguyen lieu
    loai_mon    id danh muc
    so          so nguoi / so luong
    gia         nguong gia (VND)
    top_n       lay bao nhieu dong

VI SAO KHONG DUNG MO HINH HOC MAY CHO TANG NAY
----------------------------------------------
Ten mon an, ten nguyen lieu la du lieu SONG: quan them mon moi luc nao cung
duoc. Neu dung mo hinh NER hoc may thi moi lan them mon phai gan nhan lai va
huan luyen lai - khong the chap nhan trong van hanh that.

Vi vay tang nay dung TU DIEN THUC THE (gazetteer) SINH DONG TU CSDL, ghep bang
do tuong dong 3-gram ky tu de chiu duoc loi chinh ta. Them mon moi vao CSDL la
bot hieu ngay, khong huan luyen lai gi ca. Day la mot quyet dinh thiet ke co
chu dich, khong phai su cat giam.

MOC THOI GIAN
-------------
"Hom nay" duoc neo vao NGAY CO DU LIEU MOI NHAT trong bang hopdong, khong phai
ngay he thong. Ly do: CSDL trinh dien co du lieu mo phong tren mot khoang co
dinh; neu neo vao ngay he thong that thi moi cau hoi ve "hom nay" deu tra ve 0
va khong the trinh dien duoc. Cau tra loi luon ghi ro moc ngay dang dung nen
nguoi doc khong bi hieu nham.
"""
from __future__ import annotations

import re
import time
import unicodedata
from datetime import date, datetime, timedelta

from .tien_xu_ly import bo_dau, chuan_hoa, gan_giong

# --------------------------------------------------------------------------
# Bo nho dem tu dien thuc the (nap lai moi 5 phut)
# --------------------------------------------------------------------------
_TU_DIEN: dict | None = None
_TU_DIEN_LUC = 0.0
_HAN_CACHE_GIAY = 300

_MOC: date | None = None
_MOC_LUC = 0.0


def _doc_bang(cau_lenh: str) -> list[dict]:
    """Doc mot bang, tra ve [] neu CSDL khong san sang (khong lam sap bot)."""
    try:
        from ..db import doc_sql

        return doc_sql(cau_lenh).to_dict("records")
    except Exception:
        return []


def nap_tu_dien(bat_buoc: bool = False) -> dict:
    """Nap tu dien mon an / nguyen lieu / danh muc / ban tu CSDL."""
    global _TU_DIEN, _TU_DIEN_LUC
    if _TU_DIEN is not None and not bat_buoc and (time.time() - _TU_DIEN_LUC) < _HAN_CACHE_GIAY:
        return _TU_DIEN

    _TU_DIEN = {
        "mon": _doc_bang(
            "SELECT id_mon, name_mon, gia_mon, id_loai FROM monan WHERE tinhtrang = 1"
        ),
        "nguyen_lieu": _doc_bang("SELECT id_nl, ten_nl FROM nguyen_lieu"),
        "loai_mon": _doc_bang("SELECT id_loai, name_loai FROM loai_mon"),
    }
    _TU_DIEN_LUC = time.time()
    return _TU_DIEN


def lay_moc_hom_nay() -> date:
    """Ngay duoc coi la 'hom nay' - xem chu thich dau file."""
    global _MOC, _MOC_LUC
    if _MOC is not None and (time.time() - _MOC_LUC) < _HAN_CACHE_GIAY:
        return _MOC

    hom_nay = date.today()
    rows = _doc_bang("SELECT MAX(ngay_dat) AS m FROM hopdong WHERE id_mon > 0")
    moc = hom_nay
    if rows and rows[0].get("m"):
        gia_tri = rows[0]["m"]
        if isinstance(gia_tri, datetime):
            gia_tri = gia_tri.date()
        if isinstance(gia_tri, date):
            # Khong bao gio vuot qua ngay that: du lieu mo phong co the co ngay
            # tuong lai, nhung "hom nay" thi khong the o tuong lai.
            moc = min(gia_tri, hom_nay)
    _MOC, _MOC_LUC = moc, time.time()
    return moc


# --------------------------------------------------------------------------
# Thoi gian
# --------------------------------------------------------------------------
_SO_CHU = {
    "mot": 1, "hai": 2, "ba": 3, "bon": 4, "nam": 5, "sau": 6, "bay": 7,
    "tam": 8, "chin": 9, "muoi": 10, "muoi lam": 15, "hai muoi": 20, "ba muoi": 30,
}


def _dau_tuan(d: date) -> date:
    """Thu 2 cua tuan chua ngay d (tuan bat dau tu Thu 2 theo thoi quen VN)."""
    return d - timedelta(days=d.weekday())


def _dau_thang(d: date) -> date:
    return d.replace(day=1)


def _cuoi_thang(d: date) -> date:
    return (_dau_thang(d) + timedelta(days=32)).replace(day=1) - timedelta(days=1)


def tach_thoi_gian(cau: str) -> dict | None:
    """Doc bieu thuc thoi gian tieng Viet -> {tu, den, nhan}.

    Tra ve None neu cau khong nhac gi den thoi gian; tang truy van se tu ap
    khoang mac dinh (30 ngay gan nhat) va noi ro dieu do trong cau tra loi.
    """
    s = bo_dau(chuan_hoa(cau))
    hn = lay_moc_hom_nay()

    def _kq(tu: date, den: date, nhan: str) -> dict:
        return {"tu": tu.isoformat(), "den": den.isoformat(), "nhan": nhan}

    # --- ngay cu the: 15/3, 15/03/2026 ---
    m = re.search(r"\bngay (\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?", s)
    if m:
        ngay, thang = int(m.group(1)), int(m.group(2))
        nam = int(m.group(3)) if m.group(3) else hn.year
        try:
            d = date(nam, thang, ngay)
            return _kq(d, d, f"ngày {d.strftime('%d/%m/%Y')}")
        except ValueError:
            pass

    # --- thang cu the: thang 3, thang 3/2026 ---
    m = re.search(r"\bthang (\d{1,2})(?:[/-](\d{4}))?\b", s)
    if m and not re.search(r"thang (nay|truoc|roi|qua|vua roi)", s):
        thang = int(m.group(1))
        nam = int(m.group(2)) if m.group(2) else hn.year
        if 1 <= thang <= 12:
            d = date(nam, thang, 1)
            return _kq(d, _cuoi_thang(d), f"tháng {thang}/{nam}")

    # --- N ngay qua / N ngay gan day ---
    m = re.search(r"\b(\d{1,3})\s*(?:ngay|hom)\s*(?:qua|gan day|gan nhat|truoc|nay)\b", s)
    if m:
        n = max(1, int(m.group(1)))
        return _kq(hn - timedelta(days=n - 1), hn, f"{n} ngày gần nhất")

    m = re.search(r"\b(\d{1,2})\s*(?:tuan)\s*(?:qua|gan day|gan nhat|truoc)\b", s)
    if m:
        n = max(1, int(m.group(1)))
        return _kq(hn - timedelta(weeks=n) + timedelta(days=1), hn, f"{n} tuần gần nhất")

    m = re.search(r"\b(\d{1,2})\s*(?:thang)\s*(?:qua|gan day|gan nhat|truoc)\b", s)
    if m:
        n = max(1, int(m.group(1)))
        return _kq(hn - timedelta(days=30 * n - 1), hn, f"{n} tháng gần nhất")

    # --- cac cum co dinh, xet tu cu the den tong quat ---
    if re.search(r"\bhom kia\b", s):
        d = hn - timedelta(days=2)
        return _kq(d, d, "hôm kia")
    if re.search(r"\bhom qua\b", s):
        d = hn - timedelta(days=1)
        return _kq(d, d, "hôm qua")
    if re.search(r"\b(hom nay|bua nay|ngay hom nay|hien tai|bay gio)\b", s):
        return _kq(hn, hn, "hôm nay")

    # Xet TRUOC cac cum "tuan ...", vi "cuoi tuan roi" chua san chuoi "tuan roi".
    if re.search(r"\bcuoi tuan\b", s):
        thu7 = _dau_tuan(hn) + timedelta(days=5)
        if thu7 > hn:  # chua toi Thu 7 cua tuan nay -> lay cuoi tuan truoc
            thu7 -= timedelta(days=7)
        return _kq(thu7, min(thu7 + timedelta(days=1), hn), "cuối tuần gần nhất")

    if re.search(r"\btuan (truoc|roi|vua roi|ngoai)\b", s):
        dau = _dau_tuan(hn) - timedelta(days=7)
        return _kq(dau, dau + timedelta(days=6), "tuần trước")
    if re.search(r"\btuan (nay|hien tai)\b", s):
        return _kq(_dau_tuan(hn), hn, "tuần này")
    if re.search(r"\btuan qua\b", s):
        return _kq(hn - timedelta(days=6), hn, "7 ngày gần nhất")

    if re.search(r"\bthang (truoc|roi|vua roi|ngoai)\b", s):
        cuoi = _dau_thang(hn) - timedelta(days=1)
        return _kq(_dau_thang(cuoi), cuoi, "tháng trước")
    if re.search(r"\bthang (nay|hien tai)\b", s):
        return _kq(_dau_thang(hn), hn, "tháng này")
    if re.search(r"\bthang qua\b", s):
        return _kq(hn - timedelta(days=29), hn, "30 ngày gần nhất")

    if re.search(r"\bnam (ngoai|truoc)\b", s):
        return _kq(date(hn.year - 1, 1, 1), date(hn.year - 1, 12, 31), f"năm {hn.year - 1}")
    if re.search(r"\bnam (nay|hien tai)\b", s):
        return _kq(date(hn.year, 1, 1), hn, f"năm {hn.year}")

    if re.search(r"\bquy (nay|hien tai)\b", s):
        quy = (hn.month - 1) // 3
        return _kq(date(hn.year, 3 * quy + 1, 1), hn, f"quý {quy + 1}/{hn.year}")
    if re.search(r"\bquy (truoc|roi|vua roi)\b", s):
        quy = (hn.month - 1) // 3
        nam, quy_truoc = (hn.year - 1, 3) if quy == 0 else (hn.year, quy - 1)
        dau = date(nam, 3 * quy_truoc + 1, 1)
        return _kq(dau, _cuoi_thang(date(nam, 3 * quy_truoc + 3, 1)),
                   f"quý {quy_truoc + 1}/{nam}")

    if re.search(r"\b(ngay mai|mai|tuan toi|tuan sau|sap toi|nhung ngay toi|thang toi)\b", s):
        # Moc tuong lai: dung cho y dinh du bao, khong dung de truy van lich su.
        return {"tu": (hn + timedelta(days=1)).isoformat(),
                "den": (hn + timedelta(days=7)).isoformat(),
                "nhan": "7 ngày tới", "tuong_lai": True}

    return None


# --------------------------------------------------------------------------
# Thuc the tu dien
# --------------------------------------------------------------------------
def _tim_theo_tu_dien(cau: str, danh_sach: list[dict], cot_ten: str,
                      nguong: float = 0.62) -> dict | None:
    """Tim muc trong tu dien khop tot nhat voi cau hoi.

    Hai buoc:
      1. Khop chuoi con truc tiep (nhanh, chinh xac): ten mon nam gon trong cau.
      2. Neu khong co, truot cua so n tu tren cau va do tuong dong 3-gram ky tu
         voi tung ten -> chiu duoc go sai chinh ta.
    """
    if not danh_sach:
        return None

    s = bo_dau(chuan_hoa(cau))
    tot_nhat, diem_tot = None, 0.0

    for muc in danh_sach:
        ten = str(muc.get(cot_ten) or "").strip()
        if not ten:
            continue
        ten_kd = bo_dau(ten.lower()).strip()
        if not ten_kd:
            continue
        # Buoc 1 - khop truc tiep. Ten dai duoc uu tien (nhieu thong tin hon).
        if ten_kd in s:
            diem = 0.9 + min(len(ten_kd), 40) / 400.0
            if diem > diem_tot:
                tot_nhat, diem_tot = muc, diem

    if tot_nhat is not None:
        return {**tot_nhat, "_diem_khop": round(diem_tot, 3)}

    # Buoc 2 - do tuong dong tren cua so truot.
    tu = s.split()
    for muc in danh_sach:
        ten = str(muc.get(cot_ten) or "").strip()
        if not ten:
            continue
        so_tu_ten = max(1, len(bo_dau(ten).split()))
        for kich_thuoc in {so_tu_ten, so_tu_ten + 1, max(1, so_tu_ten - 1)}:
            for i in range(0, max(1, len(tu) - kich_thuoc + 1)):
                cua_so = " ".join(tu[i:i + kich_thuoc])
                diem = gan_giong(cua_so, ten)
                if diem > diem_tot:
                    tot_nhat, diem_tot = muc, diem

    if tot_nhat is not None and diem_tot >= nguong:
        return {**tot_nhat, "_diem_khop": round(diem_tot, 3)}
    return None


def tach_mon(cau: str) -> dict | None:
    return _tim_theo_tu_dien(cau, nap_tu_dien()["mon"], "name_mon")


def tach_nguyen_lieu(cau: str) -> dict | None:
    return _tim_theo_tu_dien(cau, nap_tu_dien()["nguyen_lieu"], "ten_nl")


def tach_loai_mon(cau: str) -> dict | None:
    return _tim_theo_tu_dien(cau, nap_tu_dien()["loai_mon"], "name_loai", nguong=0.72)


# --------------------------------------------------------------------------
# So, tien, top N
# --------------------------------------------------------------------------
def tach_so_nguoi(cau: str) -> int | None:
    s = bo_dau(chuan_hoa(cau))
    m = re.search(r"\b(\d{1,2})\s*(nguoi|khach|ban|suat|phan)\b", s)
    if m:
        return int(m.group(1))
    for chu, gia_tri in _SO_CHU.items():
        if re.search(rf"\b{chu}\s*(nguoi|khach)\b", s):
            return gia_tri
    return None


def tach_gia(cau: str) -> dict | None:
    """Doc nguong gia: '100k', '200 nghin', '1 trieu', '150000'.

    Tra ve {'gia': int, 'huong': 'duoi'|'tren'|'khoang'}.
    """
    s = bo_dau(chuan_hoa(cau))
    gia = None

    m = re.search(r"\b(\d+(?:[.,]\d+)?)\s*(trieu|tr)\b", s)
    if m:
        gia = int(float(m.group(1).replace(",", ".")) * 1_000_000)
    if gia is None:
        m = re.search(r"\b(\d+)\s*(k|nghin|ngan|ngin)\b", s)
        if m:
            gia = int(m.group(1)) * 1000
    if gia is None:
        m = re.search(r"\b(\d{4,9})\b", s)
        if m:
            gia = int(m.group(1))
    if gia is None:
        return None

    if re.search(r"\b(duoi|re hon|it hon|khong qua|toi da|do lai|tro xuong)\b", s):
        huong = "duoi"
    elif re.search(r"\b(tren|hon|cao hon|tu|tro len)\b", s):
        huong = "tren"
    else:
        huong = "khoang"
    return {"gia": gia, "huong": huong}


def tach_top_n(cau: str, mac_dinh: int = 10) -> int:
    s = bo_dau(chuan_hoa(cau))
    m = re.search(r"\btop\s*(\d{1,2})\b", s)
    if m:
        return max(1, min(50, int(m.group(1))))
    m = re.search(r"\b(\d{1,2})\s*(mon|nguyen lieu|nhan vien|dong|cai)\b", s)
    if m:
        return max(1, min(50, int(m.group(1))))
    return mac_dinh


# --------------------------------------------------------------------------
def trich_xuat(cau: str, y_dinh_ma: str = "") -> dict:
    """Rut tat ca tham so co the co tu cau hoi.

    Chi goi cac ham can thiet cho y dinh dang xu ly de tranh tra cuu tu dien
    thua (tim ten mon phai duyet ca bang mon an).
    """
    tham_so: dict = {}

    tg = tach_thoi_gian(cau)
    if tg:
        tham_so["thoi_gian"] = tg

    can_mon = y_dinh_ma in {
        "hoi_gia_mon", "goi_y_mon", "hoi_trang_thai_don", "hoi_mon_theo_loai",
    } or not y_dinh_ma
    if can_mon:
        mon = tach_mon(cau)
        if mon:
            tham_so["mon"] = mon

    if y_dinh_ma in {"hoi_ton_kho", "hoi_nguyen_lieu_sap_het", "hoi_lo_sap_het_han"} or not y_dinh_ma:
        nl = tach_nguyen_lieu(cau)
        if nl:
            tham_so["nguyen_lieu"] = nl

    if y_dinh_ma in {"hoi_mon_theo_loai", "hoi_thuc_don", "hoi_do_uong"} or not y_dinh_ma:
        loai = tach_loai_mon(cau)
        if loai:
            tham_so["loai_mon"] = loai

    so = tach_so_nguoi(cau)
    if so:
        tham_so["so_nguoi"] = so

    gia = tach_gia(cau)
    if gia and y_dinh_ma in {"hoi_mon_theo_gia", "hoi_combo", "hoi_gia_mon", ""}:
        tham_so["gia"] = gia

    tham_so["top_n"] = tach_top_n(cau)
    return tham_so

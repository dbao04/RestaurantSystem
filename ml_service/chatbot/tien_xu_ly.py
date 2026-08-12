"""Tang 1 - Tien xu ly cau hoi tieng Viet.

Vi sao can tang nay: nguoi dung that go rat "ban" so voi van viet chuan.
Ba hien tuong pho bien nhat trong tieng Viet:

  1. Go KHONG DAU        "doanh thu hom qua"   <- rat pho bien tren dien thoai
  2. Teencode / viet tat "dt hqua bnhieu"
  3. Dau cau lung tung   "Doanh thu???"

Neu khong chuan hoa, mo hinh phai hoc rieng tung bien the -> can nhieu du lieu
hon han. Chuan hoa o day giup bo phan loai o tang 2 nho hon va chinh xac hon.

Luu y phuong phap: ham `bo_dau` KHONG duoc dung de thay the van ban goc, ma
dung de sinh THEM mot dac trung song song (xem phan_loai.py). Ly do: bo dau lam
mat thong tin ("ma" / "má" / "mà" thanh mot), nen chi dung nhu mot kenh bo tro.
"""
from __future__ import annotations

import re
import unicodedata

# --------------------------------------------------------------------------
# Bang teencode / viet tat -> dang chuan.
#
# Chi liet ke nhung tu THUC SU xuat hien trong ngu canh nha hang. Bang cang dai
# cang de gay hieu nham (vd "ban" vua la "bàn" vua la "bạn"), nen giu ngan va
# chi anh xa cac tu khong nhap nhang.
# --------------------------------------------------------------------------
TU_VIET_TAT: dict[str, str] = {
    # so lieu kinh doanh
    "dt": "doanh thu",
    "dthu": "doanh thu",
    "ln": "lợi nhuận",
    "sl": "số lượng",
    "sp": "sản phẩm",
    "kh": "khách hàng",
    "nv": "nhân viên",
    "nl": "nguyên liệu",
    "tk": "tồn kho",
    "cf": "chi phí",
    "ck": "chiết khấu",
    "km": "khuyến mãi",
    # thoi gian
    "hnay": "hôm nay",
    "hqua": "hôm qua",
    "hnbg": "hôm nay",
    "tuan nay": "tuần này",
    "thang nay": "tháng này",
    "tnay": "tuần này",
    "tqua": "tuần qua",
    # tu noi thong dung
    "ko": "không",
    "k": "không",
    "kh0": "không",
    "khong": "không",
    "dc": "được",
    "đc": "được",
    "vs": "với",
    "j": "gì",
    "z": "vậy",
    "v": "vậy",
    "bn": "bao nhiêu",
    "bnhieu": "bao nhiêu",
    "bao nhieu": "bao nhiêu",
    "ntn": "như thế nào",
    "the nao": "thế nào",
    "cho t": "cho tôi",
    "mn": "mọi người",
    "ad": "quản trị",
    "e": "em",
    "a": "anh",
    "ah": "ạ",
    "ak": "ạ",
    "oke": "ok",
    "okie": "ok",
}

# Dau cau bi loai bo. Giu lai `/ - :` vi chung nam trong ngay thang va gio.
_DAU_CAU = re.compile(r"[^\w\s/:\-àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệ"
                      r"ìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
                      flags=re.IGNORECASE)
_NHIEU_KHOANG = re.compile(r"\s+")


def bo_dau(chuoi: str) -> str:
    """Bo dau tieng Viet: 'doanh thu hôm qua' -> 'doanh thu hom qua'.

    Dung ky thuat tach to hop Unicode (NFD) roi loai cac ky tu dau thanh /
    dau mu, sau do xu ly rieng chu 'd' co gach ngang vi no la mot ky tu doc lap
    chu khong phai 'd' + dau.
    """
    chuoi = chuoi.replace("đ", "d").replace("Đ", "D")
    tach = unicodedata.normalize("NFD", chuoi)
    return "".join(c for c in tach if unicodedata.category(c) != "Mn")


def _thay_viet_tat(cac_tu: list[str]) -> list[str]:
    """Thay tung tu viet tat. So khop tren ban KHONG DAU de bat ca 'hqua'/'hqúa'."""
    ket_qua = []
    for tu in cac_tu:
        khoa = bo_dau(tu)
        ket_qua.append(TU_VIET_TAT.get(khoa, tu))
    return ket_qua


def chuan_hoa(cau: str) -> str:
    """Chuan hoa mot cau hoi ve dang mo hinh nhin thay.

    Cac buoc: NFC -> chu thuong -> bo dau cau -> gian teencode -> gom khoang trang.
    """
    if not cau:
        return ""
    cau = unicodedata.normalize("NFC", str(cau))
    cau = cau.lower()
    cau = _DAU_CAU.sub(" ", cau)
    cau = _NHIEU_KHOANG.sub(" ", cau).strip()
    if not cau:
        return ""
    cau = " ".join(_thay_viet_tat(cau.split(" ")))
    return _NHIEU_KHOANG.sub(" ", cau).strip()


def chuan_hoa_khong_dau(cau: str) -> str:
    """Ban khong dau cua cau da chuan hoa - dung lam kenh dac trung thu hai."""
    return bo_dau(chuan_hoa(cau))


def gan_giong(a: str, b: str) -> float:
    """Do tuong dong tho giua hai chuoi (he so Dice tren tap 3-gram ky tu).

    Dung cho viec do khop TEN MON khi khach go sai chinh ta: "com chien loc fat"
    van tim ra "Cơm chiên Lộc Phát". Khong dung thu vien ngoai de giai thich
    duoc cong thuc khi bao ve.

        Dice(A, B) = 2 * |A giao B| / (|A| + |B|)
    """
    a = bo_dau(a.lower()).replace(" ", "")
    b = bo_dau(b.lower()).replace(" ", "")
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0

    def _bo_3gram(s: str) -> set[str]:
        if len(s) < 3:
            return {s}
        return {s[i:i + 3] for i in range(len(s) - 2)}

    ta, tb = _bo_3gram(a), _bo_3gram(b)
    chung = len(ta & tb)
    return (2.0 * chung) / (len(ta) + len(tb)) if (ta or tb) else 0.0

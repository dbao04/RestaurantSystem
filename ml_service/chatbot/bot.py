"""Dieu phoi toan bo pipeline chatbot.

Mot luot hoi di qua:

    cau hoi --> [1] chuan hoa --> [2] phan loai y dinh --> [3] trich thuc the
             --> [4] truy van CSDL --> [5] sinh cau tra loi --> ghi nhat ky

NGU CANH MOT LUOT (context)
---------------------------
Bot co bo nho mot buoc: khi thieu tham so bat buoc (vd hoi gia mon nhung khong
neu ten mon), no tra ve `cho_tham_so`. Phia Node luu lai trong phien; luot sau
nguoi dung chi can go "ga nuong" la bot ghep vao y dinh dang cho, khong bat ho
go lai ca cau. Day la ky thuat "slot filling nhieu luot" don gian nhat ma van
lam hoi thoai tu nhien han len.

NHAT KY
-------
Moi luot duoc ghi vao bang `chatbot_hoi_thoai`. Ba muc dich:
  1. Do do chinh xac THAT tren cau hoi that (khac voi do tren tap kiem thu).
  2. Cau bi "khong hieu" chinh la du lieu quy nhat de mo rong bo mau cau.
  3. Trang quan tri co so lieu de bao cao.
Ghi nhat ky KHONG duoc lam hong cau tra loi: moi loi ghi deu bi nuot.
"""
from __future__ import annotations

import time

from . import phan_loai as pl
from . import thuc_the as tt
from . import tra_loi as tl
from . import truy_van as tv
from . import y_dinh as yd
from .tien_xu_ly import bo_dau, chuan_hoa

# Y dinh nao bat buoc phai co tham so gi.
THAM_SO_BAT_BUOC = {
    "hoi_gia_mon": "mon",
}

# CUU VOT BANG THUC THE
# ---------------------
# Bo phan loai duoc huan luyen tren thuc don Viet cu. Tu dot doi thuc don thang
# 8/2026, ten mon la tieng Nhat (nigiri, sashimi, tempura, udon, gunkan...) -
# nhung tu khong co trong tu vung huan luyen. Diem tin cay vi the tut xuong
# 0.23-0.44, tuc la SAT DUOI nguong 0.45, du `hoi_gia_mon` van la ung vien dau
# hoac nhi. Do thu ca thuc don: 71/169 ten mon ngan khong hoi gia duoc, bot tra
# ve "chua hieu" - xem phan han che trong HUONG_DAN_CHATBOT.md.
#
# Cach cuu: neu tang thuc the tim thay DUNG NGUYEN VAN mot ten mon co trong
# thuc don, do la bang chung DOC LAP voi mo hinh - manh hon vai phan tram diem
# con thieu. Ba dieu kien de khong bien thanh doan bua:
#   1. Chi cuu khi mo hinh KHONG chot duoc gi (ket qua la "khong_hieu"), va
#      y dinh duoc cuu phai nam trong top ung vien, phai la y dinh co tham so
#      BAT BUOC (bang tren) - loai nay khong the "doan lam" ra viec khac vi
#      thieu tham so la khong chay duoc.
#   2. Diem cua ung vien do phai tu NGUONG_CUU tro len: duoi muc do thi no
#      khong con la ung vien nghiem tuc nua.
#   3. Ten mon (da bo ma mon "T09-" va phan trong ngoac) phai xuat hien
#      NGUYEN VAN trong cau, khong nhan khop mo do tuong dong - khop mo tren
#      mot cau bat ky rat de an bua.
# Do lai sau khi sua: ca thuc don 235 mon, con 19 mon khong hoi gia duoc (deu
# la mon co chu "combo"/"set" trong ten, bi doc thanh y dinh hoi combo), khong
# co mon nao tra ra NHAM mon. Khi mo hinh duoc huan luyen lai theo thuc don moi
# thi duong cuu nay gan nhu khong con duoc dung den, va co the bo di.
#
# 0.15 tren bai toan 37 nhan la gap ~5.5 lan muc ngau nhien (0.027). Chon thap
# duoc vi ganh nang bang chung o day do TEN MON chiu, khong phai mo hinh.
NGUONG_CUU = 0.15


def _ghi_nhat_ky(ban_ghi: dict) -> int | None:
    """Ghi mot luot vao nhat ky, tra ve id dong vua chen.

    Id duoc gui ve trinh duyet de nut "hữu ích / chưa đúng ý" biet cham vao
    luot nao. Moi loi ghi deu bi nuot: nhat ky khong bao gio duoc phep lam
    hong cau tra loi.
    """
    try:
        from sqlalchemy import text

        from ..db import lay_engine

        with lay_engine().begin() as conn:
            kq = conn.execute(
                text("""INSERT INTO chatbot_hoi_thoai
                          (cau_hoi, y_dinh, tin_cay, quyen, id_kh, id_nv,
                           thoi_gian_ms, khong_hieu, tham_so)
                        VALUES (:cau, :yd, :tc, :q, :kh, :nv, :ms, :kh_hieu, :ts)"""),
                ban_ghi,
            )
            return int(kq.lastrowid) if kq.lastrowid else None
    except Exception:
        return None


def _co_nguyen_van(cau: str, ten_mon) -> bool:
    """Ten mon co xuat hien nguyen van trong cau khong (bo qua dau va ma mon)?

    Ten trong CSDL mang tien to ma mon ("T09-GÀ CHIÊN KARAAGE") con nguoi ta go
    "gà chiên karaage", nen phai so tren phan ten da rut gon - dung dung
    `_diem_khop` cua tang thuc the, vi diem do con tinh ca khop mo.
    """
    ten = tt.rut_gon_ten(ten_mon).lower()
    return bool(ten) and bo_dau(ten) in bo_dau(chuan_hoa(cau))


def _cuu_bang_thuc_the(cau: str, dd: dict) -> tuple[str, bool]:
    """Nhan lai y dinh dan dau khi cau chua nguyen van ten mot mon co that.

    Xem chu thich o NGUONG_CUU. Tra ve (y_dinh, co_cuu_hay_khong).
    """
    for ung_vien in dd.get("top") or []:
        doan = ung_vien.get("y_dinh") or ""
        can = THAM_SO_BAT_BUOC.get(doan)
        if not can or ung_vien.get("tin_cay", 0) < NGUONG_CUU:
            continue
        gia_tri = tt.trich_xuat(cau, doan).get(can)
        if isinstance(gia_tri, dict) and _co_nguyen_van(cau, gia_tri.get("name_mon")):
            return doan, True
    return "khong_hieu", False


def hoi(cau: str, boi_canh: dict | None = None) -> dict:
    """Xu ly mot luot hoi. Luon tra ve dict, khong bao gio nem loi ra ngoai."""
    bat_dau = time.perf_counter()
    boi_canh = dict(boi_canh or {})
    boi_canh.setdefault("quyen", "khach")

    cau = (cau or "").strip()
    if not cau:
        return {"van_ban": "Bạn nhắn câu hỏi giúp mình nhé!",
                "goi_y": tl._goi_y(boi_canh), "y_dinh": "khong_hieu"}

    # --- [2] Phan loai y dinh ---
    dd = pl.du_doan(cau)
    y_dinh_ma = dd["y_dinh"]
    cuu_bang_thuc_the = False
    if y_dinh_ma == "khong_hieu":
        y_dinh_ma, cuu_bang_thuc_the = _cuu_bang_thuc_the(cau, dd)

    # --- Ngu canh: dang cho mot tham so tu luot truoc ---
    y_dinh_cho = boi_canh.get("y_dinh_cho")
    cho_tham_so = boi_canh.get("cho_tham_so")
    dung_ngu_canh = False
    if y_dinh_cho and cho_tham_so and y_dinh_cho in yd.Y_DINH:
        # Chi ghep khi luot nay khong ro rang la mot y dinh MOI. Neu nguoi dung
        # doi chu de han thi phai ton trong y dinh moi.
        tham_so_thu = tt.trich_xuat(cau, y_dinh_cho)
        if cho_tham_so in tham_so_thu and dd["tin_cay"] < 0.75:
            y_dinh_ma = y_dinh_cho
            dung_ngu_canh = True

    # --- [3] Trich xuat thuc the ---
    tham_so = tt.trich_xuat(cau, y_dinh_ma if y_dinh_ma != "khong_hieu" else "")

    # --- [4] Truy van ---
    if y_dinh_ma == "khong_hieu":
        ket_qua: dict = {}
    else:
        ket_qua = tv.chay(y_dinh_ma, tham_so, boi_canh)

    # --- [5] Sinh cau tra loi ---
    dap = tl.sinh(y_dinh_ma, ket_qua, tham_so, boi_canh, du_doan=dd)

    # Con thieu tham so bat buoc -> ghi nho de luot sau ghep vao.
    can = THAM_SO_BAT_BUOC.get(y_dinh_ma)
    if can and can not in tham_so:
        dap["cho_tham_so"] = can
        dap["y_dinh_cho"] = y_dinh_ma

    ms = (time.perf_counter() - bat_dau) * 1000
    dap.update({
        "y_dinh": y_dinh_ma,
        "y_dinh_mo_ta": yd.Y_DINH.get(y_dinh_ma, {}).get("mo_ta", ""),
        "tin_cay": round(dd["tin_cay"], 4),
        "top": dd["top"],
        "dung_ngu_canh": dung_ngu_canh,
        "cuu_bang_thuc_the": cuu_bang_thuc_the,
        "thoi_gian_ms": round(ms, 1),
        "tham_so": {k: v for k, v in tham_so.items() if k != "top_n"},
    })

    dap["id_nhat_ky"] = _ghi_nhat_ky({
        "cau": cau[:500],
        "yd": y_dinh_ma,
        "tc": float(dd["tin_cay"]),
        "q": boi_canh.get("quyen"),
        "kh": boi_canh.get("id_kh"),
        "nv": boi_canh.get("id_nv"),
        "ms": int(ms),
        "kh_hieu": 1 if y_dinh_ma == "khong_hieu" else 0,
        "ts": str(dap["tham_so"])[:500],
    })
    return dap


def trang_thai() -> dict:
    """Thong tin de hien tren trang quan tri / kiem tra suc khoe.

    CO Y KHONG goi `nap_mo_hinh()`: neu chua co tep mo hinh, ham do se HUAN
    LUYEN ngay tai cho va treo request kiem tra suc khoe hang chuc giay. O day
    chi doc tep da co - chua co thi bao ro de nguoi dung chay train_chatbot.bat.
    """
    co_tep = pl.TEP_MO_HINH.exists()
    thong_tin: dict = {}
    san_sang = False

    if co_tep:
        try:
            thong_tin = pl.nap_mo_hinh().get("thong_tin", {})
            san_sang = True
        except Exception as loi:
            thong_tin = {"loi": str(loi)[:200]}
    else:
        thong_tin = {"loi": "Chua co tep mo hinh. Chay: python -m ml_service.chatbot.train"}

    return {
        "san_sang": san_sang,
        "mo_hinh": thong_tin,
        "nguong_tin_cay": pl.nguong_hieu_luc(),
        "bo_du_lieu": yd.thong_ke_bo_du_lieu(),
        "co_tep_mo_hinh": co_tep,
    }


def cau_hoi_mau(quyen: str = "khach") -> list[str]:
    return tl.goi_y_theo_quyen(quyen)

"""FastAPI service cho phan AI/ML cua he thong quan ly nha hang.

Chay:  python -m uvicorn ml_service.main:app --host 127.0.0.1 --port 8000
Tai lieu API tu dong:  http://127.0.0.1:8000/docs

Service nay tach rieng khoi ung dung Node vi hai ly do:
  1. He sinh thai hoc may (scikit-learn, XGBoost, pandas) chi co tren Python.
  2. Huan luyen mo hinh ton CPU; tach process de khong lam nghen web server.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from . import apriori as ap
from . import forecast as fc
from .db import doc_sql

# Nhan dien khuon mat can OpenCV. Nap "mem" de neu thieu opencv-python thi ca
# service van chay duoc phan du bao / goi y, chi rieng khuon mat bao loi ro rang.
try:
    from . import khuon_mat as km
    _LOI_KHUON_MAT = None
except Exception as _loi:  # opencv chua cai, hoac tep ONNX hong
    km = None
    _LOI_KHUON_MAT = str(_loi)

app = FastAPI(
    title="Restaurant AI/ML Service",
    description="Du bao nhu cau (Machine Learning) va goi y mon an (Apriori)",
    version="1.0.0",
)


# --------------------------------------------------------------------------
@app.get("/health")
def kiem_tra():
    """Kiem tra service va ket noi CSDL."""
    try:
        df = doc_sql("SELECT COUNT(*) AS n FROM hopdong WHERE id_mon > 0")
        return {
            "trang_thai": "ok",
            "ket_noi_db": True,
            "so_dong_don_hang": int(df["n"].iloc[0]),
            "thoi_diem": datetime.now().isoformat(timespec="seconds"),
        }
    except Exception as loi:
        raise HTTPException(status_code=503, detail=f"Khong ket noi duoc CSDL: {loi}")


# --------------------------------------------------------------------------
# Du bao
# --------------------------------------------------------------------------
@app.post("/du-bao/luot-khach")
def api_du_bao_luot_khach(
    so_ngay: int = Query(14, ge=1, le=60, description="So ngay du bao toi"),
    muc_tieu: str = Query("so_khach", pattern="^(so_khach|so_don|so_mon)$"),
):
    """Huan luyen lai va du bao luot khach / so don cho cac ngay toi."""
    try:
        return fc.du_bao_luot_khach(so_ngay=so_ngay, cot_muc_tieu=muc_tieu)
    except ValueError as loi:
        raise HTTPException(status_code=400, detail=str(loi))


@app.post("/du-bao/nguyen-lieu")
def api_du_bao_nguyen_lieu(
    so_ngay: int = Query(7, ge=1, le=30, description="So ngay du bao toi"),
):
    """Du bao nhu cau tung nguyen lieu va luong can nhap them."""
    try:
        return fc.du_bao_nguyen_lieu(so_ngay=so_ngay)
    except ValueError as loi:
        raise HTTPException(status_code=400, detail=str(loi))


@app.get("/du-bao/danh-gia-mo-hinh")
def api_danh_gia():
    """Bang chi so danh gia cac mo hinh - dung truc tiep cho bao cao."""
    df = doc_sql(
        """SELECT bai_toan, mo_hinh, mae, rmse, mape, r2, so_mau_train, so_mau_test, tao_luc
           FROM danh_gia_mo_hinh ORDER BY bai_toan, mae"""
    )
    return {"so_dong": len(df), "du_lieu": df.to_dict(orient="records")}


# --------------------------------------------------------------------------
# Goi y mon (Apriori)
# --------------------------------------------------------------------------
class YeuCauGoiY(BaseModel):
    id_mon: list[int] = Field(default_factory=list, description="Cac mon dang co trong gio")
    so_luong: int = Field(5, ge=1, le=20)


@app.post("/goi-y/khai-pha")
def api_khai_pha(
    min_support: float = Query(0.02, gt=0, le=1),
    min_confidence: float = Query(0.25, gt=0, le=1),
    min_lift: float = Query(1.05, gt=0),
    max_size: int = Query(3, ge=2, le=4),
):
    """Chay Apriori tren toan bo lich su va luu luat vao CSDL."""
    try:
        return ap.khai_pha_va_luu(min_support, min_confidence, min_lift, max_size)
    except ValueError as loi:
        raise HTTPException(status_code=400, detail=str(loi))


@app.post("/goi-y/mon")
def api_goi_y(yc: YeuCauGoiY):
    """Goi y mon nen goi them, dua tren cac mon dang co trong gio."""
    ds = ap.goi_y(yc.id_mon, yc.so_luong)
    if not ds:
        return {"nguon": "ban_chay", "goi_y": ap.mon_pho_bien(yc.so_luong)}
    return {"nguon": "luat_ket_hop", "goi_y": ds}


@app.get("/goi-y/luat")
def api_xem_luat(gioi_han: int = Query(50, ge=1, le=500)):
    """Xem cac luat ket hop da khai pha (kem ten mon cho de doc)."""
    df = doc_sql(
        """SELECT l.mon_ve_trai, l.mon_ve_phai, m.name_mon AS ten_ve_phai,
                  l.do_ho_tro, l.do_tin_cay, l.do_nang, l.so_giao_dich
           FROM luat_ket_hop l JOIN monan m ON m.id_mon = l.mon_ve_phai
           ORDER BY l.do_nang DESC LIMIT :n""",
        {"n": gioi_han},
    )
    if df.empty:
        return {"so_luat": 0, "luat": []}

    ten = doc_sql("SELECT id_mon, name_mon FROM monan")
    ten_map = dict(zip(ten["id_mon"].astype(int), ten["name_mon"].str.strip()))

    luat = []
    for _, r in df.iterrows():
        trai = [ten_map.get(int(x), x) for x in str(r["mon_ve_trai"]).split(",") if x]
        luat.append(
            {
                "neu_goi": trai,
                "goi_y_them": str(r["ten_ve_phai"]).strip(),
                "ho_tro": round(float(r["do_ho_tro"]), 4),
                "tin_cay": round(float(r["do_tin_cay"]), 4),
                "lift": round(float(r["do_nang"]), 3),
            }
        )
    return {"so_luat": len(luat), "luat": luat}


# --------------------------------------------------------------------------
# Nhan dien khuon mat (cham cong)
# --------------------------------------------------------------------------
def _can_khuon_mat():
    """Chan moi endpoint khuon mat neu OpenCV / mo hinh chua san sang."""
    if km is None:
        raise HTTPException(
            status_code=503,
            detail=f"Chuc nang khuon mat chua san sang: {_LOI_KHUON_MAT}. "
                   "Hay cai opencv-python va tai mo hinh (python -m ml_service.tai_mo_hinh).",
        )


class YeuCauDangKy(BaseModel):
    id_nv: int
    anh: list[str] = Field(default_factory=list, description="Cac anh base64 (data URL hoac chuoi base64)")
    nguoi_dang_ky: str | None = None
    thay_the: bool = Field(False, description="Xoa mau cu truoc khi them mau moi")


class YeuCauChamCong(BaseModel):
    khung: list[str] = Field(default_factory=list, description="Day khung hinh lien tiep tu webcam")
    thu_thach: str = Field("gat_dau", description="Thu thach chong gia mao")
    id_nv: int | None = Field(None, description="Neu co: xac minh 1:1; neu khong: nhan dien 1:N")
    bo_qua_song: bool = Field(False, description="Bo kiem tra anh song (chi dung khi thu nghiem)")


class YeuCauXoa(BaseModel):
    id_nv: int


@app.get("/khuon-mat/trang-thai")
def api_km_trang_thai():
    """Tinh trang mo hinh va so nguoi da dang ky - dung cho banner giao dien."""
    if km is None:
        return {"san_sang": False, "co_mo_hinh": False, "loi": _LOI_KHUON_MAT}
    return km.trang_thai()


@app.post("/khuon-mat/dang-ky")
def api_km_dang_ky(yc: YeuCauDangKy):
    """Trich vector tu cac anh mau va luu vao CSDL."""
    _can_khuon_mat()
    if not yc.anh:
        raise HTTPException(status_code=400, detail="Chua co anh nao de dang ky.")
    try:
        return km.dang_ky(yc.id_nv, yc.anh, nguoi_dang_ky=yc.nguoi_dang_ky, thay_the=yc.thay_the)
    except km.LoiKhuonMat as loi:
        raise HTTPException(status_code=400, detail=str(loi))


@app.post("/khuon-mat/cham-cong")
def api_km_cham_cong(yc: YeuCauChamCong):
    """Diem vao chinh cua cham cong: kiem tra anh song roi nhan dien / xac minh.

    Giu toan bo xu ly anh o phia Python: buoc liveness chon ra khung ro nhat,
    khung do duoc dung lai ngay cho buoc nhan dien - client khong phai gui lai
    anh, va vector khuon mat khong bao gio roi khoi tien trinh nay.
    """
    _can_khuon_mat()
    if len(yc.khung) < 3 and not yc.bo_qua_song:
        raise HTTPException(status_code=400, detail="Can it nhat 3 khung hinh de kiem tra anh song.")

    tham_so = km.doc_tham_so()
    bat_song = int(tham_so.get("khuon_mat_bat_kiem_tra_song", 1)) == 1 and not yc.bo_qua_song

    khung_dung = None
    ket_qua_song = None
    if bat_song:
        try:
            ket_qua_song = km.kiem_tra_song(yc.khung, yc.thu_thach, tham_so)
        except km.LoiKhuonMat as loi:
            raise HTTPException(status_code=400, detail=str(loi))
        if not ket_qua_song["dat"]:
            return {
                "ket_qua": "khong_qua_song",
                "song": {k: v for k, v in ket_qua_song.items() if not k.startswith("_")},
            }
        khung_dung = ket_qua_song["_khung_tot_nhat"]  # numpy - dung lai cho nhan dien
    else:
        # Bo qua liveness: dung khung cuoi cung.
        khung_dung = yc.khung[-1]

    try:
        if yc.id_nv is not None:
            kq = km.xac_minh(yc.id_nv, khung_dung, luu_anh=True)
        else:
            kq = km.nhan_dien(khung_dung, luu_anh=True)
    except km.LoiKhuonMat as loi:
        raise HTTPException(status_code=400, detail=str(loi))

    if ket_qua_song is not None:
        kq["song"] = {k: v for k, v in ket_qua_song.items() if not k.startswith("_")}
    return kq


@app.post("/khuon-mat/xac-minh")
def api_km_xac_minh(yc: YeuCauChamCong):
    """Xac minh 1:1 mot khung anh (khong bat buoc liveness) - dung de thu nhanh."""
    _can_khuon_mat()
    if not yc.khung:
        raise HTTPException(status_code=400, detail="Chua co anh.")
    if yc.id_nv is None:
        raise HTTPException(status_code=400, detail="Thieu id_nv de xac minh 1:1.")
    try:
        return km.xac_minh(yc.id_nv, yc.khung[-1], luu_anh=True)
    except km.LoiKhuonMat as loi:
        raise HTTPException(status_code=400, detail=str(loi))


@app.post("/khuon-mat/xoa")
def api_km_xoa(yc: YeuCauXoa):
    """Go toan bo mau khuon mat cua mot nhan vien."""
    _can_khuon_mat()
    return km.xoa_khuon_mat(yc.id_nv)


@app.get("/khuon-mat/danh-gia")
def api_km_danh_gia_doc():
    """Doc ket qua danh gia da luu (khong chay lai)."""
    df = doc_sql(
        """SELECT bai_toan, mo_hinh, do_chinh_xac, do_chuan_xac, do_bao_phu,
                  diem_f1, nguong_toi_uu, ghi_chu, tao_luc
           FROM danh_gia_mo_hinh WHERE bai_toan = 'nhan_dien_khuon_mat'
           ORDER BY tao_luc DESC"""
    )
    return {"so_dong": len(df), "du_lieu": df.to_dict(orient="records")}


@app.post("/khuon-mat/danh-gia")
def api_km_danh_gia_chay():
    """Chay lai danh gia SFace vs LBPH tren du lieu hien co va luu ket qua."""
    _can_khuon_mat()
    try:
        return km.danh_gia(luu_db=True)
    except km.LoiKhuonMat as loi:
        raise HTTPException(status_code=400, detail=str(loi))


# --------------------------------------------------------------------------
# Chatbot hoi dap tieng Viet
#
# Nap "mem" giong module khuon mat: neu thieu joblib / mo hinh hong thi ca
# service van chay binh thuong, chi rieng nhom endpoint nay bao loi ro rang.
# --------------------------------------------------------------------------
try:
    from .chatbot import bot as cb
    _LOI_CHATBOT = None
except Exception as _loi_cb:
    cb = None
    _LOI_CHATBOT = str(_loi_cb)


def _can_chatbot():
    if cb is None:
        raise HTTPException(
            status_code=503,
            detail=f"Chatbot chua san sang: {_LOI_CHATBOT}",
        )


class YeuCauHoi(BaseModel):
    cau_hoi: str = Field(..., min_length=1, max_length=500)
    quyen: str = Field("khach", pattern="^(khach|quan_ly)$",
                       description="Do tang Node quyet dinh tu PHIEN dang nhap, "
                                   "khong bao gio lay tu phia trinh duyet")
    id_kh: int | None = None
    id_nv: int | None = None
    y_dinh_cho: str | None = Field(None, description="Y dinh dang cho tham so tu luot truoc")
    cho_tham_so: str | None = Field(None, description="Ten tham so dang cho")


@app.get("/chatbot/trang-thai")
def api_cb_trang_thai():
    """Tinh trang mo hinh + thong ke bo du lieu (cho trang quan tri)."""
    if cb is None:
        return {"san_sang": False, "loi": _LOI_CHATBOT}
    return cb.trang_thai()


@app.post("/chatbot/hoi")
def api_cb_hoi(yc: YeuCauHoi):
    """Xu ly mot luot hoi dap."""
    _can_chatbot()
    return cb.hoi(yc.cau_hoi, {
        "quyen": yc.quyen,
        "id_kh": yc.id_kh,
        "id_nv": yc.id_nv,
        "y_dinh_cho": yc.y_dinh_cho,
        "cho_tham_so": yc.cho_tham_so,
    })


@app.get("/chatbot/cau-hoi-mau")
def api_cb_cau_hoi_mau(quyen: str = Query("khach", pattern="^(khach|quan_ly)$")):
    _can_chatbot()
    return {"cau_hoi": cb.cau_hoi_mau(quyen)}


@app.post("/chatbot/huan-luyen")
def api_cb_huan_luyen():
    """Huan luyen lai bo phan loai y dinh va tra ve bang so sanh mo hinh.

    Mat vai giay den vai chuc giay tuy may. Trang quan tri goi endpoint nay khi
    nguoi dung bam nut "Huan luyen lai".
    """
    _can_chatbot()
    from .chatbot import phan_loai as pl

    kq = pl.huan_luyen_va_danh_gia()
    pl.luu_mo_hinh(kq["mo_hinh_tot"], {
        "ten_mo_hinh": kq["ten_tot"],
        "f1_macro_tay": kq["ket_qua"][0].f1_macro_tay,
        "do_chinh_xac_tay": kq["ket_qua"][0].do_chinh_xac_tay,
    })
    pl.nap_mo_hinh(bat_buoc_nap_lai=True)
    return {
        "ten_mo_hinh_chon": kq["ten_tot"],
        "so_cau_train": kq["so_cau_train"],
        "so_cau_test": kq["so_cau_test"],
        "thong_ke": kq["thong_ke"],
        "ket_qua": [
            {
                "mo_hinh": k.ten,
                "do_chinh_xac": round(k.do_chinh_xac * 100, 2),
                "f1_macro": round(k.f1_macro * 100, 2),
                "do_chinh_xac_tay": round(k.do_chinh_xac_tay * 100, 2),
                "f1_macro_tay": round(k.f1_macro_tay * 100, 2),
                "giay_huan_luyen": round(k.giay_huan_luyen, 2),
                "ms_moi_cau": round(k.mili_giay_moi_cau, 2),
                "nham_lan": k.nham_lan,
            }
            for k in kq["ket_qua"]
        ],
        "nguong": pl.quet_nguong(kq["mo_hinh_tot"]),
    }

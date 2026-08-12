"""Nhan dien khuon mat phuc vu cham cong.

KIEN TRUC
---------
Bai toan gom ba buoc doc lap, moi buoc mot mo hinh rieng:

  1. PHAT HIEN  - YuNet (mang CNN nhe, 232 KB, chay ~5 ms/khung tren CPU).
     Tra ve khung mat kem 5 diem moc: 2 mat, mui, 2 khoe mieng.

  2. TRICH DAC TRUNG - SFace (ArcFace thu gon, 12 MB). Sau khi can chinh mat
     theo 5 diem moc, mang cho ra vector 128 chieu da chuan hoa L2. Hai anh cua
     cung mot nguoi cho hai vector gan nhau theo do do cosine.

  3. SO KHOP - cosine similarity + hai dieu kien chap nhan (xem `_xep_hang`).

Vi sao khong dung mang phan lop (softmax) tren tap nhan vien?
  Nha hang thay nhan vien lien tuc. Mang phan lop phai huan luyen lai moi lan
  them nguoi. Cach nhung vector (embedding) chi can them vai dong vao CSDL, va
  van nhan dien duoc nguoi moi ma khong dung den GPU.

BAO MAT DU LIEU SINH TRAC HOC
  CSDL chi luu VECTOR 128 chieu, khong luu anh goc. Tu vector khong dung nguoc
  lai duoc khuon mat. Anh da cat chi giu tren dia (thu muc `du_lieu_khuon_mat`,
  nam ngoai thu muc tinh cua web) de con huan luyen lai duoc mo hinh doi chung.

CHONG GIA MAO
  Xem `kiem_tra_song`. Nguyen ly: dau la vat the KHONG PHANG, anh in va man hinh
  dien thoai thi phang. Tinh chat nay do duoc bang hinh hoc tu 5 diem moc.
"""
from __future__ import annotations

import base64
import binascii
import json
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from .db import GOC_DU_AN, chay_sql, doc_sql

# --------------------------------------------------------------------------
# Duong dan
# --------------------------------------------------------------------------
THU_MUC_MO_HINH = Path(__file__).resolve().parent / "mo_hinh_khuon_mat"
TEP_YUNET = THU_MUC_MO_HINH / "face_detection_yunet_2023mar.onnx"
TEP_SFACE = THU_MUC_MO_HINH / "face_recognition_sface_2021dec.onnx"

# Nam ngoai thu muc tinh cua Express -> khong the truy cap truc tiep qua URL.
THU_MUC_DU_LIEU = GOC_DU_AN / "du_lieu_khuon_mat"
THU_MUC_MAU = THU_MUC_DU_LIEU / "mau"          # anh mau dang ky, chia theo id_nv
THU_MUC_NHAT_KY = THU_MUC_DU_LIEU / "nhat_ky"  # anh bang chung moi lan cham cong

KICH_THUOC_CAN_CHINH = (112, 112)  # dau vao chuan cua SFace

# Gia tri mac dinh khi bang cau_hinh chua co (hoac CSDL loi).
#
# NGUONG TINH BANG PHAN TRAM
#   Truoc day nguong duoc khai bao thang bang cosine (0.363) - con so dung ve mat
#   ky thuat nhung khong ai ngoai nguoi viet ma hieu no nghia la gi, nen khong ai
#   dam sua khi may bao "khong khop". Nay nguong la PHAN TRAM DO KHOP, dung ngay
#   con so ma nguoi dung nhin thay tren man hinh: dat 50 nghia la "giong tu 50%
#   tro len thi cho vao". Quy doi: phan_tram = cosine * 100.
#
#   Khoa cu `khuon_mat_nguong_cosine` van duoc doc de khong pha cau hinh dang co
#   (xem `nguong_cosine`), nhung khoa moi uu tien hon.
MAC_DINH = {
    "khuon_mat_nguong_phan_tram": 50.0,
    "khuon_mat_bien_an_toan": 0.05,
    "khuon_mat_so_anh_toi_thieu": 5,
    "khuon_mat_bat_kiem_tra_song": 1,
    "khuon_mat_nguong_do_net": 45.0,
    "khuon_mat_nguong_diem_song": 0.55,
    "khuon_mat_nhat_quan_toi_thieu": 0.30,
    # Bien do cua ba thu thach chong gia mao. Tach ra cau hinh vi bien do do duoc
    # phu thuoc vao GOC MO va KHOANG CACH cua tung webcam: cung mot cai gat dau,
    # camera goc rong dat o xa cho bien do nho hon han camera dat gan. Hang so
    # co dinh trong ma nguon khien mot so may khong bao gio qua duoc thu thach,
    # ma nguoi dung thi khong co cach nao biet phai chinh o dau.
    "khuon_mat_bien_do_quay": 0.06,
    "khuon_mat_bien_do_gat": 0.05,
    "khuon_mat_ty_le_lai_gan": 1.12,
    # Chan "cham ho" o che do 1:1 - xem chu thich trong `xac_minh`.
    "khuon_mat_chan_cham_ho": 0,
    "khuon_mat_bien_cham_ho": 0.10,
}


def nguong_cosine(tham_so: dict) -> float:
    """Nguong chap nhan, quy ve cosine.

    Uu tien khoa phan tram; con khoa cosine cu chi dung khi ban ghi phan tram
    chua co - de cau hinh cu tren may dang chay khong bi doi y nghia sau khi
    cap nhat ma nguon.
    """
    pt = tham_so.get("khuon_mat_nguong_phan_tram")
    if pt is not None:
        try:
            return max(0.0, min(1.0, float(pt) / 100.0))
        except (TypeError, ValueError):
            pass
    try:
        return float(tham_so.get("khuon_mat_nguong_cosine", 0.50))
    except (TypeError, ValueError):
        return 0.50


def sang_phan_tram(diem: float | None) -> float | None:
    """Doi cosine thanh phan tram do khop de hien thi (cat ve doan 0..100)."""
    if diem is None:
        return None
    return round(max(0.0, min(1.0, float(diem))) * 100.0, 1)


# --------------------------------------------------------------------------
# Nap mo hinh (mot lan, dung chung cho moi request)
# --------------------------------------------------------------------------
_bo_phat_hien: "cv2.FaceDetectorYN | None" = None
_bo_trich: "cv2.FaceRecognizerSF | None" = None


class LoiKhuonMat(Exception):
    """Loi nghiep vu - tang API se doi thanh HTTP 400 thay vi 500."""


def _kiem_tra_tep_mo_hinh() -> None:
    thieu = [t.name for t in (TEP_YUNET, TEP_SFACE) if not t.exists()]
    if thieu:
        raise LoiKhuonMat(
            f"Thieu tep mo hinh {', '.join(thieu)} trong {THU_MUC_MO_HINH}. "
            "Chay: python -m ml_service.tai_mo_hinh"
        )


def lay_bo_phat_hien(kich_thuoc: tuple[int, int] = (320, 320)) -> "cv2.FaceDetectorYN":
    """YuNet. `kich_thuoc` duoc dat lai theo tung anh truoc khi goi detect()."""
    global _bo_phat_hien
    if _bo_phat_hien is None:
        _kiem_tra_tep_mo_hinh()
        _bo_phat_hien = cv2.FaceDetectorYN.create(
            model=str(TEP_YUNET),
            config="",
            input_size=kich_thuoc,
            score_threshold=0.75,   # nguong tin cay cua khung mat
            nms_threshold=0.3,
            top_k=50,
        )
    return _bo_phat_hien


def lay_bo_trich() -> "cv2.FaceRecognizerSF":
    global _bo_trich
    if _bo_trich is None:
        _kiem_tra_tep_mo_hinh()
        _bo_trich = cv2.FaceRecognizerSF.create(model=str(TEP_SFACE), config="")
    return _bo_trich


# --------------------------------------------------------------------------
# Tham so he thong
# --------------------------------------------------------------------------
def doc_tham_so() -> dict:
    """Doc tham so tu bang `cau_hinh`. Loi CSDL thi dung gia tri mac dinh."""
    tham_so = dict(MAC_DINH)
    try:
        df = doc_sql(
            "SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'khuon_mat_%'"
        )
        for _, r in df.iterrows():
            khoa = str(r["khoa"])
            try:
                tham_so[khoa] = float(r["gia_tri"])
            except (TypeError, ValueError):
                tham_so[khoa] = r["gia_tri"]
    except Exception:
        pass
    return tham_so


# --------------------------------------------------------------------------
# Tien xu ly anh
# --------------------------------------------------------------------------
def giai_ma_anh(chuoi: str) -> np.ndarray:
    """Doi chuoi base64 (co hoac khong co tien to data:) thanh anh BGR."""
    if not chuoi:
        raise LoiKhuonMat("Anh rong.")
    if "," in chuoi[:64] and chuoi.lstrip().startswith("data:"):
        chuoi = chuoi.split(",", 1)[1]
    try:
        thô = base64.b64decode(chuoi, validate=False)
    except (binascii.Error, ValueError) as loi:
        raise LoiKhuonMat(f"Chuoi base64 khong hop le: {loi}")

    anh = cv2.imdecode(np.frombuffer(thô, np.uint8), cv2.IMREAD_COLOR)
    if anh is None:
        raise LoiKhuonMat("Khong giai ma duoc anh (dinh dang khong ho tro).")
    return anh


def do_net(anh: np.ndarray) -> float:
    """Phuong sai Laplacian - anh cang net gia tri cang lon.

    Dung de loai anh mo do rung tay hoac do chup lai anh in kem chat luong.
    """
    xam = cv2.cvtColor(anh, cv2.COLOR_BGR2GRAY) if anh.ndim == 3 else anh
    return float(cv2.Laplacian(xam, cv2.CV_64F).var())


@dataclass
class KhuonMat:
    """Mot khuon mat da phat hien trong anh."""

    hop: tuple[int, int, int, int]   # x, y, rong, cao
    diem_moc: np.ndarray             # (5, 2): mat phai, mat trai, mui, 2 khoe mieng
    diem_tin_cay: float
    hang_tho: np.ndarray             # nguyen ban 15 so - SFace can de can chinh

    @property
    def dien_tich(self) -> int:
        return int(self.hop[2] * self.hop[3])


def phat_hien(anh: np.ndarray) -> list[KhuonMat]:
    """Phat hien moi khuon mat, sap xep giam dan theo dien tich.

    Sap theo dien tich vi o che do kiosk nguoi dang cham cong la nguoi dung
    gan camera nhat, cac khuon mat phia sau chi la khach di ngang qua.
    """
    cao, rong = anh.shape[:2]
    bo = lay_bo_phat_hien()
    bo.setInputSize((rong, cao))
    _, kq = bo.detect(anh)
    if kq is None:
        return []

    ds: list[KhuonMat] = []
    for hang in kq:
        x, y, w, h = (int(v) for v in hang[:4])
        moc = np.array(hang[4:14], dtype=np.float32).reshape(5, 2)
        ds.append(KhuonMat((x, y, w, h), moc, float(hang[14]), hang))
    ds.sort(key=lambda m: m.dien_tich, reverse=True)
    return ds


def trich_dac_trung(anh: np.ndarray, mat: KhuonMat) -> np.ndarray:
    """Can chinh theo 5 diem moc roi tra ve vector 128 chieu chuan hoa L2.

    Buoc can chinh (alignCrop) quan trong hon ta tuong: no xoay va co gian anh
    sao cho hai mat luon nam dung mot vi tri co dinh. Nho vay mo hinh khong phai
    hoc cach bo qua goc nghieng dau, va hai anh cung nguoi o hai tu the khac
    nhau van cho vector gan nhau.
    """
    bo = lay_bo_trich()
    da_can = bo.alignCrop(anh, mat.hang_tho)
    vector = bo.feature(da_can)
    v = np.asarray(vector, dtype=np.float32).flatten()
    chuan = np.linalg.norm(v)
    return v / chuan if chuan > 0 else v


def cat_mat(anh: np.ndarray, mat: KhuonMat) -> np.ndarray:
    """Anh mat da can chinh 112x112 - dung de luu lam mau."""
    return lay_bo_trich().alignCrop(anh, mat.hang_tho)


def _tuong_dong(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity. Vector da chuan hoa nen chi con tich vo huong."""
    return float(np.dot(a, b))


# --------------------------------------------------------------------------
# Thu vien khuon mat da dang ky (cache trong bo nho)
# --------------------------------------------------------------------------
_cache: dict = {"khoa": None, "id_nv": None, "ma_tran": None, "ten": {}}


def _khoa_phien_ban() -> tuple:
    """Khoa cache: so ban ghi + id lon nhat. Doi la biet co nguoi dang ky moi."""
    df = doc_sql(
        "SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM khuon_mat_nv WHERE dang_dung = 1"
    )
    return int(df["n"].iloc[0]), int(df["m"].iloc[0])


def tai_thu_vien(bat_buoc: bool = False) -> tuple[np.ndarray, np.ndarray, dict]:
    """Nap toan bo vector da dang ky thanh mot ma tran (so_mau, 128).

    Gom thanh MA TRAN de so khop bang mot phep nhan ma tran duy nhat thay vi
    lap qua tung nguoi: voi vai tram mau thi thoi gian so khop khong dang ke.
    """
    khoa = _khoa_phien_ban()
    if not bat_buoc and _cache["khoa"] == khoa and _cache["ma_tran"] is not None:
        return _cache["ma_tran"], _cache["id_nv"], _cache["ten"]

    df = doc_sql(
        """SELECT k.id_nv, k.vector_dac_trung, n.ten
           FROM khuon_mat_nv k JOIN nhan_vien n ON n.id_nv = k.id_nv
           WHERE k.dang_dung = 1"""
    )
    if df.empty:
        _cache.update({"khoa": khoa, "ma_tran": np.zeros((0, 128), np.float32),
                       "id_nv": np.zeros(0, np.int64), "ten": {}})
        return _cache["ma_tran"], _cache["id_nv"], _cache["ten"]

    vectors, ids = [], []
    for _, r in df.iterrows():
        try:
            v = np.asarray(json.loads(r["vector_dac_trung"]), dtype=np.float32)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if v.size == 0:
            continue
        n = np.linalg.norm(v)
        vectors.append(v / n if n > 0 else v)
        ids.append(int(r["id_nv"]))

    ma_tran = np.vstack(vectors) if vectors else np.zeros((0, 128), np.float32)
    ten = {int(r["id_nv"]): str(r["ten"]).strip() for _, r in df.iterrows()}
    _cache.update({"khoa": khoa, "ma_tran": ma_tran,
                   "id_nv": np.asarray(ids, dtype=np.int64), "ten": ten})
    return ma_tran, _cache["id_nv"], ten


def _xep_hang(vector: np.ndarray, tham_so: dict) -> dict:
    """So khop 1:N va quyet dinh chap nhan hay tu choi.

    HAI dieu kien phai cung dat:
      (1) do tuong dong cao nhat >= nguong tuyet doi,
      (2) cach nguoi hang hai it nhat `bien_an_toan`.

    Dieu kien (2) moi la cai chong nhan nham. Hai anh em ruot co the cung vuot
    nguong (1); khi do khoang cach giua hang nhat va hang nhi rat nho, he thong
    tra ve "khong chac chan" va yeu cau cham cong thu cong - an toan hon la doan
    bua roi ghi nham cong cho nguoi khac.
    """
    ma_tran, ids, ten = tai_thu_vien()
    if ma_tran.shape[0] == 0:
        return {"ket_qua": "chua_dang_ky", "id_nv": None, "do_tuong_dong": None}

    diem = ma_tran @ vector  # (so_mau,) cosine voi tung anh mau

    # Moi nguoi lay diem cua anh mau khop nhat.
    diem_nguoi: dict[int, float] = {}
    for i, idnv in enumerate(ids):
        d = float(diem[i])
        k = int(idnv)
        if d > diem_nguoi.get(k, -1.0):
            diem_nguoi[k] = d

    xep = sorted(diem_nguoi.items(), key=lambda x: x[1], reverse=True)
    nhat_id, nhat_diem = xep[0]
    nhi_diem = xep[1][1] if len(xep) > 1 else None

    nguong = nguong_cosine(tham_so)
    bien = float(tham_so["khuon_mat_bien_an_toan"])
    cach_biet = nhat_diem - nhi_diem if nhi_diem is not None else 1.0

    if nhat_diem < nguong:
        ket_qua = "khong_khop"
    elif cach_biet < bien:
        ket_qua = "khong_chac_chan"
    else:
        ket_qua = "thanh_cong"

    return {
        "ket_qua": ket_qua,
        "id_nv": int(nhat_id) if ket_qua == "thanh_cong" else None,
        "ten": ten.get(int(nhat_id)) if ket_qua == "thanh_cong" else None,
        "id_nv_gan_nhat": int(nhat_id),
        "ten_gan_nhat": ten.get(int(nhat_id)),
        "do_tuong_dong": round(float(nhat_diem), 4),
        "do_tuong_dong_nhi": round(float(nhi_diem), 4) if nhi_diem is not None else None,
        "cach_biet": round(float(cach_biet), 4),
        "nguong_ap_dung": nguong,
        # Hai con so duoi day la thu MAN HINH hien ra. Tinh o day chu khong tinh
        # lai o tang Node/trinh duyet de moi noi cung noi mot con so.
        "phan_tram": sang_phan_tram(nhat_diem),
        "nguong_phan_tram": sang_phan_tram(nguong),
    }


# --------------------------------------------------------------------------
# Kiem tra anh song (chong gia mao)
# --------------------------------------------------------------------------
# Cac thu thach ngau nhien. Khoa -> (mo ta hien thi, ham kiem tra).
THU_THACH = {
    "quay_trai": "Quay mat sang TRAI",
    "quay_phai": "Quay mat sang PHAI",
    "lai_gan": "Dua mat LAI GAN camera",
    "gat_dau": "GAT DAU nhe mot cai",
}


def _goc_tu_diem_moc(mat: KhuonMat) -> tuple[float, float]:
    """Uoc luong goc quay (yaw) va goc ngua (pitch) tu 5 diem moc.

    Y TUONG - day la cho chong gia mao thuc su nam:
      Goi hai mat la M1, M2 va mui la N. Ta chieu vector (N - trung diem mat)
      len TRUC NOI HAI MAT roi chia cho khoang cach hai mat.

      Ty so nay BAT BIEN voi moi phep bien doi affine cua mot vat the PHANG:
      xoay anh, phong to, keo nghieng anh in ra deu khong lam no doi. Nhung
      dau nguoi thi mui NHO RA khoi mat phang hai mat - khi quay dau, mui dich
      chuyen theo chieu sau nen ty so doi ro ret.

      => Anh in / man hinh dien thoai co lam gi cung giu ty so gan nhu khong doi,
         con nguoi that quay dau thi ty so thay doi manh.
    """
    mat_phai, mat_trai, mui = mat.diem_moc[0], mat.diem_moc[1], mat.diem_moc[2]
    truc = mat_trai - mat_phai
    khoang_cach = float(np.linalg.norm(truc))
    if khoang_cach < 1e-6:
        return 0.0, 0.0

    u = truc / khoang_cach                  # vector don vi doc truc hai mat
    v = np.array([-u[1], u[0]], np.float32)  # vuong goc voi u (huong xuong duoi)
    lech = mui - (mat_phai + mat_trai) / 2.0
    return float(np.dot(lech, u) / khoang_cach), float(np.dot(lech, v) / khoang_cach)


def _diem_ket_cau(anh_mat: np.ndarray) -> float:
    """Diem ket cau 0..1 - phat hien anh chup lai tu man hinh.

    Man hinh dien thoai co luoi diem anh tuan hoan; khi chup lai, luoi do tao ra
    cac DINH NANG LUONG roi rac o vung tan so trung-cao trong pho Fourier, khac
    han pho tran deu cua da nguoi that. Ta do ty le giua dinh cao nhat va nang
    luong trung binh cua vung do.

    Day chi la HEURISTIC, khong phai mo hinh chong gia mao duoc huan luyen. No
    bat duoc man hinh o dieu kien thuong nhung khong thay the duoc cam bien
    chieu sau. Da ghi ro han che nay trong tai lieu.
    """
    xam = cv2.cvtColor(anh_mat, cv2.COLOR_BGR2GRAY) if anh_mat.ndim == 3 else anh_mat
    xam = cv2.resize(xam, (128, 128)).astype(np.float32)
    xam = xam - xam.mean()
    xam *= np.hanning(128)[:, None] * np.hanning(128)[None, :]  # giam ro ri pho

    pho = np.abs(np.fft.fftshift(np.fft.fft2(xam)))
    tam = 64
    yy, xx = np.mgrid[0:128, 0:128]
    ban_kinh = np.sqrt((yy - tam) ** 2 + (xx - tam) ** 2)

    vung = (ban_kinh > 20) & (ban_kinh < 55)  # tan so trung-cao
    gia_tri = pho[vung]
    if gia_tri.size == 0 or gia_tri.mean() <= 0:
        return 0.5

    ty_le_dinh = float(gia_tri.max() / gia_tri.mean())
    # ty_le ~ 8-15 voi da that; > 25 thuong la co luoi diem anh.
    return float(np.clip((30.0 - ty_le_dinh) / 20.0, 0.0, 1.0))


def kiem_tra_song(danh_sach_anh: list[str], thu_thach: str,
                  tham_so: dict | None = None) -> dict:
    """Kiem tra day khung hinh co phai nguoi that dang thao tac hay khong.

    Bon dau hieu duoc gop lai:
      1. Thu thach hinh hoc (bat buoc dat)  - xem `_goc_tu_diem_moc`
      2. Do net cua khung ro nhat           - loai anh in mo
      3. Ket cau tan so                     - loai man hinh dien thoai
      4. Nhat quan danh tinh giua cac khung - chong doi nguoi giua chung
    """
    tham_so = tham_so or doc_tham_so()
    if thu_thach not in THU_THACH:
        raise LoiKhuonMat(f"Thu thach khong hop le: {thu_thach}")
    if len(danh_sach_anh) < 3:
        raise LoiKhuonMat("Can it nhat 3 khung hinh de kiem tra anh song.")

    khung: list[dict] = []
    for chuoi in danh_sach_anh:
        anh = giai_ma_anh(chuoi)
        ds_mat = phat_hien(anh)
        if not ds_mat:
            continue
        mat = ds_mat[0]
        yaw, pitch = _goc_tu_diem_moc(mat)
        khung.append({
            "anh": anh, "mat": mat, "yaw": yaw, "pitch": pitch,
            "dien_tich": mat.dien_tich, "do_net": do_net(cat_mat(anh, mat)),
            "vector": trich_dac_trung(anh, mat),
        })

    if len(khung) < 3:
        return {"dat": False, "diem_song": 0.0, "ma_ly_do": "khong_du_khung",
                "ly_do": f"Chi thay ro mat trong {len(khung)}/{len(danh_sach_anh)} khung hinh.",
                "so_khung_co_mat": len(khung)}

    yaw = np.array([k["yaw"] for k in khung])
    pitch = np.array([k["pitch"] for k in khung])
    dien_tich = np.array([k["dien_tich"] for k in khung], dtype=np.float64)

    # --- 1. Thu thach hinh hoc ---
    #
    # Bien do lay tu cau hinh chu khong con la hang so trong ma nguon: cung mot
    # cai gat dau, webcam goc rong dat cach mot sai tay cho bien do chi bang mot
    # nua webcam dat gan. Muc mac dinh (quay 0.06 / gat 0.05 / lai gan 1.12) do
    # tren chinh nhat ky he thong - dong tac binh thuong cua nguoi that vuot qua
    # duoc, con anh in va man hinh dien thoai thi khong sinh ra duoc do lech nay
    # vi chung PHANG (xem `_goc_tu_diem_moc`).
    bd_quay = float(tham_so.get("khuon_mat_bien_do_quay", 0.06) or 0.06)
    bd_gat = float(tham_so.get("khuon_mat_bien_do_gat", 0.05) or 0.05)
    tl_gan = float(tham_so.get("khuon_mat_ty_le_lai_gan", 1.12) or 1.12)

    if thu_thach in ("quay_trai", "quay_phai"):
        # Mui dich theo truc noi hai mat khi dau quay.
        do_lech = float(yaw.max() - yaw.min())
        dat_thu_thach = do_lech >= bd_quay
        chi_so = do_lech
        mo_ta_do = f"bien do quay {do_lech:.3f} (can >= {bd_quay:.3f})"
    elif thu_thach == "gat_dau":
        do_lech = float(pitch.max() - pitch.min())
        dat_thu_thach = do_lech >= bd_gat
        chi_so = do_lech
        mo_ta_do = f"bien do gat {do_lech:.3f} (can >= {bd_gat:.3f})"
    else:  # lai_gan
        ty_le = float(dien_tich.max() / max(dien_tich.min(), 1.0))
        dat_thu_thach = ty_le >= tl_gan
        chi_so = ty_le
        mo_ta_do = f"ty le phong to {ty_le:.2f} (can >= {tl_gan:.2f})"

    # --- 2. Do net ---
    net_tot_nhat = float(max(k["do_net"] for k in khung))
    nguong_net = float(tham_so["khuon_mat_nguong_do_net"])
    diem_net = float(np.clip(net_tot_nhat / (nguong_net * 2.0), 0.0, 1.0))

    # --- 3. Ket cau ---
    khung_net = max(khung, key=lambda k: k["do_net"])
    diem_ket_cau = _diem_ket_cau(cat_mat(khung_net["anh"], khung_net["mat"]))

    # --- 4. Nhat quan danh tinh ---
    goc = khung[0]["vector"]
    tuong_dong = [_tuong_dong(goc, k["vector"]) for k in khung[1:]]
    nhat_quan_thap = float(min(tuong_dong)) if tuong_dong else 1.0
    nq_toi_thieu = float(tham_so.get("khuon_mat_nhat_quan_toi_thieu", 0.30) or 0.30)
    dat_nhat_quan = nhat_quan_thap >= nq_toi_thieu
    diem_nhat_quan = float(np.clip((nhat_quan_thap - 0.15) / 0.35, 0.0, 1.0))

    diem_song = 0.45 * float(dat_thu_thach) + 0.20 * diem_net \
        + 0.20 * diem_ket_cau + 0.15 * diem_nhat_quan
    nguong_song = float(tham_so["khuon_mat_nguong_diem_song"])
    dat = bool(dat_thu_thach and dat_nhat_quan and diem_song >= nguong_song)

    # `ma_ly_do` la MA MAY DOC DUOC, con `ly_do` la cau cho nguoi doc. Node phai
    # phan biet ba truong hop nay de dan nhan dung trong nhat ky - truoc day no
    # doc nguoc lai tu `ly_do` bang bieu thuc chinh quy, nen "khung hinh khong
    # dong nhat" (thuong chi la anh mo / mat lech khung) bi ghi thanh "gia mao".
    if not dat_thu_thach:
        ma_ly_do = "chua_dat_thu_thach"
        ly_do = f"Chua lam dung dong tac yeu cau ({mo_ta_do})."
    elif not dat_nhat_quan:
        ma_ly_do = "khung_khong_dong_nhat"
        ly_do = ("Khuon mat giua cac khung hinh khong dong nhat "
                 f"(tuong dong thap nhat {nhat_quan_thap:.2f} < {nq_toi_thieu:.2f}).")
    elif diem_song < nguong_song:
        ma_ly_do = "nghi_gia_mao"
        ly_do = ("Nghi ngo anh chup lai tu anh in hoac man hinh "
                 f"(diem {diem_song:.2f} < {nguong_song:.2f}).")
    else:
        ma_ly_do = "dat"
        ly_do = "Dat."

    return {
        "dat": dat,
        "diem_song": round(diem_song, 4),
        "ma_ly_do": ma_ly_do,
        "ly_do": ly_do,
        "thu_thach": thu_thach,
        "mo_ta_thu_thach": THU_THACH[thu_thach],
        "dat_thu_thach": bool(dat_thu_thach),
        "chi_so_thu_thach": round(float(chi_so), 4),
        "diem_do_net": round(diem_net, 4),
        "do_net_tot_nhat": round(net_tot_nhat, 1),
        "diem_ket_cau": round(diem_ket_cau, 4),
        "diem_nhat_quan": round(diem_nhat_quan, 4),
        "so_khung_co_mat": len(khung),
        # Khung ro nhat duoc dung lai cho buoc nhan dien -> khong phai chup lai.
        "_khung_tot_nhat": khung_net,
    }


# --------------------------------------------------------------------------
# Luu anh
# --------------------------------------------------------------------------
def _luu_anh(anh: np.ndarray, thu_muc: Path, ten: str) -> str:
    """Ghi anh JPEG, tra ve duong dan tuong doi so voi goc du an."""
    thu_muc.mkdir(parents=True, exist_ok=True)
    duong_dan = thu_muc / ten
    cv2.imwrite(str(duong_dan), anh, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return str(duong_dan.relative_to(GOC_DU_AN)).replace("\\", "/")


def _dau_thoi_gian() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]


# --------------------------------------------------------------------------
# Dang ky khuon mat
# --------------------------------------------------------------------------
def dang_ky(id_nv: int, danh_sach_anh: list[str], nguoi_dang_ky: str | None = None,
            thay_the: bool = False) -> dict:
    """Trich vector tu cac anh mau va luu vao CSDL.

    Anh nao khong thay mat, thay nhieu mat hoac qua mo deu bi loai kem ly do,
    de nguoi dang ky biet ma chup lai chu khong am tham bo qua.
    """
    tham_so = doc_tham_so()
    df = doc_sql("SELECT ten FROM nhan_vien WHERE id_nv = :id", {"id": int(id_nv)})
    if df.empty:
        raise LoiKhuonMat(f"Khong co nhan vien id_nv = {id_nv}.")
    ten_nv = str(df["ten"].iloc[0]).strip()

    nguong_net = float(tham_so["khuon_mat_nguong_do_net"])
    nhan: list[dict] = []
    loai: list[dict] = []

    for chi_so, chuoi in enumerate(danh_sach_anh, start=1):
        try:
            anh = giai_ma_anh(chuoi)
        except LoiKhuonMat as loi:
            loai.append({"anh_thu": chi_so, "ly_do": str(loi)})
            continue

        ds_mat = phat_hien(anh)
        if not ds_mat:
            loai.append({"anh_thu": chi_so, "ly_do": "Khong tim thay khuon mat."})
            continue
        if len(ds_mat) > 1:
            loai.append({"anh_thu": chi_so, "ly_do": f"Co {len(ds_mat)} khuon mat trong anh."})
            continue

        mat = ds_mat[0]
        if min(mat.hop[2], mat.hop[3]) < 80:
            loai.append({"anh_thu": chi_so, "ly_do": "Khuon mat qua nho, hay lai gan camera."})
            continue

        cat = cat_mat(anh, mat)
        net = do_net(cat)
        if net < nguong_net:
            loai.append({"anh_thu": chi_so,
                         "ly_do": f"Anh mo (do net {net:.0f} < {nguong_net:.0f})."})
            continue

        yaw, _ = _goc_tu_diem_moc(mat)
        goc_nghieng = "trai" if yaw > 0.08 else ("phai" if yaw < -0.08 else "chinh_dien")
        vector = trich_dac_trung(anh, mat)
        duong_dan = _luu_anh(cat, THU_MUC_MAU / str(int(id_nv)),
                             f"{_dau_thoi_gian()}_{chi_so}.jpg")

        nhan.append({
            "vector": vector, "duong_dan": duong_dan, "do_net": net,
            "diem": mat.diem_tin_cay, "goc": goc_nghieng,
        })

    if not nhan:
        raise LoiKhuonMat(
            "Khong anh nao dung duoc. " + "; ".join(f"anh {l['anh_thu']}: {l['ly_do']}" for l in loai)
        )

    # Anh mau cua CHINH nguoi do phai giong nhau. Neu co anh lac loai, nhieu kha
    # nang nguoi dang ky chup nham nguoi khac vao giua chung anh.
    ma_tran = np.vstack([n["vector"] for n in nhan])
    trung_binh = ma_tran.mean(axis=0)
    trung_binh /= max(float(np.linalg.norm(trung_binh)), 1e-9)
    do_gan = ma_tran @ trung_binh
    lac_loai = [i for i, d in enumerate(do_gan) if d < 0.55]
    for i in sorted(lac_loai, reverse=True):
        loai.append({"anh_thu": i + 1,
                     "ly_do": f"Khac han cac anh con lai (do giong {do_gan[i]:.2f})."})
        nhan.pop(i)

    if not nhan:
        raise LoiKhuonMat("Cac anh mau khong dong nhat - hay chup lai cung mot nguoi.")

    if thay_the:
        chay_sql("UPDATE khuon_mat_nv SET dang_dung = 0 WHERE id_nv = :id", {"id": int(id_nv)})

    chay_sql(
        """INSERT INTO khuon_mat_nv
             (id_nv, vector_dac_trung, so_chieu, duong_dan_anh, do_net,
              diem_phat_hien, goc_nghieng, nguoi_dang_ky)
           VALUES (:id, :v, :sc, :dd, :net, :diem, :goc, :nguoi)""",
        [
            {
                "id": int(id_nv),
                "v": json.dumps([round(float(x), 6) for x in n["vector"]]),
                "sc": int(n["vector"].size),
                "dd": n["duong_dan"], "net": float(n["do_net"]),
                "diem": float(n["diem"]), "goc": n["goc"],
                "nguoi": nguoi_dang_ky,
            }
            for n in nhan
        ],
    )
    tai_thu_vien(bat_buoc=True)

    df_tong = doc_sql(
        "SELECT COUNT(*) AS n FROM khuon_mat_nv WHERE id_nv = :id AND dang_dung = 1",
        {"id": int(id_nv)},
    )
    tong = int(df_tong["n"].iloc[0])
    toi_thieu = int(tham_so["khuon_mat_so_anh_toi_thieu"])

    return {
        "id_nv": int(id_nv), "ten": ten_nv,
        "so_anh_nhan": len(nhan), "so_anh_loai": len(loai),
        "chi_tiet_loai": loai,
        "tong_mau_hien_co": tong,
        "du_dieu_kien": tong >= toi_thieu,
        "so_mau_toi_thieu": toi_thieu,
        "goc_da_co": sorted({n["goc"] for n in nhan}),
    }


def xoa_khuon_mat(id_nv: int) -> dict:
    """Go toan bo mau cua mot nhan vien (khi nghi viec hoac dang ky lai)."""
    chay_sql("UPDATE khuon_mat_nv SET dang_dung = 0 WHERE id_nv = :id", {"id": int(id_nv)})
    tai_thu_vien(bat_buoc=True)
    return {"id_nv": int(id_nv), "da_go": True}


# --------------------------------------------------------------------------
# Nhan dien / xac minh
# --------------------------------------------------------------------------
def _chuan_bi_khung(anh_hoac_khung, luu_nhat_ky: bool) -> tuple[np.ndarray, KhuonMat, str | None, int]:
    """Dung chung cho nhan dien va xac minh: lay mat lon nhat + luu anh bang chung."""
    if isinstance(anh_hoac_khung, dict):  # tan dung khung tot nhat tu buoc liveness
        anh, mat = anh_hoac_khung["anh"], anh_hoac_khung["mat"]
        so_mat = 1
    else:
        anh = giai_ma_anh(anh_hoac_khung)
        ds_mat = phat_hien(anh)
        if not ds_mat:
            raise LoiKhuonMat("Khong tim thay khuon mat trong anh.")
        mat, so_mat = ds_mat[0], len(ds_mat)

    duong_dan = None
    if luu_nhat_ky:
        thang = datetime.now().strftime("%Y-%m")
        duong_dan = _luu_anh(cat_mat(anh, mat), THU_MUC_NHAT_KY / thang,
                             f"{_dau_thoi_gian()}.jpg")
    return anh, mat, duong_dan, so_mat


def nhan_dien(anh_base64: str | dict, luu_anh: bool = True) -> dict:
    """Nhan dien 1:N - anh vao, tra ve nhan vien nao (che do kiosk)."""
    bat_dau = time.perf_counter()
    tham_so = doc_tham_so()
    anh, mat, duong_dan, so_mat = _chuan_bi_khung(anh_base64, luu_anh)

    vector = trich_dac_trung(anh, mat)
    kq = _xep_hang(vector, tham_so)
    kq.update({
        "so_mat_phat_hien": so_mat,
        "duong_dan_anh": duong_dan,
        "do_net": round(do_net(cat_mat(anh, mat)), 1),
        "thoi_gian_xu_ly_ms": int((time.perf_counter() - bat_dau) * 1000),
    })
    return kq


def xac_minh(id_nv: int, anh_base64: str | dict, luu_anh: bool = True) -> dict:
    """Xac minh 1:1 - dung la nhan vien nay khong (che do tu cham cong).

    QUY TAC CHINH, VA CHI MOT QUY TAC
      Nguoi nay da dang nhap bang tai khoan va mat khau roi moi vao duoc day.
      Khuon mat o buoc nay chi tra loi mot cau: "co dung nguoi cua tai khoan
      dang mo hay khong". Vi vay dieu kien chap nhan la DUY NHAT:

          do khop voi chinh ho >= nguong (mac dinh 50%)

    VE RANG BUOC "NGHI CHAM HO" (mac dinh TAT)
      Ban dau ham nay con doi chieu voi CA thu vien: neu co nguoi khac giong hon
      chinh chu du chi 0.02 cosine thi tu choi. Y tuong la chan viec nho dong
      nghiep cham ho, nhung no dat nham cho:

        - Nguoi cham ho phai co san tai khoan + mat khau cua nguoi vang mat, ma
          co duoc hai thu do roi thi cham cong thu cong con de hon.
        - Doi lai, no tu choi ca nguoi that bat cu khi nao thu vien co hai ho so
          gan giong nhau - anh em ruot, hoac cung mot nguoi bi dang ky lam nhieu
          ho so. Luc do thu hang giua hai ho so dao qua dao lai theo tung khung
          hinh, va nguoi dung bi tu choi mai ma khong hieu vi sao: man hinh bao
          "khop 69%" nhung van khong vao duoc.

      Nen rang buoc nay nay la TUY CHON (`khuon_mat_chan_cham_ho`, mac dinh 0) va
      bien so sanh cung dua ra cau hinh (`khuon_mat_bien_cham_ho`, mac dinh 0.10
      thay vi 0.02 cung nhac cu). Nha hang nao muon that chat thi bat len; luc do
      phai bao dam moi nhan vien chi co DUNG MOT ho so khuon mat.
    """
    bat_dau = time.perf_counter()
    tham_so = doc_tham_so()
    anh, mat, duong_dan, so_mat = _chuan_bi_khung(anh_base64, luu_anh)
    vector = trich_dac_trung(anh, mat)

    df = doc_sql(
        "SELECT vector_dac_trung FROM khuon_mat_nv WHERE id_nv = :id AND dang_dung = 1",
        {"id": int(id_nv)},
    )
    if df.empty:
        return {"ket_qua": "chua_dang_ky", "id_nv": int(id_nv),
                "do_tuong_dong": None, "duong_dan_anh": duong_dan,
                "thoi_gian_xu_ly_ms": int((time.perf_counter() - bat_dau) * 1000)}

    diem_max = -1.0
    for _, r in df.iterrows():
        v = np.asarray(json.loads(r["vector_dac_trung"]), dtype=np.float32)
        n = np.linalg.norm(v)
        if n > 0:
            diem_max = max(diem_max, _tuong_dong(vector, v / n))

    # Xep hang chi de GHI NHAT KY (biet ai la nguoi giong nhat luc do), khong con
    # tham gia vao quyet dinh tru khi quan tri bat rang buoc chong cham ho.
    xep = _xep_hang(vector, tham_so)
    nguong = nguong_cosine(tham_so)
    khop = diem_max >= nguong

    chan_cham_ho = int(float(tham_so.get("khuon_mat_chan_cham_ho", 0) or 0)) == 1
    bien_cham_ho = float(tham_so.get("khuon_mat_bien_cham_ho", 0.10) or 0.10)
    nguoi_khac_giong_hon = (
        chan_cham_ho
        and xep.get("id_nv_gan_nhat") is not None
        and int(xep["id_nv_gan_nhat"]) != int(id_nv)
        and float(xep["do_tuong_dong"]) > diem_max + bien_cham_ho
    )

    if not khop:
        ket_qua = "khong_khop"
    elif nguoi_khac_giong_hon:
        ket_qua = "nghi_cham_ho"
    else:
        ket_qua = "thanh_cong"

    return {
        "ket_qua": ket_qua,
        "id_nv": int(id_nv),
        "do_tuong_dong": round(float(diem_max), 4),
        "nguong_ap_dung": nguong,
        "phan_tram": sang_phan_tram(diem_max),
        "nguong_phan_tram": sang_phan_tram(nguong),
        "chan_cham_ho": chan_cham_ho,
        "id_nv_gan_nhat": xep.get("id_nv_gan_nhat"),
        "ten_gan_nhat": xep.get("ten_gan_nhat"),
        "do_tuong_dong_nhi": xep.get("do_tuong_dong"),
        "so_mat_phat_hien": so_mat,
        "duong_dan_anh": duong_dan,
        "thoi_gian_xu_ly_ms": int((time.perf_counter() - bat_dau) * 1000),
    }


# --------------------------------------------------------------------------
# Trang thai
# --------------------------------------------------------------------------
def trang_thai() -> dict:
    """Tinh trang mo hinh va du lieu - dung cho banner canh bao tren giao dien."""
    co_mo_hinh = TEP_YUNET.exists() and TEP_SFACE.exists()
    tham_so = doc_tham_so()
    try:
        df = doc_sql(
            """SELECT COUNT(DISTINCT k.id_nv) AS nguoi, COUNT(*) AS mau
               FROM khuon_mat_nv k WHERE k.dang_dung = 1"""
        )
        nguoi, mau = int(df["nguoi"].iloc[0]), int(df["mau"].iloc[0])
        ket_noi = True
    except Exception:
        nguoi = mau = 0
        ket_noi = False

    return {
        "san_sang": bool(co_mo_hinh and nguoi > 0),
        "co_mo_hinh": co_mo_hinh,
        "ket_noi_db": ket_noi,
        "mo_hinh_phat_hien": "YuNet (2023mar)",
        "mo_hinh_trich_dac_trung": "SFace (2021dec), 128 chieu",
        "so_nhan_vien_da_dang_ky": nguoi,
        "so_anh_mau": mau,
        "tham_so": tham_so,
        "thu_thach_ho_tro": THU_THACH,
    }


# --------------------------------------------------------------------------
# Danh gia mo hinh
# --------------------------------------------------------------------------
# LBPH (Local Binary Patterns Histograms, Ahonen 2006) duoc dung lam MOC SO SANH.
# Day la phuong phap tien hoc-sau kinh dien: chia anh thanh luoi o, moi o dung
# mot histogram ma LBP, roi so sanh bang khoang cach chi-binh-phuong. No khong
# hoc tu du lieu ngoai, chay rat nhanh, va la lua chon mac dinh trong hau het
# giao trinh. Neu SFace khong thang duoc moc nay thi khong co ly do gi de keo
# them 12 MB mo hinh vao he thong.
KICH_THUOC_LBPH = (128, 128)


def _nap_mau_de_danh_gia() -> list[dict]:
    """Doc mau da dang ky kem anh tren dia. Bo mau nao mat anh."""
    df = doc_sql(
        """SELECT k.id, k.id_nv, k.vector_dac_trung, k.duong_dan_anh, n.ten
           FROM khuon_mat_nv k JOIN nhan_vien n ON n.id_nv = k.id_nv
           WHERE k.dang_dung = 1 ORDER BY k.id_nv, k.id"""
    )
    mau: list[dict] = []
    for _, r in df.iterrows():
        try:
            v = np.asarray(json.loads(r["vector_dac_trung"]), dtype=np.float32)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        chuan = np.linalg.norm(v)
        if chuan <= 0:
            continue

        anh_xam = None
        if r["duong_dan_anh"]:
            duong_dan = GOC_DU_AN / str(r["duong_dan_anh"])
            if duong_dan.exists():
                anh_xam = cv2.imread(str(duong_dan), cv2.IMREAD_GRAYSCALE)
                if anh_xam is not None:
                    anh_xam = cv2.resize(anh_xam, KICH_THUOC_LBPH)

        mau.append({
            "id": int(r["id"]), "id_nv": int(r["id_nv"]), "ten": str(r["ten"]).strip(),
            "vector": v / chuan, "anh_xam": anh_xam,
        })
    return mau


def _danh_gia_sface(mau: list[dict], chi_so_hop_le: list[int]) -> dict:
    """Nhan dien 1:N theo kieu bo-mot-ra (leave-one-out)."""
    ma_tran = np.vstack([m["vector"] for m in mau])
    nhan = np.array([m["id_nv"] for m in mau])
    diem_tat_ca = ma_tran @ ma_tran.T  # (n, n) cosine giua moi cap

    dung = 0
    du_doan: list[int] = []
    for i in chi_so_hop_le:
        diem = diem_tat_ca[i].copy()
        diem[i] = -2.0  # bo chinh no ra khoi thu vien
        tot_nhat: dict[int, float] = {}
        for j, d in enumerate(diem):
            if j == i:
                continue
            k = int(nhan[j])
            if d > tot_nhat.get(k, -2.0):
                tot_nhat[k] = float(d)
        doan = max(tot_nhat.items(), key=lambda x: x[1])[0]
        du_doan.append(doan)
        dung += int(doan == nhan[i])

    return {
        "do_chinh_xac": dung / len(chi_so_hop_le),
        "so_dung": dung,
        "so_mau": len(chi_so_hop_le),
        "du_doan": du_doan,
    }


def _danh_gia_lbph(mau: list[dict], chi_so_hop_le: list[int]) -> dict | None:
    """Moc so sanh LBPH, cung giao thuc bo-mot-ra."""
    if not hasattr(cv2, "face"):
        return None
    if any(m["anh_xam"] is None for m in mau):
        return None

    dung = 0
    for i in chi_so_hop_le:
        anh_train = [m["anh_xam"] for j, m in enumerate(mau) if j != i]
        nhan_train = np.array([m["id_nv"] for j, m in enumerate(mau) if j != i])
        # Huan luyen lai cho tung lan bo-mot-ra. LBPH chi dung histogram nen
        # viec nay chi mat vai chuc mili giay moi lan.
        bo = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
        bo.train(anh_train, nhan_train)
        doan, _ = bo.predict(mau[i]["anh_xam"])
        dung += int(int(doan) == mau[i]["id_nv"])

    return {"do_chinh_xac": dung / len(chi_so_hop_le), "so_dung": dung,
            "so_mau": len(chi_so_hop_le)}


def _duong_cong_roc(mau: list[dict]) -> dict:
    """Bai toan xac minh 1:1 - quet nguong tren toan bo cap anh.

    Voi moi cap anh (i, j) ta co diem cosine va nhan dung/sai (cung nguoi hay
    khong). Quet nguong cho ra duong cong ROC, tu do lay:
      - EER: diem ma ty le tu choi nhan (FRR) bang ty le chap nhan nham (FAR).
      - Nguong toi uu theo chi so Youden J = TPR - FPR.
    """
    ma_tran = np.vstack([m["vector"] for m in mau])
    nhan = np.array([m["id_nv"] for m in mau])
    n = len(mau)

    i_idx, j_idx = np.triu_indices(n, k=1)
    diem = (ma_tran @ ma_tran.T)[i_idx, j_idx]
    cung_nguoi = (nhan[i_idx] == nhan[j_idx])

    so_cung = int(cung_nguoi.sum())
    so_khac = int((~cung_nguoi).sum())
    if so_cung == 0 or so_khac == 0:
        return {"du_lieu_du": False, "so_cap_cung": so_cung, "so_cap_khac": so_khac}

    nguong_quet = np.linspace(0.0, 0.9, 181)
    tpr = np.array([float((diem[cung_nguoi] >= t).mean()) for t in nguong_quet])
    fpr = np.array([float((diem[~cung_nguoi] >= t).mean()) for t in nguong_quet])

    # EER: noi |FRR - FAR| nho nhat, voi FRR = 1 - TPR.
    k_eer = int(np.argmin(np.abs((1 - tpr) - fpr)))
    k_j = int(np.argmax(tpr - fpr))

    # AUC bang quy tac hinh thang tren duong cong ROC (fpr giam dan theo nguong).
    thu_tu = np.argsort(fpr)
    auc = float(np.trapezoid(tpr[thu_tu], fpr[thu_tu]))

    return {
        "du_lieu_du": True,
        "so_cap_cung": so_cung,
        "so_cap_khac": so_khac,
        "eer": round(float((fpr[k_eer] + (1 - tpr[k_eer])) / 2), 4),
        "nguong_tai_eer": round(float(nguong_quet[k_eer]), 4),
        "nguong_toi_uu": round(float(nguong_quet[k_j]), 4),
        "tpr_tai_nguong_toi_uu": round(float(tpr[k_j]), 4),
        "fpr_tai_nguong_toi_uu": round(float(fpr[k_j]), 4),
        "auc": round(auc, 4),
        "diem_trung_binh_cung_nguoi": round(float(diem[cung_nguoi].mean()), 4),
        "diem_trung_binh_khac_nguoi": round(float(diem[~cung_nguoi].mean()), 4),
    }


def danh_gia(luu_db: bool = True) -> dict:
    """Do do chinh xac cua SFace so voi moc LBPH tren chinh du lieu he thong.

    Giao thuc bo-mot-ra (leave-one-out): lan luot lay tung anh ra lam anh can
    nhan dien, phan con lai lam thu vien. Cach nay tan dung duoc toan bo du lieu
    khi so mau con it - dieu luon dung voi mot nha hang vai chuc nhan vien.

    Chi tinh diem tren anh cua nguoi co TU 2 MAU TRO LEN: nguoi chi co dung mot
    mau thi khi bo mau do ra ho khong con trong thu vien nua, khong the doan
    dung, tinh vao se lam sai lech ket qua theo huong xau di mot cach vo ly.
    """
    mau = _nap_mau_de_danh_gia()
    if len(mau) < 4:
        raise LoiKhuonMat(
            f"Chi co {len(mau)} anh mau - can it nhat 4 anh cua 2 nguoi de danh gia."
        )

    dem: dict[int, int] = {}
    for m in mau:
        dem[m["id_nv"]] = dem.get(m["id_nv"], 0) + 1
    if len(dem) < 2:
        raise LoiKhuonMat("Can it nhat 2 nhan vien da dang ky de danh gia duoc.")

    chi_so_hop_le = [i for i, m in enumerate(mau) if dem[m["id_nv"]] >= 2]
    if not chi_so_hop_le:
        raise LoiKhuonMat("Moi nhan vien chi co 1 anh mau - hay dang ky them anh.")

    bat_dau = time.perf_counter()
    sface = _danh_gia_sface(mau, chi_so_hop_le)
    lbph = _danh_gia_lbph(mau, chi_so_hop_le)
    roc = _duong_cong_roc(mau)

    ket_qua = {
        "so_nhan_vien": len(dem),
        "so_anh_mau": len(mau),
        "so_anh_dung_de_cham_diem": len(chi_so_hop_le),
        "so_anh_bi_loai": len(mau) - len(chi_so_hop_le),
        "phan_bo_mau": {str(k): v for k, v in sorted(dem.items())},
        "nhan_dien_1_n": {
            "SFace_cosine": {
                "do_chinh_xac": round(sface["do_chinh_xac"], 4),
                "so_dung": sface["so_dung"], "so_mau": sface["so_mau"],
            },
            "LBPH_moc_so_sanh": (
                {"do_chinh_xac": round(lbph["do_chinh_xac"], 4),
                 "so_dung": lbph["so_dung"], "so_mau": lbph["so_mau"]}
                if lbph else None
            ),
        },
        "xac_minh_1_1": roc,
        "thoi_gian_danh_gia_ms": int((time.perf_counter() - bat_dau) * 1000),
        "canh_bao": [],
    }

    if lbph is None:
        ket_qua["canh_bao"].append(
            "Khong chay duoc LBPH (thieu anh mau tren dia hoac thieu opencv-contrib)."
        )
    else:
        chenh = sface["do_chinh_xac"] - lbph["do_chinh_xac"]
        ket_qua["chenh_lech_so_voi_moc"] = round(chenh, 4)
        if chenh <= 0:
            ket_qua["canh_bao"].append(
                "SFace KHONG thang duoc moc LBPH tren tap du lieu nay - "
                "so mau con qua it de ket luan."
            )
    if len(mau) < 20:
        ket_qua["canh_bao"].append(
            f"Chi co {len(mau)} anh mau. Con so chi mang tinh tham khao; "
            "nen dang ky it nhat 5 anh cho moi nhan vien truoc khi trich dan."
        )

    if luu_db:
        _luu_danh_gia(ket_qua, roc, sface, lbph)
    return ket_qua


def _luu_danh_gia(ket_qua: dict, roc: dict, sface: dict, lbph: dict | None) -> None:
    """Ghi ket qua vao `danh_gia_mo_hinh` - cung bang voi cac bai toan du bao."""
    bai_toan = "nhan_dien_khuon_mat"
    chay_sql("DELETE FROM danh_gia_mo_hinh WHERE bai_toan = :bt", {"bt": bai_toan})

    ban_ghi = [{
        "bt": bai_toan, "mh": "SFace_cosine",
        "dcx": float(sface["do_chinh_xac"]),
        "nto": float(roc["nguong_toi_uu"]) if roc.get("du_lieu_du") else None,
        "tr": int(ket_qua["so_anh_mau"] - sface["so_mau"]),
        "te": int(sface["so_mau"]),
        "gc": (f"EER {roc['eer']:.3f}, AUC {roc['auc']:.3f}"
               if roc.get("du_lieu_du") else "khong du cap de ve ROC"),
    }]
    if lbph:
        ban_ghi.append({
            "bt": bai_toan, "mh": "LBPH_moc_so_sanh",
            "dcx": float(lbph["do_chinh_xac"]), "nto": None,
            "tr": int(ket_qua["so_anh_mau"] - lbph["so_mau"]),
            "te": int(lbph["so_mau"]),
            "gc": "Moc so sanh tien hoc-sau (Ahonen 2006)",
        })

    chay_sql(
        """INSERT INTO danh_gia_mo_hinh
             (bai_toan, mo_hinh, do_chinh_xac, nguong_toi_uu,
              so_mau_train, so_mau_test, ghi_chu)
           VALUES (:bt, :mh, :dcx, :nto, :tr, :te, :gc)""",
        ban_ghi,
    )

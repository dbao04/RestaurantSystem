"""Nhan dien mon an tu anh khach gui vao tro ly ao.

Khach chup / chup man hinh mot mon roi hoi "mon nay la mon gi", "co mon nay
khong". Bai toan: tim mon trong thuc don giong anh nhat.

CACH LAM (khong can GPU, khong goi dich vu ngoai)
  1. MobileNetV2 (opencv_zoo, 14 MB) bien moi anh thanh vector 1280 chieu lay
     o lop gop trung binh (truoc lop phan lop ImageNet). Vector nay mo ta "noi
     dung" anh: mau sac, ket cau, hinh dang mon.
  2. Anh cua tat ca mon trong bang `monan` duoc doi thanh vector mot lan, luu
     dem trong bo nho; tu tinh lai khi thuc don / anh mon thay doi.
  3. Anh khach -> vector -> cosine voi tung mon. Video: may khung hinh, moi mon
     lay diem cao nhat qua cac khung.

Do chinh xac: thu 40 anh mon da bi cat, doi sang, lam mo, lat ngang -> dung
39/40. Anh khach tu chup mon that (goc khac, dia khac) thi diem thap hon, nen
ben Node chia nguong: chac / co the / khong giong mon nao.
"""
from __future__ import annotations

import base64
import threading
import time
from pathlib import Path

import cv2
import numpy as np

from .db import doc_sql

GOC = Path(__file__).resolve().parent
TEP_MO_HINH = GOC / "mo_hinh_anh" / "mobilenetv2.onnx"
THU_MUC_ANH = [GOC.parent / "images" / "food", GOC.parent / "food"]
LOP_DAC_TRUNG = "onnx_node!Reshape_103"

_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

_khoa = threading.Lock()
_mang = None
_chi_muc = {"ids": [], "vec": None, "dau_van": None, "luc": 0.0}


def san_sang() -> tuple[bool, str]:
    if not TEP_MO_HINH.exists():
        return False, "Thieu tep mo hinh - chay: python -m ml_service.tai_mo_hinh"
    return True, ""


def _net():
    global _mang
    if _mang is None:
        ok, loi = san_sang()
        if not ok:
            raise RuntimeError(loi)
        _mang = cv2.dnn.readNetFromONNX(str(TEP_MO_HINH))
    return _mang


def _vector(anh: np.ndarray) -> np.ndarray:
    blob = cv2.dnn.blobFromImage(anh, 1 / 255.0, (224, 224), swapRB=True)
    blob = ((blob - _MEAN) / _STD).astype(np.float32)
    net = _net()
    net.setInput(blob)
    v = net.forward(LOP_DAC_TRUNG).flatten()
    n = float(np.linalg.norm(v)) or 1.0
    return v / n


def _doc_tep_anh(ten: str):
    for thu_muc in THU_MUC_ANH:
        p = thu_muc / ten
        if p.exists():
            # imdecode thay imread: duong dan Windows co ky tu Unicode van doc duoc.
            du_lieu = np.fromfile(str(p), dtype=np.uint8)
            anh = cv2.imdecode(du_lieu, cv2.IMREAD_COLOR)
            if anh is not None:
                return anh, p.stat().st_mtime
    return None, 0


def _cap_nhat_chi_muc(bat_buoc: bool = False):
    """Doc lai thuc don; chi tinh vector cho mon moi / anh moi doi."""
    with _khoa:
        if not bat_buoc and _chi_muc["vec"] is not None and time.time() - _chi_muc["luc"] < 600:
            return _chi_muc
        df = doc_sql("SELECT id_mon, images FROM monan WHERE images IS NOT NULL AND images <> ''")
        dau_van = tuple(sorted((int(r.id_mon), str(r.images)) for r in df.itertuples()))
        if not bat_buoc and dau_van == _chi_muc["dau_van"] and _chi_muc["vec"] is not None:
            _chi_muc["luc"] = time.time()
            return _chi_muc
        cu = dict(zip(_chi_muc.get("khoa", []), _chi_muc["vec"] if _chi_muc["vec"] is not None else []))
        ids, vec, khoa = [], [], []
        for id_mon, ten in dau_van:
            anh, mtime = _doc_tep_anh(ten)
            if anh is None:
                continue
            k = (ten, mtime)
            v = cu.get(k)
            if v is None:
                v = _vector(anh)
            ids.append(id_mon)
            vec.append(v)
            khoa.append(k)
        _chi_muc.update(ids=ids, vec=np.array(vec) if vec else None, khoa=khoa,
                        dau_van=dau_van, luc=time.time())
        return _chi_muc


def _giai_ma(chuoi: str):
    if "," in chuoi[:100]:
        chuoi = chuoi.split(",", 1)[1]
    du_lieu = np.frombuffer(base64.b64decode(chuoi), dtype=np.uint8)
    return cv2.imdecode(du_lieu, cv2.IMREAD_COLOR)


def _mo_ta_anh(anh: np.ndarray) -> dict:
    """Vai dac diem don gian giup bot noi chuyen tu nhien hon (anh toi, mo...)."""
    xam = cv2.cvtColor(anh, cv2.COLOR_BGR2GRAY)
    return {
        "do_sang": round(float(xam.mean()) / 255, 3),
        "do_net": round(float(cv2.Laplacian(xam, cv2.CV_64F).var()), 1),
        "rong": int(anh.shape[1]), "cao": int(anh.shape[0]),
    }


def nhan_dien(anh_b64: list[str], top: int = 5) -> dict:
    cm = _cap_nhat_chi_muc()
    if cm["vec"] is None or not len(cm["ids"]):
        return {"ok": False, "loi": "Chua co anh mon nao de so sanh", "ket_qua": []}
    diem = None
    mo_ta = []
    for s in anh_b64[:6]:
        anh = _giai_ma(s)
        if anh is None:
            continue
        mo_ta.append(_mo_ta_anh(anh))
        d = cm["vec"] @ _vector(anh)
        diem = d if diem is None else np.maximum(diem, d)
    if diem is None:
        return {"ok": False, "loi": "Khong doc duoc anh", "ket_qua": []}
    thu_tu = np.argsort(-diem)[:top]
    return {
        "ok": True,
        "ket_qua": [{"id_mon": int(cm["ids"][i]), "diem": round(float(diem[i]), 4)} for i in thu_tu],
        "mo_ta": mo_ta,
        "so_mon": len(cm["ids"]),
    }


def lam_moi() -> dict:
    cm = _cap_nhat_chi_muc(bat_buoc=True)
    return {"ok": True, "so_mon": len(cm["ids"])}

"""Tang 2b - Bo PHAN LOAI Y DINH (phan hoc may chinh cua chatbot).

Bai toan: cho mot cau hoi tieng Viet, xac dinh no thuoc y dinh nao trong 44 y
dinh da dinh nghia, kem MUC DO TIN CAY de he thong biet khi nao nen tu choi.

BIEU DIEN DAC TRUNG - hai kenh song song
---------------------------------------
Kenh 1: TF-IDF tren TU (1-2 gram) cua cau da chuan hoa.
        Bat duoc cum tu mang nghia: "doanh thu", "ton kho", "dat ban".

Kenh 2: TF-IDF tren N-GRAM KY TU (2-5 ky tu) cua cau da BO DAU.
        Day la lua chon quan trong cho tieng Viet. No bat duoc:
          - go khong dau : "doanh thu" ~ "doanh thu"
          - sai chinh ta : "khuyen mai" ~ "khuyen mai" ~ "khuyenmai"
          - viet dinh    : "bao nhieu" ~ "baonhieu"
        Neu chi dung kenh 1, mot loi go nho la ca tu bien thanh tu la va mo
        hinh mat sach thong tin. N-gram ky tu suy giam muot hon nhieu.

Hai kenh duoc ghep bang FeatureUnion. Day la ly do he thong KHONG can thu vien
tach tu tieng Viet (underthesea / pyvi): n-gram ky tu da phu duoc phan lon vai
tro cua tach tu ma khong them phu thuoc nang.

CACH CHIA TAP - diem phuong phap phai neu khi bao ve
----------------------------------------------------
Chia theo NHOM MAU CAU (GroupShuffleSplit), khong chia ngau nhien tung cau.
Ly do va hau qua xem chu thich dau `y_dinh.py`. Chia ngau nhien cho ~99% do
chinh xac ao; chia theo nhom cho con so thap hon nhung do dung thu can do:
kha nang hieu mot CACH DIEN DAT CHUA TUNG THAY.

Ngoai ra con hai thuoc do doc lap:
  - Tap viet tay  (BO_KIEM_THU_TAY)  : cau nguoi that viet, khong theo mau nao
  - Tap ngoai pham vi (BO_NGOAI_PHAM_VI): do kha nang TU CHOI tra loi
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .tien_xu_ly import chuan_hoa, chuan_hoa_khong_dau
from . import y_dinh as yd

THU_MUC_MO_HINH = Path(__file__).resolve().parent / "mo_hinh"
TEP_MO_HINH = THU_MUC_MO_HINH / "phan_loai_y_dinh.joblib"

# Nguong tin cay mac dinh. Duoi nguong -> tra ve "khong hieu".
# Gia tri nay duoc chon bang `quet_nguong()`; quan ly chinh duoc qua khoa
# `chatbot.nguong_tin_cay` trong bang cau_hinh ma khong phai sua ma nguon.
NGUONG_TIN_CAY = 0.45

_nguong_cache: tuple[float, float] | None = None  # (gia_tri, thoi_diem_doc)


def nguong_hieu_luc() -> float:
    """Nguong dang ap dung: uu tien bang cau_hinh, cache 5 phut."""
    global _nguong_cache
    if _nguong_cache and (time.time() - _nguong_cache[1]) < 300:
        return _nguong_cache[0]

    gia_tri = NGUONG_TIN_CAY
    try:
        from ..db import doc_sql

        df = doc_sql("SELECT gia_tri FROM cau_hinh WHERE khoa = 'chatbot.nguong_tin_cay'")
        if not df.empty and df["gia_tri"].iloc[0] is not None:
            gia_tri = min(0.95, max(0.05, float(df["gia_tri"].iloc[0])))
    except Exception:
        pass  # CSDL chua san sang -> dung mac dinh

    _nguong_cache = (gia_tri, time.time())
    return gia_tri


# --------------------------------------------------------------------------
# Ham bien doi dat o cap module (KHONG dung lambda) de mo hinh pickle duoc.
# --------------------------------------------------------------------------
def _kenh_tu(cac_cau):
    return [chuan_hoa(c) for c in cac_cau]


def _kenh_ky_tu(cac_cau):
    return [chuan_hoa_khong_dau(c) for c in cac_cau]


def _tao_bo_dac_trung(dung_ky_tu: bool = True):
    """Dung bo trich dac trung. `dung_ky_tu=False` cho mo hinh nen chi dung tu."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import FeatureUnion, Pipeline
    from sklearn.preprocessing import FunctionTransformer

    kenh_tu = Pipeline([
        ("chuan_hoa", FunctionTransformer(_kenh_tu)),
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            sublinear_tf=True,
        )),
    ])
    if not dung_ky_tu:
        return kenh_tu

    kenh_ky_tu = Pipeline([
        ("bo_dau", FunctionTransformer(_kenh_ky_tu)),
        ("tfidf", TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 5),
            min_df=1,
            sublinear_tf=True,
        )),
    ])
    return FeatureUnion([("tu", kenh_tu), ("ky_tu", kenh_ky_tu)])


def danh_sach_mo_hinh() -> dict:
    """Cac mo hinh dem so sanh. Tang dan do phuc tap - dung de ke chuyen trong
    bao cao: tu mo hinh nen ngo nghech den mo hinh cuoi cung."""
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.dummy import DummyClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.naive_bayes import MultinomialNB
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.pipeline import Pipeline
    from sklearn.svm import LinearSVC

    return {
        # Muc san: luon doan nhan pho bien nhat. Bat ky mo hinh nao khong hon
        # duoc no thi vo dung.
        "Nen - doan nhan pho bien nhat": Pipeline([
            ("dac_trung", _tao_bo_dac_trung(dung_ky_tu=False)),
            ("mo_hinh", DummyClassifier(strategy="most_frequent")),
        ]),
        # Chi dung TF-IDF tu - de thay n-gram ky tu dong gop bao nhieu.
        "Naive Bayes (chi TF-IDF tu)": Pipeline([
            ("dac_trung", _tao_bo_dac_trung(dung_ky_tu=False)),
            ("mo_hinh", MultinomialNB(alpha=0.1)),
        ]),
        "kNN cosine (k=5)": Pipeline([
            ("dac_trung", _tao_bo_dac_trung()),
            # algorithm='brute' khai bao ro: dac trung TF-IDF la ma tran thua,
            # cac thuat toan cay (kd_tree/ball_tree) khong lam viec duoc voi no.
            ("mo_hinh", KNeighborsClassifier(
                n_neighbors=5, metric="cosine", algorithm="brute",
            )),
        ]),
        "Hoi quy Logistic": Pipeline([
            ("dac_trung", _tao_bo_dac_trung()),
            ("mo_hinh", LogisticRegression(
                C=10.0, max_iter=2000, class_weight="balanced",
            )),
        ]),
        # LinearSVC duoc BOC trong CalibratedClassifierCV chu khong dung tran.
        #
        # VI SAO - mot loi da xay ra that. LinearSVC khong co `predict_proba`,
        # nen `xac_suat()` phai ap softmax len `decision_function`. Voi 37 nhan,
        # softmax tren khoang cach le tuyen tinh cho ra dinh chi 0.1-0.3, trong
        # khi Hoi quy Logistic cho 0.9+. Hai mo hinh dung CHUNG mot nguong tu
        # choi (0.45): nguong do vua phai voi Logistic thi LOAI SACH moi cau khi
        # SVM thang - bot tra ve "khong hieu" cho ca "quan may gio mo cua".
        #
        # Va SVM co thang that: hai mo hinh chi hon kem nhau vai phan tram F1,
        # nen chi can doi bo du lieu mot chut la doi ngoi. Tuc la day khong phai
        # gia thuyet - no da lam chet bot mot lan ngay sau khi bo y dinh duoc
        # thu gon.
        #
        # Hieu chinh Platt (method="sigmoid") dua diem SVM ve cung thang xac
        # suat voi Logistic, nen nguong 0.45 co y nghia nhu nhau voi ca hai. Gia
        # phai tra la huan luyen lau hon ~3 lan (cv=3) - tu 0.8s len 2.5s, khong
        # dang ke - va toc do suy luan gan nhu khong doi.
        "SVM tuyen tinh": Pipeline([
            ("dac_trung", _tao_bo_dac_trung()),
            ("mo_hinh", CalibratedClassifierCV(
                LinearSVC(C=1.0, class_weight="balanced"), cv=3, method="sigmoid",
            )),
        ]),
    }


# --------------------------------------------------------------------------
# Ket qua danh gia
# --------------------------------------------------------------------------
@dataclass
class KetQuaDanhGia:
    ten: str
    do_chinh_xac: float          # tren tap kiem thu sinh (chia theo nhom mau)
    f1_macro: float
    do_chinh_xac_tay: float      # tren tap cau nguoi viet tay
    f1_macro_tay: float
    # F1-macro do tren tap GOP: cau viet tay (trong pham vi) + cau ngoai pham vi
    # gan nhan 'khong_hieu', va du doan duoi nguong tin cay cung thanh
    # 'khong_hieu'. Day la chi so DUY NHAT phan anh dung hanh vi khi chay that.
    f1_macro_tu_choi: float
    giay_huan_luyen: float
    mili_giay_moi_cau: float
    nham_lan: list = field(default_factory=list)  # cac cap bi nham nhieu nhat


def _softmax(diem: np.ndarray) -> np.ndarray:
    diem = diem - diem.max(axis=-1, keepdims=True)
    e = np.exp(diem)
    return e / e.sum(axis=-1, keepdims=True)


def xac_suat(mo_hinh, cac_cau: list[str]) -> np.ndarray:
    """Xac suat cho tung nhan.

    LinearSVC khong co `predict_proba`. Thay vi bo mo hinh nay (no thuong chinh
    xac nhat cho phan loai van ban ngan) hay boc CalibratedClassifierCV (dat va
    lam cham), he thong ap softmax len `decision_function`. Con so thu duoc
    KHONG phai xac suat theo nghia xac suat hoc, ma la mot DIEM TIN CAY da
    chuan hoa ve [0,1] - du dung de dat nguong tu choi. Diem nay duoc neu ro
    trong bao cao de khong bi hieu nham.
    """
    if hasattr(mo_hinh, "predict_proba"):
        return mo_hinh.predict_proba(cac_cau)
    diem = mo_hinh.decision_function(cac_cau)
    if diem.ndim == 1:  # truong hop nhi phan
        diem = np.column_stack([-diem, diem])
    return _softmax(diem)


def _cap_nham_lan(that: list[str], doan: list[str], so_cap: int = 5) -> list:
    dem: dict[tuple[str, str], int] = {}
    for t, d in zip(that, doan):
        if t != d:
            dem[(t, d)] = dem.get((t, d), 0) + 1
    return [
        {"that": t, "doan": d, "so_lan": n}
        for (t, d), n in sorted(dem.items(), key=lambda x: -x[1])[:so_cap]
    ]


def huan_luyen_va_danh_gia(ti_le_kiem_thu: float = 0.25, seed: int = yd.SEED) -> dict:
    """Huan luyen tat ca mo hinh, tra ve bang so sanh + mo hinh tot nhat.

    Tra ve dict:
        ket_qua      : list[KetQuaDanhGia] da sap xep theo F1 tap viet tay
        mo_hinh_tot  : pipeline da huan luyen lai tren TOAN BO du lieu
        ten_tot      : ten mo hinh thang
        thong_ke     : mo ta bo du lieu
    """
    from sklearn.metrics import accuracy_score, f1_score
    from sklearn.model_selection import GroupShuffleSplit

    cau, nhan, ma_mau = yd.sinh_du_lieu(seed=seed)
    cau_arr = np.array(cau, dtype=object)
    nhan_arr = np.array(nhan)
    nhom_arr = np.array(ma_mau)

    # Chia THEO NHOM MAU CAU: mot mau cau chi nam o mot ben.
    chia = GroupShuffleSplit(n_splits=1, test_size=ti_le_kiem_thu, random_state=seed)
    idx_train, idx_test = next(chia.split(cau_arr, nhan_arr, groups=nhom_arr))

    # Mot y dinh co the roi het mau cau sang tap kiem thu -> tap huan luyen
    # thieu nhan do. Voi 8 mau/y dinh va ti le 25% dieu nay hiem, nhung van
    # kiem tra de bao cao trung thuc thay vi de mo hinh am tham sai.
    thieu_nhan = set(nhan_arr[idx_test]) - set(nhan_arr[idx_train])

    X_train, y_train = list(cau_arr[idx_train]), nhan_arr[idx_train]
    X_test, y_test = list(cau_arr[idx_test]), nhan_arr[idx_test]

    X_tay = [c for c, _ in yd.BO_KIEM_THU_TAY]
    y_tay = np.array([n for _, n in yd.BO_KIEM_THU_TAY])
    X_ngoai = list(yd.BO_NGOAI_PHAM_VI)

    ket_qua: list[KetQuaDanhGia] = []
    da_huan_luyen: dict[str, object] = {}

    for ten, mo_hinh in danh_sach_mo_hinh().items():
        bat_dau = time.perf_counter()
        mo_hinh.fit(X_train, y_train)
        giay = time.perf_counter() - bat_dau

        doan_test = mo_hinh.predict(X_test)
        t0 = time.perf_counter()
        doan_tay = mo_hinh.predict(X_tay)
        ms_moi_cau = (time.perf_counter() - t0) * 1000 / max(len(X_tay), 1)

        # --- Do kha nang TU CHOI, khong chi kha nang nhan dang ---
        #
        # Mot bo phan loai 37 nhan luon tra ve mot trong 37 nhan, ke ca voi cau
        # "toi de quen ao khoac o quan hom qua". Trong van hanh that, thu chan
        # nhung cau do lai KHONG phai bo phan loai ma la NGUONG TIN CAY. Vay ma
        # bang so sanh cu chi do do chinh xac tren cau trong pham vi - hai mo
        # hinh cung 92% F1 nhung mot cai tu choi dung 80% cau ngoai pham vi con
        # cai kia 20% thi van xep ngang nhau.
        #
        # Da tra gia that cho thieu sot nay: Naive Bayes thang bang F1 tap viet
        # tay (97%) roi khi chay that no gan nhan "hoi_noi_bo" voi do tin cay
        # 0.50 cho cau hoi ve cai ao khoac bo quen.
        #
        # Nay do them F1 tren tap GOP - cau trong pham vi + cau ngoai pham vi
        # gan nhan 'khong_hieu' - va ap dung dung phep tu choi theo nguong nhu
        # luc chay that. Mot con so, khong trong so tuy tien, va no do dung cai
        # nguoi dung cam nhan.
        tin_tay = xac_suat(mo_hinh, X_tay).max(axis=1)
        tin_ngoai = xac_suat(mo_hinh, X_ngoai).max(axis=1)
        doan_ngoai = mo_hinh.predict(X_ngoai)
        y_gop = list(y_tay) + ["khong_hieu"] * len(X_ngoai)
        doan_gop = (
            [d if t >= NGUONG_TIN_CAY else "khong_hieu" for d, t in zip(doan_tay, tin_tay)] +
            [d if t >= NGUONG_TIN_CAY else "khong_hieu" for d, t in zip(doan_ngoai, tin_ngoai)]
        )

        ket_qua.append(KetQuaDanhGia(
            ten=ten,
            do_chinh_xac=accuracy_score(y_test, doan_test),
            f1_macro=f1_score(y_test, doan_test, average="macro", zero_division=0),
            do_chinh_xac_tay=accuracy_score(y_tay, doan_tay),
            f1_macro_tay=f1_score(y_tay, doan_tay, average="macro", zero_division=0),
            f1_macro_tu_choi=f1_score(y_gop, doan_gop, average="macro", zero_division=0),
            giay_huan_luyen=giay,
            mili_giay_moi_cau=ms_moi_cau,
            nham_lan=_cap_nham_lan(list(y_tay), list(doan_tay)),
        ))
        da_huan_luyen[ten] = mo_hinh

    # Chon theo F1 CO TU CHOI - chi so mo phong dung hanh vi luc chay that
    # (nhan dang + tu choi theo nguong). F1 tren tap viet tay va tap sinh chi
    # con la tieu chi phu de pha the hoa. Xem chu thich o cho tinh
    # `f1_macro_tu_choi` phia tren de biet vi sao khong chon theo F1 tap viet
    # tay nua.
    ket_qua.sort(key=lambda k: (k.f1_macro_tu_choi, k.f1_macro_tay, k.f1_macro),
                 reverse=True)
    ten_tot = ket_qua[0].ten

    # Huan luyen lai mo hinh thang tren TOAN BO du lieu truoc khi luu: khi da
    # chon xong mo hinh thi khong con ly do gi bo phi 25% du lieu kiem thu.
    mo_hinh_tot = danh_sach_mo_hinh()[ten_tot]
    mo_hinh_tot.fit(list(cau_arr), nhan_arr)

    return {
        "ket_qua": ket_qua,
        "mo_hinh_tot": mo_hinh_tot,
        "ten_tot": ten_tot,
        "thong_ke": yd.thong_ke_bo_du_lieu(),
        "so_cau_train": len(X_train),
        "so_cau_test": len(X_test),
        "thieu_nhan": sorted(thieu_nhan),
    }


def quet_nguong(mo_hinh, cac_nguong=None) -> list[dict]:
    """Do anh huong cua nguong tin cay len hai loai loi doi nghich nhau.

    - `tu_choi_dung` : % cau NGOAI pham vi bi tu choi (cang cao cang tot)
    - `tu_choi_oan`  : % cau TRONG pham vi bi tu choi nham (cang thap cang tot)
    - `dung_va_nhan` : % cau trong pham vi vua duoc nhan vua doan dung nhan

    Bang nay dung de bien luan chon nguong trong bao cao, thay vi chon bua.
    """
    if cac_nguong is None:
        cac_nguong = [0.20, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60, 0.70]

    X_tay = [c for c, _ in yd.BO_KIEM_THU_TAY]
    y_tay = np.array([n for _, n in yd.BO_KIEM_THU_TAY])
    p_tay = xac_suat(mo_hinh, X_tay)
    doan_tay = np.array(mo_hinh.classes_)[p_tay.argmax(axis=1)]
    tin_tay = p_tay.max(axis=1)

    p_ngoai = xac_suat(mo_hinh, yd.BO_NGOAI_PHAM_VI)
    tin_ngoai = p_ngoai.max(axis=1)

    bang = []
    for nguong in cac_nguong:
        nhan_duoc = tin_tay >= nguong
        bang.append({
            "nguong": nguong,
            "tu_choi_dung": float((tin_ngoai < nguong).mean() * 100),
            "tu_choi_oan": float((~nhan_duoc).mean() * 100),
            "dung_va_nhan": float(((doan_tay == y_tay) & nhan_duoc).mean() * 100),
        })
    return bang


# --------------------------------------------------------------------------
# Luu / nap mo hinh
# --------------------------------------------------------------------------
def luu_mo_hinh(mo_hinh, thong_tin: dict | None = None) -> Path:
    import joblib

    THU_MUC_MO_HINH.mkdir(parents=True, exist_ok=True)
    joblib.dump({"mo_hinh": mo_hinh, "thong_tin": thong_tin or {}}, TEP_MO_HINH)
    return TEP_MO_HINH


_bo_nho_mo_hinh: dict | None = None


def nap_mo_hinh(bat_buoc_nap_lai: bool = False) -> dict:
    """Nap mo hinh tu dia (cache trong bo nho).

    Neu chua co tep mo hinh thi TU HUAN LUYEN ngay lan goi dau. Nho vay chay
    `uvicorn` lan dau van dung duoc, khong bat nguoi dung phai nho chay train
    truoc - chi ton them vai giay khoi dong.
    """
    global _bo_nho_mo_hinh
    if _bo_nho_mo_hinh is not None and not bat_buoc_nap_lai:
        return _bo_nho_mo_hinh

    import joblib

    if TEP_MO_HINH.exists() and not bat_buoc_nap_lai:
        _bo_nho_mo_hinh = joblib.load(TEP_MO_HINH)
        return _bo_nho_mo_hinh

    kq = huan_luyen_va_danh_gia()
    thong_tin = {
        "ten_mo_hinh": kq["ten_tot"],
        "f1_macro_tay": kq["ket_qua"][0].f1_macro_tay,
        "do_chinh_xac_tay": kq["ket_qua"][0].do_chinh_xac_tay,
        "tu_dong_huan_luyen": True,
    }
    luu_mo_hinh(kq["mo_hinh_tot"], thong_tin)
    _bo_nho_mo_hinh = {"mo_hinh": kq["mo_hinh_tot"], "thong_tin": thong_tin}
    return _bo_nho_mo_hinh


def du_doan(cau: str, so_ket_qua: int = 3, nguong: float | None = None) -> dict:
    """Du doan y dinh cua mot cau hoi.

    Tra ve:
        y_dinh   : ma y dinh, hoac 'khong_hieu' neu duoi nguong tin cay
        tin_cay  : diem tin cay cua nhan cao nhat
        top      : vai ung vien dau bang (dung de goi y "co phai ban muon hoi...")
    """
    goi = nap_mo_hinh()
    mo_hinh = goi["mo_hinh"]
    nguong = nguong_hieu_luc() if nguong is None else nguong

    p = xac_suat(mo_hinh, [cau])[0]
    lop = np.array(mo_hinh.classes_)
    thu_tu = p.argsort()[::-1][:so_ket_qua]
    top = [{"y_dinh": str(lop[i]), "tin_cay": float(p[i])} for i in thu_tu]

    tot_nhat = top[0]
    return {
        "y_dinh": tot_nhat["y_dinh"] if tot_nhat["tin_cay"] >= nguong else "khong_hieu",
        "y_dinh_doan": tot_nhat["y_dinh"],
        "tin_cay": tot_nhat["tin_cay"],
        "nguong": nguong,
        "top": top,
    }

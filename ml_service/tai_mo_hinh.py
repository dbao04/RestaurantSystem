"""Tai hai tep mo hinh ONNX cho phan nhan dien khuon mat.

Chay:  python -m ml_service.tai_mo_hinh

Hai tep nay khong duoc dua vao git (tong ~12 MB, xem .gitignore). Ai lay ma
nguon ve chay lan dau thi chay lenh tren mot lan la du.

Nguon: kho opencv_zoo chinh thuc cua OpenCV. Tep nam duoi Git-LFS nen phai tai
qua ten mien media.githubusercontent.com, tai qua raw. se chi duoc mot con tro
LFS 130 byte chu khong phai mo hinh.
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

THU_MUC = Path(__file__).resolve().parent / "mo_hinh_khuon_mat"
GOC = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models"

MO_HINH = [
    (
        "face_detection_yunet_2023mar.onnx",
        f"{GOC}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        200_000,   # kich thuoc toi thieu hop le (byte)
        "YuNet - phat hien khuon mat",
    ),
    (
        "face_recognition_sface_2021dec.onnx",
        f"{GOC}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        10_000_000,
        "SFace - trich vector dac trung 128 chieu",
    ),
]


def tai_mot(ten: str, url: str, toi_thieu: int, mo_ta: str) -> bool:
    dich = THU_MUC / ten
    if dich.exists() and dich.stat().st_size >= toi_thieu:
        print(f"  = {ten} da co ({dich.stat().st_size / 1e6:.1f} MB)")
        return True

    print(f"  . dang tai {mo_ta} ...")
    tam = dich.with_suffix(".tam")
    try:
        urllib.request.urlretrieve(url, tam)
    except Exception as loi:
        print(f"  ! tai that bai: {loi}")
        tam.unlink(missing_ok=True)
        return False

    kich_thuoc = tam.stat().st_size
    if kich_thuoc < toi_thieu:
        # Truong hop hay gap nhat: tai nham con tro Git-LFS thay vi mo hinh.
        print(f"  ! tep tai ve chi {kich_thuoc} byte - khong phai mo hinh hop le")
        tam.unlink(missing_ok=True)
        return False

    tam.replace(dich)
    print(f"  + {ten} ({kich_thuoc / 1e6:.1f} MB)")
    return True


def main() -> int:
    print("=== Tai mo hinh nhan dien khuon mat ===")
    THU_MUC.mkdir(parents=True, exist_ok=True)
    xong = all(tai_mot(*m) for m in MO_HINH)
    if xong:
        print(f"\nHoan tat. Mo hinh nam tai: {THU_MUC}")
        return 0
    print("\nCon tep chua tai duoc. Kiem tra ket noi mang roi chay lai.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

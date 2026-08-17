"""Huan luyen bo phan loai y dinh tu dong lenh va in bang chi so.

    python -m ml_service.chatbot.train

Bang in ra dung truc tiep cho phan thuc nghiem cua bao cao. Ket qua dong thoi
duoc ghi vao bang `chatbot_danh_gia` de trang quan tri hien thi lai - cung
cach lam voi `danh_gia_mo_hinh` cua phan du bao.
"""
from __future__ import annotations

import sys

from . import phan_loai as pl
from . import y_dinh as yd


def _ke(rong: int = 96) -> None:
    print("-" * rong)


def _luu_danh_gia(ket_qua, ten_tot: str) -> None:
    try:
        from ..db import chay_sql

        chay_sql("DELETE FROM chatbot_danh_gia")
        chay_sql(
            """INSERT INTO chatbot_danh_gia
                 (mo_hinh, do_chinh_xac, f1_macro, do_chinh_xac_tay, f1_macro_tay,
                  giay_huan_luyen, ms_moi_cau, la_mo_hinh_chon)
               VALUES (:mh, :dcx, :f1, :dcx_t, :f1_t, :giay, :ms, :chon)""",
            [
                {
                    "mh": k.ten,
                    "dcx": round(k.do_chinh_xac * 100, 2),
                    "f1": round(k.f1_macro * 100, 2),
                    "dcx_t": round(k.do_chinh_xac_tay * 100, 2),
                    "f1_t": round(k.f1_macro_tay * 100, 2),
                    "giay": round(k.giay_huan_luyen, 2),
                    "ms": round(k.mili_giay_moi_cau, 2),
                    "chon": 1 if k.ten == ten_tot else 0,
                }
                for k in ket_qua
            ],
        )
        print("  Da ghi ket qua vao bang `chatbot_danh_gia`.")
    except Exception as loi:
        print(f"  [!] Khong ghi duoc vao CSDL ({str(loi)[:120]}) - bo qua, khong bat buoc.")


def main() -> int:
    print("=" * 96)
    print("HUAN LUYEN BO PHAN LOAI Y DINH - CHATBOT NHA HANG")
    print("=" * 96)

    # ---------------------------------------------------------------- du lieu
    tk = yd.thong_ke_bo_du_lieu()
    print("\n[1/4] BO DU LIEU (tu xay)")
    _ke()
    print(f"  So y dinh              : {tk['so_y_dinh']}"
          f"   (chung {tk['theo_nhom']['chung']} /"
          f" khach {tk['theo_nhom']['khach']} /"
          f" quan ly {tk['theo_nhom']['quan_ly']})")
    print(f"  So mau cau viet tay    : {tk['so_mau_cau']}")
    print(f"  So cau sinh ra         : {tk['so_cau_sinh']}"
          f"   (it nhat {tk['it_nhat']} - nhieu nhat {tk['nhieu_nhat']} cau/y dinh)")
    print(f"  Do dai trung binh      : {tk['do_dai_tb']} tu")
    print(f"  Tap kiem thu VIET TAY  : {tk['so_cau_kiem_thu_tay']} cau")
    print(f"  Tap ngoai pham vi      : {len(yd.BO_NGOAI_PHAM_VI)} cau")

    # ------------------------------------------------------------ huan luyen
    print("\n[2/4] HUAN LUYEN VA SO SANH MO HINH")
    print("  Chia tap theo NHOM MAU CAU (GroupShuffleSplit) - mot mau cau chi")
    print("  nam o mot ben, tranh ro ri du lieu lam do chinh xac cao gia tao.")
    _ke()

    kq = pl.huan_luyen_va_danh_gia()
    print(f"  Tap huan luyen: {kq['so_cau_train']} cau | "
          f"Tap kiem thu: {kq['so_cau_test']} cau")
    if kq["thieu_nhan"]:
        print(f"  [!] {len(kq['thieu_nhan'])} y dinh khong co mau nao trong tap huan luyen: "
              f"{', '.join(kq['thieu_nhan'][:5])}")
    print()

    tieu_de = (f"  {'Mo hinh':<32}{'DoCX(sinh)':>11}{'F1(sinh)':>10}"
               f"{'DoCX(tay)':>11}{'F1(tay)':>9}{'F1(tu choi)':>13}"
               f"{'Train(s)':>10}{'ms/cau':>9}")
    print(tieu_de)
    _ke()
    for k in kq["ket_qua"]:
        danh_dau = " *" if k.ten == kq["ten_tot"] else "  "
        print(f"{danh_dau}{k.ten:<32}"
              f"{k.do_chinh_xac * 100:>10.2f}%"
              f"{k.f1_macro * 100:>9.2f}%"
              f"{k.do_chinh_xac_tay * 100:>10.2f}%"
              f"{k.f1_macro_tay * 100:>8.2f}%"
              f"{k.f1_macro_tu_choi * 100:>12.2f}%"
              f"{k.giay_huan_luyen:>10.2f}"
              f"{k.mili_giay_moi_cau:>9.2f}")
    _ke()
    print(f"  (*) Mo hinh duoc chon: {kq['ten_tot']}  - chon theo F1(tu choi):")
    print("      do tren tap viet tay GOP voi tap ngoai pham vi, va co ap nguong")
    print("      tu choi y het luc chay that. Mot mo hinh nhan dang gioi nhung")
    print("      khong biet noi 'toi khong biet' thi khong dung duoc.")

    tot = kq["ket_qua"][0]
    if tot.nham_lan:
        print("\n  Cac cap y dinh bi nham nhieu nhat (tren tap viet tay):")
        for c in tot.nham_lan:
            print(f"    {c['that']:<28} -> {c['doan']:<28} ({c['so_lan']} lan)")

    # ------------------------------------------------------------- nguong
    print("\n[3/4] CHON NGUONG TIN CAY")
    print("  Nguong cao -> tu choi dung nhieu cau ngoai pham vi, nhung cung tu")
    print("  choi oan nhieu cau hop le. Bang duoi de bien luan diem can bang.")
    _ke()
    print(f"  {'Nguong':>8}{'Tu choi dung':>16}{'Tu choi oan':>15}{'Dung & nhan':>15}")
    for dong in pl.quet_nguong(kq["mo_hinh_tot"]):
        danh_dau = " <-" if abs(dong["nguong"] - pl.NGUONG_TIN_CAY) < 1e-9 else ""
        print(f"  {dong['nguong']:>8.2f}"
              f"{dong['tu_choi_dung']:>15.1f}%"
              f"{dong['tu_choi_oan']:>14.1f}%"
              f"{dong['dung_va_nhan']:>14.1f}%{danh_dau}")
    _ke()
    print(f"  Nguong dang dung: {pl.NGUONG_TIN_CAY}")

    # ---------------------------------------------------------------- luu
    print("\n[4/4] LUU MO HINH")
    _ke()
    duong_dan = pl.luu_mo_hinh(kq["mo_hinh_tot"], {
        "ten_mo_hinh": kq["ten_tot"],
        "do_chinh_xac": tot.do_chinh_xac,
        "f1_macro": tot.f1_macro,
        "do_chinh_xac_tay": tot.do_chinh_xac_tay,
        "f1_macro_tay": tot.f1_macro_tay,
        "so_y_dinh": tk["so_y_dinh"],
        "so_cau_huan_luyen": tk["so_cau_sinh"],
    })
    print(f"  Da luu: {duong_dan}")
    _luu_danh_gia(kq["ket_qua"], kq["ten_tot"])

    # ------------------------------------------------------------- thu nhanh
    print("\nTHU NHANH VAI CAU")
    _ke()
    pl._bo_nho_mo_hinh = {"mo_hinh": kq["mo_hinh_tot"], "thong_tin": {}}
    for cau in [
        "doanh thu tuần trước bao nhiêu",
        "nguyen lieu nao sap het",
        "quán mở cửa mấy giờ vậy",
        "gà nướng giá nhiêu",
        "top 5 món bán chạy tháng này",
        "thời tiết ngày mai thế nào",
    ]:
        d = pl.du_doan(cau)
        print(f"  {cau:<42} -> {d['y_dinh']:<26} ({d['tin_cay']:.3f})")

    print("\n=== HOAN TAT ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Chay huan luyen + khai pha luat tu dong lenh (khong can bat web service).

Dung khi muon train dinh ky (cron) hoac khi viet bao cao can in ra bang chi so.
    python -m ml_service.train
"""
from __future__ import annotations

import json
import sys

from . import apriori as ap
from . import forecast as fc


def main() -> int:
    print("=" * 68)
    print("BAI TOAN 1: DU BAO LUOT KHACH")
    print("=" * 68)
    kq = fc.du_bao_luot_khach(so_ngay=14)
    print(f"Mo hinh duoc chon: {kq['mo_hinh_chon']}")
    print(f"Tap train: {kq['so_mau_train']} ngay | Tap test: {kq['so_mau_test']} ngay\n")
    print(f"{'Mo hinh':<18}{'MAE':>10}{'RMSE':>10}{'MAPE %':>10}{'R2':>10}")
    print("-" * 58)
    for m in kq["so_sanh_mo_hinh"]:
        print(f"{m['ten']:<18}{m['mae']:>10.2f}{m['rmse']:>10.2f}{m['mape']:>10.2f}{m['r2']:>10.4f}")
    print("\nDu bao 7 ngay toi:")
    for d in kq["du_bao"][:7]:
        print(f"  {d['ngay']}: {d['gia_tri']:>7.0f} khach  (khoang {d['can_duoi']:.0f} - {d['can_tren']:.0f})")

    print("\n" + "=" * 68)
    print("BAI TOAN 2: DU BAO NHU CAU NGUYEN LIEU")
    print("=" * 68)
    nl = fc.du_bao_nguyen_lieu(so_ngay=7)
    print(f"So nguyen lieu du bao: {nl['so_nguyen_lieu']} | MAPE trung binh: {nl['mape_trung_binh']}%\n")
    print(f"{'Nguyen lieu':<22}{'Mo hinh':<16}{'Ton':>9}{'Can 7n':>9}{'Nhap them':>11}{'Du (ngay)':>11}")
    print("-" * 78)
    for r in nl["nguyen_lieu"][:18]:
        du = f"{r['du_ngay']:.1f}" if r["du_ngay"] is not None else "-"
        print(f"{r['ten_nl'][:21]:<22}{r['mo_hinh']:<16}{r['ton_hien_tai']:>9.1f}"
              f"{r['tong_can_du_bao']:>9.1f}{r['can_nhap_them']:>11.1f}{du:>11}")

    print("\n" + "=" * 68)
    print("BAI TOAN 3: KHAI PHA LUAT KET HOP (APRIORI)")
    print("=" * 68)
    lk = ap.khai_pha_va_luu()
    print(f"So giao dich    : {lk['so_giao_dich']:,}")
    print(f"Kich thuoc gio TB: {lk['kich_thuoc_gio_tb']} mon")
    print(f"Tap thuong xuyen : {lk['so_tap_thuong_xuyen']}")
    print(f"So luat sinh ra  : {lk['so_luat']}\n")
    print(f"{'Neu khach goi':<46}{'Goi y them':<24}{'Tin cay':>9}{'Lift':>8}")
    print("-" * 88)
    for r in lk["top_luat"][:15]:
        neu = " + ".join(r["neu_goi"])[:44]
        print(f"{neu:<46}{r['goi_y_them'][:23]:<24}{r['tin_cay']*100:>8.1f}%{r['lift']:>8.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

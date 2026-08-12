"""Tang 4 - Anh xa (y dinh + tham so) -> DU LIEU.

DIEM AN NINH QUAN TRONG NHAT CUA CA HE THONG
--------------------------------------------
Chatbot KHONG sinh cau SQL tu do. Moi y dinh duoc gan cung voi mot ham xu ly
da viet san, ben trong la cau SQL CO DINH voi THAM SO RANG BUOC (:ten). Gia tri
nguoi dung go vao chi bao gio di vao vi tri tham so, khong bao gio duoc noi
chuoi vao cau lenh.

Hau qua truc tiep:
  - Khong the bi SQL injection: khong co duong nao de van ban nguoi dung tro
    thanh CU PHAP SQL.
  - Khong the doc nham bang: chi cac bang xuat hien trong file nay moi truy cap
    duoc; khong co cach nao hoi ra bang `nhan_vien.matkhau`.
  - Khong the sinh cau SQL sai: cau lenh do nguoi viet va kiem thu truoc.

Doi lai, bot chi tra loi duoc trong pham vi 44 y dinh - danh doi co chu dich,
duoc neu ro trong phan han che cua bao cao.

PHAN QUYEN
----------
Y dinh thuoc nhom "quan_ly" chi chay khi `boi_canh['quyen'] == 'quan_ly'`.
Viec chan nam O DAY chu khong o mo hinh: mo hinh chi lam nhiem vu NHAN DANG,
khong duoc phep la choi bao ve an ninh. Tang Node con kiem tra mot lan nua
truoc khi goi sang (phong thu nhieu lop).
"""
from __future__ import annotations

from datetime import date, timedelta

from . import y_dinh as yd
from .thuc_the import lay_moc_hom_nay

SO_NGAY_MAC_DINH = 30

# Dieu kien loc chuan - GIU DONG BO voi services/analyticsService.js. Neu doi o
# mot noi ma quen noi kia, so lieu chatbot se lech so lieu dashboard.
DON_HOAN_TAT = "h.tinhtrang = 3 AND h.id_mon > 0"


def _doc(cau_lenh: str, tham_so: dict | None = None) -> list[dict]:
    from ..db import doc_sql

    df = doc_sql(cau_lenh, tham_so or {})
    return df.to_dict("records")


def _so(gia_tri, mac_dinh=0) -> float:
    try:
        if gia_tri is None:
            return mac_dinh
        return float(gia_tri)
    except (TypeError, ValueError):
        return mac_dinh


def _khoang(tham_so: dict) -> dict:
    """Khoang ngay dung cho truy van. Mac dinh 30 ngay gan nhat."""
    tg = tham_so.get("thoi_gian")
    if tg and not tg.get("tuong_lai"):
        return tg
    hn = lay_moc_hom_nay()
    return {
        "tu": (hn - timedelta(days=SO_NGAY_MAC_DINH - 1)).isoformat(),
        "den": hn.isoformat(),
        "nhan": f"{SO_NGAY_MAC_DINH} ngày gần nhất",
        "mac_dinh": True,
    }


def _cau_hinh(khoa: str, mac_dinh: str = "") -> str:
    rows = _doc("SELECT gia_tri FROM cau_hinh WHERE khoa = :k", {"k": khoa})
    return str(rows[0]["gia_tri"]) if rows and rows[0].get("gia_tri") else mac_dinh


# ==========================================================================
# NHOM QUAN LY
# ==========================================================================
def _tong_quan(tu: str, den: str) -> dict:
    """Cac chi so tong hop cho mot khoang - dung chung cho nhieu y dinh."""
    rows = _doc(
        f"""SELECT COUNT(DISTINCT h.sesis)        AS so_don,
                   COALESCE(SUM(h.thanhtien), 0)  AS doanh_thu,
                   COALESCE(SUM(h.soluong), 0)    AS so_mon
            FROM hopdong h
            WHERE {DON_HOAN_TAT} AND h.ngay_dat BETWEEN :tu AND :den""",
        {"tu": tu, "den": den},
    )
    chi_phi = _doc(
        f"""SELECT COALESCE(SUM(h.soluong * ct.chi_phi), 0) AS chi_phi_nl
            FROM hopdong h
            JOIN (SELECT c.id_mon, SUM(c.so_luong_tieu_hao * n.gia_von) AS chi_phi
                  FROM cong_thuc c JOIN nguyen_lieu n ON n.id_nl = c.id_nl
                  GROUP BY c.id_mon) ct ON ct.id_mon = h.id_mon
            WHERE {DON_HOAN_TAT} AND h.ngay_dat BETWEEN :tu AND :den""",
        {"tu": tu, "den": den},
    )
    khach = _doc(
        """SELECT COALESCE(SUM(t.so_khach), 0) AS so_khach
           FROM (SELECT sesis, MAX(CAST(NULLIF(TRIM(so_user), '') AS UNSIGNED)) AS so_khach
                 FROM hopdong
                 WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat BETWEEN :tu AND :den
                 GROUP BY sesis) t""",
        {"tu": tu, "den": den},
    )
    dt = _so(rows[0]["doanh_thu"])
    cp = _so(chi_phi[0]["chi_phi_nl"])
    so_don = int(_so(rows[0]["so_don"]))
    return {
        "so_don": so_don,
        "doanh_thu": dt,
        "so_mon": int(_so(rows[0]["so_mon"])),
        "so_khach": int(_so(khach[0]["so_khach"])) if khach else 0,
        "chi_phi_nguyen_lieu": cp,
        "loi_nhuan_gop": dt - cp,
        "bien_loi_nhuan": (dt - cp) / dt * 100 if dt > 0 else 0.0,
        "gia_tri_don_tb": dt / so_don if so_don else 0.0,
    }


def _duong_doanh_thu(tu: str, den: str) -> dict:
    rows = _doc(
        f"""SELECT DATE_FORMAT(h.ngay_dat, '%Y-%m-%d') AS ngay,
                   SUM(h.thanhtien) AS doanh_thu
            FROM hopdong h
            WHERE {DON_HOAN_TAT} AND h.ngay_dat BETWEEN :tu AND :den
            GROUP BY h.ngay_dat ORDER BY h.ngay_dat""",
        {"tu": tu, "den": den},
    )
    return {
        "loai": "duong",
        "ten": "Doanh thu theo ngày",
        "nhan": [r["ngay"] for r in rows],
        "gia_tri": [_so(r["doanh_thu"]) for r in rows],
    }


def _q_doanh_thu(tham_so: dict, boi_canh: dict) -> dict:
    k = _khoang(tham_so)
    tq = _tong_quan(k["tu"], k["den"])
    return {"khoang": k, "chi_so": tq, "bieu_do": _duong_doanh_thu(k["tu"], k["den"])}


def _q_so_sanh_doanh_thu(tham_so: dict, boi_canh: dict) -> dict:
    """So sanh ky hien tai voi ky lien truoc CUNG DO DAI.

    Ky truoc duoc suy ra tu do dai ky nay, khong phai "thang truoc" co dinh -
    nho vay "so sanh 7 ngay qua" cung dung nhu "so sanh thang nay".
    """
    k = _khoang(tham_so)
    tu = date.fromisoformat(k["tu"])
    den = date.fromisoformat(k["den"])
    so_ngay = (den - tu).days + 1
    truoc_den = tu - timedelta(days=1)
    truoc_tu = truoc_den - timedelta(days=so_ngay - 1)

    nay = _tong_quan(k["tu"], k["den"])
    truoc = _tong_quan(truoc_tu.isoformat(), truoc_den.isoformat())

    def _thay_doi(a: float, b: float) -> float:
        return ((a - b) / b * 100) if b else 0.0

    return {
        "khoang": k,
        "khoang_truoc": {
            "tu": truoc_tu.isoformat(), "den": truoc_den.isoformat(),
            "nhan": f"{so_ngay} ngày liền trước",
        },
        "ky_nay": nay,
        "ky_truoc": truoc,
        "thay_doi": {
            "doanh_thu": _thay_doi(nay["doanh_thu"], truoc["doanh_thu"]),
            "so_don": _thay_doi(nay["so_don"], truoc["so_don"]),
            "so_khach": _thay_doi(nay["so_khach"], truoc["so_khach"]),
            "loi_nhuan_gop": _thay_doi(nay["loi_nhuan_gop"], truoc["loi_nhuan_gop"]),
        },
        "bieu_do": {
            "loai": "cot",
            "ten": "So sánh hai kỳ",
            "nhan": ["Kỳ trước", "Kỳ này"],
            "gia_tri": [truoc["doanh_thu"], nay["doanh_thu"]],
        },
    }


def _q_so_don(tham_so, boi_canh):
    k = _khoang(tham_so)
    return {"khoang": k, "chi_so": _tong_quan(k["tu"], k["den"]),
            "bieu_do": _duong_doanh_thu(k["tu"], k["den"])}


def _q_luot_khach(tham_so, boi_canh):
    k = _khoang(tham_so)
    rows = _doc(
        """SELECT DATE_FORMAT(t.ngay, '%Y-%m-%d') AS ngay, SUM(t.so_khach) AS so_khach
           FROM (SELECT ngay_dat AS ngay, sesis,
                        MAX(CAST(NULLIF(TRIM(so_user), '') AS UNSIGNED)) AS so_khach
                 FROM hopdong
                 WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat BETWEEN :tu AND :den
                 GROUP BY ngay_dat, sesis) t
           GROUP BY t.ngay ORDER BY t.ngay""",
        {"tu": k["tu"], "den": k["den"]},
    )
    return {
        "khoang": k,
        "chi_so": _tong_quan(k["tu"], k["den"]),
        "bieu_do": {
            "loai": "duong", "ten": "Lượt khách theo ngày",
            "nhan": [r["ngay"] for r in rows],
            "gia_tri": [_so(r["so_khach"]) for r in rows],
        },
    }


def _q_loi_nhuan(tham_so, boi_canh):
    k = _khoang(tham_so)
    return {"khoang": k, "chi_so": _tong_quan(k["tu"], k["den"])}


def _q_gia_tri_don_tb(tham_so, boi_canh):
    k = _khoang(tham_so)
    return {"khoang": k, "chi_so": _tong_quan(k["tu"], k["den"])}


def _q_top_mon(tham_so, boi_canh):
    k = _khoang(tham_so)
    n = int(tham_so.get("top_n") or 10)
    rows = _doc(
        f"""SELECT h.name_mon,
                   SUM(h.soluong)   AS so_luong,
                   SUM(h.thanhtien) AS doanh_thu,
                   SUM(h.thanhtien) - COALESCE(SUM(h.soluong * ct.chi_phi), 0) AS loi_nhuan
            FROM hopdong h
            LEFT JOIN (SELECT c.id_mon, SUM(c.so_luong_tieu_hao * n.gia_von) AS chi_phi
                       FROM cong_thuc c JOIN nguyen_lieu n ON n.id_nl = c.id_nl
                       GROUP BY c.id_mon) ct ON ct.id_mon = h.id_mon
            WHERE {DON_HOAN_TAT} AND h.ngay_dat BETWEEN :tu AND :den
            GROUP BY h.id_mon, h.name_mon
            ORDER BY so_luong DESC LIMIT :n""",
        {"tu": k["tu"], "den": k["den"], "n": n},
    )
    return {
        "khoang": k, "bang": rows,
        "cot": [("name_mon", "Món"), ("so_luong", "SL bán"),
                ("doanh_thu", "Doanh thu"), ("loi_nhuan", "Lợi nhuận")],
        "bieu_do": {
            "loai": "cot", "ten": f"Top {len(rows)} món bán chạy",
            "nhan": [r["name_mon"] for r in rows],
            "gia_tri": [_so(r["so_luong"]) for r in rows],
        },
    }


def _q_mon_ban_cham(tham_so, boi_canh):
    k = _khoang(tham_so)
    n = int(tham_so.get("top_n") or 10)
    rows = _doc(
        f"""SELECT m.name_mon,
                   COALESCE(SUM(h.soluong), 0)   AS so_luong,
                   COALESCE(SUM(h.thanhtien), 0) AS doanh_thu
            FROM monan m
            LEFT JOIN hopdong h
                   ON h.id_mon = m.id_mon AND {DON_HOAN_TAT}
                  AND h.ngay_dat BETWEEN :tu AND :den
            WHERE m.tinhtrang = 1
            GROUP BY m.id_mon, m.name_mon
            ORDER BY so_luong ASC, doanh_thu ASC LIMIT :n""",
        {"tu": k["tu"], "den": k["den"], "n": n},
    )
    return {"khoang": k, "bang": rows,
            "cot": [("name_mon", "Món"), ("so_luong", "SL bán"), ("doanh_thu", "Doanh thu")]}


def _q_ton_kho(tham_so, boi_canh):
    nl = tham_so.get("nguyen_lieu")
    if nl:
        rows = _doc(
            """SELECT nl.ten_nl, nl.so_luong AS ton, nl.dinh_muc_min, dv.ten_dvt
               FROM nguyen_lieu nl
               LEFT JOIN don_vi_tinh dv ON dv.id_dvt = nl.id_dvt
               WHERE nl.id_nl = :id""",
            {"id": int(nl["id_nl"])},
        )
    else:
        rows = _doc(
            """SELECT nl.ten_nl, nl.so_luong AS ton, nl.dinh_muc_min, dv.ten_dvt
               FROM nguyen_lieu nl
               LEFT JOIN don_vi_tinh dv ON dv.id_dvt = nl.id_dvt
               -- Xep nguyen lieu "cang gan cham dinh muc cang len dau".
               -- NULLIF tranh chia cho 0 khi chua khai bao dinh muc.
               ORDER BY nl.so_luong / NULLIF(nl.dinh_muc_min, 0) ASC, nl.ten_nl
               LIMIT 15"""
        )
    return {"bang": rows, "loc_theo": nl["ten_nl"] if nl else None,
            "cot": [("ten_nl", "Nguyên liệu"), ("ton", "Tồn"),
                    ("ten_dvt", "ĐVT"), ("dinh_muc_min", "Định mức tối thiểu")]}


def _q_nguyen_lieu_sap_het(tham_so, boi_canh):
    """Nguyen lieu duoi dinh muc HOAC du dung chua toi 3 ngay.

    "So ngay con lai" = ton / tieu hao trung binh 30 ngay - cung cong thuc voi
    dashboard, de hai noi khong noi hai con so khac nhau.
    """
    rows = _doc(
        """SELECT nl.ten_nl, nl.so_luong AS ton, nl.dinh_muc_min, dv.ten_dvt,
                  COALESCE(tb.tieu_hao_ngay, 0) AS tieu_hao_ngay,
                  CASE WHEN COALESCE(tb.tieu_hao_ngay, 0) > 0
                       THEN ROUND(nl.so_luong / tb.tieu_hao_ngay, 1) END AS so_ngay_con
           FROM nguyen_lieu nl
           LEFT JOIN don_vi_tinh dv ON dv.id_dvt = nl.id_dvt
           LEFT JOIN (SELECT id_nl, SUM(so_luong) / 30 AS tieu_hao_ngay
                      FROM xuat_kho
                      WHERE ngay_xuat >= (SELECT DATE_SUB(MAX(ngay_xuat), INTERVAL 30 DAY)
                                          FROM xuat_kho)
                      GROUP BY id_nl) tb ON tb.id_nl = nl.id_nl
           WHERE nl.so_luong <= nl.dinh_muc_min
              OR (COALESCE(tb.tieu_hao_ngay, 0) > 0 AND nl.so_luong / tb.tieu_hao_ngay < 3)
           ORDER BY so_ngay_con IS NULL, so_ngay_con ASC LIMIT 20"""
    )
    return {"bang": rows,
            "cot": [("ten_nl", "Nguyên liệu"), ("ton", "Tồn"), ("ten_dvt", "ĐVT"),
                    ("so_ngay_con", "Còn đủ (ngày)")]}


def _q_lo_sap_het_han(tham_so, boi_canh):
    rows = _doc(
        """SELECT nl.ten_nl, ct.so_lo, ct.han_su_dung, ct.so_luong_con_lai AS so_luong,
                  DATEDIFF(ct.han_su_dung, CURDATE()) AS con_lai
           FROM chi_tiet_phieu_nhap ct
           JOIN nguyen_lieu nl ON nl.id_nl = ct.id_nl
           WHERE ct.han_su_dung IS NOT NULL AND ct.so_luong_con_lai > 0
             AND ct.han_su_dung <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
           ORDER BY ct.han_su_dung LIMIT 20"""
    )
    return {"bang": rows,
            "cot": [("ten_nl", "Nguyên liệu"), ("so_lo", "Lô"),
                    ("han_su_dung", "Hạn dùng"), ("so_luong", "Còn lại"),
                    ("con_lai", "Còn (ngày)")]}


def _q_hieu_suat_nhan_vien(tham_so, boi_canh):
    k = _khoang(tham_so)
    rows = _doc(
        f"""SELECT nv.ten, nv.chucvu,
                   COUNT(DISTINCT h.sesis)  AS so_don,
                   COUNT(DISTINCT h.id_ban) AS so_ban,
                   SUM(h.thanhtien)         AS doanh_thu
            FROM hopdong h
            JOIN nhan_vien nv ON nv.id_nv = h.id_nv_phuc_vu
            WHERE {DON_HOAN_TAT} AND h.ngay_dat BETWEEN :tu AND :den
            GROUP BY nv.id_nv, nv.ten, nv.chucvu
            ORDER BY so_don DESC LIMIT 15""",
        {"tu": k["tu"], "den": k["den"]},
    )
    return {"khoang": k, "bang": rows,
            "cot": [("ten", "Nhân viên"), ("chucvu", "Chức vụ"),
                    ("so_don", "Số đơn"), ("doanh_thu", "Doanh thu")],
            "bieu_do": {
                "loai": "cot", "ten": "Số đơn theo nhân viên",
                "nhan": [r["ten"] for r in rows],
                "gia_tri": [_so(r["so_don"]) for r in rows],
            }}


def _q_hieu_suat_bep(tham_so, boi_canh):
    k = _khoang(tham_so)
    rows = _doc(
        """SELECT h.name_mon, COUNT(*) AS so_lan,
                  ROUND(AVG(TIMESTAMPDIFF(SECOND, h.bep_bat_dau, h.bep_ket_thuc)) / 60, 1) AS phut_tb
           FROM hopdong h
           WHERE h.bep_ket_thuc IS NOT NULL AND h.ngay_dat BETWEEN :tu AND :den
           GROUP BY h.id_mon, h.name_mon
           HAVING so_lan >= 5
           ORDER BY phut_tb DESC LIMIT 10""",
        {"tu": k["tu"], "den": k["den"]},
    )
    tong = _doc(
        """SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, bep_bat_dau, bep_ket_thuc)) / 60, 1) AS phut_tb
           FROM hopdong
           WHERE bep_ket_thuc IS NOT NULL AND ngay_dat BETWEEN :tu AND :den""",
        {"tu": k["tu"], "den": k["den"]},
    )
    return {"khoang": k, "bang": rows,
            "chi_so": {"phut_tb_toan_bep": _so(tong[0]["phut_tb"]) if tong else 0},
            "cot": [("name_mon", "Món"), ("so_lan", "Số lần"), ("phut_tb", "Phút TB")]}


def _q_gio_cao_diem(tham_so, boi_canh):
    k = _khoang(tham_so)
    gio = _doc(
        f"""SELECT HOUR(h.gio_dat) AS gio, COUNT(DISTINCT h.sesis) AS so_don,
                   SUM(h.thanhtien) AS doanh_thu
            FROM hopdong h
            WHERE {DON_HOAN_TAT} AND h.gio_dat IS NOT NULL
              AND h.ngay_dat BETWEEN :tu AND :den
            GROUP BY HOUR(h.gio_dat) ORDER BY gio""",
        {"tu": k["tu"], "den": k["den"]},
    )
    thu = _doc(
        f"""SELECT DAYOFWEEK(h.ngay_dat) AS thu_so, COUNT(DISTINCT h.sesis) AS so_don,
                   SUM(h.thanhtien) AS doanh_thu
            FROM hopdong h
            WHERE {DON_HOAN_TAT} AND h.ngay_dat BETWEEN :tu AND :den
            GROUP BY DAYOFWEEK(h.ngay_dat) ORDER BY thu_so""",
        {"tu": k["tu"], "den": k["den"]},
    )
    ten_thu = ["", "Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]
    for r in thu:
        r["ten_thu"] = ten_thu[int(_so(r["thu_so"], 1))]
    return {"khoang": k, "theo_gio": gio, "theo_thu": thu,
            "bieu_do": {
                "loai": "cot", "ten": "Doanh thu theo khung giờ",
                "nhan": [f"{int(_so(r['gio']))}h" for r in gio],
                "gia_tri": [_so(r["doanh_thu"]) for r in gio],
            }}


def _q_ty_le_huy(tham_so, boi_canh):
    k = _khoang(tham_so)
    rows = _doc(
        """SELECT COUNT(DISTINCT CASE WHEN tinhtrang = 2 THEN sesis END) AS don_huy,
                  COUNT(DISTINCT sesis) AS tong_don
           FROM hopdong WHERE id_mon > 0 AND ngay_dat BETWEEN :tu AND :den""",
        {"tu": k["tu"], "den": k["den"]},
    )
    huy = int(_so(rows[0]["don_huy"]))
    tong = int(_so(rows[0]["tong_don"]))
    return {"khoang": k, "chi_so": {
        "don_huy": huy, "tong_don": tong,
        "ty_le_huy": (huy / tong * 100) if tong else 0.0,
    }}


def _q_ban_trong(tham_so, boi_canh):
    rows = _doc(
        """SELECT b.trangthai, COUNT(*) AS so_ban
           FROM ban b GROUP BY b.trangthai ORDER BY b.trangthai"""
    )
    ten = {0: "Trống", 1: "Đang phục vụ", 2: "Đã đặt trước", 3: "Đang dọn"}
    for r in rows:
        r["ten_trang_thai"] = ten.get(int(_so(r["trangthai"])), "Không rõ")
    tong = sum(int(_so(r["so_ban"])) for r in rows)
    trong = sum(int(_so(r["so_ban"])) for r in rows if int(_so(r["trangthai"])) == 0)
    return {"bang": rows,
            "cot": [("ten_trang_thai", "Trạng thái"), ("so_ban", "Số bàn")],
            "chi_so": {"tong_ban": tong, "ban_trong": trong,
                       "ty_le_lap_day": ((tong - trong) / tong * 100) if tong else 0.0},
            "bieu_do": {"loai": "tron", "ten": "Tình trạng bàn",
                        "nhan": [r["ten_trang_thai"] for r in rows],
                        "gia_tri": [_so(r["so_ban"]) for r in rows]}}


def _q_don_dang_cho(tham_so, boi_canh):
    rows = _doc(
        """SELECT h.trangthai_bep, COUNT(*) AS so_mon,
                  MAX(TIMESTAMPDIFF(MINUTE,
                      COALESCE(h.bep_bat_dau,
                               CONCAT(h.ngay_dat, ' ', COALESCE(h.gio_dat, '00:00:00'))),
                      NOW())) AS cho_lau_nhat_phut
           FROM hopdong h
           WHERE h.id_mon > 0 AND h.tinhtrang IN (1, 5, 6)
             AND h.ngay_dat = CURDATE() AND h.trangthai_bep < 3
           GROUP BY h.trangthai_bep ORDER BY h.trangthai_bep"""
    )
    ten = {0: "Chờ chế biến", 1: "Đang chế biến", 2: "Hoàn thành, chờ phục vụ"}
    for r in rows:
        r["ten_trang_thai"] = ten.get(int(_so(r["trangthai_bep"])), "Không rõ")
    return {"bang": rows,
            "cot": [("ten_trang_thai", "Trạng thái"), ("so_mon", "Số món"),
                    ("cho_lau_nhat_phut", "Chờ lâu nhất (phút)")],
            "chi_so": {"tong_mon_cho": sum(int(_so(r["so_mon"])) for r in rows)}}


def _q_du_bao(tham_so, boi_canh):
    """Doc ket qua du bao DA LUU, khong huan luyen lai.

    Huan luyen lai ton hang chuc giay - qua lau cho mot cau chat. Nguoi dung
    muon so lieu moi thi bam nut o trang /du-bao. Bot noi ro ket qua duoc tinh
    luc nao de khong bi hieu nham la so lieu tuc thoi.
    """
    du_bao = _doc(
        """SELECT DATE_FORMAT(ngay_du_bao, '%Y-%m-%d') AS ngay,
                  so_khach_du_bao, can_duoi, can_tren, mo_hinh, tao_luc
           FROM du_bao_luot_khach
           WHERE ngay_du_bao >= CURDATE()
           ORDER BY ngay_du_bao LIMIT 14"""
    )
    danh_gia = _doc(
        """SELECT mo_hinh, mae, rmse, mape, r2
           FROM danh_gia_mo_hinh WHERE bai_toan = 'luot_khach'
           ORDER BY mae ASC LIMIT 5"""
    )
    return {"bang": du_bao, "danh_gia": danh_gia,
            "cot": [("ngay", "Ngày"), ("so_khach_du_bao", "Dự báo khách"),
                    ("can_duoi", "Cận dưới"), ("can_tren", "Cận trên")],
            "bieu_do": {"loai": "duong", "ten": "Dự báo lượt khách",
                        "nhan": [r["ngay"] for r in du_bao],
                        "gia_tri": [_so(r["so_khach_du_bao"]) for r in du_bao]}}


# ==========================================================================
# NHOM KHACH HANG
# ==========================================================================
def _q_thuc_don(tham_so, boi_canh):
    loai = tham_so.get("loai_mon")
    if loai:
        rows = _doc(
            """SELECT m.name_mon, m.gia_mon, lm.name_loai
               FROM monan m JOIN loai_mon lm ON lm.id_loai = m.id_loai
               WHERE m.tinhtrang = 1 AND m.id_loai = :id
               ORDER BY m.gia_mon""",
            {"id": int(loai["id_loai"])},
        )
    else:
        rows = _doc(
            """SELECT m.name_mon, m.gia_mon, lm.name_loai
               FROM monan m JOIN loai_mon lm ON lm.id_loai = m.id_loai
               WHERE m.tinhtrang = 1
               ORDER BY lm.name_loai, m.gia_mon"""
        )
    return {"bang": rows, "loc_theo": loai["name_loai"] if loai else None,
            "cot": [("name_mon", "Món"), ("name_loai", "Danh mục"), ("gia_mon", "Giá")]}


def _q_gia_mon(tham_so, boi_canh):
    mon = tham_so.get("mon")
    if not mon:
        return {"thieu_tham_so": "mon"}
    rows = _doc(
        """SELECT m.name_mon, m.gia_mon, m.ghichu_mon, lm.name_loai
           FROM monan m JOIN loai_mon lm ON lm.id_loai = m.id_loai
           WHERE m.id_mon = :id""",
        {"id": int(mon["id_mon"])},
    )
    return {"mon": rows[0] if rows else None}


def _q_mon_ban_chay(tham_so, boi_canh):
    """Ban cho KHACH: chi so luong ban, KHONG lo doanh thu / loi nhuan.

    Cung mot cau hoi nhung hai goc nhin: khach thay "mon duoc goi nhieu nhat",
    quan ly thay them doanh thu va loi nhuan gop (xem `_q_top_mon`).
    """
    hn = lay_moc_hom_nay()
    tu = (hn - timedelta(days=89)).isoformat()
    rows = _doc(
        f"""SELECT h.name_mon, m.gia_mon, SUM(h.soluong) AS so_luong
            FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon
            WHERE {DON_HOAN_TAT} AND h.ngay_dat BETWEEN :tu AND :den
              AND m.tinhtrang = 1
            GROUP BY h.id_mon, h.name_mon, m.gia_mon
            ORDER BY so_luong DESC LIMIT 8""",
        {"tu": tu, "den": hn.isoformat()},
    )
    return {"bang": rows, "cot": [("name_mon", "Món"), ("gia_mon", "Giá"),
                                  ("so_luong", "Lượt gọi (90 ngày)")]}


def _q_mon_theo_gia(tham_so, boi_canh):
    gia = tham_so.get("gia")
    if not gia:
        rows = _doc(
            """SELECT name_mon, gia_mon FROM monan
               WHERE tinhtrang = 1 ORDER BY gia_mon ASC LIMIT 10"""
        )
        return {"bang": rows, "huong": "re_nhat",
                "cot": [("name_mon", "Món"), ("gia_mon", "Giá")]}

    if gia["huong"] == "tren":
        rows = _doc(
            """SELECT name_mon, gia_mon FROM monan
               WHERE tinhtrang = 1 AND gia_mon >= :g
               ORDER BY gia_mon ASC LIMIT 12""", {"g": gia["gia"]})
    else:
        rows = _doc(
            """SELECT name_mon, gia_mon FROM monan
               WHERE tinhtrang = 1 AND gia_mon <= :g
               ORDER BY gia_mon DESC LIMIT 12""", {"g": gia["gia"]})
    return {"bang": rows, "nguong_gia": gia,
            "cot": [("name_mon", "Món"), ("gia_mon", "Giá")]}


def _q_goi_y_mon(tham_so, boi_canh):
    """Goi y mon di kem - DUNG LAI bang `luat_ket_hop` do Apriori sinh ra.

    Chatbot khong tu cai lai thuat toan goi y; no la mot GIAO DIEN MOI cho
    phan he Apriori da co. Neu khach chua neu mon nao thi tra ve mon ban chay.
    """
    mon = tham_so.get("mon")
    if not mon:
        return _q_mon_ban_chay(tham_so, boi_canh)

    id_mon = int(mon["id_mon"])
    rows = _doc(
        """SELECT m.name_mon, m.gia_mon, l.do_tin_cay, l.do_nang
           FROM luat_ket_hop l
           JOIN monan m ON m.id_mon = l.mon_ve_phai
           WHERE l.mon_ve_trai = :ve_trai AND m.tinhtrang = 1
           ORDER BY l.do_nang DESC LIMIT 5""",
        {"ve_trai": str(id_mon)},
    )
    return {"mon_goc": mon, "bang": rows,
            "cot": [("name_mon", "Gợi ý thêm"), ("gia_mon", "Giá"),
                    ("do_tin_cay", "Độ tin cậy"), ("do_nang", "Lift")]}


def _q_combo(tham_so, boi_canh):
    rows = _doc(
        """SELECT ten_combo, gia_combo, mo_ta FROM combos
           WHERE trang_thai = 1 ORDER BY gia_combo"""
    )
    return {"bang": rows, "so_nguoi": tham_so.get("so_nguoi"),
            "cot": [("ten_combo", "Combo"), ("gia_combo", "Giá"), ("mo_ta", "Gồm")]}


def _q_khuyen_mai(tham_so, boi_canh):
    rows = _doc(
        """SELECT code, description, discount_type, discount_value,
                  min_order_value, valid_until
           FROM discount_codes
           WHERE is_active = 1 AND NOW() BETWEEN valid_from AND valid_until
             AND (max_usage IS NULL OR current_usage < max_usage)
           ORDER BY valid_until LIMIT 10"""
    )
    for r in rows:
        r["uu_dai"] = (f"{_so(r['discount_value']):.0f}%"
                       if r["discount_type"] == "percentage"
                       else f"{_so(r['discount_value']):,.0f}đ")
    return {"bang": rows,
            "cot": [("code", "Mã"), ("uu_dai", "Ưu đãi"),
                    ("min_order_value", "Đơn tối thiểu"), ("valid_until", "Hết hạn")]}


def _q_do_uong(tham_so, boi_canh):
    rows = _doc(
        """SELECT m.name_mon, m.gia_mon
           FROM monan m JOIN loai_mon lm ON lm.id_loai = m.id_loai
           WHERE m.tinhtrang = 1
             AND (lm.name_loai LIKE '%uống%' OR lm.name_loai LIKE '%Nước%'
                  OR lm.name_loai LIKE '%bia%')
           ORDER BY m.gia_mon LIMIT 20"""
    )
    return {"bang": rows, "cot": [("name_mon", "Đồ uống"), ("gia_mon", "Giá")]}


def _q_trang_thai_don(tham_so, boi_canh):
    """Chi tra don CUA CHINH KHACH DANG DANG NHAP.

    `id_kh` lay tu PHIEN dang nhap phia Node, khong bao gio lay tu cau hoi.
    Nho vay khach khong the go "don cua khach 15" de xem don nguoi khac.
    """
    id_kh = boi_canh.get("id_kh")
    if not id_kh:
        return {"can_dang_nhap": True}
    rows = _doc(
        """SELECT h.sesis, MAX(h.ngay_dat) AS ngay_dat, MAX(h.tinhtrang) AS tinhtrang,
                  SUM(h.thanhtien) AS tong_tien, COUNT(*) AS so_mon
           FROM hopdong h
           WHERE h.id_user = :id AND h.id_mon > 0
           GROUP BY h.sesis ORDER BY ngay_dat DESC LIMIT 5""",
        {"id": int(id_kh)},
    )
    ten = {0: "Chờ xác nhận", 1: "Đã xác nhận", 2: "Đã hủy",
           3: "Đã thanh toán", 5: "Khách đã đến", 6: "Đang dùng món"}
    for r in rows:
        r["ten_trang_thai"] = ten.get(int(_so(r["tinhtrang"])), "Không rõ")
    return {"bang": rows,
            "cot": [("ngay_dat", "Ngày"), ("so_mon", "Số món"),
                    ("tong_tien", "Tổng tiền"), ("ten_trang_thai", "Trạng thái")]}


def _q_diem_tich_luy(tham_so, boi_canh):
    id_kh = boi_canh.get("id_kh")
    if not id_kh:
        return {"can_dang_nhap": True}
    try:
        rows = _doc(
            # Cot `points`: giao dich 'earn' luu so duong, 'redeem' luu so am
            # (xem services/loyaltyService.js) nen tong chinh la so du.
            """SELECT COALESCE(SUM(points), 0) AS tong_diem
               FROM loyalty_transactions WHERE id_kh = :id""",
            {"id": int(id_kh)},
        )
        return {"chi_so": {"tong_diem": _so(rows[0]["tong_diem"])}}
    except Exception:
        # Phan he tich diem co the chua duoc bat tren ban cai nay.
        return {"chua_co_du_lieu": True}


def _q_mon_chay(tham_so, boi_canh):
    """Loc theo tu khoa trong ten va ghi chu mon.

    Day la giai phap thuc dung: CSDL hien chua co cot danh dau mon chay. Bot
    noi ro day la ket qua loc theo tu khoa va khuyen khach xac nhan voi nhan
    vien neu can chinh xac tuyet doi (di ung la van de an toan).
    """
    rows = _doc(
        """SELECT name_mon, gia_mon FROM monan
           WHERE tinhtrang = 1
             AND (name_mon LIKE '%chay%' OR name_mon LIKE '%đậu%'
                  OR name_mon LIKE '%rau%' OR name_mon LIKE '%nấm%'
                  OR ghichu_mon LIKE '%chay%')
           ORDER BY gia_mon LIMIT 15"""
    )
    return {"bang": rows, "canh_bao_di_ung": True,
            "cot": [("name_mon", "Món"), ("gia_mon", "Giá")]}


# ==========================================================================
# Y DINH TRA LOI TINH - noi dung lay tu bang `cau_hinh`
#
# De trong bang thi dung cau mac dinh o day. Quan ly sua noi dung qua trang
# cau hinh, KHONG phai sua code - dung tinh than cua bang `cau_hinh` san co.
# ==========================================================================
NOI_DUNG_TINH: dict[str, tuple[str, str]] = {
    "hoi_gio_mo_cua": (
        "chatbot.gio_mo_cua",
        "Nhà hàng mở cửa **10:00 – 22:00** tất cả các ngày trong tuần "
        "(nhận khách đến 21:30).",
    ),
    "hoi_dia_chi": (
        "chatbot.dia_chi",
        "Nhà hàng nằm tại **số 1 Võ Văn Ngân, TP. Thủ Đức, TP.HCM**. "
        "Có bãi giữ xe máy và ô tô miễn phí cho khách.",
    ),
    "hoi_lien_he": (
        "chatbot.lien_he",
        "Bạn liên hệ nhà hàng qua **hotline 0918 484 042** hoặc nhắn tin trực "
        "tiếp trong mục Chat của website nhé.",
    ),
    "hoi_thanh_toan": (
        "chatbot.thanh_toan",
        "Nhà hàng nhận **tiền mặt, chuyển khoản và quét mã VietQR**. "
        "Bạn có thể thanh toán tại quầy hoặc quét mã QR ngay tại bàn.",
    ),
    "hoi_giao_hang": (
        "chatbot.giao_hang",
        "Nhà hàng có **nhận mang về và giao hàng** trong bán kính 5km. "
        "Bạn đặt món ở mục Thực đơn rồi chọn hình thức Giao hàng khi thanh toán.",
    ),
    "hoi_dat_coc": (
        "chatbot.dat_coc",
        "Đặt bàn thường **không cần cọc**. Với bàn VIP hoặc nhóm đông, nhà hàng "
        "xin cọc giữ chỗ và **hoàn lại toàn bộ** khi bạn đến dùng bữa.",
    ),
    "dat_ban": (
        "chatbot.dat_ban",
        "Bạn đặt bàn ở mục **Đặt bàn** trên website: chọn ngày, giờ, số khách "
        "rồi xác nhận. Nhà hàng sẽ gọi lại xác nhận trong ít phút.",
    ),
    "huy_don": (
        "chatbot.huy_don",
        "Bạn vào mục **Đơn của tôi** để hủy hoặc đổi giờ đơn đang chờ. "
        "Đơn bếp đã bắt đầu chế biến thì cần báo nhân viên trực tiếp.",
    ),
    "danh_gia_gop_y": (
        "chatbot.danh_gia",
        "Nhà hàng rất mong nhận góp ý của bạn. Bạn đánh giá ở mục **Đánh giá** "
        "trên website. Nếu cần xử lý gấp, mình chuyển bạn sang nhân viên ngay.",
    ),
    "hoi_bot_la_ai": (
        "chatbot.gioi_thieu",
        "Mình là **trợ lý ảo của nhà hàng**. Mình trả lời được về thực đơn, giá "
        "món, khuyến mãi, đặt bàn, giao hàng; và với tài khoản quản lý thì thêm "
        "doanh thu, tồn kho, hiệu suất nhân viên và dự báo.",
    ),
    "chao_hoi": (
        "chatbot.chao",
        "Chào bạn! Mình là trợ lý ảo của nhà hàng. Mình giúp gì được cho bạn?",
    ),
    "tam_biet": (
        "chatbot.tam_biet",
        "Cảm ơn bạn đã ghé nhà hàng. Hẹn gặp lại bạn!",
    ),
    "cam_on": (
        "chatbot.cam_on",
        "Rất vui được giúp bạn. Bạn cần gì thêm cứ nhắn mình nhé!",
    ),
    "gap_nhan_vien": (
        "chatbot.chuyen_nhan_vien",
        "Mình chuyển bạn sang nhân viên hỗ trợ ngay. Bạn chờ một chút nhé!",
    ),
}


def _tra_loi_tinh(y_dinh_ma: str) -> dict:
    khoa, mac_dinh = NOI_DUNG_TINH[y_dinh_ma]
    try:
        noi_dung = _cau_hinh(khoa, mac_dinh)
    except Exception:
        noi_dung = mac_dinh
    return {"van_ban": noi_dung, "tinh": True,
            "chuyen_nhan_vien": y_dinh_ma == "gap_nhan_vien"}


# ==========================================================================
# So dang ky
# ==========================================================================
THU_VIEN = {
    # quan ly
    "hoi_doanh_thu": _q_doanh_thu,
    "hoi_so_sanh_doanh_thu": _q_so_sanh_doanh_thu,
    "hoi_so_don": _q_so_don,
    "hoi_luot_khach": _q_luot_khach,
    "hoi_loi_nhuan": _q_loi_nhuan,
    "hoi_gia_tri_don_tb": _q_gia_tri_don_tb,
    "hoi_top_mon": _q_top_mon,
    "hoi_mon_ban_cham": _q_mon_ban_cham,
    "hoi_ton_kho": _q_ton_kho,
    "hoi_nguyen_lieu_sap_het": _q_nguyen_lieu_sap_het,
    "hoi_lo_sap_het_han": _q_lo_sap_het_han,
    "hoi_hieu_suat_nhan_vien": _q_hieu_suat_nhan_vien,
    "hoi_hieu_suat_bep": _q_hieu_suat_bep,
    "hoi_gio_cao_diem": _q_gio_cao_diem,
    "hoi_ty_le_huy": _q_ty_le_huy,
    "hoi_ban_trong": _q_ban_trong,
    "hoi_don_dang_cho": _q_don_dang_cho,
    "hoi_du_bao": _q_du_bao,
    # khach hang
    "hoi_thuc_don": _q_thuc_don,
    "hoi_mon_theo_loai": _q_thuc_don,
    "hoi_gia_mon": _q_gia_mon,
    "hoi_mon_ban_chay": _q_mon_ban_chay,
    "hoi_mon_theo_gia": _q_mon_theo_gia,
    "goi_y_mon": _q_goi_y_mon,
    "hoi_combo": _q_combo,
    "hoi_khuyen_mai": _q_khuyen_mai,
    "hoi_do_uong": _q_do_uong,
    "hoi_mon_chay": _q_mon_chay,
    "hoi_trang_thai_don": _q_trang_thai_don,
    "hoi_diem_tich_luy": _q_diem_tich_luy,
}


def chay(y_dinh_ma: str, tham_so: dict, boi_canh: dict) -> dict:
    """Thuc thi truy van cho mot y dinh. Luon tra ve dict, khong nem loi ra ngoai."""
    thong_tin = yd.Y_DINH.get(y_dinh_ma)
    if thong_tin is None:
        return {"loi": "khong_biet_y_dinh"}

    # --- Phan quyen: chan TRUOC khi cham vao CSDL ---
    if thong_tin["nhom"] == "quan_ly" and boi_canh.get("quyen") != "quan_ly":
        return {"tu_choi_quyen": True}

    if y_dinh_ma in NOI_DUNG_TINH:
        return _tra_loi_tinh(y_dinh_ma)

    ham = THU_VIEN.get(y_dinh_ma)
    if ham is None:
        return {"chua_ho_tro": True}

    try:
        return ham(tham_so, boi_canh)
    except Exception as loi:
        # Khong lo chi tiet loi SQL ra cho nguoi dung cuoi (co the ro ri ten
        # bang/cot). Ghi lai de xem trong log service.
        return {"loi": "loi_truy_van", "chi_tiet": str(loi)[:300]}

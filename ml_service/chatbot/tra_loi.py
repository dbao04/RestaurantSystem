"""Tang 5 - Sinh CAU TRA LOI tieng Viet tu ket qua truy van.

Day la tang NLG (Natural Language Generation) theo huong MAU CAU, khong phai
sinh tu do bang mo hinh ngon ngu. Ly do chon mau cau:

  1. Khong bao gio "bia" so lieu. Mo hinh sinh tu do co the viet ra mot con so
     khong co trong du lieu - voi bao cao kinh doanh thi day la loi khong the
     chap nhan.
  2. Chay tuc thi, khong can GPU, khong can khoa API.
  3. Cau chu on dinh nen de kiem thu.

Doi lai cau van kem linh hoat hon. He thong bu bang cach viet nhieu bien the
cho moi loai cau tra loi va chon ngau nhien, de hoi thoai do lap lai.
"""
from __future__ import annotations

import random

from . import y_dinh as yd


# --------------------------------------------------------------------------
# Dinh dang so
# --------------------------------------------------------------------------
def tien(gia_tri) -> str:
    try:
        return f"{float(gia_tri):,.0f}đ".replace(",", ".")
    except (TypeError, ValueError):
        return "0đ"


def nguyen(gia_tri) -> str:
    try:
        return f"{int(float(gia_tri)):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "0"


def phan_tram(gia_tri, so_le: int = 1) -> str:
    try:
        return f"{float(gia_tri):.{so_le}f}%"
    except (TypeError, ValueError):
        return "0%"


def _mui_ten(thay_doi: float) -> str:
    if thay_doi > 0.5:
        return f"tăng {phan_tram(thay_doi)}"
    if thay_doi < -0.5:
        return f"giảm {phan_tram(abs(thay_doi))}"
    return "gần như không đổi"


def _nhan_khoang(kq: dict) -> str:
    k = kq.get("khoang") or {}
    nhan = k.get("nhan", "")
    if not nhan:
        return ""
    chi_tiet = f" ({k.get('tu', '')} → {k.get('den', '')})"
    them = " (mặc định, vì bạn chưa nêu mốc thời gian)" if k.get("mac_dinh") else ""
    return f"**{nhan}**{chi_tiet}{them}"


# --------------------------------------------------------------------------
# Cau tra loi cho tung y dinh
# --------------------------------------------------------------------------


def _tl_so_don(kq, tham_so, boi_canh):
    c = kq["chi_so"]
    return (
        f"{_nhan_khoang(kq)} nhà hàng có **{nguyen(c['so_don'])} đơn**, "
        f"bán ra {nguyen(c['so_mon'])} phần món."
    )


def _tl_luot_khach(kq, tham_so, boi_canh):
    c = kq["chi_so"]
    tb = c["so_khach"] / max(len(kq["bieu_do"]["nhan"]), 1)
    return (
        f"{_nhan_khoang(kq)} nhà hàng đón **{nguyen(c['so_khach'])} lượt khách** "
        f"qua {nguyen(c['so_don'])} đơn, trung bình {tb:.0f} khách/ngày."
    )




def _tl_top_mon(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if not b:
        return f"Không có dữ liệu bán hàng trong {_nhan_khoang(kq)}."
    dau = b[0]
    return (
        f"Top món bán chạy {_nhan_khoang(kq)} — dẫn đầu là "
        f"**{dau['name_mon']}** với {nguyen(dau['so_luong'])} phần bán ra."
    )


def _tl_mon_ban_cham(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if not b:
        return "Không có dữ liệu để xếp hạng."
    return (
        f"Các món bán chậm nhất {_nhan_khoang(kq)}. Món kém nhất là "
        f"**{b[0]['name_mon']}** ({nguyen(b[0]['so_luong'])} phần).\n\n"
        f"_Gợi ý quản trị: cân nhắc đưa vào combo, đổi cách bày trí, "
        f"hoặc rút khỏi thực đơn nếu vẫn không cải thiện._"
    )






def _tl_hieu_suat_bep(kq, tham_so, boi_canh):
    tb = (kq.get("chi_so") or {}).get("phut_tb_toan_bep", 0)
    b = kq.get("bang") or []
    cham = f" Món lâu nhất là **{b[0]['name_mon']}** ({b[0]['phut_tb']} phút)." if b else ""
    return (
        f"Thời gian chế biến trung bình toàn bếp {_nhan_khoang(kq)} là "
        f"**{tb} phút/món**.{cham}"
    )


def _tl_gio_cao_diem(kq, tham_so, boi_canh):
    gio = kq.get("theo_gio") or []
    thu = kq.get("theo_thu") or []
    if not gio:
        return f"Không có dữ liệu theo khung giờ trong {_nhan_khoang(kq)}."
    dinh = max(gio, key=lambda r: float(r["so_don"] or 0))
    cau = (f"Khung giờ cao điểm {_nhan_khoang(kq)} là **{int(dinh['gio'])}h** "
           f"({nguyen(dinh['so_don'])} đơn).")
    if thu:
        dinh_thu = max(thu, key=lambda r: float(r["so_don"] or 0))
        cau += f" Ngày đông nhất trong tuần là **{dinh_thu['ten_thu']}**."
    return cau


def _tl_ty_le_huy(kq, tham_so, boi_canh):
    c = kq["chi_so"]
    danh_gia = ("Tỷ lệ này ở mức chấp nhận được." if c["ty_le_huy"] < 10
                else "**Tỷ lệ này khá cao**, nên xem lại khâu xác nhận đặt bàn.")
    return (
        f"{_nhan_khoang(kq)} có **{nguyen(c['don_huy'])}/{nguyen(c['tong_don'])} đơn bị hủy** "
        f"— tỷ lệ **{phan_tram(c['ty_le_huy'])}**. {danh_gia}"
    )


def _tl_ban_trong(kq, tham_so, boi_canh):
    c = kq["chi_so"]
    return (
        f"Hiện có **{nguyen(c['ban_trong'])}/{nguyen(c['tong_ban'])} bàn trống** "
        f"— tỷ lệ lấp đầy {phan_tram(c['ty_le_lap_day'])}."
    )


def _tl_don_dang_cho(kq, tham_so, boi_canh):
    tong = (kq.get("chi_so") or {}).get("tong_mon_cho", 0)
    if not tong:
        return "Bếp đang trống — **không còn món nào chờ xử lý**."
    b = kq.get("bang") or []
    lau = max((float(r["cho_lau_nhat_phut"] or 0) for r in b), default=0)
    return (f"Bếp đang có **{nguyen(tong)} món** chưa phục vụ xong. "
            f"Món chờ lâu nhất đã **{lau:.0f} phút**.")


def _tl_du_bao(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    dg = kq.get("danh_gia") or []
    if not b:
        return ("Chưa có kết quả dự báo nào được lưu. Bạn vào trang **/du-bao** "
                "và bấm _Chạy lại dự báo_ để mô hình huấn luyện lần đầu.")
    d = b[0]
    cau = (f"Dự báo lượt khách ngày **{d['ngay']}**: **{float(d['so_khach_du_bao']):.0f} khách** "
           f"(khoảng {float(d['can_duoi']):.0f}–{float(d['can_tren']):.0f}), "
           f"mô hình `{d.get('mo_hinh', '?')}`.")
    if dg:
        m = dg[0]
        cau += (f"\n\nMô hình tốt nhất hiện tại: **{m['mo_hinh']}** — "
                f"MAE {float(m['mae']):.2f}, MAPE {float(m['mape']):.2f}%.")
    cau += "\n\n_Số liệu đọc từ kết quả dự báo đã lưu, không huấn luyện lại lúc này._"
    return cau


def _tl_thuc_don(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if kq.get("loc_theo"):
        if not b:
            return f"Hiện nhà hàng chưa có món nào thuộc **{kq['loc_theo']}**."
        return f"Nhà hàng có **{len(b)} món** thuộc **{kq['loc_theo']}**:"
    return f"Thực đơn hiện có **{len(b)} món** đang phục vụ:"


def _tl_gia_mon(kq, tham_so, boi_canh):
    if kq.get("thieu_tham_so"):
        return ("Bạn muốn hỏi giá món nào ạ? Bạn nhắn tên món giúp mình, "
                "ví dụ: _giá gà nướng bao nhiêu_.")
    m = kq.get("mon")
    if not m:
        return "Mình chưa tìm thấy món đó trong thực đơn. Bạn kiểm tra lại tên món nhé."
    ghi_chu = f"\n\n_{m['ghichu_mon']}_" if (m.get("ghichu_mon") or "").strip() else ""
    return (f"**{m['name_mon']}** ({m['name_loai']}) có giá **{tien(m['gia_mon'])}**"
            f"{ghi_chu}")


def _tl_mon_ban_chay(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if not b:
        return "Hiện chưa có đủ dữ liệu để xếp hạng món."
    return (f"Món được khách gọi nhiều nhất là **{b[0]['name_mon']}** "
            f"({tien(b[0]['gia_mon'])}). Dưới đây là những món ăn khách nhất:")


def _tl_mon_theo_gia(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    ng = kq.get("nguong_gia")
    if not b:
        return "Không có món nào trong khoảng giá đó ạ."
    if not ng:
        return "Đây là những món có giá dễ chịu nhất trong thực đơn:"
    huong = "từ" if ng["huong"] == "tren" else "dưới"
    return f"Có **{len(b)} món** {huong} **{tien(ng['gia'])}**:"


def _tl_goi_y_mon(kq, tham_so, boi_canh):
    goc = kq.get("mon_goc")
    b = kq.get("bang") or []
    if not goc:
        return _tl_mon_ban_chay(kq, tham_so, boi_canh)
    if not b:
        return (f"Mình chưa tìm được món đi kèm phổ biến với **{goc['name_mon']}**. "
                f"Bạn tham khảo các món bán chạy nhé.")
    d = b[0]
    return (
        f"Khách gọi **{goc['name_mon']}** thường gọi thêm **{d['name_mon']}** "
        f"({tien(d['gia_mon'])}) — {float(d['do_tin_cay']) * 100:.0f}% các đơn có "
        f"{goc['name_mon']} đều có món này.\n\n"
        f"_Gợi ý dựa trên luật kết hợp khai phá từ lịch sử đơn hàng (Apriori)._"
    )


def _tl_combo(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if not b:
        return ("Hiện nhà hàng chưa mở bán combo. Bạn xem thực đơn lẻ hoặc để mình "
                "gợi ý món theo nhóm khách nhé.")
    sn = kq.get("so_nguoi")
    them = f" Nhóm **{sn} người** thì bạn tham khảo các combo dưới đây:" if sn else ""
    return f"Nhà hàng có **{len(b)} combo** đang bán.{them}"


def _tl_khuyen_mai(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if not b:
        return ("Hiện **chưa có chương trình khuyến mãi** nào đang chạy. "
                "Bạn theo dõi trang chủ để cập nhật ưu đãi mới nhé!")
    return f"Đang có **{len(b)} ưu đãi** áp dụng được:"


def _tl_do_uong(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if not b:
        return "Bạn nhắn nhân viên để xem danh sách đồ uống chi tiết giúp mình nhé."
    return f"Nhà hàng có **{len(b)} loại đồ uống**:"


def _tl_mon_chay(kq, tham_so, boi_canh):
    b = kq.get("bang") or []
    if not b:
        return ("Thực đơn hiện chưa có món chay riêng. Bạn nhắn nhân viên để bếp "
                "điều chỉnh món theo yêu cầu nhé.")
    return (f"Mình tìm được **{len(b)} món** phù hợp cho người ăn chay/ăn nhẹ.\n\n"
            f"_Nếu bạn bị dị ứng, vui lòng xác nhận lại với nhân viên trước khi gọi "
            f"— danh sách này lọc theo tên món nên chưa thay được kiểm tra trực tiếp._")


def _tl_trang_thai_don(kq, tham_so, boi_canh):
    if kq.get("can_dang_nhap"):
        return ("Bạn cần **đăng nhập** để mình tra đơn giúp bạn. "
                "Bạn đăng nhập rồi hỏi lại nhé.")
    b = kq.get("bang") or []
    if not b:
        return "Bạn chưa có đơn nào trong hệ thống."
    d = b[0]
    return (f"Đơn gần nhất của bạn ngày **{d['ngay_dat']}**: {nguyen(d['so_mon'])} món, "
            f"tổng {tien(d['tong_tien'])} — trạng thái **{d['ten_trang_thai']}**.")


def _tl_diem_tich_luy(kq, tham_so, boi_canh):
    if kq.get("can_dang_nhap"):
        return "Bạn cần **đăng nhập** để mình xem điểm tích lũy giúp bạn nhé."
    if kq.get("chua_co_du_lieu"):
        return "Phân hệ tích điểm chưa được kích hoạt trên hệ thống này."
    return f"Bạn đang có **{nguyen(kq['chi_so']['tong_diem'])} điểm** tích lũy."


BO_SINH = {
    "hoi_so_don": _tl_so_don,
    "hoi_luot_khach": _tl_luot_khach,
    "hoi_top_mon": _tl_top_mon,
    "hoi_mon_ban_cham": _tl_mon_ban_cham,
    "hoi_hieu_suat_bep": _tl_hieu_suat_bep,
    "hoi_gio_cao_diem": _tl_gio_cao_diem,
    "hoi_ty_le_huy": _tl_ty_le_huy,
    "hoi_ban_trong": _tl_ban_trong,
    "hoi_don_dang_cho": _tl_don_dang_cho,
    "hoi_du_bao": _tl_du_bao,
    "hoi_thuc_don": _tl_thuc_don,
    "hoi_mon_theo_loai": _tl_thuc_don,
    "hoi_gia_mon": _tl_gia_mon,
    "hoi_mon_ban_chay": _tl_mon_ban_chay,
    "hoi_mon_theo_gia": _tl_mon_theo_gia,
    "goi_y_mon": _tl_goi_y_mon,
    "hoi_combo": _tl_combo,
    "hoi_khuyen_mai": _tl_khuyen_mai,
    "hoi_do_uong": _tl_do_uong,
    "hoi_mon_chay": _tl_mon_chay,
    "hoi_trang_thai_don": _tl_trang_thai_don,
    "hoi_diem_tich_luy": _tl_diem_tich_luy,
}


# --------------------------------------------------------------------------
# Cau goi y tiep theo - giup nguoi dung kham pha nang luc cua bot
# --------------------------------------------------------------------------
GOI_Y_TIEP = {
    "khach": [
        "Quán có món gì ngon?", "Có khuyến mãi nào không?",
        "Đặt bàn cho 4 người", "Giá gà nướng bao nhiêu?",
        "Có nhận giao hàng không?", "Quán mở cửa mấy giờ?",
    ],
    # Khong con cau nao ve doanh thu, loi nhuan hay ton kho: cac y dinh do da
    # bi go khoi bot. Goi y mot cau bot khong tra loi duoc chi lam nguoi dung
    # tuong he thong hong.
    "quan_ly": [
        "Hôm nay có bao nhiêu đơn?", "Top 10 món bán chạy tháng này",
        "Khung giờ nào đông khách nhất?", "Dự báo khách ngày mai",
        "Còn mấy bàn trống?", "Bếp đang tồn mấy món chưa làm?",
        "Tỷ lệ hủy đơn tháng này?", "Món nào bán chậm nhất?",
    ],
}


def _goi_y(boi_canh: dict, so_luong: int = 3) -> list[str]:
    nguon = GOI_Y_TIEP["quan_ly" if boi_canh.get("quyen") == "quan_ly" else "khach"]
    return random.sample(nguon, min(so_luong, len(nguon)))


# --------------------------------------------------------------------------
# Cau tra loi khi bot KHONG HIEU
#
# Day la cau duoc noi ra nhieu nhat trong thuc te. Mot bo phan loai 36 nhan se
# gap vo so cau nam ngoai 36 nhan do - khach hoi "mon nay co cay khong", "cho
# be an duoc khong", "hom qua minh de quen cai ao o quan" - toan nhung viec chi
# NGUOI that moi tra loi duoc.
#
# Ban truoc chi noi "minh chua hieu y ban" roi liet ke lai nang luc cua bot. Voi
# nguoi dang can mot cau tra loi cu the thi do la ngo cut: ho hoi lai lan hai,
# van khong hieu, roi thoi.
#
# Nay moi ngo cut deu duoc dan ve NGUOI THAT, va loi moi khac nhau tuy nguoi
# dang hoi la ai:
#   - Chua dang nhap -> phai dang ky/dang nhap truoc, vi khung chat voi nhan
#     vien (/chat) can danh tinh de nhan vien biet dang tra loi ai va de luu
#     lich su hoi thoai.
#   - Da dang nhap  -> chi thang toi muc Chat, khong bat lam gi them.
# --------------------------------------------------------------------------
def _khong_hieu(boi_canh: dict, goi_y: list[str], du_doan: dict | None = None) -> dict:
    da_dang_nhap = bool(boi_canh.get("id_kh") or boi_canh.get("id_nv"))

    van_ban = ("Câu này mình chưa trả lời được. Mình chỉ giúp được mấy việc quanh "
               "nhà hàng thôi: thực đơn, giá món, đặt bàn, khuyến mãi, giao hàng…\n\n")
    if da_dang_nhap:
        van_ban += ("Bạn vào **mục Chat** trên thanh menu để nhắn trực tiếp với "
                    "nhân viên nhé — nhân viên trả lời được những câu như thế này.")
    else:
        van_ban += ("Bạn **đăng ký** hoặc **đăng nhập** vào website rồi vào **mục Chat** "
                    "để hỏi trực tiếp nhân viên nhé — nhân viên sẽ trả lời cụ thể "
                    "hơn mình nhiều.")

    # Y dinh gan dung chi goi y khi mo hinh CO cho diem, va noi nhe thoi: cau
    # chinh phai la loi moi gap nhan vien, khong phai mot danh sach doan mo.
    #
    # LOC THEO QUYEN. Khong loc thi khach vang lai hoi mot cau bat ky co the
    # nhan lai "Hay y ban la: So luot khach?" - vua quang cao mot nang luc ho
    # khong dung duoc, vua he lo rang bot co tra duoc so lieu noi bo. Bam vao
    # thi chi nhan duoc cau tu choi quyen.
    la_quan_ly = boi_canh.get("quyen") == "quan_ly"
    ung_vien = [u for u in (du_doan or {}).get("top", [])[:3]
                if u.get("y_dinh") in yd.Y_DINH
                and (la_quan_ly or yd.Y_DINH[u["y_dinh"]]["nhom"] != "quan_ly")][:2]
    if ung_vien:
        van_ban += "\n\n_Hay ý bạn là: " + \
                   ", ".join(yd.Y_DINH[u["y_dinh"]]["mo_ta"] for u in ung_vien) + "?_"

    return {
        "van_ban": van_ban,
        "goi_y": goi_y,
        "khong_hieu": True,
        # Co nay bat khung chat hien them loi nhac o phia giao dien.
        "chuyen_nhan_vien": True,
        "can_dang_nhap": not da_dang_nhap,
    }


# --------------------------------------------------------------------------
def sinh(y_dinh_ma: str, ket_qua: dict, tham_so: dict, boi_canh: dict,
         du_doan: dict | None = None) -> dict:
    """Bien ket qua truy van thanh cau tra loi hoan chinh."""
    goi_y = _goi_y(boi_canh)

    # --- Cac truong hop dac biet, xet truoc ---
    if y_dinh_ma == "khong_hieu":
        return _khong_hieu(boi_canh, goi_y, du_doan)

    if ket_qua.get("tu_choi_quyen"):
        return {
            "van_ban": ("Câu hỏi này thuộc **số liệu kinh doanh nội bộ**, chỉ tài khoản "
                        "quản lý mới xem được. Bạn đăng nhập bằng tài khoản quản lý "
                        "rồi hỏi lại giúp mình nhé."),
            "goi_y": _goi_y({"quyen": "khach"}),
            "tu_choi_quyen": True,
        }

    if ket_qua.get("loi"):
        return {
            "van_ban": ("Mình gặp trục trặc khi lấy dữ liệu cho câu hỏi này. "
                        "Bạn thử lại sau ít phút, hoặc nhắn nhân viên hỗ trợ nhé."),
            "goi_y": goi_y, "loi": True,
        }

    if ket_qua.get("chua_ho_tro"):
        return {"van_ban": "Tính năng này đang được hoàn thiện. Bạn thử câu hỏi khác nhé.",
                "goi_y": goi_y}

    if ket_qua.get("tinh"):
        return {"van_ban": ket_qua["van_ban"], "goi_y": goi_y,
                "chuyen_nhan_vien": ket_qua.get("chuyen_nhan_vien", False)}

    # --- Truong hop chung ---
    ham = BO_SINH.get(y_dinh_ma)
    if ham is None:
        return {"van_ban": "Mình chưa xử lý được câu hỏi này.", "goi_y": goi_y}

    try:
        van_ban = ham(ket_qua, tham_so, boi_canh)
    except Exception:
        van_ban = "Mình lấy được dữ liệu nhưng chưa diễn giải được. Bạn xem bảng bên dưới nhé."

    return {
        "van_ban": van_ban,
        "bang": ket_qua.get("bang"),
        "cot": [{"khoa": k, "nhan": n} for k, n in (ket_qua.get("cot") or [])],
        "bieu_do": ket_qua.get("bieu_do"),
        "chi_so": ket_qua.get("chi_so"),
        "khoang": ket_qua.get("khoang"),
        "goi_y": goi_y,
    }

"""Tang 2a - Bo tu dien Y DINH va trinh sinh du lieu huan luyen.

Day la "bo du lieu tu xay" cua khoa luan. He thong khong dung bat ky bo du lieu
hoi dap tieng Viet co san nao, vi khong bo nao chua cac y dinh dac thu cua mot
nha hang (hoi ton kho, hoi lo sap het han, hoi hieu suat bep...).

CACH SINH DU LIEU
-----------------
Moi y dinh duoc mo ta bang mot so MAU CAU. Mau cau dung hai ky phap:

    {a|b|c}   chon mot trong cac phuong an   -> no ra 3 cau
    [x]       thanh phan tuy chon            -> no ra 2 cau (co x / khong x)
    <tg>      cho trong (slot) se duoc thay bang gia tri mau

Nho vay mot mau cau ngan sinh ra hang chuc bien the thuc te ma van doc duoc.

DIEM PHUONG PHAP QUAN TRONG NHAT
--------------------------------
Neu chia train/test NGAU NHIEN tren tap cau da sinh, hai cau sinh tu CUNG mot
mau se roi vao ca hai ben -> mo hinh gan nhu "da thay truoc" cau kiem thu, cho
do chinh xac ao ~99%. Day chinh la loi "ro ri du lieu" ma phan du bao chuoi
thoi gian cua he thong da tranh bang cach chia theo moc thoi gian.

Vi vay ham `sinh_du_lieu` tra ve them cot `ma_mau`, va `phan_loai.py` chia tap
theo NHOM MAU CAU (GroupShuffleSplit): toan bo cau sinh tu mot mau chi nam o
mot ben. Con so bao cao vi vay thap hon nhung TRUNG THUC - no do kha nang tong
quat hoa sang cach dien dat chua tung thay.

Ngoai ra `BO_KIEM_THU_TAY` la tap cau do nguoi tu viet tay, khong theo mau nao,
dung lam thuoc do cuoi cung.
"""
from __future__ import annotations

import itertools
import random
import re

# Seed co dinh - trung quy uoc voi bo sinh du lieu lich su (migration 003) nen
# moi lan chay lai cho ra dung bo du lieu cu, so lieu trong bao cao tai lap duoc.
SEED = 20260804

# --------------------------------------------------------------------------
# Gia tri mau dien vao cho trong. Chi can da dang vua du de mo hinh khong hoc
# thuoc mot gia tri cu the; viec nhan dien chinh xac thuc the la nhiem vu cua
# tang 3 (thuc_the.py), khong phai cua bo phan loai.
# --------------------------------------------------------------------------
GIA_TRI_SLOT: dict[str, list[str]] = {
    "tg": [
        "hôm nay", "hôm qua", "tuần này", "tuần trước", "tháng này",
        "tháng trước", "7 ngày qua", "30 ngày qua", "năm nay", "tháng 3",
        "quý này", "cuối tuần rồi",
    ],
    "mon": [
        "gà nướng", "bò lagu", "heo lên mẹt", "cơm chiên Lộc Phát", "chả giò",
        "khai vị ba món", "hủ tiếu áp chảo", "đậu hủ tứ xuyên", "gà gỏi",
        "bò nướng đá",
    ],
    "nl": [
        "thịt bò", "thịt heo", "rau xà lách", "bia Tiger", "gạo", "hành tây",
        "tôm", "nấm",
    ],
    "loai": [
        "khai vị", "món bò", "món gà", "món heo", "tráng miệng", "đồ uống",
        "cơm", "lẩu",
    ],
    "so": ["2", "4", "6", "8", "10", "hai", "bốn", "sáu"],
    "gia": ["100k", "200 nghìn", "150000", "300k", "50 nghìn"],
}

# --------------------------------------------------------------------------
# BO TU DIEN Y DINH
#
# nhom: "chung"   - ai cung hoi duoc, khong cham vao du lieu kinh doanh
#       "khach"   - dan cho khach hang, cong khai
#       "quan_ly" - CHI tra loi khi nguoi hoi da dang nhap quyen quan ly.
#                   Viec chan nam o tang truy van (truy_van.py) chu khong phai
#                   o mo hinh - mo hinh chi nhan dang, khong phan quyen.
# --------------------------------------------------------------------------
Y_DINH: dict[str, dict] = {
    # ===================== NHOM CHUNG =====================
    "chao_hoi": {
        "nhom": "chung",
        "mo_ta": "Chào hỏi mở đầu",
        "mau": [
            "{chào|xin chào|chào bạn|chào shop|hello|hi|alo}",
            "{chào|xin chào} {buổi sáng|buổi tối|nhà hàng|anh chị}",
            "{có ai|nhà hàng có ai} {ở đó|ở đây|trực} không",
            "{alo|ê|này} {ơi|}",
            "{em|mình|tôi} {chào|xin chào} {ạ|nhé|}",
            "hey {bot|trợ lý|}",
            "{cho|} {hỏi|hỏi chút|hỏi tí} {được không|nhé|với}",
            "{bạn|em} {giúp|hỗ trợ} {tôi|mình} {được không|với|chút}",
        ],
    },
    "tam_biet": {
        "nhom": "chung",
        "mo_ta": "Kết thúc hội thoại",
        "mau": [
            "{tạm biệt|bye|bai|goodbye|chào nhé}",
            "{thôi|ok} {nhé|vậy} {tạm biệt|bye|}",
            "{mình|tôi|em} {đi|nghỉ|off} {đây|nhé} {nhé|}",
            "{hẹn gặp lại|gặp lại sau|lần sau nói tiếp}",
            "{không|khỏi} {hỏi gì nữa|cần gì nữa} {đâu|nhé|}",
            "{đủ rồi|xong rồi|vậy thôi} {nhé|cảm ơn|}",
            "{kết thúc|dừng} {hội thoại|ở đây} {nhé|}",
            "bye bye {nhé|shop|}",
        ],
    },
    "cam_on": {
        "nhom": "chung",
        "mo_ta": "Cảm ơn",
        "mau": [
            "{cảm ơn|cám ơn|thank you|thanks|tks} {nhé|bạn|shop|nhiều|ạ|}",
            "{ok|oke} {cảm ơn|cám ơn} {nhé|}",
            "{tuyệt|hay|giỏi|good} {quá|lắm|} {cảm ơn|}",
            "{hữu ích|có ích|rõ rồi} {lắm|quá|} {cảm ơn|}",
            "{mình|tôi|em} {hiểu rồi|rõ rồi|biết rồi} {cảm ơn|}",
            "{cảm ơn|cám ơn} {vì|đã} {đã giúp|hỗ trợ|trả lời}",
            "{thanks|tks} {nha|nhé|bạn}",
            "{đúng cái|đúng thứ} {mình|tôi} {cần|tìm}",
        ],
    },
    "hoi_bot_la_ai": {
        "nhom": "chung",
        "mo_ta": "Hỏi về năng lực của trợ lý",
        "mau": [
            "{bạn|em|mày} là {ai|gì|con gì}",
            "{bạn|em} {làm được|giúp được|trả lời được} {những gì|gì|cái gì}",
            "{đây là|kia là} {bot|robot|người thật} {à|hả|phải không}",
            "{tôi|mình} {hỏi được|có thể hỏi} {những gì|cái gì|gì}",
            "{bạn|em} {biết|nắm} {những gì|cái gì}",
            "{hướng dẫn|chỉ|nói} {cách|} {dùng|sử dụng} {chatbot|trợ lý|bot}",
            "{giúp|help|trợ giúp}",
            "{có|} {chức năng|tính năng} {gì|nào} {vậy|không|}",
        ],
    },
    "gap_nhan_vien": {
        "nhom": "chung",
        "mo_ta": "Yêu cầu chuyển sang nhân viên thật",
        "mau": [
            "{cho|} {tôi|mình|em} {gặp|nói chuyện với} {nhân viên|người thật|nhân viên tư vấn}",
            "{gọi|kêu} {nhân viên|quản lý|người} {ra|giúp|đi}",
            "{bot|máy} {không hiểu|trả lời sai|dở quá} {cho gặp người|gặp nhân viên|}",
            "{tôi|mình} {muốn|cần} {nói chuyện|trao đổi} {với người thật|trực tiếp}",
            "{chuyển|nối máy} {cho|sang} {nhân viên|tổng đài|quản lý}",
            "{có|} {người thật|nhân viên} {nào|} {trực|online} {không|}",
            "{cần|muốn} {hỗ trợ|tư vấn} {trực tiếp|từ nhân viên}",
            "{nói chuyện|chat} {với người|với nhân viên} {đi|được không}",
        ],
    },

    # ===================== NHOM KHACH HANG =====================
    "hoi_gio_mo_cua": {
        "nhom": "khach",
        "mo_ta": "Hỏi giờ mở cửa / đóng cửa",
        "mau": [
            "{nhà hàng|quán|shop} {mở cửa|làm việc} {mấy giờ|lúc nào|khi nào}",
            "{mấy giờ|khi nào} {thì|} {đóng cửa|nghỉ|hết giờ}",
            "{giờ|thời gian} {mở cửa|hoạt động|làm việc} {thế nào|ra sao|là gì}",
            "{quán|nhà hàng} {còn|có} {mở|bán} {không|nữa không}",
            "{hôm nay|chủ nhật|cuối tuần|lễ} {có|} {mở cửa|bán} {không|}",
            "{bây giờ|giờ này} {qua|đến|ghé} {được|ăn được} {không|chứ}",
            "{mở|bán} {tới|đến} {mấy giờ|khi nào}",
            "{giờ giấc|thời gian} {phục vụ|mở cửa} {sao|thế nào}",
        ],
    },
    "hoi_dia_chi": {
        "nhom": "khach",
        "mo_ta": "Hỏi địa chỉ, đường đi, chỗ đậu xe",
        "mau": [
            "{nhà hàng|quán|shop} {ở đâu|nằm ở đâu|địa chỉ ở đâu}",
            "{cho|} {xin|hỏi} {địa chỉ|chỗ|vị trí} {nhà hàng|quán|với}",
            "{đường đi|chỉ đường|cách đi} {tới|đến} {quán|nhà hàng} {thế nào|sao}",
            "{quán|nhà hàng} {ở|tại} {quận mấy|đường nào|khu nào}",
            "{có|} {chỗ|bãi} {đậu xe|gửi xe|để xe} {không|chứ|}",
            "{gần|cạnh} {đây|chỗ tôi} {có|} {chi nhánh|cơ sở} {nào không|không}",
            "{định vị|bản đồ|google map} {nhà hàng|quán} {đâu|có không}",
            "{tìm|kiếm} {quán|nhà hàng} {kiểu gì|thế nào}",
        ],
    },
    "hoi_lien_he": {
        "nhom": "khach",
        "mo_ta": "Hỏi số điện thoại, email liên hệ",
        "mau": [
            "{số|sđt|số điện thoại} {nhà hàng|quán|liên hệ} {là gì|bao nhiêu|đâu}",
            "{cho|} {xin|hỏi} {số điện thoại|hotline|số liên lạc}",
            "{gọi|liên hệ} {cho|tới} {quán|nhà hàng} {số nào|kiểu gì|thế nào}",
            "{email|mail|fanpage} {của|} {nhà hàng|quán} {là gì|đâu}",
            "{có|} {zalo|facebook|fanpage} {không|chứ}",
            "{muốn|cần} {liên hệ|liên lạc} {thì|} {làm sao|gọi đâu}",
            "{hotline|đường dây nóng} {số mấy|bao nhiêu}",
            "{liên hệ|contact} {bằng cách nào|kiểu gì}",
        ],
    },
    "hoi_thuc_don": {
        "nhom": "khach",
        "mo_ta": "Xem toàn bộ thực đơn",
        "mau": [
            "{cho|} {xem|coi} {thực đơn|menu|danh sách món}",
            "{quán|nhà hàng} {có|bán} {những món|món} {gì|nào}",
            "{thực đơn|menu} {gồm|có} {những gì|gì}",
            "{liệt kê|kể} {các món|những món|món ăn} {đi|giúp tôi|ra}",
            "{có|bán} {bao nhiêu|mấy} {món|loại món}",
            "{gửi|cho} {tôi|mình} {menu|thực đơn} {với|đi|nhé}",
            "{món ăn|đồ ăn} {ở đây|của quán} {gồm gì|có gì}",
            "{xem|coi} {toàn bộ|tất cả} {món|thực đơn}",
        ],
    },
    "hoi_gia_mon": {
        "nhom": "khach",
        "mo_ta": "Hỏi giá một món cụ thể",
        "mau": [
            "<mon> {giá|bao nhiêu tiền|giá bao nhiêu} {bao nhiêu|thế nào|}",
            "{giá|đơn giá} {của|món|} <mon> {là bao nhiêu|thế nào|}",
            "{cho|} {hỏi|xin} {giá|giá tiền} <mon>",
            "<mon> {mắc|đắt|rẻ} {không|hay không}",
            "{một|1|một phần|một đĩa} <mon> {bao nhiêu|giá bao nhiêu|mấy tiền}",
            "{bán|tính} <mon> {giá nào|bao nhiêu một phần}",
            "{giá|tiền} <mon> {ạ|vậy|nhỉ}",
            "<mon> {nhiêu|bi nhiêu|bnhieu}",
        ],
    },
    "hoi_mon_theo_loai": {
        "nhom": "khach",
        "mo_ta": "Xem món theo danh mục",
        "mau": [
            "{có|bán} {những|} <loai> {gì|nào}",
            "{cho|} {xem|coi} {các món|danh sách} <loai>",
            "<loai> {có|gồm} {những món nào|món gì}",
            "{liệt kê|kể} <loai> {đi|giúp mình|ra}",
            "{muốn|thích} {ăn|gọi} <loai> {thì có gì|có món nào}",
            "{phần|mục|danh mục} <loai> {có gì|gồm gì}",
            "{gợi ý|giới thiệu} <loai> {đi|với}",
            "{quán|nhà hàng} {có|làm} <loai> {không|chứ}",
        ],
    },
    "hoi_mon_ban_chay": {
        "nhom": "khach",
        "mo_ta": "Hỏi món bán chạy, món nổi bật",
        "mau": [
            "{món|} {bán chạy|đắt khách|nổi tiếng|được ưa chuộng} {nhất|} {là gì|nào}",
            "{món|đồ} {ngon|đặc sản|tủ|signature} {nhất|của quán|} {là gì|nào}",
            "{nên|} {gọi|ăn|thử} {món gì|gì} {ngon|ở đây|}",
            "{top|những} {món|} {được gọi nhiều nhất|hot nhất|bán chạy nhất}",
            "{khách|mọi người} {hay|thường} {gọi|ăn} {món gì|gì}",
            "{món|đồ} {nào|gì} {đáng thử|nên thử|phải thử} {nhất|}",
            "{đặc sản|món tủ|best seller} {của quán|ở đây} {là gì|gồm gì}",
            "{giới thiệu|gợi ý} {món|} {ngon|hot|nổi bật} {đi|với|nhé}",
            # Cach hoi pho bien nhat cua khach, truoc day roi vao "khong hieu"
            # vi chua co mau nao ghep "quan/nha hang" + "co" + "gi ngon".
            "{quán|nhà hàng|ở đây|bên mình|chỗ này} {có|} {món|đồ} {gì|nào} {ngon|hay|đặc sắc|hấp dẫn}",
            "{có|} {món|đồ} {gì|nào} {ngon|hay|đặc biệt} {không|ko|k|hong}",
        ],
    },
    "hoi_mon_theo_gia": {
        "nhom": "khach",
        "mo_ta": "Lọc món theo khoảng giá",
        "mau": [
            "{có|} {món|đồ} {nào|gì} {dưới|rẻ hơn|ít hơn} <gia> {không|}",
            "{món|đồ ăn} {rẻ|bình dân|giá mềm} {nhất|} {là gì|có gì}",
            "{tầm|khoảng|trong khoảng} <gia> {thì|} {ăn được gì|có món nào|gọi gì}",
            "{gợi ý|cho} {món|} {trong tầm|dưới} <gia>",
            "{túi tiền|ngân sách} <gia> {ăn được gì|gọi gì được}",
            "{món|đồ} {mắc nhất|đắt nhất} {là gì|bao nhiêu}",
            "{có|} {món|} {nào|} {trên|hơn} <gia> {không|}",
            "{sắp xếp|xem} {món|} {theo giá|từ rẻ đến đắt}",
        ],
    },
    "goi_y_mon": {
        "nhom": "khach",
        "mo_ta": "Xin gợi ý món ăn kèm (dùng luật kết hợp Apriori)",
        "mau": [
            "{gọi|ăn|order} <mon> {rồi|} {thì|nên} {gọi thêm gì|ăn kèm gì|thêm món gì}",
            "<mon> {hợp|đi|ăn} {với|kèm} {món nào|gì}",
            "{gợi ý|tư vấn} {món|đồ} {ăn kèm|đi kèm|thêm} {với|cho} <mon>",
            "{nên|} {gọi thêm|thêm|order thêm} {gì|món gì} {nữa|}",
            "{ăn|gọi} <mon> {thì|} {uống|kèm} {gì|món gì} {ngon|hợp|}",
            "{combo|bộ|set} {nào|gì} {hợp với|đi với} <mon>",
            "{tư vấn|gợi ý} {cho|} {tôi|mình} {món|đồ ăn} {đi|với|nhé}",
            "{giỏ hàng|đơn} {của tôi|này} {nên|} {thêm gì|thêm món nào}",
        ],
    },
    "hoi_combo": {
        "nhom": "khach",
        "mo_ta": "Hỏi về combo, set ăn",
        "mau": [
            "{có|bán} {combo|set|phần ăn} {nào|gì} {không|}",
            "{cho|} {xem|coi} {combo|set ăn|các combo}",
            "{combo|set} {gồm|có} {những gì|món gì}",
            "{combo|set} {cho|dành cho} <so> {người|khách} {có không|giá bao nhiêu}",
            "{giá|tiền} {combo|set} {bao nhiêu|thế nào}",
            "{combo|set} {nào|gì} {đáng tiền|hời|ngon} {nhất|}",
            "{đi|nhóm} <so> {người|} {nên|thì} {gọi combo nào|lấy set nào}",
            "{có|} {ưu đãi|giảm giá} {khi|nếu} {mua combo|lấy set} {không|}",
        ],
    },
    "hoi_khuyen_mai": {
        "nhom": "khach",
        "mo_ta": "Hỏi khuyến mãi, giảm giá đang chạy",
        "mau": [
            "{có|đang có} {khuyến mãi|giảm giá|ưu đãi|km} {gì|nào} {không|}",
            "{chương trình|đợt} {khuyến mãi|ưu đãi} {hiện tại|đang chạy} {là gì|thế nào}",
            "{giảm giá|sale} {bao nhiêu|mấy phần trăm} {vậy|}",
            "{có|} {mã|voucher|coupon} {giảm giá|khuyến mãi} {nào không|không}",
            "{ưu đãi|khuyến mãi} {cho|dành cho} {khách mới|thành viên} {là gì|có không}",
            "{hôm nay|cuối tuần|dịp này} {có|} {giảm giá|sale|ưu đãi} {gì không|không}",
            "{làm sao|cách nào} {để|} {được|có} {giảm giá|ưu đãi}",
            "{deal|khuyến mại} {hot|mới} {nhất|} {là gì|gồm gì}",
        ],
    },
    "dat_ban": {
        "nhom": "khach",
        "mo_ta": "Đặt bàn / hỏi cách đặt bàn",
        "mau": [
            "{tôi|mình|em} {muốn|cần} {đặt|book} {bàn|chỗ} {cho|} <so> {người|khách}",
            "{đặt|book} {bàn|chỗ} {thế nào|kiểu gì|làm sao}",
            "{còn|có} {bàn|chỗ} {trống|nào} {không|tối nay không}",
            "{đặt bàn|book bàn} {trước|} {được không|có được không}",
            "{cho|} {đặt|giữ} {bàn|chỗ} <so> {người|khách} {tối nay|cuối tuần|}",
            "{muốn|cần} {đặt|thuê} {phòng|bàn} {vip|riêng} {không|có không|}",
            "{đặt bàn|book} {online|qua mạng|trên web} {được không|kiểu gì}",
            "{giữ chỗ|đặt trước} {giúp|cho} {tôi|mình} {với|nhé}",
        ],
    },
    "hoi_trang_thai_don": {
        "nhom": "khach",
        "mo_ta": "Hỏi tình trạng đơn hàng của mình",
        "mau": [
            "{đơn|order} {của tôi|của mình} {tới đâu rồi|sao rồi|thế nào rồi}",
            "{kiểm tra|xem|tra} {đơn hàng|đơn|order} {giúp|của tôi|}",
            "{món|đồ ăn} {của tôi|của mình} {xong chưa|làm xong chưa|ra chưa}",
            "{bao lâu|mấy phút} {nữa|} {thì|} {có món|ra món|xong}",
            "{đơn|đặt bàn} {của tôi|hôm nay} {được xác nhận chưa|duyệt chưa}",
            "{tình trạng|trạng thái} {đơn hàng|đơn đặt} {thế nào|ra sao}",
            "{lịch sử|các} {đơn|đơn hàng} {của tôi|đã đặt} {đâu|xem ở đâu}",
            "{tôi|mình} {đã đặt|đặt} {gì|những gì} {rồi|}",
        ],
    },
    "huy_don": {
        "nhom": "khach",
        "mo_ta": "Hủy hoặc đổi đơn / đặt bàn",
        "mau": [
            "{tôi|mình} {muốn|cần} {hủy|bỏ} {đơn|đặt bàn|order}",
            "{hủy|cancel} {đơn|bàn} {thế nào|kiểu gì|được không}",
            "{đổi|dời} {giờ|ngày} {đặt bàn|đơn} {được không|thế nào}",
            "{lỡ|trót} {đặt nhầm|đặt sai} {thì sao|làm sao|sửa kiểu gì}",
            "{hủy|bỏ} {bàn|chỗ} {đã đặt|hôm nay} {có mất phí|có sao không}",
            "{muốn|cần} {sửa|thay đổi} {số người|số khách} {trong đơn|}",
            "{không đến|bận rồi} {thì|} {hủy|báo} {kiểu gì|thế nào}",
            "{cancel|hủy} {giúp|cho} {tôi|mình} {với|nhé}",
        ],
    },
    "hoi_thanh_toan": {
        "nhom": "khach",
        "mo_ta": "Hỏi hình thức thanh toán",
        "mau": [
            "{thanh toán|trả tiền} {bằng|kiểu} {gì|cách nào|hình thức nào}",
            "{có|nhận} {chuyển khoản|quẹt thẻ|thẻ|momo|vietqr} {không|chứ}",
            "{quét|scan} {mã qr|qr} {trả tiền|thanh toán} {được không|kiểu gì}",
            "{trả|thanh toán} {tiền mặt|cash} {được không|có được không}",
            "{có|} {xuất|xuất được} {hóa đơn|vat|hoá đơn đỏ} {không|}",
            "{hình thức|phương thức} {thanh toán|trả tiền} {gồm gì|nào}",
            "{thanh toán|trả} {online|trước|qua mạng} {được không|thế nào}",
            "{nhận|chấp nhận} {thẻ|visa|atm} {không|chứ}",
        ],
    },
    "hoi_giao_hang": {
        "nhom": "khach",
        "mo_ta": "Hỏi giao hàng, mang về",
        "mau": [
            "{có|nhận} {giao hàng|ship|giao tận nơi} {không|chứ}",
            "{phí|tiền} {ship|giao hàng|vận chuyển} {bao nhiêu|thế nào}",
            "{giao|ship} {trong|tới} {bao lâu|mấy phút|khi nào tới}",
            "{có|nhận} {mang về|takeaway|đem về} {không|}",
            "{ship|giao} {tới|đến} {quận|khu vực nào|đâu} {được|}",
            "{đặt|order} {giao hàng|ship} {thế nào|kiểu gì}",
            "{miễn phí|free} {ship|giao hàng} {khi nào|với đơn bao nhiêu}",
            "{giao hàng|ship} {tận nơi|tận nhà} {được không|có không}",
        ],
    },
    "hoi_diem_tich_luy": {
        "nhom": "khach",
        "mo_ta": "Hỏi điểm tích lũy, hạng thành viên",
        "mau": [
            "{tôi|mình} {có|được} {bao nhiêu|mấy} {điểm|điểm tích lũy}",
            "{điểm|point} {tích lũy|thành viên} {của tôi|còn} {bao nhiêu|đâu}",
            "{cách|làm sao} {tích điểm|kiếm điểm|tích lũy điểm}",
            "{đổi|dùng} {điểm|point} {lấy gì|thế nào|được gì}",
            "{hạng|cấp|rank} {thành viên|của tôi} {là gì|thế nào}",
            "{làm sao|cách nào} {lên|đạt} {hạng|thành viên} {vip|cao hơn}",
            "{thẻ|chương trình} {thành viên|khách hàng thân thiết} {có gì|thế nào}",
            "{ưu đãi|quyền lợi} {thành viên|hạng vip} {gồm gì|là gì}",
        ],
    },
    "hoi_dat_coc": {
        "nhom": "khach",
        "mo_ta": "Hỏi về đặt cọc giữ chỗ",
        "mau": [
            "{đặt bàn|giữ chỗ} {có|} {phải|cần} {cọc|đặt cọc} {không|}",
            "{cọc|đặt cọc} {bao nhiêu|mấy tiền|thế nào}",
            "{tiền cọc|cọc} {có|được} {hoàn|trả lại} {không|khi hủy}",
            "{cọc|đặt cọc} {kiểu gì|bằng cách nào|qua đâu}",
            "{không cọc|khỏi cọc} {có|} {đặt bàn được|giữ chỗ được} {không|}",
            "{hủy|bỏ} {rồi|} {thì|} {mất cọc|có mất cọc} {không|à}",
            "{quy định|chính sách} {đặt cọc|cọc} {thế nào|ra sao}",
            "{chuyển|đóng} {cọc|tiền cọc} {vào đâu|tài khoản nào}",
        ],
    },
    "hoi_do_uong": {
        "nhom": "khach",
        "mo_ta": "Hỏi đồ uống, bia rượu",
        "mau": [
            "{có|bán} {đồ uống|nước|thức uống} {gì|nào}",
            "{có|bán} {bia|rượu|nước ngọt} {không|gì}",
            "{bia|nước} {gì|loại nào} {ngon|nên uống}",
            "{giá|tiền} {bia|nước ngọt|đồ uống} {bao nhiêu|thế nào}",
            "{có|} {nước ép|sinh tố|trà|cà phê} {không|gì}",
            "{đồ uống|thức uống} {đi kèm|hợp} {món nướng|lẩu|đồ nhậu} {là gì|nào}",
            "{cho|} {xem|coi} {menu|danh sách} {đồ uống|nước}",
            "{được|có được} {mang|đem} {rượu|bia} {vào không|từ ngoài vào không}",
        ],
    },
    "hoi_mon_chay": {
        "nhom": "khach",
        "mo_ta": "Hỏi món chay / kiêng khem / dị ứng",
        "mau": [
            "{có|bán} {món chay|đồ chay} {không|gì}",
            "{ăn chay|người chay} {thì|} {gọi gì|ăn được gì|có món nào}",
            "{món|đồ} {nào|gì} {không có|không dùng} {thịt|đạm động vật}",
            "{có|} {món|đồ} {cho|dành cho} {người ăn kiêng|người chay} {không|}",
            "{tôi|mình} {dị ứng|không ăn được} {hải sản|đậu phộng|bò} {thì gọi gì|có món nào}",
            "{món|đồ} {nào|gì} {cay|không cay}",
            "{có|} {ghi|liệt kê} {thành phần|nguyên liệu} {món|} {không|ở đâu}",
            "{món|đồ} {healthy|ít dầu mỡ|thanh đạm} {có không|là gì}",
        ],
    },
    "danh_gia_gop_y": {
        "nhom": "khach",
        "mo_ta": "Muốn đánh giá, góp ý, khiếu nại",
        "mau": [
            "{tôi|mình} {muốn|cần} {đánh giá|góp ý|phản hồi}",
            "{đánh giá|review|góp ý} {ở đâu|kiểu gì|thế nào}",
            "{món|đồ ăn} {hôm nay|vừa rồi} {dở|không ngon|nguội} {quá|lắm}",
            "{phục vụ|nhân viên} {chậm|không tốt|thái độ} {quá|lắm}",
            "{muốn|cần} {khiếu nại|phàn nàn|báo} {về|chuyện} {chất lượng|dịch vụ}",
            "{cho|} {tôi|mình} {chấm|cho} {điểm|mấy sao}",
            "{góp ý|phản ánh} {cho|tới} {quản lý|nhà hàng} {kiểu gì|ở đâu}",
            "{đồ ăn|dịch vụ} {ngon|tốt|tuyệt} {lắm|quá} {muốn khen|}",
        ],
    },

    # ===================== NHOM QUAN LY =====================
    "hoi_doanh_thu": {
        "nhom": "quan_ly",
        "mo_ta": "Tổng doanh thu trong một khoảng thời gian",
        "mau": [
            "{doanh thu|dt} <tg> {là bao nhiêu|bao nhiêu|thế nào|}",
            "{cho|} {xem|báo cáo|thống kê} {doanh thu|dt} <tg>",
            "<tg> {thu được|bán được|kiếm được} {bao nhiêu|nhiêu tiền}",
            "{tổng|} {doanh thu|tiền bán hàng} <tg> {đi|với|nhé}",
            "{báo|cho biết} {doanh số|doanh thu} <tg>",
            "{doanh thu|dt} {thế nào|ra sao} <tg>",
            "{xem|kiểm tra} {tiền|doanh thu} {bán hàng|thu về} <tg>",
            "<tg> {doanh thu|dt} {được|đạt} {nhiêu|bao nhiêu}",
        ],
    },
    "hoi_so_sanh_doanh_thu": {
        "nhom": "quan_ly",
        "mo_ta": "So sánh doanh thu giữa hai kỳ",
        "mau": [
            "{so sánh|đối chiếu} {doanh thu|dt} {tuần này|tháng này} {với|và} {tuần trước|tháng trước}",
            "{doanh thu|dt} {tuần này|tháng này} {so với|hơn kém} {tuần trước|tháng trước} {thế nào|bao nhiêu}",
            "{tăng|giảm} {bao nhiêu|mấy phần trăm} {so với|so} {kỳ trước|tháng trước|tuần trước}",
            "{doanh thu|dt} {có|} {tăng|khá hơn} {không|hơn tháng trước không}",
            "{tháng này|tuần này} {hơn|kém} {tháng trước|tuần trước} {bao nhiêu|nhiêu}",
            "{xu hướng|đà} {doanh thu|kinh doanh} {thế nào|đang lên hay xuống}",
            "{tăng trưởng|growth} {doanh thu|dt} {bao nhiêu|mấy phần trăm}",
            "{so sánh|đối chiếu} {2 kỳ|hai tháng gần nhất} {giúp|đi}",
        ],
    },
    "hoi_so_don": {
        "nhom": "quan_ly",
        "mo_ta": "Số lượng đơn hàng",
        "mau": [
            "{có|đã có} {bao nhiêu|mấy} {đơn|đơn hàng|order} <tg>",
            "{số|tổng số} {đơn hàng|đơn} <tg> {là bao nhiêu|bao nhiêu|}",
            "<tg> {bán|phục vụ|nhận} {được|} {bao nhiêu|mấy} {đơn|order}",
            "{đếm|thống kê} {số đơn|đơn hàng} <tg>",
            "{lượng|số lượng} {đơn|order} <tg> {thế nào|ra sao}",
            "{bao nhiêu|mấy} {hóa đơn|bill} <tg>",
            "{tổng|} {order|đơn} <tg> {là bao nhiêu|nhiêu}",
            "{xem|cho biết} {số đơn|số lượng đơn} <tg>",
        ],
    },
    "hoi_luot_khach": {
        "nhom": "quan_ly",
        "mo_ta": "Số lượt khách",
        "mau": [
            "{bao nhiêu|mấy} {khách|lượt khách|người} <tg>",
            "{số|lượng} {khách|lượt khách} <tg> {là bao nhiêu|bao nhiêu|}",
            "<tg> {đón|phục vụ|tiếp} {bao nhiêu|mấy} {khách|lượt khách}",
            "{lượt khách|traffic} <tg> {thế nào|ra sao}",
            "{đông|vắng} {khách|} {không|thế nào} <tg>",
            "{thống kê|đếm} {khách|lượt khách} <tg>",
            "{khách|người} {đến|tới} {bao nhiêu|nhiêu} <tg>",
            "{tổng|} {lượt khách|số khách} <tg>",
        ],
    },
    "hoi_loi_nhuan": {
        "nhom": "quan_ly",
        "mo_ta": "Lợi nhuận gộp, biên lợi nhuận, chi phí nguyên liệu",
        "mau": [
            "{lợi nhuận|ln|lãi} <tg> {bao nhiêu|là bao nhiêu|thế nào}",
            "{lãi|lời} {được|} {bao nhiêu|nhiêu} <tg>",
            "{biên|tỷ lệ} {lợi nhuận|lãi} <tg> {bao nhiêu|mấy phần trăm}",
            "{chi phí|giá vốn} {nguyên liệu|nguyên vật liệu} <tg> {bao nhiêu|hết bao nhiêu}",
            "{lợi nhuận gộp|lãi gộp} <tg> {thế nào|bao nhiêu}",
            "{tính|cho biết} {lãi lỗ|lợi nhuận} <tg>",
            "{kinh doanh|làm ăn} <tg> {lãi hay lỗ|có lời không}",
            "{doanh thu trừ|trừ} {chi phí|giá vốn} {còn|ra} {bao nhiêu|nhiêu} <tg>",
        ],
    },
    "hoi_top_mon": {
        "nhom": "quan_ly",
        "mo_ta": "Xếp hạng món bán chạy (góc nhìn quản lý)",
        "mau": [
            "{top|xếp hạng} {món|} {bán chạy|bán được nhiều} {nhất|} <tg>",
            "{món|} {nào|gì} {bán chạy|bán được nhiều|có doanh thu cao} {nhất|} <tg>",
            "{thống kê|báo cáo} {món bán chạy|top món} <tg>",
            "{món|} {nào|gì} {lãi|lợi nhuận} {cao nhất|nhiều nhất} <tg>",
            "{xếp hạng|rank} {món ăn|các món} {theo|theo doanh thu} {số lượng|doanh thu} <tg>",
            "{5|10|top 10} {món|} {bán chạy|hot} {nhất|} <tg>",
            "{món chủ lực|món chính} {là|đang là} {món nào|gì}",
            "{món nào|gì} {đóng góp|mang lại} {doanh thu|tiền} {nhiều nhất|cao nhất}",
        ],
    },
    "hoi_mon_ban_cham": {
        "nhom": "quan_ly",
        "mo_ta": "Món bán chậm / ế",
        "mau": [
            "{món|} {nào|gì} {bán chậm|ế|ít khách gọi} {nhất|} <tg>",
            "{món|đồ} {ế|không ai gọi|bán không được} {là gì|gồm gì}",
            "{nên|có nên} {bỏ|loại|cắt} {món nào|món gì} {khỏi menu|ra}",
            "{món|} {doanh thu|bán} {thấp nhất|kém nhất} <tg>",
            "{thống kê|liệt kê} {món bán chậm|món ế} <tg>",
            "{món nào|gì} {ít|hiếm khi} {được gọi|bán ra}",
            "{món|} {kém hiệu quả|không hiệu quả} {là gì|gồm những gì}",
            "{cuối bảng|xếp cuối} {là|có} {món nào|những món nào}",
        ],
    },
    "hoi_ton_kho": {
        "nhom": "quan_ly",
        "mo_ta": "Tình trạng tồn kho nguyên liệu",
        "mau": [
            "{tồn kho|tk} {hiện tại|bây giờ} {thế nào|ra sao|còn bao nhiêu}",
            "{còn|tồn} {bao nhiêu|mấy} <nl>",
            "{kiểm tra|xem} {tồn kho|kho|nguyên liệu}",
            "{báo cáo|thống kê} {tồn kho|kho hàng}",
            "{trong kho|kho} {còn|có} {những gì|gì}",
            "{số lượng|lượng} {tồn|còn lại} {của|} <nl> {bao nhiêu|thế nào}",
            "{tình trạng|tình hình} {kho|nguyên liệu} {thế nào|ra sao}",
            "{xem|kiểm} {kho|hàng tồn} {đi|giúp|nhé}",
        ],
    },
    "hoi_nguyen_lieu_sap_het": {
        "nhom": "quan_ly",
        "mo_ta": "Nguyên liệu sắp hết, cần nhập thêm",
        "mau": [
            "{nguyên liệu|nl|hàng} {nào|gì} {sắp hết|gần hết|dưới định mức}",
            "{cần|phải} {nhập|mua} {thêm|} {gì|nguyên liệu nào}",
            "{cảnh báo|báo động} {tồn kho|hết hàng} {có gì|gồm gì}",
            "{món|nguyên liệu} {nào|gì} {phải|cần} {đặt hàng|nhập} {gấp|ngay}",
            "{sắp hết|hết} {những|} {nguyên liệu|thứ} {nào|gì}",
            "{danh sách|liệt kê} {cần nhập|phải mua} {hôm nay|tuần này|}",
            "{nguyên liệu|hàng} {còn|dùng được} {mấy ngày|bao lâu} {nữa|}",
            "{có|} {gì|nguyên liệu nào} {dưới|thấp hơn} {định mức|mức tối thiểu} {không|}",
        ],
    },
    "hoi_lo_sap_het_han": {
        "nhom": "quan_ly",
        "mo_ta": "Lô hàng sắp hết hạn sử dụng",
        "mau": [
            "{lô|hàng|nguyên liệu} {nào|gì} {sắp hết hạn|gần hết hạn|hết date}",
            "{có|} {hàng|lô} {nào|} {hết hạn|quá hạn} {chưa|không}",
            "{kiểm tra|xem} {hạn sử dụng|date|hsd} {kho|nguyên liệu}",
            "{cảnh báo|báo} {hết hạn|hạn sử dụng} {có gì|gồm gì}",
            "{hàng|lô} {hết hạn|hết date} {trong|sau} {7 ngày|tuần này|vài ngày} {tới|nữa}",
            "{cần|phải} {dùng gấp|xử lý} {nguyên liệu|lô} {nào|gì}",
            "{danh sách|liệt kê} {lô hàng|hàng} {sắp hết hạn|cận date}",
            "{nguyên liệu|đồ} {nào|gì} {sắp hỏng|sắp bỏ|phải bỏ}",
        ],
    },
    "hoi_hieu_suat_nhan_vien": {
        "nhom": "quan_ly",
        "mo_ta": "Hiệu suất nhân viên phục vụ",
        "mau": [
            "{nhân viên|nv} {nào|ai} {phục vụ|làm} {nhiều|tốt} {nhất|} <tg>",
            "{hiệu suất|năng suất} {nhân viên|nv} <tg> {thế nào|ra sao}",
            "{xếp hạng|rank} {nhân viên|nv} {theo|theo doanh thu} {số đơn|doanh thu} <tg>",
            "{ai|nhân viên nào} {bán được|mang về} {nhiều tiền nhất|doanh thu cao nhất}",
            "{báo cáo|thống kê} {nhân viên|nhân sự} <tg>",
            "{nhân viên|nv} {nào|ai} {làm ít|kém|yếu} {nhất|} <tg>",
            "{mỗi|từng} {nhân viên|nv} {phục vụ|làm} {bao nhiêu|mấy} {đơn|bàn} <tg>",
            "{đánh giá|xem} {năng suất|hiệu quả} {đội ngũ|nhân viên} <tg>",
        ],
    },
    "hoi_hieu_suat_bep": {
        "nhom": "quan_ly",
        "mo_ta": "Thời gian chế biến của bếp",
        "mau": [
            "{bếp|nhà bếp} {làm|chế biến} {nhanh không|thế nào|mất bao lâu}",
            "{thời gian|tg} {chế biến|nấu} {trung bình|tb} {bao lâu|bao nhiêu phút}",
            "{món|} {nào|gì} {lâu nhất|chậm nhất|mất nhiều thời gian nhất}",
            "{hiệu suất|năng suất} {bếp|nhà bếp} <tg> {thế nào|ra sao}",
            "{món|} {nào|gì} {làm nhanh|ra nhanh} {nhất|}",
            "{thống kê|báo cáo} {thời gian|tốc độ} {ra món|chế biến}",
            "{khách|} {phải|} {đợi|chờ} {món|} {bao lâu|mấy phút} {trung bình|}",
            "{bếp|} {có|đang} {chậm|quá tải} {không|}",
        ],
    },
    "hoi_du_bao": {
        "nhom": "quan_ly",
        "mo_ta": "Kết quả dự báo lượt khách / nguyên liệu (nối vào module ML sẵn có)",
        "mau": [
            "{dự báo|dự đoán} {lượt khách|khách} {ngày mai|tuần tới|mấy ngày tới} {thế nào|bao nhiêu}",
            "{mai|ngày mai|tuần sau} {dự kiến|dự báo} {bao nhiêu|mấy} {khách|lượt khách}",
            "{xem|cho biết} {kết quả|số liệu} {dự báo|dự đoán}",
            "{dự báo|dự đoán} {nguyên liệu|nhu cầu nguyên liệu} {tuần tới|sắp tới}",
            "{cần|phải} {chuẩn bị|nhập} {bao nhiêu|nhiêu} {nguyên liệu|hàng} {tuần tới|tới}",
            "{mô hình|ml|ai} {dự báo|đoán} {thế nào|ra sao}",
            "{độ chính xác|sai số} {của|} {mô hình|dự báo} {bao nhiêu|thế nào}",
            "{sắp tới|những ngày tới} {đông khách|vắng} {không|thế nào}",
        ],
    },
    "hoi_gio_cao_diem": {
        "nhom": "quan_ly",
        "mo_ta": "Khung giờ và ngày cao điểm",
        "mau": [
            "{giờ|khung giờ} {nào|mấy giờ} {đông khách|cao điểm} {nhất|}",
            "{cao điểm|đông nhất} {vào|lúc} {giờ nào|mấy giờ}",
            "{doanh thu|khách} {theo|phân bổ theo} {giờ|khung giờ} <tg>",
            "{thứ|ngày} {nào|mấy} {trong tuần|} {đông|bán được} {nhất|}",
            "{nên|cần} {xếp|tăng} {ca|nhân sự} {vào|lúc} {giờ nào|khi nào}",
            "{lúc nào|khi nào} {vắng khách|ít khách} {nhất|}",
            "{phân tích|thống kê} {giờ cao điểm|khung giờ}",
            "{biểu đồ|đồ thị} {theo giờ|khung giờ} <tg>",
        ],
    },
    "hoi_ty_le_huy": {
        "nhom": "quan_ly",
        "mo_ta": "Tỷ lệ hủy đơn",
        "mau": [
            "{tỷ lệ|tỉ lệ} {hủy|hủy đơn} {bao nhiêu|là bao nhiêu} <tg>",
            "{bao nhiêu|mấy} {đơn|order} {bị hủy|hủy} <tg>",
            "{khách|} {hủy|bỏ} {nhiều không|nhiều lắm không} <tg>",
            "{thống kê|báo cáo} {đơn hủy|hủy đơn} <tg>",
            "{số|lượng} {đơn hủy|đơn bị hủy} <tg>",
            "{tỷ lệ|tỉ lệ} {no show|khách không đến} {thế nào|bao nhiêu}",
            "{mất|thất thoát} {bao nhiêu|nhiêu} {vì|do} {hủy đơn|khách hủy}",
            "{hủy đơn|đơn hủy} {có|đang} {tăng|nhiều} {không|lên không}",
        ],
    },
    "hoi_ban_trong": {
        "nhom": "quan_ly",
        "mo_ta": "Tình trạng bàn hiện tại",
        "mau": [
            "{còn|có} {bao nhiêu|mấy} {bàn trống|bàn còn trống}",
            "{bàn|} {nào|} {đang|còn} {trống|rảnh}",
            "{tình trạng|tình hình} {bàn|sơ đồ bàn} {thế nào|ra sao|hiện tại}",
            "{bao nhiêu|mấy} {bàn|} {đang|có khách|bận}",
            "{sơ đồ bàn|bản đồ bàn} {hiện tại|bây giờ} {thế nào|sao rồi}",
            "{tỷ lệ|tỉ lệ} {lấp đầy|sử dụng bàn} {bao nhiêu|thế nào}",
            "{khu|khu vực} {nào|} {còn|trống} {bàn|chỗ}",
            "{quán|nhà hàng} {đang|có} {đông|kín bàn} {không|}",
        ],
    },
    "hoi_don_dang_cho": {
        "nhom": "quan_ly",
        "mo_ta": "Đơn đang chờ bếp / chờ xác nhận",
        "mau": [
            "{có|đang có} {bao nhiêu|mấy} {đơn|món} {đang chờ|chờ xử lý}",
            "{đơn|order} {nào|} {chưa|đang chờ} {xác nhận|làm}",
            "{bếp|} {đang|còn} {làm|xử lý} {mấy|bao nhiêu} {món|đơn}",
            "{hàng chờ|queue|danh sách chờ} {của bếp|hiện tại} {thế nào|bao nhiêu}",
            "{món|đơn} {nào|} {đang|còn} {tồn|chờ} {trong bếp|lâu nhất}",
            "{kiểm tra|xem} {đơn|món} {đang chờ|chưa xong}",
            "{còn|có} {đơn|order} {nào|} {chưa|chậm} {xử lý|ra món} {không|}",
            "{tình trạng|trạng thái} {bếp|kds} {hiện tại|bây giờ}",
        ],
    },
    "hoi_gia_tri_don_tb": {
        "nhom": "quan_ly",
        "mo_ta": "Giá trị trung bình mỗi đơn / mỗi khách",
        "mau": [
            "{giá trị|tiền} {trung bình|tb} {mỗi|một} {đơn|hóa đơn} {bao nhiêu|là bao nhiêu} <tg>",
            "{mỗi|một} {khách|người} {chi|tiêu|xài} {bao nhiêu|trung bình bao nhiêu} <tg>",
            "{trung bình|tb} {một|mỗi} {bill|hóa đơn} {bao nhiêu|nhiêu tiền}",
            "{aov|giá trị đơn trung bình} <tg> {bao nhiêu|thế nào}",
            "{khách|} {tiêu|chi} {trung bình|tb} {bao nhiêu|nhiêu} <tg>",
            "{đơn|hóa đơn} {trung bình|tb} {tăng hay giảm|thế nào} <tg>",
            "{tính|cho biết} {giá trị đơn|bill} {trung bình|tb} <tg>",
            "{trung bình|tb} {mỗi bàn|mỗi lượt} {chi|thu} {bao nhiêu|nhiêu}",
        ],
    },
}


# --------------------------------------------------------------------------
# No bien the tu mau cau
# --------------------------------------------------------------------------
_KHOI_CHON = re.compile(r"\{([^{}]*)\}")
_KHOI_TUY_CHON = re.compile(r"\[([^\[\]]*)\]")


def _no_bien_the(mau: str) -> list[str]:
    """No mot mau cau thanh TAT CA bien the.

    '{a|b} xin chao' -> ['a xin chao', 'b xin chao']
    '[vui long] cho xem' -> ['vui long cho xem', 'cho xem']
    """
    # [x] tuong duong {x|}
    mau = _KHOI_TUY_CHON.sub(lambda m: "{" + m.group(1) + "|}", mau)

    ket_qua = [mau]
    while True:
        khop = _KHOI_CHON.search(ket_qua[0])
        if not khop:
            break
        moi: list[str] = []
        for cau in ket_qua:
            k = _KHOI_CHON.search(cau)
            if not k:
                moi.append(cau)
                continue
            for phuong_an in k.group(1).split("|"):
                moi.append(cau[:k.start()] + phuong_an + cau[k.end():])
        ket_qua = moi
    return ket_qua


def _dien_slot(cau: str, rng: random.Random) -> str:
    """Thay <tg>, <mon>... bang mot gia tri mau ngau nhien."""
    def _thay(khop: re.Match) -> str:
        ten = khop.group(1)
        gia_tri = GIA_TRI_SLOT.get(ten)
        return rng.choice(gia_tri) if gia_tri else ""

    return re.sub(r"<(\w+)>", _thay, cau)


def sinh_du_lieu(
    so_bien_the_moi_mau: int = 14,
    ti_le_bo_dau: float = 0.30,
    seed: int = SEED,
) -> tuple[list[str], list[str], list[str]]:
    """Sinh toan bo bo du lieu huan luyen.

    Tra ve ba danh sach song song:
        cau     : cau hoi (chua chuan hoa)
        nhan    : ma y dinh
        ma_mau  : dinh danh mau cau da sinh ra cau do -> dung de chia tap
                  theo NHOM, tranh ro ri du lieu (xem chu thich dau file).

    `ti_le_bo_dau`: mot phan cac cau duoc nhan ban sang dang KHONG DAU, vi
    nguoi dung thuc te go khong dau rat nhieu. Day la mot dang tang cuong du
    lieu (data augmentation) dac thu tieng Viet.
    """
    from .tien_xu_ly import bo_dau

    rng = random.Random(seed)
    cau: list[str] = []
    nhan: list[str] = []
    ma_mau: list[str] = []
    da_co: set[str] = set()  # khu trung lap: bo dau co the lam hai bien the trung nhau

    for ma_y_dinh, thong_tin in Y_DINH.items():
        for chi_so, mau in enumerate(thong_tin["mau"]):
            bien_the = _no_bien_the(mau)
            rng.shuffle(bien_the)
            bien_the = bien_the[:so_bien_the_moi_mau]
            khoa_mau = f"{ma_y_dinh}#{chi_so}"

            for bt in bien_the:
                van_ban = re.sub(r"\s+", " ", _dien_slot(bt, rng)).strip()
                if not van_ban:
                    continue

                for bien in (van_ban, bo_dau(van_ban) if rng.random() < ti_le_bo_dau else None):
                    # Ban khong dau giu NGUYEN ma_mau de hai ban khong bi tach
                    # ra hai ben train/test (do se la mot dang ro ri khac).
                    if bien is None or bien.lower() in da_co:
                        continue
                    da_co.add(bien.lower())
                    cau.append(bien)
                    nhan.append(ma_y_dinh)
                    ma_mau.append(khoa_mau)

    return cau, nhan, ma_mau


# --------------------------------------------------------------------------
# Tap kiem thu viet tay - KHONG sinh tu mau nao o tren.
#
# Day la thuoc do trung thuc nhat: cau chu do nguoi viet, dung tu ngu tu do,
# co ca loi chinh ta va cach dien dat vong vo. Ket qua tren tap nay moi la con
# so nen bao cao trong khoa luan.
# --------------------------------------------------------------------------
BO_KIEM_THU_TAY: list[tuple[str, str]] = [
    ("cho mình hỏi quán mình mấy giờ đóng cửa vậy ạ", "hoi_gio_mo_cua"),
    ("toi muon biet gio mo cua cua nha hang", "hoi_gio_mo_cua"),
    ("nay quán còn bán không ta", "hoi_gio_mo_cua"),
    ("quán nằm chỗ nào vậy chỉ mình với", "hoi_dia_chi"),
    ("có chỗ để xe ô tô không shop", "hoi_dia_chi"),
    ("cho xin cái số điện thoại đặt bàn", "hoi_lien_he"),
    ("gửi mình cái menu tham khảo cái", "hoi_thuc_don"),
    ("ben minh ban nhung mon j the", "hoi_thuc_don"),
    ("gà nướng nhiêu tiền vậy bạn", "hoi_gia_mon"),
    ("cho hỏi giá của món heo lên mẹt", "hoi_gia_mon"),
    ("bên mình có món bò nào ngon không", "hoi_mon_theo_loai"),
    ("phần khai vị gồm những gì thế", "hoi_mon_theo_loai"),
    ("quán nổi tiếng món gì nhất vậy", "hoi_mon_ban_chay"),
    ("lần đầu tới nên ăn gì bạn ơi", "hoi_mon_ban_chay"),
    ("quán có món gì ngon", "hoi_mon_ban_chay"),
    ("bên mình có gì ngon không", "hoi_mon_ban_chay"),
    ("có món nào tầm 100k đổ lại không", "hoi_mon_theo_gia"),
    ("mình gọi lẩu rồi thì nên kêu thêm gì nữa", "goi_y_mon"),
    ("tư vấn giúp mình món ăn kèm với", "goi_y_mon"),
    ("nhóm 6 người thì lấy combo nào hợp lý", "hoi_combo"),
    ("đang có chương trình giảm giá nào không ạ", "hoi_khuyen_mai"),
    ("có mã giảm giá cho khách mới ko", "hoi_khuyen_mai"),
    ("mình muốn đặt bàn cho 4 người tối nay", "dat_ban"),
    ("toi nay con ban trong khong ban", "dat_ban"),
    ("đơn của tôi làm xong chưa vậy", "hoi_trang_thai_don"),
    ("bao lâu nữa thì món ra ạ", "hoi_trang_thai_don"),
    ("mình muốn hủy bàn đã đặt hôm nay", "huy_don"),
    ("lỡ đặt nhầm giờ giờ sửa sao", "huy_don"),
    ("quán có nhận chuyển khoản không", "hoi_thanh_toan"),
    ("thanh toan bang momo duoc ko", "hoi_thanh_toan"),
    ("bên mình có ship tận nơi không ạ", "hoi_giao_hang"),
    ("phí giao hàng tính sao vậy", "hoi_giao_hang"),
    ("tôi được bao nhiêu điểm thành viên rồi", "hoi_diem_tich_luy"),
    ("đặt bàn có cần cọc trước không", "hoi_dat_coc"),
    ("bên mình có bia gì", "hoi_do_uong"),
    ("quán có món chay không ạ", "hoi_mon_chay"),
    ("mình bị dị ứng hải sản thì ăn được món nào", "hoi_mon_chay"),
    ("đồ ăn hôm nay nguội quá mình muốn phản ánh", "danh_gia_gop_y"),
    ("cho mình gặp nhân viên tư vấn trực tiếp", "gap_nhan_vien"),
    ("bot này làm được những gì thế", "hoi_bot_la_ai"),
    ("chào shop", "chao_hoi"),
    ("ok cảm ơn bạn nhiều nhé", "cam_on"),
    ("thôi mình đi đây bye", "tam_biet"),
    # --- nhom quan ly ---
    ("doanh thu tuần vừa rồi được nhiêu", "hoi_doanh_thu"),
    ("cho xem tiền bán hàng tháng này", "hoi_doanh_thu"),
    ("thang nay so voi thang truoc the nao", "hoi_so_sanh_doanh_thu"),
    ("doanh thu có tăng so với kỳ trước không", "hoi_so_sanh_doanh_thu"),
    ("hôm qua bán được mấy đơn", "hoi_so_don"),
    ("tuần này đón bao nhiêu lượt khách", "hoi_luot_khach"),
    ("tháng này lãi được nhiêu", "hoi_loi_nhuan"),
    ("chi phí nguyên liệu tháng trước hết bao nhiêu", "hoi_loi_nhuan"),
    ("liệt kê 10 món bán chạy nhất tháng này", "hoi_top_mon"),
    ("món nào đang ế nhất vậy", "hoi_mon_ban_cham"),
    ("kiểm tra giúp tôi tồn kho hiện tại", "hoi_ton_kho"),
    ("còn bao nhiêu thịt bò trong kho", "hoi_ton_kho"),
    ("nguyên liệu nào sắp hết cần nhập gấp", "hoi_nguyen_lieu_sap_het"),
    ("có lô hàng nào sắp hết hạn không", "hoi_lo_sap_het_han"),
    ("nhân viên nào phục vụ nhiều đơn nhất tuần này", "hoi_hieu_suat_nhan_vien"),
    ("bếp làm một món mất trung bình bao lâu", "hoi_hieu_suat_bep"),
    ("món nào lâu ra nhất", "hoi_hieu_suat_bep"),
    ("dự báo ngày mai bao nhiêu khách", "hoi_du_bao"),
    ("mô hình dự báo sai số bao nhiêu", "hoi_du_bao"),
    ("khung giờ nào đông khách nhất", "hoi_gio_cao_diem"),
    ("thứ mấy trong tuần bán được nhất", "hoi_gio_cao_diem"),
    ("tỷ lệ hủy đơn tháng này bao nhiêu", "hoi_ty_le_huy"),
    ("giờ còn mấy bàn trống", "hoi_ban_trong"),
    ("bếp đang tồn mấy món chưa làm", "hoi_don_dang_cho"),
    ("trung bình mỗi hóa đơn bao nhiêu tiền", "hoi_gia_tri_don_tb"),
]


# --------------------------------------------------------------------------
# Tap cau NGOAI PHAM VI - bot phai TU CHOI tra loi, khong duoc doan bua.
#
# Mot bo phan loai chi biet 44 nhan se luon tra ve mot trong 44 nhan do, ke ca
# khi cau hoi chang lien quan gi. Vi vay he thong dat NGUONG TIN CAY: duoi
# nguong thi tra ve "khong hieu" va moi nguoi dung hoi lai.
#
# Tap nay dung de do hai chi so doi nghich nhau:
#   - Ty le tu choi dung  (cau ngoai pham vi -> "khong hieu")
#   - Ty le tu choi oan   (cau trong pham vi -> bi "khong hieu")
# Nguong toi uu la diem can bang giua hai chi so, tim bang `quet_nguong`.
# --------------------------------------------------------------------------
BO_NGOAI_PHAM_VI: list[str] = [
    "thời tiết ngày mai thế nào",
    "giá vàng hôm nay bao nhiêu",
    "kể cho tôi một câu chuyện cười",
    "ai là tổng thống mỹ",
    "dịch câu này sang tiếng anh giúp tôi",
    "1 cộng 1 bằng mấy",
    "bạn có người yêu chưa",
    "cho tôi vay tiền",
    "cách nấu phở bò tại nhà",
    "mua vé máy bay đi đà nẵng",
    "tỷ số trận đấu tối qua",
    "viết giúp tôi một bài thơ",
    "lịch chiếu phim cuối tuần",
    "hôm nay là ngày mấy âm lịch",
    "chỉ tôi cách học tiếng nhật",
    "sửa xe máy ở đâu rẻ",
    "asdfgh qwerty",
    "bitcoin đang bao nhiêu",
    "tôi buồn quá",
    "số điện thoại của công an phường",
]


def thong_ke_bo_du_lieu() -> dict:
    """Vai con so mo ta bo du lieu - dung cho phan 'Du lieu' cua bao cao."""
    cau, nhan, ma_mau = sinh_du_lieu()
    dem: dict[str, int] = {}
    for n in nhan:
        dem[n] = dem.get(n, 0) + 1
    do_dai = [len(c.split()) for c in cau]
    return {
        "so_y_dinh": len(Y_DINH),
        "so_mau_cau": sum(len(v["mau"]) for v in Y_DINH.values()),
        "so_cau_sinh": len(cau),
        "so_cau_kiem_thu_tay": len(BO_KIEM_THU_TAY),
        "so_nhom_mau": len(set(ma_mau)),
        "do_dai_tb": round(sum(do_dai) / len(do_dai), 2) if do_dai else 0,
        "it_nhat": min(dem.values()) if dem else 0,
        "nhieu_nhat": max(dem.values()) if dem else 0,
        "theo_nhom": {
            nhom: sum(1 for k, v in Y_DINH.items() if v["nhom"] == nhom)
            for nhom in ("chung", "khach", "quan_ly")
        },
    }

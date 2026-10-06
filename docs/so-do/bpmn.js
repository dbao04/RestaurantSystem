/**
 * Bon so do quy trinh nghiep vu (BPMN), moi so do mot pool chia thanh bon lan.
 *
 * Quy uoc ky hieu dung chung cho ca bon hinh:
 *   vong tron mong   su kien bat dau      vong tron day   su kien ket thuc
 *   vong tron kep    su kien trung gian   hinh thoi       cong re nhanh XOR
 *   hop bo goc       cong viec cua nguoi  hop co bieu tuong   buoc he thong tu chay
 *
 * Toa do KHONG go tay: moi diem noi luong deu suy tu tam hinh qua `c.*`, nen
 * doi be rong hop cong viec mot cho la ca bon so do tu khop lai.
 */
const v = require('./ve');
const c = v.canh;

const COT = [120, 268, 416, 564, 712, 860, 1008, 1156];
const X = (i) => COT[i - 1];
const W = X(8) + v.VIEC_RONG / 2 + 24;   // 1249
const LAN_Y = [8, 158, 308, 458];
const TAM = LAN_Y.map((y) => y + 75);    // tam bon lan: 83, 233, 383, 533
const CAO = LAN_Y[3] + v.LAN_CAO + 30;

/* ======================================================================== */
/* A. PHUC VU & CHE BIEN TAI BAN                                            */
/* ======================================================================== */

function phucVu() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpA';
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W);
  s += v.lan(LAN_Y[1], 'Phục vụ', W);
  s += v.lan(LAN_Y[2], 'Bếp (KDS)', W);
  s += v.lan(LAN_Y[3], 'Hệ thống', W);

  s += v.suKien(X(1), L1, 'Khách tới nhà hàng', 'dau', true);
  s += v.viec(X(2), L2, ['Xếp bàn, xác nhận', 'khách đã đặt trước']);
  s += v.cong(X(3), L2, 'Khách tự gọi món?');
  s += v.viec(X(4), L1, ['Quét mã QR tại bàn,', 'chọn món']);
  s += v.viec(X(4), L2, ['Nhập đơn hộ khách', 'trên máy POS']);
  s += v.viec(X(5), L4, ['Ghi đơn, gắn bàn,', 'bàn → Đang phục vụ'], 'tu-dong');
  s += v.viec(X(6), L3, ['Nhận món,', 'bắt đầu chế biến']);
  s += v.viec(X(7), L3, 'Hoàn thành chế biến');
  s += v.viec(X(7), L4, ['Trừ tồn kho theo', 'công thức, ghi xuất kho'], 'tu-dong');
  s += v.viec(X(8), L2, 'Mang món ra bàn');
  s += v.suKien(X(8), L1, 'Món đã lên bàn', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L1], [X(1) + 42, L1], [X(1) + 42, L2], [c.vTrai(X(2)), L2]], id);
  s += v.luong([[c.vPhai(X(2)), L2], [c.cTrai(X(3)), L2]], id);
  s += v.luong([[X(3), c.cTren(L2)], [X(3), L1], [c.vTrai(X(4)), L1]], id, 'Có', [X(3) + 14, L1 + 58]);
  s += v.luong([[c.cPhai(X(3)), L2], [c.vTrai(X(4)), L2]], id, 'Không', [X(3) + 42, L2 - 9]);
  s += v.luong([[c.vPhai(X(4)), L1], [X(5) - 40, L1], [X(5) - 40, c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(4)), L2], [X(5) + 40, L2], [X(5) + 40, c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(5)), L4], [c.vPhai(X(5)) + 10, L4], [c.vPhai(X(5)) + 10, L3], [c.vTrai(X(6)), L3]], id);
  s += v.luong([[c.vPhai(X(6)), L3], [c.vTrai(X(7)), L3]], id);
  s += v.luong([[X(7), c.vDuoi(L3)], [X(7), c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(7)), L4], [c.vPhai(X(7)) + 5, L4], [c.vPhai(X(7)) + 5, L2], [c.vTrai(X(8)), L2]], id);
  s += v.luong([[X(8), c.vTren(L2)], [X(8), L1 + c.sk]], id);

  return v.khung(
    id, W, CAO,
    'Sơ đồ BPMN quy trình phục vụ và chế biến tại bàn với bốn lằn: khách hàng, phục vụ, bếp và hệ thống',
    s
  );
}

/* ======================================================================== */
/* B. DAT BAN TRUC TUYEN                                                   */
/* ======================================================================== */

function datBan() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpDatBan';
  const W1 = rongCT(10);
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W1);
  s += v.lan(LAN_Y[1], 'Lễ tân', W1);
  s += v.lan(LAN_Y[2], 'Hệ thống', W1);
  s += v.lan(LAN_Y[3], 'Ngân hàng', W1);

  s += v.suKien(K(1), L1, 'Muốn đặt bàn', 'dau', true);
  s += v.viec(K(2), L1, ['Nhập ngày, giờ,', 'số khách và liên hệ']);
  s += v.viec(K(3), L3, ['Kiểm tra bàn trống', 'và điều kiện đặt bàn'], 'tu-dong');
  s += v.cong(K(4), L3, 'Có bàn phù hợp?', false);
  s += v.viec(K(5), L1, ['Chọn khung giờ', 'hoặc khu vực khác']);
  s += v.suKien(K(6), L1, 'Không đặt được', 'cuoi', true);
  s += v.viec(K(5), L3, ['Giữ ô lưới thời gian,', 'tạo mã đặt bàn'], 'tu-dong');
  s += v.cong(K(6), L3, 'Cần đặt cọc?', false);
  s += v.viec(K(7), L2, ['Duyệt lượt đặt,', 'gọi xác nhận nếu cần']);
  s += v.viec(K(7), L3, ['Sinh mã VietQR', 'tiền đặt cọc'], 'tu-dong');
  s += v.viec(K(9), L1, ['Chuyển khoản', 'tiền đặt cọc']);
  s += v.suKien(K(9), L4, 'Ngân hàng báo có', 'giua');
  s += v.viec(K(10), L3, ['Đối soát tiền cọc,', 'xác nhận giữ bàn'], 'tu-dong');
  s += v.suKien(K(10), L1, 'Đặt bàn thành công', 'cuoi', true);

  s += v.luong([[K(1) + c.sk, L1], [c.vTrai(K(2)), L1]], id);
  s += v.luong([[K(2), c.vDuoi(L1)], [K(2), L3], [c.vTrai(K(3)), L3]], id);
  s += v.luong([[c.vPhai(K(3)), L3], [c.cTrai(K(4)), L3]], id);
  s += v.luong([[K(4), c.cTren(L3)], [K(4), L1], [c.vTrai(K(5)), L1]], id, 'Không', [K(4) + 32, 300]);
  s += v.luong([[c.vPhai(K(5)), L1], [K(6) - c.sk, L1]], id);
  s += v.luong([[c.cPhai(K(4)), L3], [c.vTrai(K(5)), L3]], id, 'Có', [K(4) + 52, L3 - 9]);
  s += v.luong([[c.vPhai(K(5)), L3], [c.cTrai(K(6)), L3]], id);
  s += v.luong([[K(6), c.cTren(L3)], [K(6), L2], [c.vTrai(K(7)), L2]], id, 'Không', [K(6) + 32, 300]);
  s += v.luong([[c.cPhai(K(6)), L3], [c.vTrai(K(7)), L3]], id, 'Có', [K(6) + 52, L3 - 9]);
  s += v.luong([[c.vPhai(K(7)), L2], [1400, L2], [1400, L1], [K(10) - c.sk, L1]], id);
  s += v.luong([[c.vPhai(K(7)), L3], [K(8), L3], [K(8), L1], [c.vTrai(K(9)), L1]], id);
  s += v.luong([[K(9), c.vDuoi(L1)], [K(9), L4 - c.sk]], id);
  s += v.luong([[K(9) + c.sk, L4], [K(10), L4], [K(10), c.vDuoi(L3)]], id);
  s += v.luong([[K(10), c.vTren(L3)], [K(10), L1 + c.sk]], id);

  return v.khung(
    id, W1, CAO,
    'So do BPMN tong quan quy trinh dat ban truc tuyen: kiem tra ban trong, giu o luoi thoi gian, nhanh duyet luot dat va nhanh dat coc qua VietQR duoc doi soat tu dong',
    s
  );
}

/* ======================================================================== */
/* B. THANH TOAN & DOI SOAT NGAN HANG                                       */
/* ======================================================================== */

function thanhToan() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpB';
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W);
  s += v.lan(LAN_Y[1], 'Thu ngân', W);
  s += v.lan(LAN_Y[2], 'Hệ thống', W);
  s += v.lan(LAN_Y[3], 'Ngân hàng', W);

  s += v.suKien(X(1), L2, 'Khách xin tính tiền', 'dau');
  s += v.viec(X(2), L2, ['Mở phiên thanh toán', 'cho bàn']);
  s += v.cong(X(3), L2, 'Hình thức trả?');
  s += v.viec(X(4), L2, ['Thu tiền mặt,', 'xác nhận trên POS']);
  s += v.viec(X(4), L3, ['Sinh mã VietQR', 'đúng số tiền'], 'tu-dong');
  s += v.viec(X(6), L1, ['Quét mã, chuyển', 'khoản trên app']);
  s += v.suKien(X(6), L4, 'Ngân hàng báo có', 'giua');
  s += v.viec(X(7), L3, ['Đối soát tự động,', 'khớp phiên đang chờ'], 'tu-dong');
  s += v.viec(X(8), L3, ['Đóng đơn, bàn trống,', 'cộng điểm tích luỹ'], 'tu-dong');
  s += v.suKien(X(8), L1, 'Đã thanh toán', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L2], [c.vTrai(X(2)), L2]], id);
  s += v.luong([[c.vPhai(X(2)), L2], [c.cTrai(X(3)), L2]], id);
  s += v.luong([[c.cPhai(X(3)), L2], [c.vTrai(X(4)), L2]], id, 'Tiền mặt', [X(3) + 42, L2 - 9]);
  s += v.luong([[X(3), c.cDuoi(L2)], [X(3), L3], [c.vTrai(X(4)), L3]], id, 'Chuyển khoản', [X(3) + 46, L2 + 66]);
  s += v.luong([[c.vPhai(X(4)), L3], [X(5), L3], [X(5), L1], [c.vTrai(X(6)), L1]], id);
  s += v.luong([[X(6), c.vDuoi(L1)], [X(6), L4 - c.sk]], id);
  s += v.luong([[X(6) + c.sk, L4], [X(6) + 60, L4], [X(6) + 60, L3], [c.vTrai(X(7)), L3]], id);
  s += v.luong([[c.vPhai(X(4)), L2], [X(8) - 40, L2], [X(8) - 40, c.vTren(L3)]], id, 'đã thu đủ', [X(8) - 96, L2 - 9]);
  s += v.luong([[c.vPhai(X(7)), L3], [c.vTrai(X(8)), L3]], id);
  s += v.luong([[X(8), c.vTren(L3)], [X(8), L1 + c.sk]], id);

  return v.khung(
    id, W, CAO,
    'Sơ đồ BPMN quy trình thanh toán với nhánh tiền mặt và nhánh chuyển khoản VietQR được đối soát tự động từ thông báo của ngân hàng',
    s
  );
}

/* ======================================================================== */
/* C. DU BAO BANG HOC MAY                                                   */
/* ======================================================================== */

function duBao() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpC';
  const w = W + 30;
  let s = '';

  s += v.lan(LAN_Y[0], 'Quản lý', w);
  s += v.lan(LAN_Y[1], 'Web (Node)', w);
  s += v.lan(LAN_Y[2], 'Dịch vụ ML', w);
  s += v.lan(LAN_Y[3], 'CSDL', w);

  s += v.suKien(X(1), L1, 'Mở trang Dự báo AI', 'dau', true);
  s += v.viec(X(2), L1, ['Chọn số ngày,', 'bấm Chạy dự báo']);
  s += v.viec(X(3), L2, ['Gọi API dịch vụ ML', 'POST /du-bao/luot-khach']);
  s += v.cong(X(4), L2, 'Dịch vụ ML trả lời?');
  s += v.viec(X(5), L2, ['Hiện dự báo đã lưu,', 'báo dịch vụ chưa bật']);
  s += v.viec(X(5), L4, ['Đọc 368 ngày', 'lịch sử bán hàng'], 'tu-dong');
  s += v.viec(X(6), L3, ['Sinh đặc trưng: thứ,', 'tháng, lễ Tết,', 'trung bình trượt']);
  s += v.viec(X(7), L3, ['Huấn luyện 4 mô hình', 'trên 60 ngày cuối']);
  s += v.viec(X(8), L3, ['Chọn mô hình MAE', 'thấp nhất, dự báo']);
  s += v.viec(X(8), L4, ['Lưu dự báo và', 'chỉ số đánh giá'], 'tu-dong');
  s += v.suKien(X(8), L1, 'Xem dự báo', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L1], [c.vTrai(X(2)), L1]], id);
  s += v.luong([[X(2), c.vDuoi(L1)], [X(2), L2], [c.vTrai(X(3)), L2]], id);
  s += v.luong([[c.vPhai(X(3)), L2], [c.cTrai(X(4)), L2]], id);
  s += v.luong([[c.cPhai(X(4)), L2], [c.vTrai(X(5)), L2]], id, 'Không', [X(4) + 42, L2 - 9]);
  s += v.luong([[X(4), c.cDuoi(L2)], [X(4), L4], [c.vTrai(X(5)), L4]], id, 'Có', [X(4) + 14, L2 + 66]);
  s += v.luong([[c.vPhai(X(5)), L4], [c.vPhai(X(5)) + 5, L4], [c.vPhai(X(5)) + 5, L3], [c.vTrai(X(6)), L3]], id);
  s += v.luong([[c.vPhai(X(6)), L3], [c.vTrai(X(7)), L3]], id);
  s += v.luong([[c.vPhai(X(7)), L3], [c.vTrai(X(8)), L3]], id);
  s += v.luong([[X(8), c.vDuoi(L3)], [X(8), c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(8)), L4], [w - 12, L4], [w - 12, L1], [X(8) + c.sk, L1]], id);
  s += v.luong([[c.vPhai(X(5)), L2], [X(8) - 46, L2], [X(8) - 46, L1], [X(8) - c.sk, L1]], id);

  return v.khung(
    id, w, CAO,
    'Sơ đồ BPMN quy trình dự báo bằng học máy: web gọi dịch vụ Python, dịch vụ đọc lịch sử, huấn luyện bốn mô hình rồi chọn mô hình có sai số thấp nhất',
    s
  );
}

/* ======================================================================== */
/* D. CHAM CONG BANG KHUON MAT + GPS                                        */
/* ======================================================================== */

function chamCong() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpD';
  let s = '';

  s += v.lan(LAN_Y[0], 'Nhân viên', W);
  s += v.lan(LAN_Y[1], 'Trình duyệt', W);
  s += v.lan(LAN_Y[2], 'Web (Node)', W);
  s += v.lan(LAN_Y[3], 'Dịch vụ ML', W);

  s += v.suKien(X(1), L1, 'Nhân viên tới ca', 'dau', true);
  s += v.viec(X(2), L2, ['Mở trang chấm công,', 'lấy GPS + webcam']);
  s += v.cong(X(3), L3, ['Trong bán kính', 'cho phép?']);
  s += v.viec(X(4), L3, ['Ghi nhật ký', 'sai vị trí'], 'tu-dong');
  s += v.suKien(X(5), L3, 'Bị chặn vì sai vị trí', 'cuoi');
  s += v.viec(X(4), L4, ['Kiểm tra ảnh sống', '(thử thách gật đầu)']);
  s += v.viec(X(5), L4, ['Nhận diện 1:N', 'hoặc xác minh 1:1']);
  s += v.cong(X(6), L4, ['Đạt ngưỡng', 'tin cậy?'], false);
  s += v.viec(X(6), L2, ['Báo thất bại, mời', 'chấm công thủ công']);
  s += v.suKien(X(7), L2, 'Chờ quản lý duyệt', 'cuoi');
  s += v.viec(X(7), L3, ['Ghi bảng công,', 'lưu ảnh và toạ độ'], 'tu-dong');
  s += v.suKien(X(8), L1, 'Đã chấm công', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L1], [X(1) + 42, L1], [X(1) + 42, L2], [c.vTrai(X(2)), L2]], id);
  s += v.luong([[X(2), c.vDuoi(L2)], [X(2), L3], [c.cTrai(X(3)), L3]], id);
  s += v.luong([[c.cPhai(X(3)), L3], [c.vTrai(X(4)), L3]], id, 'Không', [X(3) + 42, L3 - 9]);
  s += v.luong([[X(3), c.cDuoi(L3)], [X(3), L4], [c.vTrai(X(4)), L4]], id, 'Có', [X(3) + 14, L3 + 66]);
  s += v.luong([[c.vPhai(X(4)), L3], [X(5) - c.sk, L3]], id);
  s += v.luong([[c.vPhai(X(4)), L4], [c.vTrai(X(5)), L4]], id);
  s += v.luong([[c.vPhai(X(5)), L4], [c.cTrai(X(6)), L4]], id);
  s += v.luong([[X(6), c.cTren(L4)], [X(6), c.vDuoi(L2)]], id, 'Không đạt', [X(6) + 46, L3 + 4]);
  s += v.luong([[c.vPhai(X(6)), L2], [X(7) - c.sk, L2]], id);
  s += v.luong([[c.cPhai(X(6)), L4], [X(6) + 60, L4], [X(6) + 60, L3], [c.vTrai(X(7)), L3]], id, 'Đạt', [X(6) + 42, L4 - 9]);
  s += v.luong([[c.vPhai(X(7)), L3], [X(8) - 44, L3], [X(8) - 44, L1], [X(8) - c.sk, L1]], id);

  return v.khung(
    id, W, CAO,
    'Sơ đồ BPMN quy trình chấm công bằng khuôn mặt: kiểm tra vị trí GPS trước, sau đó kiểm tra ảnh sống rồi nhận diện khuôn mặt',
    s
  );
}

/* ======================================================================== */
/* CAC SO DO CHI TIET                                                       */
/*                                                                          */
/* Nam so do o tren ve MOT quy trinh tren MOT hinh, du de nhin ra diem ban   */
/* giao giua cac vai. Nam so do duoi tach hai quy trinh trong yeu nhat -     */
/* dat ban va thanh toan - ra tung giai doan, moi buoc ung voi mot lenh that */
/* trong ma nguon. Luoi rong hon (den 10 cot) nen dung mot bo toa do rieng,  */
/* khong dung chung COT voi nhom tren.                                       */
/* ======================================================================== */

const COT_CT = [120, 268, 416, 564, 712, 860, 1008, 1156, 1304, 1452];
const K = (i) => COT_CT[i - 1];
/** Be rong khung cho so do dung n cot: cot cuoi + nua hop cong viec + le phai. */
const rongCT = (n) => K(n) + v.VIEC_RONG / 2 + 26;

/* ======================================================================== */
/* DB-1. DAT BAN: CHON GIO, CHON BAN, GOI Y THAY THE                        */
/* ======================================================================== */

function datBanChonGio() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpDB1';
  const W1 = rongCT(9);
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W1);
  s += v.lan(LAN_Y[1], 'Trợ lý đặt bàn', W1);
  s += v.lan(LAN_Y[2], 'Web · routes/datBan.js', W1);
  s += v.lan(LAN_Y[3], 'reservationRules · Tables', W1);

  s += v.suKien(K(1), L1, 'Khách muốn đặt bàn', 'dau', true);
  s += v.viec(K(2), L2, ['B1 · Chọn ngày, giờ,', 'số khách, khu vực']);
  s += v.viec(K(3), L3, ['GET /api/dat-ban/', 'khung-gio · /kha-dung'], 'tu-dong');
  s += v.viec(K(4), L4, ['Kiểm giờ mở cửa,', 'mốc 90 ngày, ngừng', 'nhận 60 phút cuối'], 'tu-dong');
  s += v.viec(K(5), L4, ['goiYXepBan:', 'duyệt tổ hợp bàn,', 'chấm điểm và chọn'], 'tu-dong');
  s += v.cong(K(6), L4, 'Còn bàn phù hợp?', false);
  s += v.viec(K(6), L3, ['Trả ma = FULL,', 'gio_thay_the và', 'khu_thay_the'], 'tu-dong');
  s += v.viec(K(6), L2, ['Hiện nút giờ và', 'khu vực gợi ý']);
  s += v.viec(K(7), L2, ['B2 · Chọn bàn trên', 'sơ đồ mặt bằng']);
  s += v.viec(K(8), L2, ['B3 · Tên, điện thoại,', 'dịp, yêu cầu đặc biệt']);
  s += v.viec(K(9), L2, ['B4 · Đối chiếu lại,', 'xem tiền cọc']);
  s += v.suKien(K(9), L1, 'Gửi yêu cầu đặt bàn', 'cuoi', true);

  s += v.luong([[K(1) + c.sk, L1], [162, L1], [162, L2], [c.vTrai(K(2)), L2]], id);
  s += v.luong([[K(2), c.vDuoi(L2)], [K(2), L3], [c.vTrai(K(3)), L3]], id);
  s += v.luong([[K(3), c.vDuoi(L3)], [K(3), L4], [c.vTrai(K(4)), L4]], id);
  s += v.luong([[c.vPhai(K(4)), L4], [c.vTrai(K(5)), L4]], id);
  s += v.luong([[c.vPhai(K(5)), L4], [c.cTrai(K(6)), L4]], id);
  s += v.luong([[K(6), c.cTren(L4)], [K(6), c.vDuoi(L3)]], id, 'Không', [K(6) + 32, 470]);
  s += v.luong([[c.cPhai(K(6)), L4], [K(7), L4], [K(7), c.vDuoi(L2)]], id, 'Có', [K(6) + 86, L4 - 9]);
  s += v.luong([[K(6), c.vTren(L3)], [K(6), c.vDuoi(L2)]], id);
  s += v.luong([[c.vTrai(K(6)), L2], [c.vPhai(K(2)), L2]], id, 'Chọn lại giờ hoặc khu vực', [560, L2 - 9]);
  s += v.luong([[c.vPhai(K(7)), L2], [c.vTrai(K(8)), L2]], id);
  s += v.luong([[c.vPhai(K(8)), L2], [c.vTrai(K(9)), L2]], id);
  s += v.luong([[K(9), c.vTren(L2)], [K(9), L1 + c.sk]], id);

  s += v.ghiChu(500, 360, ['Hết bàn không kết thúc bằng', 'một câu báo lỗi — API trả kèm', 'giờ và khu vực đặt được thật.']);
  s += v.ghiChu(495, 597, ['Điểm thấp = tốt: 60 × số bàn + 1 × ghế thừa + 40 nếu ghép khác khu − 25 mỗi sở thích.']);

  return v.khung(
    id, W1, CAO,
    'So do BPMN chi tiet giai doan chon gio va chon ban cua quy trinh dat ban, gom nhanh het ban tra ve khung gio va khu vuc thay the',
    s
  );
}

/* ======================================================================== */
/* DB-2. DAT BAN: GHI LUOT DAT, CHONG DAT TRUNG                             */
/* ======================================================================== */

function datBanGhiNhan() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpDB2';
  const W1 = rongCT(9);
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W1);
  s += v.lan(LAN_Y[1], 'Web · routes/datBan.js', W1);
  s += v.lan(LAN_Y[2], 'reservationService · Rules', W1);
  s += v.lan(LAN_Y[3], 'MySQL — một giao dịch', W1);

  s += v.suKien(K(1), L1, 'Yêu cầu đặt bàn', 'dau', true);
  s += v.viec(K(2), L2, ['POST /api/dat-ban', '(bắt LoiDatBan → JSON)'], 'tu-dong');
  s += v.cong(K(3), L3, 'Được đặt online?', false);
  s += v.suKien(K(3), L1, ['Từ chối · mời gọi', 'trực tiếp nhà hàng'], 'cuoi', true);
  s += v.viec(K(4), L3, ['tinhTienCoc: quy', 'tắc priority nhỏ nhất'], 'tu-dong');
  s += v.viec(K(5), L3, ['goiYXepBan: chọn', 'tổ hợp bàn cho lượt này'], 'tu-dong');
  s += v.viec(K(6), L4, ['BEGIN · sinh mã', 'lượt đặt · INSERT', 'reservations'], 'tu-dong');
  s += v.viec(K(7), L4, ['chiemO · INSERT', 'reservation_slot_locks', 'mỗi ô 15 phút'], 'tu-dong');
  s += v.cong(K(8), L4, 'Trùng ô lưới?', false);
  s += v.viec(K(7), L3, ['ROLLBACK và thử', 'lại tối đa 3 lần'], 'tu-dong');
  s += v.viec(K(9), L4, ['ghiBan, nhật ký,', 'xếp thông báo,', 'COMMIT'], 'tu-dong');
  s += v.viec(K(9), L2, ['Trả mã đặt bàn, bàn,', 'tiền cọc, hạn cọc'], 'tu-dong');
  s += v.suKien(K(9), L1, 'Đặt bàn thành công', 'cuoi', true);

  s += v.luong([[K(1) + c.sk, L1], [162, L1], [162, L2], [c.vTrai(K(2)), L2]], id);
  s += v.luong([[K(2), c.vDuoi(L2)], [K(2), L3], [c.cTrai(K(3)), L3]], id);
  s += v.luong([[K(3), c.cTren(L3)], [K(3), L1 + c.sk]], id, 'Không', [K(3) + 34, 272]);
  s += v.luong([[c.cPhai(K(3)), L3], [c.vTrai(K(4)), L3]], id, 'Có', [K(3) + 52, L3 - 9]);
  s += v.luong([[c.vPhai(K(4)), L3], [c.vTrai(K(5)), L3]], id);
  s += v.luong([[K(5), c.vDuoi(L3)], [K(5), L4], [c.vTrai(K(6)), L4]], id);
  s += v.luong([[c.vPhai(K(6)), L4], [c.vTrai(K(7)), L4]], id);
  s += v.luong([[c.vPhai(K(7)), L4], [c.cTrai(K(8)), L4]], id);
  s += v.luong([[K(8), c.cTren(L4)], [K(8), L3], [c.vPhai(K(7)), L3]], id, 'Có', [K(8) + 26, 462]);
  s += v.luong([[c.vTrai(K(7)), L3], [c.vPhai(K(5)), L3]], id, 'thử lại', [K(6), L3 - 9]);
  s += v.luong([[c.cPhai(K(8)), L4], [c.vTrai(K(9)), L4]], id, 'Không', [K(8) + 52, L4 - 9]);
  s += v.luong([[K(9), c.vTren(L4)], [K(9), c.vDuoi(L2)]], id);
  s += v.luong([[K(9), c.vTren(L2)], [K(9), L1 + c.sk]], id);

  s += v.ghiChu(450, 196, ['Chỉ thử lại khi BÀN DO HỆ THỐNG chọn. Khách tự chọn bàn trên',
    'sơ đồ thì báo để khách chọn lại — đổi bàn của họ sang bàn khác',
    'mà không hỏi là làm sai ý khách.']);
  s += v.ghiChu(130, 545, ['Lưới ô 15 phút là hàng rào chống đặt trùng: khoá chính',
    '(table_id, slot_start). Một lượt 19:00–21:00 kèm 15 phút dọn',
    'bàn chiếm 9 dòng; lượt thứ hai đâm vào khoá chính và bị',
    'MySQL từ chối ngay trong giao dịch — không còn khe hở.']);

  return v.khung(
    id, W1, CAO,
    'So do BPMN chi tiet giai doan ghi luot dat ban: kiem tra quyen dat online, tinh tien coc, ghi ban ghi va chiem o luoi thoi gian trong mot giao dich, thu lai khi mat ban do dua',
    s
  );
}

/* ======================================================================== */
/* DB-3. DAT BAN: VONG DOI LUOT DAT VA VONG QUET NEN                        */
/* ======================================================================== */

function datBanVongDoi() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpDB3';
  const W1 = rongCT(10);
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W1);
  s += v.lan(LAN_Y[1], 'Nhân viên lễ tân', W1);
  s += v.lan(LAN_Y[2], 'reservationService', W1);
  s += v.lan(LAN_Y[3], 'Vòng quét nền', W1);

  s += v.suKien(K(1), L1, 'Đã có mã đặt bàn', 'dau', true);
  s += v.cong(K(2), L3, 'Cần đặt cọc?', false);
  s += v.viec(K(3), L1, ['Chuyển khoản tiền cọc', 'trước deposit_due_at']);
  s += v.viec(K(4), L2, ['Ghi nhận cọc ·', 'POST /:id/deposit']);
  s += v.viec(K(5), L3, ['deposit_status = PAID', '→ tự xác nhận lượt đặt'], 'tu-dong');
  s += v.viec(K(6), L1, ['Khách tới nhà hàng', 'đúng khung giờ']);
  s += v.viec(K(7), L2, ['Check-in → Xếp bàn', '(ARRIVED → SEATED)']);
  s += v.viec(K(8), L3, ['hold_until = NULL ·', 'bàn → Đang phục vụ'], 'tu-dong');
  s += v.viec(K(9), L2, ['Kết thúc bữa ăn', '(COMPLETED)']);
  s += v.viec(K(10), L3, ['closed_at · bàn sang', 'Đang dọn · giữ ô lưới'], 'tu-dong');
  s += v.suKien(K(10), L1, 'Lượt đặt hoàn tất', 'cuoi', true);

  s += v.suKien(K(4), L4, 'Mỗi 60 giây', 'hen-gio', true);
  s += v.viec(K(5), L4, ['quetCocQuaHan:', 'quá hạn cọc → tự', 'huỷ, nhả ô lưới'], 'tu-dong');
  s += v.viec(K(6), L4, ['quetNoShow · cảnh báo', 'rồi tự đóng NO_SHOW'], 'tu-dong');
  s += v.viec(K(7), L4, ['quetNhacLich ·', 'dongBoTrangThaiBan'], 'tu-dong');
  s += v.viec(K(8), L4, ['phatThongBao · socket', '+ email, hỏng → FAILED'], 'tu-dong');
  s += v.suKien(K(9), L4, 'Vòng quét kết thúc', 'cuoi', true);

  s += v.luong([[K(1) + c.sk, L1], [162, L1], [162, L3], [c.cTrai(K(2)), L3]], id);
  s += v.luong([[K(2), c.cTren(L3)], [K(2), L1], [c.vTrai(K(3)), L1]], id, 'Có', [K(2) + 20, 300]);
  s += v.luong([[c.cPhai(K(2)), L3], [324, L3], [324, 440], [830, 440], [830, c.vDuoi(L1)]], id,
    'Không', [356, 432]);
  s += v.luong([[c.vPhai(K(3)), L1], [K(4), L1], [K(4), c.vTren(L2)]], id);
  s += v.luong([[K(4), c.vDuoi(L2)], [K(4), L3], [c.vTrai(K(5)), L3]], id);
  s += v.luong([[K(5), c.vTren(L3)], [K(5), L1], [c.vTrai(K(6)), L1]], id);
  s += v.luong([[c.vPhai(K(6)), L1], [K(7), L1], [K(7), c.vTren(L2)]], id);
  s += v.luong([[K(7), c.vDuoi(L2)], [K(7), c.vTren(L3)]], id);
  s += v.luong([[c.vPhai(K(8)), L3], [K(9), L3], [K(9), c.vDuoi(L2)]], id);
  s += v.luong([[c.vPhai(K(9)), L2], [K(10), L2], [K(10), c.vTren(L3)]], id);
  s += v.luong([[c.vPhai(K(10)), L3], [1532, L3], [1532, L1], [K(10) + c.sk, L1]], id);

  s += v.luong([[K(4) + c.sk, L4], [c.vTrai(K(5)), L4]], id);
  s += v.luong([[c.vPhai(K(5)), L4], [c.vTrai(K(6)), L4]], id);
  s += v.luong([[c.vPhai(K(6)), L4], [c.vTrai(K(7)), L4]], id);
  s += v.luong([[c.vPhai(K(7)), L4], [c.vTrai(K(8)), L4]], id);
  s += v.luong([[c.vPhai(K(8)), L4], [K(9) - c.sk, L4]], id);

  s += v.ghiChu(330, 325, ['Huỷ bất cứ lúc nào: tinhHoanTien lấy mốc lớn nhất khách còn',
    'đáp ứng và chỉ hoàn phần ĐÃ THU; CANCELLED nhả ô lưới ngay.']);
  s += v.ghiChu(130, 478, ['Vòng quét chạy trong chính tiến trình web,',
    'mỗi việc bọc try riêng. Mọi thay đổi đều đi',
    'qua doiTrangThai() nên chạy nhiều bản sao',
    'cũng không đóng NO_SHOW hai lần.']);

  return v.khung(
    id, W1, CAO,
    'So do BPMN chi tiet vong doi mot luot dat ban tu tien coc, check-in, xep ban toi hoan tat, kem dai vong quet nen chay moi 60 giay',
    s
  );
}

/* ======================================================================== */
/* TT-1. THANH TOAN: LAP HOA DON VA MO PHIEN THU TIEN                       */
/* ======================================================================== */

function thanhToanHoaDon() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpTT1';
  const W1 = rongCT(9);
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W1);
  s += v.lan(LAN_Y[1], 'Thu ngân (POS)', W1);
  s += v.lan(LAN_Y[2], 'thanhToanService', W1);
  s += v.lan(LAN_Y[3], 'CSDL · dịch vụ VietQR', W1);

  s += v.suKien(K(1), L1, 'Khách quét QR tự trả', 'dau', true);
  s += v.suKien(K(1), L2, 'Khách xin tính tiền', 'dau');
  s += v.viec(K(2), L2, ['Chọn bàn cần tính tiền', 'trên màn hình POS']);
  s += v.viec(K(3), L3, ['layHoaDon · cộng các', 'dòng món (id_mon > 0)'], 'tu-dong');
  s += v.viec(K(4), L3, ['Áp mã giảm giá', 'và điểm · kiểm tra', 'lại ở máy chủ'], 'tu-dong');
  s += v.viec(K(5), L3, ['Phí phục vụ,', 'VAT, làm tròn → tổng', 'cộng và còn phải trả'], 'tu-dong');
  s += v.cong(K(6), L2, 'Hình thức trả?');
  s += v.viec(K(7), L3, ['taoPhien(cash) ·', 'chặn trả vượt,', 'tính tiền thối'], 'tu-dong');
  s += v.viec(K(8), L3, ['hauKyThanhToan · điểm,', 'đóng đơn, trả bàn'], 'tu-dong');
  s += v.viec(K(7), L4, ['INSERT payments', 'status = pending ·', 'mã đối soát BD…'], 'tu-dong');
  s += v.viec(K(8), L4, ['taoQRChuyenKhoan ·', 'payload EMVCo VietQR'], 'tu-dong');
  s += v.suKien(K(9), L1, 'Đã thu tiền mặt', 'cuoi', true);
  s += v.suKien(K(9), L4, 'Mã VietQR sẵn sàng', 'cuoi', true);

  s += v.luong([[K(1) + c.sk, L2], [c.vTrai(K(2)), L2]], id);
  s += v.luong([[K(1) + c.sk, L1], [K(3), L1], [K(3), c.vTren(L3)]], id);
  s += v.luong([[K(2), c.vDuoi(L2)], [K(2), L3], [c.vTrai(K(3)), L3]], id);
  s += v.luong([[c.vPhai(K(3)), L3], [c.vTrai(K(4)), L3]], id);
  s += v.luong([[c.vPhai(K(4)), L3], [c.vTrai(K(5)), L3]], id);
  s += v.luong([[K(5), c.vTren(L3)], [K(5), L2], [c.cTrai(K(6)), L2]], id);
  s += v.luong([[c.cPhai(K(6)), L2], [912, L2], [912, L3], [c.vTrai(K(7)), L3]], id,
    'Tiền mặt', [905, L2 - 9]);
  s += v.luong([[K(6), c.cDuoi(L2)], [K(6), L4], [c.vTrai(K(7)), L4]], id,
    'Chuyển khoản', [907, 330]);
  s += v.luong([[c.vPhai(K(7)), L3], [c.vTrai(K(8)), L3]], id);
  s += v.luong([[c.vPhai(K(7)), L4], [c.vTrai(K(8)), L4]], id);
  s += v.luong([[K(8), c.vTren(L3)], [K(8), L1], [K(9) - c.sk, L1]], id);
  s += v.luong([[c.vPhai(K(8)), L4], [K(9) - c.sk, L4]], id);

  s += v.ghiChu(130, 330, ['Số tiền, mã giảm giá và số điểm ghi vào payments là',
    'giá trị ĐÃ KIỂM TRA LẠI trên máy chủ, không phải số',
    'client gửi lên.']);
  s += v.ghiChu(130, 500, ['Một đơn ăn có thể trả NHIỀU LẦN — chia bill, cọc trước rồi trả nốt.',
    'Vì vậy hopdong không có cột "đã thanh toán": trạng thái tiền suy ra',
    'bằng tổng các dòng payments có status = success của cùng một sesis.']);

  return v.khung(
    id, W1, CAO,
    'So do BPMN chi tiet giai doan lap hoa don va mo phien thu tien, tach nhanh tien mat xong ngay va nhanh VietQR cho doi soat',
    s
  );
}

/* ======================================================================== */
/* TT-2. THANH TOAN: DOI SOAT VIETQR, NGOAI LE VA CHOT CA                   */
/* ======================================================================== */

function thanhToanDoiSoat() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpTT2';
  const W1 = rongCT(10);
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W1);
  s += v.lan(LAN_Y[1], 'Ngân hàng', W1);
  s += v.lan(LAN_Y[2], 'Web · thanhToanService', W1);
  s += v.lan(LAN_Y[3], 'Thu ngân', W1);

  s += v.suKien(K(1), L1, 'Khách quét mã VietQR', 'dau', true);
  s += v.viec(K(2), L1, ['Chuyển khoản, nội dung', 'là mã đối soát BD…']);
  s += v.suKien(K(3), L2, ['Ngân hàng báo có', '(webhook kiểu SePay)'], 'giua', true);
  s += v.viec(K(4), L3, ['Xác thực Apikey · ghi', 'giao_dich_ngan_hang'], 'tu-dong');
  s += v.cong(K(5), L3, ['Khớp phiên chờ', 'và đủ tiền?']);
  s += v.viec(K(5), L4, ['Đối soát tay hoặc xác', 'nhận thủ công tại POS']);
  s += v.viec(K(6), L3, ['xacNhan · UPDATE khi', 'status vẫn là pending'], 'tu-dong');
  s += v.viec(K(7), L3, ['hauKyThanhToan:', 'mã giảm giá, trừ', 'điểm, cộng điểm'], 'tu-dong');
  s += v.viec(K(8), L3, ['Thu đủ tiền →', 'tinhtrang = 3, bàn', 'chuyển sang Đang dọn'], 'tu-dong');
  s += v.viec(K(9), L3, ['Phát tt:da-thanh-toan', 'tới phòng tt:<sesis>'], 'tu-dong');
  s += v.suKien(K(10), L1, ['Khách và POS cùng', 'báo Đã thanh toán'], 'cuoi', true);

  s += v.suKien(K(7), L4, 'Hết ca thu ngân', 'hen-gio', true);
  s += v.viec(K(8), L4, ['Đếm két theo mệnh giá,', 'nhập số thực đếm']);
  s += v.viec(K(9), L4, ['Chênh lệch = thực đếm', '− tiền mặt hệ thống'], 'tu-dong');
  s += v.suKien(K(10), L4, 'Biên bản chờ duyệt', 'cuoi', true);

  s += v.luong([[K(1) + c.sk, L1], [c.vTrai(K(2)), L1]], id);
  s += v.luong([[K(2), c.vDuoi(L1)], [K(2), L2], [K(3) - c.sk, L2]], id);
  s += v.luong([[K(3) + c.sk, L2], [470, L2], [470, L3], [c.vTrai(K(4)), L3]], id);
  s += v.luong([[c.vPhai(K(4)), L3], [c.cTrai(K(5)), L3]], id);
  s += v.luong([[K(5), c.cDuoi(L3)], [K(5), c.vTren(L4)]], id, 'Không khớp', [K(5) + 52, 452]);
  s += v.luong([[c.cPhai(K(5)), L3], [c.vTrai(K(6)), L3]], id, 'Khớp', [K(5) + 52, L3 - 9]);
  s += v.luong([[c.vPhai(K(5)), L4], [K(6), L4], [K(6), c.vDuoi(L3)]], id);
  s += v.luong([[c.vPhai(K(6)), L3], [c.vTrai(K(7)), L3]], id);
  s += v.luong([[c.vPhai(K(7)), L3], [c.vTrai(K(8)), L3]], id);
  s += v.luong([[c.vPhai(K(8)), L3], [c.vTrai(K(9)), L3]], id);
  s += v.luong([[c.vPhai(K(9)), L3], [1420, L3], [1420, L1], [K(10) - c.sk, L1]], id);

  s += v.luong([[K(7) + c.sk, L4], [c.vTrai(K(8)), L4]], id);
  s += v.luong([[c.vPhai(K(8)), L4], [c.vTrai(K(9)), L4]], id);
  s += v.luong([[c.vPhai(K(9)), L4], [K(10) - c.sk, L4]], id);

  s += v.ghiChu(130, 330, ['UPDATE … WHERE status = pending là chốt chống cộng điểm',
    'hai lần khi webhook ngân hàng và thu ngân cùng xác nhận',
    'một phiên trong cùng một khoảnh khắc.']);
  s += v.ghiChu(130, 470, ['Bốn lý do KHÔNG khớp, cả bốn đều trả HTTP 200 để ngân hàng',
    'không bắn lại: nội dung không chứa mã BD · không có phiên chờ',
    'mang mã đó · khách chuyển thiếu · đã tắt tự động đối soát.']);

  return v.khung(
    id, W1, CAO,
    'So do BPMN chi tiet quy trinh doi soat tu dong mot khoan chuyen khoan VietQR, nhanh khong khop chuyen sang doi soat thu cong, va dai chot ca thu ngan cuoi ca',
    s
  );
}

module.exports = {
  phucVu, datBan, thanhToan, duBao, chamCong,
  datBanChonGio, datBanGhiNhan, datBanVongDoi, thanhToanHoaDon, thanhToanDoiSoat,
};

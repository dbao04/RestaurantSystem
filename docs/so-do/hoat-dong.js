/**
 * Ba so do hoat dong (UML activity diagram) cho ba quy trinh khong duoc ve o
 * cac so do BPMN: dat ban truc tuyen, nhap kho theo lo, va duong di cua mot
 * cau hoi qua tro ly ao.
 *
 * Vi sao khong ve lai bang BPMN: BPMN o Chuong 3 mo ta CONG VIEC CUA CON NGUOI
 * chay qua nhung vai tro nao. So do hoat dong o day di sau hon mot muc - no ve
 * ca cac nhanh re va diem dong bo BEN TRONG mot chuc nang, ke ca nhanh loi va
 * nhanh quay lui giao dich, la thu BPMN muc tong quan khong the hien.
 *
 * Ky hieu: vong tron dac = bat dau, vong tron kep = ket thuc, hop bo goc =
 * hanh dong, hinh thoi = re nhanh / hoi tu, thanh dam = tach va nhap luong
 * song song. Lan doc (cot) cho biet ai lam viec do.
 */
const v = require('./ve');

/** Mui ten gap khuc giua hai diem, dung chung cho ca ba hinh. */
const mui = (diem, id, nhan = null, viTriNhan = null) => v.luong(diem, id, nhan, viTriNhan);

/* ======================================================================== */
/* 1. DAT BAN TRUC TUYEN VA DAT COC GIU BAN                                 */
/* ======================================================================== */

function datBan() {
  const id = 'hdA';
  const W = 1240, H = 930;
  const LAN = [
    { ten: 'Khách hàng', x: 0, w: 420 },
    { ten: 'Hệ thống (web)', x: 420, w: 430 },
    { ten: 'Nhà hàng', x: 850, w: 390 },
  ];
  const K = 210, S = 635, N = 1045;
  let s = LAN.map((l) => v.lanDoc(l.x, 0, l.w, H, l.ten)).join('');

  s += v.nutDau(K, 90);
  const a1 = v.hanhDong(K, 160, ['Chọn món trong thực đơn,', 'thêm vào giỏ hàng']);
  const a2 = v.hanhDong(K, 250, ['Nhập ngày đến, giờ đến', 'và số khách']);
  const a3 = v.hanhDong(340, 350, ['Sửa lại ngày giờ']);
  const b1 = v.hanhDong(S, 350, ['Ghi đơn: sinh mã phiên sesis,', 'ghi từng dòng món vào hopdong'], { lop: 'tu-dong' });
  const b2 = v.hanhDong(S, 530, ['Hiện trang hợp đồng kèm', 'số tiền cọc theo tỉ lệ cấu hình'], { lop: 'tu-dong' });
  const b3 = v.hanhDong(S, 760, ['Sinh mã VietQR đúng số tiền cọc,', 'chờ webhook ngân hàng đối soát'], { lop: 'tu-dong' });
  const c1 = v.hanhDong(N, 530, ['Gọi lại xác nhận', 'và giữ bàn cho khách']);
  [a1, a2, a3, b1, b2, b3, c1].forEach((x) => { s += x.svg; });

  s += v.quyetDinh(S, 250, ['Ngày giờ hợp lệ?'], { tren: true });
  s += v.quyetDinh(K, 650, ['Đặt cọc ngay?'], { tren: true });
  s += v.thanhDongBo(S, 440, 300);          // tach luong: bao nha hang + hien hop dong
  s += v.nutCuoi(K, 850);
  s += v.nutCuoi(N, 630);

  s += mui([[K, 100], [K, a1.canh.tren]], id);
  s += mui([[K, a1.canh.duoi], [K, a2.canh.tren]], id);
  s += mui([[a2.canh.phai, 250], [S - 30, 250]], id);
  s += mui([[S, 274], [S, b1.canh.tren]], id, 'hợp lệ', [S + 34, 310]);
  // Nhanh khong hop le di VONG LEN tren roi moi xuong: di sang phai va xuong se
  // cat qua hop "Ghi don" cua lan He thong.
  s += mui([[S, 226], [S, 196], [340, 196], [340, a3.canh.tren]], id, 'ngày ở quá khứ', [470, 190]);
  s += mui([[a3.canh.trai, 350], [40, 350], [40, 250], [a2.canh.trai, 250]], id);
  s += mui([[S, b1.canh.duoi], [S, 437]], id);
  s += mui([[S, 443], [S, b2.canh.tren]], id);
  s += mui([[S + 150, 443], [N, 443], [N, c1.canh.tren]], id);
  s += mui([[N, c1.canh.duoi], [N, 618]], id);
  s += mui([[b2.canh.trai, 530], [K, 530], [K, 624]], id);
  s += mui([[K + 30, 650], [S, 650], [S, b3.canh.tren]], id, 'có', [K + 70, 644]);
  s += mui([[K, 676], [K, 838]], id, 'để trả sau tại quầy', [K + 92, 730]);
  s += mui([[b3.canh.trai, 760], [K + 70, 760], [K + 70, 850], [K + 12, 850]], id, 'đã cọc', [K + 116, 820]);

  s += v.ghiChu(20, 898, [
    'Nhánh “ngày ở quá khứ” là ràng buộc được kiểm tra ở phía máy chủ chứ không chỉ ở trình duyệt: thuộc tính min của ô ngày',
    'trên form chỉ ngăn thao tác nhầm, còn người gửi thẳng yêu cầu HTTP vẫn có thể bỏ qua nó.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ hoạt động quy trình đặt bàn trực tuyến kèm nhánh đặt cọc giữ bàn bằng VietQR', s);
}

/* ======================================================================== */
/* 2. NHAP KHO THEO LO VA TRU KHO TU DONG                                   */
/* ======================================================================== */

function nhapKho() {
  const id = 'hdB';
  const W = 1240, H = 940;
  const LAN = [
    { ten: 'Thủ kho', x: 0, w: 400 },
    { ten: 'Hệ thống', x: 400, w: 450 },
    { ten: 'Bếp (màn hình KDS)', x: 850, w: 390 },
  ];
  const T = 200, S = 625, B = 1045;
  let s = LAN.map((l) => v.lanDoc(l.x, 0, l.w, H, l.ten)).join('');

  s += v.nutDau(T, 90);
  const a1 = v.hanhDong(T, 160, ['Tạo phiếu nhập,', 'chọn nhà cung cấp']);
  const a2 = v.hanhDong(T, 250, ['Nhập từng lô: số lượng, giá,', 'số lô và hạn sử dụng']);
  const a3 = v.hanhDong(T, 700, ['Nhận cảnh báo thiếu nguyên liệu,', 'nhập bù hoặc báo hết món']);
  const b1 = v.hanhDong(S, 250, ['Ghi phieu_nhap + chi_tiet_phieu_nhap,', 'cộng tồn cho nguyen_lieu'], { lop: 'tu-dong' });
  const b2 = v.hanhDong(S, 430, ['Cảnh báo lô sắp hết hạn', 'trên dashboard tồn kho'], { lop: 'tu-dong' });
  const b3 = v.hanhDong(S, 610, ['Mở giao dịch: đọc cong_thuc,', 'trừ tồn theo lô FIFO,', 'ghi nhật ký xuat_kho'], { lop: 'tu-dong' });
  const b4 = v.hanhDong(S, 800, ['Xác nhận giao dịch, phát sự kiện', 'cho KDS và sơ đồ bàn'], { lop: 'tu-dong' });
  const c1 = v.hanhDong(B, 520, ['Bấm “Hoàn thành”', 'cho một món đang nấu']);
  [a1, a2, a3, b1, b2, b3, b4, c1].forEach((x) => { s += x.svg; });

  s += v.thanhDongBo(S, 340, 320);           // tach: cap nhat ton + canh bao han dung
  s += v.quyetDinh(S, 700, ['Đủ nguyên liệu?'], { tren: true });
  s += v.nutCuoi(S, 870);
  s += v.nutCuoi(S + 190, 430);              // nhanh canh bao han dung ket thuc rieng

  s += mui([[T, 100], [T, a1.canh.tren]], id);
  s += mui([[T, a1.canh.duoi], [T, a2.canh.tren]], id);
  s += mui([[a2.canh.phai, 250], [b1.canh.trai, 250]], id);
  s += mui([[S, b1.canh.duoi], [S, 337]], id);
  s += mui([[S, 343], [S, b2.canh.tren]], id);
  s += mui([[b2.canh.phai, 430], [S + 178, 430]], id);
  s += mui([[S + 140, 343], [B, 343], [B, c1.canh.tren]], id, 'chờ bếp bán món', [B + 82, 420]);
  s += mui([[c1.canh.trai, 520], [S, 520], [S, b3.canh.tren]], id);
  s += mui([[S, b3.canh.duoi], [S, 674]], id);
  s += mui([[S, 726], [S, b4.canh.tren]], id, 'đủ', [S + 26, 754]);
  s += mui([[S - 30, 700], [a3.canh.phai, 700]], id, 'thiếu', [S - 90, 694]);
  // Thieu nguyen lieu thi quay ve buoc nhap hang chu khong ket thuc quy trinh.
  s += mui([[T, a3.canh.tren], [T, 290], [a2.canh.phai - 40, 290], [a2.canh.phai - 40, a2.canh.duoi]], id);
  s += mui([[S, b4.canh.duoi], [S, 858]], id);

  s += v.ghiChu(20, 906, [
    'Thời điểm trừ kho đặt ở bước bếp HOÀN THÀNH món, không phải lúc khách gọi món hay lúc thanh toán: đơn có thể bị huỷ',
    'sau khi gọi, còn nguyên liệu thì đã thực sự tiêu hao ngay khi bếp nấu xong.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ hoạt động quy trình nhập kho theo lô và cơ chế trừ tồn kho tự động khi bếp hoàn thành món', s);
}

/* ======================================================================== */
/* 3. DUONG DI CUA MOT CAU HOI QUA TRO LY AO                                */
/* ======================================================================== */

function troLyAo() {
  const id = 'hdC';
  const W = 1240, H = 950;
  const LAN = [
    { ten: 'Người dùng', x: 0, w: 380 },
    { ten: 'Web (Node)', x: 380, w: 390 },
    { ten: 'Dịch vụ chatbot (Python)', x: 770, w: 470 },
  ];
  const N = 190, W2 = 575, B = 1005;
  let s = LAN.map((l) => v.lanDoc(l.x, 0, l.w, H, l.ten)).join('');

  s += v.nutDau(N, 90);
  const a1 = v.hanhDong(N, 160, ['Gõ câu hỏi trong khung chat']);
  const a2 = v.hanhDong(N, 800, ['Đọc câu trả lời,', 'bấm đánh giá hài lòng']);
  const w1 = v.hanhDong(W2, 250, ['Xác định quyền của người hỏi', 'theo phiên đăng nhập'], { lop: 'tu-dong' });
  const w2 = v.hanhDong(W2, 610, ['Trả lời dự phòng và mời', 'chuyển sang nhân viên trực']);
  const w3 = v.hanhDong(W2, 800, ['Ghi chatbot_hoi_thoai', 'để phục vụ vòng lặp cải tiến'], { lop: 'tu-dong' });
  const b1 = v.hanhDong(B, 250, ['① Tiền xử lý: chuẩn hoá teencode,', 'bỏ dấu câu, gom khoảng trắng']);
  const b2 = v.hanhDong(B, 350, ['② Phân loại ý định: TF-IDF từ (1–2 gram)', '⊕ TF-IDF n-gram ký tự (2–5)']);
  const b3 = v.hanhDong(B, 540, ['③ Trích tham số: khoảng thời gian,', 'tên món, tên nguyên liệu']);
  const b4 = v.hanhDong(B, 640, ['④ Chạy mẫu SQL có tham số', '(không sinh SQL tự do)']);
  const b5 = v.hanhDong(B, 740, ['⑤ Sinh câu trả lời tiếng Việt', 'kèm bảng số liệu và biểu đồ']);
  [a1, a2, w1, w2, w3, b1, b2, b3, b4, b5].forEach((x) => { s += x.svg; });

  s += v.quyetDinh(B, 450, ['Độ tin cậy ≥ ngưỡng?'], { tren: true });
  s += v.nutCuoi(N, 880);

  s += mui([[N, 100], [N, a1.canh.tren]], id);
  s += mui([[a1.canh.phai, 160], [W2, 160], [W2, w1.canh.tren]], id);
  s += mui([[w1.canh.phai, 250], [b1.canh.trai, 250]], id);
  s += mui([[B, b1.canh.duoi], [B, b2.canh.tren]], id);
  s += mui([[B, b2.canh.duoi], [B, 424]], id);
  s += mui([[B, 476], [B, b3.canh.tren]], id, 'đạt', [B + 30, 508]);
  s += mui([[B - 30, 450], [w2.canh.phai + 60, 450], [w2.canh.phai + 60, 610], [w2.canh.phai, 610]], id, 'dưới ngưỡng', [B - 110, 444]);
  s += mui([[B, b3.canh.duoi], [B, b4.canh.tren]], id);
  s += mui([[B, b4.canh.duoi], [B, b5.canh.tren]], id);
  s += mui([[b5.canh.trai, 740], [W2, 740], [W2, w3.canh.tren]], id);
  s += mui([[w2.canh.trai, 610], [N, 610], [N, a2.canh.tren]], id);
  s += mui([[w3.canh.trai, 800], [a2.canh.phai, 800]], id);
  s += mui([[N, a2.canh.duoi], [N, 868]], id);

  s += v.ghiChu(20, 916, [
    'Tầng ④ là lớp bảo vệ quan trọng nhất: mô hình chỉ chọn MẪU câu truy vấn và điền tham số đã kiểm tra kiểu, chứ không',
    'sinh chuỗi SQL tự do. Nhờ vậy một câu hỏi bịa đặt cũng không thể trở thành lệnh xoá dữ liệu.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ hoạt động đường đi của một câu hỏi qua năm tầng xử lý của trợ lý ảo tiếng Việt', s);
}

module.exports = { datBan, nhapKho, troLyAo };

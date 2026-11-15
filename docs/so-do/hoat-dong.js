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

/**
 * Nhan cau hoi dat CANH hinh thoi thay vi tren / duoi: dat tren hoac duoi thi
 * chu nam de len duong luong doc di vao / di ra khoi hinh thoi.
 */
const nhanQD = (x, y, chu, ben = 'phai') =>
  `<text class="tx-sk" x="${x}" y="${y}" style="text-anchor:${ben === 'phai' ? 'start' : 'end'}">${v.esc(chu)}</text>`;

/* ======================================================================== */
/* 1. DAT BAN TRUC TUYEN VA DAT COC GIU BAN                                 */
/* ======================================================================== */

function datBan() {
  const id = 'hdA';
  const W = 1320, H = 1720;
  const LAN = [
    { ten: 'Khách hàng', x: 0, w: 430 },
    { ten: 'Hệ thống (web + CSDL)', x: 430, w: 470 },
    { ten: 'Nhân viên nhà hàng', x: 900, w: 420 },
  ];
  const K = 215, S = 665, N = 1110;
  let s = LAN.map((l) => v.lanDoc(l.x, 0, l.w, H, l.ten)).join('');

  /* --- hanh dong --- */
  s += v.nutDau(K, 90);
  s += v.nutDau(N, 90);
  const a1 = v.hanhDong(K, 160, ['Bước 1: đọc chính sách đặt cọc', 'và hoàn huỷ, tích “Tôi đồng ý”']);
  const a2 = v.hanhDong(K, 260, ['Bước 2: chọn ngày, giờ đến,', 'số khách, khu vực mong muốn']);
  const a3 = v.hanhDong(K, 380, ['Xem lý do bị từ chối,', 'chọn lại ngày giờ / khu vực']);
  const a4 = v.hanhDong(K, 600, ['Xem khung giờ và khu vực', 'còn trống được gợi ý thay thế']);
  const a5 = v.hanhDong(K, 720, ['Bước 4: gọi món trước (tuỳ chọn),', 'được đổi món tới hạn chốt']);
  const a6 = v.hanhDong(K, 830, ['Bước 5: nhập họ tên, SĐT, email,', 'dịp đặc biệt, yêu cầu riêng']);
  const a7 = v.hanhDong(K, 1180, ['Quét mã VietQR, chuyển khoản', 'trước hạn nộp cọc']);
  const a8 = v.hanhDong(K, 1500, ['Nhận mã đặt bàn qua email,', 'tra cứu / đổi lịch / huỷ bằng mã + SĐT']);

  const b1 = v.hanhDong(S, 260, ['Kiểm tra: không ở quá khứ, không quá xa,', 'trong giờ mở cửa, không sát giờ,',
    'SĐT không bị chặn, chưa vượt ngưỡng no-show'], { lop: 'tu-dong' });
  const b2 = v.hanhDong(S, 490, ['Bước 3: xếp bàn tự động theo quy mô', 'và khu vực, ghép bàn khi cần',
    '(hoặc giữ bàn khách chọn trên sơ đồ)'], { lop: 'tu-dong' });
  const b3 = v.hanhDong(S, 834, ['Tính tiền cọc theo chính sách:', 'đặt món trước → 100% tiền món',
    'đoàn ≥ ngưỡng tiệc (cấu hình, đang là 10)', '→ tối thiểu 150.000đ / khách',
    'giờ cao điểm hoặc ≥ 6 khách → 100.000đ / khách',
    'các trường hợp còn lại → miễn cọc'], { lop: 'tu-dong' });
  const b4 = v.hanhDong(S, 960, ['Một giao dịch CSDL: ghi reservations,', 'khoá ô reservation_slot_locks,',
    'món đặt trước, lịch sử trạng thái'], { lop: 'tu-dong' });
  const b5 = v.hanhDong(S, 1270, ['Webhook ngân hàng đối soát nội dung', 'chuyển khoản → cọc PAID'], { lop: 'tu-dong' });

  const c0 = v.hanhDong(N, 160, ['Nhận đặt bàn qua điện thoại', 'hoặc khách đến trực tiếp']);
  const c1 = v.hanhDong(N, 1500, ['Xác nhận lượt đặt', '(PENDING → CONFIRMED) hoặc từ chối']);
  const c2 = v.hanhDong(N, 1600, ['Đón khách, xếp vào bàn', '(ARRIVED → SEATED → COMPLETED)']);
  [a1, a2, a3, a4, a5, a6, a7, a8, b1, b2, b3, b4, b5, c0, c1, c2].forEach((x) => { s += x.svg; });

  /* --- re nhanh, hoi tu, dong bo --- */
  s += v.quyetDinh(S, 380, []) + nhanQD(S + 40, 366, 'Hợp lệ?');
  s += v.quyetDinh(S, 600, []) + nhanQD(S + 40, 586, 'Còn bàn phù hợp?');
  s += v.quyetDinh(S, 1080, []) + nhanQD(S - 40, 1066, 'Ghi thành công?', 'trai');
  s += v.quyetDinh(S, 1180, []) + nhanQD(S - 40, 1160, 'Cần đặt cọc?', 'trai');
  s += v.quyetDinh(S, 1360, []);                 // hoi tu hai nhanh coc / mien coc
  s += v.thanhDongBo(S, 1420, 360);
  s += v.nutCuoi(K, 1600);
  s += v.nutCuoi(N, 1670);

  /* --- luong --- */
  s += mui([[K, 100], [K, a1.canh.tren]], id);
  s += mui([[K, a1.canh.duoi], [K, a2.canh.tren]], id);
  s += mui([[a2.canh.phai, 260], [b1.canh.trai, 260]], id);
  s += mui([[N, 100], [N, c0.canh.tren]], id);
  s += mui([[N, c0.canh.duoi], [N, 228], [b1.canh.phai + 40, 228], [b1.canh.phai + 40, 252], [b1.canh.phai, 252]], id,
    'tạo hộ, bỏ qua giới hạn sát giờ', [N - 140, 220]);
  s += mui([[S, b1.canh.duoi], [S, 354]], id);
  s += mui([[S - 32, 380], [a3.canh.phai, 380]], id, 'không', [S - 80, 372]);
  s += mui([[a3.canh.trai, 380], [36, 380], [36, 268], [a2.canh.trai, 268]], id);
  s += mui([[S, 406], [S, b2.canh.tren]], id, 'hợp lệ', [S + 34, 430]);
  s += mui([[S, b2.canh.duoi], [S, 574]], id);
  s += mui([[S - 32, 600], [a4.canh.phai, 600]], id, 'hết bàn', [S - 84, 592]);
  s += mui([[K, a4.canh.tren], [K, a3.canh.duoi]], id);
  s += mui([[S, 626], [S, 676], [K, 676], [K, a5.canh.tren]], id, 'còn', [S + 22, 660]);
  s += mui([[K, a5.canh.duoi], [K, a6.canh.tren]], id);
  s += mui([[a6.canh.phai, 830], [b3.canh.trai, 830]], id);
  s += mui([[S, b3.canh.duoi], [S, b4.canh.tren]], id);
  s += mui([[S, b4.canh.duoi], [S, 1054]], id);
  // Mat ban do hai khach dat cung luc: CSDL chan trung o reservation_slot_locks,
  // he thong xep lai ban khac (toi da 3 lan) thay vi bao loi ngay.
  s += mui([[S + 32, 1080], [S + 210, 1080], [S + 210, 490], [b2.canh.phai, 490]], id,
    'bị giữ mất → xếp lại', [S + 120, 1072]);
  s += mui([[S, 1106], [S, 1154]], id, 'đã ghi', [S + 30, 1132]);
  s += mui([[S - 32, 1180], [a7.canh.phai, 1180]], id, 'có', [S - 150, 1172]);
  s += mui([[K, a7.canh.duoi], [K, 1270], [b5.canh.trai, 1270]], id);
  s += mui([[S, b5.canh.duoi], [S, 1334]], id);
  s += mui([[S + 32, 1180], [S + 190, 1180], [S + 190, 1360], [S + 32, 1360]], id, 'miễn cọc', [S + 130, 1172]);
  s += mui([[S, 1386], [S, 1417]], id);
  s += mui([[S - 160, 1423], [K, 1423], [K, a8.canh.tren]], id);
  s += mui([[S + 160, 1423], [N, 1423], [N, c1.canh.tren]], id);
  s += mui([[K, a8.canh.duoi], [K, 1588]], id);
  s += mui([[N, c1.canh.duoi], [N, c2.canh.tren]], id);
  s += mui([[N, c2.canh.duoi], [N, 1658]], id);

  s += v.ghiChu(20, 1674, [
    'Mọi kiểm tra ở làn Hệ thống chạy trên máy chủ, không chỉ trên trình duyệt; tiền cọc tính từ giá món trong thực đơn, không tin số tiền trình duyệt gửi.',
    'Hai khách cùng giữ một bàn: CSDL chặn trùng ở reservation_slot_locks, hệ thống tự xếp bàn khác tối đa 3 lần. Lượt quá hạn cọc hoặc không đến',
    'sau thời gian giữ bàn được vòng quét nền tự huỷ / đánh dấu no-show.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ hoạt động quy trình đặt bàn trực tuyến sáu bước: kiểm tra ràng buộc, xếp bàn, gọi món trước, tính và thu tiền cọc', s);
}

/* ======================================================================== */
/* 2. NHAP KHO THEO LO VA TRU KHO TU DONG                                   */
/* ======================================================================== */

function nhapKho() {
  const id = 'hdB';
  const W = 1420, H = 1440;
  const LAN = [
    { ten: 'Bếp', x: 0, w: 340 },
    { ten: 'Quản lý (người duyệt)', x: 340, w: 330 },
    { ten: 'Hệ thống (web + CSDL)', x: 670, w: 420 },
    { ten: 'Thủ kho / người nhận hàng', x: 1090, w: 330 },
  ];
  const B = 170, Q = 505, S = 880, T = 1255;
  let s = LAN.map((l) => v.lanDoc(l.x, 0, l.w, H, l.ten)).join('');

  s += v.nutDau(S, 80);
  const s1 = v.hanhDong(S, 160, ['Tính gợi ý mua: tồn + hàng đang về', 'dưới điểm đặt = max(định mức, 3 ngày',
    'tiêu hao); đề xuất đủ 7 ngày tiêu hao'], { lop: 'tu-dong' });
  const b1 = v.hanhDong(B, 160, ['Xem gợi ý mua, chọn', 'nhà cung cấp, lập đơn mua']);
  const s2 = v.hanhDong(S, 270, ['Ghi don_mua_hang (cho_duyet)', '+ chi_tiet_don_mua'], { lop: 'tu-dong' });
  const q1 = v.hanhDong(Q, 370, ['Xem đơn chờ duyệt', '(người lập không tự duyệt)']);
  const b2 = v.hanhDong(B, 470, ['Nhận đơn bị huỷ', 'kèm lý do']);
  const q2 = v.hanhDong(Q, 570, ['Gửi đơn cho nhà cung cấp', '(Đặt hàng → da_dat)']);
  const t1 = v.hanhDong(T, 680, ['Nhận hàng, đối chiếu đơn,', 'lập phiếu nhập: số lô,', 'hạn dùng, đơn giá']);
  const s4 = v.hanhDong(S, 790, ['Một giao dịch: ghi phieu_nhap + lô,', 'cộng tồn nguyen_lieu, tính lại giá vốn',
    'bình quân gia quyền, cộng số đã nhận'], { lop: 'tu-dong' });
  const s5 = v.hanhDong(S, 1010, ['Đơn → da_nhan; lô mới vào sổ kho,', 'cảnh báo lô sắp hết hạn (≤ 3 ngày)'], { lop: 'tu-dong' });
  const b3 = v.hanhDong(B, 1130, ['Bấm “Hoàn thành” một món', 'trên màn hình bếp (KDS)']);
  const s6 = v.hanhDong(S, 1130, ['Đọc cong_thuc × số phần, trừ tồn', '(không âm), trừ lô hết hạn sớm nhất',
    'trước, ghi xuat_kho kèm giá vốn'], { lop: 'tu-dong' });
  const s7 = v.hanhDong(S, 1340, ['Xác nhận giao dịch, phát sự kiện', 'realtime cho KDS và sơ đồ bàn'], { lop: 'tu-dong' });
  [s1, b1, s2, q1, b2, q2, t1, s4, s5, b3, s6, s7].forEach((x) => { s += x.svg; });

  s += v.quyetDinh(Q, 470, []) + nhanQD(Q + 40, 456, 'Duyệt?');
  s += v.quyetDinh(S, 900, []) + nhanQD(S - 40, 886, 'Đã nhận đủ?', 'trai');
  s += v.quyetDinh(S, 1240, []) + nhanQD(S + 40, 1226, 'Tồn dưới điểm đặt?');
  const q3 = v.hanhDong(Q, 1240, ['Nguyên liệu hiện trong gợi ý mua,', 'bắt đầu một vòng mua mới']);
  s += q3.svg;
  s += v.nutCuoi(Q, 1330);
  s += v.nutDau(B, 1050);
  s += v.nutCuoi(B, 550);
  s += v.nutCuoi(S, 1070);
  s += v.nutCuoi(S, 1410);

  // Mua hang
  s += mui([[S, 90], [S, s1.canh.tren]], id);
  s += mui([[s1.canh.trai, 160], [b1.canh.phai, 160]], id);
  s += mui([[B, b1.canh.duoi], [B, 270], [s2.canh.trai, 270]], id);
  s += mui([[S, s2.canh.duoi], [S, 320], [Q, 320], [Q, q1.canh.tren]], id);
  s += mui([[Q, q1.canh.duoi], [Q, 444]], id);
  s += mui([[Q - 32, 470], [b2.canh.phai, 470]], id, 'từ chối → huy', [Q - 100, 462]);
  s += mui([[B, b2.canh.duoi], [B, 538]], id);
  s += mui([[Q, 496], [Q, q2.canh.tren]], id, 'duyệt → da_duyet', [Q + 62, 522]);
  s += mui([[Q, q2.canh.duoi], [Q, 620], [T, 620], [T, t1.canh.tren]], id, 'hàng về', [S, 612]);
  s += mui([[t1.canh.trai, 680], [S, 680], [S, s4.canh.tren]], id);
  s += mui([[S, s4.canh.duoi], [S, 874]], id);
  s += mui([[S + 32, 900], [T, 900], [T, t1.canh.duoi]], id, 'thiếu → nhan_mot_phan', [T - 95, 892]);
  s += mui([[S, 926], [S, s5.canh.tren]], id, 'đủ', [S + 20, 952]);
  s += mui([[S, s5.canh.duoi], [S, 1058]], id);

  // Ban hang tru kho
  s += mui([[B, 1060], [B, b3.canh.tren]], id);
  s += mui([[b3.canh.phai, 1130], [s6.canh.trai, 1130]], id);
  s += mui([[S, s6.canh.duoi], [S, 1214]], id);
  s += mui([[S, 1266], [S, s7.canh.tren]], id, 'không', [S + 28, 1292]);
  s += mui([[S - 32, 1240], [q3.canh.phai, 1240]], id, 'có', [S - 70, 1232]);
  s += mui([[Q, q3.canh.duoi], [Q, 1318]], id);
  s += mui([[S, s7.canh.duoi], [S, 1398]], id);

  s += v.ghiChu(20, 1384, [
    'Trừ kho đặt ở bước bếp HOÀN THÀNH món: đơn có thể huỷ sau khi gọi, còn',
    'nguyên liệu đã tiêu hao khi nấu xong. Tồn không bao giờ âm; nguyên liệu',
    'xuống dưới điểm đặt hàng tự quay về vòng gợi ý mua. Phiếu xuất hỏng / hao',
    'hụt cũng trừ lô theo cùng thứ tự hạn dùng.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ hoạt động vòng mua hàng, nhập kho theo lô và trừ tồn kho tự động khi bếp hoàn thành món', s);
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

/* ======================================================================== */
/* 4. XU LY MOT DON DAT TIEC                                                */
/* ======================================================================== */

function datTiec() {
  const id = 'hdD';
  const W = 1320, H = 1380;
  const LAN = [
    { ten: 'Khách hàng', x: 0, w: 430 },
    { ten: 'Hệ thống (web + CSDL)', x: 430, w: 470 },
    { ten: 'Nhân viên xử lý tiệc', x: 900, w: 420 },
  ];
  const K = 215, S = 665, N = 1110;
  let s = LAN.map((l) => v.lanDoc(l.x, 0, l.w, H, l.ten)).join('');

  s += v.nutDau(K, 90);
  const a1 = v.hanhDong(K, 160, ['Xem không gian, chọn loại tiệc,', 'sảnh, buổi, giờ bắt đầu, số khách']);
  const a2 = v.hanhDong(K, 260, ['Chọn thực đơn (giá / bàn 10 khách),', 'dịch vụ thêm; gửi yêu cầu']);
  const a3 = v.hanhDong(K, 370, ['Xem lý do, chọn sảnh /', 'buổi / ngày khác']);
  const a4 = v.hanhDong(K, 480, ['Nhận mã tiệc, chờ nhà hàng', 'gọi lại tư vấn']);
  const a5 = v.hanhDong(K, 880, ['Nộp cọc: tiền mặt / chuyển khoản /', 'quét QR / thẻ — chia được nhiều đợt']);

  const b1 = v.hanhDong(S, 260, ['Kiểm tra: đặt trước ≥ 3 ngày và ≤ 12 tháng,', 'số khách trong sức chứa của sảnh,',
    'sảnh chưa có tiệc giữ chỗ cùng buổi'], { lop: 'tu-dong' });
  const b2 = v.hanhDong(S, 480, ['Dự toán = thực đơn × số bàn + dịch vụ;', 'tiền cọc = 30% dự toán;',
    'ghi dat_tiec (MOI) + dòng lịch sử'], { lop: 'tu-dong' });
  const b3 = v.hanhDong(S, 690, ['Kiểm tra lại: sảnh chưa bị tiệc', 'khác giữ cùng buổi'], { lop: 'tu-dong' });
  const b5 = v.hanhDong(S, 990, ['Cộng da_coc, ghi dat_tiec_thanh_toan;', 'đủ cọc → tự chuyển DA_COC'], { lop: 'tu-dong' });

  const c1 = v.hanhDong(N, 590, ['Gọi tư vấn, chốt thực đơn,', 'sửa đơn (MOI → DA_LIEN_HE)']);
  const c2 = v.hanhDong(N, 690, ['Xác nhận lịch', '(DA_LIEN_HE → DA_XAC_NHAN)']);
  const c3 = v.hanhDong(N, 790, ['Báo khách đổi buổi / sảnh']);
  const c4 = v.hanhDong(N, 990, ['Ghi nhận khoản thu,', 'mã giao dịch, người thu']);
  const c5 = v.hanhDong(N, 1200, ['Phân công nhân viên, tổ chức tiệc,', 'tất toán (DA_COC → HOAN_THANH)']);
  [a1, a2, a3, a4, a5, b1, b2, b3, b5, c1, c2, c3, c4, c5].forEach((x) => { s += x.svg; });

  s += v.quyetDinh(S, 370, []) + nhanQD(S + 40, 356, 'Hợp lệ?');
  s += v.quyetDinh(S, 790, []) + nhanQD(S - 40, 776, 'Trùng lịch?', 'trai');
  s += v.quyetDinh(S, 1100, []) + nhanQD(S + 40, 1086, 'Đã đủ cọc?');
  s += v.nutCuoi(K, 570);
  s += v.nutCuoi(N, 1290);

  s += mui([[K, 100], [K, a1.canh.tren]], id);
  s += mui([[K, a1.canh.duoi], [K, a2.canh.tren]], id);
  s += mui([[a2.canh.phai, 260], [b1.canh.trai, 260]], id);
  s += mui([[S, b1.canh.duoi], [S, 344]], id);
  s += mui([[S - 32, 370], [a3.canh.phai, 370]], id, 'không', [S - 80, 362]);
  s += mui([[a3.canh.trai, 370], [36, 370], [36, 268], [a2.canh.trai, 268]], id);
  s += mui([[S, 396], [S, b2.canh.tren]], id, 'hợp lệ', [S + 34, 424]);
  s += mui([[b2.canh.trai, 480], [a4.canh.phai, 480]], id);
  s += mui([[K, a4.canh.duoi], [K, 558]], id);
  s += mui([[S, b2.canh.duoi], [S, 540], [N, 540], [N, c1.canh.tren]], id, 'thông báo yêu cầu mới', [N - 150, 532]);
  s += mui([[N, c1.canh.duoi], [N, c2.canh.tren]], id);
  s += mui([[c2.canh.trai, 690], [b3.canh.phai, 690]], id);
  s += mui([[S, b3.canh.duoi], [S, 764]], id);
  s += mui([[S + 32, 790], [c3.canh.trai, 790]], id, 'trùng', [S + 80, 782]);
  s += mui([[c3.canh.phai, 790], [N + 190, 790], [N + 190, 590], [c1.canh.phai, 590]], id);
  s += mui([[S, 816], [S, 840], [K, 840], [K, a5.canh.tren]], id, 'không trùng → giữ sảnh', [S - 110, 832]);
  s += mui([[K, a5.canh.duoi], [K, 940], [N, 940], [N, c4.canh.tren]], id);
  s += mui([[c4.canh.trai, 990], [b5.canh.phai, 990]], id);
  s += mui([[S, b5.canh.duoi], [S, 1074]], id);
  s += mui([[S - 32, 1100], [40, 1100], [40, 888], [a5.canh.trai, 888]], id, 'chưa đủ → thu tiếp', [S - 150, 1092]);
  s += mui([[S, 1126], [S, 1150], [N, 1150], [N, c5.canh.tren]], id, 'đủ', [S + 24, 1142]);
  s += mui([[N, c5.canh.duoi], [N, 1278]], id);

  s += v.ghiChu(20, 1318, [
    'Huỷ được ở mọi bước trước HOÀN THÀNH và bắt buộc ghi lý do. Tiền hoàn tính theo số ngày còn lại trước ngày tiệc: ≥ 7 ngày hoàn 100%,',
    '3–6 ngày hoàn 50%, dưới 3 ngày không hoàn; nhà hàng chủ động huỷ luôn hoàn 100%. Chỉ đơn ĐÃ XÁC NHẬN / ĐÃ CỌC mới giữ sảnh,',
    'nên một yêu cầu mới chưa ai gọi lại không khoá được sảnh của một ngày cuối tuần. Mỗi lần đổi trạng thái hay thu tiền đều ghi lịch sử.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ hoạt động quy trình xử lý một đơn đặt tiệc: kiểm tra sảnh, dự toán, tư vấn, xác nhận lịch, thu cọc nhiều đợt và tất toán', s);
}

module.exports = { datBan, nhapKho, troLyAo, datTiec };

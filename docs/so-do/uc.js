/**
 * Bay so do use case (UML): mot so do tong quat + sau so do phan ra theo nhom
 * tac nhan. Noi dung lay tu chinh ma nguon (server.js, routes/, services/).
 */
const v = require('./ve');

/** Diem tren e-lip theo huong nhin ve (tx, ty) - dung de cat duong lien ket. */
function tren(cx, cy, rx, ry, tx, ty) {
  const dx = tx - cx;
  const dy = ty - cy;
  const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
  return [round(cx + dx * t), round(cy + dy * t)];
}
const round = (n) => Math.round(n * 10) / 10;

/* ======================================================================== */
/* 1. SO DO USE CASE TONG QUAT                                              */
/* ======================================================================== */

function tongQuat() {
  const RX = 128;
  const RY = 32;
  const A = 462; // tam cot trai
  const B = 762; // tam cot phai
  const HANG = [140, 260, 380, 500, 620, 740];

  const goiA = [
    ['Đặt bàn & gọi món'],
    ['Chăm sóc khách hàng'],
    ['Phục vụ tại bàn', '& sơ đồ bàn 40 bàn / 4 khu'],
    ['Chế biến món (KDS)'],
    ['Kho & nguyên liệu'],
    ['Chấm công & lịch làm việc'],
  ];
  // Thu tu cot phai xep theo do gan voi tac nhan ben phai. "Dự báo & gợi ý AI"
  // dat o hang cuoi de duong noi toi hop Dich vu ML (goc duoi phai) khong phai
  // cat ngang qua cac e-lip khac.
  const goiB = [
    ['Thanh toán & hoá đơn'],
    ['Kế toán & tiền lương'],
    ['Phân tích vận hành'],
    ['Cơ cấu tổ chức', '& phân quyền'],
    ['Quản trị hệ thống'],
    ['Dự báo & gợi ý AI'],
  ];

  // Tac nhan: [x, y_dau, nhan]. Diem neo = (x, y_dau + 31).
  const traiTN = [
    [152, 109, ['Khách hàng']],
    [152, 279, ['Nhân viên phục vụ']],
    [152, 449, ['Nhân viên bếp']],
    [152, 619, ['Thủ kho']],
  ];
  const phaiTN = [
    [1072, 109, ['Thu ngân']],
    [1072, 279, ['Kế toán']],
    [1072, 449, ['Quản lý nhà hàng']],
    [1072, 619, ['Quản trị hệ thống']],
  ];

  // [chi so tac nhan, cot ('A'|'B'), chi so hang]
  const noiTrai = [
    [0, 'A', 0], [0, 'A', 1],
    [1, 'A', 0], [1, 'A', 1], [1, 'A', 2],
    [2, 'A', 2], [2, 'A', 3], [2, 'A', 4],
    [3, 'A', 4], [3, 'A', 5],
  ];
  const noiPhai = [
    [0, 'B', 0], [0, 'B', 1],
    [1, 'B', 1], [1, 'B', 2],
    [2, 'B', 2], [2, 'B', 3], [2, 'B', 5],
    [3, 'B', 3], [3, 'B', 4],
  ];

  let s = '';
  s += v.bienHeThong(312, 30, 600, 772, 'HỆ THỐNG QUẢN LÝ NHÀ HÀNG THÔNG MINH');

  goiA.forEach((t, i) => (s += v.ucElip(A, HANG[i], t, { rx: RX, ry: RY })));
  goiB.forEach((t, i) => (s += v.ucElip(B, HANG[i], t, { rx: RX, ry: RY })));

  traiTN.forEach(([x, y, n]) => (s += v.tacNhan(x, y, n)));
  phaiTN.forEach(([x, y, n]) => (s += v.tacNhan(x, y, n)));

  for (const [i, cot, h] of noiTrai) {
    const [ax, ay] = [traiTN[i][0], traiTN[i][1] + 31];
    const cx = cot === 'A' ? A : B;
    const [ex, ey] = tren(cx, HANG[h], RX, RY, ax, ay);
    s += v.lienKet(ax, ay, ex, ey);
  }
  for (const [i, cot, h] of noiPhai) {
    const [ax, ay] = [phaiTN[i][0], phaiTN[i][1] + 31];
    const cx = cot === 'A' ? A : B;
    const [ex, ey] = tren(cx, HANG[h], RX, RY, ax, ay);
    s += v.lienKet(ax, ay, ex, ey);
  }

  // He thong ngoai
  s += v.heThongNgoai(1072, 62, ['Ngân hàng (webhook báo có)'], 176);
  const [nx, ny] = tren(B, HANG[0], RX, RY, 1000, 76);
  s += v.lienKet(1000, 76, nx, ny);

  s += v.heThongNgoai(1072, 838, ['Dịch vụ ML (Python/FastAPI)'], 190);
  const [mx, my] = tren(B, HANG[5], RX, RY, 977, 824);
  s += v.lienKet(977, 824, mx, my);

  s += v.ghiChu(152, 728, ['(mọi nhân viên đều', 'chấm công & xem lịch)']);

  return v.khung(
    'uc0', 1240, 880,
    'Sơ đồ use case tổng quát: tám tác nhân người dùng và hai hệ thống ngoài quanh mười hai nhóm chức năng của hệ thống quản lý nhà hàng',
    s
  );
}

/* ======================================================================== */
/* 2-7. KHUON MAU SO DO PHAN RA                                             */
/* ======================================================================== */

const RXC = 152;  // ban kinh e-lip cot chinh
const RXP = 146;  // ban kinh e-lip cot phu
const RY = 27;
const CX_CHINH = 412;
const CX_PHU = 812;
const Y0 = 76;
const BUOC = 78;

/**
 * @param cau_hinh.chinh  mang cac ca su dung chinh (moi phan tu: string | string[])
 * @param cau_hinh.phu    mang [hangChinh, noiDung, khuonMau] - ca su dung include/extend
 * @param cau_hinh.trai   mang [chiSoHangDau, nhan, cacHangNoiToi]
 * @param cau_hinh.phai   nhu tren nhung dat ben phai bien he thong
 */
function phanRa({ id, ten, moTa, chinh, phu = [], trai = [], phai = [], ngoai = [], chuThich = [] }) {
  const soHang = chinh.length;
  const cao = Y0 + (soHang - 1) * BUOC + RY + 46;
  const bienCao = cao - 34;
  const yHang = (i) => Y0 + i * BUOC;

  let s = '';
  s += v.bienHeThong(184, 22, 908, bienCao, ten);

  chinh.forEach((t, i) => (s += v.ucElip(CX_CHINH, yHang(i), t, { rx: RXC, ry: RY })));
  phu.forEach(([h, t]) => (s += v.ucElip(CX_PHU, yHang(h), t, { rx: RXP, ry: RY, lop: 'uc-phu' })));

  // Quan he <<include>> / <<extend>> tu ca su dung chinh sang ca su dung phu.
  // `lechNhan` day chu ra khoi cho chong nhau khi hai mui ten cat ngang nhau.
  phu.forEach(([h, , khuon, hangNguon, lechNhan]) => {
    const hn = hangNguon === undefined ? h : hangNguon;
    const [x1, y1] = tren(CX_CHINH, yHang(hn), RXC, RY, CX_PHU, yHang(h));
    const [x2, y2] = tren(CX_PHU, yHang(h), RXP, RY, CX_CHINH, yHang(hn));
    const lech = lechNhan || { x: 0, y: y1 === y2 ? -9 : -6 };
    s += v.quanHe(x1, y1, x2, y2, khuon, id, lech);
  });

  // Tac nhan ben trai.
  //
  // Duong lien ket luon ket thuc o DINH TRAI cua e-lip (cx - rx) chu khong cat
  // e-lip theo huong nhin. Nho vay ca doan duong nam han ben trai cot e-lip,
  // khong bao gio xuyen qua cac ca su dung nam giua - loi de thay nhat khi mot
  // tac nhan noi toi chin ca su dung xep doc.
  trai.forEach(([yDau, nhan, hangs]) => {
    s += v.tacNhan(84, yDau, nhan, { nhanTren: true });
    const [ax, ay] = [84, yDau + 31];
    hangs.forEach((h) => s += v.lienKet(ax, ay, CX_CHINH - RXC, yHang(h)));
  });

  // Tac nhan ben phai - doi xung, ket thuc o dinh phai.
  phai.forEach(([yDau, nhan, hangs, cot]) => {
    s += v.tacNhan(1176, yDau, nhan, { nhanTren: true });
    const [ax, ay] = [1176, yDau + 31];
    const mep = cot === 'chinh' ? CX_CHINH + RXC : CX_PHU + RXP;
    hangs.forEach((h) => s += v.lienKet(ax, ay, mep, yHang(h)));
  });

  // He thong ngoai (dat ben phai, noi toi cot phu)
  ngoai.forEach(([y, nhan, hangs, rong]) => {
    const w = Math.min(rong || 150, 150); // giu hop nam tron trong khung ve
    s += v.heThongNgoai(1176, y, nhan, w);
    hangs.forEach((h) => s += v.lienKet(1176 - w / 2, y, CX_PHU + RXP, yHang(h)));
  });

  chuThich.forEach(([x, y, dong]) => (s += v.ghiChu(x, y, dong)));

  return v.khung(id, 1252, cao, moTa, s);
}

/* --------------------------------------------------- A. Khach hang ------ */

const ucKhachHang = () =>
  phanRa({
    id: 'ucA',
    ten: 'PHÂN HỆ KHÁCH HÀNG',
    moTa: 'Sơ đồ use case phân hệ khách hàng: chín chức năng từ xem thực đơn tới đổi điểm tích luỹ, kèm các quan hệ include và extend',
    chinh: [
      'Đăng ký tài khoản',
      'Xem thực đơn, tìm và xem chi tiết món',
      'Quản lý giỏ hàng',
      'Đặt bàn trực tuyến',
      'Quét mã QR gọi món tại bàn',
      'Theo dõi và huỷ đơn của tôi',
      'Đánh giá món ăn & dịch vụ',
      'Nhắn tin với nhân viên',
      'Xem điểm tích luỹ, đổi ưu đãi',
    ],
    phu: [
      [0, 'Đăng nhập', 'include', 3],
      [2, ['Nhận gợi ý món đi kèm', '(luật kết hợp Apriori)'], 'extend'],
      [4, ['Mở phiên đơn theo bàn', '(khách vãng lai, không đăng nhập)'], 'include'],
      [6, 'Đặt cọc bằng mã VietQR', 'extend', 3, { x: 26, y: 16 }],
      [8, 'Áp mã giảm giá', 'extend'],
    ],
    trai: [[300, ['Khách hàng'], [0, 1, 2, 3, 4, 5, 6, 7, 8]]],
    ngoai: [[232, ['Dịch vụ ML', '(gợi ý Apriori)'], [2], 150]],
  });

/* -------------------------------------- B. Phuc vu & so do ban ---------- */

const ucPhucVu = () =>
  phanRa({
    id: 'ucB',
    ten: 'PHÂN HỆ PHỤC VỤ & SƠ ĐỒ BÀN',
    moTa: 'Sơ đồ use case phân hệ phục vụ: theo dõi sơ đồ 40 bàn, tạo đơn tại quầy, quản lý mã QR và mang món ra bàn',
    chinh: [
      'Đăng nhập nhân viên',
      ['Xem sơ đồ bàn thời gian thực', '(40 bàn / 4 khu)'],
      'Đổi trạng thái bàn',
      'Tạo đơn tại quầy cho khách',
      'Thêm món vào đơn đang mở',
      'Xác nhận khách đến, in phiếu đặt bàn',
      'Quản lý mã QR của bàn',
      'Mang món ra bàn (đánh dấu Đã phục vụ)',
      'Trả lời tin nhắn của khách',
    ],
    phu: [
      [2, ['Sắp xếp lại sơ đồ bằng kéo thả'], 'extend'],
      [4, ['Xem gợi ý món bán kèm'], 'extend'],
    ],
    trai: [[300, ['Nhân viên', 'phục vụ'], [0, 1, 2, 3, 4, 5, 6, 7, 8]]],
    phai: [[142, ['Quản lý', 'nhà hàng'], [2], 'phu']],
    chuThich: [[660, 268, ['Chỉ Quản lý và Quản trị hệ thống mới lưu được toạ độ bàn.']]],
  });

/* --------------------------------------------- C. Bep & kho ------------- */

const ucBepKho = () =>
  phanRa({
    id: 'ucC',
    ten: 'PHÂN HỆ BẾP & KHO',
    moTa: 'Sơ đồ use case phân hệ bếp và kho: bốn trạng thái chế biến trên màn hình bếp, trừ tồn kho tự động theo công thức và quản lý nguyên liệu theo lô',
    chinh: [
      'Xem màn hình bếp (KDS)',
      'Nhận món, bắt đầu chế biến',
      'Hoàn thành chế biến',
      'Quản lý công thức món',
      'Quản lý nguyên liệu & đơn vị tính',
      'Nhập kho theo lô (FIFO, hạn dùng)',
      'Quản lý món, danh mục, combo',
      'Quản lý thiết bị bếp',
      'Chốt ca bếp',
    ],
    phu: [
      [1, ['Trừ tồn kho theo công thức'], 'include', 2],
      [2, ['Ghi nhật ký xuất kho', '(dữ liệu cho mô hình dự báo)'], 'include'],
      [5, ['Cảnh báo lô sắp hết hạn'], 'extend'],
    ],
    trai: [
      [190, ['Nhân viên bếp'], [0, 1, 2, 3, 6, 7, 8]],
      [478, ['Thủ kho'], [4, 5]],
    ],
    chuThich: [[642, 232, ['Trừ kho đặt đúng ở bước Hoàn thành chế biến —', 'thời điểm nguyên liệu thực sự bị tiêu hao.']]],
  });

/* ------------------------------------- D. Thanh toan & ke toan ---------- */

const ucThanhToan = () =>
  phanRa({
    id: 'ucD',
    ten: 'PHÂN HỆ THANH TOÁN & KẾ TOÁN',
    moTa: 'Sơ đồ use case phân hệ thanh toán: máy POS của thu ngân, thanh toán VietQR, đối soát tự động với webhook ngân hàng và các chức năng kế toán',
    chinh: [
      'Mở màn hình thu ngân (POS)',
      'Tạo phiên thanh toán cho bàn',
      'Xác nhận đã thu tiền',
      'Hoàn tiền / huỷ phiên',
      'In biên lai, xuất hoá đơn',
      'Đối soát giao dịch ngân hàng',
      'Chốt ca thu ngân',
      'Lập & duyệt bảng lương',
      'Ghi chi phí khác, lập báo cáo',
    ],
    phu: [
      [1, ['Sinh mã VietQR theo số tiền'], 'extend'],
      [5, ['Nhận thông báo báo có', '(webhook ngân hàng)'], 'include'],
      [7, ['Xuất bảng công từ dữ liệu chấm công'], 'include'],
    ],
    trai: [
      [190, ['Thu ngân'], [0, 1, 2, 3, 4, 5, 6]],
      [510, ['Kế toán'], [5, 7, 8]],
    ],
    ngoai: [[466, ['Ngân hàng'], [5], 150]],
  });

/* --------------------------------- E. Nhan su, cham cong, to chuc ------- */

const ucNhanSu = () =>
  phanRa({
    id: 'ucE',
    ten: 'PHÂN HỆ NHÂN SỰ, CHẤM CÔNG & TỔ CHỨC',
    moTa: 'Sơ đồ use case phân hệ nhân sự: chấm công bằng khuôn mặt kèm kiểm tra chống giả mạo và ràng buộc vị trí GPS, quản lý ca làm việc và phân quyền theo chức danh',
    chinh: [
      'Đăng ký khuôn mặt',
      'Chấm công bằng khuôn mặt',
      'Xem bảng công của tôi',
      'Đăng ký / huỷ ca làm việc',
      'Xin nghỉ phép',
      'Xem thông báo nội bộ',
      'Sửa & bổ sung chấm công',
      'Bổ nhiệm nhân sự, quản lý chức danh',
      ['Phân quyền theo chức danh,', 'uỷ quyền tạm thời'],
    ],
    phu: [
      [0, ['Kiểm tra chống giả mạo', '(liveness: gật đầu / quay trái phải)'], 'include', 1],
      [1, ['Kiểm tra vị trí GPS', '(bán kính quanh nhà hàng)'], 'include'],
      [2, ['Ghi nhật ký nhận diện'], 'include', 1],
      [4, ['Duyệt / từ chối nghỉ phép'], 'extend'],
    ],
    trai: [[190, ['Nhân viên'], [0, 1, 2, 3, 4, 5]]],
    phai: [
      [370, ['Quản lý', 'nhà hàng'], [4], 'phu'],
      [560, ['Quản trị', 'hệ thống'], [6, 7, 8], 'chinh'],
    ],
    ngoai: [[100, ['Dịch vụ ML', '(nhận diện khuôn mặt)'], [0], 150]],
  });

/* ------------------------------ F. Phan tich, du bao & quan tri --------- */

const ucPhanTich = () =>
  phanRa({
    id: 'ucF',
    ten: 'PHÂN HỆ PHÂN TÍCH, DỰ BÁO AI & QUẢN TRỊ',
    moTa: 'Sơ đồ use case phân hệ phân tích và AI: dashboard vận hành, dự báo lượt khách và nguyên liệu, khai phá luật kết hợp, cùng các chức năng quản trị hệ thống',
    chinh: [
      'Xem dashboard phân tích vận hành',
      'Chạy dự báo lượt khách',
      'Chạy dự báo nhu cầu nguyên liệu',
      'Khai phá luật kết hợp (Apriori)',
      'Xem bảng đánh giá mô hình',
      'Quản lý danh mục, món ăn, bài viết',
      'Quản lý nhân viên & hợp đồng',
      ['Quản lý mã giảm giá,', 'phương thức thanh toán'],
      ['Cấu hình tài khoản nhận tiền', 'và khoá webhook'],
    ],
    phu: [
      [1, ['Huấn luyện và chọn mô hình theo MAE'], 'include'],
      [2, ['Quy đổi qua công thức món', '→ lượng cần nhập thêm'], 'include'],
      [4, ['So sánh với baseline SeasonalNaive'], 'include'],
    ],
    trai: [
      [154, ['Quản lý', 'nhà hàng'], [0, 1, 2, 3, 4]],
      [520, ['Quản trị', 'hệ thống'], [5, 6, 7, 8]],
    ],
    ngoai: [[194, ['Dịch vụ ML', '(Python/FastAPI)'], [1, 2], 150]],
  });

/* ----------------------------------------- G. Giao hang & shipper ------- */

// Thu tu ca su dung xep theo tac nhan (quan tri -> khach -> dieu phoi ->
// nguoi giao) de moi tac nhan chi noi toi mot khoi hang lien tuc, duong lien
// ket khong phai cat doc qua ca so do.
const ucGiaoHang = () =>
  phanRa({
    id: 'ucG',
    ten: 'PHÂN HỆ GIAO HÀNG',
    moTa: 'Sơ đồ use case phân hệ giao hàng: khai đơn vị vận chuyển và bảng giá, điều phối phân đơn cho người giao, ứng dụng điện thoại của người giao phát vị trí GPS, và trang tự tra cứu đơn dành cho khách',
    chinh: [
      ['Khai đơn vị vận chuyển', '& bảng giá theo khoảng cách'],
      'Quản lý hồ sơ nhân viên giao hàng',
      'Đặt món giao tận nơi',
      'Tra cứu đơn bằng mã giao',
      'Xem danh sách đơn giao',
      'Phân đơn cho nhân viên giao hàng',
      'Theo dõi bản đồ thời gian thực',
      'Cập nhật trạng thái đơn giao',
      'Phát vị trí GPS khi đang giao',
    ],
    phu: [
      [2, ['Tính phí giao theo khoảng cách', '(Haversine + bảng giá)'], 'include'],
      [3, ['Chặn đơn ngoài bán kính phục vụ'], 'extend', 2, { x: 26, y: 16 }],
      [5, ['Chọn đơn vị vận chuyển rẻ nhất'], 'include'],
      [6, ['Xem lại lộ trình đã đi'], 'extend'],
      [7, ['Ghi nhật ký chuyển trạng thái'], 'include'],
      [8, ['Loại điểm sai số lớn hơn 200 m'], 'include'],
    ],
    trai: [
      [240, ['Khách hàng'], [2, 3]],
      [474, ['Điều phối', 'giao hàng'], [4, 5, 6, 7]],
      [630, ['Nhân viên', 'giao hàng'], [7, 8]],
    ],
    phai: [[84, ['Quản trị', 'hệ thống'], [0, 1], 'chinh']],
    ngoai: [[544, ['Bản đồ nền', 'OpenStreetMap'], [6], 150]],
    chuThich: [[236, 744, ['Trang tra cứu bằng mã giao không cần đăng nhập.']]],
  });

module.exports = {
  tongQuat, ucKhachHang, ucPhucVu, ucBepKho, ucThanhToan, ucNhanSu, ucPhanTich,
  ucGiaoHang,
};

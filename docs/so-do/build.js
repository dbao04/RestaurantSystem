/**
 * Sinh trang "So do use case & BPMN" tu cac module ve.
 *   node _gen\build.js  ->  _gen\so-do-he-thong.html
 */
const fs = require('fs');
const path = require('path');
const v = require('./ve');
const uc = require('./uc');
const bpmn = require('./bpmn');
const tq = require('./tong-quat');
const erd = require('./erd');
const tuanTu = require('./tuan-tu');
const hoatDong = require('./hoat-dong');
const lop = require('./lop');

/* ------------------------------------------------------------- chu giai */

function chuGiaiUml() {
  let s = '';
  s += v.tacNhan(60, 18, ['Tác nhân']);
  s += v.ucElip(268, 52, 'Ca sử dụng', { rx: 104, ry: 26 });
  s += v.ucElip(520, 52, 'Ca sử dụng được gọi', { rx: 112, ry: 26, lop: 'uc-phu' });
  s += v.ucElip(768, 52, 'Có gọi hệ thống ngoài', { rx: 112, ry: 26, lop: 'uc-ngoai' });
  s += v.lienKet(910, 40, 1030, 40);
  s += `<text class="tx-ghi" x="970" y="30" text-anchor="middle">liên kết</text>`;
  s += v.quanHe(910, 84, 1030, 84, 'include', 'cg1', { x: 0, y: -8 });
  s += `<g class="ht-ngoai"><rect x="1070" y="30" width="170" height="44" rx="3"/>
    <text class="tx-khuon" x="1155" y="48">&#171;h&#7879; th&#7889;ng ngo&#224;i&#187;</text>
    <text class="tx-ht" x="1155" y="64">T&#225;c nh&#226;n ph&#7909;</text></g>`;
  return v.khung('cg1', 1260, 122, 'Chú giải ký hiệu sơ đồ use case', s);
}

function chuGiaiBpmn() {
  let s = '';
  s += v.suKien(60, 46, 'Bắt đầu', 'dau');
  s += v.suKien(214, 46, 'Trung gian · nhận tin', 'giua');
  s += v.suKien(400, 46, 'Trung gian · hẹn giờ', 'hen-gio');
  s += v.suKien(560, 46, 'Kết thúc', 'cuoi');
  s += v.viec(730, 46, 'Công việc của người');
  s += v.viec(920, 46, 'Bước hệ thống tự chạy', 'tu-dong');
  s += v.cong(1090, 46, 'Rẽ nhánh loại trừ');
  s += v.luong([[1160, 46], [1270, 46]], 'cg2');
  s += `<text class="tx-sk" x="1215" y="72">luồng trình tự</text>`;
  return v.khung('cg2', 1320, 100, 'Chu giai ky hieu so do BPMN', s);
}

/**
 * Chu giai ky hieu cho bon loai so do bo sung: lop, luoc do CSDL, tuan tu va
 * hoat dong. Gop vao mot hinh de nguoi doc chi phai lat lai mot cho.
 */
function chuGiaiMoi() {
  let s = '';

  // --- hang 1: so do lop va luoc do CSDL ---
  s += `<text class="tx-goi" x="14" y="20">L&#7898;P V&#192; L&#431;&#7906;C &#272;&#7890; CSDL</text>`;
  s += v.hopLop(14, 32, 'Tên lớp', ['− thuộc tính'], ['+ phương thức()'], { khuonMau: 'module' }).svg;
  s += v.hopBang(210, 32, 'ten_bang', ['PK khoá chính', 'FK khoá ngoại']).svg;
  s += v.quanHeLop([[400, 60], [480, 60]], 'cg3', { kieu: 'phu-thuoc' });
  s += `<text class="tx-ghi" x="400" y="82">phụ thuộc «use»</text>`;
  s += v.quanHeLop([[560, 60], [640, 60]], 'cg3', { kieu: 'cau-thanh' });
  s += `<text class="tx-ghi" x="560" y="82">cấu thành</text>`;
  s += v.quanHeLop([[700, 60], [780, 60]], 'cg3', { kieu: 'gop' });
  s += `<text class="tx-ghi" x="700" y="82">gộp</text>`;
  s += v.noiBang([[850, 60], [960, 60]], { dau: 'mot', cuoi: 'nhieu' });
  s += `<text class="tx-ghi" x="840" y="82">một &#8212; nhiều (chân quạ)</text>`;

  // --- hang 2: so do tuan tu ---
  s += `<text class="tx-goi" x="14" y="150">TU&#7846;N T&#7920;</text>`;
  s += v.doiTuong(80, 162, 'Đối tượng').svg;
  s += v.duongDoi(80, 202, 250);
  s += v.kichHoat(80, 210, 244);
  s += v.thongDiep(90, 300, 220, 'thông điệp gọi', 'cg3');
  s += v.thongDiep(300, 92, 248, 'trả kết quả', 'cg3', { loai: 'tra' });
  s += v.khoiTuongTac(380, 150, 250, 110, 'alt', 'điều kiện', { chia: [[212, 'ngược lại']] });
  s += `<text class="tx-ghi" x="650" y="205">khung rẽ nhánh alt / opt / loop</text>`;
  s += v.kichHoat(300, 210, 244);

  // --- hang 3: so do hoat dong ---
  s += `<text class="tx-goi" x="14" y="300">HO&#7840;T &#272;&#7896;NG</text>`;
  s += v.nutDau(40, 330);
  s += `<text class="tx-ghi" x="20" y="366">bắt đầu</text>`;
  s += v.hanhDong(190, 330, 'Hành động').svg;
  s += v.quyetDinh(360, 330, [], {});
  s += `<text class="tx-ghi" x="325" y="372">rẽ nhánh</text>`;
  s += v.thanhDongBo(520, 330, 120);
  s += `<text class="tx-ghi" x="478" y="366">tách / nhập luồng</text>`;
  s += v.hanhDong(720, 330, 'Bước hệ thống tự chạy', { lop: 'tu-dong' }).svg;
  s += v.nutCuoi(890, 330);
  s += `<text class="tx-ghi" x="866" y="366">kết thúc</text>`;

  return v.khung('cg3', 1010, 390, 'Chú giải ký hiệu sơ đồ lớp, lược đồ CSDL, tuần tự và hoạt động', s);
}

/* ----------------------------------------------------------------- noi dung */

/** Moi hinh vua duoc nhung vao trang, vua duoc ghi ra mot file SVG roi. */
const DANH_SACH_HINH = [];

const hinh = (so, tieuDe, svg, chuThich) => {
  DANH_SACH_HINH.push({ so, tieuDe, svg });
  return `
<figure class="khoi-hinh">
  <figcaption class="cap"><span class="cap-so">Hình ${so}</span>${tieuDe}</figcaption>
  <div class="hinh-hop">${svg}</div>
  ${chuThich ? `<p class="cap-duoi">${chuThich}</p>` : ''}
</figure>`;
};

const dacTa = ({ ma, ten, tacNhan, moTa, tien, chinh, thayThe, hau }) => `
<table class="dac-ta">
  <caption><b>${ma}</b> &middot; ${ten}</caption>
  <tbody>
    <tr><th>Tác nhân</th><td>${tacNhan}</td></tr>
    <tr><th>Mô tả</th><td>${moTa}</td></tr>
    <tr><th>Tiền điều kiện</th><td>${tien}</td></tr>
    <tr><th>Luồng chính</th><td><ol>${chinh.map((x) => `<li>${x}</li>`).join('')}</ol></td></tr>
    <tr><th>Luồng thay thế</th><td><ul>${thayThe.map((x) => `<li>${x}</li>`).join('')}</ul></td></tr>
    <tr><th>Hậu điều kiện</th><td>${hau}</td></tr>
  </tbody>
</table>`;

/** The tom tat mot quy trinh: bang hai cot khoa - gia tri. */
const theQuyTrinh = (tieuDe, hang) => `
<table class="dac-ta">
  <caption>${tieuDe}</caption>
  <tbody>${hang.map(([k, x]) => `<tr><th>${k}</th><td>${x}</td></tr>`).join('')}</tbody>
</table>`;

/** Bang nhieu cot co dong tieu de. `lop` de chinh be rong cot dau. */
const bangCot = (lop, tieuDe, cot, dong) => `
<table class="${lop}">
  ${tieuDe ? `<caption>${tieuDe}</caption>` : ''}
  <thead><tr>${cot.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
  <tbody>${dong.map((d) => `<tr>${d.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody>
</table>`;

const TAC_NHAN = [
  ['Khách hàng', 'Chính', 'Đặt bàn, quét mã QR gọi món tại bàn, theo dõi và huỷ đơn, đánh giá, tích điểm. Khách quét QR không cần đăng nhập — hệ thống tạo tài khoản vãng lai theo mã bàn.', '<code>khach_hang</code>'],
  ['Nhân viên phục vụ', 'Chính', 'Xếp bàn, tạo đơn tại quầy, theo dõi sơ đồ 40 bàn, mang món ra bàn, trả lời tin nhắn khách.', 'Bộ phận <i>Phục vụ</i>, <i>Lễ tân</i>'],
  ['Nhân viên bếp', 'Chính', 'Nhận và chế biến món trên màn hình bếp, quản lý công thức, món, combo, thiết bị, chốt ca bếp.', 'Bộ phận <i>Bếp</i>'],
  ['Thủ kho', 'Chính', 'Quản lý nguyên liệu, đơn vị tính, nhập kho theo lô và hạn sử dụng.', 'Bộ phận <i>Kho &ndash; Mua hàng</i>'],
  ['Thu ngân', 'Chính', 'Mở phiên thanh toán, thu tiền mặt hoặc sinh mã VietQR, in biên lai, đối soát, chốt ca.', 'Bộ phận <i>Thu ngân</i>'],
  ['Kế toán', 'Chính', 'Bảng lương, chi phí khác, báo cáo, duyệt nghỉ phép, đối soát doanh thu.', 'Bộ phận <i>Kế toán</i>'],
  ['Quản lý nhà hàng', 'Chính', 'Xem dashboard phân tích, chạy dự báo AI, bổ nhiệm nhân sự, phân quyền, uỷ quyền, sắp xếp sơ đồ bàn.', 'Chức danh cấp 1&ndash;2'],
  ['Quản trị hệ thống', 'Chính', 'Quản lý danh mục, món ăn, bài viết, nhân viên, hợp đồng, mã giảm giá, cấu hình thanh toán và khoá webhook.', '<code>tb_admin</code>'],
  ['Dịch vụ ML', 'Phụ', 'Dịch vụ Python/FastAPI tách riêng: dự báo lượt khách và nguyên liệu, khai phá luật kết hợp, nhận diện khuôn mặt.', '<code>ml_service/</code> cổng 8000'],
  ['Ngân hàng', 'Phụ', 'Gửi thông báo báo có về hệ thống để đối soát tự động phiên thanh toán chuyển khoản.', '<code>POST /api/webhook/ngan-hang</code>'],
];

/* --- 7. Dac ta hai quy trinh trong yeu --- */

const BUOC_DAT_BAN = [
  ['1', 'Khách hàng', 'Chọn ngày, số khách, khung giờ và khu vực ở bước 1 của trợ lý.', 'Khung giờ đã kín vẫn hiện, chỉ làm mờ — im lặng bỏ đi sẽ khiến khách tưởng nhà hàng không mở cửa giờ đó.', '<code>views/reservation.ejs</code>'],
  ['2', 'Web', 'Gọi <code>GET /api/dat-ban/khung-gio</code> rồi <code>GET /api/dat-ban/kha-dung</code>.', 'Toàn bộ giai đoạn này chỉ đọc, chưa ghi gì.', '<code>routes/datBan.js</code>'],
  ['3', 'Luật đặt bàn', 'Chuẩn hoá khung giờ rồi kiểm tra bốn ràng buộc thời gian.', 'BR-01 → BR-04. Giờ được làm tròn xuống đầu ô 15 phút.', '<code>reservationRules.phanTichKhungGio</code>, <code>kiemTraGioMoCua</code>, <code>kiemTraDatQuaXa</code>, <code>kiemTraDatSatGio</code>'],
  ['4', 'Xếp bàn', 'Duyệt sâu các tổ hợp bàn, chấm điểm rồi chọn phương án tốt nhất.', 'BR-05, BR-06. Trần 40.000 nút làm chặn cuối; đo thật 40 bàn hết 18 ms cho bốn lần tìm.', '<code>reservationTables.goiYXepBan</code>, <code>timToHop</code>'],
  ['5', 'Web', 'Hết bàn: trả <code>ma = FULL</code> kèm <code>gio_thay_the</code> và <code>khu_thay_the</code>.', 'Các gợi ý đã qua cả kiểm tra giờ mở cửa lẫn kiểm tra bàn trống, nên bấm vào là đặt được thật.', '<code>reservationTables.khungGioThayThe</code>, <code>khuVucThayThe</code>'],
  ['6', 'Khách hàng', 'Bước 2: chọn bàn trên sơ đồ mặt bằng.', 'Bước này biến mất khi tắt <code>allow_customer_pick_table</code>; số bước tính lúc khởi tạo chứ không viết cứng trong HTML.', '<code>views/partials/so-do-dat-ban.ejs</code>'],
  ['7', 'Khách hàng', 'Bước 3: tên, điện thoại, dịp, thẻ yêu cầu đặc biệt.', 'Số điện thoại được chuẩn hoá trước khi dùng làm danh tính khách.', '<code>reservationRules.kiemTraThongTinKhach</code>'],
  ['8', 'Khách hàng', 'Bước 4: đối chiếu lại và xem tiền cọc rồi gửi.', 'Số tiền cọc báo trước dùng CHUNG một hàm với lúc tạo, nên không lệch với số thu thật.', '<code>reservationRules.tinhTienCoc</code>'],
  ['9', 'Web', '<code>POST /api/dat-ban</code>.', 'Mọi thao tác ghi đều là POST/PUT/DELETE, kể cả huỷ — để một con bot quét link không huỷ được bàn của khách.', '<code>routes/datBan.js</code>'],
  ['10', 'Dịch vụ', 'Chặn số điện thoại bị khoá và khách vượt ngưỡng no-show.', 'BR-07, BR-08. Chặn ở đầu vào chứ không tạo rồi huỷ, và chỉ chặn kênh online.', '<code>reservationService.taoLuotDat</code>, <code>hoSoKhach</code>'],
  ['11', 'Dịch vụ', 'Tính tiền cọc: lấy quy tắc có <code>priority</code> nhỏ nhất.', 'BR-09. Khách đọc được một dòng lý do rõ ràng thay vì một con số từ trên trời rơi xuống.', '<code>reservationRules.tinhTienCoc</code>, bảng <code>reservation_deposit_rules</code>'],
  ['12', 'Dịch vụ', 'Gọi lại <code>goiYXepBan</code> để chốt tổ hợp bàn.', 'Kết quả có thể khác lần kiểm tra ở bước 4 vì thời gian đã trôi qua.', '<code>reservationTables.goiYXepBan</code>'],
  ['13', 'MySQL', 'Mở giao dịch, sinh <code>reservation_code</code>, ghi bản ghi <code>reservations</code>.', 'Mã dạng <code>RSV-YYMMDD-XXXX</code>, bảng chữ đã bỏ I, O, 0, 1 — bốn ký tự hay bị đọc nhầm nhất qua điện thoại. Trùng mã thì sinh lại, tối đa 5 lần.', '<code>reservationService.taoLuotDat</code>, <code>qt.taoMa</code>'],
  ['14', 'MySQL', 'Chiếm ô lưới: ghi <code>reservation_slot_locks</code> cho từng ô 15 phút.', 'BR-10. Cùng giao dịch với bước 13; đây mới là thứ giữ chỗ thật, bản ghi <code>reservations</code> chỉ là thứ để đọc.', '<code>reservationTables.chiemO</code>'],
  ['15', 'Dịch vụ', 'Trùng ô (<code>ER_DUP_ENTRY</code>): quay lui rồi thử lại.', 'BR-11. Ba lần khi bàn do hệ thống chọn, một lần khi khách tự chọn bàn.', '<code>reservationService.taoLuotDat</code> — vòng lặp thử lại'],
  ['16', 'MySQL', 'Ghi bàn, ghi nhật ký, xếp thông báo vào hàng đợi rồi commit.', 'Thông báo XẾP HÀNG chứ không gửi trong giao dịch: gửi mail trong giao dịch thì chậm, dễ lỗi, và nếu quay lui thì khách đã nhận mail cho một lượt đặt không tồn tại.', '<code>ghiNhatKy</code>, <code>xepThongBao</code>, bảng <code>reservation_notifications</code>'],
  ['17', 'Web', 'Trả mã đặt bàn, danh sách bàn, tiền cọc và hạn cọc.', 'Lỗi nghiệp vụ trả <code>{ ok, ma, thong_bao, chi_tiet }</code>; hết phiên trên nhánh nội bộ trả 401 JSON chứ không chuyển hướng.', '<code>routes/datBan.js</code>, lớp <code>LoiDatBan</code>'],
  ['18', 'Khách · Thu ngân', 'Khách chuyển khoản cọc, nhân viên ghi nhận qua <code>POST /api/reservations/:id/deposit</code>.', 'Trạng thái cọc chuyển PAID thì lượt đặt đang PENDING tự chuyển CONFIRMED — đã trả tiền rồi mà còn bắt chờ duyệt là vô nghĩa.', '<code>reservationService.luuCoc</code>, bảng <code>reservation_deposits</code>'],
  ['19', 'Vòng quét nền', 'Quá <code>deposit_due_at</code> mà chưa trả cọc: tự huỷ và nhả bàn.', 'BR-12.', '<code>reservationJobs.quetCocQuaHan</code>'],
  ['20', 'Lễ tân', 'Check-in rồi xếp bàn: ARRIVED → SEATED.', 'Xoá <code>hold_until</code> vì khách đã ở đây; bàn chuyển sang Đang phục vụ. Giờ bắt đầu KHÔNG đổi — lịch sử phải giữ nguyên cái đã hứa.', '<code>reservationService.doiTrangThai</code>'],
  ['21', 'Lễ tân', 'Kết thúc bữa: COMPLETED.', 'BR-14. Ghi <code>completed_at</code>, bàn chuyển Đang dọn, và GIỮ NGUYÊN ô lưới.', '<code>reservationService.doiTrangThai</code>'],
  ['22', 'Vòng quét nền', 'Quét no-show theo hai mốc.', 'BR-13. Quá <code>hold_until</code> thì cảnh báo một lần; quá thêm <code>auto_no_show_minutes</code> mới tự đóng. Đặt về 0 để tắt hẳn phần tự động.', '<code>reservationJobs.quetNoShow</code>'],
  ['23', 'Vòng quét nền', 'Nhắc lịch, đồng bộ trạng thái bàn, phát thông báo.', 'Chỉ trả về Trống những bàn đã từng có lượt đặt trong ngày — tức những bàn chắc chắn do chính nó đặt nhãn, không xoá nhãn nhân viên đánh tay.', '<code>quetNhacLich</code>, <code>dongBoTrangThaiBan</code>, <code>phatThongBao</code>'],
];

const QUY_TAC_DAT_BAN = [
  ['BR-01', 'Chỉ nhận đặt trong giờ mở cửa của chi nhánh; ngày nghỉ thì chặn.', 'Thêm ngày nghỉ vào ngày ĐÃ có khách đặt thì chỉ cảnh báo, không chặn — quản lý phải biết còn bao nhiêu lượt cần gọi điện báo khách.'],
  ['BR-02', 'Không đặt xa quá <code>max_advance_days</code> (mặc định 90 ngày).', 'Lịch xa hơn thế không quản được: thực đơn đổi, nhân sự đổi, và tỷ lệ no-show tăng theo khoảng cách thời gian.'],
  ['BR-03', 'Ngừng nhận đặt trong <code>last_seating_minutes</code> (60 phút) cuối trước giờ đóng.', 'Nhà hàng đóng 22:00 mà nhận bàn 21:50 thì khách chỉ được ngồi 10 phút.'],
  ['BR-04', 'Kênh online tối đa <code>max_guests_online</code> (30) khách một lượt; nhân viên tạo hộ không bị trần.', 'Nhóm 60 người không phải việc một form web tự quyết được — phải có người gọi điện thoả thuận.'],
  ['BR-05', 'Tổng chỗ của tổ hợp bàn phải lớn hơn hoặc bằng số khách, và không quá <code>max_tables_per_reservation</code> (4) bàn. Bàn <code>co_the_ghep = 0</code> chỉ dùng một mình; chỉ ghép các bàn cùng <code>nhom_ghep</code>.', 'Mặc định <code>nhom_ghep = KV&lt;id khu vực&gt;</code>, tức chỉ ghép trong cùng khu. Đặt nhóm riêng cho hai bàn kề nhau về số hiệu nhưng bị lối đi chia cắt — ghép được trên giấy mà không ghép được ngoài đời.'],
  ['BR-06', 'Điểm xếp bàn = 60 × số bàn + 1 × ghế thừa + 40 (ghép khác khu vực) − 25 × mỗi sở thích đáp ứng được − 35 (khách VIP vào bàn VIP) + 30 (khách thường chiếm bàn VIP). Điểm THẤP thắng.', 'Trọng số số bàn lớn hơn nhiều so với ghế thừa là có chủ đích: một bàn 6 chỗ cho 4 khách (62 điểm) luôn thắng hai bàn 2 chỗ vừa khít (120 điểm). Người thật thích ngồi một bàn hơn ngồi ghép.'],
  ['BR-07', 'Số điện thoại có <code>is_blocked = 1</code> không đặt online được.', 'Chặn ngay ở đầu vào để nhân viên không phải dọn và khách nhận câu trả lời tức thì.'],
  ['BR-08', '<code>no_show_count</code> đạt <code>no_show_block_threshold</code> thì chặn kênh online, KHÔNG chặn nhân viên.', 'Người thật vẫn có thể nhận đơn sau khi nói chuyện với khách hoặc yêu cầu đặt cọc. Chặn máy móc một khách hàng thật là cái giá đắt hơn một bàn trống.'],
  ['BR-09', 'Tiền cọc lấy MỘT quy tắc có <code>priority</code> nhỏ nhất, không cộng dồn. Quy tắc "không cần cọc" giữ ưu tiên lớn nhất làm điểm dừng cuối.', 'Cộng dồn thì một khách VIP đi nhóm đông vào giờ cao điểm sẽ phải cọc ba lần.'],
  ['BR-10', 'Khoá chính <code>(table_id, slot_start)</code> của <code>reservation_slot_locks</code> là hàng rào chống đặt trùng. Thời gian dọn bàn <code>turnaround_minutes</code> cũng chiếm ô.', 'MySQL không có ràng buộc EXCLUDE trên khoảng thời gian như PostgreSQL, nên khoảng thời gian được băm thành lưới ô 15 phút và khoá chính đặt lên đó. Kích thước ô khai ở hai nơi và PHẢI khớp nhau: <code>RESERVATION_SLOT_MINUTES</code> và <code>SLOT_MINUTES</code> trong migration 030.'],
  ['BR-11', 'Mất bàn do đua: thử lại tối đa 3 lần nếu bàn do hệ thống chọn, 1 lần nếu khách tự chọn bàn.', 'Báo khách "bàn vừa có người đặt mất" trong khi nhà hàng còn 30 bàn trống là một câu trả lời tệ. Nhưng đổi bàn khách đã chọn sang bàn khác mà không hỏi cũng là làm sai ý họ.'],
  ['BR-12', 'Lượt PENDING chưa trả cọc mà quá <code>deposit_due_at</code> thì tự huỷ và trả bàn.', 'Không có mốc này thì một lượt đặt không ai trả tiền vẫn giữ bàn tới hết ngày.'],
  ['BR-13', 'No-show có HAI mốc: quá <code>hold_until</code> thì cảnh báo, quá thêm <code>auto_no_show_minutes</code> mới tự đóng.', 'Tự đóng ngay tại mốc đầu là sai — khách kẹt xe 10 phút không phải khách bỏ bữa. Nhưng không bao giờ tự đóng cũng sai — 22h đêm không còn ai ngồi dọn mà bàn thì vẫn bị giữ.'],
  ['BR-14', 'CANCELLED / REJECTED / NO_SHOW nhả ô lưới NGAY. COMPLETED giữ nguyên ô lưới.', 'Một bàn bị giữ bởi lượt đã huỷ là lỗi tốn tiền nhất module này có thể gây ra. Ngược lại, nhả ô của lượt vừa phục vụ xong sẽ cho phép đặt đè lên chính khung giờ đó, bỏ qua cả thời gian dọn bàn.'],
  ['BR-15', 'Hoàn tiền lấy mốc LỚN NHẤT mà khách vẫn còn đáp ứng, và chỉ hoàn phần <code>deposit_status = PAID</code>. No-show luôn hoàn 0%.', '<code>deposit_amount</code> là số PHẢI cọc theo quy tắc, tồn tại ngay cả khi khách chưa trả đồng nào. Lấy thẳng cột đó mà hoàn sẽ hứa trả khách một khoản nhà hàng chưa bao giờ nhận. Số tiền hoàn tính MỘT LẦN lúc huỷ và lưu lại.'],
  ['BR-16', '<code>DELETE /api/reservations/:id</code> ánh xạ sang CANCELLED, không xoá bản ghi.', 'Một lượt đặt đã tồn tại là một sự thật lịch sử: nó ảnh hưởng bộ đếm no-show của khách, báo cáo tháng, và đôi khi cả một khoản tiền cọc.'],
  ['BR-17', '<code>doiTrangThai()</code> là cửa DUY NHẤT để đổi cột <code>status</code>; không route nào được UPDATE thẳng.', 'Mỗi bước chuyển kéo theo những việc không được phép quên: ghi mốc thời gian, nhả ô lưới, đồng bộ <code>ban.trangthai</code>, tính hoàn tiền, cập nhật bộ đếm no-show, ghi nhật ký. Rải các việc đó ra từng route thì sớm muộn có một lối ra quên nhả ô, và bàn đó bị khoá vĩnh viễn.'],
];

const NGOAI_LE_DAT_BAN = [
  ['FULL', 'Không còn tổ hợp bàn nào phù hợp trong khung giờ.', 'Trả kèm <code>gio_thay_the</code> và <code>khu_thay_the</code>; khách có thể chọn vào danh sách chờ WAITLIST.'],
  ['RACE_LOST', 'Ô lưới vừa bị lượt khác chiếm mất giữa lúc ghi.', 'Quay lui giao dịch rồi thử lại theo BR-11; hết lượt thử thì báo khách chọn lại.'],
  ['BLOCKED', 'Số điện thoại bị quản lý khoá.', 'Từ chối ngay ở đầu vào, mời khách liên hệ trực tiếp nhà hàng.'],
  ['NO_SHOW_RISK', 'Khách có số lần không đến đạt ngưỡng.', 'Chặn kênh online kèm câu giải thích; nhân viên vẫn nhận đơn hộ được.'],
  ['PICK_DISABLED', 'Khách tự chọn bàn trong khi nhà hàng đang tự sắp xếp.', 'Từ chối và để hệ thống xếp bàn.'],
  ['NOT_FOUND', 'Không tìm thấy lượt đặt.', 'Trả 404 kèm thông điệp viết cho người đọc.'],
  ['HET_PHIEN', 'Ca làm việc hết giờ, phiên đăng nhập nhân viên hết hạn.', 'Trả 401 JSON chứ không chuyển hướng: <code>fetch()</code> đi theo chuyển hướng sẽ nhận HTML rồi vỡ ở <code>r.json()</code>, và giao diện hiện "Mất kết nối tới nhà hàng" trong khi sự thật chỉ là hết ca.'],
];

const TRANG_THAI_DAT_BAN = [
  ['PENDING', 'Khách đặt online, chờ nhân viên duyệt.', 'CONFIRMED · CANCELLED · REJECTED · WAITLIST'],
  ['WAITLIST', 'Hết bàn nhưng khách vẫn muốn chờ.', 'CONFIRMED · CANCELLED · REJECTED'],
  ['CONFIRMED', 'Đã chắc chắn có bàn. Nhân viên tạo hộ thì vào thẳng đây.', 'ARRIVED · CANCELLED · NO_SHOW'],
  ['ARRIVED', 'Khách đã tới quầy. Khách vãng lai vào thẳng đây.', 'SEATED · CANCELLED · NO_SHOW'],
  ['SEATED', 'Đã ngồi vào bàn. KHÔNG chuyển được sang NO_SHOW — khách đang ngồi ngay đó.', 'COMPLETED · CANCELLED'],
  ['COMPLETED', 'Đã dùng bữa xong. Một chiều, muốn mở lại thì tạo lượt mới.', '(kết thúc)'],
  ['CANCELLED', 'Khách hoặc nhân viên huỷ. Tính hoàn tiền và nhả ô lưới ngay.', '(kết thúc)'],
  ['REJECTED', 'Quản lý từ chối lượt đặt.', '(kết thúc)'],
  ['NO_SHOW', 'Quá hạn giữ bàn mà khách không tới. Hoàn 0%.', '(kết thúc)'],
];

const BUOC_THANH_TOAN = [
  ['1a', 'Thu ngân', 'Mở <code>/staff/thanh-toan</code>, chọn bàn cần tính tiền.', 'Danh sách sắp đơn CẦN THU TIỀN lên trước — màn hình POS mở ra là phải thấy ngay bàn nào đòi tính tiền, không phải danh sách đặt bàn theo ngày.', '<code>thanhToanService.danhSachCanThanhToan</code>'],
  ['1b', 'Khách hàng', 'Hoặc khách tự trả tại bàn: <code>/qr/thanh-toan/:sesis</code>, không cần đăng nhập.', 'Danh tính là chính chuỗi <code>sesis</code> — ngẫu nhiên, không đoán được, và hết hiệu lực ngay khi đơn thanh toán xong. Khách chỉ TRẢ TIỀN chứ không sửa được gì.', '<code>routes/thanhToan.js</code> — <code>kiemTraPhienBanMo</code>'],
  ['2', 'Dịch vụ', 'Dựng hoá đơn: cộng các dòng <code>hopdong</code> có <code>id_mon &gt; 0</code>.', 'Dòng <code>id_mon = 0</code> là dòng khung của đơn đặt bàn hoặc đơn QR, không phải món ăn — cộng vào là sai tiền.', '<code>thanhToanService.layHoaDon</code>'],
  ['3', 'Dịch vụ', 'Áp mã giảm giá và điểm tích luỹ.', 'BR-24, BR-25. Ngữ cảnh chấm điều kiện có cả danh sách món và id khách, nên mã giới hạn theo loại món và mã "mỗi khách N lượt" mới tính đúng.', '<code>discountService</code>, bảng <code>loyalty_points</code>'],
  ['4', 'Dịch vụ', 'Cộng phí phục vụ, VAT, làm tròn rồi trừ phần đã trả.', 'Không có cột "đã thanh toán" trên <code>hopdong</code>: <code>con_phai_tra</code> luôn suy ra từ tổng các dòng <code>payments</code> có <code>status = success</code> của cùng <code>sesis</code>.', '<code>layHoaDon</code>, bảng <code>cau_hinh_thanh_toan</code>'],
  ['5', 'Thu ngân', 'Chọn hình thức trả: tiền mặt hay VietQR.', 'Chỉ các phương thức có <code>is_active = 1</code> mới hiện.', '<code>thanhToanService.layPhuongThuc</code>'],
  ['6', 'Dịch vụ', 'Mở phiên thanh toán.', 'BR-21, BR-22. Huỷ các phiên pending cũ của CÙNG <code>sesis</code> và CÙNG phương thức trước khi tạo mới — nếu không, bàn sẽ có hai mã QR còn hiệu lực cho một đơn.', '<code>thanhToanService.taoPhien</code>'],
  ['7a', 'CSDL', 'Tiền mặt: ghi <code>payments</code> với <code>status = success</code>, tính tiền thối, chạy hậu kỳ ngay.', 'Không có gì phải chờ nên coi như xong tại chỗ.', '<code>taoPhien</code> → <code>hauKyThanhToan</code>'],
  ['7b', 'CSDL', 'VietQR: ghi <code>payments</code> với <code>status = pending</code>, sinh mã đối soát duy nhất, đặt hạn <code>han_qr_giay</code> (mặc định 900 giây).', 'Mã đối soát dạng <code>BD</code> + 9 ký tự, dùng luôn làm nội dung chuyển khoản.', '<code>sinhMaDoiSoat</code>'],
  ['8', 'VietQR', 'Sinh payload EMVCo cho mã QR chuyển khoản.', 'Chưa cấu hình tài khoản nhận thì phiên vừa tạo bị chuyển <code>failed</code> ngay — để không còn lại rác pending không bao giờ trả được.', '<code>services/vietQR.js</code> — <code>taoQRChuyenKhoan</code>'],
  ['9', 'Khách hàng', 'Quét mã và chuyển khoản trên ứng dụng ngân hàng.', 'Nội dung chuyển khoản đã điền sẵn mã đối soát.', '—'],
  ['10', 'Ngân hàng', 'Bắn biến động số dư về <code>POST /api/webhook/ngan-hang</code>.', 'BR-29. Xác thực bằng header <code>Authorization: Apikey &lt;khoá&gt;</code>; khoá nằm trong <code>cau_hinh_thanh_toan</code>, sinh lại được ở <code>/admin/thanh-toan</code>. Thân request theo chuẩn SePay để sau này đấu thật không phải sửa mã.', '<code>routes/thanhToan.js</code>'],
  ['11', 'Web', 'Ghi giao dịch vào <code>giao_dich_ngan_hang</code>.', 'Khoá duy nhất trên <code>ma_tham_chieu</code> chống ghi trùng: webhook có thể bắn lại nhiều lần cho cùng một giao dịch khi không nhận được HTTP 200.', '<code>ghiNhanGiaoDichNganHang</code>'],
  ['12', 'Web', 'Rút mã đối soát khỏi nội dung chuyển khoản.', 'Dò bằng biểu thức chính quy chứ không so sánh bằng: ngân hàng chèn thêm chữ, ví dụ <code>MBVCB.123456.BD2F1A9KX7Q.CT tu 0011...</code>.', '<code>rutMaDoiSoat</code>'],
  ['13', 'Web', 'Tìm phiên <code>pending</code> mang đúng mã đó và đối chiếu số tiền.', 'BR-28. Chuyển thiếu thì đánh dấu <code>khong_khop</code> kèm số nhận được và số cần, để thu ngân xử lý tay. Chuyển dư thì vẫn xác nhận và ghi rõ phần dư vào ghi chú.', '<code>ghiNhanGiaoDichNganHang</code>'],
  ['14', 'Dịch vụ', 'Xác nhận phiên: <code>UPDATE payments SET status = success WHERE id = ? AND status = pending</code>.', 'BR-23. Đây là điểm hợp lưu của CẢ BA đường: webhook ngân hàng, thu ngân bấm xác nhận thủ công, và thanh toán tiền mặt.', '<code>thanhToanService.xacNhan</code>'],
  ['15', 'Dịch vụ', 'Chạy hậu kỳ: ghi nhật ký mã giảm giá, TRỪ điểm khách dùng, rồi mới CỘNG điểm mới.', 'BR-26. Thứ tự bắt buộc: cộng trước thì khách dùng điểm xong lại được cộng điểm trên phần tiền đã trả bằng điểm.', '<code>hauKyThanhToan</code>, <code>loyaltyService</code>'],
  ['16', 'Dịch vụ', 'Đã thu đủ thì đóng đơn: <code>hopdong.tinhtrang = 3</code>, nhả <code>qr_tables.active_sesis</code>, bàn chuyển sang Đang dọn.', 'BR-27. Phiên <code>loai = dat_coc</code> KHÔNG đóng đơn — khách mới trả trước một phần, vẫn còn phải đến ăn.', '<code>hauKyThanhToan</code>'],
  ['17', 'Web', 'Phát <code>tt:da-thanh-toan</code> tới phòng <code>tt:&lt;sesis&gt;</code>.', 'Cả điện thoại khách lẫn màn hình thu ngân cùng vào phòng này, nên khách quét xong thì hai bên cùng sang "đã thanh toán" trong một khoảnh khắc.', '<code>routes/thanhToan.js</code>, <code>services/realtime.js</code>'],
  ['18', 'Thu ngân', 'Không khớp: vào <code>/staff/thanh-toan/doi-soat</code> ghép tay giao dịch vào phiên.', 'Vẫn gọi cùng hàm <code>xacNhan</code>, chỉ khác ở chỗ ghi lại ai là người bấm để còn truy trách nhiệm.', '<code>doiSoatThuCong</code>'],
  ['19', 'Thu ngân', 'Hết ca: đếm két theo mệnh giá và nhập số thực đếm.', 'BR-30. Mốc bắt đầu ca là LẦN CHỐT CA GẦN NHẤT CỦA CHÍNH NGƯỜI ĐÓ, không phải 00:00 — nếu không, thu ngân ca chiều sẽ nhận cả doanh thu ca sáng.', '<code>services/chotCaService.js</code>'],
  ['20', 'Thu ngân', 'Chênh lệch = thực đếm − tiền mặt hệ thống.', 'Âm là thiếu tiền, phải ghi lý do; dương thường là quên trả lại tiền thừa cho khách.', '<code>chotCaService</code>'],
  ['21', 'Quản lý', 'Duyệt biên bản chốt ca.', 'Quyền duyệt tách khỏi quyền chốt: người đếm két không tự duyệt được biên bản của mình.', '<code>POST /staff/chot-ca/:id/duyet</code>'],
];

const QUY_TAC_THANH_TOAN = [
  ['BR-21', 'Không cho trả vượt <code>con_phai_tra</code> (cho phép sai lệch nhỏ do làm tròn). Phiên <code>dat_coc</code> không bị chặn.', 'Phải truyền mã giảm giá và số điểm vào lúc kiểm tra, nếu không <code>con_phai_tra</code> sẽ là số CHƯA giảm, và phiên trả đúng số tiền đã giảm lại bị coi là trả thiếu.'],
  ['BR-22', 'Mỗi cặp (<code>sesis</code>, phương thức) chỉ có MỘT phiên pending. Tạo phiên mới thì phiên cũ chuyển <code>failed</code>.', 'Hai mã QR còn hiệu lực cho cùng một đơn thì khách quét nhầm mã cũ, số tiền không khớp, và đối soát tự động thất bại.'],
  ['BR-23', 'Điều kiện <code>status = pending</code> đặt NGAY TRONG câu UPDATE, không đọc-rồi-ghi.', 'Webhook ngân hàng có thể báo có đúng khoảnh khắc thu ngân sốt ruột bấm "Xác nhận thủ công". Đọc rồi ghi không khoá thì cả hai đều thấy pending, cả hai cùng chạy hậu kỳ: khách được cộng điểm gấp đôi, mã giảm giá bị trừ hai lượt. Đặt điều kiện trong câu UPDATE thì MySQL tự khoá dòng đó — không cần transaction, không cần bảng khoá riêng.'],
  ['BR-24', 'Số tiền, mã giảm giá và số điểm ghi vào <code>payments</code> là giá trị ĐÃ KIỂM TRA LẠI ở máy chủ.', 'Khách có thể sửa số điểm trong DevTools để trừ nhiều hơn số điểm đang có, hoặc gửi lên một mã giảm giá đã hết hạn.'],
  ['BR-25', 'Khách vãng lai (số điện thoại bắt đầu bằng <code>QR_</code>) không dùng và không tích điểm.', 'Họ không có tài khoản thật; không chặn thì mọi bàn sẽ chung một ví điểm.'],
  ['BR-26', 'Trừ điểm trước, cộng điểm sau. Điểm cộng tính trên <code>amount</code> — số tiền mặt hoặc chuyển khoản THẬT SỰ thu được.', 'Không tính trên phần đã trừ bằng điểm, nếu không điểm sẽ tự sinh ra điểm.'],
  ['BR-27', 'Phiên <code>loai = dat_coc</code> không đóng đơn và không cộng điểm.', 'Bản chất là trả trước một phần, bữa ăn còn chưa diễn ra.'],
  ['BR-28', 'Chuyển thiếu tiền thì KHÔNG tự động xác nhận.', 'Để thu ngân nhìn thấy và xử lý tay, kèm số nhận được và số cần.'],
  ['BR-29', 'Webhook sai khoá trả 401. Đã ghi nhận được thì LUÔN trả HTTP 200, kể cả khi không khớp phiên nào.', 'Bên gửi sẽ bắn lại liên tục nếu nhận mã khác 200, mà giao dịch đó ta đã lưu vào hộp thư rồi và vẫn đối soát tay được.'],
  ['BR-30', 'Chốt ca chỉ đối soát những khoản ĐI QUA TAY người đó (<code>payments.processed_by</code>).', 'Tiền khách tự quét QR chuyển thẳng vào tài khoản ngân hàng vẫn hiện trong biên bản để thấy tổng doanh thu ca, nhưng không tính vào trách nhiệm của ai — nó không nằm trong két của ai cả.'],
];

const NGOAI_LE_THANH_TOAN = [
  ['khong_co_ma', 'Nội dung chuyển khoản không chứa mã <code>BD…</code>.', 'Đánh dấu <code>khong_khop</code>, chờ thu ngân ghép tay ở trang đối soát.'],
  ['khong_co_phien', 'Không có phiên <code>pending</code> nào mang mã đó.', 'Ghi lý do vào giao dịch; thường là khách quét lại mã QR đã hết hạn.'],
  ['thieu_tien', 'Số tiền nhận được nhỏ hơn số tiền của phiên.', 'Ghi rõ nhận bao nhiêu, cần bao nhiêu; không tự xác nhận.'],
  ['tat_tu_dong', 'Quản trị đã tắt <code>tu_dong_doi_soat</code>.', 'Chuyển sang <code>cho_doi_soat</code> để người thật duyệt từng khoản.'],
  ['trùng lặp', 'Webhook bắn lại một giao dịch đã ghi.', 'Khoá duy nhất trên <code>ma_tham_chieu</code> chặn lại, trả <code>duplicated: true</code> và không chạy hậu kỳ lần hai.'],
  ['giao dịch ra', 'Tiền đi RA khỏi tài khoản.', 'Đánh dấu <code>bo_qua</code> — không liên quan tới việc thu tiền khách.'],
  ['QR quá hạn', 'Phiên pending quá <code>het_han_luc</code>.', 'Dọn tự động khi mở màn hình POS, chuyển phiên sang <code>failed</code>.'],
  ['hoàn tiền', 'Trả lại tiền cho khách sau khi đã thu.', 'Phiên chuyển <code>refunded</code>; phiên đã hoàn không xác nhận lại được.'],
  ['giả lập', 'Môi trường demo không có đầu nối ngân hàng thật.', 'Đường dẫn <code>/gia-lap</code> tạo phiên rồi xác nhận luôn, vẫn chạy đủ hậu kỳ. Tự tắt khi <code>NODE_ENV = production</code> hoặc <code>PAYMENT_SIMULATION = 0</code>.'],
];

const TRANG_THAI_THANH_TOAN = [
  ['pending', '<code>payments</code> — đã sinh mã QR, đang chờ tiền về.', 'success · failed'],
  ['success', '<code>payments</code> — đã thu được tiền, hậu kỳ đã chạy.', 'refunded'],
  ['failed', '<code>payments</code> — huỷ, quá hạn, hoặc bị thay bằng phiên mới.', '(kết thúc)'],
  ['refunded', '<code>payments</code> — đã hoàn tiền cho khách.', '(kết thúc)'],
  ['cho_doi_soat', '<code>giao_dich_ngan_hang</code> — chờ người thật duyệt.', 'da_khop · khong_khop'],
  ['da_khop', '<code>giao_dich_ngan_hang</code> — đã gắn vào một phiên thanh toán.', '(kết thúc)'],
  ['khong_khop', '<code>giao_dich_ngan_hang</code> — chưa tìm được phiên tương ứng.', 'da_khop (ghép tay)'],
  ['bo_qua', '<code>giao_dich_ngan_hang</code> — giao dịch chuyển ra, không xét.', '(kết thúc)'],
];

const ANH_XA = [
  ['Đặt bàn, giỏ hàng, đơn của tôi', '<code>server.js</code>, <code>services/orderService.js</code>, <code>services/bookingService.js</code>'],
  ['Quét mã QR gọi món tại bàn', '<code>GET /qr/table/:tableId</code>, <code>POST /qr/add-dish</code>, <code>orderService.timIdBanTheoTen()</code>'],
  ['Sơ đồ bàn thời gian thực', '<code>routes/kds.js</code>, <code>services/kdsService.js</code>, <code>views/staff/so-do-ban.ejs</code>'],
  ['Màn hình bếp và trừ kho', '<code>kdsService.hoanThanhCheBien()</code> &rarr; bảng <code>nguyen_lieu</code>, <code>xuat_kho</code>'],
  ['Thanh toán, VietQR, đối soát', '<code>routes/thanhToan.js</code>, <code>services/thanhToanService.js</code>, <code>services/vietQR.js</code>'],
  ['Dashboard phân tích', '<code>routes/analytics.js</code> (13 endpoint JSON), <code>services/analyticsService.js</code>'],
  ['Dự báo và gợi ý AI', '<code>routes/forecast.js</code>, <code>services/mlService.js</code>, <code>ml_service/forecast.py</code>, <code>ml_service/apriori.py</code>'],
  ['Chấm công khuôn mặt và GPS', '<code>routes/khuonMat.js</code>, <code>services/faceService.js</code>, <code>ml_service/khuon_mat.py</code>'],
  ['Cơ cấu tổ chức, phân quyền', '<code>routes/toChuc.js</code>, <code>services/toChucService.js</code>, <code>services/phanQuyenService.js</code>'],
  ['Điểm tích luỹ, mã giảm giá', '<code>routes/loyalty.js</code>, <code>routes/adminLoyalty.js</code>, <code>services/loyaltyService.js</code>'],
];

/* --- dem so ca su dung that su ve ra, khong go tay con so --- */
const SVG_PHAN_RA = [uc.ucKhachHang(), uc.ucPhucVu(), uc.ucBepKho(),
  uc.ucThanhToan(), uc.ucNhanSu(), uc.ucPhanTich(), uc.ucGiaoHang()];
const SO_CA = SVG_PHAN_RA.reduce((n, x) => n + (x.match(/class="uc /g) || []).length, 0);
const SVG_TONG_QUAT = tq.tongQuatMau();
const SO_CA_DAY_DU = (SVG_TONG_QUAT.match(/class="uc /g) || []).length;

/* --------------------------------------------------------------- trang */

const CSS = `
:root{
  --sans:"Segoe UI","Segoe UI Variable Text",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
  --serif:Cambria,Constantia,"Palatino Linotype","Book Antiqua",Georgia,serif;
  --mono:Consolas,"Cascadia Mono","SF Mono",ui-monospace,Menlo,monospace;

  --nen:#f4f7f5;
  --giay:#ffffff;
  --giay-2:#e9efec;
  --muc:#141c1a;
  --muc-mo:#5b6b66;
  --vien:#d8e0dc;
  --vien-dam:#a6b6b0;
  --nhan:#0f6b62;
  --nhan-nen:#e2efec;
  --canh:#9a5312;
  --canh-nen:#f6ebde;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --nen:#0d1412;
    --giay:#151e1b;
    --giay-2:#1d2825;
    --muc:#e6efec;
    --muc-mo:#94a6a1;
    --vien:#293733;
    --vien-dam:#4b5f59;
    --nhan:#63cabc;
    --nhan-nen:#123230;
    --canh:#dda45f;
    --canh-nen:#2f2519;
  }
}
:root[data-theme="dark"]{
  --nen:#0d1412;
  --giay:#151e1b;
  --giay-2:#1d2825;
  --muc:#e6efec;
  --muc-mo:#94a6a1;
  --vien:#293733;
  --vien-dam:#4b5f59;
  --nhan:#63cabc;
  --nhan-nen:#123230;
  --canh:#dda45f;
  --canh-nen:#2f2519;
}

*{box-sizing:border-box;}
body{
  margin:0; background:var(--nen); color:var(--muc);
  font-family:var(--sans); font-size:16px; line-height:1.62;
  -webkit-font-smoothing:antialiased;
}
.trang{max-width:1320px; margin:0 auto; padding:0 30px 110px;}
.van{max-width:74ch;}

/* ---- dau trang ---- */
.dau{
  border-bottom:1px solid var(--vien); padding:60px 0 34px; margin-bottom:44px;
  display:flex; flex-direction:column; gap:16px;
}
.mac{
  font-family:var(--mono); font-size:11.5px; letter-spacing:.16em;
  text-transform:uppercase; color:var(--nhan);
}
h1{
  font-family:var(--serif); font-weight:700; font-size:clamp(30px,4.4vw,48px);
  line-height:1.14; margin:0; text-wrap:balance; letter-spacing:-.01em;
}
.phu-de{font-size:17.5px; color:var(--muc-mo); max-width:66ch; margin:0;}
.mo-ta-du-an{
  display:flex; flex-wrap:wrap; gap:8px 28px; font-size:13.5px; color:var(--muc-mo);
  font-family:var(--mono);
}
.mo-ta-du-an b{color:var(--muc); font-weight:600;}

/* ---- muc luc ---- */
.muc-luc{
  background:var(--giay); border:1px solid var(--vien); border-radius:10px;
  padding:20px 24px; margin-bottom:56px; max-width:74ch;
}
.muc-luc h2{font-size:12px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--muc-mo); margin:0 0 12px; font-family:var(--sans); font-weight:700;}
.muc-luc ol{margin:0; padding-left:20px; columns:2; column-gap:36px; font-size:14.5px;}
.muc-luc li{margin:0 0 5px; break-inside:avoid;}
.muc-luc a{color:var(--muc); text-decoration:none; border-bottom:1px solid transparent;}
.muc-luc a:hover,.muc-luc a:focus-visible{border-bottom-color:var(--nhan); color:var(--nhan);}

/* ---- muc ---- */
section{margin-bottom:72px; scroll-margin-top:20px;}
h2.muc{
  font-family:var(--serif); font-size:28px; font-weight:700; margin:0 0 8px;
  display:flex; align-items:baseline; gap:14px; text-wrap:balance;
}
h2.muc .so{
  font-family:var(--mono); font-size:14px; color:var(--nhan); font-weight:400;
  letter-spacing:.05em; flex:none;
}
h3{font-family:var(--serif); font-size:20px; font-weight:700; margin:44px 0 6px; text-wrap:balance;}
p{margin:0 0 14px;}
.van p:last-child{margin-bottom:0;}
a{color:var(--nhan);}
code{font-family:var(--mono); font-size:.87em; background:var(--giay-2);
  padding:1px 5px; border-radius:4px; word-break:break-word;}
strong{font-weight:650;}

/* ---- hinh ---- */
.khoi-hinh{margin:26px 0 8px;}
.cap{
  font-size:13.5px; font-weight:650; margin-bottom:10px; display:flex;
  gap:12px; align-items:baseline; text-wrap:balance;
}
.cap-so{
  font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--nhan); background:var(--nhan-nen); padding:3px 8px; border-radius:4px; flex:none;
}
.hinh-hop{
  background:var(--giay); border:1px solid var(--vien); border-radius:10px;
  padding:20px 22px; overflow-x:auto;
}
.cap-duoi{font-size:13.5px; color:var(--muc-mo); margin:10px 0 0; max-width:82ch;}
.hinh{color:var(--muc); display:block; max-width:100%; height:auto; min-width:640px;}

/* ---- ky hieu trong SVG (dung chung voi file SVG roi) ---- */
${v.CSS_KY_HIEU}

/* ---- bang ---- */
.bang-hop{overflow-x:auto; margin:22px 0 8px; border:1px solid var(--vien);
  border-radius:10px; background:var(--giay);}
table{border-collapse:collapse; width:100%; font-size:14px; min-width:620px;}
caption{
  text-align:left; padding:14px 18px 0; font-size:14px; color:var(--muc);
}
th,td{padding:10px 18px; text-align:left; vertical-align:top;
  border-bottom:1px solid var(--vien);}
thead th{
  font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muc-mo);
  font-weight:700; background:var(--giay-2); border-bottom:1px solid var(--vien-dam);
}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0;}
.vai{font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase;
  padding:2px 8px; border-radius:20px; white-space:nowrap;}
.vai-chinh{background:var(--nhan-nen); color:var(--nhan);}
.vai-phu{background:var(--canh-nen); color:var(--canh);}

.bang-buoc{min-width:960px;}
.bang-buoc td:first-child,.bang-buoc th:first-child{width:46px; text-align:right;
  font-family:var(--mono); font-size:12px; color:var(--muc-mo); white-space:nowrap;}
.bang-buoc td:nth-child(2){font-size:12.5px; color:var(--muc-mo); white-space:nowrap;}
.bang-buoc td:last-child{font-size:12.5px;}
.bang-ma{min-width:760px;}
.bang-ma td:first-child,.bang-ma th:first-child{width:96px; font-family:var(--mono);
  font-size:12px; font-weight:700; color:var(--nhan); white-space:nowrap;}
.bang-tt td:first-child{font-family:var(--mono); font-size:12px; font-weight:700; white-space:nowrap;}

.dac-ta{min-width:560px;}
.dac-ta caption{padding:16px 18px 10px; border-bottom:1px solid var(--vien);
  font-family:var(--serif); font-size:16.5px;}
.dac-ta th{width:150px; color:var(--muc-mo); font-weight:600; font-size:13px;
  background:var(--giay-2); white-space:nowrap;}
.dac-ta ol,.dac-ta ul{margin:0; padding-left:20px;}
.dac-ta li{margin-bottom:3px;}
.dac-ta li:last-child{margin-bottom:0;}

/* ---- ghi chu ---- */
.luu-y{
  border-left:3px solid var(--nhan); background:var(--giay);
  padding:14px 20px; border-radius:0 8px 8px 0; margin:24px 0; max-width:80ch;
  font-size:14.5px;
}
.luu-y p{margin:0 0 8px;} .luu-y p:last-child{margin:0;}

footer{border-top:1px solid var(--vien); padding-top:24px; color:var(--muc-mo);
  font-size:13.5px; max-width:74ch;}

@media (max-width:760px){
  .trang{padding:0 18px 80px;}
  .muc-luc ol{columns:1;}
  .dau{padding-top:36px;}
}
@media (prefers-reduced-motion:reduce){*{transition:none !important; animation:none !important;}}
`;

const MUC = [
  ['pham-vi', 'Phạm vi và cách lập sơ đồ'],
  ['tac-nhan', 'Tác nhân của hệ thống'],
  ['uc-tong-quat', 'Sơ đồ use case tổng quát'],
  ['uc-phan-ra', 'Sơ đồ use case phân rã theo phân hệ'],
  ['dac-ta', 'Đặc tả ba use case tiêu biểu'],
  ['bpmn', 'Sơ đồ quy trình nghiệp vụ (BPMN)'],
  ['dac-ta-quy-trinh', 'Đặc tả hai quy trình trọng yếu'],
  ['lop', 'Sơ đồ lớp'],
  ['erd', 'Lược đồ quan hệ thực thể (ERD)'],
  ['tuan-tu', 'Sơ đồ tuần tự'],
  ['hoat-dong', 'Sơ đồ hoạt động'],
  ['anh-xa', 'Ánh xạ sơ đồ sang mã nguồn'],
];

let h = '';
h += `<title>Sơ đồ Use Case &amp; BPMN — Hệ thống quản lý nhà hàng thông minh</title>`;
h += `<style>${CSS}</style>`;
h += `<div class="trang">`;

/* --- dau trang --- */
h += `
<header class="dau">
  <div class="mac">Tài liệu phân tích thiết kế &middot; Khoá luận Hệ thống thông tin</div>
  <h1>Sơ đồ Use Case &amp; BPMN<br>Hệ thống quản lý nhà hàng thông minh</h1>
  <p class="phu-de">Bảy sơ đồ ca sử dụng và năm sơ đồ quy trình nghiệp vụ, dựng trực tiếp
  từ mã nguồn đang chạy: <b>Node/Express + EJS + MySQL</b> cho phần nghiệp vụ và
  <b>Python/FastAPI</b> tách riêng cho phần học máy.</p>
  <div class="mo-ta-du-an">
    <span>Tác nhân: <b>8 người dùng + 2 hệ thống ngoài</b></span>
    <span>Ca sử dụng: <b>${SO_CA_DAY_DU}</b></span>
    <span>Quy trình: <b>10</b></span>
    <span>Quy mô: <b>40 bàn / 4 khu</b></span>
  </div>
</header>`;

/* --- muc luc --- */
h += `<nav class="muc-luc"><h2>Nội dung</h2><ol>` +
  MUC.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('') +
  `</ol></nav>`;

const mo = (i) => `<section id="${MUC[i][0]}"><h2 class="muc"><span class="so">${String(i + 1).padStart(2, '0')}</span>${MUC[i][1]}</h2>`;

/* --- 1. Pham vi --- */
h += mo(0) + `
<div class="van">
<p>Tài liệu này mô tả hệ thống ở hai mức khác nhau và cố ý không trộn chúng vào nhau.
<b>Sơ đồ use case</b> trả lời câu hỏi <i>ai làm được gì</i> — nó liệt kê chức năng theo
tác nhân, không nói thứ tự. <b>Sơ đồ BPMN</b> trả lời câu hỏi <i>công việc chạy qua
những ai theo thứ tự nào</i> — nó cho thấy điểm bàn giao giữa khách, phục vụ, bếp,
thu ngân và các bước hệ thống tự chạy.</p>

<p>Mọi chức năng vẽ ở đây đều lấy từ mã nguồn đang chạy, chủ yếu là các đường dẫn
khai báo trong <code>server.js</code> và thư mục <code>routes/</code>, cùng nghiệp vụ
trong <code>services/</code>. Phần &sect;7 ánh xạ ngược từng nhóm chức năng về đúng
tệp mã, để có thể đối chiếu khi bảo vệ.</p>

<p>Hai điều được vẽ đúng như hệ thống thật chứ không lý tưởng hoá. Thứ nhất, việc
<b>trừ tồn kho</b> đặt ở bước bếp <i>hoàn thành chế biến</i> chứ không phải lúc khách
gọi món — đó là thời điểm nguyên liệu thực sự bị tiêu hao. Thứ hai, khi <b>dịch vụ ML
không phản hồi</b>, hệ thống không sập mà quay về dùng kết quả dự báo đã lưu; nhánh
này được vẽ thành một rẽ nhánh thật trong Hình 12.</p>
</div>` + `</section>`;

/* --- 2. Tac nhan --- */
h += mo(1) + `
<div class="van"><p>Vai trò trong hệ thống không gán cứng vào mã mà lấy từ bảng
<code>chuc_danh</code> (23 chức danh, 6 cấp bậc, 8 bộ phận) và bảng phân quyền
<code>chuc_danh_quyen</code>. Bảng dưới gom các chức danh đó thành tám tác nhân người
dùng — mức trừu tượng vừa đủ để sơ đồ đọc được — cộng hai hệ thống ngoài.</p></div>
<div class="bang-hop"><table>
<thead><tr><th>Tác nhân</th><th>Loại</th><th>Trách nhiệm trong hệ thống</th><th>Nguồn dữ liệu</th></tr></thead>
<tbody>` +
  TAC_NHAN.map(([ten, loai, mo2, nguon]) => `<tr>
    <td><b>${ten}</b></td>
    <td><span class="vai ${loai === 'Chính' ? 'vai-chinh' : 'vai-phu'}">${loai}</span></td>
    <td>${mo2}</td><td>${nguon}</td></tr>`).join('') +
  `</tbody></table></div>` + `</section>`;

/* --- 3. UC tong quat --- */
h += mo(2) + `
<div class="van"><p>Sơ đồ tổng quát dựng theo bố cục UML kinh điển: một khung
hệ thống duy nhất, tác nhân đứng hẳn bên ngoài ở hai mép, và ca sử dụng
<b>Đăng nhập</b> nằm giữa mang điểm mở rộng <i>Đăng xuất</i>. Mọi chức năng đòi hỏi
phiên đăng nhập đều nối về đó bằng quan hệ <code>«include»</code>.</p>

<p>Điểm đáng chú ý nhất trên sơ đồ là <b>bốn ca sử dụng không có mũi tên
<code>«include»</code></b>, đều thuộc Khách vãng lai. Đó không phải thiếu sót mà là
đặc điểm thiết kế: khách quét mã QR tại bàn gọi món được ngay, hệ thống tự tạo một
tài khoản vãng lai gắn với mã bàn thay vì bắt đăng nhập.</p>

<p>Quan hệ <b>kế thừa giữa tác nhân</b> (mũi tên tam giác rỗng) gom lại phần chức năng
dùng chung. Khách hàng thành viên kế thừa Khách vãng lai nên vẫn xem được thực đơn và
quét mã QR. Sáu chức danh — phục vụ, thu ngân, bếp, thủ kho, kế toán, quản lý — đều kế
thừa Nhân viên chung, nên chấm công, đăng ký lịch làm việc, xem thông báo và đổi mật
khẩu chỉ phải vẽ một lần.</p></div>` +
  hinh(1, 'Sơ đồ use case tổng quát của hệ thống', SVG_TONG_QUAT,
    'Bốn ca sử dụng của <b>Khách vãng lai</b> không có mũi tên <code>«include»</code> về Đăng nhập — đúng như hệ thống thật: quét mã QR gọi món tại bàn chạy được mà không cần tài khoản. Mũi tên tam giác rỗng là quan hệ kế thừa giữa tác nhân; sáu chức danh nhân viên gộp nhánh vào một thân rồi chỉ một mũi tên chạm vào <b>Nhân viên chung</b>, nên phần chức năng dùng chung (chấm công, lịch làm việc, thông báo, đổi mật khẩu) chỉ phải vẽ một lần.') +
  hinh(2, 'Chú giải ký hiệu use case (UML)', chuGiaiUml(), null) +
  `</section>`;

/* --- 4. UC phan ra --- */
h += mo(3) + `
<div class="van"><p>Sáu sơ đồ dưới đây phân rã các nhóm chức năng của Hình 1. Ca sử dụng
tô nền là ca được gọi lại từ ca khác qua quan hệ <code>&laquo;include&raquo;</code>
(luôn xảy ra) hoặc <code>&laquo;extend&raquo;</code> (chỉ xảy ra trong điều kiện nhất định).</p></div>` +
  hinh(3, 'Phân hệ khách hàng', SVG_PHAN_RA[0],
    'Khách quét mã QR tại bàn không cần đăng nhập: hệ thống tự tạo một tài khoản vãng lai gắn với mã bàn, nên vẫn ghi nhận được đơn về đúng bàn.') +
  hinh(4, 'Phân hệ phục vụ và sơ đồ bàn', SVG_PHAN_RA[1],
    'Sơ đồ bàn hiển thị 40 bàn chia 4 khu theo thời gian thực qua Socket.IO. Chỉ Quản lý và Quản trị hệ thống mới lưu được toạ độ sau khi kéo thả.') +
  hinh(5, 'Phân hệ bếp và kho', SVG_PHAN_RA[2],
    'Món trên màn hình bếp đi qua bốn trạng thái: chờ chế biến, đang chế biến, hoàn thành, đã phục vụ. Trừ kho gắn vào bước hoàn thành và ghi lại nhật ký xuất kho — chính dữ liệu này nuôi mô hình dự báo nguyên liệu.') +
  hinh(6, 'Phân hệ thanh toán và kế toán', SVG_PHAN_RA[3],
    'Nhánh chuyển khoản sinh mã VietQR theo đúng số tiền phải trả; khi ngân hàng gửi thông báo báo có, hệ thống tự khớp với phiên đang chờ nên thu ngân không phải xác nhận tay.') +
  hinh(7, 'Phân hệ nhân sự, chấm công và tổ chức', SVG_PHAN_RA[4],
    'Chấm công bằng khuôn mặt luôn kèm hai kiểm tra bắt buộc: ảnh sống (chống chụp lại ảnh) và vị trí GPS trong bán kính cho phép quanh nhà hàng.') +
  hinh(8, 'Phân hệ phân tích, dự báo AI và quản trị', SVG_PHAN_RA[5],
    'Mọi lần chạy dự báo đều so kết quả với baseline SeasonalNaive và ghi lại chỉ số vào bảng <code>danh_gia_mo_hinh</code>, để luôn trả lời được câu hỏi mô hình có thật sự tốt hơn cách làm ngây thơ hay không.') +
  hinh(9, 'Phân hệ giao hàng', SVG_PHAN_RA[6],
    'Bốn nhóm người dùng, bốn khu đường dẫn tách bạch: quản trị khai bảng giá, điều phối phân đơn, người giao dùng ứng dụng điện thoại, còn khách tra cứu đơn bằng mã giao mà không cần đăng nhập. Phí giao luôn được tính lại ở máy chủ từ toạ độ và bảng giá trong CSDL — con số hiện trên trang đặt hàng chỉ để xem.') +
  `</section>`;

/* --- 5. Dac ta --- */
h += mo(4) + `
<div class="van"><p>Ba ca sử dụng dưới đây được đặc tả chi tiết vì chúng chứa phần lớn
rủi ro nghiệp vụ của hệ thống: một ca không có đăng nhập, một ca thay đổi tồn kho, và
một ca liên quan tới dữ liệu sinh trắc học.</p></div>
<div class="bang-hop">` +
  dacTa({
    ma: 'UC-05', ten: 'Quét mã QR gọi món tại bàn',
    tacNhan: 'Khách hàng (không cần đăng nhập)',
    moTa: 'Khách dùng camera điện thoại quét mã QR dán trên bàn, chọn món và gửi đơn thẳng xuống bếp.',
    tien: 'Bàn đã được sinh mã QR; mã QR còn hiệu lực và trùng tên với mã bàn trong bảng <code>ban</code>.',
    chinh: [
      'Khách quét mã, trình duyệt mở <code>/qr/table/:tableId?name=&lt;mã bàn&gt;</code>.',
      'Hệ thống tra <code>qr_tables</code> theo <code>table_id</code> và hiển thị thực đơn kèm tên bàn.',
      'Khách chọn món, số lượng rồi gửi đơn.',
      'Hệ thống tìm hoặc tạo tài khoản vãng lai theo mã bàn, mở phiên <code>QR_&lt;tableId&gt;_&lt;mã&gt;</code>.',
      'Hệ thống đổi tên bàn trên mã QR sang <code>ban.Id_ban</code> và ghi các dòng món vào <code>hopdong</code>.',
      'Bàn chuyển sang trạng thái <i>Đang phục vụ</i>; món hiện trên màn hình bếp qua Socket.IO.',
    ],
    thayThe: [
      'Tên bàn trên mã QR không khớp bàn nào: đơn vẫn vào bếp nhưng không gắn số bàn — vì vậy đổi tên bàn bắt buộc phải đồng bộ lại mã QR.',
      'Phiên đã thanh toán hoặc đã huỷ: hệ thống từ chối thêm món và yêu cầu mở phiên mới.',
      'Khách quét lại mã trong cùng bữa: hệ thống nối vào phiên đang mở thay vì tạo phiên mới.',
    ],
    hau: 'Đơn nằm trong <code>hopdong</code> với <code>id_ban</code> đúng; bàn ở trạng thái <i>Đang phục vụ</i>; món chờ bếp xử lý.',
  }) +
  `</div><div class="bang-hop">` +
  dacTa({
    ma: 'UC-14', ten: 'Hoàn thành chế biến món',
    tacNhan: 'Nhân viên bếp',
    moTa: 'Bếp đánh dấu món đã nấu xong. Đây là điểm duy nhất trong hệ thống tự động trừ tồn kho.',
    tien: 'Món đang ở trạng thái <i>chờ chế biến</i> hoặc <i>đang chế biến</i> của ca hôm nay.',
    chinh: [
      'Bếp bấm <i>Hoàn thành</i> trên màn hình bếp.',
      'Hệ thống mở một giao dịch CSDL.',
      'Đổi <code>trangthai_bep</code> sang 2 và ghi mốc <code>bep_ket_thuc</code>.',
      'Đọc công thức của món, tính lượng tiêu hao = định mức &times; số lượng.',
      'Trừ <code>nguyen_lieu.so_luong</code> và ghi một dòng <code>xuat_kho</code> cho mỗi nguyên liệu.',
      'Xác nhận giao dịch, phát sự kiện cho màn hình bếp và sơ đồ bàn.',
    ],
    thayThe: [
      'Món không còn ở trạng thái hợp lệ (đã có người bấm trước): hệ thống báo lỗi, không trừ kho lần hai.',
      'Lỗi bất kỳ trong lúc trừ kho: toàn bộ giao dịch quay lui, trạng thái món giữ nguyên.',
      'Món không có công thức: chỉ đổi trạng thái, không trừ kho.',
    ],
    hau: 'Tồn kho giảm đúng định mức; nhật ký <code>xuat_kho</code> có dữ liệu tiêu hao thực tế cho mô hình dự báo nguyên liệu.',
  }) +
  `</div><div class="bang-hop">` +
  dacTa({
    ma: 'UC-38', ten: 'Chấm công bằng khuôn mặt',
    tacNhan: 'Nhân viên (chính) &middot; Dịch vụ ML (phụ)',
    moTa: 'Nhân viên chấm công vào/ra bằng khuôn mặt trước webcam, kèm ràng buộc vị trí để không chấm công từ xa được.',
    tien: 'Nhân viên đã đăng ký khuôn mặt; trình duyệt được cấp quyền camera và định vị.',
    chinh: [
      'Nhân viên mở trang chấm công; trình duyệt lấy toạ độ GPS và bật webcam.',
      'Trình duyệt gửi chuỗi khung hình kèm toạ độ lên máy chủ.',
      'Máy chủ kiểm tra khoảng cách tới nhà hàng <b>trước khi</b> gọi dịch vụ nhận diện.',
      'Dịch vụ ML kiểm tra ảnh sống bằng thử thách (gật đầu / quay trái phải).',
      'Dịch vụ ML nhận diện 1:N ở chế độ kiosk, hoặc xác minh 1:1 khi đã đăng nhập.',
      'Máy chủ ghi bản ghi vào/ra vào <code>cham_cong</code>, lưu ảnh và toạ độ.',
    ],
    thayThe: [
      'Ngoài bán kính cho phép: chặn ngay ở bước 3, ghi <code>nhat_ky_nhan_dien</code> với lý do sai vị trí và ghi <code>cham_cong_gps</code>. Không gọi tới dịch vụ nhận diện.',
      'Không qua được kiểm tra ảnh sống hoặc độ tương đồng dưới ngưỡng: từ chối, ghi nhật ký, chuyển sang luồng quản lý duyệt thủ công.',
      'Dịch vụ ML không chạy: chấm công khuôn mặt tạm ngưng, quản lý bổ sung công bằng tay.',
    ],
    hau: 'Có bản ghi chấm công kèm bằng chứng ảnh và toạ độ; hoặc có bản ghi nhật ký giải thích vì sao bị từ chối.',
  }) +
  `</div>` + `</section>`;

/* --- 6. BPMN --- */
h += mo(5) + `
<div class="van"><p>Mười quy trình dưới đây là những luồng đi qua nhiều vai trò nhất, nên
cũng là nơi dễ đứt gãy nhất khi vận hành. Mỗi sơ đồ là một pool chia thành bốn lằn;
lằn cuối luôn là phần hệ thống tự chạy, để phân biệt rõ việc người làm với việc máy làm.</p>

<p><b>Hai mức chi tiết.</b> Hình 11–12, 16 và 19–20 vẽ <i>một quy trình trên một hình</i>:
đủ để nhìn ra điểm bàn giao giữa các vai, hợp khi trình bày cho người không đọc mã.
Riêng hai quy trình nhiều tiền và nhiều rủi ro nhất — <b>đặt bàn</b> và <b>thanh toán</b> —
được tách tiếp thành năm hình chi tiết (13–15 và 17–18), mỗi bước ứng với một lệnh thật
trong mã nguồn. Tách ra chứ không nhồi vào một hình là có lý do: một sơ đồ mười tám bước
kéo dài ba mét giấy thì không ai đọc, và cũng không in vào báo cáo được.</p></div>` +
  hinh(10, 'Chú giải ký hiệu BPMN', chuGiaiBpmn(), null) +
  hinh(11, 'Quy trình phục vụ và chế biến tại bàn', bpmn.phucVu(),
    'Vòng lặp gọi thêm món trong cùng một bữa lặp lại từ bước quét mã QR và không vẽ lại để giữ sơ đồ đọc được. Bước trừ tồn kho nằm trong cùng giao dịch với bước hoàn thành chế biến: hoặc cả hai cùng thành công, hoặc cả hai cùng quay lui.') +
  hinh(12, 'Quy trình đặt bàn trực tuyến — mức tổng quan', bpmn.datBan(),
    'Hệ thống kiểm tra bàn trống rồi giữ ô lưới thời gian trước khi trả mã đặt bàn cho khách. Nếu nhà hàng yêu cầu đặt cọc, mã VietQR được sinh theo đúng số tiền và chỉ khi ngân hàng báo có thì bàn mới được xác nhận chắc chắn. Ba hình sau phân rã chính quy trình này.') +
  hinh(13, 'Đặt bàn (chi tiết 1/3) — chọn giờ, chọn bàn và gợi ý thay thế', bpmn.datBanChonGio(),
    'Toàn bộ giai đoạn này chỉ ĐỌC, không ghi gì xuống cơ sở dữ liệu. Vì vậy trợ lý kiểm tra được bàn trống ngay ở bước 1, khi khách chưa bỏ công điền tên. Nhánh hết bàn không dừng ở một câu báo lỗi: hàm khungGioThayThe và khuVucThayThe trả về các khung giờ và khu vực THẬT SỰ đặt được — đã qua cả kiểm tra giờ mở cửa lẫn kiểm tra bàn trống — nên trang vẽ chúng thành nút bấm quay về bước 1 với giờ mới chọn sẵn.') +
  hinh(14, 'Đặt bàn (chi tiết 2/3) — ghi lượt đặt và hàng rào chống đặt trùng', bpmn.datBanGhiNhan(),
    'Đây là hình quan trọng nhất của phân hệ đặt bàn. Hai bước INSERT nằm trong CÙNG một giao dịch: bản ghi reservations là thứ người đọc, còn các dòng reservation_slot_locks mới là thứ giữ chỗ thật. Khoá chính (table_id, slot_start) khiến lượt thứ hai đâm vào ô đã có chủ bị MySQL từ chối ngay trong giao dịch, nên không còn khe hở giữa "đọc thấy còn bàn" và "ghi bàn". Vòng thử lại chỉ chạy khi bàn do hệ thống tự chọn: khách đã tự chọn bàn trên sơ đồ thì đổi sang bàn khác mà không hỏi là làm sai ý họ.') +
  hinh(15, 'Đặt bàn (chi tiết 3/3) — vòng đời lượt đặt và vòng quét nền', bpmn.datBanVongDoi(),
    'Dải dưới cùng là một tiến trình chạy song song chứ không nối tiếp vào luồng khách: vòng quét 60 giây trong chính tiến trình web. Nó chốt hai loại hạn mà không ai ngồi canh được — hạn trả tiền cọc và hạn giữ bàn. No-show có hai mốc chứ không phải một: quá hold_until thì cảnh báo, quá thêm auto_no_show_minutes mới tự đóng, vì khách kẹt xe mười phút không phải khách bỏ bữa. Lưu ý bước COMPLETED GIỮ NGUYÊN ô lưới: nhả ra sẽ cho phép đặt đè lên đúng khung giờ vừa phục vụ, bỏ qua cả thời gian dọn bàn.') +
  hinh(16, 'Quy trình thanh toán và đối soát ngân hàng — mức tổng quan', bpmn.thanhToan(),
    'Điểm đáng chú ý là sự kiện trung gian ở lằn ngân hàng: hệ thống không hỏi ngân hàng mà chờ ngân hàng gọi vào, nên phiên thanh toán chuyển trạng thái ngay trên cả điện thoại khách lẫn màn hình thu ngân trong cùng một khoảnh khắc. Hai hình sau phân rã chính quy trình này.') +
  hinh(17, 'Thanh toán (chi tiết 1/2) — lập hoá đơn và mở phiên thu tiền', bpmn.thanhToanHoaDon(),
    'Hoá đơn được dựng lại từ đầu ở mỗi lần gọi chứ không lưu sẵn: cộng các dòng món có id_mon > 0, áp mã giảm giá và điểm tích luỹ, cộng phí phục vụ và VAT, làm tròn, rồi trừ đi phần đã trả để ra con số còn phải trả. Nhờ vậy một đơn ăn trả làm nhiều lần — chia bill, cọc trước rồi trả nốt — vẫn ra đúng số. Hai nhánh tách nhau ở chỗ tiền mặt coi như xong ngay (status = success) còn VietQR để phiên ở trạng thái pending kèm một mã đối soát duy nhất.') +
  hinh(18, 'Thanh toán (chi tiết 2/2) — đối soát VietQR, ngoại lệ và chốt ca', bpmn.thanhToanDoiSoat(),
    'Mã đối soát được dò bằng biểu thức chính quy chứ không so sánh bằng, vì ngân hàng chèn thêm chữ vào nội dung chuyển khoản. Cổng rẽ nhánh gom bốn tình huống không khớp về một chỗ và cả bốn đều trả HTTP 200 — trả mã khác thì bên gửi bắn lại liên tục trong khi giao dịch đó ta đã lưu vào hộp thư rồi. Dải dưới cùng là chốt ca: mốc thời gian lấy từ LẦN CHỐT CA GẦN NHẤT CỦA CHÍNH NGƯỜI ĐÓ, không phải từ 00:00, để không đồng nào bị đếm hai lần và không đồng nào lọt ra ngoài.') +
  hinh(19, 'Quy trình dự báo bằng học máy', bpmn.duBao(),
    'Rẽ nhánh đầu tiên là ràng buộc thiết kế quan trọng nhất của phân hệ AI: dịch vụ Python không được phép làm sập web. Khi nó không trả lời, trang vẫn hiển thị dự báo đã lưu lần chạy trước. Bốn mô hình được chấm điểm gồm SeasonalNaive (baseline), Ridge, RandomForest và GradientBoosting; mô hình có MAE thấp nhất trên 60 ngày cuối được chọn rồi huấn luyện lại trên toàn bộ dữ liệu.') +
  hinh(20, 'Quy trình chấm công bằng khuôn mặt và GPS', bpmn.chamCong(),
    'Thứ tự hai kiểm tra là có chủ đích: kiểm tra vị trí đặt trước kiểm tra khuôn mặt. Người chấm công từ xa bị chặn trong một phần giây thay vì phải đợi hết lượt nhận diện, và câu trả lời "bạn đang ở cách nhà hàng 4 km" không cần biết người đó là ai.') +
  `</section>`;

/* --- 7. Dac ta hai quy trinh trong yeu --- */
h += mo(6) + `
<div class="van">
<p>Sơ đồ cho biết công việc chạy qua những ai theo thứ tự nào, nhưng không nói được
<i>con số nào, bảng nào, vì sao lại làm thế</i>. Phần này bù đúng chỗ đó cho hai quy
trình đã vẽ chi tiết ở trên. Mỗi quy trình gồm năm bảng: thẻ tóm tắt, bảng các bước
ánh xạ sang mã nguồn, bảng quy tắc nghiệp vụ kèm lý do, bảng ngoại lệ, và bảng trạng thái.</p>

<p>Hai quy trình này được chọn vì chúng là nơi <b>sai một lần là mất tiền thật</b>:
đặt bàn có thể bán một cái bàn cho hai người, thanh toán có thể cộng điểm hai lần hoặc
đóng đơn khi chưa thu đủ. Phần lớn quy tắc dưới đây tồn tại vì một tình huống cụ thể,
nên cột lý do được viết ra chứ không để người đọc tự đoán.</p>
</div>

<h3>QT-01 &middot; Đặt bàn trực tuyến</h3>
<div class="bang-hop">` +
  theQuyTrinh('<b>QT-01</b> &middot; Đặt bàn trực tuyến', [
    ['Mục tiêu', 'Nhận yêu cầu giữ bàn theo ngày giờ và số khách, bảo đảm một bàn trong một khung giờ chỉ thuộc về một lượt đặt, rồi giữ lượt đó tới khi khách đến hoặc tới khi hết hạn.'],
    ['Chủ quy trình', 'Quản lý nhà hàng (đặt cấu hình) &middot; Lễ tân (vận hành hằng ngày)'],
    ['Tác nhân', 'Khách hàng &middot; Lễ tân &middot; Thu ngân (ghi nhận cọc) &middot; Quản lý (duyệt, từ chối, gán VIP) &middot; Ngân hàng (báo có tiền cọc)'],
    ['Kích hoạt', 'Khách mở <code>/dat-ban</code>; hoặc nhân viên tạo hộ; hoặc khách vãng lai tới quầy'],
    ['Đầu vào', 'Ngày, giờ, số khách, khu vực, thẻ yêu cầu đặc biệt, tên và số điện thoại'],
    ['Đầu ra', 'Một bản ghi <code>reservations</code> kèm mã <code>RSV-YYMMDD-XXXX</code>, các dòng <code>reservation_slot_locks</code> giữ chỗ, và một hàng đợi thông báo'],
    ['Sự kiện kết thúc', 'COMPLETED (đã dùng bữa) &middot; CANCELLED &middot; REJECTED &middot; NO_SHOW'],
    ['Sơ đồ liên quan', 'Hình 12 (tổng quan) &middot; Hình 13–15 (chi tiết) &middot; Hình 32 (sơ đồ hoạt động)'],
    ['Mã nguồn', '<code>routes/datBan.js</code> &middot; <code>services/reservationRules.js</code> &middot; <code>reservationTables.js</code> &middot; <code>reservationService.js</code> &middot; <code>reservationJobs.js</code> &middot; <code>reservationConfig.js</code>'],
    ['Kiểm thử', '<code>npm run datban:check</code> — 33 phép thử logic thuần chạy được cả khi MySQL tắt, cộng phần cần cơ sở dữ liệu, trong đó ba lớp chống đặt trùng được thử riêng'],
  ]) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-buoc', 'Các bước của QT-01, đánh số theo Hình 13 → 14 → 15',
    ['Bước', 'Lằn', 'Hoạt động', 'Quy tắc và dữ liệu', 'Mã nguồn'], BUOC_DAT_BAN) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-ma', 'Quy tắc nghiệp vụ của QT-01',
    ['Mã', 'Quy tắc', 'Vì sao'], QUY_TAC_DAT_BAN) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-ma', 'Ngoại lệ và luồng thay thế của QT-01',
    ['Mã lỗi', 'Tình huống', 'Xử lý'], NGOAI_LE_DAT_BAN) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-tt', 'Máy trạng thái của một lượt đặt bàn',
    ['Trạng thái', 'Ý nghĩa', 'Chuyển được sang'], TRANG_THAI_DAT_BAN) +
  `</div>

<div class="luu-y">
<p><b>Một cửa duy nhất để đổi trạng thái.</b> Cột <code>status</code> chỉ được đổi qua
<code>doiTrangThai()</code> (BR-17). Hàm này mở giao dịch, khoá dòng bằng
<code>SELECT … FOR UPDATE</code>, kiểm tra bước chuyển có hợp lệ theo bảng trên không,
rồi mới làm các việc kèm theo. Đó cũng là lý do chạy nhiều bản sao web cùng lúc vẫn an
toàn: bản thứ hai chỉ nhận lỗi "không thể chuyển NO_SHOW sang NO_SHOW" và bỏ qua.</p>
</div>

<h3>QT-02 &middot; Thanh toán và đối soát</h3>
<div class="bang-hop">` +
  theQuyTrinh('<b>QT-02</b> &middot; Thanh toán và đối soát ngân hàng', [
    ['Mục tiêu', 'Thu đúng số tiền của một đơn ăn qua tiền mặt hoặc chuyển khoản, ghi nhận đủ một lần và chỉ một lần, rồi đóng đơn và trả bàn.'],
    ['Chủ quy trình', 'Thu ngân &middot; Kế toán (đối soát cuối kỳ)'],
    ['Tác nhân', 'Khách hàng &middot; Thu ngân &middot; Quản lý (duyệt chốt ca) &middot; Quản trị (cấu hình tài khoản nhận, khoá webhook) &middot; Ngân hàng (hệ thống ngoài)'],
    ['Kích hoạt', 'Khách xin tính tiền tại quầy; hoặc khách tự quét mã QR trên bàn; hoặc khách trả trước tiền cọc trên web'],
    ['Đầu vào', '<code>sesis</code> của đơn ăn, hình thức trả, mã giảm giá và số điểm muốn dùng, số tiền khách đưa'],
    ['Đầu ra', 'Một hoặc nhiều dòng <code>payments</code> có <code>status = success</code>; đơn <code>hopdong.tinhtrang = 3</code>; bàn chuyển Đang dọn; điểm tích luỹ được cập nhật'],
    ['Sự kiện kết thúc', 'Đã thu đủ tiền (đóng đơn) &middot; Hoàn tiền &middot; Phiên quá hạn'],
    ['Sơ đồ liên quan', 'Hình 16 (tổng quan) &middot; Hình 17–18 (chi tiết) &middot; Hình 29 (sơ đồ tuần tự VietQR)'],
    ['Mã nguồn', '<code>routes/thanhToan.js</code> &middot; <code>services/thanhToanService.js</code> &middot; <code>services/vietQR.js</code> &middot; <code>services/chotCaService.js</code> &middot; <code>services/loyaltyService.js</code> &middot; <code>services/discountService.js</code>'],
    ['Hệ thống ngoài', 'Ngân hàng gọi vào <code>POST /api/webhook/ngan-hang</code> theo định dạng SePay; hệ thống không hỏi ngược lại ngân hàng'],
  ]) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-buoc', 'Các bước của QT-02, đánh số theo Hình 17 → 18',
    ['Bước', 'Lằn', 'Hoạt động', 'Quy tắc và dữ liệu', 'Mã nguồn'], BUOC_THANH_TOAN) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-ma', 'Quy tắc nghiệp vụ của QT-02',
    ['Mã', 'Quy tắc', 'Vì sao'], QUY_TAC_THANH_TOAN) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-ma', 'Ngoại lệ và luồng thay thế của QT-02',
    ['Trường hợp', 'Tình huống', 'Xử lý'], NGOAI_LE_THANH_TOAN) +
  `</div>
<div class="bang-hop">` +
  bangCot('bang-tt', 'Trạng thái của phiên thanh toán và của biến động số dư',
    ['Trạng thái', 'Thuộc bảng &middot; ý nghĩa', 'Chuyển được sang'], TRANG_THAI_THANH_TOAN) +
  `</div>

<div class="luu-y">
<p><b>Ba đường vào một cửa.</b> Webhook ngân hàng, nút "Xác nhận thủ công" của thu ngân
và thanh toán tiền mặt đều đi qua đúng một hàm <code>xacNhan()</code>, và mọi hiệu ứng
phụ — ghi nhật ký mã giảm giá, trừ điểm, cộng điểm, đóng đơn, trả bàn — đều nằm trong
<code>hauKyThanhToan()</code>. Nhờ vậy ba đường cho ra cùng một kết quả, và khi cần sửa
cách tính điểm thì chỉ có một chỗ để sửa.</p>
</div>` + `</section>`;

/* --- 7. So do lop --- */
h += mo(7) + `
<div class="van"><p>Hệ thống viết bằng JavaScript theo kiểu mô-đun: mỗi tệp trong
<code>services/</code> xuất ra một đối tượng hàm chứ không khai báo <code>class</code>. Hai sơ đồ
dưới đây vì vậy dùng khuôn mẫu <code>«module»</code> — tên hộp là tên tệp, ngăn giữa là dữ liệu
cấp mô-đun, ngăn dưới là các hàm được xuất ra. Vẽ như vậy giữ đúng cấu trúc mã nguồn thật
thay vì dựng lên một mô hình hướng đối tượng không tồn tại trong dự án.</p></div>` +
  hinh(21, 'Chú giải ký hiệu sơ đồ lớp, lược đồ CSDL, tuần tự và hoạt động', chuGiaiMoi(), null) +
  hinh(22, 'Sơ đồ lớp tầng dịch vụ nghiệp vụ', lop.tangDichVu(),
    'Ranh giới quan trọng nhất trên sơ đồ là giữa tầng định tuyến và tầng dịch vụ: toàn bộ câu lệnh SQL nằm ở tầng dịch vụ, tầng định tuyến chỉ nhận tham số và kiểm tra quyền. Nhờ vậy đổi một câu truy vấn hay đổi cả lược đồ bảng chỉ phải sửa trong <code>services/</code>.') +
  hinh(23, 'Sơ đồ lớp phân hệ học máy', lop.phanHeHocMay(),
    'Bốn mô-đun nghiệp vụ của tiến trình Python đều được <code>main.py</code> gọi trực tiếp và không gọi lẫn nhau. Hai tiến trình chỉ nói chuyện qua HTTP JSON, không dùng chung bộ nhớ, nên tắt tiến trình Python thì tầng web vẫn chạy.') +
  `</section>`;

/* --- 8. ERD --- */
h += mo(8) + `
<div class="van"><p>Cơ sở dữ liệu có hơn 60 bảng; vẽ hết vào một hình thì không còn đọc được
trên giấy A4. Ba lược đồ dưới đây tách theo phân hệ và chỉ giữ những bảng có quan hệ khoá
ngoại với nhau. Ký pháp chân quạ: đầu đơn là <b>một</b> bản ghi, đầu chia ba là <b>nhiều</b>
bản ghi; cột đánh dấu <code>PK</code> là khoá chính, <code>FK</code> là khoá ngoại.</p></div>` +
  hinh(24, 'Lược đồ quan hệ thực thể phân hệ bán hàng', erd.banHang(),
    'Điểm cần chú ý nhất: mỗi dòng <code>hopdong</code> là một MÓN chứ không phải một hoá đơn. Các dòng của cùng một lần đặt gộp lại bằng mã phiên <code>sesis</code> — nhờ vậy mỗi món giữ được trạng thái bếp riêng trong khi cả đơn vẫn có một trạng thái chung.') +
  hinh(25, 'Lược đồ quan hệ thực thể phân hệ kho và dự báo nguyên liệu', erd.kho(),
    'Chuỗi <code>cong_thuc</code> → <code>xuat_kho</code> → <code>du_bao_nguyen_lieu</code> là chuỗi dữ liệu quan trọng nhất của phần AI: nếu thiếu bảng công thức định lượng thì mỗi món bán ra không để lại dấu vết tiêu hao, và bài toán dự báo nguyên liệu sẽ không có gì để học.') +
  hinh(26, 'Lược đồ quan hệ thực thể phân hệ nhân sự và sinh trắc học', erd.nhanSu(),
    'Ba bảng bên phải lưu dữ liệu sinh trắc học và bằng chứng chấm công. Quan hệ tự tham chiếu <code>chuc_danh.id_cd_cha</code> chính là cây cơ cấu tổ chức sáu cấp bậc.') +
  hinh(27, 'Lược đồ quan hệ thực thể phân hệ giao hàng', erd.giaoHang(),
    'Hai bảng vị trí cố ý không gộp vì trả lời hai câu hỏi có yêu cầu trái ngược nhau: <code>vi_tri_shipper_moi_nhat</code> ghi đè nên đọc rất nhanh cho bản đồ, còn <code>vi_tri_shipper</code> thêm một dòng mỗi nhịp nên giữ được vết đường để đối chiếu khi khách khiếu nại.') +
  `</section>`;

/* --- 9. Tuan tu --- */
h += mo(9) + `
<div class="van"><p>Sơ đồ use case trả lời <i>ai làm được gì</i>, BPMN trả lời <i>công việc chạy
qua những ai</i>, còn bốn sơ đồ tuần tự dưới đây trả lời <i>phần mềm chạy như thế nào</i>: mô-đun
nào gọi hàm nào của mô-đun nào, theo đúng thứ tự thời gian. Tên thông điệp là tên hàm và
đường dẫn thật trong mã nguồn, đối chiếu được khi bảo vệ.</p></div>` +
  hinh(28, 'Sơ đồ tuần tự luồng khách quét mã QR gọi món', tuanTu.goiMonQR(),
    'Mã phiên <code>sesis</code> không nhận từ điện thoại khách mà luôn do máy chủ tra lại theo mã bàn. Nếu nhận từ client, người biết mã phiên của bàn khác có thể gọi món vào hoá đơn của bàn đó.') +
  hinh(29, 'Sơ đồ tuần tự luồng thanh toán VietQR và đối soát tự động', tuanTu.thanhToanVietQR(),
    'Hệ thống không hỏi ngân hàng mà chờ ngân hàng gọi vào. Webhook luôn được trả HTTP 200 khi giao dịch đã ghi được vào hộp thư, kể cả lúc không khớp phiên nào — trả mã khác 200 thì bên gửi sẽ bắn lại liên tục.') +
  hinh(30, 'Sơ đồ tuần tự luồng chạy dự báo lượt khách', tuanTu.duBaoLuotKhach(),
    'Nhánh thứ hai của khối <code>alt</code> là ràng buộc thiết kế quan trọng nhất của phân hệ AI: dịch vụ Python có thể tắt, nhưng trang web vẫn phải mở được và hiển thị kết quả dự báo đã lưu lần trước.') +
  hinh(31, 'Sơ đồ tuần tự luồng chấm công bằng khuôn mặt', tuanTu.chamCongKhuonMat(),
    'Vị trí được kiểm tra trước khuôn mặt. Người chấm công từ xa bị chặn trong một phần giây mà hệ thống chưa cần biết người đó là ai, và không tốn một lượt gọi dịch vụ nhận diện.') +
  `</section>`;

/* --- 10. Hoat dong --- */
h += mo(10) + `
<div class="van"><p>Ba quy trình dưới đây không trùng với bốn sơ đồ BPMN ở &sect;6. Sơ đồ hoạt
động đi sâu hơn một mức so với BPMN: nó vẽ cả nhánh lỗi, nhánh quay lui giao dịch và điểm
tách luồng song song <i>bên trong</i> một chức năng — những thứ mà sơ đồ quy trình mức tổng
quan cố ý không thể hiện.</p></div>` +
  hinh(32, 'Sơ đồ hoạt động quy trình đặt bàn trực tuyến và đặt cọc', hoatDong.datBan(),
    'Nhánh “ngày ở quá khứ” được kiểm tra ở phía máy chủ chứ không chỉ ở trình duyệt: thuộc tính <code>min</code> của ô ngày chỉ ngăn thao tác nhầm, còn người gửi thẳng yêu cầu HTTP vẫn bỏ qua được.') +
  hinh(33, 'Sơ đồ hoạt động quy trình nhập kho theo lô và trừ kho tự động', hoatDong.nhapKho(),
    'Thời điểm trừ kho đặt ở bước bếp <i>hoàn thành</i> món, không phải lúc khách gọi món hay lúc thanh toán: đơn có thể bị huỷ sau khi gọi, còn nguyên liệu thì đã thực sự tiêu hao ngay khi bếp nấu xong.') +
  hinh(34, 'Sơ đồ hoạt động đường đi của một câu hỏi qua trợ lý ảo', hoatDong.troLyAo(),
    'Tầng ④ là lớp bảo vệ quan trọng nhất: mô hình chỉ chọn <i>mẫu</i> câu truy vấn rồi điền tham số đã kiểm tra kiểu, chứ không sinh chuỗi SQL tự do.') +
  `</section>`;

/* --- 11. Anh xa --- */
h += mo(11) + `
<div class="van"><p>Bảng đối chiếu để tìm nhanh phần mã tương ứng với từng nhóm chức
năng trên sơ đồ.</p></div>
<div class="bang-hop"><table>
<thead><tr><th>Nhóm chức năng</th><th>Vị trí trong mã nguồn</th></tr></thead>
<tbody>` +
  ANH_XA.map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join('') +
  `</tbody></table></div>

<div class="luu-y">
<p><b>Về dữ liệu trong hệ thống.</b> Dữ liệu lịch sử 368 ngày dùng để huấn luyện là
<b>dữ liệu mô phỏng</b>, sinh bằng bộ sinh có seed cố định và được đánh dấu bằng cột
<code>hopdong.la_du_lieu_mo_phong</code>. Các sơ đồ trên mô tả đúng luồng xử lý của hệ
thống; còn kết quả dự báo và các luật kết hợp tìm được chỉ chứng minh <i>thuật toán
chạy đúng</i>, chưa phải quy luật tiêu dùng thật.</p>
</div>` + `</section>`;

h += `<footer>Sơ đồ dựng từ mã nguồn hệ thống quản lý nhà hàng — Node/Express, EJS,
MySQL, Socket.IO và dịch vụ Python/FastAPI cho phần học máy.</footer>`;
h += `</div>`;

const dich = path.join(__dirname, 'so-do-he-thong.html');
fs.writeFileSync(dich, h, 'utf8');
console.log('Da ghi', dich, '-', (h.length / 1024).toFixed(1), 'KB');

// Xuat tung hinh thanh file SVG doc lap de chen vao bao cao Word / LaTeX.
const thuMucSvg = path.join(__dirname, 'svg');
fs.mkdirSync(thuMucSvg, { recursive: true });
const muc = [];
for (const { so, tieuDe, svg } of DANH_SACH_HINH) {
  const ten = 'hinh-' + String(so).padStart(2, '0') + '.svg';
  fs.writeFileSync(path.join(thuMucSvg, ten), v.fileSvg(svg), 'utf8');
  muc.push('| Hình ' + so + ' | ' + tieuDe + ' | `svg/' + ten + '` |');
}
fs.writeFileSync(path.join(__dirname, 'muc-hinh.md'),
  '| Hình | Nội dung | Tệp |\n|---|---|---|\n' + muc.join('\n') + '\n', 'utf8');
console.log('Da xuat', DANH_SACH_HINH.length, 'file SVG roi vao', thuMucSvg);

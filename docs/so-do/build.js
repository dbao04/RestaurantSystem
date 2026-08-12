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
  s += v.suKien(220, 46, 'Trung gian', 'giua');
  s += v.suKien(380, 46, 'Kết thúc', 'cuoi');
  s += v.viec(560, 46, 'Công việc của người');
  s += v.viec(760, 46, 'Bước hệ thống tự chạy', 'tu-dong');
  s += v.cong(940, 46, 'Rẽ nhánh loại trừ');
  s += v.luong([[1010, 46], [1120, 46]], 'cg2');
  s += `<text class="tx-sk" x="1065" y="72">luồng trình tự</text>`;
  return v.khung('cg2', 1160, 100, 'Chú giải ký hiệu sơ đồ BPMN', s);
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
  uc.ucThanhToan(), uc.ucNhanSu(), uc.ucPhanTich()];
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
  <p class="phu-de">Bảy sơ đồ ca sử dụng và bốn sơ đồ quy trình nghiệp vụ, dựng trực tiếp
  từ mã nguồn đang chạy: <b>Node/Express + EJS + MySQL</b> cho phần nghiệp vụ và
  <b>Python/FastAPI</b> tách riêng cho phần học máy.</p>
  <div class="mo-ta-du-an">
    <span>Tác nhân: <b>8 người dùng + 2 hệ thống ngoài</b></span>
    <span>Ca sử dụng: <b>${SO_CA_DAY_DU}</b></span>
    <span>Quy trình: <b>4</b></span>
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
<div class="van"><p>Bốn quy trình dưới đây là những luồng đi qua nhiều vai trò nhất, nên
cũng là nơi dễ đứt gãy nhất khi vận hành. Mỗi sơ đồ là một pool chia thành bốn lằn;
lằn cuối luôn là phần hệ thống tự chạy, để phân biệt rõ việc người làm với việc máy làm.</p></div>` +
  hinh(9, 'Chú giải ký hiệu BPMN', chuGiaiBpmn(), null) +
  hinh(10, 'Quy trình phục vụ và chế biến tại bàn', bpmn.phucVu(),
    'Vòng lặp gọi thêm món trong cùng một bữa lặp lại từ bước quét mã QR và không vẽ lại để giữ sơ đồ đọc được. Bước trừ tồn kho nằm trong cùng giao dịch với bước hoàn thành chế biến: hoặc cả hai cùng thành công, hoặc cả hai cùng quay lui.') +
  hinh(11, 'Quy trình thanh toán và đối soát ngân hàng', bpmn.thanhToan(),
    'Điểm đáng chú ý là sự kiện trung gian ở lằn ngân hàng: hệ thống không hỏi ngân hàng mà chờ ngân hàng gọi vào, nên phiên thanh toán chuyển trạng thái ngay trên cả điện thoại khách lẫn màn hình thu ngân trong cùng một khoảnh khắc.') +
  hinh(12, 'Quy trình dự báo bằng học máy', bpmn.duBao(),
    'Rẽ nhánh đầu tiên là ràng buộc thiết kế quan trọng nhất của phân hệ AI: dịch vụ Python không được phép làm sập web. Khi nó không trả lời, trang vẫn hiển thị dự báo đã lưu lần chạy trước. Bốn mô hình được chấm điểm gồm SeasonalNaive (baseline), Ridge, RandomForest và GradientBoosting; mô hình có MAE thấp nhất trên 60 ngày cuối được chọn rồi huấn luyện lại trên toàn bộ dữ liệu.') +
  hinh(13, 'Quy trình chấm công bằng khuôn mặt và GPS', bpmn.chamCong(),
    'Thứ tự hai kiểm tra là có chủ đích: kiểm tra vị trí đặt trước kiểm tra khuôn mặt. Người chấm công từ xa bị chặn trong một phần giây thay vì phải đợi hết lượt nhận diện, và câu trả lời "bạn đang ở cách nhà hàng 4 km" không cần biết người đó là ai.') +
  `</section>`;

/* --- 7. So do lop --- */
h += mo(6) + `
<div class="van"><p>Hệ thống viết bằng JavaScript theo kiểu mô-đun: mỗi tệp trong
<code>services/</code> xuất ra một đối tượng hàm chứ không khai báo <code>class</code>. Hai sơ đồ
dưới đây vì vậy dùng khuôn mẫu <code>«module»</code> — tên hộp là tên tệp, ngăn giữa là dữ liệu
cấp mô-đun, ngăn dưới là các hàm được xuất ra. Vẽ như vậy giữ đúng cấu trúc mã nguồn thật
thay vì dựng lên một mô hình hướng đối tượng không tồn tại trong dự án.</p></div>` +
  hinh(14, 'Chú giải ký hiệu sơ đồ lớp, lược đồ CSDL, tuần tự và hoạt động', chuGiaiMoi(), null) +
  hinh(15, 'Sơ đồ lớp tầng dịch vụ nghiệp vụ', lop.tangDichVu(),
    'Ranh giới quan trọng nhất trên sơ đồ là giữa tầng định tuyến và tầng dịch vụ: toàn bộ câu lệnh SQL nằm ở tầng dịch vụ, tầng định tuyến chỉ nhận tham số và kiểm tra quyền. Nhờ vậy đổi một câu truy vấn hay đổi cả lược đồ bảng chỉ phải sửa trong <code>services/</code>.') +
  hinh(16, 'Sơ đồ lớp phân hệ học máy', lop.phanHeHocMay(),
    'Bốn mô-đun nghiệp vụ của tiến trình Python đều được <code>main.py</code> gọi trực tiếp và không gọi lẫn nhau. Hai tiến trình chỉ nói chuyện qua HTTP JSON, không dùng chung bộ nhớ, nên tắt tiến trình Python thì tầng web vẫn chạy.') +
  `</section>`;

/* --- 8. ERD --- */
h += mo(7) + `
<div class="van"><p>Cơ sở dữ liệu có hơn 60 bảng; vẽ hết vào một hình thì không còn đọc được
trên giấy A4. Ba lược đồ dưới đây tách theo phân hệ và chỉ giữ những bảng có quan hệ khoá
ngoại với nhau. Ký pháp chân quạ: đầu đơn là <b>một</b> bản ghi, đầu chia ba là <b>nhiều</b>
bản ghi; cột đánh dấu <code>PK</code> là khoá chính, <code>FK</code> là khoá ngoại.</p></div>` +
  hinh(17, 'Lược đồ quan hệ thực thể phân hệ bán hàng', erd.banHang(),
    'Điểm cần chú ý nhất: mỗi dòng <code>hopdong</code> là một MÓN chứ không phải một hoá đơn. Các dòng của cùng một lần đặt gộp lại bằng mã phiên <code>sesis</code> — nhờ vậy mỗi món giữ được trạng thái bếp riêng trong khi cả đơn vẫn có một trạng thái chung.') +
  hinh(18, 'Lược đồ quan hệ thực thể phân hệ kho và dự báo nguyên liệu', erd.kho(),
    'Chuỗi <code>cong_thuc</code> → <code>xuat_kho</code> → <code>du_bao_nguyen_lieu</code> là chuỗi dữ liệu quan trọng nhất của phần AI: nếu thiếu bảng công thức định lượng thì mỗi món bán ra không để lại dấu vết tiêu hao, và bài toán dự báo nguyên liệu sẽ không có gì để học.') +
  hinh(19, 'Lược đồ quan hệ thực thể phân hệ nhân sự và sinh trắc học', erd.nhanSu(),
    'Ba bảng bên phải lưu dữ liệu sinh trắc học và bằng chứng chấm công. Quan hệ tự tham chiếu <code>chuc_danh.id_cd_cha</code> chính là cây cơ cấu tổ chức sáu cấp bậc.') +
  `</section>`;

/* --- 9. Tuan tu --- */
h += mo(8) + `
<div class="van"><p>Sơ đồ use case trả lời <i>ai làm được gì</i>, BPMN trả lời <i>công việc chạy
qua những ai</i>, còn bốn sơ đồ tuần tự dưới đây trả lời <i>phần mềm chạy như thế nào</i>: mô-đun
nào gọi hàm nào của mô-đun nào, theo đúng thứ tự thời gian. Tên thông điệp là tên hàm và
đường dẫn thật trong mã nguồn, đối chiếu được khi bảo vệ.</p></div>` +
  hinh(20, 'Sơ đồ tuần tự luồng khách quét mã QR gọi món', tuanTu.goiMonQR(),
    'Mã phiên <code>sesis</code> không nhận từ điện thoại khách mà luôn do máy chủ tra lại theo mã bàn. Nếu nhận từ client, người biết mã phiên của bàn khác có thể gọi món vào hoá đơn của bàn đó.') +
  hinh(21, 'Sơ đồ tuần tự luồng thanh toán VietQR và đối soát tự động', tuanTu.thanhToanVietQR(),
    'Hệ thống không hỏi ngân hàng mà chờ ngân hàng gọi vào. Webhook luôn được trả HTTP 200 khi giao dịch đã ghi được vào hộp thư, kể cả lúc không khớp phiên nào — trả mã khác 200 thì bên gửi sẽ bắn lại liên tục.') +
  hinh(22, 'Sơ đồ tuần tự luồng chạy dự báo lượt khách', tuanTu.duBaoLuotKhach(),
    'Nhánh thứ hai của khối <code>alt</code> là ràng buộc thiết kế quan trọng nhất của phân hệ AI: dịch vụ Python có thể tắt, nhưng trang web vẫn phải mở được và hiển thị kết quả dự báo đã lưu lần trước.') +
  hinh(23, 'Sơ đồ tuần tự luồng chấm công bằng khuôn mặt', tuanTu.chamCongKhuonMat(),
    'Vị trí được kiểm tra trước khuôn mặt. Người chấm công từ xa bị chặn trong một phần giây mà hệ thống chưa cần biết người đó là ai, và không tốn một lượt gọi dịch vụ nhận diện.') +
  `</section>`;

/* --- 10. Hoat dong --- */
h += mo(9) + `
<div class="van"><p>Ba quy trình dưới đây không trùng với bốn sơ đồ BPMN ở &sect;6. Sơ đồ hoạt
động đi sâu hơn một mức so với BPMN: nó vẽ cả nhánh lỗi, nhánh quay lui giao dịch và điểm
tách luồng song song <i>bên trong</i> một chức năng — những thứ mà sơ đồ quy trình mức tổng
quan cố ý không thể hiện.</p></div>` +
  hinh(24, 'Sơ đồ hoạt động quy trình đặt bàn trực tuyến và đặt cọc', hoatDong.datBan(),
    'Nhánh “ngày ở quá khứ” được kiểm tra ở phía máy chủ chứ không chỉ ở trình duyệt: thuộc tính <code>min</code> của ô ngày chỉ ngăn thao tác nhầm, còn người gửi thẳng yêu cầu HTTP vẫn bỏ qua được.') +
  hinh(25, 'Sơ đồ hoạt động quy trình nhập kho theo lô và trừ kho tự động', hoatDong.nhapKho(),
    'Thời điểm trừ kho đặt ở bước bếp <i>hoàn thành</i> món, không phải lúc khách gọi món hay lúc thanh toán: đơn có thể bị huỷ sau khi gọi, còn nguyên liệu thì đã thực sự tiêu hao ngay khi bếp nấu xong.') +
  hinh(26, 'Sơ đồ hoạt động đường đi của một câu hỏi qua trợ lý ảo', hoatDong.troLyAo(),
    'Tầng ④ là lớp bảo vệ quan trọng nhất: mô hình chỉ chọn <i>mẫu</i> câu truy vấn rồi điền tham số đã kiểm tra kiểu, chứ không sinh chuỗi SQL tự do.') +
  `</section>`;

/* --- 11. Anh xa --- */
h += mo(10) + `
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

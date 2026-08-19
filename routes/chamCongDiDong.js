/**
 * Cham cong bang DIEN THOAI.
 *
 *   GET  /cham-cong                      chuyen huong ve /cham-cong/
 *   GET  /cham-cong/                     trang cham cong ca nhan, giao dien dien thoai
 *   GET  /cham-cong/manifest.webmanifest khai bao de "Them vao man hinh chinh"
 *   GET  /cham-cong/sw.js                service worker (chi de cai duoc, KHONG luu dem)
 *   GET  /cham-cong/bieu-tuong.svg       bieu tuong ung dung
 *   GET  /api/cham-cong/cua-toi          trang thai cham cong hom nay cua chinh minh
 *
 * ============================================================================
 * VI SAO CAN MOT TRANG RIENG, KHONG DUNG LAI /staff/attendance
 * ============================================================================
 *
 * /staff/attendance nam trong bo khung quan tri (sidebar + topbar + luoi
 * Bootstrap 12 cot). Tren man hinh dien thoai bo khung do an het chieu cao, con
 * khung camera bi ep trong mot cot rong 340px ti le 4/3. Khuon mat nguoi cao hon
 * rong, nen o khung ngang mat chi chiem chung 1/4 chieu cao anh - sau khi Python
 * cat va can chinh ve 112x112 thi anh nhoe, do net tut, va kiem tra anh song
 * bao truot. Nguoi dung thay "chua dat thu thach" mai ma khong hieu vi sao,
 * trong khi nguyen nhan that la khung hinh qua nho.
 *
 * Trang nay bo toan bo bo khung, dung khung DOC (3/4) chiem het be ngang man
 * hinh, va chi lam dung mot viec: cham cong. Do la ly do no ngan hon trang
 * quan tri du lam nhieu viec hon ve mat giao dien.
 *
 * Ba dieu chi dien thoai moi co, deu duoc xu ly o day:
 *   1. Trang PHAI la secure context. Mo bang http://<ip-lan>:3000 thi camera va
 *      GPS deu khong ton tai. Thay vi de nguoi dung bam nut roi nhan mot loi
 *      kho hieu, trang tu phat hien va dua thang duong dan https bam duoc.
 *   2. Nhan vien vao bang duong dan gian - dat o /cham-cong chu khong phai
 *      /staff/... de con go tay duoc, va co ma QR o trang may tinh de quet.
 *   3. Cai duoc ra man hinh chinh (PWA): mo o che do toan man hinh, khong con
 *      thanh dia chi, camera duoc them ~100px chieu cao.
 *
 * ============================================================================
 * KHONG CO DUONG TAT NAO O DAY
 * ============================================================================
 * Trang nay KHONG tu ghi vao bang cham_cong. No goi dung mot API voi kiosk va
 * trang quan tri: POST /api/khuon-mat/cham-cong che_do='ca_nhan'. Nghia la moi
 * rang buoc chong gian lan (anh song, thu thach ngau nhien, doi chieu GPS,
 * nguong khop) van y nguyen. Cham cong bang dien thoai khong duoc de tro thanh
 * cua sau de cham ho hay cham tu nha - do la rui ro lon nhat cua viec cho phep
 * cham cong bang thiet bi ca nhan.
 */
const express = require('express');
const cc = require('../services/chamCongService');
const face = require('../services/faceService');
const diaChiQR = require('../utils/diaChiQR');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Trang nay chi danh cho NHAN VIEN, khong danh cho tai khoan quan tri (tb_admin).
 *
 * Quan tri khong co ban ghi trong `nhan_vien` nen khong co gi de cham; cho vao
 * chi de nhan mot trang trong. Chuyen ho ve trang quan ly cham cong thi dung
 * viec hon.
 */
function canNhanVien(req, res, next) {
  if (req.session && req.session.stafflogin && req.session.staffId) return next();
  // Duong dan /api/ luon tra JSON, khong xet header `accept`: `fetch()` mac dinh
  // gui `accept: */*`, nen neu chi nhin header thi loi het phien se tra ve nguyen
  // trang dang nhap dang HTML va cho goi nhan duoc "Unexpected token <".
  if (req.path.startsWith('/api/') || req.xhr) {
    return res.status(401).json({ ok: false, thong_bao: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.' });
  }
  if (req.session && req.session.adminlogin) return res.redirect('/to-chuc/cham-cong');
  // Giu lai duong dan dang xem: quet ma QR xong ma bi da ve trang chu thi nhan
  // vien phai tu mo lai menu tren dien thoai - buoc thua duy nhat de mat nguoi
  // ta o day.
  return res.redirect('/staff/login?tiep=' + encodeURIComponent(req.originalUrl));
}

/**
 * Trang co dang chay trong "secure context" khong.
 *
 * Phai doc ca `x-forwarded-proto`: qua tunnel Cloudflare thi ket noi toi Node la
 * http thuong (`req.secure` = false) trong khi dien thoai dang o https that va
 * camera chay binh thuong. Chi nhin `req.secure` se bao nham la khong dung duoc.
 *
 * Day chi la de HIEN THI dung canh bao. Quyet dinh cuoi cung van o trinh duyet:
 * `CamCC.moCamera()` tu kiem tra lai truoc khi goi getUserMedia.
 */
function laAnToan(req) {
  if (req.secure) return true;
  const giaoThuc = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0].trim().toLowerCase();
  if (giaoThuc === 'https') return true;
  const may = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return LOOPBACK.has(may.toLowerCase());
}

// ===========================================================================
// TRANG
// ===========================================================================

/**
 * Mot dia chi duy nhat, co dau '/' o cuoi.
 *
 * Khong phai thoi quen ma la rang buoc cua PWA: pham vi cua service worker
 * /cham-cong/sw.js la /cham-cong/, va Chrome chi cho cai khi start_url nam
 * trong pham vi do. De hai dia chi song song thi nguoi mo tu /cham-cong se co
 * mot ban khong bao gio duoc cai.
 *
 * Mot route lo ca hai duong dan, khong phai hai: Express chay o che do khong
 * phan biet dau '/' cuoi, nen '/cham-cong' va '/cham-cong/' cung khop mot mau.
 * Viet thanh hai route rieng thi route dang ky truoc nuot ca hai - neu do la
 * route chuyen huong thi /cham-cong/ tu tro ve chinh no, vong lap vo tan.
 */
router.get('/cham-cong', (req, res, next) => {
  if (!req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(302, '/cham-cong/');
  next();
}, canNhanVien, bat(async (req, res) => {
  const idNv = req.session.staffId;
  const [trangThai, soMau, homNay, ganDay, viTri] = await Promise.all([
    face.trangThaiDichVu(),
    face.soMauCua(idNv),
    cc.banGhiHomNay(idNv),
    cc.lichSuGanDay(idNv, 7),
    face.cauHinhViTri(),
  ]);

  res.render('staff/cham-cong-dien-thoai', {
    layout: false,
    title: 'Chấm công',
    hoTen: req.session.staffName || 'Nhân viên',
    tenChucDanh: (req.hoSo && req.hoSo.ten_cd) || '',
    trangThai, soMau, homNay, ganDay, viTri,
    anToan: laAnToan(req),
    diaChiAnToan: diaChiQR.diaChiDienThoai(req),
  });
}));

// ===========================================================================
// API
// ===========================================================================

/**
 * Trang thai cham cong hom nay cua CHINH MINH.
 *
 * Khong nhan id_nv: danh tinh lay tu phien dang nhap. Nho vay endpoint nay
 * khong the dung de doc gio cong cua nguoi khac - viec do thuoc ve man hinh
 * quan ly (/api/cham-cong/ngay, chi cap 1 moi goi duoc).
 */
router.get('/api/cham-cong/cua-toi', canNhanVien, bat(async (req, res) => {
  const idNv = req.session.staffId;
  const [homNay, ganDay, soMau] = await Promise.all([
    cc.banGhiHomNay(idNv),
    cc.lichSuGanDay(idNv, 7),
    face.soMauCua(idNv),
  ]);
  res.json({
    ok: true,
    hom_nay: homNay,
    gan_day: ganDay,
    so_mau: soMau,
    // Chieu se cham lan toi, tinh o may chu de man hinh va CSDL khong bao gio
    // noi hai dieu khac nhau khi nguoi dung mo trang tu bo nho dem.
    chieu_ke_tiep: !homNay || !homNay.gio_vao ? 'vao' : (!homNay.gio_ra ? 'ra' : 'vao'),
  });
}));

// ===========================================================================
// PWA - de cai ra man hinh chinh
// ===========================================================================

/**
 * Bieu tuong ung dung.
 *
 * Ve bang SVG chu khong dung tep PNG vi hai le: khong phai them tep nhi phan
 * vao kho ma, va mot tep duy nhat phuc vu duoc moi kich thuoc (192, 512,
 * maskable). Danh doi: iOS khong doc SVG cho apple-touch-icon nen khi "Them vao
 * man hinh chinh" tren iPhone, bieu tuong se la anh chup trang - chap nhan
 * duoc, vi trang van chay dung.
 */
const BIEU_TUONG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2c1810"/>
  <circle cx="256" cy="272" r="150" fill="none" stroke="#c8a951" stroke-width="26"/>
  <path d="M256 180v96l68 42" fill="none" stroke="#c8a951" stroke-width="26"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M196 108a72 72 0 0 1 120 0" fill="none" stroke="#c8a951" stroke-width="22"
        stroke-linecap="round"/>
</svg>`;

/**
 * CUA THOAT - go service worker khi no tu giam nguoi dung.
 *
 * VI SAO KHONG DAT TRONG /cham-cong/
 * ----------------------------------
 * Vi chinh service worker cua /cham-cong/ la thu can go. Pham vi cua no la
 * /cham-cong/ - moi lan chuyen trang trong do deu bi no bat truoc. Neu trang
 * sua loi cung nam trong pham vi ay thi no cung bi chan y het, va nguoi dung
 * khong con duong nao.
 *
 * Duong dan ngan va nam NGOAI pham vi do, nen dien thoai mo no la mot lan
 * chuyen trang binh thuong: trinh duyet di thang ra mang, va neu chung chi co
 * van de thi day la luc man hinh "Ket noi khong an toan" hien ra - dung thu
 * nguoi dung can thay de bam "Nang cao -> Tiep tuc truy cap".
 *
 * KHONG doi dang nhap: nguoi dung dang ket o ngoai cua, chua vao duoc thi lay
 * dau ra phien dang nhap.
 */
const TRANG_SUA = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sửa lỗi chấm công</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
padding:22px;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#2c1810,#4e342e);
color:#fff;text-align:center}
.hop{max-width:420px;width:100%}
h1{font-size:20px;margin:0 0 8px}
p{opacity:.85;font-size:14.5px;line-height:1.6;margin:0 0 18px}
#tt{background:rgba(0,0,0,.25);border-radius:12px;padding:14px;text-align:left;font-size:13.5px;
line-height:1.9;margin-bottom:16px}
.ok{color:#7fd88f}.dang{color:#c8a951}
a.nut{display:block;background:#c8a951;color:#2c1810;text-decoration:none;font-weight:700;
font-size:15px;padding:14px;border-radius:12px;margin-top:8px}
small{display:block;opacity:.55;font-size:12.5px;margin-top:16px;line-height:1.6}</style>
</head><body><div class="hop">
<h1>Đang dọn lại ứng dụng chấm công</h1>
<p>Trang này gỡ bản lưu cũ trên điện thoại của bạn. Chỉ mất vài giây.</p>
<div id="tt">Đang bắt đầu…</div>
<a class="nut" id="tiep" href="/cham-cong/">Mở lại trang chấm công</a>
<small>Nếu vừa rồi máy hỏi “Kết nối không an toàn”, đó là chứng chỉ tự ký của
máy chủ nhà hàng — bấm <b>Nâng cao</b> rồi <b>Tiếp tục truy cập</b> là đúng.</small>
</div>
<script>
var tt = document.getElementById('tt');
var dong = [];
function ghi(s, xong) {
  dong.push((xong ? '<span class="ok">\u2713</span> ' : '<span class="dang">\u2026</span> ') + s);
  tt.innerHTML = dong.join('<br>');
}
(function () {
  if (!navigator.serviceWorker) { ghi('Trình duyệt không dùng service worker — không cần dọn', true); return; }
  ghi('Tìm bản lưu cũ');
  navigator.serviceWorker.getRegistrations().then(function (ds) {
    ghi('Tìm thấy ' + ds.length + ' bản đã cài', true);
    return Promise.all(ds.map(function (r) { return r.unregister(); }));
  }).then(function () {
    ghi('Đã gỡ service worker', true);
    return (self.caches && caches.keys) ? caches.keys() : [];
  }).then(function (ks) {
    return Promise.all((ks || []).map(function (k) { return caches.delete(k); }));
  }).then(function () {
    ghi('Đã xoá bộ nhớ đệm', true);
    ghi('Xong — bấm nút bên dưới', true);
  }).catch(function (e) {
    ghi('Không dọn được: ' + (e && e.message ? e.message : e), true);
  });
})();
</script></body></html>`;

/*
 * Dat o CA HAI duong dan: /sua de go tren dien thoai cho nhanh, va
 * /sua-cham-cong de con doc duoc y nghia khi thay trong ma nguon hay nhat ky.
 */
/**
 * CUA VAO CUA MA QR - co y nam NGOAI pham vi service worker.
 *
 * VI SAO KHONG DE MA QR TRO THANG VAO /cham-cong/
 * -----------------------------------------------
 * Pham vi cua service worker la /cham-cong/. No bat MOI lan chuyen trang trong
 * do - ke ca lan dau tien tu ma QR. Neu luc ay ket noi that bai vi chung chi
 * chua duoc chap nhan, worker tra ve trang "mat ket noi" cua no, va trinh duyet
 * KHONG BAO GIO kip hien man hinh "Ket noi khong an toan" co nut di tiep.
 *
 * Nguoi dung roi vao mot vong khep kin: muon chap nhan chung chi thi phai tai
 * duoc trang, ma tai trang thi bi chinh worker chan. Quet lai ma QR bao nhieu
 * lan cung ra dung mot ket qua.
 *
 * Duong dan nay nam ngoai pham vi do, nen quet ma QR la mot lan chuyen trang
 * BINH THUONG: di thang ra mang, va neu chung chi co van de thi day la luc man
 * hinh canh bao hien ra - dung thu nguoi dung can thay. Bam chap nhan xong,
 * chuyen huong tiep vao /cham-cong/ luc nay da chay duoc, va worker moi tu cai.
 *
 * Ten ngan ('cc') de con doc duoc khi in ra giay dan canh may cham cong.
 */
router.get(['/cc', '/cham-cong-dien-thoai'], (req, res) => {
  // 302 chu khong phai 301: 301 bi trinh duyet nho vinh vien, doi duong dan sau
  // nay se khong con go bo duoc tren nhung may da tung vao.
  res.redirect(302, '/cham-cong/');
});

router.get(['/sua', '/sua-cham-cong'], (req, res) => {
  res.type('html')
    // Tuyet doi khong de trinh duyet luu trang nay: no ton tai de sua mot van de
    // ve bo nho dem, luu no lai la tu chuoc them mot van de cung loai.
    .set('Cache-Control', 'no-store')
    .send(TRANG_SUA);
});

router.get('/cham-cong/bieu-tuong.svg', (req, res) => {
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(BIEU_TUONG);
});

router.get('/cham-cong/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json').json({
    name: 'Chấm công - Nhà Hàng Bảo Đoàn',
    short_name: 'Chấm công',
    description: 'Chấm công bằng khuôn mặt trên điện thoại',
    start_url: '/cham-cong/',
    scope: '/cham-cong/',
    // 'standalone' chu khong phai 'fullscreen': van giu thanh trang thai de
    // nhan vien nhin duoc gio va vach song - hai thu ho can dung luc cham cong.
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#2c1810',
    theme_color: '#2c1810',
    lang: 'vi',
    icons: [
      { src: '/cham-cong/bieu-tuong.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/cham-cong/bieu-tuong.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/cham-cong/bieu-tuong.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  });
});

/**
 * Service worker - CO Y KHONG LUU DEM GI CA.
 *
 * Chrome chi cho "cai" mot trang web khi no co service worker xu ly su kien
 * fetch. Nhung voi mot trang cham cong thi bo nho dem la thu nguy hiem nhat:
 * nhan vien mo ban cu trong dem se thay "chua cham cong" trong khi da cham roi,
 * hoac nguoc lai. Nen worker nay chi lam dung mot viec - di thang ra mang - va
 * chi khi mat mang moi tra ve mot trang bao mat mang thay cho man hinh loi
 * trong tron cua trinh duyet.
 */
/*
 * Trang bao loi khi khong goi duoc may chu.
 *
 * NUT BAM PHAI TRO RA NGOAI PHAM VI SERVICE WORKER (/cham-cong/). Day khong
 * phai chi tiet lam dep - no la ca cach thoat.
 *
 * Service worker nay chan moi lan dieu huong trong pham vi cua no. Khi chung
 * chi tu ky vua duoc cap lai, dien thoai chua chap nhan ban moi thi `fetch`
 * hong ngay o tang TLS, worker bat loi va tra ve chinh trang nay. Nghia la
 * CANH BAO BAO MAT CUA TRINH DUYET KHONG BAO GIO HIEN RA, va nguoi dung khong
 * co cho nao de bam "Tiep tuc truy cap" - bam "Thu lai" chi quay ve dung trang
 * bao loi nay, vong lap kin khong loi ra.
 *
 * `/staff/login` nam ngoai pham vi worker nen trinh duyet tu di ra mang, canh
 * bao chung chi hien len that, chap nhan xong thi tham so `tiep` dua nguoi
 * dung tro lai /cham-cong/.
 */
const OFFLINE = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Mất kết nối</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
text-align:center;padding:22px;font-family:system-ui,sans-serif;
background:linear-gradient(135deg,#2c1810,#4e342e);color:#fff}
.hop{max-width:430px}
h1{font-size:20px;margin:0 0 10px}
p{opacity:.85;font-size:14.5px;line-height:1.6;margin:0 0 16px}
a.nut,button.nut{display:block;width:100%;box-sizing:border-box;background:#c8a951;color:#2c1810;
text-decoration:none;font-weight:700;font-size:15px;padding:13px 18px;border:0;border-radius:12px;
margin:9px 0;cursor:pointer;font-family:inherit}
a.phu{background:transparent;color:#c8a951;border:1px solid rgba(200,169,81,.5)}
.khung{background:rgba(0,0,0,.22);border-radius:12px;padding:13px 15px;margin:16px 0;text-align:left}
.khung b{color:#c8a951;display:block;margin-bottom:5px;font-size:14px}
.khung p{font-size:13.5px;margin:0;opacity:.8}
small{display:block;opacity:.55;font-size:12.5px;margin-top:14px;line-height:1.55}</style></head><body>
<div class="hop">
<h1>Không mở được trang</h1>
<p>Điện thoại mất mạng, hoặc máy chủ nhà hàng chưa bật — nhưng cũng có thể là
<b>chứng chỉ bảo mật vừa đổi</b>.</p>

<div class="khung">
<b>Nếu máy chủ đang bật</b>
<p>Máy chủ cấp chứng chỉ mới mỗi khi địa chỉ mạng đổi. Điện thoại chưa chấp nhận
chứng chỉ mới thì trang này hiện lên thay vì hỏi bạn — vì vậy phải chấp nhận
chứng chỉ ở một trang khác trước.</p>
</div>

<a class="nut" href="/sua">Dọn lại và chấp nhận chứng chỉ</a>
<p style="font-size:13px;opacity:.7;margin:-2px 0 14px">
Bấm <b>Nâng cao</b> → <b>Tiếp tục truy cập</b>, rồi quay lại đây.</p>

<button class="nut phu" id="nut-dat-lai" type="button">Xoá bộ nhớ đệm và tải lại</button>
<a class="nut phu" href="/cham-cong/">Thử lại</a>

<small>Nếu vẫn không được: kiểm tra điện thoại đã <b>tắt 4G</b> và nối
<b>cùng Wi-Fi</b> với máy tính chạy máy chủ.</small>
</div>
<script>
/*
  Go service worker roi tai lai.

  Can nut nay vi chinh service worker la thu dang giam nguoi dung o day: no bat
  moi lan chuyen trang trong pham vi cua no, va khi fetch that bai - ke ca that
  bai vi CHUNG CHI chu khong phai vi mat mang - no tra ve trang nay. Nguoi dung
  khong bao gio thay duoc man hinh "Ket noi khong an toan" de bam chap nhan.

  Go dang ky xong thi lan chuyen trang sau di thang ra mang, va trinh duyet moi
  hien canh bao chung chi that.
*/
document.getElementById('nut-dat-lai').onclick = function () {
  var nut = this;
  nut.textContent = 'Đang xoá...';
  var xong = function () { location.replace('/cham-cong/' + '?tuoi=' + Date.now()); };
  if (!navigator.serviceWorker) return xong();
  navigator.serviceWorker.getRegistrations()
    .then(function (ds) { return Promise.all(ds.map(function (r) { return r.unregister(); })); })
    .then(function () { return caches && caches.keys ? caches.keys() : []; })
    .then(function (ks) { return Promise.all((ks || []).map(function (k) { return caches.delete(k); })); })
    .then(xong)
    .catch(xong);
};

/*
  TU THU LAI - de mot lan khoi dong lai may chu khong ket nguoi dung o day.

  Truoc day trang nay dung im: may chu bat lai roi ma dien thoai van hien "khong
  ket noi duoc", cho toi khi nguoi dung tu bam. Ma khoi dong lai may chu la viec
  binh thuong - chi mat khoang muoi lam giay - nen bat nhan vien ngoi doan xem
  luc nao thi bam la vo ly.

  Goi mot tep TINH trong pham vi (manifest), khong phai mot lan chuyen trang:
  service worker chi bat mode === 'navigate' nen yeu cau nay di thang ra mang.
  cache: 'no-store' de trinh duyet khong tra lai ban da luu.

  Cach nhau 3 giay, va CHI khi trang dang hien - tab an di thi ngung, khong goi
  vo ich trong tui nguoi ta.
*/
(function () {
  var dang = false;
  function thu() {
    if (dang || document.hidden) return;
    dang = true;
    fetch('/cham-cong/manifest.webmanifest?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (r && r.ok) location.replace('/cham-cong/'); })
      .catch(function () {})
      .then(function () { dang = false; });
  }
  setInterval(thu, 3000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) thu(); });
})();
</script>
</body></html>`;

const SW = `/*
  Service worker - KHONG luu dem gi ca.

  No ton tai duy nhat de trinh duyet cho phep cai trang ra man hinh chinh.
  Moi yeu cau deu di thang ra mang.

  VI SAO KHONG CON BAT MOI LOI
  ----------------------------
  Ban truoc bat MOI loi cua fetch() va tra ve trang "mat ket noi". Nghe hop ly,
  nhung no nuot ca mot loai loi hoan toan khac: LOI CHUNG CHI.

  May chu dung chung chi tu ky. Moi khi dia chi mang doi, chung chi duoc cap
  lai, va ngoai le ma dien thoai da bam chap nhan truoc do het hieu luc. Luc
  do fetch() that bai - va worker nay bien no thanh "dien thoai dang mat mang,
  hoac may chu chua bat".

  Hau qua: nguoi dung KHONG BAO GIO thay duoc man hinh "Ket noi khong an toan"
  de bam "Nang cao -> Tiep tuc truy cap", vi worker da chan truoc khi trinh
  duyet kip hien no. Va vi thong bao noi sai nguyen nhan, ho di kiem tra Wi-Fi
  va may chu - hai thu deu dang chay tot.

  Nay chi hien trang cua minh khi CHAC CHAN la mat mang (navigator.onLine =
  false). Moi truong hop khac deu nem tiep loi ra ngoai, de trinh duyet hien
  dung man hinh that cua no - ke ca man hinh chung chi co nut di tiep.
*/
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  // Chi dong vao dieu huong trang. Anh va loi goi API phai di thang.
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(function (loi) {
      var thatSuMatMang = self.navigator && self.navigator.onLine === false;
      if (!thatSuMatMang) throw loi;   // de trinh duyet tu bao - xem ghi chu tren
      return new Response(${JSON.stringify(OFFLINE)}, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    })
  );
});
`;

router.get('/cham-cong/sw.js', (req, res) => {
  res.type('application/javascript')
    // Khong luu dem chinh service worker: sua worker roi ma may cu giu ban cu
    // thi khong cach nao day ban moi xuong nhung may da cai.
    .set('Cache-Control', 'no-cache')
    .send(SW);
});

module.exports = router;

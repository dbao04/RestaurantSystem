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
const OFFLINE = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Mất kết nối</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
text-align:center;padding:24px;font-family:system-ui,sans-serif;
background:linear-gradient(135deg,#2c1810,#4e342e);color:#fff}
h1{font-size:20px;margin:0 0 10px}p{opacity:.8;font-size:15px;line-height:1.5;margin:0 0 18px}
a{display:inline-block;background:#c8a951;color:#2c1810;text-decoration:none;font-weight:700;
padding:13px 26px;border-radius:12px}</style></head><body><div>
<h1>Không có kết nối tới máy chủ</h1>
<p>Điện thoại đang mất mạng, hoặc máy chủ nhà hàng chưa bật.<br>
Hãy kiểm tra Wi-Fi rồi thử lại.</p>
<a href="/cham-cong/">Thử lại</a></div></body></html>`;

const SW = `/* Service worker cham cong - di thang ra mang, khong luu dem. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  // Chi dong vao dieu huong trang. Anh cham cong va loi goi API phai di thang,
  // khong duoc worker xen vao giua.
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response(${JSON.stringify(OFFLINE)}, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }));
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

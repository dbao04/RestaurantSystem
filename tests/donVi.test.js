/**
 * Kiem thu DON VI - khong can CSDL hay server.
 * Chay: npm run test:donvi   (hoac npm test de chay ca kiem thu tich hop)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const md5 = require('md5');

const matKhau = require('../utils/matKhau');
const chongCsrf = require('../middleware/chongCsrf');
const gioiHanDN = require('../middleware/gioiHanDangNhap');

// orderService nap config/db (tao pool nhung chua ket noi) - chi dung ham thuan.
const { chuanHoaSoLuong, SO_LUONG_TOI_DA_KHACH } = require('../services/orderService');

test('chuanHoaSoLuong: chi nhan so nguyen trong [1, toi da]', () => {
  assert.equal(chuanHoaSoLuong(1), 1);
  assert.equal(chuanHoaSoLuong('3'), 3);
  assert.equal(chuanHoaSoLuong(SO_LUONG_TOI_DA_KHACH), SO_LUONG_TOI_DA_KHACH);
  for (const sai of [0, -5, '2.5', 'abc', '', null, undefined, SO_LUONG_TOI_DA_KHACH + 1, '1e3', ' -1']) {
    assert.equal(chuanHoaSoLuong(sai), null, `phai tu choi ${JSON.stringify(sai)}`);
  }
  assert.equal(chuanHoaSoLuong(150, 200), 150);
});

test('matKhau: bcrypt moi, van chap nhan md5 cu, tu choi hash la', async () => {
  const h = await matKhau.bam('bi-mat-123');
  assert.match(h, /^\$2[aby]\$/);
  assert.equal(await matKhau.khop('bi-mat-123', h), true);
  assert.equal(await matKhau.khop('sai', h), false);
  assert.equal(matKhau.canBamLai(h), false);

  const cu = md5('123456');
  assert.equal(await matKhau.khop('123456', cu), true);
  assert.equal(await matKhau.khop('1234567', cu), false);
  assert.equal(matKhau.canBamLai(cu), true);

  // Tai khoan QR mang chuoi danh dau, khong bao gio dang nhap duoc.
  assert.equal(await matKhau.khop('123456', '!QR_KHONG_DANG_NHAP'), false);
  assert.equal(await matKhau.khop('', h), false);
});

test('matKhau: mat khau mac dinh va quy tac mat khau moi', () => {
  assert.equal(matKhau.laMacDinh('123456'), true);
  assert.equal(matKhau.laMacDinh('1234567'), false);
  assert.ok(matKhau.loiMatKhauMoi('12345'));
  assert.ok(matKhau.loiMatKhauMoi('123456'));
  assert.ok(matKhau.loiMatKhauMoi('x'.repeat(73)));
  assert.equal(matKhau.loiMatKhauMoi('abc12345'), null);
});

function goiCsrf({ method = 'POST', headers = {}, path = '/x', ip = '1.2.3.4' }) {
  const mw = chongCsrf();
  let ketQua = 'next';
  const req = { method, path, originalUrl: path, headers, socket: { remoteAddress: ip }, xhr: false, is: () => false };
  const res = {
    status(c) { ketQua = c; return this; },
    json() { return this; },
    send() { return this; },
  };
  const oldWarn = console.warn; console.warn = () => {};
  mw(req, res, () => {});
  console.warn = oldWarn;
  return ketQua;
}

test('chongCsrf: chan POST tu trang khac, cho qua cung trang va khong Origin', () => {
  assert.equal(goiCsrf({ method: 'GET', headers: { host: 'a:3000', origin: 'http://xau.vn' } }), 'next');
  assert.equal(goiCsrf({ headers: { host: 'a:3000', origin: 'http://a:3000' } }), 'next');
  assert.equal(goiCsrf({ headers: { host: 'a:3000', origin: 'http://xau.vn' } }), 403);
  assert.equal(goiCsrf({ headers: { host: 'a:3000', referer: 'http://xau.vn/p' } }), 403);
  assert.equal(goiCsrf({ headers: { host: 'a:3000', referer: 'http://a:3000/p' } }), 'next');
  // Webhook / script: khong Origin, khong Referer.
  assert.equal(goiCsrf({ headers: { host: 'a:3000' } }), 'next');
  // Qua cloudflared: chi tin X-Forwarded-Host khi ket noi tu loopback.
  const quaTunnel = { host: 'localhost:3000', origin: 'https://abc.trycloudflare.com', 'x-forwarded-host': 'abc.trycloudflare.com' };
  assert.equal(goiCsrf({ headers: quaTunnel, ip: '127.0.0.1' }), 'next');
  assert.equal(goiCsrf({ headers: quaTunnel, ip: '8.8.8.8' }), 403);
});

test('gioiHanDangNhap: sai 5 lan thi khoa, tai khoan khac van duoc, dung thi xoa dem', () => {
  const req = { ip: '10.9.8.' + Math.floor(Math.random() * 250) };
  const tk = 'kiemthu_' + Date.now();
  for (let i = 0; i < 4; i++) gioiHanDN.ghiThatBai(req, 'kiem_thu', tk);
  assert.equal(gioiHanDN.soGiayBiKhoa(req, 'kiem_thu', tk), 0);
  gioiHanDN.ghiThatBai(req, 'kiem_thu', tk);
  assert.ok(gioiHanDN.soGiayBiKhoa(req, 'kiem_thu', tk) > 0);
  assert.equal(gioiHanDN.soGiayBiKhoa(req, 'kiem_thu', tk + '_khac'), 0);
  gioiHanDN.xoaDem(req, 'kiem_thu', tk);
  assert.equal(gioiHanDN.soGiayBiKhoa(req, 'kiem_thu', tk), 0);
});

test.after(async () => {
  // Dong pool CSDL ma orderService da tao de tien trinh thoat.
  await require('../config/db').end().catch(() => {});
});

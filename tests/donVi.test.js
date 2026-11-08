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

test('phanTichThucDon.phanLoai: nguong Kasavana & Smith va 4 nhom', () => {
  const { phanLoai } = require('../services/phanTichThucDonService');
  // 4 mon -> nguong pho bien = 0.7 x 1/4 = 17.5% so phan.
  const kq = phanLoai([
    { id_mon: 1, gia_ban: 100000, gia_von: 30000, so_luong: 50 }, // 50%, lai 70k
    { id_mon: 2, gia_ban: 60000, gia_von: 40000, so_luong: 30 },  // 30%, lai 20k
    { id_mon: 3, gia_ban: 150000, gia_von: 50000, so_luong: 10 }, // 10%, lai 100k
    { id_mon: 4, gia_ban: 50000, gia_von: 35000, so_luong: 10 },  // 10%, lai 15k
  ]);
  assert.equal(kq.tong_so_luong, 100);
  assert.ok(Math.abs(kq.nguong_pho_bien - 0.175) < 1e-9);
  // Lai binh quan co trong so: (70k*50 + 20k*30 + 100k*10 + 15k*10) / 100 = 52.500
  assert.equal(Math.round(kq.nguong_lai), 52500);
  const nhom = Object.fromEntries(kq.mon.map((m) => [m.id_mon, m.nhom]));
  assert.deepEqual(nhom, { 1: 'ngoi_sao', 2: 'ngua_keo', 3: 'cau_do', 4: 'cho' });
  const m2 = kq.mon.find((m) => m.id_mon === 2);
  assert.ok(Math.abs(m2.food_cost - 40000 / 60000) < 1e-9);
  assert.ok(m2.goi_y.some((g) => /tăng giá/.test(g)), 'ngua keo co goi y gia');
  // Khong ban gi: moi mon la "ban cham"; khong chia cho 0.
  const rong = phanLoai([{ id_mon: 9, gia_ban: 10000, gia_von: 5000, so_luong: 0 }]);
  assert.equal(rong.mon[0].ty_le_ban, 0);
  assert.ok(['cau_do', 'cho'].includes(rong.mon[0].nhom));
  assert.deepEqual(phanLoai([]).mon, []);
});

test('duBaoNhanSu.tinhDeXuat: tai dong thoi, nang suat, he so mua vu', () => {
  const { tinhDeXuat, THAM_SO_MAC_DINH } = require('../services/duBaoNhanSuService');
  const rong = () => [...Array(7)].map(() => Array(24).fill(0));
  const don = rong(), phan = rong();
  // Thu 6 (5): 6 ban den luc 17h, 12 ban luc 18h; 120 phan mon luc 18h.
  don[5][17] = 6; don[5][18] = 12; phan[5][18] = 120;
  const caList = [{ ma_ca: 'toi', gio_bat_dau: '17:00:00', gio_ket_thuc: '21:00:00' }];
  const kq = tinhDeXuat({ don, phan, caList, ts: THAM_SO_MAC_DINH });
  const o = kq[5].toi;
  // Ngoi 90 phut: ban dong thoi luc 18h = 12 + 0.5 x 6 = 15.
  assert.equal(o.dinh_ban, 15);
  assert.deepEqual(o.de_xuat, { 'Phuc vu': 3, Bep: 3, 'Thu ngan': 1, Quay: 1 }); // 15/6, 120/40, 12/20, 12/25
  // Ngay khong co khach: khong can ai.
  assert.deepEqual(kq[1].toi.de_xuat, { 'Phuc vu': 0, Bep: 0, 'Thu ngan': 0, Quay: 0 });
  // He so mua vu 2 -> tai gap doi.
  const gapDoi = tinhDeXuat({ don, phan, caList, heSo: 2, ts: THAM_SO_MAC_DINH })[5].toi;
  assert.equal(gapDoi.dinh_ban, 30);
  assert.deepEqual(gapDoi.de_xuat, { 'Phuc vu': 5, Bep: 6, 'Thu ngan': 2, Quay: 1 });
});

test('thoiGianCho.lapLich: hang doi nhieu dau bep va trung vi', () => {
  const { lapLich, trungVi } = require('../services/thoiGianChoService');
  assert.equal(trungVi([1, 100, 3]), 3);
  assert.equal(trungVi([2, 4, 6, 8]), 5);
  const phutMon = () => 10;
  // 2 bep. Mon 1 dang nau duoc 4 phut (con 6). Mon 2,3,4 dang cho.
  const kq = lapLich([
    { id: 1, id_mon: 1, soluong: 1, trangthai_bep: 1, da_nau_phut: 4 },
    { id: 2, id_mon: 1, soluong: 1, trangthai_bep: 0 },
    { id: 3, id_mon: 1, soluong: 1, trangthai_bep: 0 },
    { id: 4, id_mon: 1, soluong: 3, trangthai_bep: 0 },
  ], { K: 2, phutMon });
  assert.equal(kq.get(1).con_phut, 6);   // bep A: 0 -> 6
  assert.equal(kq.get(2).con_phut, 10);  // bep B ranh: 0 -> 10
  assert.equal(kq.get(3).con_phut, 16);  // bep A ranh luc 6: 6 -> 16
  assert.equal(kq.get(4).con_phut, 24);  // bep B ranh luc 10, 3 phan = 10 x 1.4: 10 -> 24
  // Mot bep: tuan tu.
  const motBep = lapLich([{ id: 9, id_mon: 1, soluong: 1, trangthai_bep: 0 }, { id: 10, id_mon: 1, soluong: 1, trangthai_bep: 0 }], { K: 1, phutMon });
  assert.equal(motBep.get(10).con_phut, 20);
});

test.after(async () => {
  // Dong pool CSDL ma orderService da tao de tien trinh thoat.
  await require('../config/db').end().catch(() => {});
});

test('tiec: ghep ten mon thuc don tiec voi mon an (bo dau, bo ma, token dinh danh phai trung)', () => {
  const { ghepMon } = require('../services/tiecVanHanhService');
  const ds = [
    { id_mon: 1, name_mon: 'SETA-SASHIMI SET A' }, { id_mon: 2, name_mon: 'SETB-SASHIMI SET B' },
    { id_mon: 3, name_mon: 'SA05-SALAD HẢI SẢN' }, { id_mon: 4, name_mon: 'H05-LẨU SUKIYAKI' },
  ];
  assert.equal(ghepMon('Sashimi Set B', ds).id_mon, 2);
  assert.equal(ghepMon('Sashimi Set E', ds), null, 'khong ghep nham sang Set A');
  assert.equal(ghepMon('Salad hải sản', ds).id_mon, 3);
  assert.equal(ghepMon('Lẩu Sukiyaki bò', ds).id_mon, 4);
  assert.equal(ghepMon('Nigiri tổng hợp', ds), null);
});

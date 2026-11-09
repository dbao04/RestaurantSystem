/**
 * Kiem thu TICH HOP - chay that tren MySQL + server.
 *
 * Chay: npm run test:tichhop   (can MySQL dang chay va CSDL gs_restaurant)
 * Server: neu http://localhost:PORT dang chay thi dung luon; khong thi tu bat
 * `node server.js` va tat khi xong.
 *
 * MOI thay doi du lieu deu duoc khoi phuc o test.after: mat khau tai khoan
 * dung de dang nhap, don/mon tao ra, nhat ky huy mon / chuyen ban, ton kho,
 * trang thai ban, ma QR.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');
const md5 = require('md5');

process.chdir(path.join(__dirname, '..'));
require('dotenv').config({ override: true, quiet: true });
const db = require('../config/db');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const MK = '123456';
const MK_TAM = 'KiemThu@2026';

// ----------------------------------------------------------------- tien ich
function client() {
  let cookie = '';
  return async (p, o = {}) => {
    const r = await fetch(BASE + p, {
      redirect: 'manual', ...o,
      headers: { Origin: BASE, ...(o.headers || {}), cookie },
    });
    const sc = r.headers.getSetCookie();
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
}
const form = (o, h = {}) => ({
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...h },
  body: new URLSearchParams(o).toString(),
});
const json = (o) => ({
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(o || {}),
});
const viTri = (r) => decodeURIComponent((r.headers.get('location') || '').split('+').join(' '));

// ------------------------------------------------- ghi nho de khoi phuc
const khoiPhuc = {
  matKhau: new Map(),      // `${bang}|${khoa}|${id}|${cot}` -> hash goc
  sesis: new Set(),        // don tao ra trong luc test
  ban: new Map(),          // Id_ban -> {trangthai, sesis_hien_tai}
  qr: null,                // [{id, active_sesis}]
  nguyenLieu: new Map(),   // id_nl -> so_luong
  lo: new Map(),           // id_ct -> so_luong_con_lai
};
async function giuMatKhau(bang, khoa, id, cot) {
  const k = `${bang}|${khoa}|${id}|${cot}`;
  if (khoiPhuc.matKhau.has(k)) return;
  const [[r]] = await db.query(`SELECT ${cot} AS h FROM ${bang} WHERE ${khoa} = ?`, [id]);
  khoiPhuc.matKhau.set(k, r.h);
}
async function dangNhapNhanVien(username) {
  const [[nv]] = await db.query('SELECT id_nv FROM nhan_vien WHERE username = ?', [username]);
  await giuMatKhau('nhan_vien', 'id_nv', nv.id_nv, 'passwords');
  const c = client();
  const r = await c('/staff/login', form({ username, password: MK }));
  assert.equal(r.status, 302, `dang nhap ${username}`);
  assert.notEqual(r.headers.get('location'), '/staff/login');
  // Mat khau mac dinh -> bi bat doi (luong that), roi tra hash cu ve de lan
  // dang nhap sau van dung MK; phien nay da duoc mo khoa.
  if (String(r.headers.get('location')).startsWith('/staff/profile')) {
    const [[cu]] = await db.query('SELECT passwords FROM nhan_vien WHERE id_nv = ?', [nv.id_nv]);
    const d = await c('/staff/profile', form({ action: 'password', old_pass: MK, new_pass: MK_TAM, re_pass: MK_TAM }));
    assert.match(String(d.headers.get('location')), /success/, 'doi mat khau mac dinh');
    await db.query('UPDATE nhan_vien SET passwords = ? WHERE id_nv = ?', [cu.passwords, nv.id_nv]);
  }
  return c;
}
async function giuBan(ids) {
  const [rows] = await db.query('SELECT Id_ban, trangthai, sesis_hien_tai FROM ban WHERE Id_ban IN (?)', [ids]);
  for (const r of rows) if (!khoiPhuc.ban.has(r.Id_ban)) khoiPhuc.ban.set(r.Id_ban, r);
}
async function giuKho(idsNl) {
  const [nl] = await db.query('SELECT id_nl, so_luong, gia_von FROM nguyen_lieu WHERE id_nl IN (?)', [idsNl]);
  for (const r of nl) if (!khoiPhuc.nguyenLieu.has(r.id_nl)) khoiPhuc.nguyenLieu.set(r.id_nl, { so_luong: r.so_luong, gia_von: r.gia_von });
  const [lo] = await db.query('SELECT id_ct, so_luong_con_lai FROM chi_tiet_phieu_nhap WHERE id_nl IN (?)', [idsNl]);
  for (const r of lo) if (!khoiPhuc.lo.has(r.id_ct)) khoiPhuc.lo.set(r.id_ct, r.so_luong_con_lai);
}

// ---------------------------------------------------------- bat server
let tienTrinh = null;
test.before(async () => {
  const [qr] = await db.query('SELECT id, active_sesis FROM qr_tables');
  khoiPhuc.qr = qr;
  const dangChay = await fetch(BASE + '/').then((r) => r.ok).catch(() => false);
  if (dangChay) return;
  tienTrinh = spawn(process.execPath, ['server.js'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    if (await fetch(BASE + '/').then((r) => r.ok).catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server khong khoi dong duoc');
});

test.after(async () => {
  try {
    for (const sesis of khoiPhuc.sesis) {
      for (const bang of ['xuat_kho', 'payments', 'huy_mon']) {
        await db.query(`DELETE FROM ${bang} WHERE sesis = ?`, [sesis]).catch(() => {});
      }
      await db.query('DELETE FROM chuyen_ban WHERE sesis_nguon = ? OR sesis_dich = ?', [sesis, sesis]).catch(() => {});
      await db.query('DELETE FROM hopdong WHERE sesis = ?', [sesis]);
    }
    for (const [k, h] of khoiPhuc.matKhau) {
      const [bang, khoa, id, cot] = k.split('|');
      await db.query(`UPDATE ${bang} SET ${cot} = ? WHERE ${khoa} = ?`, [h, id]);
    }
    for (const [id, b] of khoiPhuc.ban) {
      await db.query('UPDATE ban SET trangthai = ?, sesis_hien_tai = ? WHERE Id_ban = ?', [b.trangthai, b.sesis_hien_tai, id]);
    }
    for (const q of khoiPhuc.qr || []) await db.query('UPDATE qr_tables SET active_sesis = ? WHERE id = ?', [q.active_sesis, q.id]);
    for (const [id, g] of khoiPhuc.nguyenLieu) await db.query('UPDATE nguyen_lieu SET so_luong = ?, gia_von = ? WHERE id_nl = ?', [g.so_luong, g.gia_von, id]);
    for (const [id, sl] of khoiPhuc.lo) await db.query('UPDATE chi_tiet_phieu_nhap SET so_luong_con_lai = ? WHERE id_ct = ?', [sl, id]);
    // Tai khoan vang lai cua ban (orderService.khachVangLaiCuaBan) sinh ra khi
    // test mo ban - xoa neu khong con don nao dung toi.
    await db.query(
      "DELETE k FROM khach_hang k WHERE k.sodienthoai LIKE 'QR\\_BAN%' AND NOT EXISTS (SELECT 1 FROM hopdong h WHERE h.id_user = k.id)");
  } finally {
    await db.end();
    if (tienTrinh) tienTrinh.kill();
  }
});

// ------------------------------------------------------------- du lieu mau
async function monCoCongThuc() {
  const [[mon]] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon FROM monan m
     WHERE m.tinhtrang = 1 AND EXISTS (SELECT 1 FROM cong_thuc c WHERE c.id_mon = m.id_mon)
     ORDER BY m.id_mon LIMIT 1`);
  return mon;
}
async function haiBanTrong() {
  const [rows] = await db.query(
    `SELECT b.Id_ban, b.number_ban FROM ban b
     WHERE b.trangthai = 0 AND b.sesis_hien_tai IS NULL
       AND NOT EXISTS (SELECT 1 FROM hopdong h WHERE h.id_ban = b.Id_ban AND h.tinhtrang IN (1,5,6) AND h.ngay_dat = CURDATE())
     ORDER BY b.Id_ban LIMIT 3`);
  assert.ok(rows.length >= 3, 'can it nhat 3 ban trong');
  await giuBan(rows.map((r) => r.Id_ban));
  return rows;
}
async function goiMonChoBan(nv, idBan, idMon, sl = 2) {
  const r = await nv('/so-do-ban/api/order-mon/' + idBan, json({ items: [{ id_mon: idMon, soluong: sl }], so_khach: 2 }));
  const d = await r.json();
  assert.equal(d.ok, true, 'goi mon: ' + JSON.stringify(d));
  khoiPhuc.sesis.add(d.sesis);
  return d.sesis;
}

// =================================================================== TESTS

test('gio hang: chan so luong am va chan sua gio cua phien khac', async () => {
  const mon = await monCoCongThuc();
  const A = client(); const B = client();
  await A('/'); await B('/');
  assert.equal((await A('/add-to-cart', form({ monid: mon.id_mon, soluong: '-5' }))).status, 400);
  assert.equal((await A('/add-to-cart', form({ monid: mon.id_mon, soluong: '2' }))).status, 302);
  const [[dong]] = await db.query('SELECT cart_id FROM cart WHERE id_mon = ? ORDER BY cart_id DESC LIMIT 1', [mon.id_mon]);
  await B('/update-cart', form({ cartid: dong.cart_id, soluong: '9' }));
  await B('/del-cart?delid=' + dong.cart_id, { method: 'POST' });
  const [[sau]] = await db.query('SELECT soluong FROM cart WHERE cart_id = ?', [dong.cart_id]);
  assert.equal(sau.soluong, 2, 'phien khac khong sua/xoa duoc');
  assert.equal((await A('/del-cart?delid=' + dong.cart_id)).status, 404, 'GET xoa khong con');
  await A('/del-cart?delid=' + dong.cart_id, { method: 'POST' });
  const [[con]] = await db.query('SELECT COUNT(*) AS n FROM cart WHERE cart_id = ?', [dong.cart_id]);
  assert.equal(con.n, 0);
});

test('QR goi mon: tu choi so luong khong hop le', async () => {
  const mon = await monCoCongThuc();
  const [[qr]] = await db.query('SELECT table_id FROM qr_tables LIMIT 1');
  for (const qty of [-3, 0, 999, 2.5]) {
    const d = await (await fetch(BASE + '/qr/add-dish', {
      ...json({ tableId: qr.table_id, items: [{ id: mon.id_mon, qty }] }),
      headers: { 'Content-Type': 'application/json', Origin: BASE },
    })).json();
    assert.equal(d.success, false, 'qty ' + qty);
  }
});

test('CSRF + header bao mat', async () => {
  const mon = await monCoCongThuc();
  let r = await client()('/add-to-cart', form({ monid: mon.id_mon, soluong: '1' }, { Origin: 'http://xau.example' }));
  assert.equal(r.status, 403);
  r = await fetch(BASE + '/');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.match(r.headers.get('set-cookie') || '', /SameSite=Lax/i);
});

test('dang nhap: md5 cu tu nang len bcrypt; sai 5 lan bi khoa', async () => {
  const [[nv]] = await db.query("SELECT id_nv FROM nhan_vien WHERE username = 'daubep'");
  await giuMatKhau('nhan_vien', 'id_nv', nv.id_nv, 'passwords');
  await db.query('UPDATE nhan_vien SET passwords = ? WHERE id_nv = ?', [md5(MK), nv.id_nv]);
  await dangNhapNhanVien('daubep');
  const [[sau]] = await db.query('SELECT passwords FROM nhan_vien WHERE id_nv = ?', [nv.id_nv]);
  assert.match(sau.passwords, /^\$2/);

  const tk = 'phuban6';
  for (let i = 0; i < 5; i++) await client()('/staff/login', form({ username: tk, password: 'sai' + i }));
  const r = await client()('/staff/login', form({ username: tk, password: MK }));
  assert.equal(r.status, 429);
});

test('nhan vien dung mat khau mac dinh: bi bat doi, API van chay, khong doi lai 123456', async (t) => {
  const [[nv]] = await db.query("SELECT id_nv, passwords FROM nhan_vien WHERE username = 'thungan'");
  await giuMatKhau('nhan_vien', 'id_nv', nv.id_nv, 'passwords');
  t.after(() => db.query('UPDATE nhan_vien SET passwords = ? WHERE id_nv = ?', [nv.passwords, nv.id_nv]));
  const c = client();
  let r = await c('/staff/login', form({ username: 'thungan', password: MK }));
  assert.match(String(r.headers.get('location')), /^\/staff\/profile/);
  r = await c('/staff/thanh-toan', { headers: { Accept: 'text/html' } });
  assert.equal(r.status, 302);
  assert.match(String(r.headers.get('location')), /^\/staff\/profile/, 'trang khac bi chuyen ve doi mat khau');
  r = await c('/staff/profile', { headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  r = await c('/staff/profile', form({ action: 'password', old_pass: MK, new_pass: MK, re_pass: MK }));
  assert.match(String(r.headers.get('location')), /danger/, 'khong dat lai 123456');
  r = await c('/staff/profile', form({ action: 'password', old_pass: MK, new_pass: MK_TAM, re_pass: MK_TAM }));
  assert.match(String(r.headers.get('location')), /success/);
  r = await c('/staff/thanh-toan', { headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200, 'doi xong thi vao duoc');
  r = await client()('/staff/login', form({ username: 'thungan', password: MK_TAM }));
  assert.doesNotMatch(String(r.headers.get('location')), /profile|login/, 'mat khau moi khong bi bat doi');
});

test('khach dung mat khau mac dinh bi bat doi mat khau', async () => {
  const [[kh]] = await db.query(
    "SELECT id, sodienthoai FROM khach_hang WHERE sodienthoai NOT LIKE 'QR%' AND sodienthoai REGEXP '^0[0-9]{9}$' ORDER BY id LIMIT 1");
  await giuMatKhau('khach_hang', 'id', kh.id, 'passwords');
  await db.query('UPDATE khach_hang SET passwords = ? WHERE id = ?', [md5(MK), kh.id]);
  const K = client();
  let r = await K('/login', form({ sdt: kh.sodienthoai, pass: MK }));
  assert.match(viTri(r), /^\/profile\?msg=.*mặc định/);
  r = await K('/menu');
  assert.match(viTri(r), /^\/profile/, 'trang khac bi chuyen ve doi mat khau');
  r = await K('/profile', form({ action: 'password', old_pass: MK, new_pass: MK, re_pass: MK }));
  assert.match(viTri(r), /mặc định/, 'khong duoc dat lai 123456');
  r = await K('/profile', form({ action: 'password', old_pass: MK, new_pass: 'moi12345', re_pass: 'moi12345' }));
  assert.match(viTri(r), /thành công/);
  r = await K('/menu');
  assert.equal(r.status, 200, 'doi xong thi vao trang binh thuong');
});

test('quen mat khau: tra loi giong nhau, token dung mot lan', async () => {
  const datLai = require('../services/datLaiMatKhauService');
  const r1 = await (await client()('/forgot-password', form({ email: 'khong-ton-tai-' + Date.now() + '@x.vn' }))).text();
  assert.match(r1, /Nếu email này có tài khoản/);

  const [[kh]] = await db.query(
    "SELECT id, email FROM khach_hang WHERE email IS NOT NULL AND email <> '' AND sodienthoai NOT LIKE 'QR%' LIMIT 1");
  await giuMatKhau('khach_hang', 'id', kh.id, 'passwords');
  const yc = await datLai.taoYeuCau(kh.email);
  assert.ok(yc && yc.token);
  let r = await client()('/dat-lai-mat-khau/' + yc.token);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Lưu mật khẩu mới/);
  r = await client()('/dat-lai-mat-khau/' + yc.token, form({ mat_khau: 'moi98765', nhap_lai: 'moi98765' }));
  assert.match(await r.text(), /thành công/);
  const [[sau]] = await db.query('SELECT passwords FROM khach_hang WHERE id = ?', [kh.id]);
  assert.equal(await require('../utils/matKhau').khop('moi98765', sau.passwords), true);
  r = await client()('/dat-lai-mat-khau/' + yc.token);
  assert.match(await r.text(), /hết hạn hoặc đã được sử dụng/, 'token chi dung mot lan');
  await db.query('DELETE FROM dat_lai_mat_khau WHERE id_kh = ?', [kh.id]);
});

test('huy mon: phuc vu huy mon chua nau; mon da nau can quan ly', async () => {
  const mon = await monCoCongThuc();
  const [b1] = await haiBanTrong();
  const PV = await dangNhapNhanVien('phucvu');
  const QL = await dangNhapNhanVien('quanly');
  const sesis = await goiMonChoBan(PV, b1.Id_ban, mon.id_mon, 3);
  const [[dong]] = await db.query('SELECT id FROM hopdong WHERE sesis = ? AND id_mon = ? ORDER BY id DESC LIMIT 1', [sesis, mon.id_mon]);

  let d = await (await PV('/staff/huy-mon/' + dong.id, json({ so_luong: 1, ma_ly_do: '' }))).json();
  assert.equal(d.success, false, 'phai co ly do');
  d = await (await PV('/staff/huy-mon/' + dong.id, json({ so_luong: 1, ma_ly_do: 'goi_nham' }))).json();
  assert.equal(d.success, true, JSON.stringify(d));
  let [[sau]] = await db.query('SELECT soluong, thanhtien FROM hopdong WHERE id = ?', [dong.id]);
  assert.equal(sau.soluong, 2);
  assert.equal(Number(sau.thanhtien), Number(mon.gia_mon) * 2);

  // Bep bat dau nau -> phuc vu khong huy duoc nua, quan ly duoc.
  await db.query('UPDATE hopdong SET trangthai_bep = 1 WHERE id = ?', [dong.id]);
  let r = await PV('/staff/huy-mon/' + dong.id, json({ ma_ly_do: 'khach_doi_y' }));
  assert.equal(r.status, 403);
  d = await (await QL('/staff/huy-mon/' + dong.id, json({ ma_ly_do: 'khach_doi_y' }))).json();
  assert.equal(d.success, true, JSON.stringify(d));
  [[sau]] = await db.query('SELECT soluong FROM hopdong WHERE id = ?', [dong.id]);
  assert.equal(sau.soluong, 0);

  const [[log]] = await db.query('SELECT COUNT(*) AS n, SUM(so_luong) AS sl FROM huy_mon WHERE sesis = ?', [sesis]);
  assert.equal(log.n, 2);
  assert.equal(Number(log.sl), 3);
  const ls = await (await QL('/staff/huy-mon/don/' + encodeURIComponent(sesis))).json();
  assert.equal(ls.lich_su.length, 2);
});

test('chuyen ban va gop ban', async () => {
  const mon = await monCoCongThuc();
  const [b1, b2, b3] = await haiBanTrong();
  const PV = await dangNhapNhanVien('phucvu');
  const s1 = await goiMonChoBan(PV, b1.Id_ban, mon.id_mon, 1);

  // Chuyen b1 -> b2 (trong)
  let d = await (await PV('/so-do-ban/api/chuyen-ban', json({ tu_ban: b1.Id_ban, den_ban: b2.Id_ban }))).json();
  assert.equal(d.ok, true, JSON.stringify(d));
  const [[ban1]] = await db.query('SELECT trangthai, sesis_hien_tai FROM ban WHERE Id_ban = ?', [b1.Id_ban]);
  const [[ban2]] = await db.query('SELECT trangthai, sesis_hien_tai FROM ban WHERE Id_ban = ?', [b2.Id_ban]);
  assert.equal(ban1.sesis_hien_tai, null);
  assert.equal(ban1.trangthai, 3);
  assert.equal(ban2.sesis_hien_tai, s1);
  const [[idBan]] = await db.query('SELECT COUNT(DISTINCT id_ban) AS n, MAX(id_ban) AS id FROM hopdong WHERE sesis = ?', [s1]);
  assert.equal(idBan.n, 1);
  assert.equal(idBan.id, b2.Id_ban);

  // Khong chuyen duoc vao ban dang co khach.
  const s3 = await goiMonChoBan(PV, b3.Id_ban, mon.id_mon, 2);
  d = await (await PV('/so-do-ban/api/chuyen-ban', json({ tu_ban: b2.Id_ban, den_ban: b3.Id_ban }))).json();
  assert.equal(d.ok, false);

  // Gop b2 (s1) vao b3 (s3)
  d = await (await PV('/so-do-ban/api/gop-ban', json({ tu_ban: b2.Id_ban, den_ban: b3.Id_ban }))).json();
  assert.equal(d.ok, true, JSON.stringify(d));
  const [[con]] = await db.query('SELECT COUNT(*) AS n FROM hopdong WHERE sesis = ?', [s1]);
  assert.equal(con.n, 0, 'phien nguon khong con dong nao');
  const [[gop]] = await db.query('SELECT SUM(soluong) AS sl FROM hopdong WHERE sesis = ? AND id_mon = ?', [s3, mon.id_mon]);
  assert.equal(Number(gop.sl), 3);
  const [[nk]] = await db.query("SELECT COUNT(*) AS n FROM chuyen_ban WHERE sesis_nguon = ?", [s1]);
  assert.equal(nk.n, 2);
});

test('chuyen ban khach dat truoc: o gio con lai va reservation_tables doi theo; ban dich da co nguoi dat thi chan', async () => {
  const mon = await monCoCongThuc();
  const [b1, b2, b3] = await haiBanTrong();
  const PV = await dangNhapNhanVien('phucvu');
  const s = await goiMonChoBan(PV, b1.Id_ban, mon.id_mon, 1);
  const ma = 'RKT' + Date.now().toString(36).toUpperCase();
  const ma2 = ma + 'B';
  const pad = (n) => String(n).padStart(2, '0');
  const moc = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  const dau = new Date(); dau.setSeconds(0, 0); dau.setMinutes(Math.floor(dau.getMinutes() / 15) * 15);
  const o = (k) => moc(new Date(dau.getTime() + k * 15 * 60000));
  // Gio mo ta cua luot dat kep trong hom nay (chay test luc gan nua dem); o khoa van theo gio that.
  const homNayStr = moc(new Date()).slice(0, 10);
  const gioTrongNgay = (m, bien) => (m.slice(0, 10) === homNayStr ? m.slice(11) : bien);
  const taoRes = async (code, ban, dsO) => {
    const [kq] = await db.query(
      `INSERT INTO reservations (reservation_code, customer_name, phone, reservation_date, start_time, expected_end_time,
                                 duration_minutes, guest_count, status)
       VALUES (?, 'Kiem Thu Chuyen', '0900000004', CURDATE(), ?, ?, ?, 2, 'SEATED')`,
      [code, gioTrongNgay(o(dsO[0]), '00:00:00'), gioTrongNgay(o(dsO[dsO.length - 1] + 1), '23:59:00'), dsO.length * 15]);
    await db.query('INSERT INTO reservation_slot_locks (table_id, slot_start, reservation_id) VALUES ?',
      [dsO.map((k) => [ban, o(k), kq.insertId])]);
    await db.query('INSERT INTO reservation_tables (reservation_id, table_id, seats) VALUES (?, ?, 2)', [kq.insertId, ban]);
    return kq.insertId;
  };
  try {
    // Luot dat dang ngoi b1: o tu 2 o truoc (da qua) toi 3 o sau.
    const id = await taoRes(ma, b1.Id_ban, [-2, -1, 0, 1, 2, 3]);
    await db.query('UPDATE hopdong SET sesis = ? WHERE sesis = ?', [ma, s]);
    await db.query('UPDATE ban SET sesis_hien_tai = ? WHERE Id_ban = ?', [ma, b1.Id_ban]);
    khoiPhuc.sesis.add(ma);
    // Luot khac da dat b3 tu o thu 2.
    await taoRes(ma2, b3.Id_ban, [2, 3, 4]);

    let d = await (await PV('/so-do-ban/api/chuyen-ban', json({ tu_ban: b1.Id_ban, den_ban: b3.Id_ban }))).json();
    assert.equal(d.ok, false, 'ban dich da co nguoi dat trong gio con lai');
    assert.match(JSON.stringify(d), new RegExp(ma2));

    d = await (await PV('/so-do-ban/api/chuyen-ban', json({ tu_ban: b1.Id_ban, den_ban: b2.Id_ban }))).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    const [o1] = await db.query('SELECT slot_start FROM reservation_slot_locks WHERE reservation_id = ? AND table_id = ?', [id, b1.Id_ban]);
    const [o2] = await db.query('SELECT slot_start FROM reservation_slot_locks WHERE reservation_id = ? AND table_id = ?', [id, b2.Id_ban]);
    assert.equal(o1.length, 2, 'o da qua giu o ban cu');
    assert.equal(o2.length, 4, 'o hien tai + con lai sang ban moi');
    const [rt] = await db.query('SELECT table_id FROM reservation_tables WHERE reservation_id = ?', [id]);
    assert.deepEqual(rt.map((r) => r.table_id), [b2.Id_ban]);
  } finally {
    await db.query('DELETE FROM reservations WHERE reservation_code IN (?, ?)', [ma, ma2]);
  }
});

/** Tao mot don thu (mot dong mon) truc tiep trong CSDL. */
async function taoDonThu({ tinhtrang, loaiDon = 'tai_cho', idUser }) {
  const sesis = 'KT_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mon = await monCoCongThuc();
  await db.query(
    `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien,
                          images, tinhtrang, ngay_dat, gio_dat, loai_don)
     VALUES (?, ?, ?, ?, CURDATE(), '12:00', 1, 'kiem thu', '2', ?, ?, '', ?, CURDATE(), '12:00:00', ?)`,
    [sesis, mon.id_mon, mon.name_mon, idUser, mon.gia_mon, mon.gia_mon, tinhtrang, loaiDon]);
  khoiPhuc.sesis.add(sesis);
  return sesis;
}
const tinhTrangDon = async (sesis) => (await db.query('SELECT tinhtrang FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]))[0][0].tinhtrang;

test('xac nhan don / khach den: chi dung trang thai, khong dung don giao hang', async () => {
  const [[kh]] = await db.query("SELECT id FROM khach_hang WHERE sodienthoai LIKE 'QR\\_%' LIMIT 1");
  const choXacNhan = await taoDonThu({ tinhtrang: 0, idUser: kh.id });
  const giaoChoTra = await taoDonThu({ tinhtrang: 0, loaiDon: 'giao_hang', idUser: kh.id });
  const daThanhToan = await taoDonThu({ tinhtrang: 3, idUser: kh.id });
  const daHuy = await taoDonThu({ tinhtrang: 4, idUser: kh.id });
  const LT = await dangNhapNhanVien('letan');

  let r = await LT('/staff/bookings/confirm/' + giaoChoTra, { method: 'POST' });
  assert.match(viTri(r), /giao hàng/);
  assert.equal(await tinhTrangDon(giaoChoTra), 0, 'don giao cho tra tien khong duoc xac nhan tay');
  for (const s of [daThanhToan, daHuy]) {
    const truoc = await tinhTrangDon(s);
    r = await LT('/staff/bookings/confirm/' + s, { method: 'POST' });
    assert.match(viTri(r), /Không thể xác nhận/);
    assert.equal(await tinhTrangDon(s), truoc, 'don da xong khong bi song lai');
  }
  r = await LT('/staff/bookings/confirm/' + choXacNhan, { method: 'POST' });
  assert.match(viTri(r), /Đã xác nhận/);
  assert.equal(await tinhTrangDon(choXacNhan), 1);

  r = await LT('/staff/bookings/arrive/' + daThanhToan, form({}));
  assert.match(viTri(r), /Không thể nhận khách/);
  assert.equal(await tinhTrangDon(daThanhToan), 3);
  r = await LT('/staff/bookings/arrive/' + choXacNhan, form({}));
  assert.equal(await tinhTrangDon(choXacNhan), 5);
  const trang = await (await LT(r.headers.get('location'))).text();
  assert.match(trang, /Đã ghi nhận khách đến/, 'trang danh sach hien thong bao');
});

test('hoan tien: chi quan ly, bat buoc ly do, co han, khong hoan hai lan, tra luot ma giam gia', async () => {
  // Khach QR: hoanTien bo qua phan diem tich luy -> khong dong toi du lieu diem that.
  const [[kh]] = await db.query("SELECT id FROM khach_hang WHERE sodienthoai LIKE 'QR\\_%' LIMIT 1");
  const sesis = await taoDonThu({ tinhtrang: 3, idUser: kh.id });
  const [[ma]] = await db.query('SELECT id, code, current_usage FROM discount_codes ORDER BY id LIMIT 1');

  const taoPhien = async (luc) => {
    const [kq] = await db.query(
      `INSERT INTO payments (sesis, amount, payment_method_id, status, loai, nguon, discount_code_used, discount_amount, thanh_cong_luc)
       VALUES (?, 100000, 1, 'success', 'thanh_toan', 'quay', ?, 10000, ${luc})`, [sesis, ma.code]);
    return kq.insertId;
  };
  const p1 = await taoPhien('NOW()');
  const pCu = await taoPhien('DATE_SUB(NOW(), INTERVAL 5 DAY)');
  await db.query(
    'INSERT INTO discount_usages (discount_id, code, id_kh, sesis, payment_id, so_tien_giam, gia_tri_don) VALUES (?,?,?,?,?,10000,110000)',
    [ma.id, ma.code, kh.id, sesis, p1]);
  await db.query('UPDATE discount_codes SET current_usage = current_usage + 1 WHERE id = ?', [ma.id]);

  const hoan = (c, id, lyDo) => c(`/staff/thanh-toan/phien/${id}/hoan-tien`, json({ ly_do: lyDo }));
  try {
    const TN = await dangNhapNhanVien('thungan');
    let r = await hoan(TN, p1, 'khach tra nham');
    assert.equal(r.status, 403, 'thu ngan khong tu hoan duoc');
    assert.match((await r.json()).loi, /Quản lý/);

    const QL = await dangNhapNhanVien('quanly');
    r = await hoan(QL, p1, '');
    assert.equal(r.status, 400, 'bat buoc ly do');
    r = await hoan(QL, pCu, 'qua han roi');
    assert.equal(r.status, 400);
    assert.match((await r.json()).loi, /quá hạn/);

    // Hai yeu cau dong thoi: dung mot lan thanh cong.
    const kq = await Promise.all([hoan(QL, p1, 'khach tra nham'), hoan(QL, p1, 'khach tra nham')]);
    const thanhCong = (await Promise.all(kq.map((x) => x.json()))).filter((d) => d.thanhCong).length;
    assert.equal(thanhCong, 1, 'chi mot lan hoan duoc xu ly');

    const [[p]] = await db.query('SELECT status FROM payments WHERE id = ?', [p1]);
    assert.equal(p.status, 'refunded');
    const [[dung]] = await db.query('SELECT COUNT(*) AS n FROM discount_usages WHERE payment_id = ?', [p1]);
    assert.equal(dung.n, 0, 'luot dung ma da duoc tra');
    const [[maSau]] = await db.query('SELECT current_usage FROM discount_codes WHERE id = ?', [ma.id]);
    assert.equal(maSau.current_usage, ma.current_usage, 'current_usage ve nhu cu');
  } finally {
    await db.query('DELETE FROM discount_usages WHERE payment_id IN (?)', [[p1, pCu]]);
    await db.query('UPDATE discount_codes SET current_usage = ? WHERE id = ?', [ma.current_usage, ma.id]);
    await db.query("DELETE FROM audit_logs WHERE action = 'hoan_tien' AND resource_id IN (?)", [[p1, pCu]]).catch(() => {});
  }
});

test('giao hang: khong roi nha hang khi bep chua xong; doi trang thai co khoa', async () => {
  const vc = require('../services/vanChuyenService');
  const [[kh]] = await db.query("SELECT id FROM khach_hang WHERE sodienthoai LIKE 'QR\\_%' LIMIT 1");
  const sesis = await taoDonThu({ tinhtrang: 1, loaiDon: 'giao_hang', idUser: kh.id });
  const [kq] = await db.query(
    `INSERT INTO don_giao_hang (sesis, ma_giao, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_giao, trang_thai)
     VALUES (?, ?, 'Kiem thu', '0900000000', 'Dia chi kiem thu', 'dang_lay')`,
    [sesis, 'KT' + Date.now().toString(36).slice(-6).toUpperCase()]);
  const idGiao = kq.insertId;
  const nguoi = { ten: 'Kiểm thử' };
  try {
    await assert.rejects(vc.doiTrangThai(idGiao, 'dang_giao', nguoi, { laDieuPhoi: true }), /Bếp chưa làm xong/);

    // Bep xong -> hai thao tac dong thoi tu 'dang_lay': chi mot thao tac duoc ghi.
    await db.query('UPDATE hopdong SET trangthai_bep = 2 WHERE sesis = ?', [sesis]);
    const kqs = await Promise.allSettled([
      vc.doiTrangThai(idGiao, 'dang_giao', nguoi, { laDieuPhoi: true }),
      vc.doiTrangThai(idGiao, 'da_phan', nguoi, { laDieuPhoi: true }),
    ]);
    assert.equal(kqs.filter((x) => x.status === 'fulfilled').length, 1, 'chi mot lan doi trang thai thanh cong');
    const [[dg]] = await db.query('SELECT trang_thai FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
    if (dg.trang_thai === 'dang_giao') {
      const [[mon]] = await db.query('SELECT trangthai_bep FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]);
      assert.equal(mon.trangthai_bep, 3, 'mon chuyen "da giao cho shipper" khi roi nha hang');
    }
  } finally {
    await db.query('DELETE FROM nhat_ky_giao_hang WHERE id_giao = ?', [idGiao]).catch(() => {});
    await db.query('DELETE FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  }
});

test('nhap kho nhanh di qua phieu nhap: co lo, ton khop tong lo', async () => {
  const [[nl]] = await db.query(
    `SELECT nl.id_nl, nl.so_luong, COALESCE(SUM(ct.so_luong_con_lai), 0) AS lo
     FROM nguyen_lieu nl LEFT JOIN chi_tiet_phieu_nhap ct ON ct.id_nl = nl.id_nl
     GROUP BY nl.id_nl, nl.so_luong ORDER BY nl.id_nl LIMIT 1`);
  await giuKho([nl.id_nl]);
  const [[pnTruoc]] = await db.query('SELECT COALESCE(MAX(id_pn), 0) AS m FROM phieu_nhap');
  const BEP = await dangNhapNhanVien('daubep');
  let idPn = null;
  try {
    const r = await BEP('/staff/kitchen/inventory/stock-in', form({ id_nl: nl.id_nl, so_luong: '5', gia_nhap: '1000' }));
    assert.equal(r.status, 302);
    const [[pn]] = await db.query('SELECT id_pn, ma_phieu FROM phieu_nhap WHERE id_pn > ? ORDER BY id_pn DESC LIMIT 1', [pnTruoc.m]);
    assert.ok(pn, 'nhap nhanh phai sinh phieu nhap');
    idPn = pn.id_pn;
    const [[sau]] = await db.query(
      `SELECT nl.so_luong, COALESCE(SUM(ct.so_luong_con_lai), 0) AS lo
       FROM nguyen_lieu nl LEFT JOIN chi_tiet_phieu_nhap ct ON ct.id_nl = nl.id_nl WHERE nl.id_nl = ? GROUP BY nl.so_luong`, [nl.id_nl]);
    assert.ok(Math.abs(Number(sau.so_luong) - Number(nl.so_luong) - 5) < 0.01, 'ton tang dung 5');
    assert.ok(Math.abs(Number(sau.lo) - Number(nl.lo) - 5) < 0.01, 'tong lo tang dung 5');
  } finally {
    if (idPn) {
      await db.query('DELETE FROM chi_tiet_phieu_nhap WHERE id_pn = ?', [idPn]);
      await db.query('DELETE FROM phieu_nhap WHERE id_pn = ?', [idPn]);
    }
  }
});

test('dat tiec: vong doi dung thu tu, coc va thanh toan ghi tien that, hoan coc chi quan ly', async () => {
  const dv = require('../services/datTiecService');
  await dv.damBaoCotTien();
  const sanh = (await dv.docSanhTiec())[0];
  const thucDon = (await dv.docThucDon())[0];
  assert.ok(sanh && thucDon, 'can co sanh va thuc don tiec');
  const ngayTiec = dv.cong(require('../utils/thoiGian').ngayCucBo(), 300);
  const taoTiec = async (buoi) => dv.taoDonTiec({
    ho_ten: 'Kiem Thu Tiec', so_dien_thoai: '0900000001', loai_tiec: Object.keys(dv.LOAI_TIEC)[0],
    ngay_to_chuc: ngayTiec, buoi, gio_bat_dau: dv.BUOI[buoi].gio[0],
    so_khach: sanh.tiec_toi_thieu, khu_vuc_id: sanh.id, thuc_don_id: thucDon.id,
  });
  const t1 = await taoTiec('TRUA');
  const t2 = await taoTiec('TOI');
  const ma = [t1.ma, t2.ma];
  const capNhat = (c, id, body) => c(`/api/staff/dat-tiec/${id}/trang-thai`, json(body));
  try {
    const PV = await dangNhapNhanVien('phucvu');
    const LT = await dangNhapNhanVien('letan');
    const QL = await dangNhapNhanVien('quanly');

    let d = await (await capNhat(LT, t1.id, { trang_thai: 'HOAN_THANH' })).json();
    assert.equal(d.ok, false, 'khong nhay tu MOI sang HOAN_THANH');
    d = await (await capNhat(LT, t1.id, { trang_thai: 'DA_XAC_NHAN' })).json();
    assert.equal(d.ok, true, JSON.stringify(d));

    const toiThieu = Math.ceil(t1.tong_du_toan * dv.TY_LE_COC);
    let r = await capNhat(PV, t1.id, { trang_thai: 'DA_COC', so_tien: toiThieu, phuong_thuc: 'tien_mat' });
    assert.equal(r.status, 403, 'phuc vu khong thu tien');
    d = await (await capNhat(LT, t1.id, { trang_thai: 'DA_COC', so_tien: toiThieu - 1000, phuong_thuc: 'tien_mat' })).json();
    assert.equal(d.ok, false, 'coc duoi muc toi thieu');
    d = await (await capNhat(LT, t1.id, { trang_thai: 'DA_COC', so_tien: toiThieu, phuong_thuc: 'tien_mat' })).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    d = await (await capNhat(LT, t1.id, { trang_thai: 'HOAN_THANH', tong_thuc_te: t1.tong_du_toan + 200000, phuong_thuc: 'vietqr' })).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    const [ps1] = await db.query("SELECT loai, amount FROM payments WHERE sesis = ? AND status = 'success' ORDER BY id", [t1.ma]);
    assert.deepEqual(ps1.map((p) => [p.loai, Number(p.amount)]),
      [['dat_coc', toiThieu], ['thanh_toan', t1.tong_du_toan + 200000 - toiThieu]]);
    d = await (await capNhat(LT, t1.id, { trang_thai: 'HUY', ly_do_huy: 'thu nhay nguoc' })).json();
    assert.equal(d.ok, false, 'HOAN_THANH la trang thai cuoi');

    // Tiec 2: coc roi huy. Le tan khong hoan duoc, quan ly hoan duoc.
    await capNhat(LT, t2.id, { trang_thai: 'DA_XAC_NHAN' });
    d = await (await capNhat(LT, t2.id, { trang_thai: 'DA_COC', so_tien: toiThieu, phuong_thuc: 'tien_mat' })).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    d = await (await capNhat(LT, t2.id, { trang_thai: 'HUY', ly_do_huy: '' })).json();
    assert.equal(d.ok, false, 'bat buoc ly do huy');
    r = await capNhat(LT, t2.id, { trang_thai: 'HUY', ly_do_huy: 'khach doi ngay', hoan_coc: true });
    assert.equal(r.status, 403, 'le tan khong hoan coc');
    d = await (await capNhat(QL, t2.id, { trang_thai: 'HUY', ly_do_huy: 'khach doi ngay', hoan_coc: true })).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal(d.da_hoan, toiThieu);
    const [[p2]] = await db.query('SELECT status FROM payments WHERE sesis = ? LIMIT 1', [t2.ma]);
    assert.equal(p2.status, 'refunded');
    const [[tiec2]] = await db.query('SELECT trang_thai, da_thu, ly_do_huy FROM dat_tiec WHERE id = ?', [t2.id]);
    assert.equal(tiec2.trang_thai, 'HUY');
    assert.equal(Number(tiec2.da_thu), 0);
  } finally {
    const [ps] = await db.query('SELECT id FROM payments WHERE sesis IN (?)', [ma]);
    if (ps.length) await db.query("DELETE FROM audit_logs WHERE action = 'hoan_tien' AND resource_id IN (?)", [ps.map((p) => p.id)]).catch(() => {});
    await db.query('DELETE FROM payments WHERE sesis IN (?)', [ma]);
    await db.query('DELETE FROM dat_tiec WHERE ma_tiec IN (?)', [ma]);
  }
});

test('tiec giu sanh tren dat ban + ke hoach nguyen lieu + cong vao du bao mua hang', async () => {
  const dv = require('../services/datTiecService');
  const tv = require('../services/tiecVanHanhService');
  const rt = require('../services/reservationTables');
  const qt = require('../services/reservationRules');
  const kho = require('../services/khoBepService');
  await dv.damBaoCotTien();
  const sanh = (await dv.docSanhTiec())[0];
  const thucDon = (await dv.docThucDon())[0];
  const homNay = require('../utils/thoiGian').ngayCucBo();
  const ngayTiec = dv.cong(homNay, 5);
  const t = await dv.taoDonTiec({
    ho_ten: 'Kiem Thu Sanh', so_dien_thoai: '0900000002', loai_tiec: Object.keys(dv.LOAI_TIEC)[0],
    ngay_to_chuc: ngayTiec, buoi: 'TOI', gio_bat_dau: dv.BUOI.TOI.gio[0],
    so_khach: sanh.tiec_toi_thieu, khu_vuc_id: sanh.id, thuc_don_id: thucDon.id,
  });
  const khung = (gio) => qt.phanTichKhungGio({ reservation_date: ngayTiec, start_time: gio, guest_count: 2, duration_minutes: 90 });
  const banSanh = async (gio) => (await rt.banKhaDung(khung(gio), { chiChoDat: false })).tatCa
    .filter((b) => Number(b.khu_vuc_id) === Number(sanh.id));
  try {
    // Moi tao (MOI) chua giu sanh.
    assert.ok((await banSanh('19:00')).every((b) => !b.ly_do || b.ly_do.ma !== 'EVENT'), 'tiec MOI khong giu sanh');
    await db.query("UPDATE dat_tiec SET trang_thai = 'DA_XAC_NHAN' WHERE id = ?", [t.id]);
    const toi = await banSanh('19:00');
    assert.ok(toi.length > 0, 'sanh co ban');
    assert.ok(toi.every((b) => b.ly_do && b.ly_do.ma === 'EVENT'), 'moi ban cua sanh bi khoa buoi toi');
    assert.ok((await banSanh('11:00')).every((b) => !b.ly_do || b.ly_do.ma !== 'EVENT'), 'buoi trua khong bi khoa');

    // Ke hoach nguyen lieu qua API (nhan vien) - so luong = cong thuc x so ban x phan.
    const QL = await dangNhapNhanVien('quanly');
    const kh = await (await QL(`/api/staff/dat-tiec/${t.id}/nguyen-lieu`, { headers: { Accept: 'application/json' } })).json();
    assert.equal(kh.ok, true, JSON.stringify(kh).slice(0, 200));
    assert.ok(kh.mon.length > 0 && kh.mon.some((m) => m.id_mon), 'ghep duoc it nhat mot mon');
    assert.ok(kh.nguyen_lieu.length > 0, 'co nguyen lieu can');
    const monGhep = [...new Set(kh.mon.filter((m) => m.id_mon).map((m) => m.id_mon))];
    const [ct] = await db.query('SELECT id_nl, so_luong_tieu_hao AS dl FROM cong_thuc WHERE id_mon IN (?) AND so_luong_tieu_hao > 0', [monGhep]);
    const nl0 = kh.nguyen_lieu[0];
    const demMon = kh.mon.filter((m) => m.id_mon);
    let mongDoi = 0;
    for (const m of demMon) {
      const [r] = await db.query('SELECT so_luong_tieu_hao AS dl FROM cong_thuc WHERE id_mon = ? AND id_nl = ? AND so_luong_tieu_hao > 0', [m.id_mon, nl0.id_nl]);
      for (const x of r) mongDoi += Number(x.dl) * kh.phan_moi_mon_moi_ban * Number(t.so_ban || kh.tiec.so_ban);
    }
    assert.ok(ct.length > 0);
    assert.ok(Math.abs(nl0.can - mongDoi) < 1e-6, `can ${nl0.can} != ${mongDoi}`);
    assert.equal(nl0.thieu, Math.max(0, nl0.can - nl0.kha_dung));

    // Nhu cau tiec nam DUNG ngay to chuc trong du bao tieu hao.
    const db0 = await kho.duBaoTieuHao(homNay, 10);
    const mang = db0.tiec.get(Number(nl0.id_nl));
    assert.ok(mang, 'du bao co nhu cau tiec');
    assert.ok(Math.abs(mang[5] - nl0.can) < 1e-6, 'nhu cau vao ngay thu 5');

    // Tiec o ngoai tam giao hang van phai keo goi y mua cho phan thieu.
    await db.query("UPDATE dat_tiec SET so_ban = 200, so_khach = 2000 WHERE id = ?", [t.id]);
    const goiY = await kho.goiYMuaHang({ homNay });
    const dongNl = goiY.find((g) => Number(g.id_nl) === Number(nl0.id_nl));
    assert.ok(dongNl, 'nguyen lieu thieu cho tiec co trong goi y mua');
    assert.ok(dongNl.can_cho_tiec > 0);
    assert.ok(dongNl.de_xuat >= dongNl.can_cho_tiec - dongNl.kha_dung - dongNl.dang_ve - 1e-6, 'de xuat du bu phan tiec');

    // Huy tiec -> nha sanh.
    await db.query("UPDATE dat_tiec SET trang_thai = 'HUY' WHERE id = ?", [t.id]);
    assert.ok((await banSanh('19:00')).every((b) => !b.ly_do || b.ly_do.ma !== 'EVENT'), 'huy tiec nha sanh');
  } finally {
    await db.query('DELETE FROM dat_tiec WHERE id = ?', [t.id]);
  }
});

test('cong no nha cung cap: phieu nhap sinh no, tra mot phan, chong tra vuot, huy phieu chi thi no tang lai', async () => {
  const kho = require('../services/khoBepService');
  const thuChi = require('../services/thuChiService');
  const congNo = require('../services/congNoNccService');
  const [[ncc]] = await db.query('SELECT id_ncc FROM nha_cung_cap WHERE trangthai = 1 ORDER BY id_ncc LIMIT 1');
  const [[nl]] = await db.query('SELECT id_nl FROM nguyen_lieu ORDER BY id_nl LIMIT 1');
  await giuKho([nl.id_nl]);
  const [[nvKt]] = await db.query("SELECT id_nv FROM nhan_vien WHERE username = 'ketoan'");
  let idPn = null;
  try {
    const pn = await kho.taoPhieuNhap({ id_ncc: ncc.id_ncc, dong: [{ id_nl: nl.id_nl, so_luong: 2, don_gia: 100000 }] }, null);
    idPn = pn.id;
    const [[p0]] = await db.query('SELECT tong_tien, da_tra, han_thanh_toan FROM phieu_nhap WHERE id_pn = ?', [idPn]);
    assert.equal(Number(p0.tong_tien), 200000);
    assert.equal(Number(p0.da_tra), 0);
    assert.ok(p0.han_thanh_toan, 'phieu co NCC co han tra');
    assert.ok((await congNo.phieuConNo(ncc.id_ncc)).some((x) => x.id_pn === idPn));

    const tra = (c, soTien) => c(`/api/staff/cong-no-ncc/phieu/${idPn}/tra`, json({ so_tien: soTien, phuong_thuc: 'chuyen_khoan' }));
    const BEP = await dangNhapNhanVien('daubep');
    assert.equal((await tra(BEP, 50000)).status, 403, 'bep khong tra tien NCC');

    const KT = await dangNhapNhanVien('ketoan');
    let d = await (await tra(KT, 50000)).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal(d.con_no, 150000);
    d = await (await tra(KT, 200000)).json();
    assert.equal(d.ok, false, 'khong tra vuot so no');

    const kq = await Promise.all([tra(KT, 150000), tra(KT, 150000)]);
    assert.equal((await Promise.all(kq.map((x) => x.json()))).filter((x) => x.ok).length, 1, 'tra dong thoi khong vuot no');
    let [[p1]] = await db.query('SELECT da_tra FROM phieu_nhap WHERE id_pn = ?', [idPn]);
    assert.equal(Number(p1.da_tra), 200000);

    const [chi] = await db.query("SELECT id, danh_muc FROM phieu_thu_chi WHERE id_pn = ? AND trang_thai = 'hop_le' ORDER BY id", [idPn]);
    assert.equal(chi.length, 2);
    assert.ok(chi.every((c) => c.danh_muc === 'tra_ncc'));
    await thuChi.huyPhieu(chi[0].id, { lyDo: 'nhap nham so tien', idNv: nvKt.id_nv, laQuanLy: true });
    [[p1]] = await db.query('SELECT da_tra FROM phieu_nhap WHERE id_pn = ?', [idPn]);
    assert.equal(Number(p1.da_tra), 150000, 'huy phieu chi 50.000 -> no tang lai 50.000');
  } finally {
    if (idPn) {
      const [chi] = await db.query('SELECT id FROM phieu_thu_chi WHERE id_pn = ?', [idPn]);
      if (chi.length) await db.query("DELETE FROM audit_logs WHERE action = 'huy_phieu_thu_chi' AND resource_id IN (?)", [chi.map((c) => c.id)]).catch(() => {});
      await db.query('DELETE FROM phieu_thu_chi WHERE id_pn = ?', [idPn]);
      await db.query('DELETE FROM chi_tiet_phieu_nhap WHERE id_pn = ?', [idPn]);
      await db.query('DELETE FROM phieu_nhap WHERE id_pn = ?', [idPn]);
    }
  }
});

test('nghi phep: cap tren duyet, khong tu duyet, ke toan khong duyet, chan trung ngay', async () => {
  const [[maxTruoc]] = await db.query('SELECT COALESCE(MAX(id_np), 0) AS m FROM nghi_phep');
  const ngay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  try {
    const PV = await dangNhapNhanVien('phucvu');
    let r = await PV('/staff/leave/add', form({ ly_do: 'Viec gia dinh', ngay_bat_dau: ngay(40), ngay_ket_thuc: ngay(41) }));
    assert.equal(r.status, 302);
    const [[don]] = await db.query(
      "SELECT np.id_np FROM nghi_phep np JOIN nhan_vien n ON n.id_nv = np.id_nv WHERE n.username = 'phucvu' AND np.id_np > ? ORDER BY np.id_np DESC LIMIT 1",
      [maxTruoc.m]);
    assert.ok(don, 'tao duoc don');
    r = await PV('/staff/leave/add', form({ ly_do: 'Trung ngay', ngay_bat_dau: ngay(41), ngay_ket_thuc: ngay(42) }));
    assert.match(await r.text(), /trùng khoảng ngày/, 'chan don trung ngay');

    const xuLy = (c, dongY, lyDo = '') => c(`/api/staff/nghi-phep/${don.id_np}/xu-ly`, json({ dong_y: dongY, ly_do: lyDo }));
    assert.equal((await xuLy(PV, true)).status, 403, 'khong tu duyet');
    for (const u of ['phucvu2', 'totruongpv2', 'ketoan']) {
      const c = await dangNhapNhanVien(u);
      assert.equal((await xuLy(c, true)).status, 403, `${u} khong phai cap tren`);
    }
    const KT = await dangNhapNhanVien('ketoan');
    r = await KT(`/staff/accountant/leave/approve/${don.id_np}`, { method: 'POST' });
    assert.match(viTri(r), /cấp trên/, 'route duyet cu cua ke toan chi bao huong dan');

    const TT = await dangNhapNhanVien('totruongpv');
    const ds = await (await TT('/staff/duyet-nghi-phep')).text();
    assert.ok(ds.includes(`data-id="${don.id_np}"`), 'cap tren thay don');
    assert.equal((await xuLy(TT, false, '')).status, 400, 'tu choi phai co ly do');
    let d = await (await xuLy(TT, true)).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal((await xuLy(TT, false, 'doi y')).status, 400, 'khong xu ly lai don da duyet');
    const [[sau]] = await db.query('SELECT trang_thai, nguoi_duyet, duyet_luc FROM nghi_phep WHERE id_np = ?', [don.id_np]);
    const [[tt]] = await db.query("SELECT id_nv FROM nhan_vien WHERE username = 'totruongpv'");
    assert.equal(sau.trang_thai, 1);
    assert.equal(sau.nguoi_duyet, tt.id_nv);
    assert.ok(sau.duyet_luc);
  } finally {
    await db.query('DELETE FROM nghi_phep WHERE id_np > ?', [maxTruoc.m]);
  }
});

test('phan tich thuc don: quan ly / bep xem duoc, phuc vu khong; loc danh muc', async () => {
  const QL = await dangNhapNhanVien('quanly');
  let r = await QL('/staff/phan-tich-thuc-don');
  assert.equal(r.status, 200);
  let html = await r.text();
  assert.ok(html.includes('id="bd"') && html.includes('Ma trận thực đơn'), 'co bieu do');
  assert.ok(html.includes('Chi tiết từng món'), 'co bang so lieu');
  const [[dm]] = await db.query(
    'SELECT l.id_loai, l.name_loai, COUNT(*) AS n FROM loai_mon l JOIN monan m ON m.id_loai = l.id_loai AND m.tinhtrang = 1 GROUP BY l.id_loai, l.name_loai ORDER BY n DESC LIMIT 1');
  r = await QL('/staff/phan-tich-thuc-don?loai=' + dm.id_loai);
  html = await r.text();
  const data = JSON.parse(html.match(/var DATA = (\[.*?\]);/s)[1]);
  assert.ok(data.length > 0 && data.length <= dm.n, 'chi mon cua danh muc');
  assert.ok(data.every((d) => d.loai === dm.name_loai));
  const BEP = await dangNhapNhanVien('daubep');
  assert.equal((await BEP('/staff/phan-tich-thuc-don')).status, 200);
  const PV = await dangNhapNhanVien('phucvu');
  assert.equal((await PV('/staff/phan-tich-thuc-don')).status, 403);
});

test('gan so dien thoai vao don tai ban: mo ban tu so do -> tinh tien duoc, tich diem, dang ky nhan lai ho so', async () => {
  const tt = require('../services/thanhToanService');
  const mon = await monCoCongThuc();
  const [b] = await haiBanTrong();
  const sdt = '09' + String(Date.now()).slice(-8);
  const [[truocBan]] = await db.query("SELECT COUNT(*) AS n FROM khach_hang WHERE sodienthoai = ?", ['QR_BAN' + b.Id_ban]);
  try {
    const PV = await dangNhapNhanVien('phucvu');
    const sesis = await goiMonChoBan(PV, b.Id_ban, mon.id_mon, 2);

    // Truoc day don mo ban gan id_user = 1 (khong ton tai) -> trang tinh tien bao loi.
    const TN = await dangNhapNhanVien('thungan');
    let r = await TN('/staff/thanh-toan/' + sesis);
    assert.equal(r.status, 200, 'trang tinh tien mo duoc');
    assert.match(await r.text(), /Khách hàng tích điểm/);

    const gan = (c, body) => c(`/staff/thanh-toan/${sesis}/gan-khach`, json(body));
    assert.equal((await gan(TN, { sdt: '12345' })).status, 400, 'sdt sai dinh dang');
    let d = await (await gan(TN, { sdt: sdt.replace(/^0/, '+84'), ten: 'Khach Kiem Thu' })).json();
    assert.equal(d.thanhCong, true, JSON.stringify(d));
    assert.equal(d.la_moi, true);
    const [[kh]] = await db.query('SELECT id, ten, passwords FROM khach_hang WHERE sodienthoai = ?', [sdt]);
    assert.equal(kh.ten, 'Khach Kiem Thu');
    assert.equal(kh.passwords, '!CHUA_DANG_KY', 'ho so chua dang ky, khong dang nhap duoc');
    const [[chu]] = await db.query('SELECT COUNT(DISTINCT id_user) AS n, MAX(id_user) AS id FROM hopdong WHERE sesis = ?', [sesis]);
    assert.equal(chu.n, 1);
    assert.equal(chu.id, kh.id);
    assert.equal((await gan(TN, { sdt: '0911111111' })).status, 409, 'khong doi sang khach khac');

    // QR: khach tu nhap -> ten bi che, don da gan thi bao chung chung.
    const q = await (await fetch(`${BASE}/qr/thanh-toan/${sesis}/tich-diem`, {
      ...json({ sdt: '0922222222' }), headers: { 'Content-Type': 'application/json', Origin: BASE } })).json();
    assert.equal(q.thanhCong, false);
    assert.doesNotMatch(q.loi, /khách hàng khác/);

    // Tra tien mat -> cong diem cho khach vua gan.
    const hd = await tt.layHoaDon(sesis);
    await tt.taoPhien({ sesis, soTien: hd.tien.con_phai_tra, maPhuongThuc: 'tien_mat', tienKhachDua: hd.tien.con_phai_tra });
    const [[diem]] = await db.query('SELECT points FROM loyalty_points WHERE id_kh = ?', [kh.id]);
    assert.ok(diem && Number(diem.points) > 0, 'da cong diem');
    const [[don]] = await db.query('SELECT tinhtrang FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]);
    assert.equal(don.tinhtrang, 3, 'don dong sau khi tra du');

    // Khach dang ky web bang dung so -> nhan lai ho so (cung id, giu diem).
    r = await client()('/register', form({ ten: 'Khach That', sodienthoai: sdt, email: '', diachi: '', passwords: 'matkhau123', repass: 'matkhau123' }));
    const [[sau]] = await db.query('SELECT id, ten, passwords FROM khach_hang WHERE sodienthoai = ?', [sdt]);
    assert.equal(sau.id, kh.id, 'khong tao tai khoan moi');
    assert.match(sau.passwords, /^\$2/, 'da dat mat khau');
    const dn = await client()('/login', form({ sdt, pass: 'matkhau123' }));
    assert.equal(viTri(dn), '/', 'dang nhap duoc bang ho so vua nhan');
  } finally {
    const [[kh]] = await db.query('SELECT id FROM khach_hang WHERE sodienthoai = ?', [sdt]);
    if (kh) {
      for (const bang of ['loyalty_transactions', 'loyalty_points']) await db.query(`DELETE FROM ${bang} WHERE id_kh = ?`, [kh.id]).catch(() => {});
      await db.query('DELETE FROM khach_hang WHERE id = ?', [kh.id]);
    }
    if (!truocBan.n) await db.query('DELETE FROM khach_hang WHERE sodienthoai = ?', ['QR_BAN' + b.Id_ban]);
  }
});

test('du bao nhan su: trang du bao, luu gia dinh, ap dung de xuat chi cho chuc vu da chon', async () => {
  const [dmGoc] = await db.query('SELECT thu, ma_ca, chucvu, so_luong FROM dinh_muc_ca');
  const [tsGoc] = await db.query("SELECT khoa, gia_tri, mo_ta FROM cau_hinh WHERE khoa LIKE 'du_bao_ns.%'");
  try {
    const QL = await dangNhapNhanVien('quanly');
    let r = await QL('/staff/xep-ca/du-bao?tuan=2026-11-09');
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes('Bản đồ nhiệt') && html.includes('Định mức hiện tại → đề xuất'));
    const PV = await dangNhapNhanVien('phucvu');
    assert.equal((await PV('/staff/xep-ca/du-bao')).status, 302, 'phuc vu khong vao duoc');

    r = await QL('/staff/xep-ca/du-bao/tham-so', form({ tuan: '2026-11-09', ban_moi_phuc_vu: '4' }));
    assert.equal(r.status, 302);
    const [[ts]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'du_bao_ns.ban_moi_phuc_vu'");
    assert.equal(ts.gia_tri, '4');

    const dbns = require('../services/duBaoNhanSuService');
    const kq = await dbns.duBao({ tuanBatDau: '2026-11-09' });
    r = await QL('/staff/xep-ca/du-bao/ap-dung', form({ tuan: '2026-11-09', chuc_vu: 'Bep' }));
    assert.match(viTri(r), /Đã áp dụng/);
    const [sau] = await db.query('SELECT thu, ma_ca, chucvu, so_luong FROM dinh_muc_ca');
    const lay = (ds, thu, ca, cv) => (ds.find((d) => d.thu === thu && d.ma_ca === ca && d.chucvu === cv) || { so_luong: 0 }).so_luong;
    for (const thu of [0, 1, 6]) {
      for (const ca of kq.caList.map((c) => c.ma_ca)) {
        assert.equal(lay(sau, thu, ca, 'Bep'), kq.de_xuat[thu][ca].de_xuat.Bep, `bep ${thu}/${ca} theo de xuat`);
        assert.equal(lay(sau, thu, ca, 'Phuc vu'), lay(dmGoc, thu, ca, 'Phuc vu'), 'phuc vu giu nguyen');
      }
    }
  } finally {
    const lich = require('../services/lichLamViecService');
    await lich.luuDinhMuc(dmGoc);
    await db.query("DELETE FROM cau_hinh WHERE khoa LIKE 'du_bao_ns.%'");
    for (const t of tsGoc) await db.query('INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, ?, ?)', [t.khoa, t.gia_tri, t.mo_ta]);
  }
});

test('mua hang theo du bao: tao don nhap gom theo NCC, chay lai khong dat trung', async () => {
  const kho = require('../services/khoBepService');
  const [[maxDon]] = await db.query('SELECT COALESCE(MAX(id_dmh), 0) AS m FROM don_mua_hang');
  try {
    const goiY = await kho.goiYMuaHang();
    assert.ok(Array.isArray(goiY) && goiY.thamSo, 'goi y co tham so du bao');
    for (const g of goiY) {
      assert.ok(g.de_xuat > 0);
      assert.ok(g.kha_dung + g.dang_ve - g.can_truoc_khi_ve < g.dinh_muc_min + 1e-6, `${g.ten_nl} dung la can dat`);
    }
    const BEP = await dangNhapNhanVien('daubep');
    const r = await BEP('/api/kitchen/mua-hang/tu-dong', json({}));
    assert.equal(r.status, 201);
    const d = await r.json();
    if (goiY.length) {
      const soNcc = new Set(goiY.map((g) => g.ncc_gan_nhat || 0)).size;
      assert.equal(d.don.length, soNcc, 'moi NCC mot don');
      const [dong] = await db.query(
        `SELECT d.trang_thai, c.id_nl, c.so_luong FROM don_mua_hang d JOIN chi_tiet_don_mua c ON c.id_dmh = d.id_dmh WHERE d.id_dmh > ?`,
        [maxDon.m]);
      assert.equal(dong.length, goiY.length, 'du dong');
      assert.ok(dong.every((x) => x.trang_thai === 'cho_duyet'));
      const lan2 = await kho.goiYMuaHang();
      assert.equal(lan2.length, 0, 'hang trong don vua tao tinh la dang ve -> khong goi y lai');
    } else {
      assert.equal(d.don.length, 0);
    }
  } finally {
    await db.query('DELETE c FROM chi_tiet_don_mua c JOIN don_mua_hang d ON d.id_dmh = c.id_dmh WHERE d.id_dmh > ?', [maxDon.m]);
    await db.query('DELETE FROM don_mua_hang WHERE id_dmh > ?', [maxDon.m]);
  }
});

test('thoi gian cho: KDS va trang QR co so phut du kien', async () => {
  const mon = await monCoCongThuc();
  const [b] = await haiBanTrong();
  const PV = await dangNhapNhanVien('phucvu');
  const sesis = await goiMonChoBan(PV, b.Id_ban, mon.id_mon, 2);
  const [[dong]] = await db.query('SELECT id FROM hopdong WHERE sesis = ? AND id_mon = ? LIMIT 1', [sesis, mon.id_mon]);
  const BEP = await dangNhapNhanVien('daubep');
  const kds = await (await BEP('/kds/api/don')).json();
  const the = kds.cho.find((m) => m.id === dong.id);
  assert.ok(the, 'mon co tren KDS');
  assert.ok(Number(the.con_phut) > 0, 'co so phut du kien');
  assert.equal(typeof the.sap_tre, 'boolean');
  assert.ok(kds.thong_ke.so_dau_bep >= 1 && kds.thong_ke.sla_phut > 0);

  // Trang QR cua ban do (ma QR tro toi ban).
  const [[qr]] = await db.query('SELECT table_id, table_name FROM qr_tables LIMIT 1');
  const os = require('../services/orderService');
  if (qr && (await os.timIdBanTheoTen(qr.table_name)) === b.Id_ban) {
    const d = await (await fetch(`${BASE}/qr/table/${qr.table_id}/don`)).json();
    assert.ok(d.mon.some((m) => m.con_phut > 0));
  }
});

test('bao cao lai lo: so lieu khop SQL doc lap, quyen xem; bao cao thang khong cong trung', async () => {
  const ll = require('../services/laiLoService');
  const [[th]] = await db.query(
    `SELECT DATE_FORMAT(ngay_dat, '%Y-%m-01') AS tu, LAST_DAY(ngay_dat) AS den FROM hopdong
      WHERE tinhtrang = 3 AND id_mon > 0 GROUP BY YEAR(ngay_dat), MONTH(ngay_dat) HAVING COUNT(*) > 100 ORDER BY tu DESC LIMIT 1`);
  const den = new Date(th.den); const denS = `${den.getFullYear()}-${String(den.getMonth() + 1).padStart(2, '0')}-${String(den.getDate()).padStart(2, '0')}`;
  const kq = await ll.phanTich({ tuNgay: th.tu, denNgay: denS, nhom: 'ngay' });
  const [[sql]] = await db.query(
    `SELECT SUM(h.thanhtien) AS dt, SUM(h.soluong * COALESCE(g.gv, 0)) AS gv, COUNT(DISTINCT h.sesis) AS don
       FROM hopdong h LEFT JOIN (SELECT ct.id_mon, SUM(ct.so_luong_tieu_hao * nl.gia_von) AS gv
                                   FROM cong_thuc ct JOIN nguyen_lieu nl ON nl.id_nl = ct.id_nl GROUP BY ct.id_mon) g ON g.id_mon = h.id_mon
      WHERE h.tinhtrang = 3 AND h.id_mon > 0 AND h.soluong > 0 AND h.ngay_dat BETWEEN ? AND ?`, [th.tu, denS]);
  assert.ok(Math.abs(kq.tong.doanh_thu - Number(sql.dt)) < 1, 'doanh thu khop');
  assert.ok(Math.abs(kq.tong.gia_von - Number(sql.gv)) < 1, 'gia von khop');
  assert.equal(kq.tong.so_don, Number(sql.don), 'so don khop');
  assert.ok(Math.abs(kq.tong.lai_gop - (kq.tong.tong_doanh_thu - kq.tong.gia_von)) < 1);
  assert.equal(kq.theo_ky.reduce((s, o) => s + o.so_don, 0), kq.tong.so_don);

  // Bao cao thang cua ke toan: doanh thu = don da thanh toan (khong cong chot_ca).
  const ps = require('../services/personnelService');
  const thang = Number(th.tu.slice(5, 7)), nam = Number(th.tu.slice(0, 4));
  const bc = await ps.getFinancialReport(thang, nam);
  const [[dtThang]] = await db.query(
    'SELECT SUM(thanhtien) AS dt FROM hopdong WHERE tinhtrang = 3 AND id_mon > 0 AND MONTH(ngay_dat) = ? AND YEAR(ngay_dat) = ?', [thang, nam]);
  assert.ok(Math.abs(bc.revenue - Number(dtThang.dt)) < 1, 'bao cao thang khong cong trung chot_ca');

  const KT = await dangNhapNhanVien('ketoan');
  const r = await KT(`/staff/bao-cao-lai-lo?tu=${th.tu}&den=${denS}`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Kết quả kinh doanh/);
  const PV = await dangNhapNhanVien('phucvu');
  assert.equal((await PV('/staff/bao-cao-lai-lo')).status, 403);
});

test('kiem ke: dem thieu / thua, nguoi lap khong tu chot, chot sinh phieu dieu chinh dung so', async () => {
  const kk = require('../services/kiemKeService');
  await kk.damBaoBang();
  const [nls] = await db.query('SELECT id_nl, so_luong FROM nguyen_lieu WHERE so_luong >= 5 ORDER BY id_nl LIMIT 2');
  await giuKho(nls.map((n) => n.id_nl));
  const [A, B] = nls;
  let id = null, ct = null;
  try {
    const BEP = await dangNhapNhanVien('daubep');
    let r = await BEP('/api/kitchen/kiem-ke', json({}));
    let d = await r.json();
    assert.equal(r.status, 201, JSON.stringify(d));
    id = d.id;
    assert.equal((await BEP('/api/kitchen/kiem-ke', json({}))).status, 400, 'chi mot phieu dang dem');

    const ssA = Math.max(0, Number(A.so_luong)), ssB = Math.max(0, Number(B.so_luong));
    r = await BEP(`/api/kitchen/kiem-ke/${id}/dem`, json({ dong: [
      { id_nl: A.id_nl, ton_thuc_te: String(ssA - 2), ghi_chu: 'do vo' },
      { id_nl: B.id_nl, ton_thuc_te: String(ssB + 1.5) },
    ] }));
    assert.equal((await r.json()).so_dong, 2);
    assert.equal((await BEP(`/api/kitchen/kiem-ke/${id}/chot`, json({}))).status, 403, 'dau bep khong chot duoc');

    const BT = await dangNhapNhanVien('beptruong');
    d = await (await BT(`/api/kitchen/kiem-ke/${id}/chot`, json({}))).json();
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal(d.so_thieu, 1);
    assert.equal(d.so_thua, 1);
    const [[a2]] = await db.query('SELECT so_luong FROM nguyen_lieu WHERE id_nl = ?', [A.id_nl]);
    const [[b2]] = await db.query('SELECT so_luong FROM nguyen_lieu WHERE id_nl = ?', [B.id_nl]);
    assert.ok(Math.abs(Number(a2.so_luong) - (ssA - 2)) < 0.01, 'thieu 2 -> tru kho');
    assert.ok(Math.abs(Number(b2.so_luong) - (ssB + 1.5)) < 0.01, 'thua 1.5 -> cong kho');
    ct = await kk.chiTiet(id);
    assert.equal(ct.trang_thai, 'da_chot');
    const [[px]] = await db.query("SELECT COUNT(*) AS n FROM xuat_kho WHERE id_px = ? AND ly_do = 'kiem_ke'", [ct.id_px]);
    assert.equal(px.n, 1);
    const [[pn]] = await db.query('SELECT id_ncc FROM phieu_nhap WHERE id_pn = ?', [ct.id_pn]);
    assert.equal(pn.id_ncc, null, 'phieu nhap thua khong co NCC -> khong cong no');
    assert.equal((await BT(`/api/kitchen/kiem-ke/${id}/chot`, json({}))).status, 400, 'khong chot lai');

    const hh = await kk.baoCaoHaoHut({ tuNgay: '2000-01-01', denNgay: '2100-01-01' });
    assert.ok(hh.theo_ly_do.some((x) => x.ly_do === 'kiem_ke' && x.gia_tri > 0), 'bao cao hao hut co dong kiem ke');
    assert.equal((await BT('/staff/kitchen/kho/kiem-ke')).status, 200);
    assert.equal((await BT(`/staff/kitchen/kho/kiem-ke/${id}`)).status, 200);
  } finally {
    if (ct) {
      if (ct.id_px) { await db.query('DELETE FROM xuat_kho WHERE id_px = ?', [ct.id_px]); await db.query('DELETE FROM phieu_xuat WHERE id_px = ?', [ct.id_px]); }
      if (ct.id_pn) { await db.query('DELETE FROM chi_tiet_phieu_nhap WHERE id_pn = ?', [ct.id_pn]); await db.query('DELETE FROM phieu_nhap WHERE id_pn = ?', [ct.id_pn]); }
    }
    if (id) { await db.query('DELETE FROM kiem_ke_dong WHERE id_kk = ?', [id]); await db.query('DELETE FROM kiem_ke WHERE id_kk = ?', [id]); }
  }
});

test('bao het mon theo ton kho', async () => {
  const mon = await monCoCongThuc();
  const [ct] = await db.query('SELECT id_nl, so_luong_tieu_hao FROM cong_thuc WHERE id_mon = ? AND so_luong_tieu_hao > 0', [mon.id_mon]);
  await giuKho(ct.map((c) => c.id_nl));
  // Chi du nguyen lieu cho dung 1 phan (cong them phan dang giu cho mon chua nau).
  const tonMon = require('../services/tonMonService');
  const [b] = await haiBanTrong();
  const PV = await dangNhapNhanVien('phucvu');
  // Dat MOI nguyen lieu cua mon con kha dung dung 1.5 phan:
  // so_luong moi = so_luong - kha_dung + 1.5 * dinh luong.
  const kd = await tonMon.tonKhaDung(ct.map((c) => c.id_nl));
  for (const c of ct) {
    const [[nl]] = await db.query('SELECT so_luong FROM nguyen_lieu WHERE id_nl = ?', [c.id_nl]);
    const moi = Number(nl.so_luong) - kd.get(Number(c.id_nl)).kha_dung + Number(c.so_luong_tieu_hao) * 1.5;
    await db.query('UPDATE nguyen_lieu SET so_luong = ? WHERE id_nl = ?', [moi, c.id_nl]);
  }
  assert.equal((await tonMon.soPhanCon([mon.id_mon])).get(mon.id_mon), 1);

  let r = await PV('/so-do-ban/api/order-mon/' + b.Id_ban, json({ items: [{ id_mon: mon.id_mon, soluong: 2 }] }));
  assert.equal(r.status, 400);
  assert.match((await r.json()).loi, /Không đủ nguyên liệu/);
  const sesis = await goiMonChoBan(PV, b.Id_ban, mon.id_mon, 1);
  assert.ok(sesis);
  assert.equal((await tonMon.soPhanCon([mon.id_mon])).get(mon.id_mon), 0);
  assert.ok((await tonMon.monDaHet()).has(mon.id_mon));
});

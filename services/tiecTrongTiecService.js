/**
 * DIEU HANH TIEC - Dot 2: TRONG TIEC.
 *   - Khai tiec / ket thuc tiec (gio thuc te -> pha tiec, nhat ky).
 *   - Len mon theo dot (nhom mon cua thuc don): cho -> da_goi (Giam sat / truong tiec goi,
 *     bep nhan chuong) -> da_ra (bep) -> da_len (phuc vu). Ghi gio tung buoc.
 *   - Phat sinh / su co: them mon, them / bot ban, hu hong, khieu nai, ky thuat, y te - an ninh, khac.
 *     Co tinh tien -> cho Giam sat / Quan ly duyet (Dot 3 cong vao hoa don). Khan -> chuong khan.
 *   - Nhat ky tiec: moi thao tac tu ghi.
 * Ban tinh tien = ban chot (viec chot_so_khach) +/- phat sinh them / bot ban da duyet
 * (bot toi da dao_dong_so_khach_phan_tram % so ban chot - chinh sach dat tiec).
 */
const db = require('../config/db');
const dh = require('./dieuHanhTiecService');

const LOAI_PS = {
  them_mon:  { ten: 'Thêm món / đồ uống', icon: 'fa-utensils', tinhTien: 'tu_dong', boPhan: 'BEP', mucDo: 'gap' },
  them_ban:  { ten: 'Thêm bàn', icon: 'fa-square-plus', tinhTien: 'tu_dong', boPhan: 'PV', mucDo: 'gap' },
  bot_ban:   { ten: 'Bớt bàn (khách đến ít)', icon: 'fa-square-minus', tinhTien: 'tu_dong', boPhan: 'PV', mucDo: 'thuong' },
  hu_hong:   { ten: 'Hư hỏng / đền bù', icon: 'fa-wine-glass-empty', tinhTien: 'tuy_chon', boPhan: 'PV', mucDo: 'thuong' },
  khieu_nai: { ten: 'Khiếu nại món / phục vụ', icon: 'fa-face-frown', tinhTien: 'khong', boPhan: 'PV', mucDo: 'gap' },
  ky_thuat:  { ten: 'Sự cố kỹ thuật (âm thanh, điện...)', icon: 'fa-plug-circle-exclamation', tinhTien: 'khong', boPhan: 'QL', mucDo: 'gap' },
  y_te:      { ten: 'Y tế / an ninh', icon: 'fa-kit-medical', tinhTien: 'khong', boPhan: 'QL', mucDo: 'khan' },
  khac:      { ten: 'Khác', icon: 'fa-circle-question', tinhTien: 'tuy_chon', boPhan: 'PV', mucDo: 'thuong' },
};
const MUC_DO = { thuong: 'Thường', gap: 'Gấp', khan: 'Khẩn' };
const TT_PS = { moi: 'Mới', dang_xu_ly: 'Đang xử lý', da_xu_ly: 'Đã xử lý', tu_choi: 'Từ chối' };
const TT_DOT = { cho: 'Chưa gọi', da_goi: 'Bếp đang làm', da_ra: 'Đã ra món', da_len: 'Đã lên bàn' };

let daTao = false;
async function damBaoCauTruc() {
  if (daTao) return;
  await dh.damBaoCauTruc();
  await db.query(`CREATE TABLE IF NOT EXISTS tiec_len_mon (
    id INT AUTO_INCREMENT PRIMARY KEY, dat_tiec_id INT NOT NULL, thu_tu INT NOT NULL, ten_dot VARCHAR(100) NOT NULL,
    mon JSON NULL, trang_thai ENUM('cho','da_goi','da_ra','da_len') NOT NULL DEFAULT 'cho',
    goi_luc DATETIME NULL, nguoi_goi INT NULL, ra_luc DATETIME NULL, nguoi_ra INT NULL, len_luc DATETIME NULL, nguoi_len INT NULL,
    UNIQUE KEY uq_dot (dat_tiec_id, thu_tu), KEY (trang_thai)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS tiec_phat_sinh (
    id INT AUTO_INCREMENT PRIMARY KEY, dat_tiec_id INT NOT NULL, loai VARCHAR(20) NOT NULL,
    muc_do ENUM('thuong','gap','khan') NOT NULL DEFAULT 'thuong', mo_ta VARCHAR(1000) NULL, anh VARCHAR(255) NULL,
    chi_tiet JSON NULL COMMENT 'Mon them [{id_mon,ten,gia,sl}] / so ban', so_ban INT NULL,
    tinh_tien TINYINT(1) NOT NULL DEFAULT 0, so_tien DECIMAL(14,2) NOT NULL DEFAULT 0,
    duyet ENUM('khong_can','cho','da_duyet','tu_choi') NOT NULL DEFAULT 'khong_can',
    trang_thai ENUM('moi','dang_xu_ly','da_xu_ly','tu_choi') NOT NULL DEFAULT 'moi',
    bo_phan VARCHAR(10) NULL, ket_qua VARCHAR(500) NULL,
    nguoi_bao INT NULL, nguoi_duyet INT NULL, duyet_luc DATETIME NULL, nguoi_xu_ly INT NULL, xu_ly_luc DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, KEY (dat_tiec_id), KEY (trang_thai)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS tiec_nhat_ky (
    id INT AUTO_INCREMENT PRIMARY KEY, dat_tiec_id INT NOT NULL, loai VARCHAR(20) NOT NULL, noi_dung VARCHAR(500) NOT NULL,
    id_nv INT NULL, luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP, KEY (dat_tiec_id, luc)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTao = true;
}

const ghi = (idTiec, loai, noiDung, idNv) => db.query('INSERT INTO tiec_nhat_ky (dat_tiec_id, loai, noi_dung, id_nv) VALUES (?, ?, ?, ?)', [idTiec, loai, String(noiDung).slice(0, 500), idNv || null]).catch(() => {});
const vnd = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
const docJson = (v, md) => { if (v == null) return md; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (_) { return md; } };
class Loi extends dh.LoiDieuHanh {}

// ------------------------------------------------------------- doc tiec + quyen
async function docTiec(id) {
  const [[t]] = await db.query(
    `SELECT t.*, DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') AS ngay, TIME_FORMAT(t.gio_bat_dau, '%H:%i') AS gio, d.gia_ban, d.mon AS mon_thuc_don
       FROM dat_tiec t LEFT JOIN thuc_don_tiec d ON d.id = t.thuc_don_id WHERE t.id = ?`, [id]);
  return t || null;
}

/** Quyen trong tiec cua nguoi dang nhap. */
async function quyenTrongTiec(idTiec, { phien, hoSo, idNv }) {
  const q = dh.nhomCua(phien, hoSo);
  const [ns] = await db.query('SELECT vai_tro FROM tiec_nhan_su WHERE dat_tiec_id = ? AND id_nv = ?', [idTiec, idNv || 0]);
  const vt = ns.map((x) => x.vai_tro);
  const bp = (hoSo || {}).ma_bp;
  const giamSat = q.dieuHanh || q.nhom.includes('GIAM_SAT_PV');
  const truongTiec = vt.includes('truong_tiec');
  return {
    xem: q.dieuHanh || q.truongBp || vt.length > 0,
    goiDot: giamSat || truongTiec,
    raMon: q.dieuHanh || q.nhom.includes('BEP_QUAN_LY') || bp === 'BEP',
    lenBan: giamSat || truongTiec || bp === 'PV',
    khaiTiec: giamSat || truongTiec,
    duyet: giamSat,
    xuLy: (boPhan) => giamSat || truongTiec || (['BEP', 'BAR'].includes(boPhan) && ['BEP', 'BAR'].includes(bp)) || (boPhan === 'PV' && bp === 'PV'),
    dieuHanh: q.dieuHanh,
  };
}
function chiTrongNgay(t) {
  const now = new Date();
  const hn = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (!dh.DANG_CHAY_TIEC.includes(t.trang_thai)) throw new Loi('Tiệc không còn đang vận hành.');
  if (t.ngay > hn) throw new Loi('Chỉ thao tác trong ngày diễn ra tiệc.');
}

// -------------------------------------------------------------- len mon theo dot
async function damBaoDot(t) {
  await damBaoCauTruc();
  const [[c]] = await db.query('SELECT COUNT(*) n FROM tiec_len_mon WHERE dat_tiec_id = ?', [t.id]);
  if (Number(c.n)) return;
  const tc = docJson(t.thuc_don_tuy_chinh, null);
  const bo = new Set((tc && tc.bo_mon) || []);
  const nhom = [];
  const them = (ten, mon) => { let g = nhom.find((x) => x.ten === ten); if (!g) nhom.push(g = { ten, mon: [] }); g.mon.push(mon); };
  for (const m of docJson(t.mon_thuc_don, [])) if (!bo.has(m.ten)) them(m.nhom || 'Món tiệc', { ten: m.ten });
  const monThem = (tc && Array.isArray(tc.them_mon)) ? tc.them_mon : [];
  if (monThem.length) {
    const [ls] = await db.query(
      'SELECT m.id_mon, l.name_loai FROM monan m JOIN loai_mon l ON l.id_loai = m.id_loai WHERE m.id_mon IN (?)', [monThem.map((x) => x.id_mon)]);
    for (const x of monThem) {
      const loai = (ls.find((l) => Number(l.id_mon) === Number(x.id_mon)) || {}).name_loai || '';
      if (/DRINK|SAKE|BEER/i.test(loai)) continue; // do uong: bar phuc vu xuyen tiec, khong chia dot
      them(tc.tu_chon ? (String(loai).replace(/^\d+\.\s*/, '') || 'Món tự chọn') : 'Món thêm', { ten: x.ten, sl: x.so_phan });
    }
  }
  if (!nhom.length) nhom.push({ ten: 'Món tiệc', mon: [] });
  let i = 1;
  for (const g of nhom) {
    await db.query('INSERT IGNORE INTO tiec_len_mon (dat_tiec_id, thu_tu, ten_dot, mon) VALUES (?, ?, ?, ?)', [t.id, i++, g.ten.slice(0, 100), JSON.stringify(g.mon)]);
  }
}

async function capNhatDot(idDot, buoc, ngu) {
  await damBaoCauTruc();
  const [[d]] = await db.query('SELECT * FROM tiec_len_mon WHERE id = ?', [idDot]);
  if (!d) throw new Loi('Không tìm thấy đợt món.', 404);
  const t = await docTiec(d.dat_tiec_id);
  chiTrongNgay(t);
  const qy = await quyenTrongTiec(t.id, ngu);
  const tb = require('./thongBaoService');
  const link = `/staff/tiec/${t.id}#trong-tiec`;
  if (buoc === 'goi') {
    if (!qy.goiDot) throw new Loi('Chỉ Giám sát phục vụ, Trưởng tiệc hoặc Quản lý gọi món.', 403);
    if (d.trang_thai !== 'cho') throw new Loi('Đợt này đã được gọi.');
    if (!t.bat_dau_thuc_te) {
      await db.query('UPDATE dat_tiec SET bat_dau_thuc_te = NOW() WHERE id = ? AND bat_dau_thuc_te IS NULL', [t.id]);
      await ghi(t.id, 'khai_tiec', 'Khai tiệc (tự ghi khi gọi đợt món đầu tiên)', ngu.idNv);
    }
    await db.query("UPDATE tiec_len_mon SET trang_thai = 'da_goi', goi_luc = NOW(), nguoi_goi = ? WHERE id = ?", [ngu.idNv, d.id]);
    await ghi(t.id, 'goi_mon', `Gọi đợt ${d.thu_tu}: ${d.ten_dot}`, ngu.idNv);
    const [bep] = await db.query("SELECT id_nv FROM tiec_nhan_su WHERE dat_tiec_id = ? AND vai_tro = 'bep'", [t.id]);
    const mon = docJson(d.mon, []).map((m) => m.ten + (m.sl > 1 ? ` ×${m.sl}` : '')).join(', ');
    await tb.gui('tiec_goi_mon', {
      nv: bep.map((x) => x.id_nv), tieuDe: `Tiệc ${t.ma_tiec}: gọi đợt ${d.thu_tu} – ${d.ten_dot} (${t.so_ban} bàn)`,
      noiDung: mon || d.ten_dot, link: '/staff/tiec#bep-tiec', mucDo: 'khan', truNv: ngu.idNv,
    });
  } else if (buoc === 'ra') {
    if (!qy.raMon) throw new Loi('Chỉ bếp xác nhận đã ra món.', 403);
    if (d.trang_thai !== 'da_goi') throw new Loi('Đợt này chưa được gọi hoặc đã ra món.');
    await db.query("UPDATE tiec_len_mon SET trang_thai = 'da_ra', ra_luc = NOW(), nguoi_ra = ? WHERE id = ?", [ngu.idNv, d.id]);
    const phut = Math.round((Date.now() - new Date(d.goi_luc)) / 60000);
    await ghi(t.id, 'ra_mon', `Bếp ra đợt ${d.thu_tu}: ${d.ten_dot} (sau ${phut} phút)`, ngu.idNv);
    const [pv] = await db.query("SELECT id_nv FROM tiec_nhan_su WHERE dat_tiec_id = ? AND vai_tro IN ('truong_tiec','phuc_vu')", [t.id]);
    await tb.gui('tiec_ra_mon', { nv: pv.map((x) => x.id_nv), tieuDe: `Tiệc ${t.ma_tiec}: đợt ${d.thu_tu} – ${d.ten_dot} đã ra, mang lên bàn`, link, mucDo: 'khan', truNv: ngu.idNv });
  } else if (buoc === 'len') {
    if (!qy.lenBan) throw new Loi('Chỉ phục vụ của tiệc xác nhận đã lên bàn.', 403);
    if (d.trang_thai !== 'da_ra') throw new Loi('Bếp chưa ra đợt này.');
    await db.query("UPDATE tiec_len_mon SET trang_thai = 'da_len', len_luc = NOW(), nguoi_len = ? WHERE id = ?", [ngu.idNv, d.id]);
    await ghi(t.id, 'len_ban', `Đã lên bàn đợt ${d.thu_tu}: ${d.ten_dot}`, ngu.idNv);
  } else throw new Loi('Bước không hợp lệ.');
  return { ok: true };
}

// ------------------------------------------------------------- khai / ket thuc
async function khaiTiec(idTiec, hanhDong, ngu) {
  await damBaoCauTruc();
  const t = await docTiec(idTiec);
  if (!t) throw new Loi('Không tìm thấy tiệc.', 404);
  chiTrongNgay(t);
  const qy = await quyenTrongTiec(idTiec, ngu);
  if (!qy.khaiTiec) throw new Loi('Chỉ Giám sát phục vụ, Trưởng tiệc hoặc Quản lý.', 403);
  if (hanhDong === 'bat_dau') {
    if (t.bat_dau_thuc_te) throw new Loi('Tiệc đã khai tiệc.');
    await db.query('UPDATE dat_tiec SET bat_dau_thuc_te = NOW() WHERE id = ?', [idTiec]);
    await ghi(idTiec, 'khai_tiec', 'Khai tiệc', ngu.idNv);
  } else if (hanhDong === 'ket_thuc') {
    if (!t.bat_dau_thuc_te) throw new Loi('Tiệc chưa khai tiệc.');
    if (t.ket_thuc_thuc_te) throw new Loi('Tiệc đã kết thúc.');
    const [[mo]] = await db.query("SELECT COUNT(*) n FROM tiec_phat_sinh WHERE dat_tiec_id = ? AND trang_thai IN ('moi','dang_xu_ly') AND muc_do = 'khan'", [idTiec]);
    if (Number(mo.n)) throw new Loi('Còn phát sinh khẩn chưa xử lý.');
    await db.query('UPDATE dat_tiec SET ket_thuc_thuc_te = NOW() WHERE id = ?', [idTiec]);
    // Ket thuc som: mo viec "Sau tiec" ngay, han tinh lai tu bay gio.
    await db.query(`UPDATE tiec_viec SET mo_luc = NOW(), han = LEAST(han, NOW() + INTERVAL TIMESTAMPDIFF(MINUTE, mo_luc, han) MINUTE)
                     WHERE dat_tiec_id = ? AND moc = 'Sau tiệc' AND mo_luc > NOW()`, [idTiec]);
    await ghi(idTiec, 'ket_thuc', 'Kết thúc tiệc', ngu.idNv);
    await require('./thongBaoService').gui('tiec_can_chot', {
      tieuDe: `Tiệc ${t.ma_tiec} đã kết thúc – cần chốt hóa đơn`, noiDung: `${t.ho_ten} · ${t.so_khach} khách.`, link: `/staff/tiec/${idTiec}#chot`, truNv: ngu.idNv,
    });
  } else throw new Loi('Hành động không hợp lệ.');
  return { ok: true };
}

// ------------------------------------------------------------------ ban tinh tien
async function banTinhTien(t) {
  const [[c]] = await db.query("SELECT du_lieu FROM tiec_viec WHERE dat_tiec_id = ? AND ma_viec = 'chot_so_khach' AND trang_thai = 'xong'", [t.id]);
  const chot = c ? docJson(c.du_lieu, {}) : {};
  const banChot = Number(chot.so_ban) || Number(t.so_ban);
  const [ps] = await db.query("SELECT loai, so_ban FROM tiec_phat_sinh WHERE dat_tiec_id = ? AND loai IN ('them_ban','bot_ban') AND duyet = 'da_duyet'", [t.id]);
  const them = ps.filter((x) => x.loai === 'them_ban').reduce((s, x) => s + Number(x.so_ban || 0), 0);
  const bot = ps.filter((x) => x.loai === 'bot_ban').reduce((s, x) => s + Number(x.so_ban || 0), 0);
  const ch = await require('./datTiecQuyTrinh').cauHinh();
  const botToiDa = Math.floor(banChot * (Number(ch.dao_dong_so_khach_phan_tram) || 10) / 100);
  const [[tien]] = await db.query("SELECT COALESCE(SUM(so_tien),0) s FROM tiec_phat_sinh WHERE dat_tiec_id = ? AND tinh_tien = 1 AND duyet = 'da_duyet'", [t.id]);
  return { ban_chot: banChot, them, bot, tinh: banChot + them - bot, bot_toi_da: botToiDa, tien_phat_sinh: Number(tien.s) };
}
function giaMotBan(t) {
  if (t.thuc_don_id && Number(t.gia_ban)) return Number(t.gia_ban);
  return Number(t.so_ban) ? Math.round((Number(t.tien_thuc_don) + Number(t.tien_dieu_chinh || 0)) / Number(t.so_ban)) : 0;
}

// ------------------------------------------------------------------ phat sinh
async function baoPhatSinh(idTiec, body, ngu) {
  await damBaoCauTruc();
  const t = await docTiec(idTiec);
  if (!t) throw new Loi('Không tìm thấy tiệc.', 404);
  chiTrongNgay(t);
  const qy = await quyenTrongTiec(idTiec, ngu);
  if (!qy.xem) throw new Loi('Bạn không thuộc nhân sự của tiệc này.', 403);
  const loai = LOAI_PS[body.loai] ? body.loai : null;
  if (!loai) throw new Loi('Chọn loại phát sinh.');
  const L = LOAI_PS[loai];
  const moTa = String(body.mo_ta || '').trim().slice(0, 1000);
  let mucDo = MUC_DO[body.muc_do] ? body.muc_do : L.mucDo;
  if (loai === 'y_te') mucDo = 'khan';
  let chiTiet = null, soBan = null, soTien = 0, tinhTien = 0, boPhan = L.boPhan;

  if (loai === 'them_mon') {
    const ds = (Array.isArray(body.mon) ? body.mon : []).slice(0, 30).map((x) => ({ id_mon: Number(x.id_mon), sl: Math.min(500, Math.max(1, Math.floor(Number(x.sl) || 1))) })).filter((x) => x.id_mon);
    if (!ds.length) throw new Loi('Chọn món cần thêm.');
    const [mon] = await db.query(
      'SELECT m.id_mon, m.name_mon, m.gia_mon, l.name_loai FROM monan m JOIN loai_mon l ON l.id_loai = m.id_loai WHERE m.id_mon IN (?) AND m.tinhtrang = 1', [ds.map((x) => x.id_mon)]);
    chiTiet = ds.map((x) => { const m = mon.find((y) => Number(y.id_mon) === x.id_mon); return m ? { id_mon: x.id_mon, ten: String(m.name_mon).trim(), gia: Number(m.gia_mon), sl: x.sl, uong: /DRINK|SAKE|BEER/i.test(m.name_loai || '') } : null; }).filter(Boolean);
    if (!chiTiet.length) throw new Loi('Món đã chọn không còn bán.');
    soTien = chiTiet.reduce((s, x) => s + x.gia * x.sl, 0);
    tinhTien = 1;
    boPhan = chiTiet.every((x) => x.uong) ? 'BAR' : 'BEP';
  } else if (loai === 'them_ban' || loai === 'bot_ban') {
    soBan = Math.floor(Number(body.so_ban));
    if (!(soBan >= 1 && soBan <= 30)) throw new Loi('Số bàn không hợp lệ.');
    const b = await banTinhTien(t);
    if (loai === 'bot_ban' && b.bot + soBan > b.bot_toi_da) throw new Loi(`Theo chính sách chỉ được bớt tối đa ${b.bot_toi_da} bàn (đã bớt ${b.bot}). Bàn đã chuẩn bị vẫn tính tiền.`);
    soTien = (loai === 'bot_ban' ? -1 : 1) * soBan * giaMotBan(t);
    tinhTien = 1;
  } else if (L.tinhTien === 'tuy_chon' && body.tinh_tien) {
    soTien = Math.round(Number(body.so_tien));
    if (!(soTien > 0)) throw new Loi('Nhập số tiền tính cho khách.');
    tinhTien = 1;
  }
  if (!moTa && !['them_mon', 'them_ban', 'bot_ban'].includes(loai)) throw new Loi('Mô tả phát sinh.');
  let anh = null;
  if (body.anh) anh = luuAnh(body.anh, t.ma_tiec);
  const duyet = tinhTien ? 'cho' : 'khong_can';
  const [kq] = await db.query(
    `INSERT INTO tiec_phat_sinh (dat_tiec_id, loai, muc_do, mo_ta, anh, chi_tiet, so_ban, tinh_tien, so_tien, duyet, trang_thai, bo_phan, nguoi_bao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'moi', ?, ?)`,
    [idTiec, loai, mucDo, moTa || null, anh, chiTiet ? JSON.stringify(chiTiet) : null, soBan, tinhTien, soTien, duyet, boPhan, ngu.idNv]);
  const tom = tomTat({ loai, chi_tiet: chiTiet, so_ban: soBan, mo_ta: moTa });
  await ghi(idTiec, 'phat_sinh', `Báo phát sinh: ${tom}${tinhTien ? ` (${vnd(soTien)}, chờ duyệt)` : ''}`, ngu.idNv);
  await require('./thongBaoService').gui('tiec_phat_sinh', {
    tieuDe: `${mucDo === 'khan' ? 'KHẨN – ' : ''}Tiệc ${t.ma_tiec}: ${L.ten}${tinhTien ? ' (cần duyệt)' : ''}`,
    noiDung: tom + (tinhTien ? `\nTính khách ${vnd(soTien)}` : ''), link: `/staff/tiec/${idTiec}#trong-tiec`,
    mucDo: mucDo === 'khan' ? 'khan' : mucDo === 'gap' ? 'quan_trong' : 'tin', truNv: ngu.idNv,
  });
  return { ok: true, id: kq.insertId, can_duyet: !!tinhTien };
}

function tomTat(p) {
  const L = LOAI_PS[p.loai] || { ten: p.loai };
  const ct = docJson(p.chi_tiet, null);
  if (p.loai === 'them_mon' && ct) return `${L.ten}: ${ct.map((x) => `${x.ten} ×${x.sl}`).join(', ')}`;
  if (p.loai === 'them_ban' || p.loai === 'bot_ban') return `${L.ten} ${p.so_ban} bàn${p.mo_ta ? ` – ${p.mo_ta}` : ''}`;
  return `${L.ten}${p.mo_ta ? `: ${p.mo_ta}` : ''}`;
}

function luuAnh(dataUrl, ma) {
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw new Loi('Ảnh phải là JPG, PNG hoặc WEBP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw new Loi('Ảnh tối đa 4MB.');
  const fs = require('fs'), path = require('path');
  const thuMuc = path.join(__dirname, '..', 'public', 'uploads', 'tiec');
  fs.mkdirSync(thuMuc, { recursive: true });
  const ten = `${String(ma).replace(/[^\w-]/g, '')}-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(thuMuc, ten), buf);
  return `/uploads/tiec/${ten}`;
}

/** Duyet / tu choi (phat sinh tinh tien) hoac doi trang thai xu ly. */
async function capNhatPhatSinh(idPs, body, ngu) {
  await damBaoCauTruc();
  const [[p]] = await db.query('SELECT * FROM tiec_phat_sinh WHERE id = ?', [idPs]);
  if (!p) throw new Loi('Không tìm thấy phát sinh.', 404);
  const t = await docTiec(p.dat_tiec_id);
  chiTrongNgay(t);
  const qy = await quyenTrongTiec(t.id, ngu);
  const tb = require('./thongBaoService');
  const link = `/staff/tiec/${t.id}#trong-tiec`;
  const hd = body.hanh_dong;
  const ketQua = String(body.ket_qua || '').trim().slice(0, 500) || null;
  const tom = tomTat(p);
  if (hd === 'duyet' || hd === 'tu_choi') {
    if (!qy.duyet) throw new Loi('Chỉ Giám sát phục vụ hoặc Quản lý duyệt phát sinh tính tiền.', 403);
    if (p.duyet !== 'cho') throw new Loi('Phát sinh này không chờ duyệt.');
    if (hd === 'tu_choi' && !ketQua) throw new Loi('Ghi lý do từ chối.');
    if (hd === 'duyet' && p.loai === 'bot_ban') {
      const b = await banTinhTien(t);
      if (b.bot + Number(p.so_ban) > b.bot_toi_da) throw new Loi(`Vượt mức bớt tối đa ${b.bot_toi_da} bàn theo chính sách.`);
    }
    await db.query(`UPDATE tiec_phat_sinh SET duyet = ?, nguoi_duyet = ?, duyet_luc = NOW()${hd === 'tu_choi' ? ", trang_thai = 'tu_choi', ket_qua = ?" : ", trang_thai = IF(trang_thai = 'moi', 'dang_xu_ly', trang_thai)"} WHERE id = ?`,
      hd === 'tu_choi' ? ['tu_choi', ngu.idNv, ketQua, p.id] : ['da_duyet', ngu.idNv, p.id]);
    await ghi(t.id, 'duyet', `${hd === 'duyet' ? 'Duyệt' : 'Từ chối'} phát sinh: ${tom} (${vnd(p.so_tien)})${ketQua ? ` – ${ketQua}` : ''}`, ngu.idNv);
    const nhan = p.nguoi_bao ? [p.nguoi_bao] : [];
    if (hd === 'duyet' && p.loai === 'them_mon') {
      const [bep] = await db.query('SELECT id_nv FROM tiec_nhan_su WHERE dat_tiec_id = ? AND vai_tro = ?', [t.id, p.bo_phan === 'BAR' ? 'bar' : 'bep']);
      bep.forEach((x) => nhan.push(x.id_nv));
      await tb.gui('tiec_goi_mon', { nv: nhan, nhom: p.bo_phan === 'BAR' ? ['BAR'] : ['BEP_QUAN_LY'], tieuDe: `Tiệc ${t.ma_tiec}: phát sinh món đã duyệt – làm ngay`, noiDung: tom, link: '/staff/tiec#bep-tiec', mucDo: 'khan', truNv: ngu.idNv });
    } else {
      await tb.gui('tiec_phat_sinh_kq', { nv: nhan, tieuDe: `Phát sinh tiệc ${t.ma_tiec} ${hd === 'duyet' ? 'đã được duyệt' : 'bị từ chối'}`, noiDung: tom + (ketQua ? `\n${ketQua}` : ''), link, truNv: ngu.idNv });
    }
    return { ok: true };
  }
  if (hd === 'dang_xu_ly' || hd === 'da_xu_ly') {
    if (!qy.xuLy(p.bo_phan)) throw new Loi('Bạn không phụ trách xử lý phát sinh này.', 403);
    if (p.duyet === 'cho') throw new Loi('Phát sinh tính tiền cần được duyệt trước.');
    if (['da_xu_ly', 'tu_choi'].includes(p.trang_thai)) throw new Loi('Phát sinh đã đóng.');
    if (hd === 'da_xu_ly' && !ketQua && !['them_mon', 'them_ban', 'bot_ban'].includes(p.loai)) throw new Loi('Ghi kết quả xử lý.');
    await db.query(`UPDATE tiec_phat_sinh SET trang_thai = ?, nguoi_xu_ly = ?, xu_ly_luc = ${hd === 'da_xu_ly' ? 'NOW()' : 'NULL'}, ket_qua = COALESCE(?, ket_qua) WHERE id = ?`, [hd, ngu.idNv, ketQua, p.id]);
    await ghi(t.id, 'xu_ly', `${hd === 'da_xu_ly' ? 'Đã xử lý' : 'Đang xử lý'}: ${tom}${ketQua ? ` – ${ketQua}` : ''}`, ngu.idNv);
    if (hd === 'da_xu_ly' && p.nguoi_bao && Number(p.nguoi_bao) !== Number(ngu.idNv)) {
      await tb.gui('tiec_phat_sinh_kq', { nv: [p.nguoi_bao], tieuDe: `Phát sinh tiệc ${t.ma_tiec} đã xử lý xong`, noiDung: tom + (ketQua ? `\n${ketQua}` : ''), link });
    }
    return { ok: true };
  }
  throw new Loi('Hành động không hợp lệ.');
}

// ------------------------------------------------------------------ doc tab trong tiec
async function trongTiec(idTiec, ngu) {
  await damBaoCauTruc();
  const t = await docTiec(idTiec);
  if (!t) return null;
  if (dh.DANG_CHAY_TIEC.includes(t.trang_thai) || t.trang_thai === 'HOAN_THANH') await damBaoDot(t);
  const qy = await quyenTrongTiec(idTiec, ngu);
  const [dot] = await db.query(
    `SELECT d.*, g.ten AS ten_goi, r.ten AS ten_ra, l.ten AS ten_len FROM tiec_len_mon d
       LEFT JOIN nhan_vien g ON g.id_nv = d.nguoi_goi LEFT JOIN nhan_vien r ON r.id_nv = d.nguoi_ra LEFT JOIN nhan_vien l ON l.id_nv = d.nguoi_len
      WHERE d.dat_tiec_id = ? ORDER BY d.thu_tu`, [idTiec]);
  const [ps] = await db.query(
    `SELECT p.*, b.ten AS ten_bao, du.ten AS ten_duyet, x.ten AS ten_xu_ly FROM tiec_phat_sinh p
       LEFT JOIN nhan_vien b ON b.id_nv = p.nguoi_bao LEFT JOIN nhan_vien du ON du.id_nv = p.nguoi_duyet LEFT JOIN nhan_vien x ON x.id_nv = p.nguoi_xu_ly
      WHERE p.dat_tiec_id = ? ORDER BY FIELD(p.trang_thai,'moi','dang_xu_ly','da_xu_ly','tu_choi'), FIELD(p.muc_do,'khan','gap','thuong'), p.id DESC`, [idTiec]);
  const [nk] = await db.query(
    'SELECT k.*, n.ten FROM tiec_nhat_ky k LEFT JOIN nhan_vien n ON n.id_nv = k.id_nv WHERE k.dat_tiec_id = ? ORDER BY k.luc DESC, k.id DESC LIMIT 200', [idTiec]);
  const [monLe] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, l.name_loai FROM monan m JOIN loai_mon l ON l.id_loai = m.id_loai
      WHERE m.tinhtrang = 1 AND l.name_loai NOT LIKE '%Test%' ORDER BY l.name_loai, m.name_mon`);
  const [[pb]] = await db.query(
    `SELECT GREATEST(COALESCE((SELECT MAX(luc) FROM tiec_nhat_ky WHERE dat_tiec_id = ?), '2000-01-01'), COALESCE((SELECT MAX(created_at) FROM tiec_phat_sinh WHERE dat_tiec_id = ?), '2000-01-01')) AS v`, [idTiec, idTiec]);
  return {
    dot: dot.map((d) => ({ ...d, mon: docJson(d.mon, []) })),
    phatSinh: ps.map((p) => ({ ...p, chi_tiet: docJson(p.chi_tiet, null), tom_tat: tomTat(p), xu_ly_duoc: qy.xuLy(p.bo_phan) })),
    nhatKy: nk, ban: await banTinhTien(t), giaMotBan: giaMotBan(t),
    monLe: monLe.map((m) => ({ id: m.id_mon, ten: String(m.name_mon).trim(), gia: Number(m.gia_mon), loai: String(m.name_loai || '').replace(/^\d+\.\s*/, '') })),
    quyenTT: { ...qy, xuLy: undefined },
    batDau: t.bat_dau_thuc_te, ketThuc: t.ket_thuc_thuc_te,
    phienBan: pb && pb.v ? new Date(pb.v).getTime() : 0,
    LOAI_PS, MUC_DO, TT_PS, TT_DOT,
  };
}

/** Cho bep: dot dang goi + phat sinh mon da duyet chua xong, cac tiec trong ngay. */
async function viecBep(idTiecDuocXem) {
  await damBaoCauTruc();
  if (!idTiecDuocXem.length) return { dot: [], mon: [] };
  const [dot] = await db.query(
    `SELECT d.*, t.ma_tiec, t.so_ban, TIME_FORMAT(t.gio_bat_dau, '%H:%i') gio FROM tiec_len_mon d JOIN dat_tiec t ON t.id = d.dat_tiec_id
      WHERE d.trang_thai = 'da_goi' AND d.dat_tiec_id IN (?) ORDER BY d.goi_luc`, [idTiecDuocXem]);
  const [mon] = await db.query(
    `SELECT p.*, t.ma_tiec FROM tiec_phat_sinh p JOIN dat_tiec t ON t.id = p.dat_tiec_id
      WHERE p.loai = 'them_mon' AND p.duyet = 'da_duyet' AND p.trang_thai IN ('moi','dang_xu_ly') AND p.dat_tiec_id IN (?) ORDER BY p.duyet_luc`, [idTiecDuocXem]);
  return { dot: dot.map((d) => ({ ...d, mon: docJson(d.mon, []) })), mon: mon.map((p) => ({ ...p, tom_tat: tomTat(p) })) };
}

/** So phat sinh dang mo theo tiec (cho the tiec tren bang tong hop). */
async function demPhatSinhMo(ids) {
  await damBaoCauTruc();
  if (!ids.length) return new Map();
  const [r] = await db.query(
    `SELECT dat_tiec_id, COUNT(*) n, SUM(muc_do = 'khan') khan, SUM(duyet = 'cho') cho_duyet FROM tiec_phat_sinh
      WHERE dat_tiec_id IN (?) AND trang_thai IN ('moi','dang_xu_ly') GROUP BY dat_tiec_id`, [ids]);
  return new Map(r.map((x) => [x.dat_tiec_id, { n: Number(x.n), khan: Number(x.khan), cho_duyet: Number(x.cho_duyet) }]));
}

module.exports = { damBaoCauTruc, trongTiec, capNhatDot, khaiTiec, baoPhatSinh, capNhatPhatSinh, viecBep, demPhatSinhMo, banTinhTien, LOAI_PS, MUC_DO, TT_PS, TT_DOT };

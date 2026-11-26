/**
 * DIEU HANH TIEC - Dot 3: CHOT HOA DON + BAO CAO SAU TIEC.
 *
 * Hoa don chot (dien san, Quan ly / Thu ngan xac nhan):
 *   thuc don   = gia 1 ban x ban tinh (ban chot +/- phat sinh them / bot ban da duyet)
 *   mon them   = (tien_dieu_chinh / so ban dat) x ban tinh   (thuc don tu chon / tuy chinh)
 *   dich vu    = tinh lai: theo BAN x ban tinh, theo KHACH x khach chot, theo GOI giu nguyen
 *   phat sinh  = phat sinh tinh tien DA DUYET (tru them / bot ban - da nam trong ban tinh)
 *   - giam tru (bat buoc ly do)
 * Chot -> datTiecService.capNhatTrangThai(CHO_THANH_TOAN) -> khach thanh toan phan con lai
 * online (link) hoac tai quay. Chi tiet luu dat_tiec.hoa_don_chot de khach xem.
 */
const db = require('../config/db');
const dh = require('./dieuHanhTiecService');
const tt = require('./tiecTrongTiecService');

const docJson = (v, md) => { if (v == null) return md; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (_) { return md; } };
class Loi extends dh.LoiDieuHanh {}

let daTao = false;
async function damBaoCauTruc() {
  if (daTao) return;
  await tt.damBaoCauTruc();
  const [c] = await db.query("SHOW COLUMNS FROM dat_tiec LIKE 'hoa_don_chot'");
  if (!c.length) await db.query("ALTER TABLE dat_tiec ADD COLUMN hoa_don_chot JSON NULL COMMENT 'Chi tiet hoa don chot sau tiec'");
  await db.query(`CREATE TABLE IF NOT EXISTS tiec_danh_gia (
    dat_tiec_id INT PRIMARY KEY, diem TINYINT NOT NULL, nhan_xet VARCHAR(1000) NULL, id_nv INT NULL,
    luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTao = true;
}

async function docTiec(id) {
  const [[t]] = await db.query(
    `SELECT t.*, DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') AS ngay, TIME_FORMAT(t.gio_bat_dau, '%H:%i') AS gio, d.gia_ban, d.ten AS ten_thuc_don
       FROM dat_tiec t LEFT JOIN thuc_don_tiec d ON d.id = t.thuc_don_id WHERE t.id = ?`, [id]);
  return t || null;
}

function quyenChot({ phien, hoSo }) {
  const q = dh.nhomCua(phien, hoSo);
  return { chot: q.dieuHanh || (hoSo || {}).ma_bp === 'TN', danhGia: q.dieuHanh || q.nhom.includes('GIAM_SAT_PV'), xem: q.dieuHanh || q.truongBp };
}

/** Tinh hoa don chot (chua luu). */
async function tinhHoaDon(t, giamTru = 0) {
  const b = await tt.banTinhTien(t);
  const [[c]] = await db.query("SELECT du_lieu FROM tiec_viec WHERE dat_tiec_id = ? AND ma_viec = 'chot_so_khach' AND trang_thai = 'xong'", [t.id]);
  const khachChot = Number((c && docJson(c.du_lieu, {}).so_khach) || t.so_khach);
  const soBanDat = Number(t.so_ban) || 1;
  const dong = [];
  if (t.thuc_don_id && Number(t.gia_ban)) {
    dong.push({ nhom: 'thuc_don', ten: `${t.ten_thuc_don} – ${b.tinh} bàn × ${Number(t.gia_ban).toLocaleString('vi-VN')}đ`, tien: Number(t.gia_ban) * b.tinh });
  }
  if (Number(t.tien_dieu_chinh)) {
    const motBan = Number(t.tien_dieu_chinh) / soBanDat;
    dong.push({ nhom: 'thuc_don', ten: `${t.thuc_don_id ? 'Món thêm theo yêu cầu' : 'Thực đơn tự chọn'} – ${b.tinh} bàn × ${Math.round(motBan).toLocaleString('vi-VN')}đ`, tien: Math.round(motBan * b.tinh) });
  }
  for (const d of docJson(t.dich_vu, [])) {
    const sl = d.don_vi === 'BAN' ? b.tinh : d.don_vi === 'KHACH' ? khachChot : Number(d.so_luong) || 1;
    dong.push({ nhom: 'dich_vu', ten: `${d.ten}${d.don_vi === 'GOI' ? '' : ` – ${sl} ${d.don_vi === 'BAN' ? 'bàn' : 'khách'} × ${Number(d.don_gia).toLocaleString('vi-VN')}đ`}`, tien: Number(d.don_gia) * sl });
  }
  const [ps] = await db.query(
    "SELECT * FROM tiec_phat_sinh WHERE dat_tiec_id = ? AND tinh_tien = 1 AND duyet = 'da_duyet' AND loai NOT IN ('them_ban','bot_ban') ORDER BY id", [t.id]);
  for (const p of ps) {
    const ct = docJson(p.chi_tiet, null);
    const ten = p.loai === 'them_mon' && ct ? `Phát sinh: ${ct.map((x) => `${x.ten} ×${x.sl}`).join(', ')}` : `Phát sinh: ${(tt.LOAI_PS[p.loai] || {}).ten || p.loai}${p.mo_ta ? ` – ${p.mo_ta}` : ''}`;
    dong.push({ nhom: 'phat_sinh', ten, tien: Number(p.so_tien), id_ps: p.id });
  }
  const giam = Math.max(0, Math.round(Number(giamTru) || 0));
  const tamTinh = dong.reduce((s, x) => s + x.tien, 0);
  const [[choDuyet]] = await db.query("SELECT COUNT(*) n FROM tiec_phat_sinh WHERE dat_tiec_id = ? AND duyet = 'cho'", [t.id]);
  return {
    dong, tam_tinh: Math.round(tamTinh), giam_tru: giam, tong: Math.max(0, Math.round(tamTinh - giam)),
    ban: b, khach_chot: khachChot, da_thu: Number(t.da_thu) || 0, du_toan: Number(t.tong_du_toan) || 0,
    cho_duyet: Number(choDuyet.n),
  };
}

function lyDoChuaChot(t, hd) {
  if (t.hoa_don_chot || ['CHO_THANH_TOAN', 'HOAN_THANH'].includes(t.trang_thai)) return 'Tiệc đã chốt hóa đơn.';
  if (!['DA_COC', 'DA_XAC_NHAN'].includes(t.trang_thai)) return 'Tiệc không ở trạng thái chốt được.';
  const p = dh.pha({ ...t, ngay: t.ngay, gio: t.gio });
  if (p.ma !== 'da_ket_thuc') return 'Tiệc chưa kết thúc (bấm "Kết thúc tiệc" ở tab Trong tiệc hoặc chờ hết giờ).';
  if (hd.cho_duyet) return `Còn ${hd.cho_duyet} phát sinh tính tiền chờ duyệt.`;
  return null;
}

async function chot(idTiec, body, ngu) {
  await damBaoCauTruc();
  const t = await docTiec(idTiec);
  if (!t) throw new Loi('Không tìm thấy tiệc.', 404);
  if (!quyenChot(ngu).chot) throw new Loi('Chỉ Quản lý hoặc Thu ngân chốt hóa đơn tiệc.', 403);
  const giam = Math.max(0, Math.round(Number(body.giam_tru) || 0));
  const lyDoGiam = String(body.ly_do_giam || '').trim().slice(0, 300);
  if (giam && !lyDoGiam) throw new Loi('Ghi lý do giảm trừ.');
  const hd = await tinhHoaDon(t, giam);
  const lyDo = lyDoChuaChot(t, hd);
  if (lyDo) throw new Loi(lyDo);
  if (giam > hd.tam_tinh) throw new Loi('Giảm trừ lớn hơn tạm tính.');
  if (hd.tong < hd.da_thu) throw new Loi(`Tổng chốt (${hd.tong.toLocaleString('vi-VN')}đ) nhỏ hơn số đã thu (${hd.da_thu.toLocaleString('vi-VN')}đ) – cần hoàn chênh lệch cho khách trước.`);
  const luu = { ...hd, ly_do_giam: lyDoGiam || null, chot_luc: new Date(), id_nv: ngu.idNv };
  await db.query('UPDATE dat_tiec SET hoa_don_chot = ?, ket_thuc_thuc_te = COALESCE(ket_thuc_thuc_te, NOW()) WHERE id = ?', [JSON.stringify(luu), idTiec]);
  const ps = require('./phanQuyenService');
  const phien = ngu.phien || {};
  try {
    await require('./datTiecService').capNhatTrangThai(idTiec, { trangThai: 'CHO_THANH_TOAN', tongThucTe: hd.tong, soKhachThucTe: hd.khach_chot }, {
      id: ngu.idNv, laQuanLy: dh.nhomCua(phien, ngu.hoSo).dieuHanh,
      coQuyenThuTien: !!(phien.adminlogin || ['Quay', 'letan', 'Thu ngan', 'Quan ly'].includes(phien.staffRole) || ps.dongVaiDuoc(ngu.hoSo, ['Thu ngan', 'Quan ly'])),
    });
  } catch (e) {
    await db.query('UPDATE dat_tiec SET hoa_don_chot = NULL WHERE id = ?', [idTiec]);
    throw new Loi(e.message);
  }
  await db.query('INSERT INTO tiec_nhat_ky (dat_tiec_id, loai, noi_dung, id_nv) VALUES (?, ?, ?, ?)',
    [idTiec, 'chot', `Chốt hóa đơn ${hd.tong.toLocaleString('vi-VN')}đ (${hd.ban.tinh} bàn${giam ? `, giảm ${giam.toLocaleString('vi-VN')}đ: ${lyDoGiam}` : ''}) – còn thu ${(hd.tong - hd.da_thu).toLocaleString('vi-VN')}đ`, ngu.idNv]);
  return { ok: true, tong: hd.tong, con_lai: hd.tong - hd.da_thu };
}

async function danhGia(idTiec, body, ngu) {
  await damBaoCauTruc();
  if (!quyenChot(ngu).danhGia) throw new Loi('Chỉ Quản lý hoặc Giám sát phục vụ đánh giá tiệc.', 403);
  const diem = Math.floor(Number(body.diem));
  if (!(diem >= 1 && diem <= 5)) throw new Loi('Chọn điểm 1–5.');
  const nx = String(body.nhan_xet || '').trim().slice(0, 1000) || null;
  await db.query('INSERT INTO tiec_danh_gia (dat_tiec_id, diem, nhan_xet, id_nv) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE diem = VALUES(diem), nhan_xet = VALUES(nhan_xet), id_nv = VALUES(id_nv)', [idTiec, diem, nx, ngu.idNv]);
  return { ok: true };
}

/** Du lieu tab "Chot & bao cao". */
async function tongHop(idTiec, ngu) {
  await damBaoCauTruc();
  const t = await docTiec(idTiec);
  if (!t) return null;
  const q = quyenChot(ngu);
  const daChot = docJson(t.hoa_don_chot, null);
  const hd = daChot || await tinhHoaDon(t);
  const lyDo = daChot ? null : lyDoChuaChot(t, hd);
  // ---- bao cao
  const { kt } = dh.khungGio(t);
  const [dot] = await db.query('SELECT thu_tu, ten_dot, goi_luc, ra_luc, len_luc FROM tiec_len_mon WHERE dat_tiec_id = ? ORDER BY thu_tu', [idTiec]);
  const [ps] = await db.query('SELECT loai, muc_do, tinh_tien, so_tien, duyet, trang_thai, created_at, xu_ly_luc FROM tiec_phat_sinh WHERE dat_tiec_id = ?', [idTiec]);
  const [vs] = await db.query('SELECT ma_viec, ten, moc, nhom, han, trang_thai, xong_luc FROM tiec_viec WHERE dat_tiec_id = ?', [idTiec]);
  const [[ns]] = await db.query('SELECT COUNT(*) n FROM tiec_nhan_su WHERE dat_tiec_id = ?', [idTiec]);
  const [[dg]] = await db.query('SELECT g.*, n.ten FROM tiec_danh_gia g LEFT JOIN nhan_vien n ON n.id_nv = g.id_nv WHERE g.dat_tiec_id = ?', [idTiec]);
  const phut = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null);
  const raMon = dot.map((d) => ({ ...d, phut_bep: phut(d.goi_luc, d.ra_luc), phut_len: phut(d.ra_luc, d.len_luc) }));
  const coPhut = raMon.filter((d) => d.phut_bep != null);
  const daXuLy = ps.filter((p) => p.xu_ly_luc);
  const theoLoai = {};
  for (const p of ps) { const k = p.loai; theoLoai[k] = theoLoai[k] || { n: 0, tien: 0 }; theoLoai[k].n++; if (p.tinh_tien && p.duyet === 'da_duyet') theoLoai[k].tien += Number(p.so_tien); }
  const viecTre = vs.filter((v) => (v.trang_thai === 'xong' && v.xong_luc && new Date(v.xong_luc) > new Date(v.han)) || (v.trang_thai !== 'xong' && new Date(v.han) < new Date()));
  const baoCao = {
    khach: { dat: Number(t.so_khach), chot: hd.khach_chot || Number(t.so_khach), ban_dat: Number(t.so_ban), ban_tinh: hd.ban ? hd.ban.tinh : Number(t.so_ban) },
    gio: { du_kien_bd: t.gio, bd: t.bat_dau_thuc_te, kt: t.ket_thuc_thuc_te, du_kien_kt: kt,
      tre_khai_phut: t.bat_dau_thuc_te ? Math.round((new Date(t.bat_dau_thuc_te) - new Date(`${t.ngay}T${t.gio}:00`)) / 60000) : null },
    len_mon: raMon, phut_bep_tb: coPhut.length ? Math.round(coPhut.reduce((s, d) => s + d.phut_bep, 0) / coPhut.length) : null,
    dot_cham: coPhut.length ? coPhut.reduce((a, d) => (d.phut_bep > a.phut_bep ? d : a)) : null,
    phat_sinh: { tong: ps.length, khan: ps.filter((p) => p.muc_do === 'khan').length, tien: ps.filter((p) => p.tinh_tien && p.duyet === 'da_duyet').reduce((s, p) => s + Number(p.so_tien), 0),
      phut_xu_ly_tb: daXuLy.length ? Math.round(daXuLy.reduce((s, p) => s + phut(p.created_at, p.xu_ly_luc), 0) / daXuLy.length) : null, theo_loai: theoLoai },
    viec: { tong: vs.length, xong: vs.filter((v) => v.trang_thai === 'xong').length, tre: viecTre.map((v) => ({ ten: v.ten, moc: v.moc, nhom: (dh.NHOM_VIEC[v.nhom] || {}).ten })), van_de: vs.filter((v) => v.trang_thai === 'van_de').length },
    nhan_su: Number(ns.n),
    tien: { du_toan: Number(t.tong_du_toan), chot: daChot ? daChot.tong : null, da_thu: Number(t.da_thu) },
  };
  return { hoaDon: hd, daChot: !!daChot, lyDoChuaChot: lyDo, quyenChot: q, baoCao, danhGia: dg || null, LOAI_PS: tt.LOAI_PS, trangThai: t.trang_thai, maTiec: t.ma_tiec, sdt: t.so_dien_thoai };
}

module.exports = { damBaoCauTruc, tinhHoaDon, chot, danhGia, tongHop };

/**
 * TIEC <-> VAN HANH: giu sanh trong he thong dat ban + ke hoach nguyen lieu.
 *
 * Truoc day dat tiec dung rieng: tiec da coc o Sanh Gala toi thu Bay nhung he
 * thong dat ban van xep khach le vao ban cua sanh do; bep khong biet tiec can
 * bao nhieu nguyen lieu nen goi y mua hang cung khong tinh.
 *
 * 1. GIU SANH: tiec o trang thai giu cho (DA_XAC_NHAN / DA_COC) khoa moi ban
 *    cua khu vuc do trong khung gio cua buoi (reservationTables.banKhaDung goi
 *    banBiGiuChoTiec).
 * 2. KE HOACH NGUYEN LIEU: thuc don tiec chi luu TEN mon (chu) -> ghep voi mon
 *    trong thuc don chinh theo ten (bo dau, bo ma mon, ty le tu trung >= 60%),
 *    nhan cong thuc x so ban x so phan moi mon moi ban (cau_hinh
 *    tiec.phan_moi_mon_moi_ban, mac dinh 3). Mon khong ghep duoc duoc liet ke
 *    de bep tu tinh.
 * 3. Nhu cau cua tiec sap toi duoc cong vao DUNG NGAY to chuc trong du bao
 *    tieu hao cua mua hang (khoBepService.duBaoTieuHao).
 */
const db = require('../config/db');

const KHUNG_BUOI = { TRUA: ['10:30', '14:00'], TOI: ['17:30', '22:00'] };
const GIU_CHO = ['DA_XAC_NHAN', 'DA_COC'];
const NGUONG_GHEP = 0.6;

const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  .replace(/^[a-z]*\d+[a-z]?\s*-\s*/, '') // bo ma mon "SA05-"
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Ghep ten mon tiec -> mon an (HAM THUAN). */
function ghepMon(tenTiec, dsMon) {
  const tu = boDau(tenTiec).split(' ').filter(Boolean);
  if (!tu.length) return null;
  // Token dinh danh ("Set B", "Set 3") bat buoc trung: "Set B" khong phai "Set A".
  const dinhDanh = tu.filter((w) => w.length === 1 || /^\d+$/.test(w));
  let tot = null, diem = 0;
  for (const m of dsMon) {
    const b = new Set(boDau(m.name_mon).split(' '));
    if (!dinhDanh.every((w) => b.has(w))) continue;
    const d = tu.filter((w) => b.has(w)).length / tu.length;
    if (d > diem || (d === diem && tot && String(m.name_mon).length < String(tot.name_mon).length)) { diem = d; tot = m; }
  }
  return diem >= NGUONG_GHEP ? { id_mon: Number(tot.id_mon), ten_mon: tot.name_mon, diem } : null;
}

const hhmm = (t) => String(t || '').slice(0, 5);
const giao = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

/**
 * Ban bi giu cho tiec trong khung (ngay, batDau, ketThuc).
 * @returns {Promise<Map<khu_vuc_id, {ma_tiec, buoi}>>}
 */
async function sanhBiGiu(ngay, batDau, ketThuc) {
  let rows = [];
  try {
    [rows] = await db.query(
      'SELECT ma_tiec, khu_vuc_id, buoi FROM dat_tiec WHERE ngay_to_chuc = ? AND trang_thai IN (?)', [ngay, GIU_CHO]);
  } catch (e) { if (e.code === 'ER_NO_SUCH_TABLE') return new Map(); throw e; }
  const ra = new Map();
  for (const r of rows) {
    const k = KHUNG_BUOI[r.buoi];
    if (k && giao(hhmm(batDau), hhmm(ketThuc), k[0], k[1])) ra.set(Number(r.khu_vuc_id), { ma_tiec: r.ma_tiec, buoi: r.buoi });
  }
  return ra;
}

async function phanMoiMonMoiBan() {
  try {
    const [[r]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'tiec.phan_moi_mon_moi_ban'");
    const v = Number(r && r.gia_tri);
    if (Number.isFinite(v) && v > 0 && v <= 20) return v;
  } catch (e) { /* mac dinh */ }
  return 3;
}

async function congThucMon(idsMon) {
  if (!idsMon.length) return new Map();
  const [rows] = await db.query(
    'SELECT id_mon, id_nl, so_luong_tieu_hao FROM cong_thuc WHERE id_mon IN (?) AND so_luong_tieu_hao > 0', [idsMon]);
  const m = new Map();
  for (const r of rows) {
    const k = Number(r.id_mon);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push({ id_nl: Number(r.id_nl), dl: Number(r.so_luong_tieu_hao) });
  }
  return m;
}

/** Nhu cau nguyen lieu cua MOT tiec: Map id_nl -> so luong, kem bang ghep mon. */
async function nhuCauCuaTiec(tiec, { dsMon = null, phan = null } = {}) {
  const [[td]] = await db.query('SELECT mon FROM thuc_don_tiec WHERE id = ?', [tiec.thuc_don_id]);
  let monTiec = [];
  try { monTiec = JSON.parse((td && td.mon) || '[]'); } catch (e) { monTiec = []; }
  if (!dsMon) [dsMon] = await db.query('SELECT id_mon, name_mon FROM monan WHERE tinhtrang = 1');
  const soPhan = phan || await phanMoiMonMoiBan();
  const ghep = monTiec.map((m) => ({ ten: m.ten, nhom: m.nhom, ...(ghepMon(m.ten, dsMon) || {}) }));
  const ct = await congThucMon([...new Set(ghep.filter((g) => g.id_mon).map((g) => g.id_mon))]);
  const can = new Map();
  for (const g of ghep) {
    if (!g.id_mon) continue;
    for (const c of ct.get(g.id_mon) || []) can.set(c.id_nl, (can.get(c.id_nl) || 0) + c.dl * soPhan * Number(tiec.so_ban || 0));
  }
  return { can, ghep, soPhan };
}

/** Ke hoach nguyen lieu cua mot tiec (cho trang quan ly tiec). */
async function keHoachNguyenLieu(idTiec) {
  const [[t]] = await db.query('SELECT * FROM dat_tiec WHERE id = ?', [idTiec]);
  if (!t) return null;
  const { can, ghep, soPhan } = await nhuCauCuaTiec(t);
  const ids = [...can.keys()];
  const [nl] = ids.length
    ? await db.query(
      `SELECT nl.id_nl, nl.ten_nl, nl.gia_von, dvt.ten_dvt FROM nguyen_lieu nl
         LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt WHERE nl.id_nl IN (?)`, [ids])
    : [[]];
  const khaDung = ids.length ? await require('./tonMonService').tonKhaDung(ids) : new Map();
  const dong = nl.map((n) => {
    const c = can.get(Number(n.id_nl)) || 0;
    const kd = Math.max(0, (khaDung.get(Number(n.id_nl)) || {}).kha_dung || 0);
    return { id_nl: n.id_nl, ten: n.ten_nl, dvt: n.ten_dvt, can: c, kha_dung: kd, thieu: Math.max(0, c - kd), gia_tri: c * Number(n.gia_von || 0) };
  }).sort((a, b) => b.thieu - a.thieu || b.gia_tri - a.gia_tri);
  return {
    tiec: { ma: t.ma_tiec, so_ban: t.so_ban, ngay: t.ngay_to_chuc, buoi: t.buoi },
    phan_moi_mon_moi_ban: soPhan,
    mon: ghep,
    chua_ghep: ghep.filter((g) => !g.id_mon).map((g) => g.ten),
    nguyen_lieu: dong,
    tong_gia_tri: dong.reduce((s, d) => s + d.gia_tri, 0),
    so_thieu: dong.filter((d) => d.thieu > 0).length,
  };
}

/**
 * Nhu cau nguyen lieu cua cac tiec giu cho tu tuNgay trong soNgay ngay:
 * Map id_nl -> mang soNgay phan tu (so luong can vao tung ngay).
 */
async function nhuCauTiecTheoNgay(tuNgay, soNgay) {
  let tiec = [];
  try {
    [tiec] = await db.query(
      `SELECT id, thuc_don_id, so_ban, DATEDIFF(ngay_to_chuc, ?) AS cach FROM dat_tiec
        WHERE trang_thai IN (?) AND ngay_to_chuc >= ? AND DATEDIFF(ngay_to_chuc, ?) < ?`,
      [tuNgay, GIU_CHO, tuNgay, tuNgay, soNgay]);
  } catch (e) { if (e.code === 'ER_NO_SUCH_TABLE') return new Map(); throw e; }
  const ra = new Map();
  if (!tiec.length) return ra;
  const [dsMon] = await db.query('SELECT id_mon, name_mon FROM monan WHERE tinhtrang = 1');
  const phan = await phanMoiMonMoiBan();
  for (const t of tiec) {
    const { can } = await nhuCauCuaTiec(t, { dsMon, phan });
    for (const [id, sl] of can) {
      if (!ra.has(id)) ra.set(id, Array(soNgay).fill(0));
      ra.get(id)[Number(t.cach)] += sl;
    }
  }
  return ra;
}

module.exports = { ghepMon, boDau, sanhBiGiu, keHoachNguyenLieu, nhuCauTiecTheoNgay, KHUNG_BUOI };

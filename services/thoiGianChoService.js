/**
 * UOC TINH THOI GIAN CHO MON.
 *
 * Khach goi qua QR truoc day chi thay "Cho che bien / Dang nau", khong biet con
 * bao lau; bep chi biet mon DA tre (cho qua nguong) chu khong biet mon SAP tre.
 *
 * MO HINH
 *   1. Thoi gian nau moi mon = TRUNG VI (khong dung trung binh - du lieu that
 *      co lan bam thu 0 phut, co lan quen bam 100 phut) cac lan nau that cua
 *      mon do tren KDS (bep_bat_dau -> bep_ket_thuc), can >= MAU_TOI_THIEU
 *      mau; thieu thi lay trung vi ca bep; chua co gi thi MAC_DINH_PHUT. Chan
 *      trong [3, 45] phut. Nhieu phan cung dong: x (1 + 0.2 x (sl - 1)), toi
 *      da x2 (nau chung mot me).
 *   2. Hang doi: K dau bep dang trong ca (lich lam viec hom nay; khong co thi
 *      dinh muc; khong co nua thi 2). Mon dang nau giu mot bep phan thoi gian
 *      con lai; mon cho xep lan luot (theo thu tu goi) vao bep ranh som nhat.
 *   3. "Sap tre": da cho + con lai > cam ket phuc vu (cau_hinh bep.sla_phut,
 *      mac dinh 30) - canh bao TRUOC khi mon tre that.
 */
const db = require('../config/db');

const MAU_TOI_THIEU = 3;
const MAC_DINH_PHUT = 15;
const CHAN_DUOI = 3;
const CHAN_TREN = 45;
const SLA_MAC_DINH = 30;

const trungVi = (ds) => {
  if (!ds.length) return null;
  const s = ds.slice().sort((a, b) => a - b);
  const g = Math.floor(s.length / 2);
  return s.length % 2 ? s[g] : (s[g - 1] + s[g]) / 2;
};
const chan = (x) => Math.min(CHAN_TREN, Math.max(CHAN_DUOI, x));

/** Thoi gian nau uoc luong: { theoMon: Map<id_mon, phut>, chung: phut } */
async function uocLuongNau() {
  const [rows] = await db.query(
    `SELECT id_mon, TIMESTAMPDIFF(SECOND, bep_bat_dau, bep_ket_thuc) / 60 AS phut
       FROM hopdong
      WHERE id_mon > 0 AND bep_bat_dau IS NOT NULL AND bep_ket_thuc IS NOT NULL
        -- Chi tinh lan nau HOP LE: < 2 phut la bam nham / bam thu lien tay,
        -- > 45 phut la quen bam hoan thanh. Du lieu demo hien gan nhu toan hai
        -- loai nay nen se dung MAC_DINH_PHUT cho toi khi bep chay that du mau.
        AND TIMESTAMPDIFF(SECOND, bep_bat_dau, bep_ket_thuc) BETWEEN 120 AND 2700`);
  const theo = new Map();
  for (const r of rows) {
    const id = Number(r.id_mon);
    if (!theo.has(id)) theo.set(id, []);
    theo.get(id).push(Number(r.phut));
  }
  const tatCa = rows.map((r) => Number(r.phut));
  const chung = tatCa.length >= MAU_TOI_THIEU ? chan(trungVi(tatCa)) : MAC_DINH_PHUT;
  const theoMon = new Map();
  for (const [id, ds] of theo) if (ds.length >= MAU_TOI_THIEU) theoMon.set(id, chan(trungVi(ds)));
  return { theoMon, chung };
}

/** So dau bep dang trong ca luc nay. */
async function soDauBep(luc = new Date()) {
  const gio = `${String(luc.getHours()).padStart(2, '0')}:${String(luc.getMinutes()).padStart(2, '0')}:00`;
  try {
    const [[l]] = await db.query(
      `SELECT COUNT(DISTINCT l.id_nv) AS n FROM lich_lam_viec l JOIN nhan_vien n ON n.id_nv = l.id_nv
        WHERE l.ngay = CURDATE() AND l.trangthai = 1 AND n.chucvu = 'Bep'
          AND l.gio_bat_dau <= ? AND l.gio_ket_thuc > ?`, [gio, gio]);
    if (Number(l.n) > 0) return Number(l.n);
    const [[d]] = await db.query(
      `SELECT SUM(d.so_luong) AS n FROM dinh_muc_ca d JOIN ca_lam_viec c ON c.ma_ca = d.ma_ca
        WHERE d.thu = ? AND d.chucvu = 'Bep' AND c.gio_bat_dau <= ? AND c.gio_ket_thuc > ?`, [luc.getDay(), gio, gio]);
    if (Number(d.n) > 0) return Number(d.n);
  } catch (e) { /* bang chua co -> mac dinh */ }
  return 2;
}

async function slaPhut() {
  try {
    const [[r]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'bep.sla_phut'");
    const v = Number(r && r.gia_tri);
    if (Number.isFinite(v) && v > 0) return v;
  } catch (e) { /* mac dinh */ }
  return SLA_MAC_DINH;
}

/**
 * Lap lich hang doi (HAM THUAN).
 * @param {{id, id_mon, soluong, trangthai_bep, da_nau_phut?}[]} mon  mon dang cho (0) / dang nau (1)
 * @param {{K:number, phutMon:(id_mon)=>number}} o
 * @returns {Map<id, {con_phut:number, nau_phut:number}>}
 */
function lapLich(mon, { K, phutMon }) {
  const bep = Array(Math.max(1, K)).fill(0); // phut nua thi bep ranh
  const ra = new Map();
  const uoc = (m) => phutMon(m.id_mon) * Math.min(2, 1 + 0.2 * Math.max(0, (Number(m.soluong) || 1) - 1));
  const chonBep = () => bep.indexOf(Math.min(...bep));
  const dangNau = mon.filter((m) => Number(m.trangthai_bep) === 1).sort((a, b) => a.id - b.id);
  const dangCho = mon.filter((m) => Number(m.trangthai_bep) === 0).sort((a, b) => a.id - b.id);
  for (const m of dangNau) {
    const conLai = Math.max(1, uoc(m) - (Number(m.da_nau_phut) || 0));
    const i = chonBep();
    bep[i] += conLai;
    ra.set(m.id, { con_phut: bep[i], nau_phut: uoc(m) });
  }
  for (const m of dangCho) {
    const i = chonBep();
    bep[i] += uoc(m);
    ra.set(m.id, { con_phut: bep[i], nau_phut: uoc(m) });
  }
  return ra;
}

/**
 * Du kien cho moi mon dang o bep (cho + dang nau), tu danh sach KDS.
 * @returns {Promise<{theoId: Map<id, {con_phut, sap_tre, da_cho_phut}>, K, sla}>}
 */
async function duKien() {
  const kds = require('./kdsService');
  const [nhom, uoc, K, sla] = await Promise.all([kds.layDonBep(), uocLuongNau(), soDauBep(), slaPhut()]);
  const bayGio = Date.now();
  const phut = (t) => (t ? Math.max(0, (bayGio - new Date(t).getTime()) / 60000) : 0);
  const mon = [...nhom.cho, ...nhom.dang_lam].map((m) => ({
    id: m.id, id_mon: m.id_mon, soluong: m.soluong, trangthai_bep: m.trangthai_bep,
    da_nau_phut: m.trangthai_bep === 1 ? phut(m.bep_bat_dau) : 0,
    dat_luc: m.ngay_dat && m.gio_dat ? new Date(`${new Date(m.ngay_dat).toISOString().slice(0, 10)}T${m.gio_dat}`) : null,
  }));
  const lich = lapLich(mon, { K, phutMon: (id) => uoc.theoMon.get(Number(id)) || uoc.chung });
  const theoId = new Map();
  for (const m of mon) {
    const l = lich.get(m.id);
    // Don dat truoc (gio hen trong tuong lai) chua tinh la "dang cho".
    const daCho = m.dat_luc && m.dat_luc.getTime() <= bayGio ? phut(m.dat_luc) : 0;
    theoId.set(m.id, {
      con_phut: Math.ceil(l.con_phut),
      da_cho_phut: Math.floor(daCho),
      sap_tre: daCho + l.con_phut > sla,
    });
  }
  return { theoId, K, sla, nhom };
}

module.exports = { uocLuongNau, soDauBep, slaPhut, lapLich, duKien, trungVi, MAC_DINH_PHUT };

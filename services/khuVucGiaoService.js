/**
 * KHU VUC GIAO HANG theo quan (Go Vap, Binh Thanh, Quan 12...).
 *
 * Moi khu la mot DA GIAC [vi_do, kinh_do] luu trong `khu_vuc_giao.da_giac`.
 * Mot dia chi giao duoc khi toa do cua no nam trong it nhat mot khu dang bat.
 *
 * Vi sao da giac chu khong doc ten quan trong chuoi dia chi: chuoi do khach go
 * hoac dich vu ban do tra ve, co the viet "Q.12", "Quận 12", "District 12",
 * hoac khong ghi quan nao - va ai cung sua duoc truoc khi gui. Toa do moi la
 * thu may chu tu kiem tra duoc.
 *
 * Ranh gioi trong migration la GAN DUNG (moi quan 12-14 dinh) - du de phan
 * vung giao hang, khong phai ban do dia chinh. Sat ranh gioi vai tram met co
 * the lech; quan tri xem tren ban do o /staff/giao-hang/dieu-phoi va chinh
 * JSON da giac neu can.
 */
const db = require('../config/db');

let dem = null; // { het, ds }

function docJson(s) { try { return JSON.parse(s); } catch (_) { return null; } }

async function dsKhuVuc({ chiBat = false, boDem = false } = {}) {
  if (!boDem && dem && dem.het > Date.now()) {
    return chiBat ? dem.ds.filter((k) => k.bat) : dem.ds;
  }
  const [rows] = await db.query('SELECT * FROM khu_vuc_giao ORDER BY thu_tu, id_kv');
  const ds = rows.map((r) => ({ ...r, bat: !!r.bat, da_giac: docJson(r.da_giac) || [] }));
  dem = { het: Date.now() + 60000, ds };
  return chiBat ? ds.filter((k) => k.bat) : ds;
}
function xoaDem() { dem = null; }

/** Thuat toan tia (ray casting) - diem [vi_do, kinh_do] co nam trong da giac khong. */
function trongDaGiac(viDo, kinhDo, daGiac) {
  let trong = false;
  for (let i = 0, j = daGiac.length - 1; i < daGiac.length; j = i++) {
    const [yi, xi] = daGiac[i];
    const [yj, xj] = daGiac[j];
    const cat = (yi > viDo) !== (yj > viDo) && kinhDo < ((xj - xi) * (viDo - yi)) / (yj - yi) + xi;
    if (cat) trong = !trong;
  }
  return trong;
}

/** Khu dang bat chua diem nay, hoac null. */
async function khuVucCuaDiem(viDo, kinhDo) {
  const v = Number(viDo), k = Number(kinhDo);
  if (!Number.isFinite(v) || !Number.isFinite(k)) return null;
  const ds = await dsKhuVuc({ chiBat: true });
  return ds.find((kv) => kv.da_giac.length >= 3 && trongDaGiac(v, k, kv.da_giac)) || null;
}

async function batTat(idKv, bat) {
  await db.query('UPDATE khu_vuc_giao SET bat = ? WHERE id_kv = ?', [bat ? 1 : 0, idKv]);
  xoaDem();
}

async function suaDaGiac(idKv, daGiac) {
  if (!Array.isArray(daGiac) || daGiac.length < 3 ||
      !daGiac.every((d) => Array.isArray(d) && d.length === 2 && d.every((x) => Number.isFinite(Number(x))))) {
    throw new Error('Đa giác phải là mảng ít nhất 3 điểm [vĩ độ, kinh độ].');
  }
  await db.query('UPDATE khu_vuc_giao SET da_giac = ? WHERE id_kv = ?',
    [JSON.stringify(daGiac.map((d) => [Number(d[0]), Number(d[1])])), idKv]);
  xoaDem();
}

/** "Gò Vấp, Bình Thạnh và Quận 12" - dung trong thong bao cho khach. */
async function moTaVung() {
  const ten = (await dsKhuVuc({ chiBat: true })).map((k) => k.ten);
  if (!ten.length) return '';
  return ten.length === 1 ? ten[0] : ten.slice(0, -1).join(', ') + ' và ' + ten[ten.length - 1];
}

module.exports = { dsKhuVuc, khuVucCuaDiem, trongDaGiac, batTat, suaDaGiac, moTaVung, xoaDem };

/**
 * BAO HET MON THEO TON KHO.
 *
 * Truoc day kho chi bi tru khi bep bam "xong mon" va tru kieu
 * GREATEST(so_luong - x, 0): het nguyen lieu van goi duoc mon, kho am tham ve
 * 0, khong ai biet cho toi khi bep mo tu ra.
 *
 * TINH SO PHAN CON NAU DUOC
 *   ton kha dung(NL) = nguyen_lieu.so_luong
 *                      - phan DANG GIU cho cac mon da goi ma bep chua nau xong
 *                        (trangthai_bep 0/1 cua don dang hoat dong - chua tru kho)
 *   so phan(mon)     = min over NL cua mon: floor(ton kha dung / dinh luong)
 *   Mon khong co cong thuc -> khong gioi han.
 *
 * KIEM TRA KHI GOI MON: cong nhu cau nguyen lieu cua CA LUOT goi (nhieu mon
 * co the dung chung mot nguyen lieu) roi so voi ton kha dung. Thieu thi tu
 * choi va bao mon nao, con khoang bao nhieu phan.
 *
 * Day la kiem tra "mem": hai luot goi dong thoi cung luc van co the cung lot
 * qua. Du cho muc dich bao het mon; khong thay the kiem ke.
 *
 * Tat bang cau_hinh 'kho.chan_khi_het_mon' = '0'.
 */
const db = require('../config/db');

class LoiHetMon extends Error {
  constructor(message, chiTiet = []) { super(message); this.chiTiet = chiTiet; }
}

// Don dang hoat dong co mon chua nau: cung dieu kien voi man hinh bep (KDS).
const DIEU_KIEN_GIU = `h.id_mon > 0 AND h.soluong > 0 AND h.trangthai_bep IN (0, 1)
  AND (
    (h.loai_don = 'giao_hang' AND (dg.trang_thai IS NULL OR dg.trang_thai NOT IN ('da_giao', 'huy', 'that_bai')) AND h.tinhtrang NOT IN (2, 3, 4))
    OR
    (h.loai_don <> 'giao_hang' AND h.tinhtrang IN (0, 1, 5, 6) AND h.ngay_dat = CURDATE())
  )`;

let _bat = null, _batLuc = 0;
async function dangBat() {
  if (_bat !== null && Date.now() - _batLuc < 30000) return _bat;
  try {
    const [[r]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'kho.chan_khi_het_mon'");
    _bat = !r || String(r.gia_tri).trim() !== '0';
  } catch (e) {
    _bat = true;
  }
  _batLuc = Date.now();
  return _bat;
}

/** Ton kha dung cua tung nguyen lieu (id_nl -> so luong). */
async function tonKhaDung(idsNl = null) {
  const loc = idsNl && idsNl.length ? 'WHERE nl.id_nl IN (?)' : '';
  const [rows] = await db.query(
    `SELECT nl.id_nl, nl.ten_nl, GREATEST(nl.so_luong, 0) - COALESCE(g.giu, 0) AS kha_dung
     FROM nguyen_lieu nl
     LEFT JOIN (
       SELECT ct.id_nl, SUM(h.soluong * ct.so_luong_tieu_hao) AS giu
       FROM hopdong h
       JOIN cong_thuc ct ON ct.id_mon = h.id_mon
       LEFT JOIN don_giao_hang dg ON dg.sesis = h.sesis
       WHERE ${DIEU_KIEN_GIU}
       GROUP BY ct.id_nl
     ) g ON g.id_nl = nl.id_nl
     ${loc}`,
    idsNl && idsNl.length ? [idsNl] : []
  );
  const m = new Map();
  for (const r of rows) m.set(Number(r.id_nl), { ten: r.ten_nl, kha_dung: Number(r.kha_dung) || 0 });
  return m;
}

async function congThuc(idsMon) {
  if (!idsMon.length) return [];
  const [rows] = await db.query(
    'SELECT id_mon, id_nl, so_luong_tieu_hao FROM cong_thuc WHERE id_mon IN (?) AND so_luong_tieu_hao > 0',
    [idsMon]);
  return rows.map((r) => ({ id_mon: Number(r.id_mon), id_nl: Number(r.id_nl), dl: Number(r.so_luong_tieu_hao) }));
}

/**
 * So phan con nau duoc cua tung mon. Mon khong co cong thuc khong co trong Map
 * (= khong gioi han).
 * @returns {Promise<Map<number, number>>}
 */
async function soPhanCon(idsMon = null) {
  let ids = idsMon;
  if (!ids) {
    const [r] = await db.query('SELECT id_mon FROM monan WHERE tinhtrang = 1');
    ids = r.map((x) => Number(x.id_mon));
  }
  ids = [...new Set(ids.map(Number).filter((n) => n > 0))];
  const ct = await congThuc(ids);
  if (!ct.length) return new Map();
  const ton = await tonKhaDung([...new Set(ct.map((c) => c.id_nl))]);
  const kq = new Map();
  for (const c of ct) {
    const t = ton.get(c.id_nl);
    const phan = Math.max(0, Math.floor(((t && t.kha_dung) || 0) / c.dl + 1e-9));
    kq.set(c.id_mon, kq.has(c.id_mon) ? Math.min(kq.get(c.id_mon), phan) : phan);
  }
  return kq;
}

/** Tap id mon da het (0 phan). Dung de danh dau tren thuc don. */
async function monDaHet() {
  if (!(await dangBat())) return new Set();
  const m = await soPhanCon();
  return new Set([...m].filter(([, phan]) => phan <= 0).map(([id]) => id));
}

/**
 * Nem LoiHetMon neu kho khong du cho ca luot goi.
 * @param {{id_mon:number, qty:number}[]} items
 */
async function kiemTraDatMon(items) {
  if (!(await dangBat())) return;
  const can = new Map(); // id_mon -> qty
  for (const it of items || []) {
    const id = Number(it.id_mon), q = Number(it.qty) || 0;
    if (id > 0 && q > 0) can.set(id, (can.get(id) || 0) + q);
  }
  if (!can.size) return;
  const ct = await congThuc([...can.keys()]);
  if (!ct.length) return;

  const nhuCau = new Map(); // id_nl -> tong can
  for (const c of ct) nhuCau.set(c.id_nl, (nhuCau.get(c.id_nl) || 0) + c.dl * can.get(c.id_mon));
  const ton = await tonKhaDung([...nhuCau.keys()]);

  const nlThieu = new Set([...nhuCau].filter(([id, x]) => x > ((ton.get(id) || {}).kha_dung || 0) + 1e-9).map(([id]) => id));
  if (!nlThieu.size) return;

  const phan = await soPhanCon([...can.keys()]);
  const monThieu = [...new Set(ct.filter((c) => nlThieu.has(c.id_nl)).map((c) => c.id_mon))];
  const [ten] = await db.query('SELECT id_mon, name_mon FROM monan WHERE id_mon IN (?)', [monThieu]);
  const tenMon = new Map(ten.map((r) => [Number(r.id_mon), r.name_mon]));
  const chiTiet = monThieu.map((id) => ({ id_mon: id, ten: tenMon.get(id) || ('#' + id), con: phan.get(id) || 0, goi: can.get(id) }));
  const cau = chiTiet.map((x) => (x.con > 0 ? `${x.ten} (chỉ còn khoảng ${x.con} phần)` : `${x.ten} (đã hết)`)).join(', ');
  throw new LoiHetMon(`Không đủ nguyên liệu: ${cau}. Vui lòng giảm số lượng hoặc chọn món khác.`, chiTiet);
}

module.exports = { soPhanCon, monDaHet, kiemTraDatMon, tonKhaDung, LoiHetMon, dangBat };

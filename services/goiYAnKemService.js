/**
 * GOI Y MON AN KEM cho trang chi tiet mon.
 *
 * Bang `luat_ket_hop` (Apriori) chi co luat ve 9 mon - qua it de moi trang chi
 * tiet deu co goi y. Lop nay tinh truc tiep tren lich su don that (`hopdong`,
 * tinhtrang = 3) va ket hop voi quy tac am thuc:
 *
 *   1. QUY TAC BEP: moi loai mon co cac "VI TRI" bo sung cho tron bua. Mon com
 *      can canh, khai vi, mon nong, do uong, trang mieng; lau can do song,
 *      tempura... Khong goi y mon cung vai tro (com voi mi) - do la thay the,
 *      khong phai an chung.
 *   2. DU LIEU: trong moi vi tri, chon mon co LIFT cao nhat - so lan duoc goi
 *      chung chia cho muc ky vong neu doc lap. Dung lift chu khong dung so lan
 *      dem tho, vi dem tho thi do uong luon dung dau (mon nao cung co nguoi goi
 *      nuoc), khong noi len dieu gi ve MON NAY.
 *   3. DU PHONG: mon moi / it don thi lay mon ban chay nhat cua vi tri do, ghi
 *      ro la "goi y cua bep" chu khong gan nhan thong ke gia.
 *
 * Ket qua cache 30 phut trong bo nho - lich su don thay doi cham, con truy van
 * dong xuat hien (self-join hopdong) ton ~0.3s.
 */
const db = require('../config/db');

const CACHE_MS = 30 * 60 * 1000;
const NGUONG_DONG_XUAT_HIEN = 4;   // it hon thi lift chi la nhieu
const NGUONG_LIFT = 1.1;           // thap hon ~ khong lien quan

/** Vai tro cua mot danh muc, suy tu ten danh muc (on dinh hon so id). */
function vaiTro(tenLoai) {
  const t = String(tenLoai || '').toUpperCase();
  if (/SAKE|BEER|BIA|RƯỢU/.test(t)) return 'ruou';
  if (/DRINK|UỐNG/.test(t)) return 'do_uong';
  if (/DESSERT|TRÁNG/.test(t)) return 'trang_mieng';
  if (/SOUP|SÚP|CANH/.test(t)) return 'canh';
  if (/APPE|SALAD|KHAI/.test(t)) return 'khai_vi';
  if (/OYSTER|HÀU/.test(t)) return 'hau';
  if (/HOT POT|LẨU/.test(t)) return 'lau';
  if (/SASHIMI/.test(t)) return 'song';
  if (/GUNKAN|NIGIRI|SUSHI|MAKI|TEMAKI|ROLL/.test(t)) return 'sushi';
  if (/GRILL|TEPPAN|HOT DISH|TEMPURA/.test(t)) return 'mon_nong';
  if (/NOODLE|RICE|CƠM|MÌ/.test(t)) return 'mon_chinh';
  return 'khac';
}

/** Cac vi tri bo sung cho tung vai tro mon dang xem. Moi vi tri: [nhan, [vai tro chap nhan]]. */
const VI_TRI = {
  mon_chinh: [['Canh ăn kèm', ['canh']], ['Khai vị', ['khai_vi']], ['Thêm món nóng', ['mon_nong', 'sushi']], ['Đồ uống', ['do_uong']], ['Tráng miệng', ['trang_mieng']]],
  lau: [['Sashimi / sushi', ['song', 'sushi']], ['Món nóng ăn kèm', ['mon_nong']], ['Khai vị', ['khai_vi']], ['Đồ uống', ['ruou', 'do_uong']], ['Tráng miệng', ['trang_mieng']]],
  song: [['Canh ấm bụng', ['canh']], ['Món nóng', ['mon_nong']], ['Sushi', ['sushi']], ['Rượu sake / bia', ['ruou', 'do_uong']], ['Tráng miệng', ['trang_mieng']]],
  sushi: [['Canh ấm bụng', ['canh']], ['Sashimi', ['song']], ['Món nóng', ['mon_nong']], ['Đồ uống', ['do_uong', 'ruou']], ['Tráng miệng', ['trang_mieng']]],
  mon_nong: [['Món chính', ['mon_chinh']], ['Canh ăn kèm', ['canh']], ['Khai vị', ['khai_vi']], ['Đồ uống', ['ruou', 'do_uong']], ['Tráng miệng', ['trang_mieng']]],
  hau: [['Sashimi', ['song']], ['Khai vị', ['khai_vi']], ['Món chính', ['mon_chinh']], ['Rượu sake / bia', ['ruou', 'do_uong']]],
  khai_vi: [['Món chính', ['mon_chinh']], ['Sushi / sashimi', ['sushi', 'song']], ['Món nóng', ['mon_nong']], ['Đồ uống', ['do_uong']]],
  canh: [['Món chính', ['mon_chinh']], ['Sushi / sashimi', ['sushi', 'song']], ['Món nóng', ['mon_nong']], ['Đồ uống', ['do_uong']]],
  trang_mieng: [['Trà / đồ uống', ['do_uong']], ['Thêm tráng miệng', ['trang_mieng']], ['Món nhẹ', ['khai_vi', 'sushi']]],
  do_uong: [['Món nhẹ', ['khai_vi']], ['Món nóng', ['mon_nong']], ['Sushi', ['sushi']], ['Tráng miệng', ['trang_mieng']]],
  ruou: [['Món nhắm', ['mon_nong']], ['Sashimi', ['song']], ['Khai vị', ['khai_vi']], ['Hàu Nhật', ['hau', 'sushi']]],
  khac: [['Món chính', ['mon_chinh']], ['Món nóng', ['mon_nong']], ['Đồ uống', ['do_uong']], ['Tráng miệng', ['trang_mieng']]],
};

// ------------------------------------------------------------ cache chung

let thongKe = null; // { het: ms, N, tanSuat: Map<id, so phien>, mon: Map<id, {..}> }
const cacheMon = new Map(); // id -> { het, ds }

async function napThongKe() {
  if (thongKe && thongKe.het > Date.now()) return thongKe;
  const [[{ N }]] = await db.query(
    'SELECT COUNT(DISTINCT sesis) AS N FROM hopdong FORCE INDEX (idx_hopdong_tt_sesis) WHERE tinhtrang = 3');
  const [ts] = await db.query(
    'SELECT id_mon, COUNT(DISTINCT sesis) AS n FROM hopdong WHERE tinhtrang = 3 GROUP BY id_mon');
  const [mon] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, l.name_loai
       FROM monan m JOIN loai_mon l ON l.id_loai = m.id_loai
      WHERE m.tinhtrang = 1 AND l.name_loai REGEXP '^[0-9]+\\\\.'`);
  thongKe = {
    het: Date.now() + CACHE_MS,
    N: Number(N) || 1,
    tanSuat: new Map(ts.map((r) => [Number(r.id_mon), Number(r.n)])),
    mon: new Map(mon.map((r) => [Number(r.id_mon), { ...r, id_mon: Number(r.id_mon), gia_mon: Number(r.gia_mon), vai_tro: vaiTro(r.name_loai) }])),
  };
  return thongKe;
}

/**
 * Goi y an kem cho mot mon.
 * @returns {Promise<{id_mon, name_mon, gia_mon, images, nhan, ly_do, lift, ti_le}[]>}
 */
async function goiY(idMon, soLuong = 5) {
  idMon = Number(idMon);
  const daCo = cacheMon.get(idMon);
  if (daCo && daCo.het > Date.now()) return daCo.ds;

  const tk = await napThongKe();
  const mon = tk.mon.get(idMon);
  if (!mon) return [];

  // Dong xuat hien voi mon nay trong cung mot phien goi mon.
  const [co] = await db.query(
    `SELECT h2.id_mon, COUNT(DISTINCT h2.sesis) AS c
       FROM hopdong h1
       JOIN hopdong h2 ON h2.sesis = h1.sesis AND h2.id_mon <> h1.id_mon AND h2.tinhtrang = 3
      WHERE h1.id_mon = ? AND h1.tinhtrang = 3
      GROUP BY h2.id_mon`, [idMon]);
  const nA = tk.tanSuat.get(idMon) || 0;
  const diem = new Map();
  for (const r of co) {
    const c = Number(r.c);
    const nB = tk.tanSuat.get(Number(r.id_mon)) || 0;
    if (c < NGUONG_DONG_XUAT_HIEN || !nA || !nB) continue;
    const tiLe = c / nA;
    const lift = tiLe / (nB / tk.N);
    if (lift >= NGUONG_LIFT) diem.set(Number(r.id_mon), { lift, tiLe });
  }

  const daChon = new Set([idMon]);
  const ds = [];
  for (const [nhan, vaiTroNhan] of VI_TRI[mon.vai_tro] || VI_TRI.khac) {
    const ungVien = [...tk.mon.values()].filter((m) => vaiTroNhan.includes(m.vai_tro) && !daChon.has(m.id_mon));
    if (!ungVien.length) continue;

    // Uu tien lien quan that (lift); khong co thi lay mon ban chay nhat vi tri do.
    const coLienQuan = ungVien.filter((m) => diem.has(m.id_mon))
      .sort((a, b) => diem.get(b.id_mon).lift - diem.get(a.id_mon).lift);
    let chon = coLienQuan[0];
    let lyDo;
    if (chon) {
      const d = diem.get(chon.id_mon);
      lyDo = { loai: 'du_lieu', lift: d.lift, ti_le: d.tiLe };
    } else {
      chon = ungVien.sort((a, b) => (tk.tanSuat.get(b.id_mon) || 0) - (tk.tanSuat.get(a.id_mon) || 0))[0];
      lyDo = { loai: 'bep' };
    }
    daChon.add(chon.id_mon);
    ds.push({
      id_mon: chon.id_mon, name_mon: chon.name_mon, gia_mon: chon.gia_mon, images: chon.images,
      nhan, ly_do: lyDo.loai,
      lift: lyDo.lift ? Math.round(lyDo.lift * 10) / 10 : null,
      ti_le: lyDo.ti_le ? Math.round(lyDo.ti_le * 100) : null,
    });
    if (ds.length >= soLuong) break;
  }

  cacheMon.set(idMon, { het: Date.now() + CACHE_MS, ds });
  return ds;
}

module.exports = { goiY, vaiTro };

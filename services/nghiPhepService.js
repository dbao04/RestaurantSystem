/**
 * NGHI PHEP - xin nghi va duyet theo CAP TREN.
 *
 * Truoc day Ke toan duyet don cua MOI nguoi, ke ca don cua chinh minh (trang
 * ke toan co form tu tao don roi tu duyet), duyet lai duoc don da tu choi,
 * khong ghi ai duyet / luc nao / vi sao tu choi, va khong chan don trung ngay.
 *
 * QUY TAC
 *   - Nguoi duyet: cap tren trong cay to chuc (nhan_vien.id_quan_ly, xem
 *     phanQuyenService.laCapTrenCua) HOAC quan ly cap 1-2, HOAC admin.
 *     KHONG ai tu duyet don cua minh.
 *   - Chi duyet / tu choi don dang CHO (0). Tu choi bat buoc ly do. Ghi
 *     nguoi duyet + thoi diem.
 *   - Ke toan chi XEM (tinh luong), khong duyet - tru khi chinh ho la cap tren.
 *   - Tao don: khong o qua khu, ket thuc >= bat dau, toi da SO_NGAY_TOI_DA
 *     ngay, khong trung khoang voi don dang cho / da duyet cua chinh minh.
 *   - Danh sach duyet hien so ca da xep trong khoang nghi (lich_lam_viec cho
 *     duyet / da duyet) de nguoi duyet biet phai xep nguoi thay.
 */
const db = require('../config/db');
const phanQuyen = require('./phanQuyenService');
const { ngayCucBo } = require('../utils/thoiGian');

const TRANG_THAI = { 0: 'Chờ duyệt', 1: 'Đã duyệt', 2: 'Từ chối' };
const SO_NGAY_TOI_DA = 30;
/** Cap bac <= nay duyet duoc don cua moi nguoi (quan ly nha hang / bo phan). */
const CAP_DUYET_TAT_CA = 2;

class LoiNghiPhep extends Error {
  constructor(msg, ma = 'INVALID') { super(msg); this.name = 'LoiNghiPhep'; this.ma = ma; }
}

let daCoCot = false;
async function damBaoCot() {
  if (daCoCot) return;
  const cot = [
    ['nguoi_duyet', 'INT NULL'],
    ['duyet_luc', 'DATETIME NULL'],
    ['ly_do_tu_choi', 'VARCHAR(255) NULL'],
  ];
  for (const [ten, kieu] of cot) {
    const [r] = await db.query(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['nghi_phep', ten]);
    if (!r.length) await db.query(`ALTER TABLE nghi_phep ADD COLUMN ${ten} ${kieu}`);
  }
  daCoCot = true;
}

const laNgay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

async function taoDon(idNv, { ly_do: lyDo, ngay_bat_dau: tu, ngay_ket_thuc: den }) {
  await damBaoCot();
  const ly = String(lyDo || '').trim();
  if (!idNv) throw new LoiNghiPhep('Chưa đăng nhập.', 'FORBIDDEN');
  if (!laNgay(tu) || !laNgay(den)) throw new LoiNghiPhep('Ngày nghỉ không hợp lệ.');
  if (tu < ngayCucBo()) throw new LoiNghiPhep('Ngày bắt đầu không được ở quá khứ.');
  if (den < tu) throw new LoiNghiPhep('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
  const soNgay = Math.round((new Date(den) - new Date(tu)) / 86400000) + 1;
  if (soNgay > SO_NGAY_TOI_DA) throw new LoiNghiPhep(`Mỗi đơn nghỉ tối đa ${SO_NGAY_TOI_DA} ngày.`);
  if (ly.length < 3) throw new LoiNghiPhep('Vui lòng ghi lý do nghỉ.');

  const [[trung]] = await db.query(
    `SELECT id_np, ngay_bat_dau, ngay_ket_thuc FROM nghi_phep
      WHERE id_nv = ? AND trang_thai IN (0, 1) AND ngay_bat_dau <= ? AND ngay_ket_thuc >= ? LIMIT 1`,
    [idNv, den, tu]);
  if (trung) throw new LoiNghiPhep('Bạn đã có đơn nghỉ (chờ duyệt hoặc đã duyệt) trùng khoảng ngày này.');

  const [kq] = await db.query(
    'INSERT INTO nghi_phep (id_nv, ly_do, ngay_bat_dau, ngay_ket_thuc, trang_thai) VALUES (?, ?, ?, ?, 0)',
    [idNv, ly.slice(0, 2000), tu, den]);
  return { id: kq.insertId, so_ngay: soNgay };
}

/**
 * Nguoi nay duoc duyet don cua idNvDon khong.
 * @param {{id_nv:number, cap_bac:number}|null} hoSo
 */
async function duocDuyet(hoSo, laAdmin, idNvDon) {
  if (laAdmin) return true;
  if (!hoSo || !hoSo.id_nv) return false;
  if (Number(hoSo.id_nv) === Number(idNvDon)) return false;
  if (Number(hoSo.cap_bac) <= CAP_DUYET_TAT_CA) return true;
  return phanQuyen.laCapTrenCua(hoSo.id_nv, idNvDon);
}

/** Don ma nguoi nay duyet duoc (cho truoc, roi da xu ly gan day). */
async function dsChoNguoiDuyet(hoSo, laAdmin) {
  await damBaoCot();
  let pham = null; // null = tat ca
  if (!laAdmin && !(hoSo && Number(hoSo.cap_bac) <= CAP_DUYET_TAT_CA)) {
    pham = hoSo && hoSo.id_nv ? await phanQuyen.capDuoiCua(hoSo.id_nv) : [];
    if (!pham.length) return [];
  }
  const [rows] = await db.query(
    `SELECT np.*, n.ten AS ten_nv, n.chucvu, nd.ten AS ten_nguoi_duyet,
            (SELECT COUNT(*) FROM lich_lam_viec l
              WHERE l.id_nv = np.id_nv AND l.ngay BETWEEN np.ngay_bat_dau AND np.ngay_ket_thuc
                AND l.trangthai IN (0, 1)) AS so_ca_trung
       FROM nghi_phep np
       JOIN nhan_vien n ON n.id_nv = np.id_nv
       LEFT JOIN nhan_vien nd ON nd.id_nv = np.nguoi_duyet
      WHERE ${pham ? 'np.id_nv IN (?) AND ' : ''}(np.trang_thai = 0 OR np.created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY))
        ${hoSo && hoSo.id_nv && !laAdmin ? 'AND np.id_nv <> ?' : ''}
      ORDER BY np.trang_thai = 0 DESC, np.ngay_bat_dau ASC
      LIMIT 300`,
    [...(pham ? [pham] : []), ...(hoSo && hoSo.id_nv && !laAdmin ? [hoSo.id_nv] : [])]);
  return rows.map((r) => ({ ...r, ten_trang_thai: TRANG_THAI[r.trang_thai] || r.trang_thai, so_ca_trung: Number(r.so_ca_trung) || 0 }));
}

/**
 * Duyet / tu choi mot don.
 * @param {{hoSo, laAdmin, id}} nguoi
 * @param {{dongY:boolean, lyDo?:string}} o
 */
async function xuLy(idNp, nguoi, { dongY, lyDo = '' }) {
  await damBaoCot();
  const ly = String(lyDo || '').trim();
  if (!dongY && ly.length < 3) throw new LoiNghiPhep('Từ chối phải ghi lý do.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[don]] = await conn.query('SELECT * FROM nghi_phep WHERE id_np = ? FOR UPDATE', [idNp]);
    if (!don) throw new LoiNghiPhep('Không tìm thấy đơn nghỉ.', 'NOT_FOUND');
    if (Number(don.trang_thai) !== 0) {
      throw new LoiNghiPhep(`Đơn đã được xử lý trước đó (${TRANG_THAI[don.trang_thai] || don.trang_thai}).`);
    }
    if (nguoi.hoSo && Number(nguoi.hoSo.id_nv) === Number(don.id_nv) && !nguoi.laAdmin) {
      throw new LoiNghiPhep('Không được tự duyệt đơn nghỉ của chính mình.', 'FORBIDDEN');
    }
    if (!(await duocDuyet(nguoi.hoSo, nguoi.laAdmin, don.id_nv))) {
      throw new LoiNghiPhep('Chỉ cấp trên trực tiếp hoặc quản lý mới được duyệt đơn này.', 'FORBIDDEN');
    }
    await conn.query(
      `UPDATE nghi_phep SET trang_thai = ?, nguoi_duyet = ?, duyet_luc = NOW(), ly_do_tu_choi = ?
        WHERE id_np = ? AND trang_thai = 0`,
      [dongY ? 1 : 2, nguoi.id || null, dongY ? null : ly.slice(0, 255), idNp]);
    await conn.commit();
    return { ok: true, trang_thai: dongY ? 1 : 2, id_nv: don.id_nv };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { TRANG_THAI, SO_NGAY_TOI_DA, LoiNghiPhep, damBaoCot, taoDon, duocDuyet, dsChoNguoiDuyet, xuLy };

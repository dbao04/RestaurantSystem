/**
 * HUY / TRA MON (void) cho don an tai cho.
 *
 * Truoc day mon da goi khong co cach nao bo ra: goi nham, khach doi y, bep
 * het nguyen lieu... deu phai de nguyen tren hoa don, hoac sua tay CSDL.
 *
 * QUY TAC
 *   - Mon bep CHUA lam (trangthai_bep = 0): nhan vien phuc vu / quay / thu
 *     ngan duoc huy. Kho khong bi anh huong (chua tru gi).
 *   - Mon da vao bep (1 dang nau, 2 xong, 3 da len ban): CHI Quan ly duoc
 *     huy, va phai co ly do. Nguyen lieu da dung khong hoan lai kho - tinh la
 *     hao hut, ghi vao nhat ky de doi soat.
 *   - Khong huy duoc: don da thanh toan / da huy, don da co tien THANH TOAN
 *     (khong tinh tien coc), don GIAO HANG (co chinh sach huy rieng:
 *     chinhSachGiaoService).
 *   - Huy duoc mot phan so luong. Huy het thi dong mon giu lai voi so luong 0
 *     (KHONG xoa dong: bang hopdong luu thong tin chung cua don tren tung dong
 *     mon, xoa dong cuoi la mat ban, mat khach cua don). Cac truy van liet ke
 *     mon da loc `soluong > 0`.
 *   - Moi lan huy ghi mot dong `huy_mon` (chup ten, gia, so luong, trang thai
 *     bep luc huy, ai huy, ly do) de quan ly doi soat.
 *   - Phien thanh toan dang cho (QR da sinh) cua don bi huy di vi so tien
 *     khong con dung.
 */
const db = require('../config/db');

const LY_DO = {
  khach_doi_y: 'Khách đổi ý',
  goi_nham: 'Gọi nhầm món',
  het_mon: 'Hết món / hết nguyên liệu',
  mon_loi: 'Món bị lỗi',
  phuc_vu_lau: 'Chờ quá lâu',
  khac: 'Lý do khác',
};

const TEN_BEP = { 0: 'Chờ chế biến', 1: 'Đang chế biến', 2: 'Hoàn thành', 3: 'Đã phục vụ' };

class LoiHuyMon extends Error {
  constructor(message, ma = 'HUY_MON') { super(message); this.ma = ma; }
}

let daTaoBang = false;
async function damBaoBang() {
  if (daTaoBang) return;
  await db.query(`CREATE TABLE IF NOT EXISTS huy_mon (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_dong INT NOT NULL COMMENT 'hopdong.id cua dong mon',
    sesis VARCHAR(191) NOT NULL,
    id_mon INT NOT NULL,
    name_mon VARCHAR(255) NOT NULL,
    so_luong INT NOT NULL,
    don_gia DECIMAL(12,2) NOT NULL,
    gia_tri DECIMAL(12,2) NOT NULL,
    trangthai_bep TINYINT NOT NULL COMMENT 'trang thai bep luc huy',
    ma_ly_do VARCHAR(30) NOT NULL,
    ly_do VARCHAR(255) NULL,
    id_nv INT NULL,
    ten_nv VARCHAR(120) NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_huy_sesis (sesis),
    KEY idx_huy_ngay (tao_luc)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTaoBang = true;
}

/**
 * @param {number} idDong   hopdong.id
 * @param {object} o
 * @param {number} o.soLuong     so phan huy (mac dinh: het)
 * @param {string} o.maLyDo      khoa trong LY_DO
 * @param {string} [o.ghiChu]
 * @param {{id:number|null, ten:string, laQuanLy:boolean}} o.nhanVien
 */
async function huyMon(idDong, { soLuong, maLyDo, ghiChu = '', nhanVien }) {
  await damBaoBang();
  const id = Number(idDong);
  if (!Number.isInteger(id) || id <= 0) throw new LoiHuyMon('Món không hợp lệ.');
  if (!LY_DO[maLyDo]) throw new LoiHuyMon('Vui lòng chọn lý do hủy món.');
  const ghiChuSach = String(ghiChu || '').trim().slice(0, 255);
  if (maLyDo === 'khac' && !ghiChuSach) throw new LoiHuyMon('Chọn "Lý do khác" thì phải ghi rõ lý do.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[dong]] = await conn.query(
      `SELECT id, sesis, id_mon, name_mon, soluong, gia, trangthai_bep, tinhtrang, loai_don
       FROM hopdong WHERE id = ? FOR UPDATE`, [id]);
    if (!dong || !(dong.id_mon > 0)) throw new LoiHuyMon('Không tìm thấy món này trong đơn.');
    const conLai = Number(dong.soluong) || 0;
    if (conLai <= 0) throw new LoiHuyMon('Món này đã được hủy hết.');
    if (dong.loai_don === 'giao_hang') {
      throw new LoiHuyMon('Đơn giao hàng hủy theo chính sách giao hàng, không hủy từng món tại đây.');
    }
    if (dong.tinhtrang === 3) throw new LoiHuyMon('Đơn đã thanh toán, không thể hủy món.');
    if (dong.tinhtrang === 4) throw new LoiHuyMon('Đơn đã bị hủy.');

    const sl = soLuong == null || soLuong === '' ? conLai : Number(soLuong);
    if (!Number.isInteger(sl) || sl < 1 || sl > conLai) {
      throw new LoiHuyMon(`Số lượng hủy phải từ 1 đến ${conLai}.`);
    }

    const bep = Number(dong.trangthai_bep) || 0;
    if (bep >= 1 && !(nhanVien && nhanVien.laQuanLy)) {
      throw new LoiHuyMon(`Món đang ở trạng thái "${TEN_BEP[bep]}" - bếp đã làm, cần Quản lý hủy.`, 'CAN_QUAN_LY');
    }

    // Da thu tien thanh toan (khong tinh coc) thi khong sua hoa don nua: so
    // tien da thu se lech voi hoa don, phai di duong hoan tien.
    const [[daThu]] = await conn.query(
      "SELECT COUNT(*) AS so FROM payments WHERE sesis = ? AND status = 'success' AND loai = 'thanh_toan'",
      [dong.sesis]);
    if (Number(daThu.so) > 0) {
      throw new LoiHuyMon('Đơn đã có khoản thanh toán, không thể hủy món. Hãy dùng chức năng hoàn tiền.');
    }

    const moi = conLai - sl;
    const donGia = Number(dong.gia) || 0;
    await conn.query('UPDATE hopdong SET soluong = ?, thanhtien = ? WHERE id = ?', [moi, donGia * moi, id]);
    await conn.query(
      `INSERT INTO huy_mon (id_dong, sesis, id_mon, name_mon, so_luong, don_gia, gia_tri, trangthai_bep,
                            ma_ly_do, ly_do, id_nv, ten_nv)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, dong.sesis, dong.id_mon, dong.name_mon, sl, donGia, donGia * sl, bep,
        maLyDo, ghiChuSach || null, (nhanVien && nhanVien.id) || null,
        nhanVien && nhanVien.ten ? String(nhanVien.ten).slice(0, 120) : null]);

    // QR thanh toan da sinh cho so tien cu -> vo hieu, thu ngan tao lai.
    await conn.query(
      `UPDATE payments SET status = 'failed', notes = CONCAT(COALESCE(notes,''), ' | hủy vì đơn có món bị hủy')
       WHERE sesis = ? AND status = 'pending'`, [dong.sesis]);

    await conn.commit();
    return {
      id, sesis: dong.sesis, id_mon: dong.id_mon, name_mon: dong.name_mon,
      so_luong_huy: sl, con_lai: moi, gia_tri: donGia * sl, trangthai_bep: bep,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Nhat ky huy mon cua mot don (moi nhat truoc). */
async function lichSuCuaDon(sesis) {
  await damBaoBang();
  const [rows] = await db.query('SELECT * FROM huy_mon WHERE sesis = ? ORDER BY id DESC', [sesis]);
  return rows.map((r) => ({ ...r, ten_ly_do: LY_DO[r.ma_ly_do] || r.ma_ly_do, ten_bep: TEN_BEP[r.trangthai_bep] }));
}

module.exports = { huyMon, lichSuCuaDon, LY_DO, LoiHuyMon, damBaoBang };

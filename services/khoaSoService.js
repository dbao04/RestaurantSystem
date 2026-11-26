/**
 * DOI SOAT DOANH THU NGAY + CHOT SO (khoa so) NGAY / THANG - role Ke toan.
 *
 * Nguyen tac (tai lieu chuc nang ke toan):
 *   - Thu ngan / phuc vu / bep TAO du lieu; ke toan DOI SOAT va CHOT.
 *   - Doi soat ngay: doanh thu POS (don da thanh toan) <-> tien thuc thu theo
 *     phuong thuc (tien mat, chuyen khoan, the) <-> bien ban chot ca (tien mat
 *     dem duoc) <-> sao ke ngan hang (giao dich chua khop). Chenh lech phai ghi
 *     LY DO khi chot.
 *   - Chi chot NGAY DA QUA (khong chot hom nay): giao dich moi luon mang thoi
 *     diem hien tai nen khong bao gio roi vao ky da chot.
 *   - Ky da chot: khong huy / duyet phieu thu chi thuoc ky (thuChiService goi
 *     kiemTraKhoa). Ke toan KHONG tu mo khoa; Quan ly mo khoa phai ghi ly do.
 *   - Moi lan chot / mo khoa ghi audit_logs; ban chot luu ANH CHUP so lieu luc
 *     chot (tong_hop) de sau nay so voi so lieu hien tai.
 */
const db = require('../config/db');

class LoiKhoaSo extends Error {
  constructor(m, ma = 'KHOA_SO') { super(m); this.name = 'LoiKhoaSo'; this.ma = ma; }
}

let daTao = false;
async function damBaoBang() {
  if (daTao) return;
  await db.query(`CREATE TABLE IF NOT EXISTS khoa_so (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loai ENUM('ngay','thang') NOT NULL,
    tu_ngay DATE NOT NULL,
    den_ngay DATE NOT NULL,
    trang_thai ENUM('da_khoa','mo_khoa') NOT NULL DEFAULT 'da_khoa',
    chenh_lech DECIMAL(14,2) NOT NULL DEFAULT 0,
    ly_do_chenh_lech VARCHAR(500) NULL,
    ghi_chu VARCHAR(500) NULL,
    tong_hop LONGTEXT NULL COMMENT 'anh chup so lieu luc chot (JSON)',
    khoa_boi INT NULL,
    khoa_luc DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mo_khoa_boi INT NULL,
    mo_khoa_luc DATETIME NULL,
    ly_do_mo VARCHAR(500) NULL,
    KEY idx_ks_ky (tu_ngay, den_ngay, trang_thai)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTao = true;
}

const ngayChuoi = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const homNay = () => ngayChuoi(new Date());

/** Ky da chot dang hieu luc chua ngay `ngay` (YYYY-MM-DD) - null neu khong. */
async function kyDaKhoa(ngay) {
  await damBaoBang();
  const [[k]] = await db.query(
    "SELECT * FROM khoa_so WHERE trang_thai = 'da_khoa' AND ? BETWEEN tu_ngay AND den_ngay ORDER BY id DESC LIMIT 1",
    [String(ngay).slice(0, 10)]);
  return k || null;
}

/** Nem loi neu thoi diem nam trong ky da chot. Dung o moi thao tac sua so lieu cu. */
async function kiemTraKhoa(thoiDiem, viec = 'sửa số liệu') {
  const k = await kyDaKhoa(ngayChuoi(thoiDiem));
  if (k) {
    throw new LoiKhoaSo(`Không thể ${viec}: sổ ${k.loai === 'thang' ? 'tháng' : 'ngày'} ${ngayChuoi(k.tu_ngay)}${k.loai === 'thang' ? ' → ' + ngayChuoi(k.den_ngay) : ''} đã chốt. Cần Quản lý mở khóa sổ trước.`);
  }
}

/**
 * So lieu doi soat cua MOT ngay.
 */
async function doiSoatNgay(ngay) {
  await damBaoBang();
  const d = String(ngay).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new LoiKhoaSo('Ngày không hợp lệ.');

  // 1. Doanh thu POS: tien mon cua don da thanh toan trong ngay.
  const [[pos]] = await db.query(
    `SELECT COALESCE(SUM(thanhtien), 0) AS tien, COUNT(DISTINCT sesis) AS so_don
       FROM hopdong WHERE tinhtrang = 3 AND id_mon > 0 AND soluong > 0 AND ngay_dat = ?`, [d]);

  // 2. Tien thuc thu theo phuong thuc (thanh toan + coc), tru hoan.
  const [pt] = await db.query(
    `SELECT pm.code, pm.name, pm.type,
            COALESCE(SUM(CASE WHEN p.status IN ('success','refunded') AND DATE(COALESCE(p.thanh_cong_luc, p.created_at)) = ? THEN p.amount END), 0) AS thu,
            COALESCE(SUM(CASE WHEN p.status = 'refunded' AND DATE(p.updated_at) = ? THEN p.amount END), 0) AS hoan,
            COALESCE(SUM(CASE WHEN p.status IN ('success','refunded') AND DATE(COALESCE(p.thanh_cong_luc, p.created_at)) = ? THEN p.tien_tip END), 0) AS tip,
            COUNT(CASE WHEN p.status IN ('success','refunded') AND DATE(COALESCE(p.thanh_cong_luc, p.created_at)) = ? THEN 1 END) AS so_gd
       FROM payment_methods pm LEFT JOIN payments p ON p.payment_method_id = pm.id
      GROUP BY pm.id ORDER BY pm.id`, [d, d, d, d]);
  const theoPt = pt.map((r) => ({
    code: r.code, ten: r.name, type: r.type,
    thu: Number(r.thu), hoan: Number(r.hoan), thuan: Number(r.thu) - Number(r.hoan),
    tip: Number(r.tip), so_gd: Number(r.so_gd),
  }));
  const tongThuc = theoPt.reduce((t, r) => t + r.thuan, 0);

  // 3. Bien ban chot ca trong ngay (tien mat dem duoc vs he thong).
  const [ca] = await db.query(
    `SELECT s.id, s.ten_ca, s.shift_start, s.shift_end, s.status, s.tien_mat_he_thong, s.tien_mat_dem_duoc,
            s.chenh_lech, s.ly_do_chenh_lech, s.tien_chuyen_khoan, s.tien_the, n.ten AS ten_nv, nd.ten AS nguoi_duyet
       FROM shift_closings s LEFT JOIN nhan_vien n ON n.id_nv = s.id_nv LEFT JOIN nhan_vien nd ON nd.id_nv = s.verified_by
      WHERE s.shift_date = ? OR DATE(s.shift_end) = ? ORDER BY s.shift_start`, [d, d]).catch(() => [[]]);
  const chenhCa = ca.reduce((t, c) => t + Number(c.chenh_lech || 0), 0);

  // 4. Sao ke ngan hang trong ngay chua khop hoa don.
  const [nh] = await db.query(
    `SELECT trang_thai, COUNT(*) AS so, COALESCE(SUM(so_tien), 0) AS tien
       FROM giao_dich_ngan_hang WHERE loai = 'in' AND DATE(thoi_diem) = ? GROUP BY trang_thai`, [d]).catch(() => [[]]);
  const nganHang = {};
  nh.forEach((r) => { nganHang[r.trang_thai] = { so: Number(r.so), tien: Number(r.tien) }; });

  // 5. Phieu thu chi tay trong ngay.
  const [[ph]] = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN loai = 'thu' THEN so_tien END), 0) AS thu,
            COALESCE(SUM(CASE WHEN loai = 'chi' THEN so_tien END), 0) AS chi,
            SUM(trang_thai = 'cho_duyet') AS cho_duyet
       FROM phieu_thu_chi WHERE DATE(thoi_diem) = ? AND trang_thai IN ('hop_le','cho_duyet')`, [d]);

  const canhBao = [];
  const chenhDoanhThu = Math.round(tongThuc - Number(pos.tien));
  if (Math.abs(chenhDoanhThu) > 0) {
    canhBao.push(`Tiền thực thu lệch doanh thu POS ${chenhDoanhThu > 0 ? '+' : ''}${chenhDoanhThu.toLocaleString('vi-VN')}đ (có thể do tiền cọc / đơn trả khác ngày / phí giao hàng).`);
  }
  if (chenhCa) canhBao.push(`Chốt ca lệch tiền mặt tổng ${chenhCa > 0 ? '+' : ''}${Math.round(chenhCa).toLocaleString('vi-VN')}đ.`);
  const caChuaDuyet = ca.filter((c) => c.status !== 'verified').length;
  if (caChuaDuyet) canhBao.push(`${caChuaDuyet} biên bản chốt ca chưa được duyệt.`);
  if (nganHang.khong_khop) canhBao.push(`${nganHang.khong_khop.so} giao dịch ngân hàng chưa khớp hóa đơn (${nganHang.khong_khop.tien.toLocaleString('vi-VN')}đ).`);
  if (Number(ph.cho_duyet)) canhBao.push(`${ph.cho_duyet} phiếu chi đang chờ Quản lý duyệt.`);

  return {
    ngay: d,
    doanh_thu_pos: Number(pos.tien), so_don: Number(pos.so_don),
    theo_phuong_thuc: theoPt, tong_thuc_thu: tongThuc,
    chenh_doanh_thu: chenhDoanhThu,
    chot_ca: ca, chenh_ca: Math.round(chenhCa), ca_chua_duyet: caChuaDuyet,
    ngan_hang: nganHang,
    phieu: { thu: Number(ph.thu), chi: Number(ph.chi), cho_duyet: Number(ph.cho_duyet || 0) },
    canh_bao: canhBao,
    khoa: await kyDaKhoa(d),
  };
}

function ghiAudit(action, idNv, resourceId, details) {
  return db.query(
    `INSERT INTO audit_logs (action, actor_type, actor_id, resource_type, resource_id, status, details)
     VALUES (?, 'staff', ?, 'khoa_so', ?, 'success', ?)`,
    [action, idNv || null, resourceId, JSON.stringify(details)]).catch(() => {});
}

/** Ke toan chot so NGAY (ngay da qua). Co chenh lech thi bat buoc ly do. */
async function chotNgay(ngay, { idNv, lyDoChenhLech = '', ghiChu = '' } = {}) {
  await damBaoBang();
  const d = String(ngay).slice(0, 10);
  if (d >= homNay()) throw new LoiKhoaSo('Chỉ chốt sổ được ngày đã qua (không chốt hôm nay hoặc tương lai).');
  if (await kyDaKhoa(d)) throw new LoiKhoaSo(`Sổ ngày ${d} đã chốt.`);
  const ds = await doiSoatNgay(d);
  const chenh = ds.chenh_ca;
  const ly = String(lyDoChenhLech || '').trim();
  if ((chenh !== 0 || ds.chenh_doanh_thu !== 0) && ly.length < 5) {
    throw new LoiKhoaSo('Ngày này có chênh lệch (chốt ca hoặc doanh thu) - phải ghi lý do chênh lệch trước khi chốt sổ.', 'CAN_LY_DO');
  }
  if (ds.phieu.cho_duyet) throw new LoiKhoaSo('Còn phiếu chi chờ duyệt trong ngày - xử lý xong mới chốt sổ.');
  const [kq] = await db.query(
    `INSERT INTO khoa_so (loai, tu_ngay, den_ngay, chenh_lech, ly_do_chenh_lech, ghi_chu, tong_hop, khoa_boi)
     VALUES ('ngay', ?, ?, ?, ?, ?, ?, ?)`,
    [d, d, chenh, ly || null, String(ghiChu || '').trim().slice(0, 500) || null, JSON.stringify(ds), idNv || null]);
  await ghiAudit('chot_so_ngay', idNv, kq.insertId, { ngay: d, chenh_ca: chenh, chenh_doanh_thu: ds.chenh_doanh_thu });
  return { id: kq.insertId, ngay: d };
}

/** Ke toan chot so THANG (thang da qua het). */
async function chotThang(thang, nam, { idNv, ghiChu = '' } = {}) {
  await damBaoBang();
  const t = Number(thang), n = Number(nam);
  if (!(t >= 1 && t <= 12) || !(n >= 2000)) throw new LoiKhoaSo('Tháng không hợp lệ.');
  const tu = `${n}-${String(t).padStart(2, '0')}-01`;
  const den = ngayChuoi(new Date(n, t, 0));
  if (den >= homNay()) throw new LoiKhoaSo('Chỉ chốt sổ được tháng đã kết thúc.');
  const [[trung]] = await db.query(
    "SELECT id FROM khoa_so WHERE trang_thai = 'da_khoa' AND loai = 'thang' AND tu_ngay = ? LIMIT 1", [tu]);
  if (trung) throw new LoiKhoaSo(`Sổ tháng ${t}/${n} đã chốt.`);
  const [[cho]] = await db.query(
    "SELECT COUNT(*) AS n FROM phieu_thu_chi WHERE trang_thai = 'cho_duyet' AND DATE(thoi_diem) BETWEEN ? AND ?", [tu, den]);
  if (Number(cho.n)) throw new LoiKhoaSo(`Còn ${cho.n} phiếu chi chờ duyệt trong tháng - xử lý xong mới chốt.`);
  const thuChi = require('./thuChiService');
  const bc = await thuChi.baoCao({ tuNgay: tu, denNgay: den });
  const tongHop = { tong_thu: bc.tong_thu, tong_chi: bc.tong_chi, quy: bc.quy, chi_theo_danh_muc: bc.chi_theo_danh_muc };
  const [kq] = await db.query(
    `INSERT INTO khoa_so (loai, tu_ngay, den_ngay, ghi_chu, tong_hop, khoa_boi) VALUES ('thang', ?, ?, ?, ?, ?)`,
    [tu, den, String(ghiChu || '').trim().slice(0, 500) || null, JSON.stringify(tongHop), idNv || null]);
  await ghiAudit('chot_so_thang', idNv, kq.insertId, { thang: t, nam: n, tong_thu: bc.tong_thu, tong_chi: bc.tong_chi });
  return { id: kq.insertId, tu, den };
}

/** QUAN LY mo khoa so (bat buoc ly do). */
async function moKhoa(id, { idNv, lyDo = '' } = {}) {
  await damBaoBang();
  const ly = String(lyDo || '').trim();
  if (ly.length < 5) throw new LoiKhoaSo('Phải ghi lý do mở khóa sổ.');
  const [kq] = await db.query(
    "UPDATE khoa_so SET trang_thai = 'mo_khoa', mo_khoa_boi = ?, mo_khoa_luc = NOW(), ly_do_mo = ? WHERE id = ? AND trang_thai = 'da_khoa'",
    [idNv || null, ly.slice(0, 500), id]);
  if (!kq.affectedRows) throw new LoiKhoaSo('Kỳ này không ở trạng thái đã chốt.');
  await ghiAudit('mo_khoa_so', idNv, id, { ly_do: ly });
  return { ok: true };
}

/** Danh sach cac ky da chot / da mo gan day. */
async function dsKy(gioiHan = 40) {
  await damBaoBang();
  const [ds] = await db.query(
    `SELECT k.id, k.loai, k.tu_ngay, k.den_ngay, k.trang_thai, k.chenh_lech, k.ly_do_chenh_lech, k.ghi_chu,
            k.khoa_luc, k.mo_khoa_luc, k.ly_do_mo, nk.ten AS nguoi_khoa, nm.ten AS nguoi_mo
       FROM khoa_so k LEFT JOIN nhan_vien nk ON nk.id_nv = k.khoa_boi LEFT JOIN nhan_vien nm ON nm.id_nv = k.mo_khoa_boi
      ORDER BY k.id DESC LIMIT ?`, [Number(gioiHan)]);
  return ds;
}

module.exports = {
  damBaoBang, doiSoatNgay, chotNgay, chotThang, moKhoa, dsKy, kyDaKhoa, kiemTraKhoa, LoiKhoaSo, ngayChuoi,
};

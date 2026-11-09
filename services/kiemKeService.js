/**
 * KIEM KE KHO DINH KY + BAO CAO HAO HUT.
 *
 * Truoc day "kiem ke" chi la mot ly do xuat kho: nguoi dung tu tinh so thieu
 * roi go vao phieu xuat. Khong co phieu dem, khong ghi ton so sach luc dem,
 * khong xu ly hang THUA, khong biet hao hut bao nhieu % so voi ban hang.
 *
 * LUONG
 *   1. Tao phieu: CHUP ton so sach (nguyen_lieu.so_luong) cua moi nguyen lieu.
 *   2. Bep dem va nhap ton thuc te (luu nhieu lan khi con 'dang_dem').
 *   3. Chot (bep truong / quan ly; nguoi lap khong tu chot tru Quan ly):
 *        chenh = thuc te - ton LUC CHUP. Tinh theo luc chup chu khong theo ton
 *        hien tai, vi trong luc dem bep van ban hang (kho van tru) - so sanh
 *        voi ton hien tai se tinh nham phan da ban la hao hut.
 *        - thieu -> phieu xuat ly do 'kiem_ke' (tru lo FIFO, ghi gia tri)
 *        - thua  -> phieu nhap dieu chinh khong NCC (khong phat sinh cong no),
 *                   don gia = gia von hien tai (khong lam lech gia von)
 *      Dung lai khoBepService.taoPhieuXuat / taoPhieuNhap - mot duong duy nhat
 *      cho lo, gia von va nhat ky kho.
 */
const db = require('../config/db');

class LoiKiemKe extends Error {
  constructor(msg, ma = 'INVALID') { super(msg); this.name = 'LoiKho'; this.ma = ma; }
}

let daTaoBang = false;
async function damBaoBang() {
  if (daTaoBang) return;
  await db.query(`CREATE TABLE IF NOT EXISTS kiem_ke (
    id_kk INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu VARCHAR(30) NOT NULL UNIQUE,
    trang_thai ENUM('dang_dem','da_chot','huy') NOT NULL DEFAULT 'dang_dem',
    ghi_chu VARCHAR(500) NULL,
    id_nv_tao INT NULL,
    tao_luc DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_nv_chot INT NULL,
    chot_luc DATETIME NULL,
    gia_tri_thieu DECIMAL(14,2) NOT NULL DEFAULT 0,
    gia_tri_thua DECIMAL(14,2) NOT NULL DEFAULT 0,
    id_px INT NULL,
    id_pn INT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS kiem_ke_dong (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_kk INT NOT NULL,
    id_nl INT NOT NULL,
    ton_so_sach DECIMAL(14,3) NOT NULL,
    ton_thuc_te DECIMAL(14,3) NULL,
    gia_von DECIMAL(14,2) NOT NULL DEFAULT 0,
    ghi_chu VARCHAR(255) NULL,
    UNIQUE KEY uq_kk_nl (id_kk, id_nl),
    KEY idx_kk (id_kk)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTaoBang = true;
}

async function taoPhieu({ ghiChu = '' } = {}, idNv) {
  await damBaoBang();
  const [[mo]] = await db.query("SELECT ma_phieu FROM kiem_ke WHERE trang_thai = 'dang_dem' LIMIT 1");
  if (mo) throw new LoiKiemKe(`Đang có phiếu kiểm kê ${mo.ma_phieu} chưa chốt - hoàn tất hoặc hủy phiếu đó trước.`);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const d = new Date();
    const goc = `KK${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const [[dem]] = await conn.query('SELECT COUNT(*) AS n FROM kiem_ke WHERE ma_phieu LIKE ?', [`${goc}-%`]);
    const ma = `${goc}-${String(Number(dem.n) + 1).padStart(2, '0')}`;
    const [kq] = await conn.query(
      'INSERT INTO kiem_ke (ma_phieu, ghi_chu, id_nv_tao) VALUES (?, ?, ?)',
      [ma, String(ghiChu || '').trim().slice(0, 500) || null, idNv || null]);
    // Chup ton so sach cua moi nguyen lieu ngay luc tao phieu.
    await conn.query(
      `INSERT INTO kiem_ke_dong (id_kk, id_nl, ton_so_sach, gia_von)
       SELECT ?, id_nl, GREATEST(so_luong, 0), gia_von FROM nguyen_lieu`, [kq.insertId]);
    await conn.commit();
    return { id: kq.insertId, ma_phieu: ma };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function danhSach() {
  await damBaoBang();
  const [rows] = await db.query(
    `SELECT k.*, nt.ten AS ten_nv_tao, nc.ten AS ten_nv_chot,
            (SELECT COUNT(*) FROM kiem_ke_dong d WHERE d.id_kk = k.id_kk) AS so_dong,
            (SELECT COUNT(*) FROM kiem_ke_dong d WHERE d.id_kk = k.id_kk AND d.ton_thuc_te IS NOT NULL) AS da_dem
       FROM kiem_ke k LEFT JOIN nhan_vien nt ON nt.id_nv = k.id_nv_tao LEFT JOIN nhan_vien nc ON nc.id_nv = k.id_nv_chot
      ORDER BY k.id_kk DESC LIMIT 50`);
  return rows;
}

async function chiTiet(id) {
  await damBaoBang();
  const [[p]] = await db.query('SELECT * FROM kiem_ke WHERE id_kk = ?', [id]);
  if (!p) return null;
  const [dong] = await db.query(
    `SELECT d.*, nl.ten_nl, dvt.ten_dvt, nl.so_luong AS ton_hien_tai
       FROM kiem_ke_dong d JOIN nguyen_lieu nl ON nl.id_nl = d.id_nl LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
      WHERE d.id_kk = ? ORDER BY nl.ten_nl`, [id]);
  return {
    ...p,
    dong: dong.map((d) => {
      const ss = Number(d.ton_so_sach), tt = d.ton_thuc_te == null ? null : Number(d.ton_thuc_te);
      const chenh = tt == null ? null : tt - ss;
      return { ...d, ton_so_sach: ss, ton_thuc_te: tt, gia_von: Number(d.gia_von), chenh, gia_tri_chenh: chenh == null ? null : chenh * Number(d.gia_von) };
    }),
  };
}

/** Luu so dem: [{id_nl, ton_thuc_te (''=chua dem), ghi_chu}]. */
async function luuSoDem(id, dsDem) {
  await damBaoBang();
  const [[p]] = await db.query('SELECT trang_thai FROM kiem_ke WHERE id_kk = ?', [id]);
  if (!p) throw new LoiKiemKe('Không tìm thấy phiếu kiểm kê.', 'NOT_FOUND');
  if (p.trang_thai !== 'dang_dem') throw new LoiKiemKe('Phiếu đã chốt hoặc đã hủy - không sửa số đếm được.');
  let n = 0;
  for (const d of dsDem || []) {
    const raw = d.ton_thuc_te;
    const so = raw === '' || raw == null ? null : Number(String(raw).replace(',', '.'));
    if (so != null && (!Number.isFinite(so) || so < 0)) throw new LoiKiemKe('Số đếm phải là số không âm.');
    const [kq] = await db.query(
      'UPDATE kiem_ke_dong SET ton_thuc_te = ?, ghi_chu = ? WHERE id_kk = ? AND id_nl = ?',
      [so, String(d.ghi_chu || '').trim().slice(0, 255) || null, id, Number(d.id_nl)]);
    n += kq.affectedRows;
  }
  return { so_dong: n };
}

/**
 * Chot phieu: sinh phieu xuat (thieu) / phieu nhap dieu chinh (thua).
 * @param {{id, laQuanLy:boolean}} nguoi
 */
async function chot(id, nguoi) {
  const kho = require('./khoBepService');
  const ct = await chiTiet(id);
  if (!ct) throw new LoiKiemKe('Không tìm thấy phiếu kiểm kê.', 'NOT_FOUND');
  if (ct.trang_thai !== 'dang_dem') throw new LoiKiemKe('Phiếu đã chốt hoặc đã hủy.');
  if (nguoi.id && Number(ct.id_nv_tao) === Number(nguoi.id) && !nguoi.laQuanLy) {
    throw new LoiKiemKe('Người lập phiếu không tự chốt kiểm kê - nhờ bếp trưởng / quản lý khác chốt.', 'FORBIDDEN');
  }
  const daDem = ct.dong.filter((d) => d.ton_thuc_te != null);
  if (!daDem.length) throw new LoiKiemKe('Chưa nhập số đếm cho nguyên liệu nào.');
  const SAI_SO = 0.0005;
  const thieu = daDem.filter((d) => d.chenh < -SAI_SO);
  const thua = daDem.filter((d) => d.chenh > SAI_SO);

  // Gianh phieu truoc (chong hai nguoi chot cung luc).
  const [gianh] = await db.query(
    "UPDATE kiem_ke SET trang_thai = 'da_chot', id_nv_chot = ?, chot_luc = NOW() WHERE id_kk = ? AND trang_thai = 'dang_dem'",
    [nguoi.id || null, id]);
  if (!gianh.affectedRows) throw new LoiKiemKe('Phiếu vừa được người khác chốt.');

  let idPx = null, idPn = null, giaTriThieu = 0, giaTriThua = 0;
  try {
    if (thieu.length) {
      // Trong luc dem bep van ban -> ton hien tai co the thap hon so thieu tinh
      // theo luc chup; chi xuat toi da phan con lai trong kho.
      const [tonNay] = await db.query('SELECT id_nl, so_luong FROM nguyen_lieu WHERE id_nl IN (?)', [thieu.map((d) => d.id_nl)]);
      const mapTon = new Map(tonNay.map((r) => [Number(r.id_nl), Math.max(0, Number(r.so_luong))]));
      const dong = thieu.map((d) => ({
        id_nl: d.id_nl, so_luong: Math.min(-d.chenh, mapTon.get(Number(d.id_nl)) || 0), ghi_chu: d.ghi_chu || null,
      })).filter((d) => d.so_luong > 0);
      if (dong.length) {
        const px = await kho.taoPhieuXuat({ ly_do: 'kiem_ke', ghi_chu: `Chốt kiểm kê ${ct.ma_phieu}`, dong }, nguoi.id);
        idPx = px.id; giaTriThieu = px.tong_gia_tri;
      }
    }
    if (thua.length) {
      const pn = await kho.taoPhieuNhap({
        ghi_chu: `Điều chỉnh kiểm kê (thừa) ${ct.ma_phieu}`,
        dong: thua.map((d) => ({ id_nl: d.id_nl, so_luong: d.chenh, don_gia: d.gia_von, so_lo: 'KIEM-KE' })),
      }, nguoi.id);
      idPn = pn.id; giaTriThua = pn.tong_tien;
    }
  } catch (e) {
    // Khong sinh duoc phieu dieu chinh -> tra phieu ve 'dang_dem' de sua va chot lai.
    await db.query("UPDATE kiem_ke SET trang_thai = 'dang_dem', id_nv_chot = NULL, chot_luc = NULL WHERE id_kk = ?", [id]);
    throw e;
  }
  await db.query('UPDATE kiem_ke SET gia_tri_thieu = ?, gia_tri_thua = ?, id_px = ?, id_pn = ? WHERE id_kk = ?',
    [giaTriThieu, giaTriThua, idPx, idPn, id]);
  return { so_thieu: thieu.length, so_thua: thua.length, gia_tri_thieu: giaTriThieu, gia_tri_thua: giaTriThua, id_px: idPx, id_pn: idPn };
}

async function huy(id) {
  await damBaoBang();
  const [kq] = await db.query("UPDATE kiem_ke SET trang_thai = 'huy' WHERE id_kk = ? AND trang_thai = 'dang_dem'", [id]);
  if (!kq.affectedRows) throw new LoiKiemKe('Chỉ hủy được phiếu đang đếm.');
  return { ok: true };
}

/**
 * Bao cao hao hut trong ky: theo ly do, theo nguyen lieu, ty le so voi gia von
 * ban hang (so phan ban x gia von cong thuc).
 */
async function baoCaoHaoHut({ tuNgay, denNgay }) {
  await damBaoBang();
  const kho = require('./khoBepService');
  const lyDoHH = Object.keys(kho.LY_DO_XUAT).filter((k) => kho.LY_DO_XUAT[k].la_hao_hut);
  const [theoLyDo] = await db.query(
    `SELECT ly_do, COUNT(*) AS so_dong, SUM(COALESCE(gia_tri, 0)) AS gia_tri FROM xuat_kho
      WHERE ly_do IN (?) AND ngay_xuat BETWEEN ? AND ? GROUP BY ly_do`, [lyDoHH, tuNgay, denNgay]);
  const [theoNl] = await db.query(
    `SELECT x.id_nl, nl.ten_nl, dvt.ten_dvt, SUM(x.so_luong) AS so_luong, SUM(COALESCE(x.gia_tri, 0)) AS gia_tri
       FROM xuat_kho x JOIN nguyen_lieu nl ON nl.id_nl = x.id_nl LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
      WHERE x.ly_do IN (?) AND x.ngay_xuat BETWEEN ? AND ?
      GROUP BY x.id_nl, nl.ten_nl, dvt.ten_dvt ORDER BY gia_tri DESC LIMIT 10`, [lyDoHH, tuNgay, denNgay]);
  const gvMon = `(SELECT ct.id_mon, SUM(ct.so_luong_tieu_hao * nl.gia_von) AS gv FROM cong_thuc ct
                    JOIN nguyen_lieu nl ON nl.id_nl = ct.id_nl GROUP BY ct.id_mon)`;
  let huyMon = 0;
  try {
    const [[h]] = await db.query(
      `SELECT SUM(hm.so_luong * COALESCE(g.gv, 0)) AS gt FROM huy_mon hm LEFT JOIN ${gvMon} g ON g.id_mon = hm.id_mon
        WHERE hm.trangthai_bep >= 1 AND DATE(hm.tao_luc) BETWEEN ? AND ?`, [tuNgay, denNgay]);
    huyMon = Number(h.gt) || 0;
  } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; }
  const ll = await require('./laiLoService').phanTich({ tuNgay, denNgay, nhom: 'thang' });
  const tongXuat = theoLyDo.reduce((s, r) => s + Number(r.gia_tri), 0);
  const tong = tongXuat + huyMon;
  return {
    theo_ly_do: theoLyDo.map((r) => ({ ly_do: r.ly_do, ten: kho.LY_DO_XUAT[r.ly_do].ten, so_dong: Number(r.so_dong), gia_tri: Number(r.gia_tri) })),
    theo_nguyen_lieu: theoNl.map((r) => ({ ...r, so_luong: Number(r.so_luong), gia_tri: Number(r.gia_tri) })),
    huy_mon_da_nau: huyMon,
    tong_hao_hut: tong,
    gia_von_ban_hang: ll.tong.gia_von,
    ty_le: ll.tong.gia_von ? tong / ll.tong.gia_von : 0,
  };
}

module.exports = { damBaoBang, taoPhieu, danhSach, chiTiet, luuSoDem, chot, huy, baoCaoHaoHut, LoiKiemKe };

/**
 * BAO CAO THU CHI / SO QUY cho thu ngan.
 *
 * Gom hai nguon tien:
 *   1. TU DONG tu module thanh toan (`payments`):
 *        - thu: thanh toan hoa don, dat coc (status success, moc thanh_cong_luc)
 *        - chi: hoan tien (status refunded, moc updated_at)
 *   2. THU CONG: phieu thu / phieu chi thu ngan lap (`phieu_thu_chi`).
 *
 * Quy uoc moc thoi gian va cach tinh trung voi services/chotCaService.js de
 * con so tren bao cao va tren bien ban chot ca khop nhau.
 *
 * Tien TIP chi hien de doi chieu, KHONG cong vao tong thu: do la tien giu ho
 * nhan vien, khong phai doanh thu cua nha hang.
 */
const db = require('../config/db');

const DANH_MUC = {
  thu: {
    ban_hang: 'Bán hàng (hóa đơn)',
    dat_coc: 'Tiền đặt cọc',
    nop_quy: 'Nộp quỹ / tiền lẻ đầu ca',
    thanh_ly: 'Thanh lý vỏ chai, phế liệu',
    phu_thu: 'Phụ thu dịch vụ',
    boi_thuong: 'Khách bồi thường hư hỏng',
    thu_khac: 'Thu khác',
  },
  chi: {
    hoan_tien: 'Hoàn tiền khách',
    nguyen_lieu: 'Mua nguyên liệu gấp',
    vat_tu: 'Vật tư tiêu hao (đá, gas, giấy...)',
    van_chuyen: 'Phí vận chuyển / ship',
    sua_chua: 'Sửa chữa, bảo trì',
    tam_ung: 'Tạm ứng nhân viên',
    dien_nuoc: 'Điện, nước, internet',
    nop_tien: 'Nộp tiền về công ty / ngân hàng',
    chi_khac: 'Chi khác',
  },
};
/** Danh muc thu ngan duoc chon khi lap phieu (khong gom muc tu dong). */
const DANH_MUC_LAP = {
  thu: Object.keys(DANH_MUC.thu).filter((k) => !['ban_hang', 'dat_coc'].includes(k)),
  chi: Object.keys(DANH_MUC.chi).filter((k) => k !== 'hoan_tien'),
};
const PHUONG_THUC = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', the: 'Thẻ' };
const TOI_DA = 500000000;

class LoiThuChi extends Error {
  constructor(msg, ma = 'INVALID') { super(msg); this.name = 'LoiThuChi'; this.ma = ma; }
}

/** 'YYYY-MM-DD' -> [Date dau ngay, Date cuoi ngay] theo gio may chu. */
function khoang(tuNgay, denNgay) {
  const tu = new Date(`${tuNgay}T00:00:00`);
  const den = new Date(`${denNgay}T23:59:59`);
  if (Number.isNaN(tu.getTime()) || Number.isNaN(den.getTime())) throw new LoiThuChi('Khoảng ngày không hợp lệ.');
  if (den < tu) throw new LoiThuChi('Ngày kết thúc phải sau ngày bắt đầu.');
  if ((den - tu) / 86400000 > 370) throw new LoiThuChi('Chỉ xem tối đa 12 tháng mỗi lần.');
  return { tu, den };
}

const ptTuLoai = (type) => (type === 'cash' ? 'tien_mat' : type === 'card' ? 'the' : 'chuyen_khoan');

// ---------------------------------------------------------------- doc du lieu

/**
 * Moi dong tien trong khoang, da quy ve mot dang chung.
 * @returns {Promise<{thoi_diem, ma, loai, danh_muc, noi_dung, phuong_thuc, nguoi, so_tien, huy, ly_do_huy, nguon, id}[]>}
 */
async function dongTien({ tu, den, idNv = null }) {
  const locNv = idNv ? ' AND p.processed_by = ?' : '';
  const ts = idNv ? [tu, den, idNv] : [tu, den];

  const [thu] = await db.query(
    `SELECT p.id, p.sesis, p.amount, p.loai, p.tien_tip, p.ma_doi_soat, p.nguon,
            COALESCE(p.thanh_cong_luc, p.created_at) AS thoi_diem, pm.type, pm.name AS ten_pt,
            nv.ten AS nguoi,
            (SELECT b.number_ban FROM hopdong h JOIN ban b ON b.Id_ban = h.id_ban WHERE h.sesis = p.sesis LIMIT 1) AS ban
       FROM payments p
       JOIN payment_methods pm ON pm.id = p.payment_method_id
       LEFT JOIN nhan_vien nv ON nv.id_nv = p.processed_by
      WHERE p.status IN ('success','refunded')
        AND COALESCE(p.thanh_cong_luc, p.created_at) BETWEEN ? AND ?${locNv}`, ts);

  const [hoan] = await db.query(
    `SELECT p.id, p.sesis, p.amount, p.updated_at AS thoi_diem, pm.type, nv.ten AS nguoi, p.notes
       FROM payments p
       JOIN payment_methods pm ON pm.id = p.payment_method_id
       LEFT JOIN nhan_vien nv ON nv.id_nv = p.processed_by
      WHERE p.status = 'refunded' AND p.updated_at BETWEEN ? AND ?${locNv}`, ts);

  const [phieu] = await db.query(
    `SELECT t.*, nv.ten AS nguoi, nh.ten AS nguoi_huy
       FROM phieu_thu_chi t
       LEFT JOIN nhan_vien nv ON nv.id_nv = t.id_nv
       LEFT JOIN nhan_vien nh ON nh.id_nv = t.huy_boi
      WHERE t.thoi_diem BETWEEN ? AND ?${idNv ? ' AND t.id_nv = ?' : ''}`, ts);

  const ds = [];
  for (const r of thu) {
    const dc = r.loai === 'dat_coc';
    ds.push({
      nguon: 'payment', id: r.id, thoi_diem: r.thoi_diem,
      ma: r.ma_doi_soat || `TT${r.id}`, loai: 'thu', danh_muc: dc ? 'dat_coc' : 'ban_hang',
      noi_dung: (dc ? 'Đặt cọc ' : 'Thanh toán hóa đơn ') + (r.ban ? `bàn ${r.ban}` : (r.sesis || '').slice(0, 18)) +
        (r.nguon === 'khach_qr' ? ' (khách tự quét QR)' : r.nguon === 'web' ? ' (trực tuyến)' : ''),
      phuong_thuc: ptTuLoai(r.type), nguoi: r.nguoi || (r.nguon === 'quay' ? 'Quầy' : 'Khách tự trả'),
      so_tien: Number(r.amount), tip: Number(r.tien_tip) || 0, huy: false,
    });
  }
  for (const r of hoan) {
    ds.push({
      nguon: 'payment', id: r.id, thoi_diem: r.thoi_diem, ma: `HT${r.id}`, loai: 'chi', danh_muc: 'hoan_tien',
      noi_dung: 'Hoàn tiền ' + String(r.sesis || '').slice(0, 18) + (r.notes && /HOÀN TIỀN:/.test(r.notes) ? ' – ' + r.notes.split('HOÀN TIỀN:').pop().trim().slice(0, 80) : ''),
      phuong_thuc: ptTuLoai(r.type), nguoi: r.nguoi || '—', so_tien: Number(r.amount), tip: 0, huy: false,
    });
  }
  for (const r of phieu) {
    ds.push({
      nguon: 'phieu', id: r.id, thoi_diem: r.thoi_diem, ma: r.ma_phieu, loai: r.loai, danh_muc: r.danh_muc,
      noi_dung: r.noi_dung + (r.doi_tuong ? ` – ${r.loai === 'chi' ? 'người nhận' : 'người nộp'}: ${r.doi_tuong}` : '') +
        (r.so_chung_tu ? ` (CT: ${r.so_chung_tu})` : ''),
      phuong_thuc: r.phuong_thuc, nguoi: r.nguoi || 'Quản trị', so_tien: Number(r.so_tien), tip: 0,
      huy: r.trang_thai === 'da_huy', ly_do_huy: r.ly_do_huy, nguoi_huy: r.nguoi_huy, id_nv: r.id_nv,
    });
  }
  return ds.sort((a, b) => new Date(a.thoi_diem) - new Date(b.thoi_diem));
}

function ngayChuoi(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Bao cao day du cho mot khoang ngay. */
async function baoCao({ tuNgay, denNgay, idNv = null }) {
  const { tu, den } = khoang(tuNgay, denNgay);
  const ds = await dongTien({ tu, den, idNv });
  const hopLe = ds.filter((d) => !d.huy);

  const cong = (loc) => hopLe.filter(loc).reduce((s, d) => s + d.so_tien, 0);
  const tongThu = cong((d) => d.loai === 'thu');
  const tongChi = cong((d) => d.loai === 'chi');

  const theoPt = {};
  for (const k of Object.keys(PHUONG_THUC)) {
    theoPt[k] = { ten: PHUONG_THUC[k], thu: cong((d) => d.loai === 'thu' && d.phuong_thuc === k), chi: cong((d) => d.loai === 'chi' && d.phuong_thuc === k) };
    theoPt[k].thuan = theoPt[k].thu - theoPt[k].chi;
  }

  const gom = (loai) => Object.keys(DANH_MUC[loai]).map((k) => {
    const dong = hopLe.filter((d) => d.loai === loai && d.danh_muc === k);
    return { khoa: k, ten: DANH_MUC[loai][k], tien: dong.reduce((s, d) => s + d.so_tien, 0), so: dong.length };
  }).filter((x) => x.so > 0).sort((a, b) => b.tien - a.tien);

  // Theo ngay: du moi ngay trong khoang (ke ca ngay khong co giao dich) de bieu do khong bi nhay coc.
  const theoNgay = [];
  for (let d = new Date(tu); d <= den; d.setDate(d.getDate() + 1)) {
    const k = ngayChuoi(d);
    const dong = hopLe.filter((x) => ngayChuoi(x.thoi_diem) === k);
    theoNgay.push({
      ngay: k,
      thu: dong.filter((x) => x.loai === 'thu').reduce((s, x) => s + x.so_tien, 0),
      chi: dong.filter((x) => x.loai === 'chi').reduce((s, x) => s + x.so_tien, 0),
    });
  }

  // So quy: so du luy ke (chi tinh phieu hop le).
  let soDu = 0;
  const soQuy = ds.map((d) => {
    if (!d.huy) soDu += d.loai === 'thu' ? d.so_tien : -d.so_tien;
    return {
      ...d, so_du: soDu,
      ten_danh_muc: DANH_MUC[d.loai][d.danh_muc] || d.danh_muc,
      ten_phuong_thuc: PHUONG_THUC[d.phuong_thuc] || d.phuong_thuc,
    };
  });

  return {
    tu_ngay: tuNgay, den_ngay: denNgay,
    tong_thu: tongThu, tong_chi: tongChi, chenh_lech: tongThu - tongChi,
    so_giao_dich: hopLe.length, so_phieu_huy: ds.filter((d) => d.huy).length,
    tien_tip: hopLe.reduce((s, d) => s + (d.tip || 0), 0),
    theo_phuong_thuc: theoPt,
    thu_theo_nguon: gom('thu'),
    chi_theo_danh_muc: gom('chi'),
    theo_ngay: theoNgay,
    so_quy: soQuy,
  };
}

// ---------------------------------------------------------------- lap / huy phieu

async function taoMaPhieu(conn, loai) {
  const d = new Date();
  const tienTo = `${loai === 'thu' ? 'PT' : 'PC'}${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const [[r]] = await conn.query('SELECT COUNT(*) AS n FROM phieu_thu_chi WHERE ma_phieu LIKE ?', [`${tienTo}-%`]);
  return `${tienTo}-${String(Number(r.n) + 1).padStart(3, '0')}`;
}

async function lapPhieu(body, idNv) {
  const loai = String(body.loai || '');
  const danhMuc = String(body.danh_muc || '');
  const soTien = Math.round(Number(String(body.so_tien || '').replace(/[^\d]/g, '')));
  const pt = String(body.phuong_thuc || 'tien_mat');
  const noiDung = String(body.noi_dung || '').trim();

  if (!DANH_MUC_LAP[loai]) throw new LoiThuChi('Chọn loại phiếu thu hoặc phiếu chi.');
  if (!DANH_MUC_LAP[loai].includes(danhMuc)) throw new LoiThuChi('Danh mục không hợp lệ.');
  if (!Number.isFinite(soTien) || soTien < 1000) throw new LoiThuChi('Số tiền tối thiểu 1.000đ.');
  if (soTien > TOI_DA) throw new LoiThuChi('Số tiền vượt hạn mức một phiếu (500 triệu). Vui lòng liên hệ kế toán.');
  if (!['tien_mat', 'chuyen_khoan'].includes(pt)) throw new LoiThuChi('Phương thức không hợp lệ.');
  if (noiDung.length < 3) throw new LoiThuChi('Vui lòng ghi rõ nội dung thu / chi.');

  // Ma phieu tang theo ngay - thu lai neu hai thu ngan lap cung luc trung ma.
  for (let lan = 0; lan < 5; lan++) {
    const ma = await taoMaPhieu(db, loai);
    try {
      const [kq] = await db.query(
        `INSERT INTO phieu_thu_chi (ma_phieu, loai, danh_muc, so_tien, phuong_thuc, doi_tuong, noi_dung, so_chung_tu, thoi_diem, id_nv)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [ma, loai, danhMuc, soTien, pt, String(body.doi_tuong || '').trim().slice(0, 150) || null,
          noiDung.slice(0, 500), String(body.so_chung_tu || '').trim().slice(0, 60) || null, idNv || null]);
      return { id: kq.insertId, ma_phieu: ma };
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
  throw new LoiThuChi('Hệ thống đang bận, vui lòng thử lại.', 'BUSY');
}

/**
 * Huy phieu. Nguoi lap tu huy duoc khi phieu CHUA nam trong mot bien ban chot
 * ca da ky (tien da doi soat roi thi khong duoc lang le rut lai). Ke toan / quan
 * ly huy duoc moi phieu, van phai ghi ly do.
 */
async function huyPhieu(id, { lyDo, idNv, laQuanLy }) {
  const ly = String(lyDo || '').trim();
  if (ly.length < 3) throw new LoiThuChi('Bắt buộc ghi lý do hủy phiếu.');
  const [[p]] = await db.query('SELECT * FROM phieu_thu_chi WHERE id = ?', [id]);
  if (!p) throw new LoiThuChi('Không tìm thấy phiếu.', 'NOT_FOUND');
  if (p.trang_thai === 'da_huy') throw new LoiThuChi('Phiếu đã hủy trước đó.');

  if (!laQuanLy) {
    if (Number(p.id_nv) !== Number(idNv)) throw new LoiThuChi('Bạn chỉ hủy được phiếu do chính mình lập.', 'FORBIDDEN');
    const [[ca]] = await db.query(
      "SELECT MAX(shift_end) AS het FROM shift_closings WHERE id_nv = ? AND status IN ('closed','verified')", [idNv]);
    if (ca && ca.het && new Date(p.thoi_diem) <= new Date(ca.het)) {
      throw new LoiThuChi('Phiếu đã nằm trong biên bản chốt ca – chỉ kế toán hoặc quản lý được hủy.', 'FORBIDDEN');
    }
  }
  await db.query(
    "UPDATE phieu_thu_chi SET trang_thai = 'da_huy', ly_do_huy = ?, huy_boi = ?, huy_luc = NOW() WHERE id = ? AND trang_thai = 'hop_le'",
    [ly.slice(0, 300), idNv || null, id]);
  await db.query(
    `INSERT INTO audit_logs (action, actor_type, actor_id, resource_type, resource_id, status, details)
     VALUES ('huy_phieu_thu_chi', 'staff', ?, 'phieu_thu_chi', ?, 'success', ?)`,
    [idNv || null, id, JSON.stringify({ ma: p.ma_phieu, so_tien: p.so_tien, ly_do: ly })]).catch(() => {});
  return { ok: true };
}

/** Tong phieu TIEN MAT cua mot thu ngan trong khoang - dung cho chot ca. */
async function phieuTienMatTrongCa(idNv, tu, den, tiepNoi) {
  const [[r]] = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN loai = 'thu' THEN so_tien END), 0) AS thu,
            COALESCE(SUM(CASE WHEN loai = 'chi' THEN so_tien END), 0) AS chi,
            COUNT(*) AS so
       FROM phieu_thu_chi
      WHERE id_nv = ? AND phuong_thuc = 'tien_mat' AND trang_thai = 'hop_le'
        AND thoi_diem ${tiepNoi ? '>' : '>='} ? AND thoi_diem <= ?`, [idNv, tu, den]);
  return { thu: Number(r.thu) || 0, chi: Number(r.chi) || 0, so: Number(r.so) || 0 };
}

// ---------------------------------------------------------------- xuat excel

async function xuatExcel(bc, { tenNguoiXem = '', phamVi = '' } = {}) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nhà Hàng Bảo Đoàn';
  const vnd = '#,##0" đ"';
  const dam = { bold: true };
  const nenVang = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E7C9' } };

  const ws = wb.addWorksheet('Tổng hợp');
  ws.columns = [{ width: 38 }, { width: 20 }, { width: 20 }, { width: 20 }];
  ws.addRow(['BÁO CÁO THU CHI – NHÀ HÀNG BẢO ĐOÀN']).font = { bold: true, size: 14 };
  ws.addRow([`Từ ${bc.tu_ngay} đến ${bc.den_ngay}`, phamVi]);
  ws.addRow([`Người xuất: ${tenNguoiXem}`, `Lúc: ${new Date().toLocaleString('vi-VN')}`]);
  ws.addRow([]);
  [['Tổng thu', bc.tong_thu], ['Tổng chi', bc.tong_chi], ['Chênh lệch thu – chi', bc.chenh_lech], ['Tiền tip (giữ hộ nhân viên, không tính vào thu)', bc.tien_tip]]
    .forEach(([a, b]) => { const r = ws.addRow([a, b]); r.getCell(2).numFmt = vnd; r.font = dam; });
  ws.addRow([]);
  const h1 = ws.addRow(['Phương thức', 'Thu', 'Chi', 'Thuần']); h1.font = dam; h1.eachCell((c) => { c.fill = nenVang; });
  Object.values(bc.theo_phuong_thuc).forEach((p) => {
    const r = ws.addRow([p.ten, p.thu, p.chi, p.thuan]); [2, 3, 4].forEach((i) => { r.getCell(i).numFmt = vnd; });
  });
  ws.addRow([]);
  const h2 = ws.addRow(['Khoản thu', 'Số tiền', 'Số giao dịch']); h2.font = dam; h2.eachCell((c) => { c.fill = nenVang; });
  bc.thu_theo_nguon.forEach((x) => { const r = ws.addRow([x.ten, x.tien, x.so]); r.getCell(2).numFmt = vnd; });
  ws.addRow([]);
  const h3 = ws.addRow(['Khoản chi', 'Số tiền', 'Số giao dịch']); h3.font = dam; h3.eachCell((c) => { c.fill = nenVang; });
  bc.chi_theo_danh_muc.forEach((x) => { const r = ws.addRow([x.ten, x.tien, x.so]); r.getCell(2).numFmt = vnd; });

  const sq = wb.addWorksheet('Sổ quỹ chi tiết');
  sq.columns = [
    { header: 'Thời điểm', width: 19 }, { header: 'Mã chứng từ', width: 18 }, { header: 'Loại', width: 7 },
    { header: 'Danh mục', width: 28 }, { header: 'Nội dung', width: 50 }, { header: 'Phương thức', width: 14 },
    { header: 'Người thực hiện', width: 22 }, { header: 'Thu', width: 15 }, { header: 'Chi', width: 15 },
    { header: 'Số dư lũy kế', width: 16 }, { header: 'Trạng thái', width: 26 },
  ];
  sq.getRow(1).font = dam; sq.getRow(1).eachCell((c) => { c.fill = nenVang; });
  bc.so_quy.forEach((d) => {
    const r = sq.addRow([
      new Date(d.thoi_diem).toLocaleString('vi-VN'), d.ma, d.loai === 'thu' ? 'Thu' : 'Chi', d.ten_danh_muc, d.noi_dung,
      d.ten_phuong_thuc, d.nguoi, d.loai === 'thu' ? d.so_tien : null, d.loai === 'chi' ? d.so_tien : null, d.so_du,
      d.huy ? `ĐÃ HỦY: ${d.ly_do_huy || ''}` : 'Hợp lệ',
    ]);
    [8, 9, 10].forEach((i) => { r.getCell(i).numFmt = vnd; });
    if (d.huy) r.font = { strike: true, color: { argb: 'FF999999' } };
  });
  sq.views = [{ state: 'frozen', ySplit: 1 }];
  return wb.xlsx.writeBuffer();
}

module.exports = {
  DANH_MUC, DANH_MUC_LAP, PHUONG_THUC, LoiThuChi,
  baoCao, lapPhieu, huyPhieu, phieuTienMatTrongCa, xuatExcel,
};

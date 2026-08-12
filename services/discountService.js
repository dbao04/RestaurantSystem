/**
 * DISCOUNT & PAYMENT SERVICE
 *
 * Quan ly chuong trinh khuyen mai (ma giam gia) va thanh toan.
 *
 * Mot ma giam gia o day khong chi la "giam bao nhieu" ma la mot bo dieu kien
 * quan tri vien tu chinh duoc trong /admin/khuyen-mai:
 *
 *   PHAM VI   ca don | mot so loai mon | mot so mon cu the
 *   THOI GIAN khoang ngay + thu trong tuan + khung gio trong ngay
 *   DOI TUONG hang thanh vien toi thieu, so luot toi da moi khach
 *   KENH      quay thu ngan | khach tu quet QR | ca hai
 *   MUC GIAM  % hoac so tien, co tran giam va don toi thieu
 *
 * Moi luot dung deu ghi vao `discount_usages` - vua de chan gioi han theo
 * khach, vua de bao cao chuong trinh nao thuc su keo doanh thu.
 */

const db = require('../config/db');

// Thu tu hang thanh vien, dung de so sanh "tu hang X tro len".
const THU_TU_HANG = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
const TEN_HANG = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch kim' };
const TEN_THU = { 1: 'CN', 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7' };

const chuanHoaMa = (code) => String(code || '').trim().toUpperCase();

/** Tach chuoi CSV id thanh mang so nguyen, bo cac phan tu rac. */
function tachIds(csv) {
  return String(csv || '')
    .split(',')
    .map((x) => parseInt(String(x).trim(), 10))
    .filter((x) => Number.isFinite(x) && x > 0);
}

/** Chuoi mo ta dieu kien de hien trong danh sach quan tri / goi y thu ngan. */
function moTaDieuKien(km) {
  const phan = [];
  if (km.pham_vi === 'loai_mon') phan.push('Chỉ một số loại món');
  if (km.pham_vi === 'mon') phan.push('Chỉ một số món');
  const thu = tachIds(km.ap_dung_thu);
  if (thu.length > 0 && thu.length < 7) phan.push(thu.map((t) => TEN_THU[t] || t).join(', '));
  if (km.gio_bat_dau && km.gio_ket_thuc) {
    phan.push(String(km.gio_bat_dau).slice(0, 5) + '–' + String(km.gio_ket_thuc).slice(0, 5));
  }
  if (km.hang_toi_thieu) phan.push('Hạng ' + (TEN_HANG[km.hang_toi_thieu] || km.hang_toi_thieu) + ' trở lên');
  if (km.gioi_han_moi_khach) phan.push(km.gioi_han_moi_khach + ' lượt/khách');
  if (km.kenh === 'quay') phan.push('Chỉ tại quầy');
  if (km.kenh === 'khach_qr') phan.push('Chỉ khách quét QR');
  return phan;
}

// ============ DISCOUNT SERVICE ============
const discountService = {
  THU_TU_HANG,
  TEN_HANG,
  TEN_THU,
  chuanHoaMa,
  tachIds,
  moTaDieuKien,

  /**
   * Phan tien cua don ma ma nay duoc phep giam tren do.
   *
   * Voi pham vi "tat_ca" thi la toan bo tam tinh. Voi pham vi hep hon, chi
   * cong cac dong mon nam trong danh sach - neu khong "giam 20% mon nuong"
   * se giam 20% ca ban lau ngoi cung ban.
   *
   * @param {object} km    ban ghi discount_codes
   * @param {number} tamTinh tong tien don
   * @param {Array}  mon   [{ id_mon, thanhtien }] cac dong mon cua don
   */
  tinhNenApDung: async (km, tamTinh, mon) => {
    if (!km.pham_vi || km.pham_vi === 'tat_ca') return Number(tamTinh) || 0;

    const ids = tachIds(km.pham_vi_ids);
    if (ids.length === 0) return 0;
    if (!Array.isArray(mon) || mon.length === 0) {
      // Khong biet don gom mon gi (vi du man hinh chi truyen tong tien) thi
      // khong the tinh dung phan duoc giam -> tra 0 de ma bi tu choi, an toan
      // hon la giam nham tren ca don.
      return 0;
    }

    if (km.pham_vi === 'mon') {
      return mon
        .filter((m) => ids.includes(Number(m.id_mon)))
        .reduce((t, m) => t + Number(m.thanhtien || 0), 0);
    }

    // pham_vi === 'loai_mon': phai tra bang monan de biet mon thuoc loai nao.
    const idMon = [...new Set(mon.map((m) => Number(m.id_mon)).filter(Boolean))];
    if (idMon.length === 0) return 0;
    const [rows] = await db.query(
      `SELECT id_mon, id_loai FROM monan WHERE id_mon IN (${idMon.map(() => '?').join(',')})`,
      idMon
    );
    const loaiCuaMon = new Map(rows.map((r) => [Number(r.id_mon), Number(r.id_loai)]));
    return mon
      .filter((m) => ids.includes(loaiCuaMon.get(Number(m.id_mon))))
      .reduce((t, m) => t + Number(m.thanhtien || 0), 0);
  },

  /**
   * Kiem tra mot ma co dung duoc cho don nay khong.
   *
   * @param {string} code
   * @param {number} orderValue tam tinh cua don
   * @param {object} ctx
   *   - idKhach   id khach hang (null = khach vang lai, bo qua kiem tra hang/luot)
   *   - hangKhach 'bronze'|'silver'|'gold'|'platinum'
   *   - kenh      'quay' | 'khach_qr'
   *   - mon       [{ id_mon, thanhtien }]
   */
  validateCode: async (code, orderValue = 0, ctx = {}) => {
    try {
      const ma = chuanHoaMa(code);
      if (!ma) return { valid: false, message: 'Chưa nhập mã giảm giá' };

      const [rows] = await db.query(
        'SELECT * FROM discount_codes WHERE code = ? LIMIT 1',
        [ma]
      );
      if (rows.length === 0) {
        return { valid: false, message: 'Mã giảm giá không tồn tại' };
      }

      const km = rows[0];
      const kt = await discountService.kiemTraDieuKien(km, orderValue, ctx);
      if (!kt.valid) return kt;

      return { valid: true, discount: km, nen: kt.nen };
    } catch (err) {
      console.error('Error validating discount code:', err);
      return { valid: false, message: 'Lỗi kiểm tra mã giảm giá' };
    }
  },

  /**
   * Toan bo luat cua mot ma, tach rieng khoi validateCode de phan goi y
   * (goiYApDung) dung lai duoc ma khong phai truy van tung ma mot lan nua.
   */
  kiemTraDieuKien: async (km, orderValue = 0, ctx = {}) => {
    const tien = Number(orderValue) || 0;

    if (!km.is_active) {
      return { valid: false, message: 'Mã giảm giá đang tạm ngưng' };
    }

    // --- Khoang ngay ---
    const bayGio = new Date();
    if (km.valid_from && bayGio < new Date(km.valid_from)) {
      return { valid: false, message: 'Mã giảm giá chưa tới ngày áp dụng' };
    }
    if (km.valid_until && bayGio > new Date(km.valid_until)) {
      return { valid: false, message: 'Mã giảm giá đã hết hạn' };
    }

    // --- Thu trong tuan (quy uoc DAYOFWEEK: 1=CN ... 7=T7) ---
    const thu = tachIds(km.ap_dung_thu);
    if (thu.length > 0 && !thu.includes(bayGio.getDay() + 1)) {
      return {
        valid: false,
        message: 'Mã này chỉ áp dụng ' + thu.map((t) => TEN_THU[t] || t).join(', ')
      };
    }

    // --- Khung gio trong ngay ---
    if (km.gio_bat_dau && km.gio_ket_thuc) {
      const phut = bayGio.getHours() * 60 + bayGio.getMinutes();
      const doiPhut = (s) => {
        const [h, m] = String(s).split(':');
        return Number(h) * 60 + Number(m || 0);
      };
      const batDau = doiPhut(km.gio_bat_dau);
      const ketThuc = doiPhut(km.gio_ket_thuc);
      // Khung qua nua dem (22:00 - 02:00) thi batDau > ketThuc.
      const trongKhung = batDau <= ketThuc
        ? (phut >= batDau && phut <= ketThuc)
        : (phut >= batDau || phut <= ketThuc);
      if (!trongKhung) {
        return {
          valid: false,
          message: `Mã này chỉ áp dụng từ ${String(km.gio_bat_dau).slice(0, 5)} đến ${String(km.gio_ket_thuc).slice(0, 5)}`
        };
      }
    }

    // --- Kenh ban ---
    if (km.kenh && km.kenh !== 'tat_ca' && ctx.kenh && km.kenh !== ctx.kenh) {
      return {
        valid: false,
        message: km.kenh === 'quay'
          ? 'Mã này chỉ áp dụng khi thanh toán tại quầy'
          : 'Mã này chỉ áp dụng khi khách tự quét QR tại bàn'
      };
    }

    // --- Tong so luot ---
    if (km.max_usage && Number(km.current_usage || 0) >= Number(km.max_usage)) {
      return { valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' };
    }

    // --- Gioi han theo tung khach ---
    if (km.gioi_han_moi_khach && ctx.idKhach) {
      const [[d]] = await db.query(
        'SELECT COUNT(*) AS n FROM discount_usages WHERE discount_id = ? AND id_kh = ?',
        [km.id, ctx.idKhach]
      );
      if (Number(d.n || 0) >= Number(km.gioi_han_moi_khach)) {
        return {
          valid: false,
          message: `Bạn đã dùng mã này ${d.n}/${km.gioi_han_moi_khach} lượt cho phép`
        };
      }
    }

    // --- Hang thanh vien ---
    if (km.hang_toi_thieu) {
      const can = THU_TU_HANG[km.hang_toi_thieu] || 0;
      const dangCo = THU_TU_HANG[ctx.hangKhach] || 0;
      if (dangCo < can) {
        return {
          valid: false,
          message: `Mã dành cho khách hạng ${TEN_HANG[km.hang_toi_thieu] || km.hang_toi_thieu} trở lên`
        };
      }
    }

    // --- Don toi thieu ---
    if (km.min_order_value && tien < Number(km.min_order_value)) {
      return {
        valid: false,
        message: `Đơn hàng tối thiểu ${Number(km.min_order_value).toLocaleString('vi-VN')} ₫`
      };
    }

    // --- Pham vi mon ---
    const nen = await discountService.tinhNenApDung(km, tien, ctx.mon);
    if (nen <= 0) {
      return { valid: false, message: 'Đơn hàng không có món nào thuộc chương trình này' };
    }

    return { valid: true, nen };
  },

  /**
   * Tinh so tien duoc giam tren phan `nen` (mac dinh la ca don).
   */
  calculateDiscount: (discount, orderValue, nen = null) => {
    const canCu = Number(nen != null ? nen : orderValue) || 0;
    let discountAmount = 0;

    if (discount.discount_type === 'percentage') {
      discountAmount = (canCu * Number(discount.discount_value)) / 100;
    } else {
      discountAmount = Number(discount.discount_value);
    }

    // Tran giam
    if (discount.max_discount_amount && discountAmount > Number(discount.max_discount_amount)) {
      discountAmount = Number(discount.max_discount_amount);
    }

    // Khong giam qua phan duoc phep giam, va khong giam qua gia tri don.
    discountAmount = Math.min(discountAmount, canCu, Number(orderValue) || 0);
    return Math.round(Math.max(0, discountAmount));
  },

  /**
   * Ap ma vao mot don. Tra ve so tien giam da tinh xong.
   */
  applyCode: async (code, orderValue, ctx = {}) => {
    const validation = await discountService.validateCode(code, orderValue, ctx);

    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    const discount = validation.discount;
    const discountAmount = discountService.calculateDiscount(discount, orderValue, validation.nen);

    return {
      success: true,
      discount_id: discount.id,
      code: discount.code,
      ten: discount.ten || discount.code,
      discount_type: discount.discount_type,
      discount_value: Number(discount.discount_value),
      pham_vi: discount.pham_vi || 'tat_ca',
      nen_ap_dung: validation.nen,
      discount_amount: discountAmount,
      final_value: (Number(orderValue) || 0) - discountAmount
    };
  },

  /**
   * Danh sach ma DUNG DUOC cho don nay, sap theo so tien giam giam dan.
   *
   * Dung cho o "gợi ý" cua thu ngan va trang khach tu thanh toan: quan tri
   * vien tao ma xong thi thu ngan thay ngay, khong phai nho ma bang tay.
   */
  goiYApDung: async (orderValue, ctx = {}) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM discount_codes
         WHERE is_active = 1 AND hien_thi_khach = 1
           AND valid_from <= NOW() AND valid_until >= NOW()
         ORDER BY do_uu_tien DESC, id DESC`
      );

      const ketQua = [];
      for (const km of rows) {
        const kt = await discountService.kiemTraDieuKien(km, orderValue, ctx);
        if (!kt.valid) continue;
        const soTien = discountService.calculateDiscount(km, orderValue, kt.nen);
        if (soTien <= 0) continue;
        ketQua.push({
          id: km.id,
          code: km.code,
          ten: km.ten || km.code,
          mo_ta: km.description,
          discount_type: km.discount_type,
          discount_value: Number(km.discount_value),
          so_tien_giam: soTien,
          do_uu_tien: Number(km.do_uu_tien || 0),
          dieu_kien: moTaDieuKien(km)
        });
      }

      ketQua.sort((a, b) => (b.do_uu_tien - a.do_uu_tien) || (b.so_tien_giam - a.so_tien_giam));
      return ketQua;
    } catch (err) {
      console.error('Error suggesting discounts:', err);
      return [];
    }
  },

  /**
   * Ghi nhan mot luot dung THAT SU (goi sau khi tien da vao).
   *
   * `payment_id` co khoa duy nhat nen goi lai lan hai cho cung phien se khong
   * cong them luot - webhook ngan hang va thu ngan bam xac nhan thu cong deu
   * chay qua day.
   */
  ghiNhanSuDung: async ({ code, idKhach = null, sesis = null, paymentId = null, soTienGiam = 0, giaTriDon = 0 }) => {
    const ma = chuanHoaMa(code);
    if (!ma) return false;
    try {
      const [[km]] = await db.query('SELECT id FROM discount_codes WHERE code = ? LIMIT 1', [ma]);
      if (!km) return false;

      const [kq] = await db.query(
        `INSERT IGNORE INTO discount_usages
           (discount_id, code, id_kh, sesis, payment_id, so_tien_giam, gia_tri_don)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [km.id, ma, idKhach, sesis, paymentId, Math.round(Number(soTienGiam) || 0), Math.round(Number(giaTriDon) || 0)]
      );

      // affectedRows = 0 nghia la phien nay da duoc ghi truoc do -> khong dem lai.
      if (kq.affectedRows > 0) {
        await db.query(
          'UPDATE discount_codes SET current_usage = current_usage + 1 WHERE id = ?',
          [km.id]
        );
      }
      return true;
    } catch (err) {
      console.error('Error recording discount usage:', err);
      return false;
    }
  },

  /**
   * Tang so lan da dung (giu lai cho cac loi goi cu khong co ngu canh).
   */
  useCode: async (code, thongTin = {}) => {
    return discountService.ghiNhanSuDung({ code, ...thongTin });
  },

  /**
   * Danh sach ma dang chay (cong khai).
   */
  getActiveDiscounts: async () => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM discount_codes
        WHERE is_active = 1
        AND valid_from <= NOW()
        AND valid_until >= NOW()
        ORDER BY do_uu_tien DESC, created_at DESC`
      );
      return rows;
    } catch (err) {
      console.error('Error getting active discounts:', err);
      return [];
    }
  },

  /* ====================================================================== */
  /* QUAN TRI                                                               */
  /* ====================================================================== */

  /**
   * Chuan hoa du lieu tu form quan tri ve dung kieu cot.
   * Tra ve object chi gom cac truong hop le - form gui gi khac deu bi bo.
   */
  chuanHoaForm: (body = {}) => {
    const so = (v) => (v === '' || v == null ? null : Number(v));
    const chuoi = (v) => {
      const s = String(v == null ? '' : v).trim();
      return s === '' ? null : s;
    };

    // Checkbox nhieu gia tri: express gui string khi chon 1, array khi chon nhieu.
    const gomThu = (v) => {
      if (v == null) return null;
      const arr = (Array.isArray(v) ? v : [v])
        .map((x) => parseInt(x, 10))
        .filter((x) => x >= 1 && x <= 7);
      // Chon du 7 thu = khong gioi han, luu NULL cho gon.
      return arr.length === 0 || arr.length === 7 ? null : [...new Set(arr)].sort().join(',');
    };

    const phamVi = ['tat_ca', 'loai_mon', 'mon'].includes(body.pham_vi) ? body.pham_vi : 'tat_ca';
    const phamViIds = phamVi === 'tat_ca'
      ? null
      : (tachIds(Array.isArray(body.pham_vi_ids) ? body.pham_vi_ids.join(',') : body.pham_vi_ids).join(',') || null);

    return {
      code: chuanHoaMa(body.code),
      ten: chuoi(body.ten),
      description: chuoi(body.description),
      discount_type: body.discount_type === 'fixed_amount' ? 'fixed_amount' : 'percentage',
      discount_value: so(body.discount_value) || 0,
      max_usage: so(body.max_usage),
      valid_from: chuoi(body.valid_from),
      valid_until: chuoi(body.valid_until),
      min_order_value: so(body.min_order_value),
      max_discount_amount: so(body.max_discount_amount),
      pham_vi: phamVi,
      pham_vi_ids: phamViIds,
      ap_dung_thu: gomThu(body.ap_dung_thu),
      gio_bat_dau: chuoi(body.gio_bat_dau),
      gio_ket_thuc: chuoi(body.gio_ket_thuc),
      gioi_han_moi_khach: so(body.gioi_han_moi_khach),
      hang_toi_thieu: ['bronze', 'silver', 'gold', 'platinum'].includes(body.hang_toi_thieu)
        ? body.hang_toi_thieu : null,
      kenh: ['tat_ca', 'quay', 'khach_qr'].includes(body.kenh) ? body.kenh : 'tat_ca',
      do_uu_tien: so(body.do_uu_tien) || 0,
      hien_thi_khach: body.hien_thi_khach ? 1 : 0,
      is_active: body.is_active ? 1 : 0
    };
  },

  /** Kiem tra logic truoc khi luu. Nem Error voi thong bao tieng Viet. */
  kiemTraForm: (d) => {
    if (!d.code) throw new Error('Chưa nhập mã khuyến mãi');
    if (!/^[A-Z0-9_-]{3,50}$/.test(d.code)) {
      throw new Error('Mã chỉ gồm chữ in hoa, số, gạch ngang hoặc gạch dưới (3–50 ký tự)');
    }
    if (!d.ten) throw new Error('Chưa nhập tên chương trình');
    if (!(d.discount_value > 0)) throw new Error('Mức giảm phải lớn hơn 0');
    if (d.discount_type === 'percentage' && d.discount_value > 100) {
      throw new Error('Giảm theo phần trăm không được vượt quá 100%');
    }
    if (!d.valid_from || !d.valid_until) throw new Error('Chưa chọn thời gian áp dụng');
    if (new Date(d.valid_until) <= new Date(d.valid_from)) {
      throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }
    if (d.pham_vi !== 'tat_ca' && !d.pham_vi_ids) {
      throw new Error('Đã chọn giới hạn phạm vi thì phải chọn ít nhất một mục');
    }
    if ((d.gio_bat_dau && !d.gio_ket_thuc) || (!d.gio_bat_dau && d.gio_ket_thuc)) {
      throw new Error('Khung giờ phải điền cả giờ bắt đầu và giờ kết thúc');
    }
    if (d.max_usage != null && d.max_usage < 0) throw new Error('Tổng lượt dùng không được âm');
    if (d.gioi_han_moi_khach != null && d.gioi_han_moi_khach < 1) {
      throw new Error('Giới hạn mỗi khách phải từ 1 lượt trở lên');
    }
  },

  /**
   * Danh sach cho trang quan tri, kem so lieu su dung.
   * @param {object} loc { tuKhoa, trangThai: 'dang_chay'|'sap_toi'|'het_han'|'tam_ngung' }
   */
  layDanhSach: async (loc = {}) => {
    const dieuKien = [];
    const thamSo = [];

    if (loc.tuKhoa) {
      dieuKien.push('(d.code LIKE ? OR d.ten LIKE ? OR d.description LIKE ?)');
      const k = '%' + loc.tuKhoa + '%';
      thamSo.push(k, k, k);
    }
    if (loc.trangThai === 'tam_ngung') dieuKien.push('d.is_active = 0');
    if (loc.trangThai === 'dang_chay') dieuKien.push('d.is_active = 1 AND d.valid_from <= NOW() AND d.valid_until >= NOW()');
    if (loc.trangThai === 'sap_toi') dieuKien.push('d.is_active = 1 AND d.valid_from > NOW()');
    if (loc.trangThai === 'het_han') dieuKien.push('d.valid_until < NOW()');

    const [rows] = await db.query(
      `SELECT d.*,
              (SELECT COUNT(*) FROM discount_usages u WHERE u.discount_id = d.id) AS so_luot_that,
              (SELECT COALESCE(SUM(u.so_tien_giam), 0) FROM discount_usages u WHERE u.discount_id = d.id) AS tong_giam,
              (SELECT COALESCE(SUM(u.gia_tri_don), 0) FROM discount_usages u WHERE u.discount_id = d.id) AS tong_doanh_thu
       FROM discount_codes d
       ${dieuKien.length ? 'WHERE ' + dieuKien.join(' AND ') : ''}
       ORDER BY d.is_active DESC, d.do_uu_tien DESC, d.created_at DESC`,
      thamSo
    );
    return rows;
  },

  layTheoId: async (id) => {
    const [rows] = await db.query('SELECT * FROM discount_codes WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  /** Vai chuc luot gan nhat cua mot ma, de xem ai da dung. */
  layLichSuDung: async (id, gioiHan = 50) => {
    const [rows] = await db.query(
      `SELECT u.*, k.ten AS ten_khach, k.sodienthoai
       FROM discount_usages u
       LEFT JOIN khach_hang k ON u.id_kh = k.id
       WHERE u.discount_id = ?
       ORDER BY u.id DESC
       LIMIT ?`,
      [id, Number(gioiHan) || 50]
    );
    return rows;
  },

  /** So lieu tong quan cho dau trang quan tri. */
  thongKeTongQuan: async () => {
    const [[r]] = await db.query(
      `SELECT
         COUNT(*) AS tong,
         SUM(is_active = 1 AND valid_from <= NOW() AND valid_until >= NOW()) AS dang_chay,
         SUM(is_active = 1 AND valid_from > NOW()) AS sap_toi,
         SUM(valid_until < NOW()) AS het_han
       FROM discount_codes`
    );
    const [[u]] = await db.query(
      `SELECT COUNT(*) AS luot_30_ngay,
              COALESCE(SUM(so_tien_giam), 0) AS giam_30_ngay
       FROM discount_usages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    return {
      tong: Number(r.tong || 0),
      dang_chay: Number(r.dang_chay || 0),
      sap_toi: Number(r.sap_toi || 0),
      het_han: Number(r.het_han || 0),
      luot_30_ngay: Number(u.luot_30_ngay || 0),
      giam_30_ngay: Number(u.giam_30_ngay || 0)
    };
  },

  /**
   * Tao ma moi (Admin).
   */
  createCode: async (data) => {
    const d = discountService.chuanHoaForm(data);
    discountService.kiemTraForm(d);

    const [existing] = await db.query('SELECT id FROM discount_codes WHERE code = ?', [d.code]);
    if (existing.length > 0) throw new Error('Mã khuyến mãi này đã tồn tại');

    const [kq] = await db.query(
      `INSERT INTO discount_codes (
        code, ten, description, discount_type, discount_value,
        max_usage, valid_from, valid_until, min_order_value, max_discount_amount,
        pham_vi, pham_vi_ids, ap_dung_thu, gio_bat_dau, gio_ket_thuc,
        gioi_han_moi_khach, hang_toi_thieu, kenh, do_uu_tien, hien_thi_khach,
        is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.code, d.ten, d.description, d.discount_type, d.discount_value,
        d.max_usage, d.valid_from, d.valid_until, d.min_order_value, d.max_discount_amount,
        d.pham_vi, d.pham_vi_ids, d.ap_dung_thu, d.gio_bat_dau, d.gio_ket_thuc,
        d.gioi_han_moi_khach, d.hang_toi_thieu, d.kenh, d.do_uu_tien, d.hien_thi_khach,
        d.is_active, data.created_by || null
      ]
    );
    return { success: true, id: kq.insertId, code: d.code };
  },

  /**
   * Cap nhat ma (Admin).
   *
   * `code` KHONG doi duoc sau khi tao: cac phien thanh toan cu luu ma dang
   * chuoi trong payments.discount_code_used, doi ma se lam gay doi soat.
   */
  capNhatMa: async (id, data) => {
    const cu = await discountService.layTheoId(id);
    if (!cu) throw new Error('Không tìm thấy mã khuyến mãi này');

    const d = discountService.chuanHoaForm({ ...data, code: cu.code });
    discountService.kiemTraForm(d);

    await db.query(
      `UPDATE discount_codes SET
        ten = ?, description = ?, discount_type = ?, discount_value = ?,
        max_usage = ?, valid_from = ?, valid_until = ?, min_order_value = ?,
        max_discount_amount = ?, pham_vi = ?, pham_vi_ids = ?, ap_dung_thu = ?,
        gio_bat_dau = ?, gio_ket_thuc = ?, gioi_han_moi_khach = ?, hang_toi_thieu = ?,
        kenh = ?, do_uu_tien = ?, hien_thi_khach = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        d.ten, d.description, d.discount_type, d.discount_value,
        d.max_usage, d.valid_from, d.valid_until, d.min_order_value,
        d.max_discount_amount, d.pham_vi, d.pham_vi_ids, d.ap_dung_thu,
        d.gio_bat_dau, d.gio_ket_thuc, d.gioi_han_moi_khach, d.hang_toi_thieu,
        d.kenh, d.do_uu_tien, d.hien_thi_khach, d.is_active, id
      ]
    );
    return { success: true, code: cu.code };
  },

  /** Bat / tat nhanh mot chuong trinh. */
  doiTrangThai: async (id) => {
    const km = await discountService.layTheoId(id);
    if (!km) throw new Error('Không tìm thấy mã khuyến mãi này');
    const moi = km.is_active ? 0 : 1;
    await db.query('UPDATE discount_codes SET is_active = ?, updated_at = NOW() WHERE id = ?', [moi, id]);
    return { code: km.code, is_active: moi };
  },

  /**
   * Xoa ma.
   *
   * Ma da phat sinh luot dung thi KHONG xoa - xoa se lam mat lich su doi soat
   * cua cac hoa don da ap ma do. Truong hop nay chi cho tam ngung.
   */
  xoaMa: async (id) => {
    const km = await discountService.layTheoId(id);
    if (!km) throw new Error('Không tìm thấy mã khuyến mãi này');

    const [[d]] = await db.query(
      'SELECT COUNT(*) AS n FROM discount_usages WHERE discount_id = ?', [id]
    );
    if (Number(d.n || 0) > 0 || Number(km.current_usage || 0) > 0) {
      throw new Error('Mã này đã được sử dụng nên không xóa được. Hãy tạm ngưng thay vì xóa.');
    }

    await db.query('DELETE FROM discount_codes WHERE id = ?', [id]);
    return { code: km.code };
  }
};

// ============ PAYMENT SERVICE ============
const paymentService = {
  /**
   * Get all payment methods
   */
  getPaymentMethods: async () => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id'
      );
      return rows;
    } catch (err) {
      console.error('Error getting payment methods:', err);
      return [];
    }
  },

  /**
   * Create payment record
   */
  createPayment: async (data) => {
    const {
      sesis,
      amount,
      payment_method_id,
      discount_code_used,
      discount_amount,
      loyalty_points_used,
      notes,
      processed_by
    } = data;

    try {
      const [result] = await db.query(
        `INSERT INTO payments (
          sesis, amount, payment_method_id, status,
          discount_code_used, discount_amount, loyalty_points_used,
          notes, processed_by
        ) VALUES (?, ?, ?, 'success', ?, ?, ?, ?, ?)`,
        [
          sesis,
          amount,
          payment_method_id,
          discount_code_used,
          discount_amount,
          loyalty_points_used,
          notes,
          processed_by
        ]
      );

      return result;
    } catch (err) {
      console.error('Error creating payment:', err);
      throw err;
    }
  },

  /**
   * Get payment by ID
   */
  getPayment: async (paymentId) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM payments WHERE id = ?',
        [paymentId]
      );
      return rows[0] || null;
    } catch (err) {
      console.error('Error getting payment:', err);
      return null;
    }
  },

  /**
   * Get payments by booking
   */
  getPaymentsByBooking: async (sesis) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM payments WHERE sesis = ? ORDER BY created_at DESC',
        [sesis]
      );
      return rows;
    } catch (err) {
      console.error('Error getting payments:', err);
      return [];
    }
  },

  /**
   * Refund payment
   */
  refundPayment: async (paymentId, reason = '') => {
    try {
      await db.query(
        `UPDATE payments
        SET status = 'refunded', notes = CONCAT(COALESCE(notes, ''), '\nRefund reason: ', ?)
        WHERE id = ?`,
        [reason, paymentId]
      );
      return true;
    } catch (err) {
      console.error('Error refunding payment:', err);
      throw err;
    }
  }
};

module.exports = {
  discountService,
  paymentService
};

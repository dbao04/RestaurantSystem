/**
 * Nghiep vu xep ca: doc du lieu vao cho thuat toan, luu ban nhap, chot lich.
 *
 * Tach khoi `services/xepCa.js` co chu dinh. `xepCa.js` la ham thuan - vao du
 * lieu, ra ket qua, khong biet CSDL la gi - nen kiem thu duoc bang du lieu tu
 * dat ra (xem `npm run xepca:test`). Tep nay giu toan bo phan cham vao CSDL.
 *
 * VONG DOI MOT BAN XEP CA
 *   1. Quan ly chon tuan, bam "Xep tu dong".
 *      -> `xepTuDong` xoa ban nhap cu cua tuan do, chay thuat toan, ghi ket qua
 *         vao `lich_lam_viec` voi trangthai = 3 (nhap), nguon = 'tu_dong'.
 *   2. Quan ly sua tay: them nguoi, bo nguoi khoi ca.
 *      -> `themVaoCa` / `boKhoiCa`, cac dong them tay mang nguon = 'thu_cong'.
 *   3. Bam "Chot".
 *      -> `chotTuan` doi toan bo trangthai 3 -> 1 (da duyet). Tu day nhan vien
 *         moi nhin thay.
 *
 * VI SAO BAN NHAP NAM TRONG CSDL CHU KHONG PHAI TRONG SESSION
 *   Xep ca cho mot tuan la viec lam dan: sua vai o, di lam viec khac, chieu quay
 *   lai sua tiep, hoi y kien to truong roi moi chot. Giu trong session thi dong
 *   trinh duyet la mat, va nguoi khac khong xem cung duoc. Nam trong bang thi
 *   ban nhap song qua ca lan khoi dong lai may chu.
 *
 * DIEU PHAI CAN THAN NHAT
 *   Moi thao tac xoa deu phai keo theo `trangthai = 3`. Quen dieu kien do mot
 *   lan la xoa trung lich DA CHOT cua ca nha hang, hoac xoa don dang ky cua
 *   nhan vien - nhung thu khong khoi phuc duoc. Vi vay khong ham nao trong tep
 *   nay xoa theo khoang ngay khong kem dieu kien trang thai.
 */
const db = require('../config/db');
const { xepCa, dsNgay, thuHaiCuaTuan, ngayISO } = require('./xepCa');

/** Trang thai cua `lich_lam_viec.trangthai`. */
const TT = {
  CHO_DUYET: 0,
  DA_DUYET: 1,
  TU_CHOI: 2,
  NHAP: 3,
};

/** Chuc vu duoc phep xep ca - khop enum `nhan_vien.chucvu`. */
const CHUC_VU = ['Phuc vu', 'Bep', 'Quay', 'Thu ngan', 'Ke toan', 'Nhan vien chung', 'Quan ly'];

/** `ngay` tu MySQL co the la Date hoac chuoi; ep ve 'YYYY-MM-DD'. */
function chuanNgay(v) {
  if (v instanceof Date) return ngayISO(v);
  return String(v).slice(0, 10);
}

const lichLamViecService = {
  TT,
  CHUC_VU,

  /** Danh sach ca dang bat, theo thu tu hien thi. */
  dsCa: async () => {
    const [rows] = await db.query(
      'SELECT * FROM ca_lam_viec WHERE trang_thai = 1 ORDER BY thu_tu ASC, ma_ca ASC'
    );
    return rows;
  },

  /** Toan bo dinh muc. */
  dsDinhMuc: async () => {
    const [rows] = await db.query(
      `SELECT d.*, c.ten_ca, c.thu_tu
       FROM dinh_muc_ca d
       LEFT JOIN ca_lam_viec c ON c.ma_ca = d.ma_ca
       ORDER BY d.thu ASC, c.thu_tu ASC, d.chucvu ASC`
    );
    return rows;
  },

  /**
   * Ghi de toan bo dinh muc bang bang moi tu form.
   *
   * Xoa het roi chen lai thay vi so sanh tung dong: bang chi vai chuc dong, va
   * form gui len luon la trang thai day du nen khong co gi de mat. Boc trong
   * giao dich de khong bao gio ton tai luc bang rong neu chen loi giua chung.
   */
  luuDinhMuc: async (danhSach) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM dinh_muc_ca');
      for (const d of danhSach) {
        const sl = Number(d.so_luong) || 0;
        if (sl <= 0) continue;           // 0 nguoi thi khong can luu dong nao
        await conn.query(
          'INSERT INTO dinh_muc_ca (thu, ma_ca, chucvu, so_luong) VALUES (?, ?, ?, ?)',
          [Number(d.thu), d.ma_ca, d.chucvu, sl]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /** Nhan vien co the xep ca. */
  dsNhanVien: async () => {
    const [rows] = await db.query(
      `SELECT id_nv, ten, chucvu FROM nhan_vien
       WHERE trangthai = 1 AND trang_thai_lam_viec = 'dang_lam'
       ORDER BY chucvu ASC, id_nv ASC`
    );
    return rows;
  },

  /**
   * Lich cua mot khoang ngay, kem ten nhan vien.
   *
   * @param {string[]} trangThai loc theo trang thai; mac dinh lay tat ca
   */
  lichTrongKhoang: async (tuNgay, denNgay, trangThai = null) => {
    let sql = `
      SELECT l.*, n.ten AS ten_nhanvien, n.chucvu
      FROM lich_lam_viec l
      JOIN nhan_vien n ON n.id_nv = l.id_nv
      WHERE l.ngay BETWEEN ? AND ?`;
    const params = [tuNgay, denNgay];
    if (trangThai && trangThai.length) {
      sql += ` AND l.trangthai IN (${trangThai.map(() => '?').join(',')})`;
      params.push(...trangThai);
    }
    sql += ' ORDER BY l.ngay ASC, l.gio_bat_dau ASC, n.ten ASC';
    const [rows] = await db.query(sql, params);
    return rows.map((r) => ({ ...r, ngay: chuanNgay(r.ngay) }));
  },

  /**
   * Chay thuat toan cho mot tuan roi ghi ket qua thanh ban nhap.
   *
   * @param {string} thuHai ngay thu Hai cua tuan, 'YYYY-MM-DD'
   * @returns ket qua cua thuat toan (phanCa, thieu, thongKe)
   */
  xepTuDong: async (thuHai, tuyChon = {}) => {
    const tu = thuHaiCuaTuan(thuHai);
    const ngayTuan = (() => {
      const d = new Date(tu + 'T00:00:00');
      d.setDate(d.getDate() + 6);
      return ngayISO(d);
    })();
    const cacNgay = dsNgay(tu, ngayTuan);

    const [caList, dinhMuc, nhanVien] = await Promise.all([
      lichLamViecService.dsCa(),
      lichLamViecService.dsDinhMuc(),
      lichLamViecService.dsNhanVien(),
    ]);

    // Nghi phep DA DUYET (trang_thai = 1) chong lan voi tuan nay.
    const [nghiPhep] = await db.query(
      `SELECT id_nv,
              COALESCE(ngay_bat_dau, ngay_nghi)  AS tu_ngay,
              COALESCE(ngay_ket_thuc, ngay_nghi) AS den_ngay
       FROM nghi_phep
       WHERE trang_thai = 1
         AND COALESCE(ngay_bat_dau, ngay_nghi)  <= ?
         AND COALESCE(ngay_ket_thuc, ngay_nghi) >= ?`,
      [ngayTuan, tu]
    );

    // Ca nhan vien tu dang ky trong tuan (cho duyet hoac da duyet) - thuat toan
    // uu tien giu nguyen nhung ca nay.
    const [daDangKy] = await db.query(
      `SELECT id_nv, ngay, ca FROM lich_lam_viec
       WHERE ngay BETWEEN ? AND ? AND nguon = 'dang_ky' AND trangthai IN (?, ?)`,
      [tu, ngayTuan, TT.CHO_DUYET, TT.DA_DUYET]
    );

    // Bay ngay truoc tuan nay, chi lay lich DA CHOT: can de tinh nghi giua hai
    // ca va chuoi ngay lien tiep vat qua ranh gioi tuan.
    const truocTuan = (() => {
      const d = new Date(tu + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      return ngayISO(d);
    })();
    const dTruoc = new Date(tu + 'T00:00:00');
    dTruoc.setDate(dTruoc.getDate() - 1);
    const [caTruocKhoang] = await db.query(
      `SELECT id_nv, ngay, ca FROM lich_lam_viec
       WHERE ngay BETWEEN ? AND ? AND trangthai = ?`,
      [truocTuan, ngayISO(dTruoc), TT.DA_DUYET]
    );

    const ketQua = xepCa(
      {
        ngayList: cacNgay,
        caList,
        dinhMuc,
        nhanVien,
        nghiPhep: nghiPhep.map((n) => ({
          id_nv: n.id_nv,
          tu_ngay: chuanNgay(n.tu_ngay),
          den_ngay: chuanNgay(n.den_ngay),
        })),
        daDangKy: daDangKy.map((x) => ({ ...x, ngay: chuanNgay(x.ngay) })),
        caTruocKhoang: caTruocKhoang.map((x) => ({ ...x, ngay: chuanNgay(x.ngay) })),
      },
      tuyChon
    );

    // Ghi ban nhap. Xoa ban nhap CU cua dung tuan nay truoc - dieu kien
    // trangthai = 3 la thu giu cho lich da chot va don dang ky khong bi dung toi.
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'DELETE FROM lich_lam_viec WHERE ngay BETWEEN ? AND ? AND trangthai = ?',
        [tu, ngayTuan, TT.NHAP]
      );
      for (const p of ketQua.phanCa) {
        // INSERT IGNORE vi khoa uq_lich_nv_ngay_ca co the va vao mot dong DA
        // CHOT cua chinh nguoi do trong cung ngay/ca. Truong hop do ca da co
        // nguoi that roi, bo qua dong nhap la dung.
        await conn.query(
          `INSERT IGNORE INTO lich_lam_viec
             (id_nv, ngay, ca, gio_bat_dau, gio_ket_thuc, trangthai, ghi_chu, nguon)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 'tu_dong')`,
          [p.id_nv, p.ngay, p.ca, p.gio_bat_dau, p.gio_ket_thuc, TT.NHAP]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return { ...ketQua, tuNgay: tu, denNgay: ngayTuan };
  },

  /** Them mot nguoi vao mot ca cua ban nhap (quan ly sua tay). */
  themVaoCa: async (id_nv, ngay, ma_ca) => {
    const [ca] = await db.query('SELECT * FROM ca_lam_viec WHERE ma_ca = ?', [ma_ca]);
    if (!ca[0]) throw new Error('Không tìm thấy ca làm việc.');

    const [nv] = await db.query(
      `SELECT id_nv FROM nhan_vien
       WHERE id_nv = ? AND trangthai = 1 AND trang_thai_lam_viec = 'dang_lam'`,
      [id_nv]
    );
    if (!nv[0]) throw new Error('Nhân viên không tồn tại hoặc đã nghỉ việc.');

    // Chan trung o tang nghiep vu de bao duoc cau tieng Viet, thay vi de MySQL
    // nem loi ER_DUP_ENTRY kho hieu.
    const [daCo] = await db.query(
      'SELECT id_lich FROM lich_lam_viec WHERE id_nv = ? AND ngay = ? AND ca = ?',
      [id_nv, ngay, ma_ca]
    );
    if (daCo[0]) throw new Error('Nhân viên này đã có trong ca đó.');

    await db.query(
      `INSERT INTO lich_lam_viec
         (id_nv, ngay, ca, gio_bat_dau, gio_ket_thuc, trangthai, nguon)
       VALUES (?, ?, ?, ?, ?, ?, 'thu_cong')`,
      [id_nv, ngay, ma_ca, ca[0].gio_bat_dau, ca[0].gio_ket_thuc, TT.NHAP]
    );
  },

  /**
   * Bo mot dong khoi ban nhap.
   *
   * Chi xoa duoc dong dang o trang thai nhap. Dong da chot phai di duong khac
   * (xoa tren trang /admin/schedule) de mot cu bam nham tren man hinh xep ca
   * khong lam bien mat ca da cong bo cho nhan vien.
   */
  boKhoiCa: async (id_lich) => {
    const [r] = await db.query(
      'DELETE FROM lich_lam_viec WHERE id_lich = ? AND trangthai = ?',
      [id_lich, TT.NHAP]
    );
    if (r.affectedRows === 0) {
      throw new Error('Không xoá được: dòng này không thuộc bản nháp (có thể đã chốt).');
    }
  },

  /** Doi toan bo ban nhap cua tuan thanh lich chinh thuc. */
  chotTuan: async (thuHai) => {
    const tu = thuHaiCuaTuan(thuHai);
    const d = new Date(tu + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    const den = ngayISO(d);

    const [r] = await db.query(
      'UPDATE lich_lam_viec SET trangthai = ? WHERE ngay BETWEEN ? AND ? AND trangthai = ?',
      [TT.DA_DUYET, tu, den, TT.NHAP]
    );
    return r.affectedRows;
  },

  /** Xoa ban nhap cua tuan, khong dung den lich da chot. */
  xoaNhap: async (thuHai) => {
    const tu = thuHaiCuaTuan(thuHai);
    const d = new Date(tu + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    const den = ngayISO(d);

    const [r] = await db.query(
      'DELETE FROM lich_lam_viec WHERE ngay BETWEEN ? AND ? AND trangthai = ?',
      [tu, den, TT.NHAP]
    );
    return r.affectedRows;
  },

  /**
   * Toan bo du lieu de ve man hinh xep ca cua mot tuan.
   *
   * Gom ca lich da chot lan ban nhap: quan ly can nhin thay ca hai de biet o
   * nao da co nguoi that, o nao moi chi la de xuat cua may.
   */
  duLieuTuan: async (thuHai) => {
    const tu = thuHaiCuaTuan(thuHai);
    const d = new Date(tu + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    const den = ngayISO(d);

    const [caList, dinhMuc, nhanVien, lich] = await Promise.all([
      lichLamViecService.dsCa(),
      lichLamViecService.dsDinhMuc(),
      lichLamViecService.dsNhanVien(),
      lichLamViecService.lichTrongKhoang(tu, den, [TT.DA_DUYET, TT.NHAP, TT.CHO_DUYET]),
    ]);

    const cacNgay = dsNgay(tu, den);

    // Doi chieu dinh muc voi thuc te de man hinh chi can ve, khong phai tinh.
    const thieu = [];
    for (const ngay of cacNgay) {
      const thu = new Date(ngay + 'T00:00:00').getDay();
      for (const m of dinhMuc.filter((x) => Number(x.thu) === thu && Number(x.so_luong) > 0)) {
        const co = lich.filter(
          (l) => l.ngay === ngay && l.ca === m.ma_ca && l.chucvu === m.chucvu
        ).length;
        if (co < Number(m.so_luong)) {
          thieu.push({
            ngay, ca: m.ma_ca, ten_ca: m.ten_ca, chucvu: m.chucvu,
            can: Number(m.so_luong), co, thieu: Number(m.so_luong) - co,
          });
        }
      }
    }

    const coNhap = lich.some((l) => l.trangthai === TT.NHAP);

    return { tuNgay: tu, denNgay: den, cacNgay, caList, dinhMuc, nhanVien, lich, thieu, coNhap };
  },
};

module.exports = lichLamViecService;

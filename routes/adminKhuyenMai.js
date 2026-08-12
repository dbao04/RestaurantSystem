/**
 * ROUTES: Quan tri KHUYEN MAI (/admin/khuyen-mai)
 *
 * Truoc day ma giam gia chi tao duoc bang tay trong CSDL hoac bang migration,
 * nen thuc te khong ai dung: muon doi mot con so phai goi nguoi biet SQL.
 * Cac duong dan o day cho quan tri vien tu tao / sua / bat tat / theo doi
 * hieu qua tung chuong trinh ngay trong trang quan tri.
 *
 * Ghi chu ve quyen: dung `requireAdminLogin` giong moi trang /admin khac.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdminLogin } = require('../middleware/auth');
const { discountService } = require('../services/discountService');
const auditService = require('../services/auditService');

/** Bat loi async, tra ve trang loi thay vi treo request. */
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Chan cac :id khong phai so.
 *
 * Express 5 (path-to-regexp v8) da bo cu phap ':id(\\d+)' - viet the se nem
 * loi ngay luc nap router. Kiem tra bang middleware thay vi trong duong dan.
 */
const laSo = (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.redirect('/admin/khuyen-mai?err=' + encodeURIComponent('Mã chương trình không hợp lệ'));
  }
  next();
};

/** Ghi nhat ky thao tac - khong duoc lam hong luong chinh neu audit loi. */
async function ghiNhatKy(req, action, resourceId, details) {
  try {
    await auditService.log({
      action,
      actor_type: 'admin',
      actor_id: req.session.idadmin,
      actor_name: req.session.adminname,
      resource_type: 'discount_code',
      resource_id: resourceId,
      details,
      status: 'success',
      ip_address: req.ip
    });
  } catch (e) {
    console.error('[khuyen-mai] ghi nhat ky that bai:', e.message);
  }
}

/** Danh sach loai mon + mon an cho o chon pham vi ap dung. */
async function layDanhMuc() {
  const [loaiMon] = await db.query('SELECT id_loai, name_loai FROM loai_mon ORDER BY name_loai ASC');
  const [monAn] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, l.name_loai
     FROM monan m LEFT JOIN loai_mon l ON m.id_loai = l.id_loai
     ORDER BY l.name_loai ASC, m.name_mon ASC`
  );
  return { loaiMon, monAn };
}

/* ========================================================================== */
/* DANH SACH                                                                  */
/* ========================================================================== */

router.get('/admin/khuyen-mai', requireAdminLogin, bat(async (req, res) => {
  const loc = {
    tuKhoa: (req.query.q || '').trim(),
    trangThai: req.query.trang_thai || ''
  };

  const [danhSach, thongKe] = await Promise.all([
    discountService.layDanhSach(loc),
    discountService.thongKeTongQuan()
  ]);

  res.render('admin/khuyen-mai', {
    title: 'Quản lý Khuyến mãi',
    danhSach,
    thongKe,
    loc,
    thongBao: req.query.msg || null,
    loi: req.query.err || null,
    moTaDieuKien: discountService.moTaDieuKien,
    TEN_HANG: discountService.TEN_HANG
  });
}));

/* ========================================================================== */
/* THEM MOI                                                                   */
/* ========================================================================== */

// Phai dat TRUOC '/admin/khuyen-mai/:id', neu khong 'them' se bi coi la id.
router.get('/admin/khuyen-mai/them', requireAdminLogin, bat(async (req, res) => {
  const { loaiMon, monAn } = await layDanhMuc();
  res.render('admin/khuyen-mai-form', {
    title: 'Tạo chương trình khuyến mãi',
    km: null,
    lichSu: [],
    loaiMon,
    monAn,
    loi: null
  });
}));

router.post('/admin/khuyen-mai/them', requireAdminLogin, bat(async (req, res) => {
  try {
    const kq = await discountService.createCode({
      ...req.body,
      created_by: req.session.idadmin
    });
    await ghiNhatKy(req, 'tao_khuyen_mai', kq.id, req.body);
    res.redirect('/admin/khuyen-mai?msg=' + encodeURIComponent('Đã tạo chương trình ' + kq.code));
  } catch (err) {
    const { loaiMon, monAn } = await layDanhMuc();
    // Tra lai chinh nhung gi vua go de khong phai nhap lai tu dau.
    res.render('admin/khuyen-mai-form', {
      title: 'Tạo chương trình khuyến mãi',
      km: { ...req.body, id: null },
      lichSu: [],
      loaiMon,
      monAn,
      loi: err.message
    });
  }
}));

/* ========================================================================== */
/* SUA                                                                        */
/* ========================================================================== */

router.get('/admin/khuyen-mai/:id', requireAdminLogin, laSo, bat(async (req, res) => {
  const km = await discountService.layTheoId(req.params.id);
  if (!km) return res.redirect('/admin/khuyen-mai?err=' + encodeURIComponent('Không tìm thấy chương trình này'));

  const [{ loaiMon, monAn }, lichSu] = await Promise.all([
    layDanhMuc(),
    discountService.layLichSuDung(req.params.id, 50)
  ]);

  res.render('admin/khuyen-mai-form', {
    title: 'Sửa · ' + (km.ten || km.code),
    km,
    lichSu,
    loaiMon,
    monAn,
    loi: req.query.err || null
  });
}));

router.post('/admin/khuyen-mai/:id', requireAdminLogin, laSo, bat(async (req, res) => {
  try {
    const kq = await discountService.capNhatMa(req.params.id, req.body);
    await ghiNhatKy(req, 'sua_khuyen_mai', req.params.id, req.body);
    res.redirect('/admin/khuyen-mai?msg=' + encodeURIComponent('Đã cập nhật ' + kq.code));
  } catch (err) {
    const [{ loaiMon, monAn }, lichSu] = await Promise.all([
      layDanhMuc(),
      discountService.layLichSuDung(req.params.id, 50)
    ]);
    const km = await discountService.layTheoId(req.params.id);
    res.render('admin/khuyen-mai-form', {
      title: 'Sửa chương trình khuyến mãi',
      km: { ...km, ...req.body, id: req.params.id, code: km ? km.code : req.body.code },
      lichSu,
      loaiMon,
      monAn,
      loi: err.message
    });
  }
}));

/* ========================================================================== */
/* BAT / TAT + XOA                                                            */
/* ========================================================================== */

// POST chu khong phai GET: day la thao tac doi du lieu, khong duoc de trinh
// duyet / trinh quet link kich hoat nham chi bang mot cu prefetch.
router.post('/admin/khuyen-mai/:id/trang-thai', requireAdminLogin, laSo, bat(async (req, res) => {
  try {
    const kq = await discountService.doiTrangThai(req.params.id);
    await ghiNhatKy(req, 'doi_trang_thai_khuyen_mai', req.params.id, kq);
    const tin = kq.is_active ? 'Đã bật lại ' + kq.code : 'Đã tạm ngưng ' + kq.code;
    res.redirect('/admin/khuyen-mai?msg=' + encodeURIComponent(tin));
  } catch (err) {
    res.redirect('/admin/khuyen-mai?err=' + encodeURIComponent(err.message));
  }
}));

router.post('/admin/khuyen-mai/:id/xoa', requireAdminLogin, laSo, bat(async (req, res) => {
  try {
    const kq = await discountService.xoaMa(req.params.id);
    await ghiNhatKy(req, 'xoa_khuyen_mai', req.params.id, kq);
    res.redirect('/admin/khuyen-mai?msg=' + encodeURIComponent('Đã xóa ' + kq.code));
  } catch (err) {
    res.redirect('/admin/khuyen-mai?err=' + encodeURIComponent(err.message));
  }
}));

/* ========================================================================== */
/* KIEM THU NHANH                                                             */
/* ========================================================================== */

/**
 * "Thu ma" ngay trong trang sua: nhap mot gia tri don gia dinh, xem ma co an
 * khong va giam bao nhieu. Tranh chuyen dat xong dieu kien roi phai ra quay
 * bam thu moi biet minh cau hinh sai.
 */
router.get('/admin/khuyen-mai/:id/thu', requireAdminLogin, laSo, bat(async (req, res) => {
  const km = await discountService.layTheoId(req.params.id);
  if (!km) return res.status(404).json({ thanhCong: false, loi: 'Không tìm thấy chương trình' });

  const giaTri = Number(req.query.gia_tri) || 0;
  const ctx = {
    kenh: req.query.kenh || null,
    hangKhach: req.query.hang || 'bronze',
    idKhach: null,
    // Pham vi theo mon can biet don gom gi; man hinh thu khong co don that nen
    // coi nhu khach goi dung mot mon thuoc pham vi -> chi kiem tra duoc phan
    // thoi gian / hang / gioi han. Bao ro cho nguoi dung o giao dien.
    mon: km.pham_vi === 'tat_ca'
      ? null
      : discountService.tachIds(km.pham_vi_ids).slice(0, 1).map(() => ({ id_mon: null, thanhtien: giaTri }))
  };

  if (km.pham_vi === 'mon') {
    const ids = discountService.tachIds(km.pham_vi_ids);
    ctx.mon = ids.length ? [{ id_mon: ids[0], thanhtien: giaTri }] : [];
  } else if (km.pham_vi === 'loai_mon') {
    const ids = discountService.tachIds(km.pham_vi_ids);
    const [rows] = ids.length
      ? await db.query(`SELECT id_mon FROM monan WHERE id_loai IN (${ids.map(() => '?').join(',')}) LIMIT 1`, ids)
      : [[]];
    ctx.mon = rows.length ? [{ id_mon: rows[0].id_mon, thanhtien: giaTri }] : [];
  }

  const kt = await discountService.kiemTraDieuKien(km, giaTri, ctx);
  if (!kt.valid) return res.json({ thanhCong: true, ap_duoc: false, ly_do: kt.message });

  const soTien = discountService.calculateDiscount(km, giaTri, kt.nen);
  res.json({
    thanhCong: true,
    ap_duoc: true,
    so_tien_giam: soTien,
    con_lai: giaTri - soTien,
    ghi_chu: km.pham_vi === 'tat_ca'
      ? null
      : 'Giả định toàn bộ giá trị đơn đều là món thuộc phạm vi chương trình.'
  });
}));

module.exports = router;

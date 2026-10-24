/**
 * ROUTES: Quan tri KHUYEN MAI (/admin/khuyen-mai va /staff/khuyen-mai)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { discountService } = require('../services/discountService');
const auditService = require('../services/auditService');

const canQuanLyOrAdmin = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  if (req.session && req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|manager|ke toan|ketoan/.test(vaiTro) || (req.hoSo && req.hoSo.cap_bac <= 2)) return next();
  }
  return res.redirect(req.originalUrl.startsWith('/staff') ? '/staff/login' : '/admin/login');
};

const isStaffRoute = (req) => {
  const p = req.originalUrl || req.path || '';
  if (p.startsWith('/staff')) return true;
  if (req.session && req.session.stafflogin && !req.session.adminlogin) return true;
  return false;
};

const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const laSo = (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) {
    const goc = isStaffRoute(req) ? '/staff/khuyen-mai' : '/admin/khuyen-mai';
    return res.redirect(`${goc}?err=` + encodeURIComponent('Mã chương trình không hợp lệ'));
  }
  next();
};

async function ghiNhatKy(req, action, resourceId, details) {
  try {
    await auditService.log({
      action,
      actor_type: req.session.adminlogin ? 'admin' : 'staff',
      actor_id: req.session.adminlogin ? req.session.idadmin : req.session.staffId,
      actor_name: req.session.adminlogin ? req.session.adminname : req.session.staffName,
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

router.get(['/admin/khuyen-mai', '/staff/khuyen-mai'], canQuanLyOrAdmin, bat(async (req, res) => {
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
    crumb: 'Khuyến mãi & Voucher',
    isStaff: isStaffRoute(req),
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

router.get(['/admin/khuyen-mai/them', '/staff/khuyen-mai/them'], canQuanLyOrAdmin, bat(async (req, res) => {
  const { loaiMon, monAn } = await layDanhMuc();
  res.render('admin/khuyen-mai-form', {
    title: 'Tạo chương trình khuyến mãi',
    crumb: 'Khuyến mãi & Voucher',
    isStaff: isStaffRoute(req),
    km: null,
    lichSu: [],
    loaiMon,
    monAn,
    loi: null
  });
}));

router.post(['/admin/khuyen-mai/them', '/staff/khuyen-mai/them'], canQuanLyOrAdmin, bat(async (req, res) => {
  const goc = isStaffRoute(req) ? '/staff/khuyen-mai' : '/admin/khuyen-mai';
  try {
    const kq = await discountService.createCode({
      ...req.body,
      created_by: req.session.adminlogin ? req.session.idadmin : req.session.staffId
    });
    await ghiNhatKy(req, 'tao_khuyen_mai', kq.id, req.body);
    res.redirect(`${goc}?msg=` + encodeURIComponent('Đã tạo chương trình ' + kq.code));
  } catch (err) {
    const { loaiMon, monAn } = await layDanhMuc();
    res.render('admin/khuyen-mai-form', {
      title: 'Tạo chương trình khuyến mãi',
      crumb: 'Khuyến mãi & Voucher',
      isStaff: isStaffRoute(req),
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

router.get(['/admin/khuyen-mai/:id', '/staff/khuyen-mai/:id'], canQuanLyOrAdmin, laSo, bat(async (req, res) => {
  const goc = isStaffRoute(req) ? '/staff/khuyen-mai' : '/admin/khuyen-mai';
  const km = await discountService.layTheoId(req.params.id);
  if (!km) return res.redirect(`${goc}?err=` + encodeURIComponent('Không tìm thấy chương trình này'));

  const [{ loaiMon, monAn }, lichSu] = await Promise.all([
    layDanhMuc(),
    discountService.layLichSuDung(req.params.id, 50)
  ]);

  res.render('admin/khuyen-mai-form', {
    title: 'Sửa · ' + (km.ten || km.code),
    crumb: 'Khuyến mãi & Voucher',
    isStaff: isStaffRoute(req),
    km,
    lichSu,
    loaiMon,
    monAn,
    loi: req.query.err || null
  });
}));

router.post(['/admin/khuyen-mai/:id', '/staff/khuyen-mai/:id'], canQuanLyOrAdmin, laSo, bat(async (req, res) => {
  const goc = isStaffRoute(req) ? '/staff/khuyen-mai' : '/admin/khuyen-mai';
  try {
    const kq = await discountService.capNhatMa(req.params.id, req.body);
    await ghiNhatKy(req, 'sua_khuyen_mai', req.params.id, req.body);
    res.redirect(`${goc}?msg=` + encodeURIComponent('Đã cập nhật ' + kq.code));
  } catch (err) {
    const km = await discountService.layTheoId(req.params.id);
    const [{ loaiMon, monAn }, lichSu] = await Promise.all([
      layDanhMuc(),
      discountService.layLichSuDung(req.params.id, 50)
    ]);
    res.render('admin/khuyen-mai-form', {
      title: 'Sửa · ' + (km ? (km.ten || km.code) : req.params.id),
      isStaff: isStaffRoute(req),
      km: { ...req.body, id: Number(req.params.id) },
      lichSu,
      loaiMon,
      monAn,
      loi: err.message
    });
  }
}));

/* ========================================================================== */
/* BAT / TAT TRANG THAI                                                       */
/* ========================================================================== */

router.post(['/admin/khuyen-mai/:id/trang-thai', '/staff/khuyen-mai/:id/trang-thai'], canQuanLyOrAdmin, laSo, bat(async (req, res) => {
  const goc = isStaffRoute(req) ? '/staff/khuyen-mai' : '/admin/khuyen-mai';
  const batLen = req.body.trang_thai === '1' || req.body.trang_thai === 'true' || req.body.active === '1';
  await discountService.doiTrangThai(req.params.id, batLen);
  await ghiNhatKy(req, 'doi_trang_thai_khuyen_mai', req.params.id, { active: batLen });
  res.redirect(`${goc}?msg=` + encodeURIComponent(batLen ? 'Đã kích hoạt chương trình' : 'Đã tạm ngưng chương trình'));
}));

/* ========================================================================== */
/* XOA                                                                        */
/* ========================================================================== */

router.post(['/admin/khuyen-mai/:id/xoa', '/staff/khuyen-mai/:id/xoa'], canQuanLyOrAdmin, laSo, bat(async (req, res) => {
  const goc = isStaffRoute(req) ? '/staff/khuyen-mai' : '/admin/khuyen-mai';
  try {
    await discountService.xoaMa(req.params.id);
    await ghiNhatKy(req, 'xoa_khuyen_mai', req.params.id, null);
    res.redirect(`${goc}?msg=` + encodeURIComponent('Đã xóa chương trình khuyến mãi'));
  } catch (err) {
    res.redirect(`${goc}?err=` + encodeURIComponent(err.message));
  }
}));

module.exports = router;

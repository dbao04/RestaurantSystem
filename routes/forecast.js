/**
 * Router cho Tang 3 (du bao ML) va Tang 4 (goi y AI).
 *
 * Trang `/du-bao` danh cho quan ly. Endpoint `/goi-y/api/mon` mo cho ca khach
 * hang vi no duoc goi tu trang thuc don va gio hang.
 */
const express = require('express');
const ml = require('../services/mlService');
const analytics = require('../services/analyticsService');

const router = express.Router();

const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireQuanLy(req, res, next) {
  if (req.session.adminlogin) return next();
  if (req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|ke toan|ketoan|manager/.test(vaiTro)) return next();
  }
  return res.redirect('/admin/login');
}

// --------------------------------------------------------------------------
// Trang du bao (quan ly)
// --------------------------------------------------------------------------
router.get('/du-bao', requireQuanLy, bat(async (req, res) => {
  const trangThai = await ml.kiemTra();
  res.render('admin/du-bao', {
    trangThaiML: trangThai,
    tenNguoiDung: req.session.adminname || req.session.staffname || 'Quản lý',
  });
}));

// --- Doc ket qua da luu trong CSDL (khong can Python chay) ---

router.get('/du-bao/api/khach-da-luu', requireQuanLy, bat(async (req, res) => {
  res.json(await ml.duBaoKhachDaLuu(Number(req.query.so_ngay) || 14));
}));

router.get('/du-bao/api/nguyen-lieu-da-luu', requireQuanLy, bat(async (req, res) => {
  res.json(await ml.duBaoNguyenLieuDaLuu());
}));

router.get('/du-bao/api/danh-gia', requireQuanLy, bat(async (req, res) => {
  res.json(await ml.danhGiaMoHinh());
}));

router.get('/du-bao/api/lich-su-khach', requireQuanLy, bat(async (req, res) => {
  // Chuoi luot khach THUC TE de ve chung voi duong du bao. Phai dung cung mot
  // dai luong (luot khach) voi muc tieu ma mo hinh du bao, khong phai so don.
  const so = Math.min(Number(req.query.so_ngay) || 60, 365);
  const tu = new Date(Date.now() - so * 86400000).toISOString().slice(0, 10);
  res.json(await analytics.luotKhachTheoNgay(tu, undefined));
}));

router.get('/du-bao/api/trang-thai', requireQuanLy, bat(async (req, res) => {
  res.json(await ml.kiemTra());
}));

// --- Kich hoat huan luyen lai (co the mat vai chuc giay) ---

router.post('/du-bao/api/chay-du-bao-khach', requireQuanLy, bat(async (req, res) => {
  try {
    res.json(await ml.duBaoLuotKhach(Number(req.body.so_ngay) || 14));
  } catch (err) {
    res.status(503).json({ loi: err.message });
  }
}));

router.post('/du-bao/api/chay-du-bao-nguyen-lieu', requireQuanLy, bat(async (req, res) => {
  try {
    res.json(await ml.duBaoNguyenLieu(Number(req.body.so_ngay) || 7));
  } catch (err) {
    res.status(503).json({ loi: err.message });
  }
}));

router.post('/du-bao/api/chay-apriori', requireQuanLy, bat(async (req, res) => {
  try {
    res.json(await ml.khaiPhaLuat(req.body || {}));
  } catch (err) {
    res.status(503).json({ loi: err.message });
  }
}));

// --------------------------------------------------------------------------
// Goi y mon (mo cho khach hang)
// --------------------------------------------------------------------------
router.get('/goi-y/api/luat', requireQuanLy, bat(async (req, res) => {
  res.json({
    thong_ke: await ml.thongKeLuat(),
    luat: await ml.topLuat(Number(req.query.gioi_han) || 25),
  });
}));

/**
 * Goi y mon di kem. Nhan `id_mon` la mang so hoac chuoi "1,2,3".
 * Duoc goi tu trang thuc don va gio hang.
 */
router.post('/goi-y/api/mon', bat(async (req, res) => {
  let ids = req.body.id_mon || [];
  if (typeof ids === 'string') ids = ids.split(',');
  ids = ids.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const soLuong = Math.min(Number(req.body.so_luong) || 4, 10);
  res.json(await ml.goiYMon(ids, soLuong));
}));

/** Goi y dua tren gio hang dang luu trong session. */
router.get('/goi-y/api/theo-gio-hang', bat(async (req, res) => {
  const db = require('../config/db');
  const sesid = req.sessionID;
  const soLuong = Number(req.query.so_luong) || 4;

  const [rows] = await db.query('SELECT id_mon FROM cart WHERE sesid = ?', [sesid]);
  const ids = rows.map((r) => Number(r.id_mon)).filter(Boolean);

  // Khu goi y nay chi hien MON AN, khong hien do uong. Lay danh sach id mon
  // thuoc danh muc do uong de loc ra (nhan dien theo ten danh muc cho ben vung
  // du id_loai co doi). Loc o day de bao trum ca nguon Python lan SQL du phong.
  const [drinkRows] = await db.query(
    `SELECT id_mon FROM monan
     WHERE id_loai IN (SELECT id_loai FROM loai_mon
                       WHERE name_loai LIKE '%uống%' OR name_loai LIKE '%uong%'
                          OR name_loai LIKE '%nước%' OR name_loai LIKE '%nuoc%')`
  );
  const laDoUong = new Set(drinkRows.map((r) => Number(r.id_mon)));

  // Xin nhieu hon roi loc, de sau khi bo do uong van du so luong mong muon.
  const kq = await ml.goiYMon(ids, soLuong * 3 + 4);
  let ds = (kq.goi_y || []).filter((m) => !laDoUong.has(Number(m.id_mon)));

  // Neu loc xong con thieu, bu them mon an ban chay (khong tinh do uong).
  if (ds.length < soLuong) {
    const daCo = new Set(ds.map((m) => Number(m.id_mon)));
    const [buThem] = await db.query(
      `SELECT h.id_mon, m.name_mon, m.gia_mon, m.images, SUM(h.soluong) AS sl
       FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon
       WHERE h.tinhtrang = 3 AND h.id_mon > 0 AND m.tinhtrang = 1
         AND m.id_loai NOT IN (SELECT id_loai FROM loai_mon
             WHERE name_loai LIKE '%uống%' OR name_loai LIKE '%uong%'
                OR name_loai LIKE '%nước%' OR name_loai LIKE '%nuoc%')
       GROUP BY h.id_mon, m.name_mon, m.gia_mon, m.images
       ORDER BY sl DESC LIMIT 20`
    );
    for (const b of buThem) {
      if (ds.length >= soLuong) break;
      if (daCo.has(Number(b.id_mon))) continue;
      ds.push({ id_mon: b.id_mon, name_mon: String(b.name_mon).trim(),
                gia_mon: Number(b.gia_mon), images: b.images, ly_do: 'ban_chay' });
    }
  }

  ds = ds.slice(0, soLuong);
  // Neu con it nhat mot goi y tu luat ket hop thi giu nhan "luat_ket_hop".
  res.json({ nguon: kq.nguon || 'ban_chay', goi_y: ds });
}));

module.exports = router;

/**
 * Router cho Kitchen Display System va So do ban thoi gian thuc.
 *
 * Nhan `io` (Socket.IO server) tu server.js de phat su kien khi trang thai thay
 * doi, nho vay man hinh bep va so do ban cua moi nguoi tu cap nhat ma khong
 * can bam tai lai trang.
 */
const express = require('express');
const kds = require('../services/kdsService');

module.exports = function (io) {
  const router = express.Router();
  const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  /** Bep, phuc vu, thu ngan, quan ly va admin deu can xem duoc man hinh nay. */
  function requireNhanSu(req, res, next) {
    if (req.session.adminlogin || req.session.stafflogin) return next();
    return res.redirect('/staff/login');
  }

  /** Chi bep moi duoc doi trang thai che bien. */
  function requireBep(req, res, next) {
    if (req.session.adminlogin) return next();
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (req.session.stafflogin && /bep|quan ly|quanly/.test(vaiTro)) return next();
    return res.status(403).json({ loi: 'Chỉ nhân viên bếp mới thao tác được.' });
  }

  // ---------------------------------------------------------------- KDS
  router.get('/kds', requireNhanSu, bat(async (req, res) => {
    res.render('staff/kds', {
      tenNguoiDung: req.session.adminname || req.session.staffname || 'Nhân viên',
      vaiTro: req.session.staffRole || (req.session.adminlogin ? 'Admin' : ''),
    });
  }));

  router.get('/kds/api/don', requireNhanSu, bat(async (req, res) => {
    const [nhom, daPhucVu, thongKe] = await Promise.all([
      kds.layDonBep(),
      kds.layDaPhucVu(20),
      kds.thongKeBep(),
    ]);
    res.json({ ...nhom, da_phuc_vu: daPhucVu, thong_ke: thongKe });
  }));

  /** Cac buoc chuyen trang thai cua mot mon. */
  const BUOC = {
    'bat-dau': kds.batDauCheBien,
    'hoan-thanh': kds.hoanThanhCheBien,
    'da-phuc-vu': kds.danhDauDaPhucVu,
  };

  router.post('/kds/api/:buoc/:id', requireBep, bat(async (req, res) => {
    const ham = BUOC[req.params.buoc];
    if (!ham) return res.status(404).json({ loi: 'Bước không hợp lệ.' });
    try {
      const mon = await ham(Number(req.params.id));
      // Bao cho ca bep lan phuc vu biet de man hinh tu cap nhat.
      io.to('kitchen_room').emit('kds-cap-nhat', { buoc: req.params.buoc, mon });
      io.to('staff_room').emit('kds-cap-nhat', { buoc: req.params.buoc, mon });
      if (req.params.buoc === 'hoan-thanh' && mon) {
        io.to('staff_room').emit('dish-ready', {
          id: mon.id, name_mon: mon.name_mon, number_ban: mon.number_ban,
        });
      }
      res.json({ ok: true, mon });
    } catch (err) {
      res.status(400).json({ loi: err.message });
    }
  }));

  // ------------------------------------------------------------ So do ban
  router.get('/so-do-ban', requireNhanSu, bat(async (req, res) => {
    res.render('staff/so-do-ban', {
      tenNguoiDung: req.session.adminname || req.session.staffname || 'Nhân viên',
      choPhepKeoTha: Boolean(req.session.adminlogin) ||
        /quan ly|quanly/.test((req.session.staffRole || '').toLowerCase()),
    });
  }));

  router.get('/so-do-ban/api/du-lieu', requireNhanSu, bat(async (req, res) => {
    const [ban, viTri, thongKe] = await Promise.all([
      kds.laySoDoBan(),
      kds.layViTri(),
      kds.thongKeBan(),
    ]);
    res.json({ ban, vi_tri: viTri, thong_ke: thongKe });
  }));

  router.post('/so-do-ban/api/trang-thai/:id', requireNhanSu, bat(async (req, res) => {
    try {
      const ban = await kds.doiTrangThaiBan(
        Number(req.params.id),
        Number(req.body.trangthai),
        req.body.sesis || null
      );
      io.to('staff_room').emit('ban-cap-nhat', ban);
      io.to('kitchen_room').emit('ban-cap-nhat', ban);
      res.json({ ok: true, ban });
    } catch (err) {
      res.status(400).json({ loi: err.message });
    }
  }));

  /** Luu vi tri sau khi keo tha - chi quan ly moi duoc sap xep lai so do. */
  router.post('/so-do-ban/api/vi-tri', requireNhanSu, bat(async (req, res) => {
    const laQuanLy = req.session.adminlogin ||
      /quan ly|quanly/.test((req.session.staffRole || '').toLowerCase());
    if (!laQuanLy) return res.status(403).json({ loi: 'Chỉ quản lý mới sắp xếp được sơ đồ.' });

    const ds = Array.isArray(req.body.ban) ? req.body.ban : [];
    const n = await kds.luuViTriBan(ds);
    io.to('staff_room').emit('so-do-thay-doi');
    res.json({ ok: true, da_luu: n });
  }));

  return router;
};

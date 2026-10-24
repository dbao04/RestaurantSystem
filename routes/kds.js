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

  /** Bep va Phuc vu / Quan ly deu thao tac duoc theo phan quyen tung buoc. */
  function requireBepHoacPhucVu(req, res, next) {
    if (req.session.adminlogin) return next();
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (req.session.stafflogin && /bep|phuc vu|phucvu|quay|quan ly|quanly/.test(vaiTro)) return next();
    return res.status(403).json({ loi: 'Bạn không có quyền thực hiện thao tác này.' });
  }

  // ---------------------------------------------------------------- KDS
  router.get(['/kds', '/staff/kds', '/staff/kitchen'], requireNhanSu, bat(async (req, res) => {
    res.render('staff/kds', {
      tenNguoiDung: req.session.adminname || req.session.staffname || 'Nhân viên',
      vaiTro: req.session.staffRole || (req.session.adminlogin ? 'Admin' : ''),
    });
  }));

  router.get(['/kds/api/don', '/staff/kitchen/api/don'], requireNhanSu, bat(async (req, res) => {
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

  router.post(['/kds/api/:buoc/:id', '/staff/kitchen/api/:buoc/:id'], requireBepHoacPhucVu, bat(async (req, res) => {
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
  router.get(['/so-do-ban', '/staff/so-do-ban'], requireNhanSu, bat(async (req, res) => {
    res.render('staff/so-do-ban', {
      title: 'Sơ đồ bàn thời gian thực',
      activePage: 'sodoban',
      tenNguoiDung: req.session.adminname || req.session.staffname || 'Nhân viên',
      choPhepKeoTha: Boolean(req.session.adminlogin) ||
        /quan ly|quanly/.test((req.session.staffRole || '').toLowerCase()),
    });
  }));

  router.get('/so-do-ban/api/du-lieu', requireNhanSu, bat(async (req, res) => {
    const ngay = req.query.ngay || null;
    const [ban, viTri, thongKe] = await Promise.all([
      kds.laySoDoBan(ngay),
      kds.layViTri(),
      kds.thongKeBan(ngay),
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
      io.to('staff_room').emit('so-do-thay-doi');
      io.to('staff_room').emit('booking-updated', { sesis: ban.sesis_hien_tai, action: 'table-status' });
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

  /** Lấy danh sách món hiện tại của bàn */
  router.get('/so-do-ban/api/mon-cua-ban/:id', requireNhanSu, bat(async (req, res) => {
    const idBan = Number(req.params.id);
    const db = require('../config/db');
    const [banRows] = await db.query('SELECT Id_ban, number_ban, trangthai, sesis_hien_tai FROM ban WHERE Id_ban = ?', [idBan]);
    if (!banRows.length) return res.status(404).json({ ok: false, loi: 'Không tìm thấy bàn.' });
    const ban = banRows[0];
    if (!ban.sesis_hien_tai) {
      return res.json({ ok: true, ban, items: [] });
    }
    const [items] = await db.query(
      `SELECT h.id, h.id_mon, h.name_mon, h.soluong, h.gia, h.thanhtien, h.trangthai_bep,
              m.images
       FROM hopdong h
       LEFT JOIN monan m ON m.id_mon = h.id_mon
       WHERE h.sesis = ? AND h.id_mon > 0
       ORDER BY h.id ASC`,
      [ban.sesis_hien_tai]
    );
    res.json({ ok: true, ban, sesis: ban.sesis_hien_tai, items });
  }));

  /** Nhân viên phục vụ gọi món / thêm món trực tiếp cho bàn */
  router.post('/so-do-ban/api/order-mon/:id', requireNhanSu, bat(async (req, res) => {
    const idBan = Number(req.params.id);
    const { items, so_khach, ghi_chu } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, loi: 'Vui lòng chọn ít nhất 1 món ăn.' });
    }

    const db = require('../config/db');
    const orderService = require('../services/orderService');

    const [banRows] = await db.query('SELECT Id_ban, number_ban, trangthai, sesis_hien_tai FROM ban WHERE Id_ban = ?', [idBan]);
    if (!banRows.length) return res.status(404).json({ ok: false, loi: 'Không tìm thấy bàn.' });
    const ban = banRows[0];

    let sesis = ban.sesis_hien_tai;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('vi-VN', { hour12: false });

    // Nếu bàn chưa có phiên (bàn trống), khởi tạo phiên mới
    if (!sesis) {
      sesis = 'TB_' + Date.now().toString(36).toUpperCase();
      await db.query(
        `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, ngay_dat, gio_dat, id_ban)
         VALUES (?, 0, 'Khởi tạo bàn tại chỗ', 1, ?, ?, 0, ?, ?, 0, 0, '', 1, ?, ?, ?)`,
        [sesis, today, now, ghi_chu || ('Bàn ' + ban.number_ban), Number(so_khach) || 2, today, now, idBan]
      );
      await db.query('UPDATE ban SET trangthai = 1, sesis_hien_tai = ? WHERE Id_ban = ?', [sesis, idBan]);
    }

    // Thêm từng món vào đơn
    for (const item of items) {
      const idMon = Number(item.id_mon || item.id);
      const qty = Number(item.soluong || item.qty) || 1;
      if (idMon > 0 && qty > 0) {
        await orderService.addDishToOrder(sesis, idMon, qty);
      }
    }

    // Đảm bảo id_ban được gắn vào tất cả các dòng của đơn
    await db.query('UPDATE hopdong SET id_ban = ? WHERE sesis = ? AND (id_ban IS NULL OR id_ban = 0)', [idBan, sesis]);

    // Lấy thông tin bàn mới nhất
    const [banCapNhat] = await db.query('SELECT Id_ban, number_ban, trangthai, sesis_hien_tai FROM ban WHERE Id_ban = ?', [idBan]);

    // Bắn realtime thông báo bếp và sơ đồ bàn
    const staffName = req.session.staffName || req.session.adminname || 'Nhân viên';
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: `Nhân viên [${staffName}] vừa gọi món cho Bàn ${ban.number_ban}!`,
      sesis
    });
    io.to('staff_room').emit('ban-cap-nhat', banCapNhat[0]);
    io.to('kitchen_room').emit('ban-cap-nhat', banCapNhat[0]);
    io.to('staff_room').emit('so-do-thay-doi');
    io.to('staff_room').emit('booking-updated', { sesis, action: 'order-mon' });

    res.json({ ok: true, sesis, da_them: items.length, ban: banCapNhat[0] });
  }));

  return router;
};

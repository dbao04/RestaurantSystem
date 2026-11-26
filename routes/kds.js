/**
 * Router cho Kitchen Display System va So do ban thoi gian thuc.
 *
 * Nhan `io` (Socket.IO server) tu server.js de phat su kien khi trang thai thay
 * doi, nho vay man hinh bep va so do ban cua moi nguoi tu cap nhat ma khong
 * can bam tai lai trang.
 */
const express = require('express');
const kds = require('../services/kdsService');
const phanQuyen = require('../services/phanQuyenService');

/**
 * QUYEN TREN MAN HINH BEP - tach theo NGHIEP VU, khong theo cap bac.
 *
 *   bep     : nhan mon, tra lai hang cho, hoan thanh mon
 *   phucVu  : xac nhan da mang mon ra ban (chi khi mon da hoan thanh)
 *   con lai : chi xem
 *
 * Khong dung vai tro tuong duong 'Quan ly' lam "toan quyen": chuc danh Giam sat
 * thu ngan, Ke toan truong cung tuong duong 'Quan ly' nhung khong co ly do gi
 * bam "nau xong" thay bep. Quan ly nha hang (QLNH) van du ca hai quyen vi
 * chuc danh do tuong duong ca 'Bep' lan 'Phuc vu'. Vai tro CU 'Quan ly' (ghi
 * trong nhan_vien.chucvu) duoc ca hai quyen nhu truoc.
 */
function quyenKds(req) {
  const phien = req.session || {};
  if (phien.adminlogin) return { bep: true, phucVu: true };
  if (!phien.stafflogin) return { bep: false, phucVu: false };
  const co = (ds) => ds.includes(phien.staffRole) || phanQuyen.dongVaiDuoc(req.hoSo, ds);
  const quanLyCu = phien.staffRole === 'Quan ly';
  return {
    bep: quanLyCu || co(['Bep']),
    phucVu: quanLyCu || co(['Phuc vu', 'Quay', 'letan']),
  };
}

/**
 * Ai duoc XEM man bep (KDS) va so do ban: nguoi lam van hanh tai nha hang -
 * bep / bar, phuc vu / quay / le tan, thu ngan, quan ly, dieu phoi giao hang.
 * Truoc day moi nhan vien dang nhap deu vao duoc (che do chi xem) nen bo phan
 * Kho, Ke toan cung thay man bep du khong lien quan. Kho xem ton kho o trang kho.
 */
function duocXemVanHanh(req, man = 'kds') {
  const phien = req.session || {};
  if (phien.adminlogin) return true;
  if (!phien.stafflogin) return false;
  const co = (ds) => ds.includes(phien.staffRole) || phanQuyen.dongVaiDuoc(req.hoSo, ds);
  if (phien.staffRole === 'Quan ly' || (req.hoSo && req.hoSo.ma_bp === 'DH')) return true;
  // Man bep: bep / bar, phuc vu (theo doi mon ra), dieu phoi giao hang (don giao xong chua).
  if (man === 'kds') return co(['Bep', 'Phuc vu']) || !!(req.hoSo && req.hoSo.ma_cd === 'DPGH');
  // So do ban: phuc vu, le tan (don khach), thu ngan (tinh tien theo ban).
  return co(['Phuc vu', 'Quay', 'letan', 'Thu ngan']);
}

/** Buoc nao can quyen nao. */
const QUYEN_BUOC = {
  'bat-dau': 'bep',
  'tra-lai-cho': 'bep',
  'hoan-thanh': 'bep',
  'da-phuc-vu': 'phucVu',
};

module.exports = function (io) {
  const router = express.Router();
  const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  /** Bep, phuc vu, thu ngan, quan ly va admin deu can xem duoc man hinh nay. */
  function requireNhanSu(req, res, next) {
    if (req.session.adminlogin || req.session.stafflogin) return next();
    return res.redirect('/staff/login');
  }

  /** Man bep / so do ban: chi nguoi lam van hanh (xem duocXemVanHanh). */
  function requireVanHanh(req, res, next) {
    if (!req.session.adminlogin && !req.session.stafflogin) return res.redirect('/staff/login');
    const man = /so-do-ban/.test(req.originalUrl) ? 'so_do' : 'kds';
    if (duocXemVanHanh(req, man)) return next();
    const muonJson = req.xhr || req.path.includes('/api/') || (req.headers.accept || '').includes('json');
    const thongDiep = man === 'kds'
      ? 'Màn hình bếp dành cho bộ phận Bếp / Bar, Phục vụ và Điều phối giao hàng.'
      : 'Sơ đồ bàn dành cho bộ phận Phục vụ, Lễ tân và Thu ngân.';
    if (muonJson) return res.status(403).json({ loi: thongDiep });
    return res.status(403).render('error', { title: 'Không có quyền truy cập', message: thongDiep, statusCode: 403, hoSo: res.locals.hoSo || null });
  }

  /**
   * Kiem tra quyen THEO TUNG BUOC. Truoc day mot middleware chung cho ca bep,
   * phuc vu, quay, quan ly lam MOI buoc - phuc vu goi thang API van chuyen duoc
   * mon sang "hoan thanh" (va kich hoat tru kho). An nut tren giao dien khong du:
   * may chu phai tu chan.
   */
  function requireQuyenBuoc(req, res, next) {
    const can = QUYEN_BUOC[req.params.buoc];
    if (!can) return res.status(404).json({ loi: 'Bước không hợp lệ.' });
    if (quyenKds(req)[can]) return next();
    return res.status(403).json({
      loi: can === 'bep'
        ? 'Chỉ bộ phận Bếp được nhận món, trả món hoặc báo hoàn thành món.'
        : 'Chỉ nhân viên Phục vụ / Quầy được xác nhận đã lên món.',
    });
  }

  // ---------------------------------------------------------------- KDS
  router.get(['/kds', '/staff/kds', '/staff/kitchen'], requireVanHanh, bat(async (req, res) => {
    res.render('staff/kds', {
      tenNguoiDung: req.session.adminname || req.session.staffName || 'Nhân viên',
      vaiTro: req.session.staffRole || (req.session.adminlogin ? 'Admin' : ''),
      quyen: quyenKds(req),
      // Tram: bar chi do uong, bep chi mon an; mac dinh theo bo phan nguoi dung.
      tramMacDinh: ['bep', 'bar', 'tat_ca'].includes(req.query.tram) ? req.query.tram
        : (req.hoSo && req.hoSo.ma_bp === 'BAR') ? 'bar' : (req.hoSo && req.hoSo.ma_bp === 'BEP') ? 'bep' : 'tat_ca',
    });
  }));

  router.get(['/kds/api/don', '/staff/kitchen/api/don'], requireVanHanh, bat(async (req, res) => {
    // duKien() doc san danh sach bep (layDonBep) va gan them thoi gian du kien:
    // con_phut (con bao lau xong) va sap_tre (da cho + con lai > cam ket).
    const [duKien, daPhucVu, thongKe] = await Promise.all([
      require('../services/thoiGianChoService').duKien(),
      kds.layDaPhucVu(20),
      kds.thongKeBep(),
    ]);
    const nhom = duKien.nhom;
    for (const ds of [nhom.cho, nhom.dang_lam]) {
      for (const m of ds) Object.assign(m, duKien.theoId.get(m.id) || {});
    }
    res.json({ ...nhom, da_phuc_vu: daPhucVu, thong_ke: { ...thongKe, so_dau_bep: duKien.K, sla_phut: duKien.sla } });
  }));

  /** Cac buoc chuyen trang thai cua mot mon. */
  const BUOC = {
    'tra-lai-cho': kds.traLaiChoCheBien,
    'bat-dau': kds.batDauCheBien,
    'hoan-thanh': kds.hoanThanhCheBien,
    'da-phuc-vu': kds.danhDauDaPhucVu,
  };

  router.post(['/kds/api/:buoc/:id', '/staff/kitchen/api/:buoc/:id'], requireNhanSu, requireQuyenBuoc, bat(async (req, res) => {
    const ham = BUOC[req.params.buoc];
    if (!ham) return res.status(404).json({ loi: 'Bước không hợp lệ.' });
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ loi: 'Món không hợp lệ.' });
    try {
      // Buoc len mon ghi lai nguoi xac nhan; cac buoc bep bo qua tham so thu hai.
      const mon = await ham(Number(req.params.id), req.session.staffId || null);
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
  router.get(['/so-do-ban', '/staff/so-do-ban'], requireVanHanh, bat(async (req, res) => {
    res.render('staff/so-do-ban', {
      title: 'Sơ đồ bàn thời gian thực',
      activePage: 'sodoban',
      tenNguoiDung: req.session.adminname || req.session.staffName || 'Nhân viên',
      choPhepKeoTha: Boolean(req.session.adminlogin) ||
        /quan ly|quanly/.test((req.session.staffRole || '').toLowerCase()),
    });
  }));

  router.get('/so-do-ban/api/du-lieu', requireVanHanh, bat(async (req, res) => {
    const ngay = req.query.ngay || null;
    const [ban, viTri, thongKe] = await Promise.all([
      kds.laySoDoBan(ngay),
      kds.layViTri(),
      kds.thongKeBan(ngay),
    ]);
    res.json({ ban, vi_tri: viTri, thong_ke: thongKe });
  }));

  router.post('/so-do-ban/api/trang-thai/:id', requireVanHanh, bat(async (req, res) => {
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
  router.get('/so-do-ban/api/mon-cua-ban/:id', requireVanHanh, bat(async (req, res) => {
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
       WHERE h.sesis = ? AND h.id_mon > 0 AND h.soluong > 0
       ORDER BY h.id ASC`,
      [ban.sesis_hien_tai]
    );
    res.json({ ok: true, ban, sesis: ban.sesis_hien_tai, items });
  }));

  /** Nhân viên phục vụ gọi món / thêm món trực tiếp cho bàn */
  router.post('/so-do-ban/api/order-mon/:id', requireVanHanh, bat(async (req, res) => {
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

    // Kiem tra ca luot goi truoc: ben duoi them tung mon mot (khong chung
    // transaction), het nguyen lieu giua chung se de lai don goi do dang.
    const tonMon = require('../services/tonMonService');
    try {
      await tonMon.kiemTraDatMon(items.map((it) => ({
        id_mon: Number(it.id_mon || it.id), qty: Number(it.soluong || it.qty) || 1,
      })));
    } catch (e) {
      if (e instanceof tonMon.LoiHetMon) return res.status(400).json({ ok: false, loi: e.message });
      throw e;
    }

    let sesis = ban.sesis_hien_tai;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('vi-VN', { hour12: false });

    // Bàn có lượt đặt mà khách ĐÃ ĐẾN (ARRIVED) nhưng chưa xếp bàn: gọi món
    // vào chính lượt đặt đó (addDishToOrder sẽ tự chuyển sang SEATED), không
    // mở phiên vãng lai thứ hai trên cùng bàn.
    if (!sesis) {
      const [[luot]] = await db.query(
        `SELECT r.reservation_code FROM reservations r
           JOIN reservation_tables rt ON rt.reservation_id = r.id
          WHERE rt.table_id = ? AND r.status = 'ARRIVED' AND r.reservation_date = CURDATE()
          ORDER BY r.arrived_at DESC LIMIT 1`, [idBan]);
      if (luot) sesis = luot.reservation_code;
    }

    // Nếu bàn chưa có phiên (bàn trống), khởi tạo phiên mới
    if (!sesis) {
      sesis = 'TB_' + Date.now().toString(36).toUpperCase();
      await db.query(
        `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, ngay_dat, gio_dat, id_ban)
         VALUES (?, 0, 'Khởi tạo bàn tại chỗ', ?, ?, ?, 0, ?, ?, 0, 0, '', 1, ?, ?, ?)`,
        [sesis, await orderService.khachVangLaiCuaBan(idBan, ban.number_ban), today, now, ghi_chu || ('Bàn ' + ban.number_ban), Number(so_khach) || 2, today, now, idBan]
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
    // Phuc vu goi mon cho ban -> nhan thong bao "mon xong" cua ban nay.
    await require('../services/thongBaoNghiepVu').ghiNhanPhucVu(sesis, req.session.staffId);

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

  // ------------------------------------------------------ Chuyen / gop ban
  // Xem services/chuyenBanService.js. Phuc vu, quay, thu ngan, quan ly.
  function requireDieuPhoiBan(req, res, next) {
    const phien = req.session || {};
    if (phien.adminlogin) return next();
    const ds = ['Phuc vu', 'Quay', 'Thu ngan', 'Quan ly'];
    if (ds.includes(phien.staffRole) || phanQuyen.dongVaiDuoc(req.hoSo, ds)) return next();
    return res.status(403).json({ ok: false, loi: 'Bạn không có quyền chuyển / gộp bàn.' });
  }

  for (const [duong, ham] of [['chuyen-ban', 'chuyenBan'], ['gop-ban', 'gopBan']]) {
    router.post('/so-do-ban/api/' + duong, requireNhanSu, requireDieuPhoiBan, bat(async (req, res) => {
      const cb = require('../services/chuyenBanService');
      try {
        const kq = await cb[ham](req.body.tu_ban, req.body.den_ban, {
          lyDo: req.body.ly_do,
          nhanVien: { id: req.session.staffId || null, ten: req.session.staffName || req.session.adminname || '' },
        });
        const db = require('../config/db');
        const [banMoi] = await db.query(
          'SELECT Id_ban, number_ban, trangthai, sesis_hien_tai FROM ban WHERE Id_ban IN (?)',
          [[kq.ban_nguon, kq.ban_dich]]);
        for (const b of banMoi) {
          io.to('staff_room').emit('ban-cap-nhat', b);
          io.to('kitchen_room').emit('ban-cap-nhat', b);
        }
        // Bep hien so ban theo hopdong.id_ban - lam moi man hinh KDS.
        io.to('kitchen_room').emit('kds-cap-nhat', { buoc: duong, mon: null });
        res.json({ ok: true, ...kq });
      } catch (err) {
        if (err instanceof cb.LoiChuyenBan) return res.status(400).json({ ok: false, loi: err.message });
        throw err;
      }
    }));
  }

  return router;
};

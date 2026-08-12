/**
 * Router chatbot.
 *
 *   POST /chatbot/api/hoi          mot luot hoi dap        (cong khai)
 *   POST /chatbot/api/danh-gia     khach cham cau tra loi  (cong khai)
 *   GET  /chatbot/api/cau-hoi-mau  goi y cau hoi           (cong khai)
 *   GET  /admin/chatbot            trang quan tri          (quan ly)
 *   POST /admin/chatbot/huan-luyen huan luyen lai          (quan ly)
 *
 * BA LOP BAO VE tren endpoint cong khai `/chatbot/api/hoi`:
 *
 *   1. Quyen suy tu PHIEN, khong lay tu body. Khach sua JSON cung khong the
 *      tu nang minh len quan ly (xem `chatbotService.suyRaQuyen`).
 *   2. Gioi han tan suat theo phien - chan nguoi quet endpoint de do du lieu.
 *   3. Gioi han do dai cau hoi - chan gui khoi van ban khong lo lam nghen
 *      service Python.
 *
 * Lop thu tu nam ben Python: khong sinh SQL tu do (xem ml_service/chatbot/
 * truy_van.py). Bon lop nay doc lap nhau, hong mot lop van con ba lop.
 */
const express = require('express');
const chatbot = require('../services/chatbotService');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --------------------------------------------------------------------------
// Gioi han tan suat: 20 cau / 60 giay cho moi phien.
//
// Luu trong bo nho tien trinh - du cho mot server don. Neu sau nay chay nhieu
// tien trinh thi phai chuyen sang Redis, ghi chu de nguoi bao tri biet.
// --------------------------------------------------------------------------
const SO_CAU_TOI_DA = 20;
const CUA_SO_MS = 60000;
const soDem = new Map();

function gioiHanTanSuat(req, res, next) {
  const khoa = req.sessionID || req.ip;
  const bayGio = Date.now();
  const muc = soDem.get(khoa);

  if (!muc || bayGio - muc.batDau > CUA_SO_MS) {
    soDem.set(khoa, { batDau: bayGio, dem: 1 });
    return next();
  }
  muc.dem += 1;
  if (muc.dem > SO_CAU_TOI_DA) {
    return res.status(429).json({
      van_ban: 'Bạn nhắn hơi nhanh rồi. Chờ một chút rồi hỏi tiếp giúp mình nhé!',
      y_dinh: 'qua_nhanh',
    });
  }
  return next();
}

// Don map dinh ky de khong phinh bo nho theo so phien da tung ghe qua.
setInterval(() => {
  const bayGio = Date.now();
  for (const [khoa, muc] of soDem) {
    if (bayGio - muc.batDau > CUA_SO_MS * 5) soDem.delete(khoa);
  }
}, CUA_SO_MS * 5).unref();

function requireQuanLy(req, res, next) {
  if (req.session.adminlogin) return next();
  if (req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|ke toan|ketoan|manager/.test(vaiTro)) return next();
  }
  return res.redirect('/admin/login');
}

// ==========================================================================
// Cong khai
// ==========================================================================
router.post('/chatbot/api/hoi', gioiHanTanSuat, bat(async (req, res) => {
  if (!(await chatbot.dangBat())) {
    return res.json({
      van_ban: 'Trợ lý ảo hiện đang tạm tắt. Bạn nhắn nhân viên để được hỗ trợ nhé.',
      y_dinh: 'tat',
      chuyen_nhan_vien: true,
    });
  }

  const cauHoi = String(req.body.cau_hoi || '').trim().slice(0, 500);
  if (!cauHoi) {
    return res.json({ van_ban: 'Bạn nhắn câu hỏi giúp mình nhé!', y_dinh: 'khong_hieu' });
  }

  // Ngu canh mot buoc lay tu PHIEN, khong tu body: neu tin body thi nguoi dung
  // co the tu khai "y dinh dang cho" bat ky, lach qua buoc phan loai.
  const nguCanh = req.session.chatbotNguCanh || {};
  const kq = await chatbot.hoi(cauHoi, req.session, nguCanh);

  // Luu / xoa ngu canh cho luot sau.
  if (kq.cho_tham_so && kq.y_dinh_cho) {
    req.session.chatbotNguCanh = {
      y_dinh_cho: kq.y_dinh_cho,
      cho_tham_so: kq.cho_tham_so,
    };
  } else {
    delete req.session.chatbotNguCanh;
  }

  res.json(kq);
}));

router.get('/chatbot/api/cau-hoi-mau', bat(async (req, res) => {
  const { quyen } = chatbot.suyRaQuyen(req.session);
  const mau = {
    khach: [
      'Quán có món gì ngon?',
      'Có khuyến mãi nào không?',
      'Quán mở cửa mấy giờ?',
      'Đặt bàn cho 4 người',
    ],
    quan_ly: [
      'Doanh thu hôm nay bao nhiêu?',
      'Top 10 món bán chạy tháng này',
      'Nguyên liệu nào sắp hết?',
      'So sánh doanh thu tuần này với tuần trước',
    ],
  };
  res.json({ quyen, cau_hoi: mau[quyen] });
}));

router.post('/chatbot/api/danh-gia', bat(async (req, res) => {
  const id = Number(req.body.id);
  if (!id) return res.status(400).json({ ok: false });
  await chatbot.danhGiaCauTraLoi(id, Boolean(req.body.huu_ich));
  res.json({ ok: true });
}));

// ==========================================================================
// Quan tri
// ==========================================================================
router.get('/admin/chatbot', requireQuanLy, bat(async (req, res) => {
  const [trangThai, danhGia, thongKe] = await Promise.all([
    chatbot.kiemTra(),
    chatbot.danhGiaDaLuu(),
    chatbot.thongKe(30),
  ]);
  res.render('admin/chatbot', {
    title: 'Trợ lý ảo (Chatbot)',
    trangThai,
    danhGia,
    thongKe,
    tenNguoiDung: req.session.adminname || req.session.staffName || 'Quản lý',
  });
}));

router.get('/admin/chatbot/api/thong-ke', requireQuanLy, bat(async (req, res) => {
  res.json(await chatbot.thongKe(Number(req.query.so_ngay) || 30));
}));

router.post('/admin/chatbot/huan-luyen', requireQuanLy, bat(async (req, res) => {
  try {
    res.json({ ok: true, ...(await chatbot.huanLuyen()) });
  } catch (err) {
    res.status(503).json({ ok: false, loi: err.message });
  }
}));

module.exports = router;

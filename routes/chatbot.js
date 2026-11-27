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
const triThuc = require('../services/chatbotTriThuc');
const multer = require('multer');
const taiLen = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const ngonNgu = require('../services/ngonNgu');
const daNgonNgu = require('../services/chatbotDaNgonNgu');
const ai = require('../services/chatbotAI');

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
// Kenh: 'khach' (mac dinh - widget trang khach) hoac 'noi_bo' (widget trang nhan vien).
// Chi dung de HA quyen; quyen quan ly van suy tu phien dang nhap.
const layKenh = (v) => (v === 'noi_bo' ? 'noi_bo' : 'khach');

router.post('/chatbot/api/hoi', gioiHanTanSuat, bat(async (req, res) => {
  const kenh = layKenh(req.body.kenh);
  if (!(await chatbot.dangBat())) {
    const { id_kh, id_nv } = chatbot.suyRaQuyen(req.session, kenh);
    const canDangNhap = !(id_kh || id_nv);
    return res.json({
      van_ban: daNgonNgu.cauHeThong('tat', req.ngonNgu) || (canDangNhap
        ? 'Trợ lý ảo hiện đang tạm tắt. Bạn **đăng ký** hoặc **đăng nhập** rồi vào ' +
          '**mục Chat** để nhắn trực tiếp với nhân viên nhé.'
        : 'Trợ lý ảo hiện đang tạm tắt. Bạn vào **mục Chat** để nhắn nhân viên nhé.'),
      y_dinh: 'tat',
      chuyen_nhan_vien: true,
      can_dang_nhap: canDangNhap,
    });
  }

  const cauHoi = String(req.body.cau_hoi || '').trim().slice(0, 500);
  if (!cauHoi) {
    return res.json({ van_ban: 'Bạn nhắn câu hỏi giúp mình nhé!', y_dinh: 'khong_hieu' });
  }

  // Ngu canh mot buoc lay tu PHIEN, khong tu body: neu tin body thi nguoi dung
  // co the tu khai "y dinh dang cho" bat ky, lach qua buoc phan loai.
  const nguCanh = req.session.chatbotNguCanh || {};
  const kq = await chatbot.hoi(cauHoi, req.session, nguCanh, req.ngonNgu, req.sessionID, kenh);

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

// Khach gui anh / video. Video da duoc trinh duyet cat san 3-4 khung hinh (khong
// tai ca tep video len may chu). Body JSON: { anh: [dataURL...], loai, cau_hoi, kenh }.
router.post('/chatbot/api/tep', gioiHanTanSuat, bat(async (req, res) => {
  const kenh = layKenh(req.body.kenh);
  const tl = await triThuc.docThietLap();
  if (!tl.bat) return res.json({ van_ban: 'Trợ lý ảo hiện đang tạm tắt.', y_dinh: 'tat' });
  const loai = req.body.loai === 'video' ? 'video' : 'anh';
  if ((loai === 'anh' && !tl.bat_nhan_anh) || (loai === 'video' && !tl.bat_nhan_video)) {
    return res.json({ van_ban: `Hiện mình chưa nhận ${loai === 'video' ? 'video' : 'ảnh'} được ạ. Bạn nhắn chữ giúp mình nha!`, y_dinh: 'tep_tat' });
  }
  const kq = await chatbot.hoiTep({
    anh: req.body.anh, loai, cauHoi: String(req.body.cau_hoi || '').trim().slice(0, 500),
    session: req.session, kenh, ngonNgu: req.ngonNgu, phien: req.sessionID,
  });
  if (kq.chuyen_nhan_vien) {
    const { id_kh, id_nv } = chatbot.suyRaQuyen(req.session, kenh);
    kq.can_dang_nhap = !(id_kh || id_nv);
  }
  res.json(kq);
}));

// Khach bam "cuoc tro chuyen moi" -> bot quen ngu canh cu cua kenh do.
router.post('/chatbot/api/quen', (req, res) => {
  delete req.session[layKenh(req.body && req.body.kenh) === 'noi_bo' ? 'chatbotNhoNoiBo' : 'chatbotNho'];
  delete req.session.chatbotNguCanh;
  res.json({ ok: true });
});

// Loi chao + goi y nhanh + giao dien - widget goi khi khach mo khung chat lan dau.
router.get('/chatbot/api/khoi-dong', bat(async (req, res) => {
  const kenh = layKenh(req.query.kenh);
  const { quyen, id_kh } = chatbot.suyRaQuyen(req.session, kenh);
  const tl = await triThuc.docThietLap();
  const ctx = {
    quyen, id_kh,
    ten_khach: kenh === 'khach' ? req.session.username : (req.session.staffName || req.session.adminname || req.session.username),
  };
  const goiYQuanLy = ['Hôm nay có bao nhiêu đơn?', 'Top 10 món bán chạy tháng này', 'Khung giờ nào đông khách nhất?', 'Còn mấy bàn trống?'];
  let loiChao = await triThuc.loiChao(ctx);
  let goiY = quyen === 'quan_ly' ? goiYQuanLy : tl.goi_y_nhanh;
  // Khach dang xem trang EN/JA -> loi chao + nut goi y bang ngon ngu do.
  if (quyen !== 'quan_ly' && (req.ngonNgu === 'en' || req.ngonNgu === 'ja')) {
    const menuTk = await triThuc.thongKeMenu();
    ({ loi_chao: loiChao, goi_y: goiY } = daNgonNgu.dichKhoiDong(loiChao, goiY, req.ngonNgu, {
      apDung: (vb) => triThuc.apDung(vb, tl, { ...ctx, menuTk }),
      tenKhach: tl.goi_ten_khach ? ctx.ten_khach : '',
    }));
  }
  res.json({
    quyen,
    loi_chao: loiChao,
    goi_y: goiY,
    giao_dien: await triThuc.thietLapCongKhai(),
  });
}));

router.get('/chatbot/api/cau-hoi-mau', bat(async (req, res) => {
  const { quyen } = chatbot.suyRaQuyen(req.session, layKenh(req.query.kenh));
  const dich = (khoa) => ngonNgu.t(khoa, req.ngonNgu);
  const mau = {
    khach: [
      { cau_hoi: 'Quán có món gì ngon?', nhan: dich('chatbot.mau_mon_ngon') },
      { cau_hoi: 'Có khuyến mãi nào không?', nhan: dich('chatbot.mau_khuyen_mai') },
      { cau_hoi: 'Quán mở cửa mấy giờ?', nhan: dich('chatbot.mau_gio_mo_cua') },
      { cau_hoi: 'Đặt bàn cho 4 người', nhan: dich('chatbot.mau_dat_ban') },
    ],
    // Khong goi y cau nao ve doanh thu / ton kho: nhung y dinh do da duoc go
    // khoi bot, goi y ra chi de nguoi dung bam vao roi nhan "chua hieu".
    quan_ly: [
      'Hôm nay có bao nhiêu đơn?',
      'Top 10 món bán chạy tháng này',
      'Khung giờ nào đông khách nhất?',
      'Còn mấy bàn trống?',
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
  // Tu hoc chay truoc de so lieu kho / danh sach cho duyet phan anh ngay ket qua.
  const hoc = await triThuc.deXuatHoc(30);
  const yDinhNgam = await triThuc.docYDinhNgam().catch(() => []);
  const [trangThai, danhGia, thongKe, thietLap, kho, theoNguon, lienHe] = await Promise.all([
    chatbot.kiemTra(),
    chatbot.danhGiaDaLuu().catch(() => []),
    chatbot.thongKe(30),
    triThuc.docThietLap(),
    triThuc.thongKeKho(),
    triThuc.theoNguon(30),
    triThuc.dsLienHe(),
  ]);
  res.render('admin/chatbot', {
    title: 'Trợ lý ảo (Chatbot)',
    trangThai,
    danhGia,
    thongKe,
    thietLap,
    macDinh: triThuc.MAC_DINH,
    kho,
    theoNguon,
    lienHe,
    hoc,
    yDinhNgam: yDinhNgam.map(({ cum, ...y }) => y),
    aiTrangThai: await ai.trangThai(),
    tabMo: String(req.query.tab || 'tong-quan'),
    tenNguoiDung: req.session.adminname || req.session.staffName || 'Quản lý',
  });
}));

// ---------------------------------------------------------- kho kien thuc
const loiJson = (res, e) => res.status(e.status || 500).json({ ok: false, loi: e.message });

router.get('/admin/chatbot/api/kien-thuc', requireQuanLy, bat(async (req, res) => {
  res.json(await triThuc.danhSach({
    q: String(req.query.q || '').slice(0, 100), nhom: String(req.query.nhom || ''),
    trang: Number(req.query.trang) || 1, moiTrang: Math.min(100, Number(req.query.moi_trang) || 30),
  }));
}));

router.post('/admin/chatbot/api/kien-thuc', requireQuanLy, bat(async (req, res) => {
  try {
    const laHoc = req.body.nguon === 'hoc';
    const id = await triThuc.them(req.body, laHoc ? 'hoc' : 'tay');
    // Day bot tu cau chua tra loi duoc -> cau goc ra khoi danh sach cho hoc.
    if (laHoc && req.body.cau_goc) await triThuc.danhDauHoc(req.body.cau_goc, 1, id).catch(() => {});
    res.json({ ok: true, id });
  } catch (e) { loiJson(res, e); }
}));

// ---------------------------------------------------------- hieu y khach (y dinh ngam)
router.get('/admin/chatbot/api/y-dinh-ngam', requireQuanLy, bat(async (req, res) => {
  res.json((await triThuc.docYDinhNgam()).map(({ cum, ...y }) => y));
}));

router.post('/admin/chatbot/api/y-dinh-ngam', requireQuanLy, bat(async (req, res) => {
  const ds = await triThuc.luuYDinhNgam(req.body.ds || []);
  res.json({ ok: true, so: ds.length });
}));

router.post('/admin/chatbot/api/y-dinh-ngam/mac-dinh', requireQuanLy, bat(async (req, res) => {
  const ds = await triThuc.khoiPhucYDinhNgam();
  res.json({ ok: true, so: ds.length });
}));

// ---------------------------------------------------------- tu hoc
router.get('/admin/chatbot/api/hoc', requireQuanLy, bat(async (req, res) => {
  res.json(await triThuc.deXuatHoc(30));
}));

router.post('/admin/chatbot/api/hoc', requireQuanLy, bat(async (req, res) => {
  try { res.json({ ok: true, ...(await triThuc.hocCau(req.body.cau_hoi, Number(req.body.id_kien_thuc))) }); }
  catch (e) { loiJson(res, e); }
}));

router.post('/admin/chatbot/api/hoc/nhieu', requireQuanLy, bat(async (req, res) => {
  const ds = Array.isArray(req.body.ds) ? req.body.ds.slice(0, 100) : [];
  let n = 0;
  for (const x of ds) {
    try { await triThuc.hocCau(x.cau_hoi, Number(x.id_kien_thuc)); n++; } catch { /* bo qua dong loi */ }
  }
  res.json({ ok: true, so_hoc: n });
}));

router.post('/admin/chatbot/api/hoc/bo-qua', requireQuanLy, bat(async (req, res) => {
  await triThuc.danhDauHoc(req.body.cau_hoi, 2);
  res.json({ ok: true });
}));

router.post('/admin/chatbot/api/hoc/hoan-tac', requireQuanLy, bat(async (req, res) => {
  await triThuc.hoanTacHoc(req.body.cau_hoi, Number(req.body.id_kien_thuc));
  res.json({ ok: true });
}));

router.put('/admin/chatbot/api/kien-thuc/:id', requireQuanLy, bat(async (req, res) => {
  try { await triThuc.sua(Number(req.params.id), req.body); res.json({ ok: true }); }
  catch (e) { loiJson(res, e); }
}));

router.post('/admin/chatbot/api/kien-thuc/:id/bat', requireQuanLy, bat(async (req, res) => {
  await triThuc.batTat(Number(req.params.id), !!req.body.bat);
  res.json({ ok: true });
}));

router.post('/admin/chatbot/api/kien-thuc/xoa', requireQuanLy, bat(async (req, res) => {
  res.json({ ok: true, so_xoa: await triThuc.xoa(req.body.ids || []) });
}));

// Buoc 1: tai file len -> doc thanh danh sach de xem truoc (chua ghi CSDL).
router.post('/admin/chatbot/api/kien-thuc/doc-file', requireQuanLy, taiLen.single('tep'), bat(async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, loi: 'Chưa chọn file.' });
  try {
    const ten = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const dong = await triThuc.docFile(req.file.buffer, ten);
    if (!dong.length) {
      return res.status(400).json({ ok: false, loi: 'Không đọc được cặp hỏi/đáp nào. Kiểm tra file có cột "Câu hỏi" và "Trả lời" (hoặc tải file mẫu).' });
    }
    res.json({ ok: true, ten, so_dong: dong.length, dong: dong.slice(0, 2000) });
  } catch (e) { loiJson(res, e); }
}));

// Buoc 2: xac nhan -> ghi vao kho.
router.post('/admin/chatbot/api/kien-thuc/nap', requireQuanLy, bat(async (req, res) => {
  const dong = Array.isArray(req.body.dong) ? req.body.dong.slice(0, 2000) : [];
  if (!dong.length) return res.status(400).json({ ok: false, loi: 'Không có dữ liệu để nạp.' });
  const kq = await triThuc.napNhieu(dong, { cheDo: req.body.che_do === 'thay' ? 'thay' : 'them', nguon: 'file' });
  res.json({ ok: true, ...kq });
}));

router.post('/admin/chatbot/api/kien-thuc/nap-mau', requireQuanLy, bat(async (req, res) => {
  res.json({ ok: true, ...(await triThuc.napBoMau()) });
}));

router.get('/admin/chatbot/kien-thuc.xlsx', requireQuanLy, bat(async (req, res) => {
  const mau = req.query.mau === '1';
  const buf = await triThuc.taoExcel({ mau });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${mau ? 'mau-kien-thuc-tro-ly-ao' : 'kien-thuc-tro-ly-ao'}.xlsx"`);
  res.send(buf);
}));

// ---------------------------------------------------------- thiet lap
router.post('/admin/chatbot/api/thiet-lap', requireQuanLy, bat(async (req, res) => {
  const tl = await triThuc.luuThietLap(req.body || {});
  triThuc.lamMoiChiMuc();
  res.json({ ok: true, thiet_lap: tl });
}));

router.post('/admin/chatbot/api/thiet-lap/mac-dinh', requireQuanLy, bat(async (req, res) => {
  res.json({ ok: true, thiet_lap: await triThuc.luuThietLap({ ...triThuc.MAC_DINH }) });
}));

// ---------------------------------------------------------- AI Claude
router.post('/admin/chatbot/api/ai-khoa', requireQuanLy, bat(async (req, res) => {
  const khoa = String(req.body.khoa || '').trim();
  if (khoa && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(khoa)) return res.status(400).json({ ok: false, loi: 'Khóa API Claude phải bắt đầu bằng sk-ant-' });
  await ai.luuKhoa(khoa);
  res.json({ ok: true, trang_thai: await ai.trangThai() });
}));

router.post('/admin/chatbot/api/ai-kiem-tra', requireQuanLy, bat(async (req, res) => {
  const tl = await triThuc.docThietLap();
  const { mon } = await triThuc.layMenu();
  res.json({ ...(await ai.kiemTra(tl, mon)), trang_thai: await ai.trangThai() });
}));

// Thu gui anh trong khung thu nghiem (phien gia, khong lam ban phien that).
router.post('/admin/chatbot/api/thu-tep', requireQuanLy, bat(async (req, res) => {
  const phienGia = { username: req.body.ten_khach || '', chatbotNho: req.session.chatbotThuNho };
  const kq = await chatbot.hoiTep({
    anh: req.body.anh, loai: req.body.loai === 'video' ? 'video' : 'anh',
    cauHoi: String(req.body.cau_hoi || '').trim().slice(0, 500), session: phienGia, kenh: 'khach', phien: 'thu-' + req.sessionID,
  });
  req.session.chatbotThuNho = phienGia.chatbotNho;
  res.json(kq);
}));

// ---------------------------------------------------------- thu nghiem
// Gia lap khach hoac quan ly, tra them thong tin go loi (nguon, diem, cau khop).
router.post('/admin/chatbot/api/thu', requireQuanLy, bat(async (req, res) => {
  const cauHoi = String(req.body.cau_hoi || '').trim().slice(0, 500);
  if (!cauHoi) return res.json({ van_ban: 'Nhập câu hỏi để thử.' });
  const vaiTro = req.body.vai_tro === 'quan_ly' ? 'quan_ly' : 'khach';
  // Phien gia: khong lam ban phien that cua quan ly; giu tri nho rieng cho khung thu.
  const phienGia = vaiTro === 'quan_ly'
    ? { adminlogin: true, chatbotNhoNoiBo: req.session.chatbotThuNho }
    : { username: req.body.ten_khach || '', chatbotNho: req.session.chatbotThuNho };
  const kq = await chatbot.hoi(cauHoi, phienGia, {}, 'vi', 'thu-' + req.sessionID, vaiTro === 'quan_ly' ? 'noi_bo' : 'khach');
  req.session.chatbotThuNho = phienGia.chatbotNho || phienGia.chatbotNhoNoiBo;
  const goiY = await triThuc.timKienThuc(cauHoi, 3).catch(() => []);
  if (!kq.khop_cau && goiY[0] && kq.nguon === 'kien_thuc') kq.khop_cau = goiY[0].khop;
  res.json({ ...kq, ung_vien: goiY.map((g) => ({ id: g.muc.dong.id, cau_hoi: g.muc.dong.cau_hoi, diem: Number(g.diem.toFixed(3)), khop: g.khop })) });
}));

router.post('/admin/chatbot/api/thu/lam-moi', requireQuanLy, (req, res) => {
  delete req.session.chatbotThuNho;
  res.json({ ok: true });
});

// ---------------------------------------------------------- hoi thoai & lien he
router.get('/admin/chatbot/api/hoi-thoai', requireQuanLy, bat(async (req, res) => {
  res.json(await triThuc.hoiThoaiGanDay({ gioiHan: Math.min(300, Number(req.query.gioi_han) || 100), chiKhongHieu: req.query.khong_hieu === '1' }));
}));

router.get('/admin/chatbot/api/lien-he', requireQuanLy, bat(async (req, res) => {
  res.json(await triThuc.dsLienHe());
}));

router.post('/admin/chatbot/api/lien-he/:id', requireQuanLy, bat(async (req, res) => {
  await triThuc.xuLyLienHe(Number(req.params.id), !!req.body.da_xu_ly);
  res.json({ ok: true });
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

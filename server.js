const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();
const db = require('./config/db');

const app = express();
const http = require('http');
const server = http.createServer(app);
const socketIo = require('socket.io');
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Socket.io Logic
// Viec chia phong da chuyen sang services/realtime.js: phong duoc dat theo dung
// co cau to chuc (nv / chuc danh / bo phan / cap bac / to) va danh tinh lay tu
// phien dang nhap thay vi tin vao du lieu client tu khai. Xem realtime.khoiTao()
// duoc goi ben duoi, sau khi session middleware da gan vao io.engine.
const realtime = require('./services/realtime');

// Services
const personnelService = require('./services/personnelService');
const menuService = require('./services/menuService');
const orderService = require('./services/orderService');
const engagementService = require('./services/engagementService');
const mailer = require('./utils/mailer');
const diaChiQR = require('./utils/diaChiQR');
const md5 = require('md5');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './food';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Gioi han body 20MB: cham cong khuon mat gui mot loat khung anh base64 tu
// webcam (kiosk gui ~12 khung). Mac dinh 100kb se bao loi 413 voi cac request do.
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(bodyParser.json({ limit: '20mb' }));

// Public static files
app.use(express.static(path.join(__dirname, 'css')));
app.use(express.static(path.join(__dirname, 'js')));
app.use(express.static(path.join(__dirname, 'images')));
app.use('/food', express.static(path.join(__dirname, 'food')));
app.use(express.static(path.join(__dirname, 'fonts')));
app.use(express.static(path.join(__dirname, 'scss')));

// Admin static files
app.use('/admin', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin-js', express.static(path.join(__dirname, 'admin/js')));
app.use('/admin-img', express.static(path.join(__dirname, 'admin/img')));

// Tach ra bien de dung chung cho ca Express lan Socket.IO. Nho vay socket doc
// duoc phien dang nhap va biet chac nguoi ket noi la ai.
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

app.use(async (req, res, next) => {
  // Tạo plain object an toàn thay vì truyền Session object trực tiếp
  // (Session object có internal props như .name gây ra [object Object] trong EJS)
  res.locals.session = {
    userlogin: req.session.userlogin || false,
    userId: req.session.userId || null,
    username: req.session.username || '',
    usersdt: req.session.usersdt || '',
    sum: req.session.sum || 0,
    adminlogin: req.session.adminlogin || false,
    idadmin: req.session.idadmin || null,
    adminuser: req.session.adminuser || '',
    adminname: req.session.adminname || '',
    stafflogin: req.session.stafflogin || false,
    staffId: req.session.staffId || null,
    staffName: req.session.staffName || '',
    staffRole: req.session.staffRole || '',
  };
  res.locals.formatMoney = require('./utils/format').formatMoney;
  res.locals.formatDate = require('./utils/format').formatDate;
  res.locals.formatTime = require('./utils/format').formatTime;
  res.locals.ngayVN = require('./utils/format').ngayVN;
  res.locals.gioVN = require('./utils/format').gioVN;
  res.locals.soLuongKho = require('./utils/format').soLuongKho;

  if (!req.path.startsWith('/admin') && req.sessionID) {
    try {
      const total = await orderService.getCartTotal(req.sessionID);
      req.session.sum = total;
      res.locals.session.sum = total;
    } catch (err) {
      console.error('Error fetching cart total:', err);
    }
  }
  next();
});


// Nap ho so quyen theo co cau to chuc vao req.hoSo / res.locals.hoSo cho moi
// request cua nhan vien. Phai dat SAU session va TRUOC moi route co phan quyen.
const phanQuyenMw = require('./middleware/phanQuyen');
app.use(phanQuyenMw.napHoSo());

// Auth Middlewares
const requireLogin = (req, res, next) => {
  if (!req.session.userlogin) {
    return res.redirect('/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.adminlogin) {
    return res.redirect('/admin/login');
  }
  next();
};

const requireStaff = (req, res, next) => {
  if (!req.session.stafflogin) return res.redirect('/staff/login');
  next();
};

/**
 * requireRole nay giu nguyen chu ky cu nhung thong minh hon.
 *
 * Truoc day chi so sanh chuoi: requireRole(['Bep']) doi session.staffRole dung
 * bang 'Bep'. Nhu vay Bep truong hay To truong bep - la chuc danh moi - se bi
 * chan khoi chinh khu bep cua ho.
 *
 * Ban moi kiem tra hai lop:
 *   1. staffRole khop chinh xac       (hanh vi cu, nguoi chua bo nhiem van chay)
 *   2. chuc_danh.vai_tro_tuong_duong  (Bep truong dong vai duoc 'Bep')
 * Nho lop 2, ca 178 route cu giu nguyen ma van hieu co cau to chuc moi.
 */
const requireRole = phanQuyenMw.canVaiTroCu;

/*
  Bao "du lieu vua doi" cho moi thao tac ghi.

  Dat TRUOC tat ca route de bat duoc ca route trong file nay lan route trong
  thu muc routes/. No chi gan mot ham nghe vao `res.on('finish')` roi di tiep,
  khong doi phan hoi va khong lam cham yeu cau nao.

  Bang anh xa duong dan -> mien du lieu nam trong middleware/baoDoi.js.
*/
app.use(require('./middleware/baoDoi')());

// --- Cac phan he moi: phan tich du lieu, du bao ML, goi y AI ---
app.use('/analytics', require('./routes/analytics'));
app.use('/', require('./routes/forecast'));
// Tro ly ao: widget khach hang + trang quan tri /admin/chatbot.
app.use('/', require('./routes/chatbot'));
// KDS va so do ban can `io` de phat su kien thoi gian thuc.
app.use('/', require('./routes/kds')(io));
// Co cau to chuc: so do, bang dieu hanh, bo nhiem, phan quyen, uy quyen.
app.use('/', require('./routes/toChuc'));
// Cham cong bang khuon mat (kiosk 1:N, ca nhan 1:1, quan ly).
app.use('/', require('./routes/khuonMat'));
// Quan ly bang cham cong: xem theo ngay, sua sai sot (co kiem toan).
app.use('/', require('./routes/chamCong'));
// Thanh toan: POS thu ngan, khach tu tra tai ban qua VietQR, dat coc, doi soat.
// Can `io` de man hinh thu ngan va dien thoai khach cung sang trang thai "da
// thanh toan" ngay khi ngan hang bao co.
app.use('/', require('./routes/thanhToan')(io));
// Khuyen mai: quan tri vien tu tao/sua/bat tat chuong trinh giam gia.
app.use('/', require('./routes/adminKhuyenMai'));
// Thanh vien: xem hang, diem, lich su dung ma (chi doc).
app.use('/', require('./routes/adminThanhVien'));
// Xep ca tu dong: khai dinh muc nhan su moi ca roi de may phan nguoi vao ca.
app.use('/', require('./routes/xepCa'));

// Gan trung tam thoi gian thuc. Phai goi SAU io.engine.use(sessionMiddleware)
// de socket doc duoc phien dang nhap.
realtime.khoiTao(io);

// --- Frontend Routes ---
app.get('/', async (req, res) => {
  // Lay vai mon dang ban de lam khoi "mon noi bat" tren trang chu.
  let mons = [];
  // So lieu THAT tu CSDL cho phan thong ke (khong bia so).
  let thongKe = { soMon: 0, soDanhMuc: 0, soNhanVien: 0, soDon: 0 };
  try {
    // Mon noi bat: chi lay MON AN (bo do uong), phai co anh, uu tien mon ban chay
    // -> khoi "Mon an dac sac" luon dep va khong lan do uong.
    const [dep] = await db.query(`
      SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, m.ghichu_mon,
             COALESCE(SUM(h.soluong), 0) AS da_ban
      FROM monan m
      LEFT JOIN hopdong h ON h.id_mon = m.id_mon AND h.tinhtrang = 3
      WHERE m.tinhtrang = 1 AND m.images IS NOT NULL AND m.images <> ''
        AND m.id_loai NOT IN (SELECT id_loai FROM loai_mon
            WHERE name_loai LIKE '%uống%' OR name_loai LIKE '%uong%'
               OR name_loai LIKE '%nước%' OR name_loai LIKE '%nuoc%')
      GROUP BY m.id_mon, m.name_mon, m.gia_mon, m.images, m.ghichu_mon
      ORDER BY da_ban DESC, m.id_mon DESC
      LIMIT 6`);
    mons = dep;
    // Du phong: neu vi ly do gi khong co mon co anh, lay tam mon an bat ky.
    if (!mons.length) {
      const tatCa = await menuService.getAllDishes();
      mons = (tatCa || []).filter((m) => m.tinhtrang == 1).slice(0, 6);
    }

    const [[tk]] = await db.query(`
      SELECT (SELECT COUNT(*) FROM monan WHERE tinhtrang = 1)            AS soMon,
             (SELECT COUNT(*) FROM loai_mon)                            AS soDanhMuc,
             (SELECT COUNT(*) FROM nhan_vien WHERE trangthai = 1)       AS soNhanVien,
             (SELECT COUNT(DISTINCT sesis) FROM hopdong WHERE tinhtrang = 3) AS soDon`);
    if (tk) thongKe = { soMon: +tk.soMon, soDanhMuc: +tk.soDanhMuc, soNhanVien: +tk.soNhanVien, soDon: +tk.soDon };
  } catch (err) {
    console.error('Không lấy được dữ liệu trang chủ:', err.message);
  }
  res.render('index', { title: 'Trang chủ', mons, thongKe });
});

app.get('/about', (req, res) => {
  res.render('about', { title: 'Về chúng tôi' });
});

app.get('/blog', async (req, res) => {
  try {
    const [posts] = await db.query('SELECT * FROM bai_viet ORDER BY created_at DESC');
    res.render('blog', { title: 'Tin tức', posts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/menu', async (req, res) => {
  try {
    const categories = await menuService.getAllCategories();
    const id_loai = req.query.id_loai || (categories.length > 0 ? categories[0].id_loai : null);
    const dishes = await menuService.getDishesByCategory(id_loai);

    res.render('menu', {
      title: 'Thực đơn',
      categories,
      dishes,
      currentCategory: id_loai,
      key: ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/menu', async (req, res) => {
  try {
    const key = (req.body.key || '').trim();
    console.log('--- DEBUG SEARCH ---');
    console.log('Original Key:', req.body.key);
    console.log('Trimmed Key:', key);
    console.log('--------------------');

    const categories = await menuService.getAllCategories();
    const dishes = await menuService.searchDishes(key);

    res.render('menu', {
      title: 'Thực đơn - Tìm kiếm',
      categories,
      dishes,
      currentCategory: null,
      key
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/detail', async (req, res) => {
  const monid = req.query.monid;
  try {
    const dish = await menuService.getDishById(monid);
    res.render('detail', { title: dish ? dish.name_mon : 'Detail', dish });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/add-to-cart', async (req, res) => {
  const { monid, soluong } = req.body;
  try {
    await orderService.addToCart(req.sessionID, monid, soluong || 1);
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/cart', async (req, res) => {
  try {
    const cartItems = await orderService.getCart(req.sessionID);
    const subtotal = await orderService.getCartTotal(req.sessionID);
    res.render('cart', { title: 'Giỏ hàng', cartItems, subtotal });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/update-cart', async (req, res) => {
  const { cartid, soluong } = req.body;
  try {
    await orderService.updateCartQuantity(cartid, soluong);
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/del-cart', async (req, res) => {
  const delid = req.query.delid;
  try {
    await orderService.removeFromCart(delid);
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/datban', requireLogin, async (req, res) => {
  try {
    const cartItems = await orderService.getCart(req.sessionID);
    if (cartItems.length === 0) {
      return res.render('cart', { title: 'Giỏ hàng', cartItems: [], subtotal: 0, error: 'Giỏ hàng của bạn đang trống. Vui lòng thêm món ăn trước khi đặt bàn!' });
    }
    // Trang dat ban hien tom tat don ben canh form, de khach doi chieu truoc khi
    // xac nhan ma khong phai bam qua lai giua hai trang.
    const subtotal = await orderService.getCartTotal(req.sessionID);
    res.render('booking', { title: 'Đặt bàn', cartItems, subtotal });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/datban', requireLogin, async (req, res) => {
  const { timebook, datebook, khach, noidung } = req.body;
  try {
    // Ràng buộc: Ngày đặt không được ở quá khứ.
    //
    // Chấp nhận CA HAI dạng: 'yyyy-mm-dd' của <input type="date"> (dạng form đặt
    // bàn đang dùng) và 'm/d/yyyy' của bootstrap-datepicker cũ - vẫn còn đơn cũ
    // và có thể còn trang khác gửi lên theo dạng đó.
    const phanTichNgay = (s) => {
      const t = String(s || '').trim();
      let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
      if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
      return null;
    };
    const bookingDate = phanTichNgay(datebook);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Chỉ so sánh ngày

    if (!bookingDate || Number.isNaN(bookingDate.getTime())) {
      return res.send('<script>alert("Ngày đặt bàn không hợp lệ!"); history.back();</script>');
    }
    if (bookingDate < today) {
      return res.send('<script>alert("Ngày đặt bàn không được ở quá khứ!"); history.back();</script>');
    }

    const cartItems = await orderService.getCart(req.sessionID);
    if (cartItems.length === 0) {
      return res.redirect('/cart');
    }
    // createOrderFromCart giờ trả về uniqueSesis để redirect đúng đơn vừa đặt
    const uniqueSesis = await orderService.createOrderFromCart(req.sessionID, req.session.userId, timebook, datebook, khach, noidung);

    // Notify Kitchen Real-time
    // [BẢO VỆ]: Server kích hoạt đẩy sự kiện 'new-order-to-kitchen' về phòng của Bếp khi có đơn đặt bàn mới
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: `Khách hàng [${req.session.username}] vừa đặt 1 đơn mới!`,
      sesis: uniqueSesis
    });

    res.redirect(`/contract?sesis=${uniqueSesis}`);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || 'Server Error');
  }
});

app.get('/contract', requireLogin, async (req, res) => {
  try {
    const sessionId = req.query.sesis || req.sessionID;
    const orderDetails = await orderService.getOrderDetails(sessionId);
    res.render('contract', { title: 'Hợp đồng', orderDetails });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/my-orders', requireLogin, async (req, res) => {
  try {
    const kq = await orderService.getUserOrders(req.session.userId, { trang: req.query.trang });
    // /cancel-order chuyen ve day kem ?msg=... - phai truyen vao view thi khach
    // moi biet yeu cau huy da gui duoc hay chua.
    res.render('my-orders', {
      title: 'Đơn hàng của tôi',
      orders: kq.danhSach,
      phanTrang: kq,
      msg: req.query.msg || null,
      msgType: req.query.msgType || 'success',
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/cancel-order', requireLogin, async (req, res) => {
  const { sesis } = req.body;
  try {
    await orderService.requestCancelOrder(sesis, req.session.userId);
    res.redirect('/my-orders?msg=Yêu+cầu+hủy+đơn+đã+được+gửi!&msgType=success');
  } catch (err) {
    res.redirect('/my-orders?msg=' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

app.post('/my-orders/cancel/:sesis', requireLogin, async (req, res) => {
  try {
    await orderService.requestCancelOrder(req.params.sesis, req.session.userId);
    res.redirect('/my-orders?msg=Yêu+cầu+hủy+đơn+đã+được+gửi!&msgType=success');
  } catch (err) {
    res.redirect('/my-orders?msg=' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

app.get('/rate', requireLogin, async (req, res) => {
  try {
    const ratings = await engagementService.getAllRatings(); // Show all ratings or user's? The view says "Đánh giá gần đây"
    // Chi duoc danh gia khi da co it nhat mot don duoc xac nhan.
    const canRate = await orderService.coDonDaXacNhan(req.session.userId);
    res.render('rating', { 
      title: 'Đánh giá dịch vụ', 
      ratings, 
      canRate,
      msg: req.query.msg || null,
      msgType: req.query.msgType || 'success'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/rating', requireLogin, async (req, res) => {
  const { sao, noi_dung } = req.body;
  try {
    await engagementService.addRating(req.session.userId, sao, noi_dung);
    res.redirect('/rate?msg=Cảm+ơn+bạn+đã+đánh+giá!&msgType=success');
  } catch (err) {
    console.error(err);
    res.redirect('/rate?msg=Lỗi+hệ+thống+khi+gửi+đánh+giá&msgType=danger');
  }
});

app.get('/success', (req, res) => {
  res.render('success', { title: 'Thành công' });
});

app.get('/login', (req, res) => {
  res.render('login', { title: 'Đăng nhập' });
});

app.post('/login', async (req, res) => {
  const { sdt, pass } = req.body;
  try {
    const user = await orderService.userLogin(sdt, pass);
    // DEBUG: xem structure thực tế của user object
    console.log('=== DEBUG LOGIN ===');
    console.log('user:', JSON.stringify(user));
    console.log('user.ten:', user ? user.ten : 'null');
    console.log('typeof user.ten:', user ? typeof user.ten : 'null');
    console.log('===================');
    if (user) {
      req.session.userlogin = true;
      req.session.userId = user.id;
      req.session.usersdt = user.sodienthoai;
      req.session.username = user.ten;
      res.redirect('/');
    } else {
      res.render('login', { title: 'Đăng nhập', error: 'Incorrect phone number or password!' });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { title: 'Đăng nhập', error: 'Server error occurred.' });
  }
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Đăng ký' });
});

app.post('/register', async (req, res) => {
  console.log('Register POST body:', req.body);
  let { ten, sodienthoai, email, diachi, passwords, repass } = req.body;

  // Defensive normalization
  ten = ten || '';
  sodienthoai = sodienthoai || '';
  email = email || '';
  diachi = diachi || null;
  passwords = passwords || '';
  repass = repass || '';

  if (passwords !== repass) {
    return res.render('register', { title: 'Đăng ký', message: 'Mật khẩu xác nhận không khớp!' });
  }
  try {
    await orderService.userRegister({ ten, sodienthoai, email, diachi, passwords });
    res.render('login', { title: 'Đăng nhập', message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', { title: 'Đăng ký', message: err.message });
  }
});

// --- Forgot Password ---

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { title: 'Quên mật khẩu' });
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM khach_hang WHERE email = ? LIMIT 1', [email]);
    if (!rows[0]) {
      return res.render('forgot-password', { title: 'Quên mật khẩu', error: 'Email không tồn tại trong hệ thống!' });
    }

    // Generate new random password (8 chars)
    const newPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = require('md5')(newPassword);

    // GUI THU TRUOC, DOI MAT KHAU SAU - thu tu nay quan trong.
    // Ban truoc ghi mat khau moi vao CSDL roi moi gui thu. Thu gui hong (chua
    // cau hinh EMAIL_USER, Gmail tu choi, mang chan cong 587...) thi mat khau
    // cu DA bi ghi de mat roi ma khach khong he nhan duoc mat khau moi - mat
    // trang tai khoan vi mot loi khong lien quan gi den ho. Doi lai thu tu thi
    // truong hop xau nhat chi la khach thay bao loi va bam thu lai.
    await mailer.sendNewPassword(email, newPassword);
    await db.query('UPDATE khach_hang SET passwords = ? WHERE id = ?', [hashedPassword, rows[0].id]);

    res.render('forgot-password', { title: 'Quên mật khẩu', message: 'Mật khẩu mới đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến (và thư mục rác).' });
  } catch (err) {
    // Chi tiet loi chi ghi ra console cho nguoi van hanh. Day la trang CONG KHAI
    // nen khong ha ra "chua cau hinh EMAIL_USER trong .env" cho khach doc.
    console.error('Forgot password error:', err);
    res.render('forgot-password', { title: 'Quên mật khẩu', error: 'Chưa gửi được email lúc này. Mật khẩu của bạn vẫn giữ nguyên, vui lòng thử lại sau.' });
  }
});

app.get('/profile', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM khach_hang WHERE id = ?', [req.session.userId]);
    res.render('profile', { 
      title: 'Thông tin cá nhân', 
      user: rows[0],
      msg: req.query.msg || null,
      msgType: req.query.msgType || 'info'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/profile', requireLogin, async (req, res) => {
  const { action } = req.body;
  try {
    if (action === 'update') {
      const { ten, email, diachi } = req.body;
      await db.query('UPDATE khach_hang SET ten = ?, email = ?, diachi = ? WHERE id = ?', [ten, email, diachi, req.session.userId]);
      // Update session name if changed
      req.session.username = ten;
      res.redirect('/profile?msg=Cập+nhật+thông+tin+thành+công!&msgType=success');
    } else if (action === 'password') {
      const { old_pass, new_pass, re_pass } = req.body;
      if (new_pass !== re_pass) {
        return res.redirect('/profile?msg=Mật+khẩu+xác+nhận+không+khớp!&msgType=danger');
      }
      const [rows] = await db.query('SELECT passwords FROM khach_hang WHERE id = ?', [req.session.userId]);
      if (md5(old_pass) !== rows[0].passwords) {
        return res.redirect('/profile?msg=Mật+khẩu+cũ+không+chính+xác!&msgType=danger');
      }
      await db.query('UPDATE khach_hang SET passwords = ? WHERE id = ?', [md5(new_pass), req.session.userId]);
      res.redirect('/profile?msg=Đổi+mật+khẩu+thành+công!&msgType=success');
    }
  } catch (err) {
    console.error(err);
    res.redirect('/profile?msg=Lỗi+hệ+thống: ' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


// --- Admin Routes ---
app.get('/admin/login', (req, res) => {
  res.render('admin/login', { layout: false });
});

app.post('/admin/login', async (req, res) => {
  const { adminuser, adminpass } = req.body;
  try {
    const admin = await personnelService.adminLogin(adminuser, adminpass);
    if (admin) {
      req.session.adminlogin = true;
      req.session.idadmin = admin.id_admin;
      req.session.adminuser = admin.adminuser;
      req.session.adminname = admin.Name_admin;
      res.redirect('/admin');
    } else {
      res.render('admin/login', { error: 'Incorrect username or password!', layout: false });
    }
  } catch (err) {
    console.error(err);
    res.render('admin/login', { error: 'Server error occurred.', layout: false });
  }
});

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const stats = await personnelService.getDashboardStats();
    res.render('admin/index', { title: 'Admin Dashboard', stats });
  } catch (err) {
    console.error(err);
    res.render('admin/index', { title: 'Admin Dashboard', stats: { revenue: 0, orders: 0, customers: 0, staff: 0 } });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.adminlogin = false;
  res.redirect('/admin/login');
});

// Category Management
app.get('/admin/catlist', requireAdmin, async (req, res) => {
  try {
    const categories = await personnelService.getAllCategories();
    res.render('admin/catlist', { categories });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/catadd', requireAdmin, (req, res) => {
  res.render('admin/catadd');
});

app.post('/admin/catadd', requireAdmin, async (req, res) => {
  const { name_loai, ghichu } = req.body;
  try {
    await personnelService.addCategory(name_loai, ghichu);
    res.redirect('/admin/catlist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/catedit/:id', requireAdmin, async (req, res) => {
  try {
    const category = await personnelService.getCategoryById(req.params.id);
    if (!category) return res.redirect('/admin/catlist');
    res.render('admin/catedit', { category });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/catedit/:id', requireAdmin, async (req, res) => {
  const { name_loai, ghichu } = req.body;
  try {
    await personnelService.updateCategory(req.params.id, name_loai, ghichu);
    res.redirect('/admin/catlist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/catdel/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.deleteCategory(req.params.id);
    res.redirect('/admin/catlist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Product Management
app.get('/admin/productlist', requireAdmin, async (req, res) => {
  try {
    const products = await personnelService.getAllProducts();
    res.render('admin/productlist', { products });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/productadd', requireAdmin, async (req, res) => {
  try {
    const categories = await personnelService.getAllCategories();
    res.render('admin/productadd', { categories });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/productadd', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { gia } = req.body;
    if (Number(gia) <= 0) {
      return res.send('<script>alert("Giá món ăn phải lớn hơn 0!"); history.back();</script>');
    }
    const productData = {
      name: req.body.name_mon,
      categoryId: req.body.loaimon,
      note: req.body.ghichu,
      price: req.body.gia,
      image: req.file ? req.file.filename : null
    };
    await personnelService.addProduct(productData);
    res.redirect('/admin/productlist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/productedit/:id', requireAdmin, async (req, res) => {
  try {
    const product = await personnelService.getProductById(req.params.id);
    const categories = await personnelService.getAllCategories();
    if (!product) return res.redirect('/admin/productlist');
    res.render('admin/productedit', { product, categories });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/productedit/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name_mon, loaimon, gia, ghichu, tinhtrang } = req.body;
    const image = req.file ? req.file.filename : null;

    if (Number(gia) <= 0) {
      return res.send('<script>alert("Giá món ăn phải lớn hơn 0!"); history.back();</script>');
    }

    await personnelService.updateProduct(req.params.id, {
      name: name_mon,
      categoryId: loaimon,
      note: ghichu,
      price: gia,
      image: image,
      tinhtrang: tinhtrang
    });
    res.redirect('/admin/productlist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/productdel/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.deleteProduct(req.params.id);
    res.redirect('/admin/productlist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Order Management
app.get('/admin/hopdongmoi', requireAdmin, async (req, res) => {
  try {
    const contracts = await personnelService.getPendingContracts();
    res.render('admin/hopdongmoi', { contracts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/hopdongconfirm/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.updateContractStatus(req.params.id, 1);
    res.redirect('/admin/hopdongmoi');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/hopdonglist', requireAdmin, async (req, res) => {
  try {
    const keyword = (req.query.q || '').trim();
    // tinhtrang: 0 cho xac nhan, 1 da xac nhan, 2 da huy, 3 da thanh toan,
    // 5 khach da den, 6 dang dung mon (dong bo voi views/staff/bookings.ejs).
    const MA_TRANG_THAI = ['0', '1', '2', '3', '5', '6'];
    const status = MA_TRANG_THAI.includes(req.query.status) ? req.query.status : '';
    const { rows, total, page, limit } = await personnelService.getContractsPaged({
      page: req.query.page,
      limit: req.query.limit,
      keyword,
      status
    });
    res.render('admin/hopdonglist', {
      contracts: rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      keyword,
      status
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/hopdongdel/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.deleteContract(req.params.id);
    res.redirect('/admin/hopdonglist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/hopdongconfirm/:id', requireAdmin, async (req, res) => {
  try {
    const sesis = req.params.id;
    await personnelService.updateContractStatus(sesis, 1);

    // Thông báo cho Bếp quay Socket.io
    // [BẢO VỆ]: Đẩy sự kiện về phòng Bếp ngay khi Admin xác nhận đơn hàng thành công
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: 'Có đơn hàng mới vừa được xác nhận!',
      sesis: sesis
    });

    res.redirect('/admin/hopdonglist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- Admin: Staff Management ---
app.get('/admin/stafflist', requireAdmin, async (req, res) => {
  try {
    const staff = await personnelService.getAllStaff();
    res.render('admin/stafflist', { staff });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/staffadd', requireAdmin, (req, res) => {
  res.render('admin/staffadd');
});

app.post('/admin/staffadd', requireAdmin, async (req, res) => {
  try {
    await personnelService.addStaff(req.body);
    res.redirect('/admin/stafflist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/staffedit/:id', requireAdmin, async (req, res) => {
  try {
    const staff = await personnelService.getStaffById(req.params.id);
    res.render('admin/staffedit', { staff });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/staffedit/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.updateStaff(req.params.id, req.body);
    res.redirect('/admin/stafflist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/staffdel/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.deleteStaff(req.params.id);
    res.redirect('/admin/stafflist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- Admin: Blog Management ---
app.get('/admin/bloglist', requireAdmin, async (req, res) => {
  try {
    const posts = await personnelService.getAllPosts();
    res.render('admin/bloglist', { posts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- ADMIN: SCHEDULE MANAGEMENT ---
app.get('/admin/schedule', requireAdmin, async (req, res) => {
  try {
    const schedules = await personnelService.getAllSchedules();
    res.render('admin/schedule', { title: 'Quản lý Lịch nhân viên', schedules });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- ADMIN: SALARY APPROVAL ---
app.get('/admin/salary-approval', requireAdmin, async (req, res) => {
  try {
    const pendingSalaries = await personnelService.getPendingSalaries();
    res.render('admin/salary-approval', { title: 'Phê duyệt lương', pendingSalaries });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/salary/update/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // 2 for approve, 0 for reject
    await personnelService.updateSalaryStatus(req.params.id, status);
    res.redirect('/admin/salary-approval');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/schedule/update/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await personnelService.updateScheduleStatus(req.params.id, status);
    res.redirect('/admin/schedule');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/blogadd', requireAdmin, (req, res) => {
  res.render('admin/blogadd');
});

app.post('/admin/blogadd', requireAdmin, upload.single('hinh_anh'), async (req, res) => {
  const hinh_anh = req.file ? req.file.filename : null;
  try {
    await personnelService.addPost({ ...req.body, hinh_anh });
    res.redirect('/admin/bloglist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/blogedit/:id', requireAdmin, async (req, res) => {
  try {
    const post = await personnelService.getPostById(req.params.id);
    res.render('admin/blogedit', { post });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/blogedit/:id', requireAdmin, upload.single('hinh_anh'), async (req, res) => {
  const hinh_anh = req.file ? req.file.filename : null;
  try {
    await personnelService.updatePost(req.params.id, { ...req.body, hinh_anh });
    res.redirect('/admin/bloglist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/blogdel/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.deletePost(req.params.id);
    res.redirect('/admin/bloglist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- Admin: Leave Management ---
app.get('/admin/leavelist', requireAdmin, async (req, res) => {
  try {
    const requests = await personnelService.getAllLeaveRequests();
    res.render('admin/leavelist', { requests });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/leaveapprove/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.updateLeaveStatus(req.params.id, 1);
    res.redirect('/admin/leavelist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/admin/leavereject/:id', requireAdmin, async (req, res) => {
  try {
    await personnelService.updateLeaveStatus(req.params.id, 2);
    res.redirect('/admin/leavelist');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- Admin: Statistics ---
app.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await personnelService.getDashboardStats();
    const revenueByMonth = await personnelService.getRevenueByMonth();
    const topDishes = await orderService.getTopDishes();
    res.render('admin/stats', { stats, revenueByMonth, topDishes });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- Admin: Profile & Password ---
app.get('/admin/profile', requireAdmin, async (req, res) => {
  try {
    const admin = await personnelService.getAdminById(req.session.idadmin);
    res.render('admin/profile', { admin, msg: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/profile', requireAdmin, async (req, res) => {
  const { Name_admin, adminuser } = req.body;
  try {
    await personnelService.updateAdminProfile(req.session.idadmin, { name: Name_admin, adminuser });
    // Update session
    req.session.adminname = Name_admin;
    req.session.adminuser = adminuser;

    const admin = await personnelService.getAdminById(req.session.idadmin);
    res.render('admin/profile', { admin, msg: 'Cập nhật thông tin thành công!', msgType: 'success' });
  } catch (err) {
    console.error(err);
    const admin = await personnelService.getAdminById(req.session.idadmin);
    res.render('admin/profile', { admin, msg: 'Lỗi cập nhật thông tin.', msgType: 'danger' });
  }
});

app.get('/admin/changepassword', requireAdmin, (req, res) => {
  res.render('admin/changepassword', { msg: null });
});

app.post('/admin/changepassword', requireAdmin, async (req, res) => {
  const { oldpass, newpass, repass } = req.body;
  try {
    if (newpass !== repass) {
      return res.render('admin/changepassword', { msg: 'Mật khẩu xác nhận không khớp!', msgType: 'danger' });
    }
    await personnelService.changeAdminPassword(req.session.idadmin, oldpass, newpass);
    res.render('admin/changepassword', { msg: 'Đổi mật khẩu thành công!', msgType: 'success' });
  } catch (err) {
    res.render('admin/changepassword', { msg: err.message, msgType: 'danger' });
  }
});

// --- ACCOUNTANT MANAGEMENT (Role: 'Ke toan') ---

app.get('/staff/accountant/attendance/export', requireRole(['Ke toan']), async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const rows = await personnelService.getDetailedAttendanceReport(month, year);

    // Format headers for Excel CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // Bắt buộc phải có dấu ngoặc kép bọc quanh filename để tránh lỗi trình duyệt cắt chuỗi
    res.setHeader('Content-Disposition', `attachment; filename="Bao_cao_cham_cong_T${month}_${year}.csv"`);

    // Write UTF-8 BOM để Excel đọc được tiếng Việt có dấu
    res.write('\uFEFF');

    // Headers
    res.write('Ngày,Nhân viên,Chức vụ,Giờ vào,Giờ ra,Tổng giờ làm (H)\n');

    rows.forEach(r => {
      let dateStr = '';
      if (r.ngay) {
        const d = new Date(r.ngay);
        dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      }
      
      let vaoStr = '';
      if (r.gio_vao) {
        const d = new Date(r.gio_vao);
        vaoStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      }
      
      let raStr = '';
      if (r.gio_ra) {
        const d = new Date(r.gio_ra);
        raStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      }
      
      const tongStr = r.tong_gio != null ? r.tong_gio : '0';
      
      // Escape commas and double quotes in strings to prevent CSV format breakage
      const name = r.ten ? `"${r.ten.replace(/"/g, '""')}"` : '';
      const role = r.chucvu ? `"${r.chucvu.replace(/"/g, '""')}"` : '';

      res.write(`${dateStr},${name},${role},${vaoStr},${raStr},${tongStr}\n`);
    });

    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/staff/accountant/salary', requireRole(['Ke toan']), async (req, res) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const salaryList = await personnelService.getSalaryList(month, year);
    const staffList = await personnelService.getAllStaff();
    const attendanceList = await personnelService.getDetailedAttendanceReport(month, year);
    
    res.render('staff/accountant/salary', {
      title: 'Quản lý Lương',
      salaryList,
      staffList,
      attendanceList,
      month, year,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'salary'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/accountant/salary/upsert', requireRole(['Ke toan']), async (req, res) => {
  try {
    const { luong_cung, thuong, phu_cap, thang, nam } = req.body;
    if (Number(luong_cung) < 0 || Number(thuong) < 0 || Number(phu_cap) < 0) {
      return res.send('<script>alert("Các khoản lương, thưởng, phụ cấp không được nhỏ hơn 0!"); history.back();</script>');
    }
    await personnelService.upsertSalary(req.body);
    res.redirect(`/staff/accountant/salary?month=${thang}&year=${nam}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/accountant/reports', requireRole(['Ke toan']), async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const report = await personnelService.getFinancialReport(month, year);
    
    res.render('staff/accountant/reports', {
      title: 'Báo cáo Thu chi',
      report,
      month, year,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'reports'
    });
  } catch (err) {
    console.error('CRITICAL ERROR in /staff/accountant/reports:', err);
    res.status(500).send(`<h1>Lỗi máy chủ</h1><p>Không thể tải báo cáo cho tháng ${req.query.month || (new Date().getMonth()+1)}/${req.query.year || new Date().getFullYear()}.</p><p>Chi tiết: ${err.message}</p><a href="/staff">Quay lại Trang chủ</a>`);
  }
});

app.get('/staff/accountant/expenses', requireRole(['Ke toan']), async (req, res) => {
  try {
    const expenses = await personnelService.getAllExpenses();
    res.render('staff/accountant/expenses', {
      title: 'Quản lý Chi phí',
      expenses,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'reports'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/accountant/expenses/add', requireRole(['Ke toan']), async (req, res) => {
  try {
    await personnelService.addExpense(req.body);
    res.redirect('/staff/accountant/expenses');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/accountant/expenses/delete/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    await personnelService.deleteExpense(req.params.id);
    res.redirect('/staff/accountant/expenses');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/accountant/attendance', requireRole(['Ke toan']), async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const logs = await personnelService.getDailyAttendance(date);
    res.render('staff/accountant/attendance', {
      title: 'Theo dõi Chấm công',
      logs, date,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'attendance'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- ACCOUNTANT: ATTENDANCE SUMMARY ---
app.get('/staff/accountant/attendance/summary', requireRole(['Ke toan']), async (req, res) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const summary = await personnelService.getMonthlyAttendanceSummary(month, year);
    res.render('staff/accountant/attendance_summary', {
      title: 'Tổng hợp Chấm công',
      summary, month, year,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'attendance'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/accountant/staff', requireRole(['Ke toan']), async (req, res) => {
  try {
    const staff = await personnelService.getAllStaff();
    res.render('staff/accountant/staff_list', {
      title: 'Quản lý Nhân sự',
      staff,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'staff-manage'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/accountant/staff/delete/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    await personnelService.deleteStaff(req.params.id);
    res.redirect('/staff/accountant/staff');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/accountant/expenses/delete/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    const db = require('./config/db');
    await db.query('DELETE FROM chi_phi_khac WHERE id_chi = ?', [req.params.id]);
    res.redirect('/staff/accountant/expenses');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// In Báo cáo Thu chi
app.get('/staff/accountant/reports/print', requireRole(['Ke toan']), async (req, res) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const report = await personnelService.getFinancialReport(month, year);
    const expenses = await personnelService.getAllExpenses();
    res.render('staff/accountant/report-print', { report, month, year, expenses });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/accountant/leave', requireRole(['Ke toan']), async (req, res) => {
  try {
    const leaves = await personnelService.getAllLeaveRequests();
    res.render('staff/accountant/leave', {
      title: 'Quản lý Nghỉ phép',
      leaves,
      msg: req.query.msg || null,
      msgType: req.query.msgType || 'info',
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'leave-manage'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/accountant/leave/add', requireRole(['Ke toan']), async (req, res) => {
  try {
    const { ly_do, ngay_bat_dau, ngay_ket_thuc } = req.body;
    await personnelService.addLeaveRequest(req.session.staffId, ly_do, ngay_bat_dau, ngay_ket_thuc);
    res.redirect('/staff/accountant/leave');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Kế toán duyệt đơn nghỉ phép
app.post('/staff/accountant/leave/approve/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    await personnelService.updateLeaveStatus(req.params.id, 1);
    res.redirect('/staff/accountant/leave?msg=Đã+duyệt+đơn+nghỉ+phép!&msgType=success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Kế toán từ chối đơn nghỉ phép
app.post('/staff/accountant/leave/reject/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    await personnelService.updateLeaveStatus(req.params.id, 2);
    res.redirect('/staff/accountant/leave?msg=Đã+từ+chối+đơn+nghỉ+phép!&msgType=warning');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


app.get('/staff/accountant/schedule', requireRole(['Ke toan']), async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const month = req.query.month || new Date().getMonth() + 1;
    const schedules = await personnelService.getSchedule(null, year, month); // All staff schedule
    res.render('staff/accountant/schedule', {
      title: 'Quản lý Lịch làm việc',
      schedules, month, year,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'schedule'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Gửi duyệt lương
app.post('/staff/accountant/salary/submit/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    await personnelService.submitSalaryForApproval(req.params.id);
    res.redirect('/staff/accountant/salary');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Chi lương (Thanh toán)
app.post('/staff/accountant/salary/pay/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    await personnelService.paySalary(req.params.id);
    res.redirect('/staff/accountant/salary');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// In Phiếu Lương
app.get('/staff/accountant/salary/print/:id', requireRole(['Ke toan']), async (req, res) => {
  try {
    const [salaryRows] = await db.query(`
      SELECT l.*, n.ten, n.chucvu 
      FROM luong l 
      JOIN nhan_vien n ON l.id_nv = n.id_nv 
      WHERE l.id_luong = ?
    `, [req.params.id]);

    if (salaryRows.length === 0) return res.status(404).send('Không tìm thấy bảng lương');
    res.render('staff/accountant/salary-print', { s: salaryRows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/profile', requireLogin, async (req, res) => {
  try {
    const user = await orderService.getUserById(req.session.userId);
    res.render('profile', { title: 'Thông tin cá nhân', user, msg: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/profile', requireLogin, async (req, res) => {
  const { action, ten, diachi, old_pass, new_pass, re_pass, email } = req.body;
  try {
    if (action === 'update') {
      await orderService.updateProfile(req.session.userId, { ten, email, diachi });
      // Cập nhật lại session name nếu cần
      req.session.username = ten;
      const user = await orderService.getUserById(req.session.userId);
      res.render('profile', { title: 'Thông tin cá nhân', user, msg: 'Cập nhật thông tin thành công!', msgType: 'success' });
    } else if (action === 'password') {
      if (new_pass !== re_pass) {
        const user = await orderService.getUserById(req.session.userId);
        return res.render('profile', { title: 'Thông tin cá nhân', user, msg: 'Mật khẩu xác nhận không khớp!', msgType: 'danger' });
      }
      await orderService.changePassword(req.session.userId, old_pass, new_pass);
      const user = await orderService.getUserById(req.session.userId);
      return res.render('profile', { title: 'Thông tin cá nhân', user, msg: 'Đổi mật khẩu thành công!', msgType: 'success' });
    }
    res.redirect('/profile');
  } catch (err) {
    const user = await orderService.getUserById(req.session.userId);
    res.render('profile', { title: 'Thông tin cá nhân', user, msg: err.message, msgType: 'danger' });
  }
});

// --- Customer: Cancel Order ---
app.post('/cancel-order', requireLogin, async (req, res) => {
  const { sesis } = req.body;
  try {
    await orderService.requestCancelOrder(sesis, req.session.userId);
    res.redirect('/my-orders');
  } catch (err) {
    console.error(err);
    res.redirect('/my-orders');
  }
});

// --- Customer: Chat ---
app.get('/chat', requireLogin, async (req, res) => {
  try {
    const messages = await engagementService.getConversation(req.session.userId);
    await engagementService.markAsRead(req.session.userId, 'nhanvien');
    res.render('chat', { title: 'Chat với nhân viên', messages });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/chat/send', requireLogin, async (req, res) => {
  const { noi_dung } = req.body;
  try {
    const userId = req.session.userId;
    const msg = await engagementService.sendMessage(userId, null, noi_dung, 'khach');

    // Emit real-time message
    io.to(`room_${userId}`).emit('new-message', {
      noi_dung: noi_dung,
      nguoi_gui: 'khach',
      thoigian: new Date(),
      ten_kh: req.session.username
    });

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ success: true });
    }
    res.redirect('/chat');
  } catch (err) {
    console.error(err);
    res.redirect('/chat');
  }
});

// --- Customer: Rating ---
app.get('/rating', requireLogin, async (req, res) => {
  try {
    const ratings = await engagementService.getAllRatings();
    const canRate = await orderService.hasCompletedOrder(req.session.userId);
    console.log('--- DEBUG GET /rating ---');
    console.log('userId:', req.session.userId);
    console.log('canRate:', canRate);
    console.log('-------------------------');
    res.render('rating', { title: 'Đánh giá dịch vụ', ratings, msg: null, canRate });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/rating', requireLogin, async (req, res) => {
  const { sao, noi_dung } = req.body;
  try {
    const canRate = await orderService.hasCompletedOrder(req.session.userId);
    if (!canRate) {
      const ratings = await engagementService.getAllRatings();
      return res.render('rating', { title: 'Đánh giá dịch vụ', ratings, msg: 'Bạn cần hoàn thành ít nhất 1 đơn đặt bàn để gửi đánh giá.', msgType: 'danger', canRate });
    }

    await engagementService.addRating(req.session.userId, sao, noi_dung);
    const ratings = await engagementService.getAllRatings();
    res.render('rating', { title: 'Đánh giá dịch vụ', ratings, msg: 'Cảm ơn bạn đã đánh giá!', msgType: 'success', canRate: true });
  } catch (err) {
    console.error(err);
    res.redirect('/rating');
  }
});

// ============================================================
// --- Staff Routes ---
// ============================================================

// Staff middleware: attach unread count to res.locals
app.use('/staff', async (req, res, next) => {
  if (req.session.stafflogin && req.session.staffId) {
    try {
      res.locals.unread = await personnelService.countUnread(req.session.staffId);
    } catch (e) {
      res.locals.unread = 0;
    }
  }
  next();
});

app.get('/staff/login', (req, res) => {
  if (req.session.stafflogin) return res.redirect('/staff');
  res.render('staff/login', { layout: false });
});

app.post('/staff/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const staff = await personnelService.staffLogin(username, password);
    if (staff) {
      req.session.stafflogin = true;
      req.session.staffId = staff.id_nv;
      req.session.staffName = staff.ten;
      req.session.staffRole = staff.chucvu; // vai tro cu - giu de cac route cu chay dung

      // Nap chuc danh, bo phan, cap bac va danh sach quyen theo co cau to chuc.
      // Loi o day khong duoc chan dang nhap: nguoi chua duoc bo nhiem chuc danh
      // van phai vao duoc he thong bang vai tro cu cua ho.
      try {
        await require('./services/phanQuyenService').napVaoSession(req, staff.id_nv);
      } catch (e) {
        console.error('Không nạp được hồ sơ quyền khi đăng nhập:', e.message);
      }

      // Lan dau dang nhap ma chua co khuon mat -> dua thang toi trang tu dang ky.
      // Chi kiem tra CSDL (nhanh); trang do tu kiem tra dich vu Python va luon co
      // nut "bo qua" nen khong bao gio chan duoc viec vao he thong.
      try {
        const soMau = await require('./services/faceService').soMauCua(staff.id_nv);
        if (soMau === 0) return res.redirect('/staff/khuon-mat/lan-dau');
      } catch (e) {
        console.error('Không kiểm tra được khuôn mặt khi đăng nhập:', e.message);
      }
      return res.redirect('/staff');
    }
    res.render('staff/login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng!', layout: false });
  } catch (err) {
    console.error(err);
    res.render('staff/login', { error: 'Lỗi hệ thống!', layout: false });
  }
});

app.get('/staff/logout', (req, res) => {
  req.session.stafflogin = false;
  req.session.staffId = null;
  req.session.staffName = null;
  res.redirect('/staff/login');
});

app.get('/staff', requireStaff, async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth() + 1;
    const [schedule, attendance, notifications, customers] = await Promise.all([
      personnelService.getSchedule(req.session.staffId, year, month),
      personnelService.getAttendance(req.session.staffId, year, month),
      personnelService.getNotifications(req.session.staffId),
      engagementService.getChatCustomers()
    ]);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    const weekSchedule = schedule.filter(s => {
      const d = new Date(s.ngay);
      return d >= weekStart && d <= weekEnd && s.trangthai == 1;
    });
    const pendingChats = customers.reduce((sum, c) => sum + (c.unread || 0), 0);
    res.render('staff/index', {
      title: 'Tổng quan',
      stats: { totalSchedule: schedule.length, totalAttendance: attendance.length, pendingChats },
      weekSchedule,
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- STAFF BOOKINGS ---
app.get('/staff/bookings', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const bookings = await orderService.getAllBookings();
    const qrCodes = await orderService.getAllQRCodes();
    res.render('staff/bookings', {
      title: 'Quản lý Đặt bàn',
      bookings,
      qrCodes,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'bookings'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/bookings/create', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    res.render('staff/booking-create', {
      title: 'Tạo đặt bàn mới',
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'bookings'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/bookings/create', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const { dates } = req.body;
    const today = new Date().toISOString().split('T')[0];
    if (dates < today) {
      return res.send('<script>alert("Ngày đặt bàn không được ở quá khứ!"); history.back();</script>');
    }
    const sesis = await orderService.createStaffBooking(req.body);

    // Notify Kitchen Real-time
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: `Nhân viên Phục vụ [${req.session.staffName}] vừa tạo 1 đơn bàn mới!`,
      sesis: sesis
    });

    res.redirect('/staff/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/bookings/edit/:sesis', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    await orderService.updateBooking(req.params.sesis, req.body);
    res.redirect('/staff/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

/**
 * Duong dan thanh toan CU - nay chi con chuyen huong sang man hinh thu ngan.
 *
 * Ban cu goi orderService.payBill(), tuc la chi `UPDATE hopdong SET tinhtrang = 3`:
 * don duoc danh dau "da thanh toan" ma KHONG co dong nao trong bang `payments`.
 * Hau qua: khong biet thu bao nhieu, bang hinh thuc gi, ai thu, khong in duoc
 * bien lai, va bao cao doanh thu khong khop voi tien thuc te trong ket.
 *
 * Khong xoa han duong dan de trang nao con giu bookmark hoac form cu khong bi
 * loi 404 - nhung tu day moi viec thu tien deu phai di qua /staff/thanh-toan.
 */
app.post('/staff/bookings/pay/:sesis', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), (req, res) => {
  res.redirect(303, '/staff/thanh-toan/' + encodeURIComponent(req.params.sesis));
});

app.post('/staff/bookings/confirm/:sesis', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    await db.query('UPDATE hopdong SET tinhtrang = 1 WHERE sesis = ?', [req.params.sesis]);
    res.redirect('/staff/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/bookings/arrive/:sesis', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  const { table_id } = req.body;
  const sesis = req.params.sesis;
  try {
    const [rows] = await db.query('SELECT tinhtrang FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]);
    if (rows.length > 0 && rows[0].tinhtrang === 1) {
      await db.query('UPDATE hopdong SET tinhtrang = 5 WHERE sesis = ?', [sesis]);
    }
    
    // Clear any previous mapping for this sesis in qr_tables
    await db.query('UPDATE qr_tables SET active_sesis = NULL WHERE active_sesis = ?', [sesis]);
    
    // Link selected table
    if (table_id) {
      await db.query('UPDATE qr_tables SET active_sesis = ? WHERE table_id = ?', [sesis, table_id]);
    }
    
    res.redirect('/staff/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/bookings/print/:sesis', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const details = await orderService.getBookingDetails(req.params.sesis);
    if (!details || details.length === 0) return res.status(404).send('Không tìm thấy hóa đơn');
    // Using layout: false because it will be a raw HTML print layout.
    res.render('staff/bill-print', { layout: false, details });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- STAFF KITCHEN ORDERS ---
app.get('/staff/kitchen', requireRole(['Phuc vu', 'Ke toan', 'Bep', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    let orders = await orderService.getKitchenOrders();

    // Nếu là nhân viên phục vụ, chỉ xem các món đã làm xong (trangthai_bep = 1)
    if (req.session.staffRole === 'Phuc vu') {
      orders = orders.filter(o => o.trangthai_bep === 1);
    }

    res.render('staff/kitchen', {
      title: 'Quản lý Đơn bàn (Bếp)',
      orders,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'kitchen'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/mark-done/:id', requireRole(['Bep']), async (req, res) => {
  try {
    const dishId = req.params.id;
    // Sử dụng đúng service và bảng dữ liệu của dự án
    await orderService.markKitchenDone(dishId);

    // Lấy thông tin món từ bảng hopdong
    const [dishInfo] = await db.query('SELECT name_mon, sesis, soluong FROM hopdong WHERE id = ?', [dishId]);

    if (dishInfo.length > 0) {
      io.to('staff_room').emit('dish-ready', {
        message: `Món [${dishInfo[0].name_mon}] (x${dishInfo[0].soluong}) của đơn ${dishInfo[0].sesis.substring(0, 6).toUpperCase()} đã sẵn sàng!`
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi khi báo xong món:', err);
    res.status(500).json({ success: false, error: 'Lỗi server: ' + err.message });
  }
});

// --- KITCHEN MANAGEMENT (Role: 'Bep') ---
app.get('/staff/kitchen/inventory', requireRole(['Bep']), async (req, res) => {
  try {
    const ingredients = await menuService.getAllIngredients();
    const units = await menuService.getAllUnits();
    res.render('staff/kitchen/inventory', {
      title: 'Quản lý Kho',
      ingredients,
      units,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'inventory'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/ingredient/add', requireRole(['Bep']), async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.new_dvt && data.new_dvt.trim()) {
      const ten_new = data.new_dvt.trim();
      const [existing] = await db.query('SELECT id_dvt FROM don_vi_tinh WHERE LOWER(ten_dvt) = LOWER(?)', [ten_new]);
      if (existing.length > 0) {
        data.id_dvt = existing[0].id_dvt;
      } else {
        const [result] = await db.query('INSERT INTO don_vi_tinh (ten_dvt) VALUES (?)', [ten_new]);
        data.id_dvt = result.insertId;
      }
    }
    await menuService.addIngredient(data);
    res.redirect('/staff/kitchen/inventory');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/inventory/stock-in', requireRole(['Bep']), async (req, res) => {
  try {
    const { so_luong, gia_nhap } = req.body;
    if (Number(so_luong) <= 0 || Number(gia_nhap) <= 0) {
      return res.send('<script>alert("Số lượng và Giá nhập phải lớn hơn 0!"); history.back();</script>');
    }
    await menuService.addStockIn(req.body);
    res.redirect('/staff/kitchen/inventory');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/ingredient/edit/:id', requireRole(['Bep']), async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.new_dvt && data.new_dvt.trim()) {
      const ten_new = data.new_dvt.trim();
      const [existing] = await db.query('SELECT id_dvt FROM don_vi_tinh WHERE LOWER(ten_dvt) = LOWER(?)', [ten_new]);
      if (existing.length > 0) {
        data.id_dvt = existing[0].id_dvt;
      } else {
        const [result] = await db.query('INSERT INTO don_vi_tinh (ten_dvt) VALUES (?)', [ten_new]);
        data.id_dvt = result.insertId;
      }
    }
    await menuService.updateIngredient(req.params.id, data);
    res.redirect('/staff/kitchen/inventory');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/ingredient/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.deleteIngredient(req.params.id);
    res.redirect('/staff/kitchen/inventory');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Unit CRUD
app.post('/staff/kitchen/unit/add', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.addUnit(req.body.ten_dvt);
    res.redirect('/staff/kitchen/inventory');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/unit/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.deleteUnit(req.params.id);
    res.redirect('/staff/kitchen/inventory');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/unit/edit/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.updateUnit(req.params.id, req.body.ten_dvt);
    res.redirect('/staff/kitchen/inventory');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Recipe delete
app.get('/staff/kitchen/recipe/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.deleteRecipeItem(req.params.id);
    res.redirect('/staff/kitchen/recipes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/stock-history', requireRole(['Bep']), async (req, res) => {
  try {
    const history = await menuService.getStockHistory();
    res.render('staff/kitchen/stock-history', {
      title: 'Lịch sử Kho',
      history,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'inventory'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/recipes', requireRole(['Bep']), async (req, res) => {
  try {
    const dishes = await personnelService.getAllProducts();
    const ingredients = await menuService.getAllIngredients();
    res.render('staff/kitchen/recipes', {
      title: 'Quản lý Công thức',
      dishes,
      ingredients,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'recipes'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/recipe/:dishId', requireRole(['Bep']), async (req, res) => {
  try {
    const recipe = await menuService.getRecipeByDish(req.params.dishId);
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/staff/kitchen/recipe/add', requireRole(['Bep']), async (req, res) => {
  try {
    const { id_mon, id_nl, so_luong_tieu_hao } = req.body;
    await menuService.addRecipeItem(id_mon, id_nl, so_luong_tieu_hao);
    res.redirect('/staff/kitchen/recipes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/recipe/edit/:id', requireRole(['Bep']), async (req, res) => {
  try {
    const { id_mon, id_nl, so_luong } = req.body;
    await menuService.updateRecipeItem(req.params.id, id_mon, id_nl, so_luong);
    res.redirect('/staff/kitchen/recipes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/equipment', requireRole(['Bep']), async (req, res) => {
  try {
    const equipment = await menuService.getAllEquipment();
    res.render('staff/kitchen/equipment', {
      title: 'Quản lý Thiết bị',
      equipment,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'equipment'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/equipment/add', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.addEquipment(req.body);
    res.redirect('/staff/kitchen/equipment');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/equipment/edit/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.updateEquipment(req.params.id, req.body);
    res.redirect('/staff/kitchen/equipment');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/equipment/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.deleteEquipment(req.params.id);
    res.redirect('/staff/kitchen/equipment');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Combo CRUD
app.post('/staff/kitchen/combo/add', requireRole(['Bep']), upload.single('hinh_anh'), async (req, res) => {
  try {
    const hinh_anh = req.file ? req.file.filename : null;
    await menuService.addCombo({ ...req.body, hinh_anh });
    res.redirect('/staff/kitchen/combos');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/combo/edit/:id', requireRole(['Bep']), upload.single('hinh_anh'), async (req, res) => {
  try {
    const hinh_anh = req.file ? req.file.filename : null;
    await menuService.updateCombo(req.params.id, { ...req.body, hinh_anh });
    res.redirect('/staff/kitchen/combos');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/combo/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await menuService.deleteCombo(req.params.id);
    res.redirect('/staff/kitchen/combos');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Dish manage by Kitchen
app.post('/staff/kitchen/dish/add', requireRole(['Bep']), upload.single('images'), async (req, res) => {
  try {
    const image = req.file ? req.file.filename : null;
    await personnelService.addProduct({ name: req.body.name_mon, categoryId: req.body.id_loai, note: req.body.ghichu_mon, price: req.body.gia_mon, image });
    res.redirect('/staff/kitchen/dishes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/dish/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await personnelService.deleteProduct(req.params.id);
    res.redirect('/staff/kitchen/dishes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Category CRUD by Kitchen
app.post('/staff/kitchen/categories/add', requireRole(['Bep']), async (req, res) => {
  try {
    await personnelService.addCategory(req.body.name_loai, req.body.ghichu);
    res.redirect('/staff/kitchen/categories');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/categories/edit/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await personnelService.updateCategory(req.params.id, req.body.name_loai, req.body.ghichu);
    res.redirect('/staff/kitchen/categories');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/categories/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await personnelService.deleteCategory(req.params.id);
    res.redirect('/staff/kitchen/categories');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/combos', requireRole(['Bep']), async (req, res) => {
  try {
    const combos = await menuService.getAllCombos();
    res.render('staff/kitchen/combos', {
      title: 'Quản lý Combo',
      combos,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'kitchen-menu'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/categories', requireRole(['Bep']), async (req, res) => {
  try {
    const categories = await personnelService.getAllCategories();
    res.render('staff/kitchen/categories', {
      title: 'Quản lý Loại món',
      categories,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'kitchen-menu'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/dishes', requireRole(['Bep']), async (req, res) => {
  try {
    const dishes = await personnelService.getAllProducts();
    const categories = await personnelService.getAllCategories();
    res.render('staff/kitchen/dishes', {
      title: 'Quản lý Món ăn',
      dishes,
      categories,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'kitchen-menu'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/shift', requireRole(['Bep']), async (req, res) => {
  try {
    const [history] = await db.query(`
      SELECT c.*, n.ten as ten_nv 
      FROM chot_ca c 
      JOIN nhan_vien n ON c.staff_id = n.id_nv 
      ORDER BY c.created_at DESC 
      LIMIT 20
    `);
    res.render('staff/kitchen/shift', {
      title: 'Chốt ca Bếp',
      history,
      msg: req.query.msg || null,
      msgType: req.query.msgType || 'success',
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'kitchen-shift'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// --- KITCHEN SHIFT CLOSE (POST) ---
app.post('/staff/kitchen/shift/close', requireRole(['Bep']), async (req, res) => {
  try {
    const { ngay, ca, tong_tien, ghi_chu } = req.body;
    if (!ngay || !ca) {
      return res.send('<script>alert("Vui lòng điền đầy đủ thông tin chốt ca!"); history.back();</script>');
    }
    await db.query(
      'INSERT INTO chot_ca (staff_id, ngay, ca, tong_tien, ghi_chu) VALUES (?, ?, ?, ?, ?)',
      [req.session.staffId, ngay, ca, tong_tien || 0, ghi_chu || '']
    );
    res.redirect('/staff/kitchen/shift?msg=Chốt+ca+thành+công!&msgType=success');
  } catch (err) {
    console.error('Lỗi chốt ca bếp:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/staff/customers', requireRole(['Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const customers = await orderService.getAllCustomers();
    res.render('staff/customers', {
      title: 'Quản lý Khách hàng',
      customers,
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'customers'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/customers/add', requireStaff, async (req, res) => {
  try {
    await orderService.addCustomer(req.body);
    res.redirect('/staff/customers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/customers/edit/:id', requireStaff, async (req, res) => {
  try {
    await orderService.updateCustomer(req.params.id, req.body);
    res.redirect('/staff/customers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/customers/delete/:id', requireStaff, async (req, res) => {
  try {
    await orderService.deleteCustomer(req.params.id);
    res.redirect('/staff/customers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- STAFF SHIFT ---
/**
 * Chot ca CU - nay chi con chuyen huong sang /staff/chot-ca.
 *
 * Man hinh cu bat thu ngan TU GO tong doanh thu vao mot o input roi luu thang
 * vao bang `chot_ca`. Con so do khong doi chieu voi bat cu dau: go bao nhieu
 * cung duoc chap nhan, nen no khong chung minh duoc dieu gi ve ket tien.
 *
 * Man hinh moi tu tinh ket PHAI co bao nhieu tu bang `payments`, thu ngan dem
 * ket that va nhap vao, chenh lech hien ra va phai giai trinh. Bang `chot_ca`
 * van giu nguyen cho ben BEP dung o /staff/kitchen/shift - ben do khong dinh
 * den tien nen khong co gi de doi soat.
 */
app.get('/staff/shift', requireRole(['Ke toan', 'Quay', 'Thu ngan']), (req, res) => {
  res.redirect(301, '/staff/chot-ca');
});

app.post('/staff/shift/close', requireRole(['Ke toan', 'Quay', 'Thu ngan']), (req, res) => {
  res.redirect(303, '/staff/chot-ca');
});

// --- STAFF EMAILS ---
app.get('/staff/emails', requireRole(['Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const logs = await orderService.getEmailLogs();
    res.render('staff/emails', {
      title: 'Lịch sử Gửi Email',
      logs,
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/emails/send', requireRole(['Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    res.render('staff/email-send', {
      title: 'Gửi Email mới',
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/emails/send', requireRole(['Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  const { recipient, subject, content } = req.body;
  try {
    await mailer.sendMail(recipient, subject, content);
    await orderService.saveEmailLog(req.session.staffId, { recipient, subject, content });
    res.redirect('/staff/emails');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi khi gửi email: ' + err.message);
  }
});

// Staff Schedule
app.get('/staff/schedule', requireStaff, async (req, res) => {
  try {
    const [year, month] = (req.query.thang || new Date().toISOString().slice(0, 7)).split('-').map(Number);
    const schedule = await personnelService.getSchedule(req.session.staffId, year, month);
    res.render('staff/schedule', {
      title: 'Lịch làm việc', schedule,
      currentMonth: req.query.thang || new Date().toISOString().slice(0, 7),
      msg: req.query.msg || null, msgType: req.query.msgType || null,
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/schedule', requireStaff, async (req, res) => {
  const { ngay, ca, ghi_chu } = req.body;
  try {
    await personnelService.registerSchedule(req.session.staffId, ngay, ca, ghi_chu);
    res.redirect('/staff/schedule?msg=Đăng+ký+lịch+thành+công!&msgType=success');
  } catch (err) {
    res.redirect('/staff/schedule?msg=' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

app.get('/staff/schedule/cancel/:id', requireStaff, async (req, res) => {
  try {
    await personnelService.cancelSchedule(req.params.id, req.session.staffId);
    res.redirect('/staff/schedule?msg=Đã+hủy+đăng+ký&msgType=info');
  } catch (err) {
    res.redirect('/staff/schedule');
  }
});

// Staff Attendance
app.get('/staff/attendance', requireStaff, async (req, res) => {
  try {
    const [year, month] = (req.query.thang || new Date().toISOString().slice(0, 7)).split('-').map(Number);
    const today = new Date().toISOString().slice(0, 10);
    const faceSvc = require('./services/faceService');
    const [attendance, todayRows, trangThai, soMauKhuonMat] = await Promise.all([
      personnelService.getAttendance(req.session.staffId, year, month),
      require('./config/db').query(
        'SELECT * FROM cham_cong WHERE id_nv = ? AND ngay = ? ORDER BY id_cc DESC LIMIT 1',
        [req.session.staffId, today]),
      // Trang cham cong nay tu no la mot may cham cong khuon mat, nen phai biet
      // dich vu nhan dien co song khong va nguoi dang xem da dang ky mau chua.
      faceSvc.trangThaiDichVu(),
      faceSvc.soMauCua(req.session.staffId),
    ]);
    res.render('staff/attendance', {
      title: 'Chấm công', attendance,
      trangThai, soMauKhuonMat,
      todayAttendance: todayRows[0][0] || null,
      currentMonth: req.query.thang || new Date().toISOString().slice(0, 7),
      msg: req.query.msg || null, msgType: req.query.msgType || null,
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Cham cong thu cong (POST /staff/clock-in va /staff/clock-out) DA GO BO.
//
// Hai route cu chi can mot phien dang nhap la ghi duoc gio vao/gio ra, nen ai
// muon cham ho chi viec muon tai khoan - dung thu ma cham cong khuon mat sinh
// ra de chan. Nay chi con mot duong duy nhat: POST /api/khuon-mat/cham-cong
// (routes/khuonMat.js), bat buoc qua kiem tra anh song + doi chieu GPS.
//
// Trang /staff/attendance ben duoi van giu, nhung phan bam tay doi thanh camera.

// Staff Notifications
app.get('/staff/notifications', requireStaff, async (req, res) => {
  try {
    const notifications = await personnelService.getNotifications(req.session.staffId);
    res.render('staff/notifications', {
      title: 'Thông báo', notifications,
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/notifications/read/:id', requireStaff, async (req, res) => {
  try {
    await personnelService.markNotificationRead(req.params.id);
    res.redirect('/staff/notifications');
  } catch (err) {
    res.redirect('/staff/notifications');
  }
});

app.get('/staff/notifications/read-all', requireStaff, async (req, res) => {
  try {
    await require('./config/db').query(
      `UPDATE thong_bao SET da_doc = 1 WHERE id_nv = ? OR id_nv IS NULL`,
      [req.session.staffId]
    );
    res.redirect('/staff/notifications');
  } catch (err) {
    res.redirect('/staff/notifications');
  }
});

// Staff Leave Requests
app.get('/staff/leave', requireStaff, async (req, res) => {
  try {
    const leaves = await personnelService.getMyLeaveRequests(req.session.staffId);
    res.render('staff/leave', {
      title: 'Xin nghỉ phép',
      leaves,
      staffName: req.session.staffName,
      activePage: 'leave',
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/leave/add', requireStaff, async (req, res) => {
  try {
    const { ly_do, ngay_bat_dau, ngay_ket_thuc } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Ràng buộc 1: Ngày bắt đầu không được trong quá khứ
    if (ngay_bat_dau < today) {
      return res.send('<script>alert("Ngày bắt đầu không được ở quá khứ!"); history.back();</script>');
    }
    // Ràng buộc 2: Ngày kết thúc không được nhỏ hơn ngày bắt đầu
    if (ngay_ket_thuc < ngay_bat_dau) {
      return res.send('<script>alert("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!"); history.back();</script>');
    }

    await personnelService.addLeaveRequest(req.session.staffId, ly_do, ngay_bat_dau, ngay_ket_thuc);
    res.redirect('/staff/leave');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Staff Profile
app.get('/staff/profile', requireStaff, async (req, res) => {
  try {
    const staff = await personnelService.getStaffById(req.session.staffId);
    res.render('staff/profile', {
      title: 'Thông tin cá nhân', staff,
      msg: req.query.msg || null, msgType: req.query.msgType || null,
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/profile', requireStaff, async (req, res) => {
  const { action, ten, sodienthoai, email, diachi, old_pass, new_pass, re_pass } = req.body;
  try {
    if (action === 'update') {
      await personnelService.updateStaffProfile(req.session.staffId, { ten, sodienthoai, email, diachi });
      req.session.staffName = ten;
    } else if (action === 'password') {
      if (new_pass !== re_pass) return res.redirect('/staff/profile?msg=Mật+khẩu+xác+nhận+không+khớp!&msgType=danger');
      await personnelService.changeStaffPassword(req.session.staffId, old_pass, new_pass);
    }
    res.redirect('/staff/profile?msg=Cập+nhật+thành+công!&msgType=success');
  } catch (err) {
    res.redirect('/staff/profile?msg=' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

// Staff Chat
app.get('/staff/chat', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const customers = await engagementService.getChatCustomers();
    res.render('staff/chat', {
      title: 'Chat khách hàng', customers,
      selectedCustomer: null, selectedId: null, messages: [],
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/chat/:id_kh', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const id_kh = req.params.id_kh;
    const [customers, messages, custRows] = await Promise.all([
      engagementService.getChatCustomers(),
      engagementService.getMessagesForCustomer(id_kh),
      require('./config/db').query('SELECT * FROM khach_hang WHERE id = ?', [id_kh])
    ]);
    await engagementService.markAsRead(id_kh, 'khach');
    res.render('staff/chat', {
      title: 'Chat khách hàng', customers,
      selectedCustomer: custRows[0][0] || null,
      selectedId: parseInt(id_kh),
      messages,
      unread: await personnelService.countUnread(req.session.staffId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/chat/send', requireStaff, async (req, res) => {
  const { id_kh, noi_dung } = req.body;
  try {
    await engagementService.sendMessage(id_kh, req.session.staffId, noi_dung, 'nhanvien');

    // Emit real-time message to the specific customer room
    io.to(`room_${id_kh}`).emit('new-message', {
      noi_dung: noi_dung,
      nguoi_gui: 'nhanvien',
      thoigian: new Date(),
      ten_nv: req.session.staffName
    });

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ success: true });
    }
    res.redirect('/staff/chat/' + id_kh);
  } catch (err) {
    console.error(err);
    res.redirect('/staff/chat');
  }
});

// ============================================================
// --- QR Code Routes (Public - no login required) ---
// ============================================================

/*
 * QUY TAC CHUNG CUA HAI ROUTE QR BEN DUOI
 *
 * Ma QR dan o ban la thu duy nhat khach co. Moi thong tin khac ve ban (ten
 * ban, so ban, ma phien dang mo) deu do may chu tu tra ra tu `qr_tables`,
 * TUYET DOI khong lay tu `req.query` hay `req.body`.
 *
 * Truoc day hai gia tri bi tin nham:
 *   - `?name=` / `body.tableName` -> dung de do ra `Id_ban`. Khach sua thanh
 *     dia chi thanh `?name=12` la mon ra ban 12 va ban 12 bi danh dau dang
 *     phuc vu bang phien cua nguoi khac.
 *   - `?sesis=` -> dung lam hoa don de goi them mon. Biet ma phien cua ban
 *     khac thi goi mon vao hoa don ban do.
 */

// Trang menu đặt món qua QR
app.get('/qr/table/:tableId', async (req, res) => {
  try {
    const tableId = req.params.tableId;
    const ban = await orderService.layBanQR(tableId);
    if (!ban) {
      return res.status(404).send(
        '<h3 style="font-family:sans-serif;padding:24px">Mã QR không hợp lệ.<br>' +
        'Vui lòng báo nhân viên để được hỗ trợ.</h3>'
      );
    }
    const tableName = ban.table_name;
    // Ma phien do may chu tra theo ban, khong nhan tu URL.
    const sesis = await orderService.phienDangMoCuaBan(tableId);

    const categories = await menuService.getAllCategories();
    const [allDishes] = await db.query(
      'SELECT * FROM monan WHERE tinhtrang = 1 ORDER BY id_loai, name_mon'
    );

    // Nếu có sesis thì dùng, không thì để trang xử lý tạo mới khi đặt
    res.render('qr-menu', {
      layout: false,
      title: 'Đặt món - ' + tableName,
      tableId,
      tableName,
      sesis: sesis || '',
      categories,
      dishes: allDishes
    });
  } catch (err) {
    console.error('QR menu error:', err);
    res.status(500).send('<h3>Lỗi hệ thống. Vui lòng báo nhân viên!</h3>');
  }
});

/*
 * Don hien tai cua mot ban QR (JSON).
 *
 * Trang dat mon goi dinh ky de ve buoc "Bep che bien": khach thay tung mon
 * dang cho, dang nau, xong hay da mang ra. Khong yeu cau dang nhap - dung muc
 * cong khai nhu chinh trang QR - va chi tra ve mon cua ban do, khong kem
 * thong tin khach hang.
 */
const { TEN_TRANG_THAI_BEP } = require('./services/kdsService');

app.get('/qr/table/:tableId/don', async (req, res) => {
  try {
    const ban = await orderService.layBanQR(req.params.tableId);
    if (!ban) return res.status(404).json({ success: false, message: 'Mã bàn không hợp lệ' });
    const don = await orderService.donCuaBanQR(req.params.tableId);
    res.json({
      success: true,
      sesis: don.sesis,
      tam_tinh: don.tam_tinh,
      mon: don.mon.map((m) => ({
        id: m.id,
        ten: m.name_mon,
        so_luong: Number(m.soluong) || 0,
        gia: Number(m.gia) || 0,
        thanh_tien: Number(m.thanhtien) || 0,
        anh: m.images || '',
        ghi_chu: m.ghi_chu_mon || '',
        trang_thai: Number(m.trangthai_bep) || 0,
        ten_trang_thai: TEN_TRANG_THAI_BEP[Number(m.trangthai_bep) || 0] || 'Chờ chế biến',
      })),
    });
  } catch (err) {
    console.error('QR order status error:', err);
    res.status(500).json({ success: false, message: 'Không lấy được đơn của bàn' });
  }
});

/*
 * Gioi han tan suat dat mon theo tung ban.
 *
 * Ma QR dan cong khai o ban, ai di ngang cung quet duoc. Khong co gioi han thi
 * mot nguoi co the bam lien tuc de bom don rac thang vao man hinh bep. Dem
 * trong bo nho tien trinh la du: he thong chay mot tien trinh Node, va gioi
 * han nay chi de chan spam chu khong phai co che bao mat.
 */
const QR_GIOI_HAN_LAN = 12;              // so lan gui toi da
const QR_GIOI_HAN_CUA_SO_MS = 5 * 60000; // trong 5 phut
const qrNhatKyGui = new Map();           // table_id -> [moc thoi gian]

function qrVuotGioiHan(tableId) {
  const bayGio = Date.now();
  const moc = (qrNhatKyGui.get(tableId) || []).filter((t) => bayGio - t < QR_GIOI_HAN_CUA_SO_MS);
  if (moc.length >= QR_GIOI_HAN_LAN) {
    qrNhatKyGui.set(tableId, moc);
    return true;
  }
  moc.push(bayGio);
  qrNhatKyGui.set(tableId, moc);
  return false;
}

// Don rac trong Map moi 10 phut de khong phinh bo nho theo thoi gian chay.
setInterval(() => {
  const bayGio = Date.now();
  for (const [ban, moc] of qrNhatKyGui) {
    const conHan = moc.filter((t) => bayGio - t < QR_GIOI_HAN_CUA_SO_MS);
    if (conHan.length) qrNhatKyGui.set(ban, conHan);
    else qrNhatKyGui.delete(ban);
  }
}, 10 * 60000).unref();

// API đặt món qua QR (POST JSON)
app.post('/qr/add-dish', async (req, res) => {
  try {
    const { tableId, items } = req.body;
    if (!items || items.length === 0) {
      return res.json({ success: false, message: 'Giỏ hàng trống!' });
    }

    // Ma ban phai co that. Truoc day khong kiem tra, nen ma bia dat cung tao
    // duoc don va sinh them mot dong khach_hang rac.
    const ban = await orderService.layBanQR(tableId);
    if (!ban) {
      return res.json({ success: false, message: 'Mã bàn không hợp lệ, vui lòng báo nhân viên!' });
    }

    if (qrVuotGioiHan(ban.table_id)) {
      return res.json({
        success: false,
        message: 'Bàn đã gửi quá nhiều lượt đặt món trong ít phút. Vui lòng gọi nhân viên hỗ trợ.',
      });
    }

    // Ma phien do may chu tu tra theo ban - khong nhan `sesis` tu client nua.
    let targetSesis = await orderService.phienDangMoCuaBan(tableId);
    if (!targetSesis) {
      targetSesis = await orderService.createQROrder(tableId);
    } else {
      // Phiên cũ có thể chưa gắn bàn -> gắn lại để bếp thấy món này của bàn nào.
      await orderService.lienKetPhienVoiBan(targetSesis, tableId);
    }

    await orderService.addMultipleDishesToOrder(targetSesis, items);

    // Thông báo bếp qua socket
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: `Khách bàn đặt thêm món qua QR! Mã đơn: ${targetSesis.substring(0,8).toUpperCase()}`,
      sesis: targetSesis
    });

    res.json({ success: true, sesis: targetSesis });
  } catch (err) {
    console.error('QR add dish error:', err);
    res.json({ success: false, message: err.message });
  }
});

// ============================================================
// --- Staff: QR Code Management ---
// ============================================================

app.get('/staff/qr-codes', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    // Dung lai `url` theo dia chi hien tai truoc khi ve ma QR: cac ma tao truoc
    // day da luu san chuoi `http://localhost:3000/...` va dien thoai khach
    // khong the mo duoc. Xem utils/diaChiQR.js.
    const qrCodes = (await orderService.getAllQRCodes()).map((qr) => ({
      ...qr,
      url: diaChiQR.chuanHoa(qr.url, req),
    }));
    res.render('staff/qr-codes', {
      title: 'Quản lý QR Code',
      qrCodes,
      qrGoc: diaChiQR.goc(req),
      dsDiaChi: diaChiQR.danhSachDiaChi().map((ip) => `http://${ip}:${PORT}`),
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'qr-codes'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/qr-codes/create', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const { table_name, note } = req.body;
    if (!table_name) return res.json({ success: false, message: 'Tên bàn không được trống!' });
    const result = await orderService.createQRCode(table_name, note, diaChiQR.goc(req));
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

app.post('/staff/qr-codes/delete/:id', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    await orderService.deleteQRCode(req.params.id);
    res.redirect('/staff/qr-codes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ============================================================
// --- Staff: Add Dish to Existing Booking ---
// ============================================================

// Lấy danh sách món để staff chọn (API JSON)
app.get('/staff/bookings/dishes', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const categories = await menuService.getAllCategories();
    const [dishes] = await db.query(
      'SELECT m.*, l.name_loai FROM monan m JOIN loai_mon l ON m.id_loai = l.id_loai WHERE m.tinhtrang = 1 ORDER BY l.name_loai, m.name_mon'
    );
    res.json({ success: true, categories, dishes });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// API thêm món vào đơn đặt bàn (nhân viên thêm)
app.post('/staff/bookings/add-dish/:sesis', requireRole(['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan']), async (req, res) => {
  try {
    const sesis = req.params.sesis;
    const { id_mon, soluong } = req.body;
    const qty = parseInt(soluong) || 1;

    if (!id_mon) return res.json({ success: false, message: 'Chưa chọn món!' });
    if (qty < 1) return res.json({ success: false, message: 'Số lượng phải >= 1!' });

    await orderService.addDishToOrder(sesis, id_mon, qty);

    // Thông báo bếp
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: `Nhân viên [${req.session.staffName}] vừa thêm món vào đơn ${sesis.substring(0,6).toUpperCase()}!`,
      sesis
    });

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.json({ success: true });
    }
    res.redirect('/staff/bookings');
  } catch (err) {
    console.error('Add dish to booking error:', err);
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.json({ success: false, message: err.message });
    }
    res.redirect('/staff/bookings?msg=' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

// --- Xu ly loi tap trung ---
// Phai dat SAU toan bo route. Truoc day hai middleware nay da duoc viet trong
// middleware/errorHandler.js nhung khong noi nao goi, nen loi trong route async
// lam treo request thay vi tra ve trang loi.
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

// --- Khoi dong: HTTP cho may tinh tai cho, HTTPS cho dien thoai ---
//
// Vi sao phai co HTTPS: trinh duyet chi cho dung camera va GPS trong "secure
// context" - tuc HTTPS hoac localhost. May tinh dat tai nha hang mo bang
// http://localhost thi khong sao, nhung nhan vien mo bang dien thoai qua
// http://<ip-lan>:3000 thi `navigator.mediaDevices` khong ton tai va trang cham
// cong khong the hoat dong. Xem config/chungChi.js.
//
// Van giu HTTP: cac trang khong dung camera (don hang, thuc don, bao cao) chay
// binh thuong tren HTTP, va khong bat ai phai bam qua canh bao chung chi neu ho
// khong can cham cong bang khuon mat.
const chungChi = require('./config/chungChi');
const PORT_HTTPS = Number(process.env.HTTPS_PORT) || 3443;
const BAT_HTTPS = String(process.env.BAT_HTTPS || '1') !== '0';

function inBangDiaChi(dsLan, coHttps) {
  const d = (s) => console.log('  ' + s);
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Hệ thống nhà hàng đã khởi động                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  d(`Máy tại chỗ:      http://localhost:${PORT}`);
  if (coHttps) d(`Máy tại chỗ (bảo mật): https://localhost:${PORT_HTTPS}`);
  if (dsLan.length) {
    console.log('');
    d('Điện thoại trong cùng mạng Wi-Fi — CHẤM CÔNG KHUÔN MẶT');
    d('phải dùng địa chỉ https:// dưới đây, http:// sẽ không mở được camera:');
    dsLan.forEach((ip) => d(coHttps ? `   https://${ip}:${PORT_HTTPS}` : `   http://${ip}:${PORT} (KHÔNG dùng được camera)`));
    console.log('');
    d(`Mã QR dán ở bàn đang dùng địa chỉ: ${diaChiQR.goc(null)}`);
    if (dsLan.length > 1) {
      d('Máy này có nhiều địa chỉ (card mạng ảo của WSL / VMware / VirtualBox).');
      d('Nếu điện thoại quét mã QR mà không mở được trang, hãy thử từng địa chỉ');
      d('phía trên bằng trình duyệt điện thoại, rồi ghi địa chỉ chạy được vào');
      d('khóa QR_BASE_URL trong file .env (ví dụ QR_BASE_URL=http://192.168.1.5:3000).');
    }
    if (coHttps) {
      console.log('');
      d('Lần đầu mỗi máy sẽ báo "Kết nối không an toàn" — đó là do chứng chỉ');
      d('tự ký, không phải lỗi. Bấm "Nâng cao" → "Tiếp tục truy cập".');
    }
  } else {
    d('(Không tìm thấy địa chỉ mạng LAN nào — máy chủ chưa nối Wi-Fi/LAN?)');
  }
  console.log('');
}

(async () => {
  server.listen(PORT, () => {});

  if (!BAT_HTTPS) {
    console.log('[https] Đã tắt qua BAT_HTTPS=0 — chỉ chạy HTTP.');
    return inBangDiaChi(chungChi.diaChiLan(), false);
  }

  let cc = null;
  try {
    cc = await chungChi.layChungChi();
    if (cc && cc.moi) console.log('[https] Đã sinh chứng chỉ tự ký mới trong config/chung-chi/.');
  } catch (e) {
    console.warn('[https] Không sinh được chứng chỉ:', e.message);
  }

  if (!cc) return inBangDiaChi(chungChi.diaChiLan(), false);

  const https = require('https');
  const serverHttps = https.createServer({ key: cc.key, cert: cc.cert }, app);
  // Socket.io phai phuc vu ca hai cong, neu khong thi trang mo qua HTTPS mat
  // het cap nhat thoi gian thuc (cham cong moi, thong bao) ma khong bao loi gi.
  io.attach(serverHttps);

  serverHttps.on('error', (e) => {
    console.warn(`[https] Không mở được cổng ${PORT_HTTPS}: ${e.message}`);
    console.warn('[https] Hệ thống vẫn chạy trên HTTP, nhưng điện thoại sẽ không dùng được camera.');
  });
  serverHttps.listen(PORT_HTTPS, () => inBangDiaChi(cc.dia_chi, true));
})();


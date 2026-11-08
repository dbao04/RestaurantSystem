process.on('unhandledRejection', (reason, promise) => {
  console.error('[Safety] Unhandled Rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Safety] Uncaught Exception:', err && err.message ? err.message : err);
});

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config({ override: true });
const db = require('./config/db');

const app = express();

// Khi mo ra Internet bang cloudflared (scripts/moOnline.js), moi request deu
// den tu 127.0.0.1. Tin X-Forwarded-For CHI khi ket noi truc tiep la tu may
// nay (loopback), de req.ip la IP that cua khach - gioi han dang nhap sai va
// gioi han dat mon QR moi tinh dung theo tung nguoi.
app.set('trust proxy', 'loopback');
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
const reservationService = require('./services/reservationService');
const engagementService = require('./services/engagementService');
const equipmentService = require('./services/equipmentService');
const diUngService = require('./services/diUngService');
const mailer = require('./utils/mailer');
const diaChiQR = require('./utils/diaChiQR');
const gioiHanDN = require('./middleware/gioiHanDangNhap');
const datLaiMK = require('./services/datLaiMatKhauService');

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

// Multer setup cho gửi ảnh / file trong Chat giữa khách hàng và nhân viên
const chatUploadDir = path.join(__dirname, 'public', 'uploads', 'chat');
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}
const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(chatUploadDir)) {
      fs.mkdirSync(chatUploadDir, { recursive: true });
    }
    cb(null, chatUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
    const safeRand = Math.random().toString(36).slice(2, 8);
    cb(null, `${Date.now()}_${safeRand}${ext}`);
  }
});
const uploadChat = multer({
  storage: chatStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: function (req, file, cb) {
    const blockedExt = /\.(exe|bat|cmd|sh|php|jsp|asp|aspx|dll|msi|vbs|js)$/i;
    if (blockedExt.test(file.originalname || '')) {
      return cb(new Error('Định dạng tệp không được phép tải lên'));
    }
    cb(null, true);
  }
});

function layThongTinTepChat(file) {
  if (!file) return null;
  let tenGoc = file.originalname || 'tep_dinh_kem';
  try {
    // Khắc phục lỗi tên file tiếng Việt bị mã hóa latin1 trong multipart header
    const decoded = Buffer.from(tenGoc, 'latin1').toString('utf8');
    if (!decoded.includes('\ufffd')) tenGoc = decoded;
  } catch (_) {}
  const mime = String(file.mimetype || '').toLowerCase();
  const ext = path.extname(tenGoc).toLowerCase();
  const laAnh = mime.startsWith('image/') || /^\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(ext);
  return {
    loai_file: laAnh ? 'image' : 'file',
    duong_dan_file: `/uploads/chat/${file.filename}`,
    ten_file: tenGoc.slice(0, 250),
    kich_thuoc_file: file.size || 0
  };
}

// Middleware
/*
 * Header bao mat (helmet). Tat ba muc vi he thong hien tai can:
 *   - contentSecurityPolicy: giao dien dung rat nhieu <script> inline va CDN;
 *     bat CSP bay gio se lam hong hau het cac trang.
 *   - hsts: may chay song song http://:3000 va https tu ky :3443; ep HTTPS se
 *     khien trinh duyet khong vao lai duoc ban http tren may demo.
 *   - crossOriginEmbedderPolicy: chan anh/font tu CDN.
 * Cac header con lai (nosniff, chong nhung iframe, an X-Powered-By...) bat.
 */
app.use(require('helmet')({
  contentSecurityPolicy: false,
  hsts: false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Gioi han body 20MB: cham cong khuon mat gui mot loat khung anh base64 tu
// webcam (kiosk gui ~12 khung). Mac dinh 100kb se bao loi 413 voi cac request do.
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(bodyParser.json({ limit: '20mb' }));

// Chong CSRF: moi POST/PUT/PATCH/DELETE tu trinh duyet phai den tu chinh
// trang cua he thong (xem middleware/chongCsrf.js).
app.use(require('./middleware/chongCsrf')());

// Public static files
app.use(express.static(path.join(__dirname, 'public')));
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
  // SameSite=Lax: trinh duyet khong gui cookie phien kem cac POST xuat phat
  // tu trang khac - lop chong CSRF thu hai, doc lap voi middleware/chongCsrf.
  // httpOnly: JavaScript tren trang khong doc duoc cookie phien.
  cookie: { secure: false, sameSite: 'lax', httpOnly: true }
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
  const pathHienTai = req.originalUrl || req.url || req.path || '';
  res.locals.currentPath = pathHienTai;
  res.locals.isStaff = pathHienTai.startsWith('/staff') || (!pathHienTai.startsWith('/admin') && !!req.session.stafflogin);
  res.locals.isAdmin = pathHienTai.startsWith('/admin') || (!pathHienTai.startsWith('/staff') && !!req.session.adminlogin && !req.session.stafflogin);
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


/*
  Ngon ngu cua khu khach (vi / en / ja).

  Dat TRUOC moi route de `t()` co mat trong res.locals o khap noi. Chi khu khach
  duoc dich; /admin, /staff va /shipper bi middleware nay bo qua - xem
  middleware/ngonNgu.js.
*/
/*
  Nhat ky truy cap cho khu CHAM CONG va cua thoat /sua.

  Khi nhan vien bao "vao trang cham cong tren dien thoai khong duoc", cau hoi
  dau tien luon la: dien thoai co CHAM toi may chu khong? Khong co dong nhat ky
  nao thi khong ai tra loi duoc, va ca hai ben doan mo.

  Mot dong o day phan biet duoc ngay hai tinh huong hoan toan khac nhau:
    - KHONG co dong nao  -> goi tin khong toi may chu: khac Wi-Fi, sai dia chi,
                            router chan thiet bi noi voi nhau, hoac chung chi bi
                            tu choi ngay tu buoc bat tay TLS
    - CO dong, ma 302/200 -> mang thong, van de nam o phia trinh duyet (service
                            worker cu, bo nho dem, chung chi chua duoc chap nhan)

  Chi ghi yeu cau tu MAY KHAC, bo qua localhost - neu khong nhat ky day nhung
  lan thu tu chinh may chu va che mat dong dang can tim.
*/
app.use((req, res, next) => {
  if (!/^\/(cham-cong|sua|sua-cham-cong|shipper)(\/|$)/.test(req.path)) return next();
  const ip = String(req.ip || '').replace('::ffff:', '');
  if (ip === '127.0.0.1' || ip === '::1' || !ip) return next();
  res.on('finish', () => {
    console.log(`[dien-thoai] ${new Date().toLocaleTimeString('vi-VN')}  ${ip}  ` +
      `${req.method} ${req.originalUrl}  -> ${res.statusCode}`);
  });
  next();
});

app.use(require('./middleware/ngonNgu')());

// Nap ho so quyen theo co cau to chuc vao req.hoSo / res.locals.hoSo cho moi
// request cua nhan vien. Phai dat SAU session va TRUOC moi route co phan quyen.
const phanQuyenMw = require('./middleware/phanQuyen');
app.use(phanQuyenMw.napHoSo());

/*
 * Khach dang nhap bang mat khau mac dinh phai doi mat khau truoc khi lam gi
 * khac. Chi chan cac trang HTML (GET); API/JSON, trang QR tai ban va khu nhan
 * vien/quan tri khong lien quan toi phien khach nen de nguyen.
 */
const DUONG_DUOC_KHI_PHAI_DOI_MK = ['/profile', '/logout', '/login', '/forgot-password', '/dat-lai-mat-khau'];
app.use((req, res, next) => {
  if (!req.session || !req.session.userlogin || !req.session.phaiDoiMatKhau) return next();
  if (req.method !== 'GET' || !req.accepts('html') || req.xhr) return next();
  if (DUONG_DUOC_KHI_PHAI_DOI_MK.some((d) => req.path === d || req.path.startsWith(d + '/'))) return next();
  if (/^\/(api|qr|staff|admin|kds|socket\.io)(\/|$)/.test(req.path)) return next();
  return res.redirect('/profile?msg=' + encodeURIComponent(
    'Vui lòng đổi mật khẩu mặc định trước khi tiếp tục.'
  ) + '&msgType=danger');
});

/*
 * NHAN VIEN dang nhap bang mat khau mac dinh 123456 (tai khoan moi tao / vua
 * cap lai) cung phai doi truoc khi dung he thong - ai biet ten dang nhap la vao
 * duoc quyen thu ngan / kho. Chi chan trang HTML (GET) khu nhan vien + KDS;
 * API/JSON va trang cham cong de nguyen. Tat bang cau_hinh
 * bao_mat.bat_doi_mk_nhan_vien = 0 (VD may demo).
 */
const DUONG_NV_DUOC_KHI_PHAI_DOI_MK = ['/staff/profile', '/staff/logout', '/staff/login'];
app.use((req, res, next) => {
  if (!req.session || !req.session.stafflogin || !req.session.nvPhaiDoiMatKhau) return next();
  if (req.method !== 'GET' || !req.accepts('html') || req.xhr) return next();
  if (!/^\/(staff|kds|admin)(\/|$)/.test(req.path) || /^\/(staff\/)?api\//.test(req.path)) return next();
  if (DUONG_NV_DUOC_KHI_PHAI_DOI_MK.some((d) => req.path === d || req.path.startsWith(d + '/'))) return next();
  return res.redirect('/staff/profile?msg=' + encodeURIComponent(
    'Tài khoản đang dùng mật khẩu mặc định. Vui lòng đổi mật khẩu trước khi tiếp tục.'
  ) + '&msgType=danger');
});

async function batDoiMkNhanVien() {
  try {
    const [[r]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'bao_mat.bat_doi_mk_nhan_vien'");
    return !(r && String(r.gia_tri).trim() === '0');
  } catch (e) { return true; }
}

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
app.use(['/analytics', '/staff/analytics'], require('./routes/analytics'));
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
// Cham cong bang dien thoai: /cham-cong/ - giao dien mot cot, cai duoc ra man
// hinh chinh. Dung chung API voi kiosk nen moi rang buoc chong gian lan giu nguyen.
app.use('/', require('./routes/chamCongDiDong'));
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
// Giao hang: don vi van chuyen + bang gia (/admin/van-chuyen), dieu phoi va ban
// do theo doi (/staff/giao-hang), ung dung dien thoai cua shipper (/shipper),
// va trang khach tu tra cuu don cua minh (/theo-doi).
app.use('/', require('./routes/vanChuyen'));

// Dat ban: trang khach (/dat-ban, /dat-ban/tra-cuu), trung tam nhan vien
// (/staff/dat-ban) va cau hinh cua quan ly (/admin/dat-ban).
app.use('/', require('./routes/datBan'));
// Khong gian nha hang + dat tiec (cuoi, sinh nhat, party) - routes/datTiec.js
app.use('/', require('./routes/datTiec'));
// Bao cao thu chi / so quy thu ngan - routes/thuChi.js
app.use('/', require('./routes/thuChi'));
// Cong no nha cung cap (phieu nhap -> phieu chi tra NCC)
app.use('/', require('./routes/congNoNcc'));
// Duyet nghi phep theo cap tren (thay cho ke toan duyet)
app.use('/', require('./routes/nghiPhep'));
// Phan tich thuc don (menu engineering)
app.use('/', require('./routes/phanTichThucDon'));
// Bao cao lai lo quan tri
app.use('/', require('./routes/laiLo'));
// Bep: thong ke, xuat nhap kho, mua hang NVL - routes/khoBep.js
app.use('/', require('./routes/khoBep'));

// Bao cao cuoi ngay cua Phuc vu & Sanh (/staff/phuc-vu/bao-cao)
app.use('/', require('./routes/baoCaoPhucVu'));

// Gan trung tam thoi gian thuc. Phai goi SAU io.engine.use(sessionMiddleware)
// de socket doc duoc phien dang nhap.
realtime.khoiTao(io);

/*
  Vong quet nen cua module dat ban.

  Phai bat SAU realtime.khoiTao(io): vong quet phat su kien socket khi mot luot
  dat qua han giu ban, ma phat truoc khi Socket.IO san sang thi nhung canh bao
  som nhat - dung luc may chu vua khoi dong lai sau su co - se roi vao hu khong.

  Xem services/reservationJobs.js de biet no lam nhung gi va vi sao khong tach
  thanh mot tien trinh cron rieng.
*/
require('./services/reservationJobs').batDau();
// Don giao qua han thanh toan truoc -> tu huy (loi khach, khong hoan).
require('./services/chinhSachGiaoService').batVongQuet();
// Tu dong phan don giao hang: quet don qua han xac nhan + hang cho moi 30 giay.
require('./services/phanCongGiaoService').batDau();

// --- Frontend Routes ---
app.get('/', async (req, res) => {
  // Lay vai mon dang ban de lam khoi "mon noi bat" tren trang chu.
  let mons = [];
  // Mon dung lam hoa tiet: hero, khoi "Cau chuyen", thu vien. Xem ghi chu ben duoi.
  let monTrangTri = [];
  // So lieu THAT tu CSDL cho phan thong ke (khong bia so).
  let thongKe = { soMon: 0, soDanhMuc: 0, soNhanVien: 0, soDon: 0 };
  try {
    /*
      Mon noi bat: chi lay MON AN (bo do uong), phai co anh, uu tien mon ban chay.

      HAI TANG: LOC BAN CHAY TRUOC, ROI MOI BOC NGAU NHIEN
      ----------------------------------------------------
      Ban truoc viet `ORDER BY da_ban DESC, RAND() LIMIT 13` va dua vao mot gia
      dinh da het dung: rang thuc don moi thay nen `da_ban` deu bang 0, va khi
      moi gia tri bang nhau thi RAND() quyet dinh tat ca.

      Nay ca 232 mon deu co lich su ban voi so luong KHAC NHAU. RAND() chi con
      pha the hoa, ma khong con the hoa nao - truy van tro thanh tat dinh. Hau
      qua: tai lai trang bao nhieu lan cung ra dung 13 mon do, va vi 13 mon ban
      chay nhat tinh co deu la mon com nen khoi "Mon an dac sac" chi toan com.

      Sua bang cach tach lam hai buoc:
        1. truy van trong: lay NHOM 60 mon ban chay nhat
        2. truy van ngoai: boc ngau nhien 13 mon trong nhom do

      Nho vay "noi bat" van co nghia la ban chay that, nhung moi lan tai lai
      trang la mot to hop khac va trai deu nhieu danh muc.
    */
    const [dep] = await db.query(`
      SELECT * FROM (
        SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, m.ghichu_mon,
               COALESCE(SUM(h.soluong), 0) AS da_ban
        FROM monan m
        LEFT JOIN hopdong h ON h.id_mon = m.id_mon AND h.tinhtrang = 3
        WHERE m.tinhtrang = 1 AND m.images IS NOT NULL AND m.images <> ''
          AND m.id_loai NOT IN (SELECT id_loai FROM loai_mon
              WHERE name_loai LIKE '%uống%' OR name_loai LIKE '%uong%'
                 OR name_loai LIKE '%nước%' OR name_loai LIKE '%nuoc%'
                 OR name_loai LIKE '%drink%' OR name_loai LIKE '%sake%'
                 OR name_loai LIKE '%beer%' OR name_loai LIKE '%wine%')
        GROUP BY m.id_mon, m.name_mon, m.gia_mon, m.images, m.ghichu_mon
        ORDER BY da_ban DESC
        LIMIT 60
      ) AS ban_chay
      ORDER BY RAND()
      LIMIT 16`);
    // 8 mon dau cho khoi "Mon an dac sac" (du 2 hang, moi hang 4 mon), cac mon con lai de trang tri
    mons = dep.slice(0, 8);
    monTrangTri = dep.slice(8);
    // Du phong: neu vi ly do gi khong co mon co anh, lay tam mon an bat ky.
    if (!mons.length) {
      const tatCa = await menuService.getAllDishes();
      mons = (tatCa || []).filter((m) => m.tinhtrang == 1).slice(0, 8);
    }

    /*
      Bon con so cho dai thong ke o cuoi trang chu.

      `FORCE INDEX` o cau dem don KHONG phai lam mau. Bang `hopdong` co
      110.113 dong `tinhtrang = 3`, va MySQL o day chon SAI chi muc mot cach
      on dinh:

        tu chon  -> idx_hopdong_tt_mon    12.911 ms
        ep dung  -> idx_hopdong_tt_sesis     222 ms   (Using index)
        quet bang                            373 ms

      `idx_hopdong_tt_mon (tinhtrang, id_mon, soluong)` bat dau bang `tinhtrang`
      nen trinh toi uu thay hap dan, nhung no khong chua `sesis`. Ket qua la
      MySQL nhay ve bang tra tung dong cho 110 nghin ban ghi - cham hon ca quet
      tuan tu. `ANALYZE TABLE` da thu, khong doi duoc lua chon do.

      `idx_hopdong_tt_sesis (tinhtrang, sesis)` phu du ca hai cot nen dem duoc
      thang tren chi muc. Ep dung no la cach duy nhat con lai.

      Neu sau nay bo chi muc `idx_hopdong_tt_sesis` thi PHAI bo ca `FORCE INDEX`
      nay, neu khong truy van se nem loi thay vi chi cham di.
    */
    const [[tk]] = await db.query(`
      SELECT (SELECT COUNT(*) FROM monan WHERE tinhtrang = 1)      AS soMon,
             (SELECT COUNT(*) FROM loai_mon)                       AS soDanhMuc,
             (SELECT COUNT(*) FROM nhan_vien WHERE trangthai = 1)  AS soNhanVien,
             (SELECT COUNT(DISTINCT sesis) FROM hopdong
                FORCE INDEX (idx_hopdong_tt_sesis)
              WHERE tinhtrang = 3)                                 AS soDon`);
    if (tk) thongKe = { soMon: +tk.soMon, soDanhMuc: +tk.soDanhMuc, soNhanVien: +tk.soNhanVien, soDon: +tk.soDon };
  } catch (err) {
    console.error('Không lấy được dữ liệu trang chủ:', err.message);
  }

  /*
    Du lieu cho SLIDER BANNER. Moi khoi bat loi rieng: thieu khuyen mai hay
    thieu so lieu ban chay thi chi mat slide do, banner van chay voi cac slide
    con lai (slide chao mung luon co).
  */
  let khuyenMai = [];
  let banChay = [];
  try {
    // Ma giam gia dang chay, cho phep hien cho khach, con luot dung.
    const [km] = await db.query(`
      SELECT code, ten, description, discount_type, discount_value, min_order_value,
             max_discount_amount, DATE_FORMAT(valid_until, '%d/%m/%Y') AS han
        FROM discount_codes
       WHERE is_active = 1 AND hien_thi_khach = 1
         AND NOW() BETWEEN valid_from AND valid_until
         AND (max_usage IS NULL OR current_usage < max_usage)
       ORDER BY do_uu_tien DESC, discount_value DESC
       LIMIT 3`);
    khuyenMai = km;
  } catch (err) {
    console.error('Không lấy được khuyến mãi cho banner:', err.message);
  }
  try {
    // Ban chay THAT (khong ngau nhien): 3 mon an co anh ban nhieu nhat.
    const [bc] = await db.query(`
      SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, m.ghichu_mon, SUM(h.soluong) AS da_ban
        FROM hopdong h
        JOIN monan m ON m.id_mon = h.id_mon
       WHERE h.tinhtrang = 3 AND m.tinhtrang = 1 AND m.images IS NOT NULL AND m.images <> ''
         AND m.id_loai NOT IN (SELECT id_loai FROM loai_mon
             WHERE name_loai LIKE '%uống%' OR name_loai LIKE '%drink%'
                OR name_loai LIKE '%sake%' OR name_loai LIKE '%beer%')
       GROUP BY m.id_mon, m.name_mon, m.gia_mon, m.images, m.ghichu_mon
       ORDER BY da_ban DESC
       LIMIT 3`);
    banChay = bc.map((r) => ({ ...r, da_ban: Number(r.da_ban) }));
  } catch (err) {
    console.error('Không lấy được món bán chạy cho banner:', err.message);
  }

  res.render('index', { title: res.locals.t('dieu_huong.trang_chu'), mons, monTrangTri, thongKe, khuyenMai, banChay });
});

app.get('/about', async (req, res) => {
  /*
    Trang gioi thieu cung dung anh MON lam hoa tiet thay cho anh stock cu.

    Khong dung chung truy van voi trang chu: hai trang duoc mo o hai thoi diem
    khac nhau va deu co RAND(), gan cung mot ket qua vao bien toan cuc chi lam
    hai trang thinh thoang giong het nhau. Truy van rieng, hai mon, la du.

    Loi truy van khong duoc lam hong trang: neu CSDL tam khong doc duoc thi
    `monTrangTri` rong, va view tu quay ve tam nen hoa van khong co mon.
  */
  let monTrangTri = [];
  try {
    const [r] = await db.query(`
      SELECT id_mon, name_mon, images FROM monan
      WHERE tinhtrang = 1 AND images IS NOT NULL AND images <> ''
        AND id_loai NOT IN (SELECT id_loai FROM loai_mon
            WHERE name_loai LIKE '%uống%' OR name_loai LIKE '%uong%'
               OR name_loai LIKE '%drink%' OR name_loai LIKE '%sake%'
               OR name_loai LIKE '%beer%')
      ORDER BY RAND() LIMIT 2`);
    monTrangTri = r;
  } catch (err) {
    console.error('Không lấy được món trang trí cho /about:', err.message);
  }
  res.render('about', { title: res.locals.t('gioi_thieu.tieu_de'), monTrangTri });
});

/*
  Trang gioi thieu chuong trinh thanh vien.

  Mo cho ca khach chua dang nhap: nguoi chua co tai khoan can doc duoc quyen loi
  TRUOC khi quyet dinh dang ky. Khach da dang nhap thi thay them the diem cua
  chinh minh.

  Moi con so tren trang deu lay tu cau hinh dang chay (`cau_hinh_thanh_toan`) va
  tu nguong hang trong loyaltyService, khong viet cung trong view - admin sua
  cau hinh la trang tu doi theo, khong ai phai nho di sua chu.
*/
app.get('/thanh-vien', async (req, res) => {
  const loyaltyService = require('./services/loyaltyService');
  const thanhToanService = require('./services/thanhToanService');

  // Mac dinh dung bang MAC_DINH trong thanhToanService, de trang van dung
  // ngay ca khi bang cau hinh chua duoc tao.
  let cauHinh = { ty_le_tich_diem: 10000, gia_tri_1_diem: 1000, toi_da_diem_moi_don: 50 };
  let viDiem = null;
  let giaoDich = [];

  try {
    const ch = await thanhToanService.layCauHinh();
    cauHinh = {
      ty_le_tich_diem: Number(ch.ty_le_tich_diem) || cauHinh.ty_le_tich_diem,
      gia_tri_1_diem: Number(ch.gia_tri_1_diem) || cauHinh.gia_tri_1_diem,
      toi_da_diem_moi_don: Number(ch.toi_da_diem_moi_don) || cauHinh.toi_da_diem_moi_don,
    };
  } catch (err) {
    console.error('Không lấy được cấu hình tích điểm:', err.message);
  }

  // Chi truy van vi diem khi khach thuc su dang dang nhap. getLoyaltyInfo tu
  // tao vi neu chua co, nen khach moi dang ky van xem duoc the cua minh.
  if (req.session.userlogin && req.session.userId) {
    try {
      viDiem = await loyaltyService.getLoyaltyInfo(req.session.userId);
      giaoDich = await loyaltyService.getTransactions(req.session.userId, 10);
    } catch (err) {
      console.error('Không lấy được ví điểm khách:', err.message);
    }
  }

  res.render('thanh-vien', {
    title: res.locals.t('thanh_vien.tieu_de'),
    cauHinh,
    viDiem,
    giaoDich,
    NGUONG_HANG: loyaltyService.NGUONG_HANG,
    TEN_HANG: loyaltyService.TEN_HANG,
  });
});

app.get('/blog', async (req, res) => {
  try {
    const [posts] = await db.query('SELECT * FROM bai_viet ORDER BY created_at DESC');

    /*
      Anh du phong cho bai chua co hinh.

      Truoc day la bon tep tinh /blog-1..4.jpg - anh stock cua mot nha hang Au.
      Bon tren sau bai viet dang khong co hinh rieng, nen phan lon trang Tin tuc
      thuc chat la anh du phong do. Doi sang anh MON that trong thuc don: dung
      dinh danh nha hang, va tu doi theo thuc don ma khong ai phai nho.
    */
    let anhMonDuPhong = [];
    try {
      const [r] = await db.query(`
        SELECT images FROM monan
        WHERE tinhtrang = 1 AND images IS NOT NULL AND images <> ''
          AND id_loai NOT IN (SELECT id_loai FROM loai_mon
              WHERE name_loai LIKE '%uống%' OR name_loai LIKE '%uong%'
                 OR name_loai LIKE '%drink%' OR name_loai LIKE '%sake%'
                 OR name_loai LIKE '%beer%')
        ORDER BY RAND() LIMIT 4`);
      anhMonDuPhong = r.map((x) => '/food/' + x.images);
    } catch (e) {
      console.error('Không lấy được ảnh dự phòng cho /blog:', e.message);
    }

    res.render('blog', { title: res.locals.t('dieu_huong.tin_tuc'), posts, anhMonDuPhong });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/menu', async (req, res) => {
  try {
    const mainGroups = await menuService.getMainGroups();
    const categories = await menuService.getAllCategories();
    
    let currentGroup = req.query.nhom || null;
    let currentCategory = req.query.id_loai ? Number(req.query.id_loai) : null;
    let dishes = [];

    if (currentCategory) {
      const selectedCat = categories.find(c => c.id_loai === currentCategory);
      if (selectedCat) {
        currentGroup = menuService.classifyCategory(selectedCat.name_loai);
      } else {
        currentGroup = mainGroups[0].key;
      }
      dishes = await menuService.getDishesByCategory(currentCategory);
    } else {
      if (!currentGroup || !mainGroups.some(g => g.key === currentGroup)) {
        currentGroup = mainGroups[0].key;
      }
      dishes = await menuService.getDishesByGroup(currentGroup);
    }

    res.render('menu', {
      title: res.locals.t('dieu_huong.mon_an'),
      mainGroups,
      categories,
      dishes,
      currentGroup,
      currentCategory,
      key: '',
      thongTinGiao: req.session.thongTinGiao || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/menu', async (req, res) => {
  try {
    const key = (req.body.key || '').trim();
    const mainGroups = await menuService.getMainGroups();
    const categories = await menuService.getAllCategories();
    const dishes = await menuService.searchDishes(key);

    res.render('menu', {
      title: res.locals.t('dieu_huong.mon_an') + ' — ' + res.locals.t('chung.tim_kiem'),
      mainGroups,
      categories,
      dishes,
      currentGroup: null,
      currentCategory: null,
      key,
      thongTinGiao: req.session.thongTinGiao || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

/*
  TRANG THỰC ĐƠN COMBO / SET MENU
  Hiển thị danh sách tất cả các gói Combo phong phú của nhà hàng theo số lượng khách,
  kèm chi tiết các món trong set, giá ưu đãi và nút đặt bàn chọn combo nhanh.
*/
app.get(['/combos', '/thuc-don', '/thuc-don-combo'], async (req, res) => {
  try {
    const rawCombos = require('./utils/combosData');
    const allIds = [];
    rawCombos.forEach(c => c.monList.forEach(m => allIds.push(m.id_mon)));
    
    let imgMap = {};
    if (allIds.length > 0) {
      try {
        const [rows] = await db.query('SELECT id_mon, images, gia_mon FROM monan WHERE id_mon IN (?)', [allIds]);
        rows.forEach(r => {
          imgMap[r.id_mon] = { images: r.images, gia: r.gia_mon };
        });
      } catch (e) {
        console.error('Lỗi nạp ảnh món cho combo:', e.message);
      }
    }

    const combos = rawCombos.map(c => {
      let tongGiaMon = 0;
      const monList = c.monList.map(m => {
        const dbInfo = imgMap[m.id_mon] || {};
        const giaMon = m.gia_mon || dbInfo.gia || 0;
        tongGiaMon += giaMon * (m.soluong || 1);
        return {
          ...m,
          gia_mon: giaMon,
          images: dbInfo.images || m.images || ''
        };
      });

      // Ảnh đại diện combo: ưu tiên món đặc sắc nhất (Sashimi, Sushi Set, Lẩu, Steak)
      let monChinh = monList.find(m => m.images && (m.name_mon.includes('SASHIMI') || m.name_mon.includes('SET')));
      if (!monChinh) monChinh = monList.find(m => m.images && (m.name_mon.includes('LẨU') || m.name_mon.includes('STEAK') || m.name_mon.includes('BÒ')));
      if (!monChinh) monChinh = monList.find(m => m.images);

      const anhDaiDien = (monChinh && monChinh.images) ? ('/food/' + monChinh.images) : '/mon-thay-the.svg';

      return {
        ...c,
        monList,
        tongGia: tongGiaMon,
        anhDaiDien
      };
    });

    res.render('combos', {
      title: res.locals.t('dieu_huong.thuc_don'),
      combos,
      soKhachLoc: req.query.khach || 'all'
    });
  } catch (err) {
    console.error('Lỗi tải trang Thực đơn Combo:', err);
    res.status(500).send('Server Error');
  }
});

/*
  THÊM TRỌN BỘ COMBO VÀO GIỎ HÀNG GIAO TẬN NƠI
*/
app.post('/add-combo-to-cart', async (req, res) => {
  const { comboId } = req.body;
  try {
    const rawCombos = require('./utils/combosData');
    const combo = rawCombos.find(c => c.id === comboId);
    if (!combo) {
      return res.redirect('/combos');
    }

    for (const item of combo.monList) {
      await orderService.addToCart(req.sessionID, item.id_mon, item.soluong || 1);
    }
    res.redirect('/cart');
  } catch (err) {
    console.error('Lỗi thêm combo vào giỏ hàng:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/detail', async (req, res) => {
  const monid = req.query.monid;
  try {
    const dish = await menuService.getDishById(monid);
    // Nguyen lieu de khach tu doi chieu di ung. Mon chua co cong thuc thi tra
    // ve mang rong - trang tu noi la chua cap nhat, khong duoc de trong khong.
    const nguyenLieu = dish ? await menuService.getDishIngredients(dish.id_mon) : [];
    const diUng = diUngService.phanTich(nguyenLieu);

    // Ten danh muc - de suy luu y (do song, cay...) va vai tro mon khi goi y an kem.
    let tenLoai = '';
    if (dish) {
      const [[l]] = await db.query('SELECT name_loai FROM loai_mon WHERE id_loai = ?', [dish.id_loai]);
      tenLoai = l ? l.name_loai : '';
    }
    // Goi y an kem la phan phu: loi o day khong duoc lam hong trang chi tiet.
    const anKem = dish
      ? await require('./services/goiYAnKemService').goiY(dish.id_mon, 5).catch((e) => {
        console.error('Không tính được gợi ý ăn kèm:', e.message);
        return [];
      })
      : [];
    const luuYMon = require('./services/luuYMonService');

    res.render('detail', {
      title: dish ? dish.name_mon : res.locals.t('chi_tiet.tieu_de'),
      dish,
      nguyenLieu,
      diUng,
      moTaDiUng: luuYMon.MO_TA_DI_UNG,
      luuY: dish ? luuYMon.luuY({ ...dish, name_loai: tenLoai }, nguyenLieu, diUng) : [],
      anKem,
      thongTinGiao: req.session.thongTinGiao || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

/*
  Them NHIEU mon vao gio mot lan - trang chi tiet mon dung khi khach chon them
  mon an kem. Tra JSON (khong redirect) de trang tu quyet dinh di tiep dau.
  Chi nhan mon dang ban; so luong ep ve 1..50 de mot request la khong lam
  phinh gio hang.
*/
app.post('/api/gio-hang/them-nhieu', async (req, res) => {
  const items = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 20) : [];
  if (!items.length) return res.status(400).json({ ok: false, thong_bao: 'Chưa chọn món nào.' });
  try {
    const ids = items.map((x) => Number(x.monid)).filter((n) => Number.isInteger(n) && n > 0);
    const [dangBan] = ids.length
      ? await db.query('SELECT id_mon FROM monan WHERE tinhtrang = 1 AND id_mon IN (?)', [ids])
      : [[]];
    const hopLe = new Set(dangBan.map((r) => Number(r.id_mon)));
    let soMon = 0;
    for (const x of items) {
      const id = Number(x.monid);
      if (!hopLe.has(id)) continue;
      const sl = Math.min(50, Math.max(1, parseInt(x.soluong, 10) || 1));
      await orderService.addToCart(req.sessionID, id, sl);
      soMon++;
    }
    if (!soMon) return res.status(400).json({ ok: false, thong_bao: 'Món đã chọn hiện không còn phục vụ.' });
    res.json({ ok: true, so_mon: soMon });
  } catch (err) {
    console.error('Lỗi thêm nhiều món vào giỏ:', err);
    res.status(500).json({ ok: false, thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
  }
});

app.post('/add-to-cart', async (req, res) => {
  const { monid, soluong } = req.body;
  const sl = orderService.chuanHoaSoLuong(soluong == null || soluong === '' ? 1 : soluong);
  if (!sl) {
    return res.status(400).send(`<script>alert("Số lượng phải từ 1 đến ${orderService.SO_LUONG_TOI_DA_KHACH}."); history.back();</script>`);
  }
  try {
    await orderService.addToCart(req.sessionID, monid, sl);
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/cart', async (req, res) => {
  try {
    const vanChuyen = require('./services/vanChuyenService');
    const [cartItems, subtotal, thamSoGiao, nhaHangToaDo, khachHang, chinhSach] = await Promise.all([
      orderService.getCart(req.sessionID),
      orderService.getCartTotal(req.sessionID),
      vanChuyen.thamSo().catch(() => ({ bat: true, ban_kinh_km: 10, mien_phi_tu: 500000 })),
      vanChuyen.toaDoNhaHang().catch(() => null),
      req.session.userId ? orderService.getUserById(req.session.userId).catch(() => null) : null,
      require('./services/chinhSachGiaoService').docChinhSach().catch(() => null),
    ]);

    const thongTinGiao = req.session.thongTinGiao || null;
    let baoGia = null;
    const viDo = (thongTinGiao && thongTinGiao.vi_do) || (nhaHangToaDo ? (Number(nhaHangToaDo.vi_do) + 0.003).toFixed(6) : '10.737646');
    const kinhDo = (thongTinGiao && thongTinGiao.kinh_do) || (nhaHangToaDo ? (Number(nhaHangToaDo.kinh_do) + 0.003).toFixed(6) : '106.706505');

    if (viDo && kinhDo) {
      try {
        baoGia = await vanChuyen.tinhPhi(viDo, kinhDo, subtotal);
      } catch (e) {
        baoGia = { giao_duoc: true, khoang_cach_km: 1.5, phi: 15000, don_vi: { ten_dv: 'Giao hàng tiêu chuẩn' } };
      }
    }

    let donGiaoList = [];
    try {
      const [rows] = await db.query(`
        SELECT dg.*,
               COALESCE((SELECT SUM(thanhtien) FROM hopdong WHERE sesis = dg.sesis), 0) + dg.phi_giao AS tong_tien,
               (SELECT COUNT(*) FROM hopdong WHERE sesis = dg.sesis) AS so_mon
        FROM don_giao_hang dg
        LEFT JOIN hopdong hd ON hd.sesis = dg.sesis
        WHERE (hd.id_user = ? OR dg.sdt_nguoi_nhan = ? OR dg.ten_nguoi_nhan = ?)
        GROUP BY dg.id_giao
        ORDER BY dg.id_giao DESC LIMIT 6
      `, [req.session.userId || 0, req.session.usersdt || '', req.session.username || '']);
      donGiaoList = rows || [];
    } catch (e) {
      console.error('Lỗi lấy đơn giao của tôi:', e);
    }

    res.render('cart', {
      title: res.locals.t('gio_hang.tieu_de'),
      cartItems,
      subtotal,
      thongTinGiao,
      baoGia,
      donGiaoList,
      giaoHang: {
        bat: thamSoGiao.bat && !!nhaHangToaDo,
        ban_kinh_km: thamSoGiao.ban_kinh_km || 10,
        mien_phi_tu: thamSoGiao.mien_phi_tu || 500000,
        nha_hang: nhaHangToaDo,
      },
      khach: khachHang || null,
      chinhSach,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/update-cart', async (req, res) => {
  const { cartid, soluong } = req.body;
  if (!orderService.chuanHoaSoLuong(soluong)) {
    return res.status(400).send(`<script>alert("Số lượng phải từ 1 đến ${orderService.SO_LUONG_TOI_DA_KHACH}."); history.back();</script>`);
  }
  try {
    await orderService.updateCartQuantity(req.sessionID, cartid, soluong);
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/del-cart', async (req, res) => {
  const delid = req.query.delid;
  try {
    await orderService.removeFromCart(req.sessionID, delid);
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Chuyen huong /datban thang ve trang dat ban 5 buoc (/dat-ban)
app.get('/datban', (req, res) => {
  res.redirect('/dat-ban');
});

// Chuyen huong /giao-hang thang sang /cart (Gio hang & Dat hang)
app.get('/giao-hang', (req, res) => {
  res.redirect('/cart');
});

// Luu thong tin giao hang va chuyen sang chon mon thuc don
app.post('/giao-hang', requireLogin, async (req, res) => {
  try {
    let { dia_chi_giao, ten_nguoi_nhan, sdt_nguoi_nhan, ghi_chu_giao, vi_do, kinh_do, datebook, timebook } = req.body;
    const vanChuyen = require('./services/vanChuyenService');
    const [ts, nhaHangToaDo] = await Promise.all([
      vanChuyen.thamSo(),
      vanChuyen.toaDoNhaHang().catch(() => null)
    ]);
    if (!ts.bat) {
      return res.send('<script>alert("Nhà hàng đang tạm ngưng nhận đơn giao hàng."); history.back();</script>');
    }
    if (!String(dia_chi_giao || '').trim()) {
      return res.send('<script>alert("Hãy nhập địa chỉ giao hàng."); history.back();</script>');
    }

    // Đảm bảo tọa độ hợp lệ
    let numViDo = parseFloat(vi_do);
    let numKinhDo = parseFloat(kinh_do);
    if (isNaN(numViDo) || isNaN(numKinhDo) || (numViDo === 0 && numKinhDo === 0)) {
      if (nhaHangToaDo && nhaHangToaDo.vi_do && nhaHangToaDo.kinh_do) {
        numViDo = Number(nhaHangToaDo.vi_do) + 0.003;
        numKinhDo = Number(nhaHangToaDo.kinh_do) + 0.003;
      } else {
        numViDo = 10.737646;
        numKinhDo = 106.706505;
      }
      vi_do = numViDo.toFixed(6);
      kinh_do = numKinhDo.toFixed(6);
    }

    let baoGia = await vanChuyen.tinhPhi(vi_do, kinh_do, 0);
    if (!baoGia.giao_duoc) {
      if (baoGia.ly_do && /chưa xác định/i.test(baoGia.ly_do)) {
        baoGia = {
          giao_duoc: true,
          khoang_cach_km: 1.5,
          phi: 15000,
          don_vi: { ten_dv: 'Giao hàng tiêu chuẩn' }
        };
      } else {
        return res.send(`<script>alert(${JSON.stringify(baoGia.ly_do || 'Không giao được tới địa chỉ này.')}); history.back();</script>`);
      }
    }

    req.session.thongTinGiao = {
      dia_chi_giao: String(dia_chi_giao).trim(),
      ten_nguoi_nhan: ten_nguoi_nhan || req.session.username,
      sdt_nguoi_nhan: sdt_nguoi_nhan || req.session.usersdt,
      ghi_chu_giao: ghi_chu_giao || '',
      vi_do,
      kinh_do,
      datebook: datebook || new Date().toISOString().slice(0, 10),
      timebook: timebook || '18:00',
      khoang_cach_km: baoGia.khoang_cach_km || 1.5,
      phi_co_ban: baoGia.phi !== undefined ? baoGia.phi : 15000,
      don_vi: baoGia.don_vi || { ten_dv: 'Giao hàng tiêu chuẩn' }
    };

    res.redirect('/menu');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Giu alias /datban/goi-mon de chuyen ve /giao-hang
app.get('/datban/goi-mon', (req, res) => {
  res.redirect('/giao-hang');
});

app.post('/datban', requireLogin, async (req, res) => {
  const thongTinSession = req.session.thongTinGiao || {};
  const laGiaoHang = String(req.body.hinh_thuc || '') === 'giao_hang' || Boolean(req.session.thongTinGiao);
  const diaChiGiao = req.body.dia_chi_giao || thongTinSession.dia_chi_giao;
  const chiTietDiaChi = String(req.body.chi_tiet_dia_chi || '').trim();
  const diaChiDayDu = chiTietDiaChi ? (chiTietDiaChi + ', ' + diaChiGiao) : diaChiGiao;
  const viDo = req.body.vi_do || thongTinSession.vi_do;
  const kinhDo = req.body.kinh_do || thongTinSession.kinh_do;
  const tenNguoiNhan = req.body.ten_nguoi_nhan || thongTinSession.ten_nguoi_nhan || req.session.username;
  const sdtNguoiNhan = req.body.sdt_nguoi_nhan || thongTinSession.sdt_nguoi_nhan || req.session.usersdt;
  const ghiChuGiao = req.body.ghi_chu_giao || thongTinSession.ghi_chu_giao || '';
  const datebook = req.body.datebook || thongTinSession.datebook || new Date().toISOString().slice(0, 10);
  const timebook = req.body.timebook || thongTinSession.timebook || '18:00';

  const soKhach = '1';
  const dipDat  = 'Giao hàng tận nơi';

  try {
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
      return res.send('<script>alert("Ngày nhận hàng không hợp lệ!"); history.back();</script>');
    }
    if (bookingDate < today) {
      return res.send('<script>alert("Ngày nhận hàng không được ở quá khứ!"); history.back();</script>');
    }

    const cartItems = await orderService.getCart(req.sessionID);
    if (cartItems.length === 0) {
      return res.redirect('/cart');
    }

    if (laGiaoHang) {
      const vanChuyen = require('./services/vanChuyenService');
      const ts = await vanChuyen.thamSo();
      if (!ts.bat) {
        return res.send('<script>alert("Nhà hàng đang tạm ngưng nhận đơn giao hàng."); history.back();</script>');
      }
      if (!String(diaChiGiao || '').trim()) {
        return res.send('<script>alert("Hãy nhập địa chỉ giao hàng."); history.back();</script>');
      }
      const baoGia = await vanChuyen.tinhPhi(
        viDo, kinhDo, await orderService.getCartTotal(req.sessionID)
      );
      if (!baoGia.giao_duoc) {
        return res.send(
          `<script>alert(${JSON.stringify(baoGia.ly_do || 'Không giao được tới địa chỉ này.')}); history.back();</script>`
        );
      }
      // Chinh sach giao hang: khach phai doc va dong y (thanh toan truoc 100%,
      // huy do khach khong hoan, loi nha hang hoan diem).
      if (!req.body.dong_y_chinh_sach) {
        return res.send('<script>alert("Vui lòng đọc và đồng ý Chính sách giao hàng trước khi đặt đơn."); history.back();</script>');
      }
    }

    // createOrderFromCart giờ trả về uniqueSesis để redirect đúng đơn vừa đặt
    const uniqueSesis = await orderService.createOrderFromCart(req.sessionID, req.session.userId, timebook, datebook, soKhach, dipDat);

    // Notify Kitchen Real-time
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: `Khách hàng [${req.session.username}] vừa đặt 1 đơn giao hàng mới!`,
      sesis: uniqueSesis
    });

    if (laGiaoHang) {
      const vanChuyen = require('./services/vanChuyenService');
      const ts = await vanChuyen.thamSo();

      if (!ts.tu_dong_tao_don) {
        await db.query("UPDATE hopdong SET loai_don = 'giao_hang' WHERE sesis = ?", [uniqueSesis]);
        return res.redirect(`/contract?sesis=${uniqueSesis}`);
      }

      // CHINH SACH: don giao phai THANH TOAN TRUOC 100% (mon + ship) qua
      // VietQR. Don nam o 'cho_thanh_toan' - bep chua nau, chua phan shipper -
      // toi khi tien ve; qua han giu don thi tu huy. Khong con COD.
      await vanChuyen.taoDonGiao(uniqueSesis, {
        ten_nguoi_nhan: tenNguoiNhan,
        sdt_nguoi_nhan: sdtNguoiNhan,
        dia_chi_giao: diaChiDayDu,
        vi_do: viDo,
        kinh_do: kinhDo,
        ghi_chu: ghiChuGiao,
        batBuocTrongVung: true,
        choThanhToan: true,
        ten_nguoi: req.session.username,
      });

      realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
      return res.redirect(`/thanh-toan/don-hang/${uniqueSesis}`);
    }

    res.redirect(`/contract?sesis=${uniqueSesis}`);
  } catch (err) {
    if (err instanceof require('./services/tonMonService').LoiHetMon) {
      return res.send(`<script>alert(${JSON.stringify(err.message)}); history.back();</script>`);
    }
    console.error(err);
    res.status(500).send(err.message || 'Server Error');
  }
});

/*
  Duong dan cu cua trang dat ban.

  Toan bo module dat ban da chuyen sang routes/datBan.js voi duong dan /dat-ban.
  Giu lai mot chuyen huong 301 thay vi xoa han: dia chi /reservation da co the
  nam trong lich su trinh duyet cua khach, trong mot email xac nhan da gui, hay
  trong mot ma QR da in ra giay - nhung thu khong thu hoi lai duoc.
*/
app.get('/reservation', (req, res) => res.redirect(301, '/dat-ban'));

// Chinh sach giao hang: phi ship bac thang, thanh toan truoc, huy & hoan diem.
// Doc thang tu cau hinh nen doi bang gia o quan tri la trang nay doi theo.
app.get('/chinh-sach-giao-hang', async (req, res) => {
  try {
    const chinhSach = await require('./services/chinhSachGiaoService').docChinhSach();
    res.render('chinh-sach-giao-hang', { title: 'Chính sách giao hàng', chinhSach });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});
app.get('/reservation/tra-cuu', (req, res) => res.redirect(301, '/dat-ban/tra-cuu'));

app.get('/contract', requireLogin, async (req, res) => {
  try {
    const sessionId = req.query.sesis || req.sessionID;
    const orderDetails = await orderService.getOrderDetails(sessionId);
    res.render('contract', { title: res.locals.t('phieu.tieu_de'), orderDetails });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/my-orders', requireLogin, async (req, res) => {
  try {
    const [kq, reservations, khuVuc, cauHinh] = await Promise.all([
      orderService.getUserOrders(req.session.userId, { trang: req.query.trang }),
      reservationService.lichSuKhachTheoTaiKhoan(req.session.userId, req.session.usersdt, { gioiHan: 50 }).catch((err) => {
        console.error('Fetch reservations error:', err);
        return [];
      }),
      require('./services/reservationTables').docKhuVuc().catch(() => []),
      require('./services/reservationRules').docCauHinh().catch(() => ({})),
    ]);

    // /cancel-order chuyen ve day kem ?msg=... - phai truyen vao view thi khach
    // moi biet yeu cau huy da gui duoc hay chua.
    res.render('my-orders', {
      title: res.locals.t('dieu_huong.don_cua_toi'),
      activeNav: 'myorders',
      orders: kq.danhSach,
      reservations: reservations || [],
      khuVuc: khuVuc || [],
      cauHinh: cauHinh || {},
      phanTrang: kq,
      userPhone: req.session.usersdt || '',
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
      title: res.locals.t('danh_gia.tieu_de'), 
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
  const sao = Number(req.body.sao);
  const noiDung = String(req.body.noi_dung || '').trim().slice(0, 1000);
  try {
    // Cung dieu kien voi trang /rate: phai co it nhat mot don da xac nhan.
    // Truoc day POST khong kiem tra, ai dang nhap cung gui duoc danh gia.
    if (!(await orderService.coDonDaXacNhan(req.session.userId))) {
      return res.redirect('/rate?msg=' + encodeURIComponent('Bạn cần có ít nhất một đơn đã được xác nhận để gửi đánh giá.') + '&msgType=danger');
    }
    if (!Number.isInteger(sao) || sao < 1 || sao > 5) {
      return res.redirect('/rate?msg=' + encodeURIComponent('Vui lòng chọn từ 1 đến 5 sao.') + '&msgType=danger');
    }
    await engagementService.addRating(req.session.userId, sao, noiDung);
    res.redirect('/rate?msg=Cảm+ơn+bạn+đã+đánh+giá!&msgType=success');
  } catch (err) {
    console.error(err);
    res.redirect('/rate?msg=Lỗi+hệ+thống+khi+gửi+đánh+giá&msgType=danger');
  }
});

app.get('/success', (req, res) => {
  res.render('success', { title: res.locals.t('ket_qua.dat_thanh_cong') });
});

app.get('/login', (req, res) => {
  res.render('login', { title: res.locals.t('tai_khoan.dang_nhap') });
});

app.post('/login', async (req, res) => {
  const { sdt, pass } = req.body;
  const biKhoa = gioiHanDN.soGiayBiKhoa(req, 'khach', sdt);
  if (biKhoa) {
    return res.status(429).render('login', { title: res.locals.t('tai_khoan.dang_nhap'), error: gioiHanDN.thongBaoKhoa(biKhoa) });
  }
  try {
    const user = await orderService.userLogin(sdt, pass);
    if (!user) gioiHanDN.ghiThatBai(req, 'khach', sdt);
    if (user) {
      gioiHanDN.xoaDem(req, 'khach', sdt);
      req.session.userlogin = true;
      req.session.userId = user.id;
      req.session.usersdt = user.sodienthoai;
      req.session.username = user.ten;
      // Dang nhap bang mat khau MAC DINH (tai khoan tao tu dong khi dat ban ho,
      // dat ban online...): ai biet so dien thoai cung doan duoc -> bat doi
      // ngay, chan cac trang khac cho toi khi doi xong (middleware ben duoi).
      if (require('./utils/matKhau').laMacDinh(pass)) {
        req.session.phaiDoiMatKhau = true;
        return res.redirect('/profile?msg=' + encodeURIComponent(
          'Bạn đang dùng mật khẩu mặc định. Vui lòng đổi mật khẩu mới để tiếp tục sử dụng tài khoản.'
        ) + '&msgType=danger');
      }
      res.redirect('/');
    } else {
      res.render('login', { title: res.locals.t('tai_khoan.dang_nhap'), error: 'Incorrect phone number or password!' });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { title: res.locals.t('tai_khoan.dang_nhap'), error: 'Server error occurred.' });
  }
});

app.get('/register', (req, res) => {
  res.render('register', { title: res.locals.t('tai_khoan.dang_ky') });
});

app.post('/register', async (req, res) => {
  let { ten, sodienthoai, email, diachi, passwords, repass } = req.body;

  // Defensive normalization
  ten = ten || '';
  sodienthoai = sodienthoai || '';
  email = email || '';
  diachi = diachi || null;
  passwords = passwords || '';
  repass = repass || '';

  if (passwords !== repass) {
    return res.render('register', { title: res.locals.t('tai_khoan.dang_ky'), message: 'Mật khẩu xác nhận không khớp!' });
  }
  try {
    await orderService.userRegister({ ten, sodienthoai, email, diachi, passwords });
    res.render('login', { title: res.locals.t('tai_khoan.dang_nhap'), message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', { title: res.locals.t('tai_khoan.dang_ky'), message: err.message });
  }
});

// --- Forgot Password ---

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { title: res.locals.t('tai_khoan.quen_mat_khau_tieu_de') });
});

app.post('/forgot-password', async (req, res) => {
  const tieuDe = res.locals.t('tai_khoan.quen_mat_khau_tieu_de');
  const email = String((req.body && req.body.email) || '').trim();
  // Cau tra loi GIONG NHAU du email co tai khoan hay khong - khong cho do
  // email nao dang ky o nha hang.
  const thongBaoChung = 'Nếu email này có tài khoản tại nhà hàng, chúng tôi đã gửi một liên kết đặt lại mật khẩu '
    + `(hiệu lực ${datLaiMK.HAN_PHUT} phút). Vui lòng kiểm tra hộp thư đến và thư mục rác.`;

  // Moi IP + email chi xin toi da 5 lan / 15 phut (dung chung bo dem dang nhap sai).
  const biKhoa = gioiHanDN.soGiayBiKhoa(req, 'quen_mk', email);
  if (biKhoa) return res.status(429).render('forgot-password', { title: tieuDe, error: gioiHanDN.thongBaoKhoa(biKhoa) });
  gioiHanDN.ghiThatBai(req, 'quen_mk', email);

  try {
    const yc = await datLaiMK.taoYeuCau(email, req.ip);
    if (yc) {
      // KHONG dung header Host de dung link: ke xau gui Host gia thi link
      // trong thu se tro ve may cua ho va lo token. Chi dung dia chi do
      // nguoi van hanh cau hinh (APP_BASE_URL / QR_BASE_URL), tunnel dang mo,
      // hoac IP LAN cua may chu.
      const gocCauHinh = String(process.env.APP_BASE_URL || process.env.QR_BASE_URL || '').trim();
      const gocUrl = (gocCauHinh || diaChiQR.gocTunnel() || `http://${diaChiQR.ipMayChu()}:${PORT}`).replace(/\/+$/, '');
      await mailer.sendResetLink(yc.khach.email, `${gocUrl}/dat-lai-mat-khau/${yc.token}`, yc.hanPhut);
    }
    res.render('forgot-password', { title: tieuDe, message: thongBaoChung });
  } catch (err) {
    // Chi tiet loi chi ghi ra console. Day la trang CONG KHAI.
    console.error('Forgot password error:', err);
    res.render('forgot-password', { title: tieuDe, error: 'Chưa gửi được email lúc này. Mật khẩu của bạn vẫn giữ nguyên, vui lòng thử lại sau.' });
  }
});

app.get('/dat-lai-mat-khau/:token', async (req, res) => {
  try {
    const yc = await datLaiMK.timYeuCau(req.params.token);
    res.render('dat-lai-mat-khau', {
      title: 'Đặt lại mật khẩu',
      hopLe: !!yc,
      token: req.params.token,
      ten: yc ? yc.ten : '',
      error: yc ? null : 'Liên kết đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/dat-lai-mat-khau/:token', async (req, res) => {
  const { mat_khau, nhap_lai } = req.body;
  const veLai = (error) => res.render('dat-lai-mat-khau', {
    title: 'Đặt lại mật khẩu', hopLe: true, token: req.params.token, ten: '', error,
  });
  try {
    if (String(mat_khau || '') !== String(nhap_lai || '')) return veLai('Mật khẩu nhập lại không khớp.');
    const kq = await datLaiMK.datMatKhauMoi(req.params.token, mat_khau);
    if (!kq.ok) return veLai(kq.loi);
    res.render('login', {
      title: res.locals.t('tai_khoan.dang_nhap'),
      message: 'Đặt mật khẩu mới thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/profile', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM khach_hang WHERE id = ?', [req.session.userId]);
    res.render('profile', { 
      title: res.locals.t('tai_khoan.thong_tin'), 
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
      const loiMk = require('./utils/matKhau').loiMatKhauMoi(new_pass);
      if (loiMk) {
        return res.redirect('/profile?msg=' + encodeURIComponent(loiMk) + '&msgType=danger');
      }
      try {
        await orderService.changePassword(req.session.userId, old_pass, new_pass);
      } catch (e) {
        return res.redirect('/profile?msg=Mật+khẩu+cũ+không+chính+xác!&msgType=danger');
      }
      req.session.phaiDoiMatKhau = false;
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


// Khu QUAN TRI (/admin/*) - xem routes/quanTri.js
app.use(require('./routes/quanTri')({ gioiHanDN, orderService, personnelService, requireAdmin, upload }));

// Khu KE TOAN (/staff/accountant/*) - xem routes/keToan.js
app.use(require('./routes/keToan')({ db, personnelService, requireRole }));

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

app.post('/chat/send', requireLogin, (req, res, next) => {
  uploadChat.single('tep_dinh_kem')(req, res, (err) => {
    if (err) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(400).json({ success: false, message: err.message || 'Lỗi tải tệp lên' });
      }
      return res.redirect('/chat');
    }
    next();
  });
}, async (req, res) => {
  const noi_dung = String((req.body && req.body.noi_dung) || '').trim();
  const tep = layThongTinTepChat(req.file);
  if (!noi_dung && !tep) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(400).json({ success: false, message: 'Tin nhắn trống' });
    }
    return res.redirect('/chat');
  }
  try {
    const userId = req.session.userId;
    const msgId = await engagementService.sendMessage(userId, null, noi_dung, 'khach', tep);

    const payload = {
      id_chat: msgId,
      noi_dung: noi_dung,
      nguoi_gui: 'khach',
      thoigian: new Date(),
      ten_kh: req.session.username,
      loai_file: tep ? tep.loai_file : null,
      duong_dan_file: tep ? tep.duong_dan_file : null,
      ten_file: tep ? tep.ten_file : null,
      kich_thuoc_file: tep ? tep.kich_thuoc_file : null
    };

    // Emit real-time message
    io.to(`room_${userId}`).emit('new-message', payload);

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({ success: true, message: payload });
    }
    res.redirect('/chat');
  } catch (err) {
    console.error(err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
    res.redirect('/chat');
  }
});

// --- Customer: Rating ---
// Trang danh gia chinh la /rate. /rating (GET) cu dung dieu kien khac
// (hasCompletedOrder) va in log debug - gom ve mot cho cho nhat quan.
app.get('/rating', (req, res) => res.redirect(301, '/rate'));

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

/**
 * Duong dan quay lai sau khi dang nhap (`?tiep=`).
 *
 * Chi nhan duong dan NOI BO. Khong loc thi `?tiep=https://trang-gia.com` bien
 * trang dang nhap that cua nha hang thanh mot buoc nhay sang trang cua ke khac -
 * lo hong chuyen huong mo, va nan nhan la nguoi vua go dung mat khau xong.
 * Chan ca `//` va `/\` vi trinh duyet hieu chung la dia chi tuyet doi.
 */
function duongDanTiep(gt) {
  const s = String(gt || '');
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return null;
  return s;
}

app.get('/staff/login', (req, res) => {
  const tiep = duongDanTiep(req.query.tiep);
  if (req.session.stafflogin) return res.redirect(tiep || '/staff');
  res.render('staff/login', { layout: false, tiep });
});

app.post('/staff/login', async (req, res) => {
  const { username, password } = req.body;
  const tiep = duongDanTiep(req.body.tiep);
  const biKhoa = gioiHanDN.soGiayBiKhoa(req, 'nhan_vien', username);
  if (biKhoa) {
    return res.status(429).render('staff/login', { error: gioiHanDN.thongBaoKhoa(biKhoa), layout: false, tiep });
  }
  try {
    const staff = await personnelService.staffLogin(username, password);
    if (!staff) gioiHanDN.ghiThatBai(req, 'nhan_vien', username);
    if (staff) {
      gioiHanDN.xoaDem(req, 'nhan_vien', username);
      req.session.stafflogin = true;
      req.session.staffId = staff.id_nv;
      req.session.staffName = staff.ten;
      req.session.staffRole = staff.chucvu; // vai tro cu - giu de cac route cu chay dung
      req.session.nvPhaiDoiMatKhau = require('./utils/matKhau').laMacDinh(password) && await batDoiMkNhanVien();

      // Nap chuc danh, bo phan, cap bac va danh sach quyen theo co cau to chuc.
      // Loi o day khong duoc chan dang nhap: nguoi chua duoc bo nhiem chuc danh
      // van phai vao duoc he thong bang vai tro cu cua ho.
      try {
        await require('./services/phanQuyenService').napVaoSession(req, staff.id_nv);
      } catch (e) {
        console.error('Không nạp được hồ sơ quyền khi đăng nhập:', e.message);
      }

      // Nguoi vua quet ma QR / bam duong dan cham cong tren dien thoai: dua ho
      // ve DUNG cho ho dinh toi. Uu tien hon ca buoc moi dang ky khuon mat ben
      // duoi, vi trang /cham-cong/ tu no da co phan dang ky ngay trong trang -
      // chen them mot trang nua vao giua chi khien ho lac duong.
      if (tiep) return res.redirect(tiep);

      if (req.session.nvPhaiDoiMatKhau) {
        return res.redirect('/staff/profile?msg=' + encodeURIComponent(
          'Bạn đang dùng mật khẩu mặc định 123456. Vui lòng đổi mật khẩu mới để tiếp tục.'
        ) + '&msgType=danger');
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
    res.render('staff/login', {
      error: 'Tên đăng nhập hoặc mật khẩu không đúng!', layout: false, tiep,
    });
  } catch (err) {
    console.error(err);
    res.render('staff/login', { error: 'Lỗi hệ thống!', layout: false, tiep });
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

/*
  Trung tam dat ban da chuyen sang routes/datBan.js.

  Khoi route cu o day (khoang 20 route noi tiep nhau) da bi go bo. Duong dan
  moi la /staff/dat-ban; /staff/reservations duoc chuyen huong sang do de cac
  duong link da luu trong trinh duyet cua nhan vien van vao dung cho.
*/
app.get('/staff/reservations', (req, res) => res.redirect(301, '/staff/dat-ban'));

app.get('/staff/bookings', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  try {
    const bookings = await orderService.getAllBookings();
    const qrCodes = await orderService.getAllQRCodes();
    res.render('staff/bookings', {
      title: 'Quản lý Đặt bàn & Gọi món',
      bookings,
      qrCodes,
      msg: req.query.msg || '',
      msgType: ['success', 'danger', 'warning', 'info'].includes(req.query.msgType) ? req.query.msgType : 'info',
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'bookings'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/bookings/create', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
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

app.post('/staff/bookings/create', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  try {
    const { dates } = req.body;
    const today = new Date().toISOString().split('T')[0];
    if (dates < today) {
      return res.send('<script>alert("Ngày đặt bàn không được ở quá khứ!"); history.back();</script>');
    }
    const sesis = await orderService.createStaffBooking(req.body);

    // Notify Kitchen Real-time
    io.to('kitchen_room').emit('new-order-to-kitchen', {
      message: `Nhân viên [${req.session.staffName}] vừa tạo 1 đơn bàn mới!`,
      sesis: sesis
    });

    res.redirect('/staff/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/bookings/edit/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
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
app.post('/staff/bookings/pay/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), (req, res) => {
  res.redirect(303, '/staff/thanh-toan/' + encodeURIComponent(req.params.sesis));
});

/*
 * Xac nhan don: CHI don dang cho (tinhtrang = 0) va KHONG phai don giao hang.
 *
 * Truoc day route nay dat thang tinhtrang = 1 cho moi sesis:
 *   - don da thanh toan (3) / da huy (4) bi "song lai", hien lai tren bep va
 *     so do ban;
 *   - don GIAO HANG o tinhtrang 0 nghia la DANG CHO KHACH TRA TIEN TRUOC
 *     (chinhSachGiaoService chuyen 0 -> 1 khi tien ve). Bam xac nhan o day la
 *     bo qua buoc thu tien.
 * Cau UPDATE co dieu kien nen hai nguoi bam cung luc cung chi doi mot lan.
 */
const NHAN_TINH_TRANG_DON = { 0: 'chờ xác nhận', 1: 'đã xác nhận', 3: 'đã thanh toán', 4: 'đã hủy', 5: 'đang phục vụ', 6: 'đang dùng món' };
const veDanhSachDon = (res, msg, loai = 'danger') =>
  res.redirect('/staff/bookings?msg=' + encodeURIComponent(msg) + '&msgType=' + loai);

app.post('/staff/bookings/confirm/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  const sesis = req.params.sesis;
  try {
    const [[don]] = await db.query('SELECT tinhtrang, loai_don FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]);
    if (!don) return veDanhSachDon(res, 'Không tìm thấy đơn.');
    if (don.loai_don === 'giao_hang') {
      return veDanhSachDon(res, 'Đơn giao hàng được xác nhận tự động khi khách thanh toán trước - không xác nhận tay.');
    }
    const [kq] = await db.query(
      "UPDATE hopdong SET tinhtrang = 1 WHERE sesis = ? AND tinhtrang = 0 AND loai_don <> 'giao_hang'", [sesis]);
    if (!kq.affectedRows) {
      return veDanhSachDon(res, `Không thể xác nhận: đơn đang ở trạng thái "${NHAN_TINH_TRANG_DON[don.tinhtrang] || don.tinhtrang}".`);
    }
    veDanhSachDon(res, 'Đã xác nhận đơn.', 'success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

/*
 * Khach den: chi voi don da xac nhan (1) hoac dang phuc vu (5, 6 - gan lai ban).
 * Truoc day gan ma QR ban cho ca don da thanh toan / da huy.
 */
app.post('/staff/bookings/arrive/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  const { table_id } = req.body;
  const sesis = req.params.sesis;
  try {
    const [[don]] = await db.query('SELECT tinhtrang, loai_don FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]);
    if (!don) return veDanhSachDon(res, 'Không tìm thấy đơn.');
    if (don.loai_don === 'giao_hang') return veDanhSachDon(res, 'Đơn giao hàng không nhận khách tại bàn.');
    if (![1, 5, 6].includes(Number(don.tinhtrang))) {
      return veDanhSachDon(res, `Không thể nhận khách: đơn đang ở trạng thái "${NHAN_TINH_TRANG_DON[don.tinhtrang] || don.tinhtrang}".`);
    }
    if (table_id) {
      const [[qr]] = await db.query('SELECT table_id FROM qr_tables WHERE table_id = ? LIMIT 1', [table_id]);
      if (!qr) return veDanhSachDon(res, 'Mã QR bàn không tồn tại.');
    }

    await db.query('UPDATE hopdong SET tinhtrang = 5 WHERE sesis = ? AND tinhtrang = 1', [sesis]);
    // Go lien ket QR cu cua don roi gan ban vua chon.
    await db.query('UPDATE qr_tables SET active_sesis = NULL WHERE active_sesis = ?', [sesis]);
    if (table_id) {
      await db.query('UPDATE qr_tables SET active_sesis = ? WHERE table_id = ?', [sesis, table_id]);
    }
    veDanhSachDon(res, 'Đã ghi nhận khách đến.', 'success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/bookings/print/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
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

// Man hinh bep (/staff/kitchen) do KDS phuc vu - xem routes/kds.js. Trang
// kitchen.ejs cu va POST /staff/kitchen/mark-done da bo: route GET o day khong
// bao gio chay toi (KDS duoc mount truoc) va mark-done chi trang cu goi.

// Khu QUAN LY BEP (/staff/kitchen/*) - xem routes/bepQuanLy.js
app.use(require('./routes/bepQuanLy')({ db, equipmentService, menuService, personnelService, requireRole, upload }));

app.get('/staff/customers', requireRole(['Quay', 'Thu ngan', 'Quan ly']), async (req, res) => {
  try {
    const customers = await orderService.getAllCustomers();
    res.render('staff/customers', {
      title: 'Quản lý Khách hàng',
      customers,
      msg: req.query.msg || '',
      msgType: req.query.msgType || '',
      // Cung dieu kien voi requireRole(['Quan ly']) cua route xoa: vai tro cu
      // hoac chuc danh moi duoc dong vai Quan ly (vd. giam sat).
      coQuyenXoa: !!(req.session.adminlogin
        || req.session.staffRole === 'Quan ly'
        || require('./services/phanQuyenService').dongVaiDuoc(req.hoSo, ['Quan ly'])),
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'customers'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Them / sua khach: cung nhom vai tro duoc xem trang khach hang. Truoc day chi
// can la nhan vien (bep, shipper... deu goi duoc).
app.post('/staff/customers/add', requireRole(['Quay', 'Thu ngan', 'Quan ly']), async (req, res) => {
  try {
    await orderService.addCustomer(req.body);
    res.redirect('/staff/customers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/customers/edit/:id', requireRole(['Quay', 'Thu ngan', 'Quan ly']), async (req, res) => {
  try {
    await orderService.updateCustomer(req.params.id, req.body);
    res.redirect('/staff/customers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Xoa khach: chi Quan ly, va chi xoa duoc ho so chua co lich su giao dich
// (xem orderService.deleteCustomer).
app.post('/staff/customers/delete/:id', requireRole(['Quan ly']), async (req, res) => {
  try {
    const kq = await orderService.deleteCustomer(req.params.id);
    const msg = kq.ok ? 'Đã xóa khách hàng.' : kq.lyDo;
    res.redirect('/staff/customers?msg=' + encodeURIComponent(msg) + '&msgType=' + (kq.ok ? 'success' : 'danger'));
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
app.get('/staff/shift', requireRole(['Thu ngan', 'Quan ly']), (req, res) => {
  res.redirect(301, '/staff/chot-ca');
});

app.post('/staff/shift/close', requireRole(['Thu ngan', 'Quan ly']), (req, res) => {
  res.redirect(303, '/staff/chot-ca');
});

// --- STAFF EMAILS ---
app.get('/staff/emails', requireRole(['Quay', 'Quan ly']), async (req, res) => {
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

app.get('/staff/emails/send', requireRole(['Quay', 'Quan ly']), async (req, res) => {
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

app.post('/staff/emails/send', requireRole(['Quay', 'Quan ly']), async (req, res) => {
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

// Staff Schedule - thoi khoa bieu theo tuan
//
// Xem theo TUAN chu khong theo thang: mot luoi ca x 7 ngay doc duoc trong mot
// cai liec, con luoi ca x 31 ngay thi khong con la thoi khoa bieu nua. Tham so
// `?tuan=` nhan mot ngay bat ky roi tu lui ve thu Hai, nen link tuan truoc /
// tuan sau chi can cong tru 7 ngay ma khong phai xu ly ranh gioi thang.
app.get('/staff/schedule', requireStaff, async (req, res) => {
  try {
    const { thuHaiCuaTuan, ngayISO } = require('./services/xepCa');
    const homNay = ngayISO(new Date());

    // Con ho tro `?thang=` cua ban cu: link da luu hoac dan o cho khac van vao
    // dung tuan dau cua thang do thay vi bao loi.
    let moc = req.query.tuan || homNay;
    if (!req.query.tuan && req.query.thang) moc = req.query.thang + '-01';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(moc)) moc = homNay;

    const thuHai = thuHaiCuaTuan(moc);
    const chuNhat = ngayISO(new Date(new Date(thuHai + 'T00:00:00').getTime() + 6 * 86400000));
    const dich = (goc, soNgay) =>
      ngayISO(new Date(new Date(goc + 'T00:00:00').getTime() + soNgay * 86400000));

    const [dsCa, schedule, unread] = await Promise.all([
      personnelService.getShifts(),
      personnelService.getScheduleRange(req.session.staffId, thuHai, chuNhat),
      personnelService.countUnread(req.session.staffId),
    ]);

    res.render('staff/schedule', {
      title: 'Lịch làm việc',
      schedule, dsCa, thuHai, chuNhat, homNay,
      tuanTruoc: dich(thuHai, -7),
      tuanSau: dich(thuHai, 7),
      ngayTrongTuan: Array.from({ length: 7 }, (_, i) => dich(thuHai, i)),
      msg: req.query.msg || null, msgType: req.query.msgType || null,
      unread,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Sau khi dang ky / huy phai quay ve DUNG tuan vua xem. Truoc day redirect
// tro tay khong nen nguoi dang xem tuan sau bam Dang ky xong lai bi nem ve tuan
// hien tai, khong thay ca minh vua tao dau.
function urlLichTuan(req, msg, loai) {
  // `req.body` khong ton tai o route GET (huy ca), nen phai kiem tra truoc khi
  // doc - doc thang la nem TypeError va bien mot lan huy thanh cong thanh loi
  // 500, trong khi ca thi da xoa roi.
  const tuan = (req.body && req.body.tuan) || req.query.tuan || '';
  const p = new URLSearchParams();
  if (tuan) p.set('tuan', tuan);
  if (msg) { p.set('msg', msg); p.set('msgType', loai || 'info'); }
  const qs = p.toString();
  return '/staff/schedule' + (qs ? '?' + qs : '');
}

app.post('/staff/schedule', requireStaff, async (req, res) => {
  const { ngay, ca, ghi_chu } = req.body;
  try {
    await personnelService.registerSchedule(req.session.staffId, ngay, ca, ghi_chu);
    res.redirect(urlLichTuan(req, 'Đã đăng ký ca làm.', 'success'));
  } catch (err) {
    res.redirect(urlLichTuan(req, err.message, 'danger'));
  }
});

app.post('/staff/schedule/cancel/:id', requireStaff, async (req, res) => {
  try {
    await personnelService.cancelSchedule(req.params.id, req.session.staffId);
    res.redirect(urlLichTuan(req, 'Đã huỷ đăng ký.', 'info'));
  } catch (err) {
    res.redirect(urlLichTuan(req, err.message, 'danger'));
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

    // Ma QR mo trang cham cong tren dien thoai.
    //
    // Vi sao ve ma QR chu khong chi in dia chi ra man hinh: dia chi that dai
    // (https://192.168.1.50:3443/cham-cong/ hoac mot ten mien trycloudflare
    // ngau nhien), go tay tren dien thoai sai mot ky tu la khong vao duoc va
    // khong ai doan ra minh go sai o dau. Quet ma thi khong the go sai.
    //
    // `diaChiDienThoai` co the tra null khi may chu tat HTTPS va khong mo
    // tunnel - luc do khong ve ma nao ca, giao dien noi thang la chua dung
    // duoc, thay vi ve mot ma QR dan vao ngo cut.
    let diDong = null;
    try {
      const dc = diaChiQR.diaChiDienThoai(req);
      if (dc) {
        /*
          Ma QR tro vao '/cc' chu KHONG phai '/cham-cong/'.

          '/cham-cong/' nam trong pham vi service worker; quet ma QR vao thang
          do thi lan dau tien - luc chua ai chap nhan chung chi tu ky - se bi
          worker chan va tra ve trang "mat ket noi", va nguoi dung khong con
          duong nao ra. Xem ghi chu day du o route '/cc' trong
          routes/chamCongDiDong.js.
        */
        diDong = { ...dc, url: dc.url + '/cc' };
        diDong.anh = await require('qrcode').toDataURL(diDong.url, {
          errorCorrectionLevel: 'M', margin: 1, width: 220,
        });
      }
    } catch (e) {
      console.warn('[cham-cong] không vẽ được mã QR điện thoại:', e.message);
    }

    res.render('staff/attendance', {
      title: 'Chấm công', attendance,
      trangThai, soMauKhuonMat, diDong,
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
    // Rang buoc (qua khu, thu tu ngay, toi da 30 ngay, trung don) nam trong
    // services/nghiPhepService.js - dung chung voi form cua ke toan.
    const nghiPhep = require('./services/nghiPhepService');
    try {
      await nghiPhep.taoDon(req.session.staffId, req.body);
    } catch (e) {
      if (e instanceof nghiPhep.LoiNghiPhep) {
        return res.send(`<script>alert(${JSON.stringify(e.message)}); history.back();</script>`);
      }
      throw e;
    }
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
      title: res.locals.t('tai_khoan.thong_tin'), staff,
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
      const loiMk = require('./utils/matKhau').loiMatKhauMoi(new_pass);
      if (loiMk) return res.redirect('/staff/profile?msg=' + encodeURIComponent(loiMk) + '&msgType=danger');
      await personnelService.changeStaffPassword(req.session.staffId, old_pass, new_pass);
      req.session.nvPhaiDoiMatKhau = false;
    }
    res.redirect('/staff/profile?msg=Cập+nhật+thành+công!&msgType=success');
  } catch (err) {
    res.redirect('/staff/profile?msg=' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

// Staff Chat
app.get('/staff/chat', requireRole(['Quay', 'Phuc vu', 'Quan ly']), async (req, res) => {
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

app.get('/staff/chat/:id_kh', requireRole(['Quay', 'Phuc vu', 'Quan ly']), async (req, res) => {
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

app.post('/staff/chat/send', requireStaff, (req, res, next) => {
  uploadChat.single('tep_dinh_kem')(req, res, (err) => {
    if (err) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(400).json({ success: false, message: err.message || 'Lỗi tải tệp lên' });
      }
      return res.redirect('/staff/chat');
    }
    next();
  });
}, async (req, res) => {
  const id_kh = req.body && req.body.id_kh;
  const noi_dung = String((req.body && req.body.noi_dung) || '').trim();
  const tep = layThongTinTepChat(req.file);
  if (!id_kh || (!noi_dung && !tep)) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(400).json({ success: false, message: 'Thiếu nội dung hoặc tệp đính kèm' });
    }
    return res.redirect('/staff/chat/' + (id_kh || ''));
  }
  try {
    const msgId = await engagementService.sendMessage(id_kh, req.session.staffId, noi_dung, 'nhanvien', tep);

    const payload = {
      id_chat: msgId,
      noi_dung: noi_dung,
      nguoi_gui: 'nhanvien',
      thoigian: new Date(),
      ten_nv: req.session.staffName,
      loai_file: tep ? tep.loai_file : null,
      duong_dan_file: tep ? tep.duong_dan_file : null,
      ten_file: tep ? tep.ten_file : null,
      kich_thuoc_file: tep ? tep.kich_thuoc_file : null
    };

    // Emit real-time message to the specific customer room
    io.to(`room_${id_kh}`).emit('new-message', payload);

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({ success: true, message: payload });
    }
    res.redirect('/staff/chat/' + id_kh);
  } catch (err) {
    console.error(err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
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

    /*
      Nguyen lieu + nhom di ung cho tung mon, dinh san vao trang.

      Khach ngoi tai ban khong co duong nao khac de biet mon co gi: khong co
      thuc don giay, khong co nhan vien dung ben canh. Day la cho can canh bao
      di ung nhat trong ca he thong, nen du lieu phai co san khi sheet mo ra
      chu khong doi mot vong request nua.

      Ten nguyen lieu dich sang ngon ngu dang xem ngay tu day, de phia trinh
      duyet khong phai mang theo bang tu vung.
    */
    const nguyenLieuTheoMon = await menuService.getAllDishIngredients();
    const nguyenLieuMon = {};
    for (const mon of allDishes) {
      const ds = nguyenLieuTheoMon[mon.id_mon] || [];
      const kq = diUngService.phanTich(ds);
      nguyenLieuMon[mon.id_mon] = {
        nl: ds.map((ten) => res.locals.tenNguyenLieu(ten)),
        nhom: kq.nhom.map((n) => ({
          nhan: res.locals.t('di_ung.' + n.khoa),
          nl: n.nguyen_lieu.map((ten) => res.locals.tenNguyenLieu(ten)),
        })),
      };
    }

    // Nếu có sesis thì dùng, không thì để trang xử lý tạo mới khi đặt
    res.render('qr-menu', {
      layout: false,
      title: 'Đặt món - ' + tableName,
      tableId,
      tableName,
      sesis: sesis || '',
      categories,
      dishes: allDishes,
      nguyenLieuMon,
      // Mon het nguyen lieu: hien "Tam het", khong cho goi.
      hetMon: [...(await require('./services/tonMonService').monDaHet().catch(() => new Set()))],
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
    // Thoi gian du kien moi mon (services/thoiGianChoService.js).
    const duKien = don.mon.length ? await require('./services/thoiGianChoService').duKien().catch(() => null) : null;
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
        con_phut: duKien && duKien.theoId.has(m.id) ? duKien.theoId.get(m.id).con_phut : null,
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
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, message: 'Giỏ hàng trống!' });
    }
    // Kiem tra so luong TRUOC khi tao phien/khach vang lai, de goi rac khong
    // de lai don rong. addMultipleDishesToOrder kiem tra lai lan nua.
    if (items.length > 30 || items.some((it) => !orderService.chuanHoaSoLuong(it && it.qty))) {
      return res.json({
        success: false,
        message: `Số lượng mỗi món phải từ 1 đến ${orderService.SO_LUONG_TOI_DA_KHACH} (tối đa 30 món mỗi lần gửi).`,
      });
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

app.get('/staff/qr-codes', requireRole(['Quay', 'Quan ly']), async (req, res) => {
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

app.post('/staff/qr-codes/create', requireRole(['Quay', 'Quan ly']), async (req, res) => {
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

app.post('/staff/qr-codes/delete/:id', requireRole(['Quay', 'Quan ly']), async (req, res) => {
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
app.get('/staff/bookings/dishes', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
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
app.post('/staff/bookings/add-dish/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  try {
    const sesis = req.params.sesis;
    const { id_mon, soluong } = req.body;
    const qty = orderService.chuanHoaSoLuong(
      soluong == null || soluong === '' ? 1 : soluong, orderService.SO_LUONG_TOI_DA_NHAN_VIEN
    );

    if (!id_mon) return res.json({ success: false, message: 'Chưa chọn món!' });
    if (!qty) return res.json({ success: false, message: `Số lượng phải từ 1 đến ${orderService.SO_LUONG_TOI_DA_NHAN_VIEN}!` });

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

// --- Huy / tra mon (xem services/huyMonService.js) ---
// Mon bep chua lam: phuc vu / quay / thu ngan huy duoc. Mon da vao bep: chi
// Quan ly (vai tro cu hoac chuc danh dong vai Quan ly).
function laQuanLyPhien(req) {
  return !!(req.session.adminlogin || req.session.staffRole === 'Quan ly'
    || require('./services/phanQuyenService').dongVaiDuoc(req.hoSo, ['Quan ly']));
}

app.post('/staff/huy-mon/:id', requireRole(['Phuc vu', 'Quay', 'Thu ngan', 'Quan ly']), async (req, res) => {
  const huyMonService = require('./services/huyMonService');
  try {
    const kq = await huyMonService.huyMon(req.params.id, {
      soLuong: req.body.so_luong,
      maLyDo: req.body.ma_ly_do,
      ghiChu: req.body.ly_do,
      nhanVien: {
        id: req.session.staffId || null,
        ten: req.session.staffName || (req.session.adminlogin ? 'Quản trị' : ''),
        laQuanLy: laQuanLyPhien(req),
      },
    });
    // Man hinh bep, so do ban, thu ngan tu cap nhat.
    const mon = { id: kq.id, sesis: kq.sesis, name_mon: kq.name_mon, soluong: kq.con_lai };
    io.to('kitchen_room').emit('kds-cap-nhat', { buoc: 'huy-mon', mon });
    io.to('staff_room').emit('kds-cap-nhat', { buoc: 'huy-mon', mon });
    res.json({ success: true, ...kq });
  } catch (err) {
    if (err instanceof huyMonService.LoiHuyMon) {
      return res.status(err.ma === 'CAN_QUAN_LY' ? 403 : 400).json({ success: false, message: err.message });
    }
    console.error('Lỗi hủy món:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi hủy món.' });
  }
});

app.get('/staff/huy-mon/don/:sesis', requireRole(['Phuc vu', 'Quay', 'Thu ngan', 'Quan ly']), async (req, res) => {
  try {
    const huyMonService = require('./services/huyMonService');
    res.json({
      success: true,
      la_quan_ly: laQuanLyPhien(req),
      ly_do: huyMonService.LY_DO,
      lich_su: await huyMonService.lichSuCuaDon(req.params.sesis),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API lấy chi tiết các món của đơn để xem nhanh
app.get('/staff/bookings/items/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  try {
    const sesis = req.params.sesis;
    const [items] = await db.query(
      `SELECT h.id, h.name_mon, h.soluong, h.gia, h.thanhtien, h.trangthai_bep, h.ghi_chu_mon
       FROM hopdong h
       WHERE h.sesis = ? AND h.id_mon > 0 AND h.soluong > 0
       ORDER BY h.id ASC`,
      [sesis]
    );
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    /*
      MOT dia chi duoc chi ro, phan con lai la du phong.

      Truoc day cho in ca nam dia chi ngang hang nhau. May nay co card ao cua
      WSL, VMware va VirtualBox, nen nguoi dung nhin thay nam dong giong het
      nhau va khong co cach nao biet dong nao dien thoai vao duoc - bon trong
      so do la mang rieng cua may ao, dien thoai goi vao chi thay khong phan
      hoi. Do la ly do that su khien "vao trang cham cong tren dien thoai
      khong duoc".

      `diaChiDeXuat()` xep dia chi kha nang dung nhat len dau (xem ghi chu cua
      no trong config/chungChi.js). No chi SAP XEP chu khong bo dia chi nao,
      nen neu phong doan sai thi cac dia chi con lai van con day de thu.
    */
    const dsXep = chungChi.diaChiDeXuat().filter((ip) => dsLan.includes(ip));
    const ds = dsXep.length ? dsXep : dsLan;
    const duong = (ip) => (coHttps
      ? `https://${ip}:${PORT_HTTPS}/cham-cong/`
      : `http://${ip}:${PORT}/cham-cong/`);

    console.log('');
    d('ĐIỆN THOẠI CHẤM CÔNG — mở đúng địa chỉ này:');
    d('');
    d(`   >>>  ${duong(ds[0])}`);
    d('');
    if (!coHttps) {
      d('   (đang chạy HTTP nên camera và GPS sẽ KHÔNG mở được —');
      d('    xem khóa BAT_HTTPS trong .env)');
    }
    d('Điện thoại phải nối CÙNG mạng Wi-Fi với máy này.');

    if (ds.length > 1) {
      d('');
      d('Nếu địa chỉ trên không mở được, các địa chỉ còn lại của máy (phần lớn');
      d('là card mạng ảo, điện thoại thường KHÔNG vào được):');
      ds.slice(1).forEach((ip) => d(`   ${duong(ip)}`));
    }

    console.log('');
    d(`Mã QR dán ở bàn đang dùng địa chỉ: ${diaChiQR.goc(null)}`);
    if (ds.length > 1) {
      d('Nếu quét mã QR mà không mở được trang, ghi địa chỉ chạy được vào khóa');
      d('QR_BASE_URL trong file .env (ví dụ QR_BASE_URL=http://192.168.1.5:3000).');
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
  /*
    Cong 3000 dang bi giu -> BAO RO, dung de nem loi tho.

    Truoc day `server.listen` khong co ai nghe 'error'. Khi mot tien trinh Node
    cu con giu cong 3000 (rat de xay ra: dong nham cua so, hoac start_all.bat
    mo them mot cua so nua), Node nem EADDRINUSE khong ai bat -> tien trinh MOI
    chet ngay, con tien trinh CU van chay va van phuc vu.

    Hau qua rat kho doan ra: nguoi dung "da khoi dong lai" nhung trinh duyet
    van nhan ma nguon cu, nen moi trang moi them vao deu tra ve 404. Ho se di
    tim loi trong ma nguon, o dung cho khong co loi nao ca.
  */
  server.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════╗');
    console.error(`║  KHÔNG MỞ ĐƯỢC CỔNG ${String(PORT).padEnd(5)}                                ║`);
    console.error('╚══════════════════════════════════════════════════════════╝');
    console.error('  Một tiến trình Node khác đang giữ cổng này — gần như chắc chắn');
    console.error('  là bản máy chủ CŨ bạn quên tắt.');
    console.error('');
    console.error('  Máy chủ cũ đó vẫn đang chạy và vẫn phục vụ MÃ NGUỒN CŨ, nên');
    console.error('  các trang mới thêm vào sẽ báo 404 dù bạn tưởng đã khởi động lại.');
    console.error('');
    console.error('  Cách dứt điểm trên Windows:');
    console.error('      taskkill /F /IM node.exe');
    console.error('      npm start');
    console.error('');
    process.exit(1);
  });

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

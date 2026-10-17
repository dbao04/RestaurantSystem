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
  res.render('index', { title: res.locals.t('dieu_huong.trang_chu'), mons, monTrangTri, thongKe });
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
    res.render('detail', {
      title: dish ? dish.name_mon : res.locals.t('chi_tiet.tieu_de'),
      dish,
      nguyenLieu,
      diUng: diUngService.phanTich(nguyenLieu),
      thongTinGiao: req.session.thongTinGiao || null
    });
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
    const vanChuyen = require('./services/vanChuyenService');
    const [cartItems, subtotal, thamSoGiao, nhaHangToaDo, khachHang] = await Promise.all([
      orderService.getCart(req.sessionID),
      orderService.getCartTotal(req.sessionID),
      vanChuyen.thamSo().catch(() => ({ bat: true, ban_kinh_km: 10, mien_phi_tu: 500000 })),
      vanChuyen.toaDoNhaHang().catch(() => null),
      req.session.userId ? orderService.getUserById(req.session.userId).catch(() => null) : null,
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
    });
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

      const donGiao = await vanChuyen.taoDonGiao(uniqueSesis, {
        ten_nguoi_nhan: tenNguoiNhan,
        sdt_nguoi_nhan: sdtNguoiNhan,
        dia_chi_giao: diaChiDayDu,
        vi_do: viDo,
        kinh_do: kinhDo,
        ghi_chu: ghiChuGiao,
        batBuocTrongVung: true,
        ten_nguoi: req.session.username,
      });

      realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });

      // Xoa thong tin tam sau khi dat don thanh cong
      const phuongThucTT = String(req.body.phuong_thuc_tt || 'tien_mat').toLowerCase();

      // Nếu chọn chuyển khoản VietQR thì chuyển tới trang thanh toán QR trước
      if (phuongThucTT === 'vietqr') {
        return res.redirect(`/thanh-toan/don-hang/${uniqueSesis}`);
      }

      return res.redirect(`/theo-doi/${donGiao.ma_giao}`);
    }

    res.redirect(`/contract?sesis=${uniqueSesis}`);
  } catch (err) {
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
  res.render('success', { title: res.locals.t('ket_qua.dat_thanh_cong') });
});

app.get('/login', (req, res) => {
  res.render('login', { title: res.locals.t('tai_khoan.dang_nhap') });
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
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM khach_hang WHERE email = ? LIMIT 1', [email]);
    if (!rows[0]) {
      return res.render('forgot-password', { title: res.locals.t('tai_khoan.quen_mat_khau_tieu_de'), error: 'Email không tồn tại trong hệ thống!' });
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

    res.render('forgot-password', { title: res.locals.t('tai_khoan.quen_mat_khau_tieu_de'), message: 'Mật khẩu mới đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến (và thư mục rác).' });
  } catch (err) {
    // Chi tiet loi chi ghi ra console cho nguoi van hanh. Day la trang CONG KHAI
    // nen khong ha ra "chua cau hinh EMAIL_USER trong .env" cho khach doc.
    console.error('Forgot password error:', err);
    res.render('forgot-password', { title: res.locals.t('tai_khoan.quen_mat_khau_tieu_de'), error: 'Chưa gửi được email lúc này. Mật khẩu của bạn vẫn giữ nguyên, vui lòng thử lại sau.' });
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

// Middleware for Manager or Admin (Chi Quan ly nha hang hoac Admin moi duoc quan ly / duyet lich)
const requireManagerOrAdmin = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  if (req.session && req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|manager/.test(vaiTro) || (req.hoSo && req.hoSo.cap_bac <= 2 && !/ke toan|ketoan/.test(vaiTro))) return next();
  }
  return res.redirect('/admin/login');
};

// --- MANAGER: SCHEDULE APPROVAL ---
app.get('/staff/schedule/approval', requireManagerOrAdmin, async (req, res) => {
  try {
    const schedules = await personnelService.getAllSchedules();
    res.render('staff/schedule-approval', { title: 'Duyệt lịch làm việc', schedules, isStaff: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/schedule/update/:id', requireManagerOrAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await personnelService.updateScheduleStatus(req.params.id, status);
    res.redirect('/staff/schedule/approval');
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

app.get('/staff/accountant/salary', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const [salaryList, staffList, summary, attendanceList] = await Promise.all([
      personnelService.getSalaryList(month, year),
      personnelService.getAllStaff(),
      personnelService.getMonthlySalarySummary(month, year),
      personnelService.getDetailedAttendanceReport(month, year),
    ]);
    
    res.render('staff/accountant/salary', {
      title: 'Quản lý Lương',
      salaryList,
      staffList,
      summary,
      attendanceList,
      month, year,
      msg: req.query.msg || null,
      msgType: req.query.msgType || 'success',
      unread: await personnelService.countUnread(req.session.staffId),
      activePage: 'salary'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Tự động tính lương toàn bộ nhân viên theo ngày công thực tế
app.post('/staff/accountant/salary/auto-calculate', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
  try {
    const { month, year } = req.body;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const result = await personnelService.autoCalculateSalary(m, y);
    res.redirect(`/staff/accountant/salary?month=${m}&year=${y}&msg=${encodeURIComponent(`Đã tự động tính lương thành công cho ${result.calculated} nhân viên dựa trên ngày công thực tế!`)}&msgType=success`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/staff/accountant/salary/auto-calculate', (req, res) => res.redirect('/staff/accountant/salary'));

// Gửi duyệt tất cả bảng lương trong tháng
app.post('/staff/accountant/salary/submit-all', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
  try {
    const { month, year } = req.body;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const count = await personnelService.submitAllSalaries(m, y);
    res.redirect(`/staff/accountant/salary?month=${m}&year=${y}&msg=${encodeURIComponent(`Đã gửi ${count} bảng lương sang Quản trị viên phê duyệt!`)}&msgType=success`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/staff/accountant/salary/submit-all', (req, res) => res.redirect('/staff/accountant/salary'));

// Chi lương hàng loạt cho tất cả nhân viên đã được duyệt trong tháng
app.post('/staff/accountant/salary/pay-all', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
  try {
    const { month, year } = req.body;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const count = await personnelService.payAllSalaries(m, y);
    res.redirect(`/staff/accountant/salary?month=${m}&year=${y}&msg=${encodeURIComponent(`Đã xác nhận chi trả lương cho ${count} nhân viên!`)}&msgType=success`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/staff/accountant/salary/pay-all', (req, res) => res.redirect('/staff/accountant/salary'));

app.post('/staff/accountant/salary/upsert', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
  try {
    const { luong_cung, thuong, phu_cap, phat, thang, nam } = req.body;
    if (Number(luong_cung) < 0 || Number(thuong) < 0 || Number(phu_cap) < 0 || Number(phat || 0) < 0) {
      return res.send('<script>alert("Các khoản lương, thưởng, phụ cấp không được nhỏ hơn 0!"); history.back();</script>');
    }
    await personnelService.upsertSalary(req.body);
    res.redirect(`/staff/accountant/salary?month=${thang}&year=${nam}&msg=${encodeURIComponent('Đã lưu thông tin bảng lương!')}&msgType=success`);
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
app.post('/staff/accountant/salary/submit/:id', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
  try {
    await personnelService.submitSalaryForApproval(req.params.id);
    res.redirect('/staff/accountant/salary');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Chi lương (Thanh toán)
app.post('/staff/accountant/salary/pay/:id', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
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
    res.render('profile', { title: res.locals.t('tai_khoan.thong_tin'), user, msg: null });
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
      res.render('profile', { title: res.locals.t('tai_khoan.thong_tin'), user, msg: 'Cập nhật thông tin thành công!', msgType: 'success' });
    } else if (action === 'password') {
      if (new_pass !== re_pass) {
        const user = await orderService.getUserById(req.session.userId);
        return res.render('profile', { title: res.locals.t('tai_khoan.thong_tin'), user, msg: 'Mật khẩu xác nhận không khớp!', msgType: 'danger' });
      }
      await orderService.changePassword(req.session.userId, old_pass, new_pass);
      const user = await orderService.getUserById(req.session.userId);
      return res.render('profile', { title: res.locals.t('tai_khoan.thong_tin'), user, msg: 'Đổi mật khẩu thành công!', msgType: 'success' });
    }
    res.redirect('/profile');
  } catch (err) {
    const user = await orderService.getUserById(req.session.userId);
    res.render('profile', { title: res.locals.t('tai_khoan.thong_tin'), user, msg: err.message, msgType: 'danger' });
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
    res.render('rating', { title: res.locals.t('danh_gia.tieu_de'), ratings, msg: null, canRate });
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
      return res.render('rating', { title: res.locals.t('danh_gia.tieu_de'), ratings, msg: 'Bạn cần hoàn thành ít nhất 1 đơn đặt bàn để gửi đánh giá.', msgType: 'danger', canRate });
    }

    await engagementService.addRating(req.session.userId, sao, noi_dung);
    const ratings = await engagementService.getAllRatings();
    res.render('rating', { title: res.locals.t('danh_gia.tieu_de'), ratings, msg: 'Cảm ơn bạn đã đánh giá!', msgType: 'success', canRate: true });
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

      // Nguoi vua quet ma QR / bam duong dan cham cong tren dien thoai: dua ho
      // ve DUNG cho ho dinh toi. Uu tien hon ca buoc moi dang ky khuon mat ben
      // duoi, vi trang /cham-cong/ tu no da co phan dang ky ngay trong trang -
      // chen them mot trang nua vao giua chi khien ho lac duong.
      if (tiep) return res.redirect(tiep);

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

app.post('/staff/bookings/confirm/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  try {
    await db.query('UPDATE hopdong SET tinhtrang = 1 WHERE sesis = ?', [req.params.sesis]);
    res.redirect('/staff/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/bookings/arrive/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
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

// --- STAFF KITCHEN ORDERS ---
app.get('/staff/kitchen', requireRole(['Bep', 'Quan ly', 'Phuc vu']), async (req, res) => {
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
    const equipment = await equipmentService.getAllEquipment();
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
    await equipmentService.addEquipment(req.body);
    res.redirect('/staff/kitchen/equipment');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/staff/kitchen/equipment/edit/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await equipmentService.updateEquipment(req.params.id, req.body);
    res.redirect('/staff/kitchen/equipment');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/staff/kitchen/equipment/delete/:id', requireRole(['Bep']), async (req, res) => {
  try {
    await equipmentService.deleteEquipment(req.params.id);
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

app.get('/staff/customers', requireRole(['Quay', 'Thu ngan', 'Quan ly']), async (req, res) => {
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

app.get('/staff/schedule/cancel/:id', requireStaff, async (req, res) => {
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
      await personnelService.changeStaffPassword(req.session.staffId, old_pass, new_pass);
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
      nguyenLieuMon
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

// API lấy chi tiết các món của đơn để xem nhanh
app.get('/staff/bookings/items/:sesis', requireRole(['Phuc vu', 'Quay', 'Quan ly']), async (req, res) => {
  try {
    const sesis = req.params.sesis;
    const [items] = await db.query(
      `SELECT h.id, h.name_mon, h.soluong, h.gia, h.thanhtien, h.trangthai_bep, h.ghi_chu_mon
       FROM hopdong h
       WHERE h.sesis = ? AND h.id_mon > 0
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

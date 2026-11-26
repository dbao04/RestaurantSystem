/**
 * TRO LY AO KIEU "PRENY AI" - bo nao tra loi tu dong 24/7 chay ngay trong Node.
 *
 * Dung truoc mo hinh phan loai y dinh (Python). Thu tu xu ly mot cau hoi:
 *
 *   0. Thiet lap: bot tat? ngoai gio hoat dong? tu cam? khach de lai SDT?
 *   1. KHO KIEN THUC  - cap hoi/dap quan ly nap tay hoac tu file. So khop cau
 *                       khach voi cau hoi + cach hoi khac + tu khoa bang
 *                       TF-IDF (tu don + cap tu) + n-gram ky tu (chiu go sai)
 *                       + tu dong nghia + teencode -> tra loi ca cau "tuong tu".
 *   2. THUC DON       - bat ten mon / ma mon / nguyen lieu / nhom mon / muc gia
 *                       trong cau hoi -> gui the mon kem ANH, gia, mo ta, nut
 *                       them gio. Nho mon vua noi de hieu "mon do bao nhieu".
 *   3. Mo hinh ML     - (o chatbotService) cho so lieu quan ly / y dinh khac.
 *   4. "Co phai ban muon hoi..." - goi y cau gan dung nhat thay vi noi "khong hieu".
 *   5. Khong hieu N lan lien tiep -> tu dong moi gap nhan vien that.
 *
 * Sau cung la lop TINH CACH: thay bien {ten_bot} {hotline}..., doi xung ho
 * (minh-ban / em-anh chi / em-quy khach), bat tat emoji, chon ngau nhien mot
 * trong nhieu cach tra loi, chao theo buoi va theo ten khach.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

// Ket noi RIENG bang utf8mb4: pool chung (config/db) dung 'utf8' 3 byte nen emoji
// 4 byte (🚗 🎂 🍣) luu vao bi vo thanh "������". Cac bang cua tro ly deu la
// utf8mb4; doi pool chung thi co the lam loi bang cu con de utf8 nen tach rieng.
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 4,
  charset: 'utf8mb4',
  typeCast(field, next) {
    if (field.type === 'VAR_STRING' || field.type === 'STRING' || field.type === 'BLOB') {
      const val = field.buffer();
      return val !== null ? val.toString('utf8') : null;
    }
    return next();
  },
});

// ==========================================================================
// THIET LAP
// ==========================================================================
const MAC_DINH = {
  bat: true,
  // Tinh cach
  ten_bot: 'Hana',
  chuc_danh: 'Trực tuyến 24/7',
  avatar: '',
  xung_ho: 'minh_ban',            // minh_ban | em_anhchi | em_quykhach
  dung_emoji: true,
  chao_theo_buoi: true,
  goi_ten_khach: true,
  loi_chao: 'Chào {ten_khach} 👋 Mình là **{ten_bot}** của {ten_nha_hang}. Mình có thể gửi bạn thực đơn kèm hình, báo giá món, hướng dẫn đặt bàn, đặt tiệc hay giao hàng nè. Bạn cần gì cứ nhắn nha!',
  loi_chao_quan_ly: 'Chào {ten_khach}! Bạn đang đăng nhập quyền **quản lý** nên hỏi được cả số liệu kinh doanh (doanh thu, đơn hàng, bàn trống...).',
  tin_khong_hieu: 'Câu này mình chưa chắc lắm 😅 Bạn hỏi lại theo cách khác giúp mình, hoặc để lại **số điện thoại** để nhân viên gọi tư vấn nha!',
  tin_goi_y_gan_dung: 'Mình chưa chắc đã hiểu đúng, có phải bạn muốn hỏi:',
  // Thong tin nha hang dung cho bien thay the
  ten_nha_hang: 'Nhà Hàng Bảo Đoàn',
  hotline: '0825 297 297',
  dia_chi: '12 Nguyễn Văn Bảo, Hạnh Thông, TP. Hồ Chí Minh',
  gio_mo_cua: '10:00 – 22:00',
  email: 'lienhe@nhahangbaodoan.vn',
  wifi: 'hỏi nhân viên phục vụ',
  // Bo nao
  bat_kien_thuc: true,
  nguong_khop: 0.5,
  nguong_goi_y: 0.28,
  bat_tim_mon: true,
  so_mon_toi_da: 6,
  hien_anh_mon: true,
  nut_them_gio: true,
  goi_y_mon_ban_chay: true,
  bat_ml: true,
  bat_tu_khoa: true,              // bat tu khoa: co tu khoa cua chu de la tra loi
  nguong_tu_khoa: 0.6,            // 1 cum tu khoa trung nguyen = 1.0; 1 tu don = 0.75
  tu_hoc: true,                   // tu hoc cau chua tra loi duoc
  nguong_tu_hoc: 0.55,            // du chac -> tu them vao chu de; thap hon -> cho duyet
  nho_ngu_canh: true,
  tu_dong_nghia: [
    'gia | bao nhieu tien | gia bao nhieu | gia ca | gia tien | may tien | het bao nhieu | bnhieu tien',
    'dat ban | book ban | dat cho | giu cho | giu ban | booking | reserve',
    'giao hang | ship | giao tan noi | delivery | giao do an',
    'thuc don | menu | list mon | danh sach mon',
    'khuyen mai | uu dai | giam gia | voucher | promotion | khuyen mai gi',
    'mo cua | gio hoat dong',
    'thanh toan | tra tien',
    'nhan vien | nguoi that | tu van vien',
  ],
  // Giao dien chat
  hieu_ung_go: true,
  toc_do_go: 45,                  // ms / ky tu - nhu nguoi go phim, khong tra loi tuc thi
  go_toi_da_ms: 4500,
  tre_doc_ms: 1000,               // im lang 'doc tin' truoc khi hien dang go
  chia_tin: true,                 // doan van dai tach thanh nhieu bong bong
  chao_chu_dong: true,
  chao_chu_dong_giay: 10,
  chao_chu_dong_noi_dung: 'Chào bạn 👋 Bạn cần mình gửi thực đơn hay giữ bàn tối nay không ạ?',
  hien_goi_y: false,              // nut goi y duoi tin nhan - tat cho giong nguoi that
  goi_y_nhanh: ['Xem thực đơn', 'Món bán chạy nhất', 'Đặt bàn', 'Có khuyến mãi gì không?', 'Giao hàng'],
  hien_nut_goi: true,
  hien_nut_nhan_vien: true,
  luu_lich_su: true,
  cham_diem: true,
  // Gio hoat dong
  gio_hoat_dong: '24_7',          // 24_7 | khung_gio
  gio_bat_dau: '08:00',
  gio_ket_thuc: '22:00',
  tin_ngoai_gio: 'Hiện ngoài giờ trực của trợ lý. Bạn để lại **số điện thoại** và câu hỏi, nhân viên sẽ liên hệ ngay khi nhà hàng mở cửa nha!',
  // Thu thap khach hang
  bat_thu_sdt: true,
  tin_cam_on_sdt: 'Cảm ơn bạn! Mình đã ghi nhận số **{sdt}** 📞 Nhân viên sẽ gọi lại cho bạn trong thời gian sớm nhất nha.',
  bao_nhan_vien_sdt: true,
  tu_dong_chuyen_nv: true,
  so_lan_khong_hieu: 2,
  tin_chuyen_nv: 'Có vẻ câu hỏi này cần nhân viên hỗ trợ trực tiếp. Bạn bấm **Chat với nhân viên** hoặc gọi **{hotline}** nha 🙏',
  // Kiem duyet
  tu_cam: [],
  tin_tu_cam: 'Mình mong cuộc trò chuyện luôn lịch sự và vui vẻ nha 🙏 Mình có thể giúp gì cho bạn ạ?',
};

const KIEU_SO = ['nguong_khop', 'nguong_goi_y', 'nguong_tu_hoc', 'nguong_tu_khoa', 'so_mon_toi_da', 'toc_do_go', 'go_toi_da_ms',
  'chao_chu_dong_giay', 'so_lan_khong_hieu', 'tre_doc_ms'];
const KIEU_BOOL = Object.keys(MAC_DINH).filter((k) => typeof MAC_DINH[k] === 'boolean');
const KIEU_MANG = ['tu_dong_nghia', 'goi_y_nhanh', 'tu_cam'];

let tlCache = null;
let tlLuc = 0;

async function docThietLap() {
  if (tlCache && Date.now() - tlLuc < 15000) return tlCache;
  let luu = {};
  try {
    const [r] = await db.query("SELECT khoa, gia_tri FROM cau_hinh WHERE khoa IN ('chatbot.thiet_lap','chatbot.bat')");
    const dong = Object.fromEntries(r.map((x) => [x.khoa, x.gia_tri]));
    try { luu = JSON.parse(dong['chatbot.thiet_lap'] || '{}') || {}; } catch { luu = {}; }
    if (dong['chatbot.bat'] !== undefined && luu.bat === undefined) luu.bat = String(dong['chatbot.bat']) !== '0';
  } catch { /* bang chua co -> dung mac dinh */ }
  tlCache = chuanHoaThietLap({ ...MAC_DINH, ...luu });
  tlLuc = Date.now();
  return tlCache;
}

function chuanHoaThietLap(o) {
  const kq = { ...MAC_DINH };
  for (const k of Object.keys(MAC_DINH)) {
    if (o[k] === undefined || o[k] === null) continue;
    if (KIEU_BOOL.includes(k)) kq[k] = o[k] === true || o[k] === 1 || o[k] === '1' || o[k] === 'true' || o[k] === 'on';
    else if (KIEU_SO.includes(k)) { const n = Number(o[k]); if (Number.isFinite(n)) kq[k] = n; }
    else if (KIEU_MANG.includes(k)) {
      kq[k] = (Array.isArray(o[k]) ? o[k] : String(o[k]).split(/\r?\n/))
        .map((x) => String(x).trim()).filter(Boolean).slice(0, 200);
    } else kq[k] = String(o[k]).slice(0, 3000);
  }
  kq.nguong_khop = Math.min(0.95, Math.max(0.2, kq.nguong_khop));
  kq.nguong_goi_y = Math.min(kq.nguong_khop, Math.max(0.1, kq.nguong_goi_y));
  kq.nguong_tu_hoc = Math.min(0.95, Math.max(0.2, kq.nguong_tu_hoc));
  kq.nguong_tu_khoa = Math.min(1.5, Math.max(0.3, kq.nguong_tu_khoa));
  kq.so_mon_toi_da = Math.min(12, Math.max(1, Math.round(kq.so_mon_toi_da)));
  kq.so_lan_khong_hieu = Math.min(10, Math.max(1, Math.round(kq.so_lan_khong_hieu)));
  if (!['minh_ban', 'em_anhchi', 'em_quykhach'].includes(kq.xung_ho)) kq.xung_ho = 'minh_ban';
  if (!['24_7', 'khung_gio'].includes(kq.gio_hoat_dong)) kq.gio_hoat_dong = '24_7';
  return kq;
}

async function luuThietLap(moi) {
  const tl = chuanHoaThietLap({ ...(await docThietLap()), ...moi });
  await db.query(
    `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES ('chatbot.thiet_lap', ?, 'Thiet lap tro ly ao (JSON)')
     ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)`, [JSON.stringify(tl)]);
  // Giu khoa cu dong bo: chatbotService.dangBat() va Python van doc khoa nay.
  await db.query(
    `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES ('chatbot.bat', ?, 'Bat/tat chatbot')
     ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)`, [tl.bat ? '1' : '0']);
  tlCache = null;
  boTuDongNghia = null;
  return tl;
}

/** Phan thiet lap an toan de dua ra trinh duyet khach (khong lo tu cam, nguong...). */
async function thietLapCongKhai() {
  const t = await docThietLap();
  return {
    bat: t.bat, ten_bot: t.ten_bot, chuc_danh: t.chuc_danh, avatar: t.avatar || ANH_MAC_DINH,
    hieu_ung_go: t.hieu_ung_go, toc_do_go: t.toc_do_go, go_toi_da_ms: t.go_toi_da_ms, tre_doc_ms: t.tre_doc_ms,
    chia_tin: t.chia_tin, chao_chu_dong: t.chao_chu_dong, chao_chu_dong_giay: t.chao_chu_dong_giay,
    chao_chu_dong_noi_dung: apDung(t.chao_chu_dong_noi_dung, t, {}),
    hien_nut_goi: t.hien_nut_goi, hien_nut_nhan_vien: t.hien_nut_nhan_vien, hien_goi_y: t.hien_goi_y,
    luu_lich_su: t.luu_lich_su, cham_diem: t.cham_diem, nut_them_gio: t.nut_them_gio,
    hotline: t.hotline, hotline_so: soDienThoaiGon(t.hotline),
  };
}

// Anh dai dien mac dinh: co gai mac kimono deo tai nghe (images/tro-ly-ao.svg).
const ANH_MAC_DINH = '/tro-ly-ao.svg';

function soDienThoaiGon(s) { return String(s || '').replace(/[^\d+]/g, ''); }

// ==========================================================================
// CHUAN HOA TIENG VIET
// ==========================================================================
function boDau(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

// Teencode / viet tat pho bien khi chat (da bo dau).
const TEENCODE = {
  k: 'khong', ko: 'khong', kh: 'khong', khg: 'khong', kg: 'khong', hok: 'khong', hong: 'khong', hem: 'khong', hk: 'khong', hn: 'khong', kp: 'khong phai',
  dc: 'duoc', dk: 'duoc', dx: 'duoc', duoc: 'duoc',
  j: 'gi', ji: 'gi', z: 'vay', v: 'vay', zay: 'vay', vs: 'voi', ntn: 'nhu the nao',
  r: 'roi', rui: 'roi', ui: 'oi', nhiu: 'nhieu', bnhieu: 'bao nhieu', bnh: 'bao nhieu', bh: 'bao gio',
  mik: 'minh', mk: 'minh', mjk: 'minh', mn: 'moi nguoi', trc: 'truoc', ng: 'nguoi', nguoi: 'nguoi',
  h: 'gio', hnay: 'hom nay', hqua: 'hom qua', tn: 'tin nhan', sdt: 'so dien thoai', dt: 'dien thoai',
  oke: 'ok', okie: 'ok', okela: 'ok', oki: 'ok', okay: 'ok', thanks: 'cam on', thank: 'cam on', tks: 'cam on', thx: 'cam on',
  ship: 'ship', sp: 'san pham', ad: 'admin', add: 'admin', pk: 'phai khong', ak: 'a', a: 'a',
  menu: 'menu', fb: 'facebook', ib: 'nhan tin', inbox: 'nhan tin', pm: 'nhan tin', cf: 'ca phe',
};

// Tu dem - bo khi tinh tu don (van giu trong cap tu de "giu cho" khong mat nghia).
const TU_DEM = new Set(('a ah ak oi nhe nha nhi vay ha ho giup dum voi minh toi tui em anh chi ban shop admin u ui di cho '
  + 'hoi xin vui long lam on duoc khong co the la thi ma nay do kia nhung cac mot hay hoac ve oi ad quy khach '
  + 'muon can biet xem cai gi sao the nao roi chua dang se da ne nek nhen ah ha a nhe ok').split(/\s+/));

let boTuDongNghia = null;
async function layTuDongNghia() {
  if (boTuDongNghia) return boTuDongNghia;
  const tl = await docThietLap();
  const ds = [];
  for (const dong of tl.tu_dong_nghia || []) {
    const cum = dong.split(/[|,;]/).map((x) => boDau(x).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (cum.length < 2) continue;
    const chuan = cum[0];
    for (const c of cum.slice(1)) if (c !== chuan) ds.push([c, chuan]);
  }
  ds.sort((a, b) => b[0].length - a[0].length);   // cum dai thay truoc
  boTuDongNghia = ds;
  return ds;
}

/** Chuoi -> chuoi khong dau, bo ky tu la, thay teencode + tu dong nghia. */
function chuanHoaCoBan(s) {
  let x = boDau(s).replace(/(\d+)\s*k\b/g, '$1000').replace(/[^a-z0-9 ]+/g, ' ');
  x = x.split(/\s+/).filter(Boolean).map((w) => (TEENCODE[w] !== undefined ? TEENCODE[w] : w)).join(' ');
  // "khongg", "dcccc" -> bo chu lap cuoi do go keo dai
  x = x.replace(/([a-z])\1{2,}/g, '$1');
  return x.trim();
}

function apTuDongNghia(x, ds) {
  let s = ` ${x} `;
  for (const [tu, chuan] of ds) {
    if (s.includes(` ${tu} `)) s = s.split(` ${tu} `).join(` ${chuan} `);
  }
  return s.trim().replace(/\s+/g, ' ');
}

function dacTrung(x) {
  const tu = x.split(' ').filter(Boolean);
  const f = new Map();
  const them = (k, w) => f.set(k, (f.get(k) || 0) + w);
  tu.forEach((w) => { if (!TU_DEM.has(w) && w.length > 0) them(w, 1); });
  for (let i = 0; i < tu.length - 1; i++) {
    if (TU_DEM.has(tu[i]) && TU_DEM.has(tu[i + 1])) continue;
    them(tu[i] + '_' + tu[i + 1], 1.6);
  }
  return f;
}

function trigram(x) {
  const s = x.split(' ').filter((w) => !TU_DEM.has(w)).join(' ');
  const g = new Set();
  const p = `  ${s} `;
  for (let i = 0; i < p.length - 2; i++) g.add(p.slice(i, i + 3));
  return g;
}

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let chung = 0;
  for (const x of a) if (b.has(x)) chung++;
  return (2 * chung) / (a.size + b.size);
}

// ==========================================================================
// KHO KIEN THUC - chi muc trong bo nho
// ==========================================================================
let chiMuc = null;          // { muc: [...], idf: Map, tongTaiLieu }

function tachDanhSach(s, sep) {
  return String(s || '').split(sep).map((x) => x.trim()).filter(Boolean);
}

async function xayChiMuc() {
  const ds = await layTuDongNghia();
  const [rows] = await db.query('SELECT * FROM chatbot_kien_thuc WHERE bat = 1');
  const muc = [];
  const df = new Map();
  let tong = 0;
  for (const r of rows) {
    const cauHoi = [r.cau_hoi, ...tachDanhSach(r.cau_hoi_khac, /\r?\n|\|/)];
    const taiLieu = cauHoi.map((c) => {
      const x = apTuDongNghia(chuanHoaCoBan(c), ds);
      const f = dacTrung(x);
      tong++;
      for (const k of f.keys()) df.set(k, (df.get(k) || 0) + 1);
      return { goc: c, x, f, tri: trigram(x) };
    });
    const tuKhoa = tachDanhSach(r.tu_khoa, /[,;\n]/)
      .map((k) => apTuDongNghia(chuanHoaCoBan(k), ds)).filter((k) => k.length >= 2);
    // Tu khoa cho tang "bat tu khoa": tu khoa nhap tay; chu de chua co tu khoa
    // (vd nap tu file) thi tu rut tu cau hoi chinh: cap tu + tu dai, bo tu dem.
    let kw = [...new Set(tuKhoa)].map((x) => ({ x, toks: x.split(' '), tuDong: false }));
    if (!kw.length) {
      const noiDung = taiLieu[0].x.split(' ').filter((w) => w.length >= 2 && !TU_DEM.has(w));
      const tuDong = new Set();
      for (let i = 0; i < noiDung.length - 1; i++) tuDong.add(noiDung[i] + ' ' + noiDung[i + 1]);
      noiDung.filter((w) => w.length >= 4).forEach((w) => tuDong.add(w));
      kw = [...tuDong].slice(0, 8).map((x) => ({ x, toks: x.split(' '), tuDong: true }));
    }
    // Dang CO DAU cua tung tu trong chu de (lay tu cau hoi + cach hoi khac):
    // tu khoa "tuoi" cua chu de hai san -> {"tươi"}; khach go "tuổi" thi khong khop.
    const dangDau = new Map();
    for (const c of [r.cau_hoi, ...tachDanhSach(r.cau_hoi_khac, /\r?\n|\|/), r.tu_khoa || '']) {
      for (const t of tachTuDau(c, false)) {
        if (t.x === t.d) continue;
        if (!dangDau.has(t.x)) dangDau.set(t.x, new Set());
        dangDau.get(t.x).add(t.d);
      }
    }
    for (const k of kw) k.dau = k.toks.map((w) => dangDau.get(w) || null);
    muc.push({ dong: r, taiLieu, tuKhoa, kw });
  }
  // Do "dac trung" cua tu khoa: tu khoa chi thuoc 1 chu de dang tin hon tu khoa
  // xuat hien o nhieu chu de (vd "mon", "nha hang").
  const dfKw = new Map();
  for (const m of muc) for (const k of new Set(m.kw.map((z) => z.x))) dfKw.set(k, (dfKw.get(k) || 0) + 1);
  const soChuDe = Math.max(2, muc.length);
  for (const m of muc) for (const k of m.kw) k.dacTrung = Math.min(1, Math.log(1 + soChuDe / dfKw.get(k.x)) / Math.log(1 + soChuDe) + 0.25);
  const idf = new Map();
  for (const [k, n] of df) idf.set(k, Math.log(1 + tong / n));
  // Tu khoa 1 chu qua pho bien trong cau hoi ("hang" trong "nha hang", "mon") khong dang tin.
  for (const m of muc) {
    for (const k of m.kw) {
      const chinh = k.toks.filter((w) => !KW_DEM.has(w));
      k.phoBien = chinh.length === 1 ? (df.get(chinh[0]) || 0) / Math.max(1, tong) : 0;
      k.toanHuTu = k.toks.every((w) => TU_DEM.has(w));
    }
  }
  // vector da chuan hoa cho tung tai lieu
  for (const m of muc) for (const t of m.taiLieu) t.v = vecto(t.f, idf);
  chiMuc = { muc, idf, tong };
  return chiMuc;
}

function vecto(f, idf) {
  const v = new Map();
  let chuan = 0;
  for (const [k, tf] of f) {
    const w = tf * (idf.get(k) || Math.log(1 + (chiMuc ? chiMuc.tong : 50)));
    v.set(k, w);
    chuan += w * w;
  }
  chuan = Math.sqrt(chuan) || 1;
  for (const [k, w] of v) v.set(k, w / chuan);
  return v;
}

function cosin(a, b) {
  let s = 0;
  const [nho, lon] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, w] of nho) { const u = lon.get(k); if (u) s += w * u; }
  return s;
}

function lamMoiChiMuc() { chiMuc = null; boTuDongNghia = null; }

// ==========================================================================
// TANG BAT TU KHOA
//
// Khach hoi cau co chua tu khoa cua chu de nao thi tra loi theo chu de do, KHONG
// can giong ca cau. Khop duoc:
//   - nguyen cum lien nhau              "dat ban"  trong "cho minh dat ban toi nay"   -> 1.0
//   - cac tu cua cum nam gan nhau        "dat giup minh 1 ban"                         -> 0.85
//   - cac tu cua cum nam rai rac         "ban nao trong de dat"                        -> 0.6
//   - go sai 1 ky tu (tu tu 4 chu)       "ucaw" ~ "cua", "khuyen mai" ~ "khuyn mai"     -> 0.75
// Cau hoi da qua chuan hoa: bo dau, teencode, tu dong nghia - nen "giu cho",
// "book ban" deu thanh "dat ban" truoc khi so.
// ==========================================================================
function khoangCach1(a, b) {
  // true neu a, b khac nhau toi da 1 phep sua (them / bot / thay / dao 2 ky tu ke nhau)
  if (a === b) return true;
  const la = a.length; const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
// Hu tu bo qua khi so tu khoa (it hon TU_DEM: "ban" = ban/ban, "co", "khong" van giu).
const KW_DEM = new Set('a ah ak oi ui u nhe nha nhi vay ha ho di voi minh toi tui em anh chi shop ad admin la thi ma giup dum'.split(' '));

/**
 * q: tu khach (khong dau), k: tu khoa, dauKhach: dang co dau khach go cho q (Set|undefined),
 * dauKw: cac dang co dau cua tu khoa trong chu de (Set|null).
 */
function tuGiong(q, k, dauKhach, dauKw) {
  if (q === k) {
    // Khach go co dau va chu de biet dang co dau cua tu khoa -> phai trung dau.
    if (dauKhach && dauKhach.size && dauKw && dauKw.size) return [...dauKhach].some((d) => dauKw.has(d));
    return true;
  }
  // Doan go sai chi khi khach go KHONG dau ("ucaw", "khuyn mai"); go co dau coi la go dung.
  if (dauKhach && dauKhach.size) return false;
  return k.length >= 4 && q.length >= 3 && khoangCach1(q, k);
}

function khopTuKhoa(qt, qPad, k, dauKhach) {
  const can = k.toks.map((w, i) => ({ w, dau: k.dau && k.dau[i] })).filter((z) => !KW_DEM.has(z.w));
  if (!can.length) return { s: qPad.includes(` ${k.toks.join(' ')} `) ? 1 : 0, hu: true };
  // Cum nhieu chu bi rut con 1 chu ("nhap ma" -> "nhap", "con minh" -> "con") thi
  // phai trung nguyen cum, khong thi "dang nhap" lai thanh "nhap ma".
  if (can.length === 1 && k.toks.length > 1) {
    return qPad.includes(` ${k.toks.join(' ')} `) ? { s: 1, n: 2 } : { s: 0 };
  }
  const daDung = new Set();
  const viTri = can.map((z) => {
    const i = qt.findIndex((q, j) => !daDung.has(j) && tuGiong(q, z.w, dauKhach.get(q), z.dau));
    if (i >= 0) daDung.add(i);
    return i;
  });
  if (viTri.some((v) => v < 0)) return { s: 0 };
  // Giu thu tu: "viec lam" (tuyen dung) khac "lam viec" (gio mo cua).
  if (viTri.some((v, i) => i > 0 && v < viTri[i - 1])) return { s: 0 };
  const lienNhau = viTri.every((v, i) => i === 0 || v === viTri[i - 1] + 1);
  const dung = can.every((z, i) => qt[viTri[i]] === z.w);
  if (lienNhau && dung) return { s: 1, n: can.length };
  if (can.length === 1) return { s: 0.75, n: 1 };        // mot tu, go sai nhe
  const nhip = Math.max(...viTri) - Math.min(...viTri);
  return { s: nhip <= can.length + 2 ? 0.85 : 0.6, n: can.length };
}

/** Xep chu de theo diem tu khoa. @returns [{muc, diem, tu: [...]}] */
async function timTheoTuKhoa(cauHoi, soLuong = 3) {
  const cm = chiMuc || (await xayChiMuc());
  const ds = await layTuDongNghia();
  const x = apTuDongNghia(chuanHoaCoBan(cauHoi), ds);
  if (!x) return [];
  const qt = x.split(' ');
  const qPad = ` ${x} `;
  // Dang co dau khach da go cho tung tu (de phan biet tuoi/tuoi, quan/quan, dat/dat...)
  const dauKhach = new Map();
  for (const t of tachTuDau(cauHoi)) {
    if (!t.d) continue;
    if (!dauKhach.has(t.x)) dauKhach.set(t.x, new Set());
    dauKhach.get(t.x).add(t.d);
  }
  const kq = [];
  for (const m of cm.muc) {
    let diem = 0;
    const tu = [];
    for (const k of m.kw) {
      const r = khopTuKhoa(qt, qPad, k, dauKhach);
      if (!r.s) continue;
      // Cum nhieu tu dang tin hon tu don; tu khoa toan hu tu ("giup minh") rat nhe.
      const nang = (r.hu || k.toanHuTu ? 0.35 : r.n > 1 ? 1 : 0.75) * (k.tuDong ? 0.75 : 1) * k.dacTrung
        * (k.phoBien > 0.05 ? 0.3 : 1);
      diem += r.s * nang;
      tu.push(k.x);
    }
    if (tu.length) kq.push({ muc: m, diem: Math.min(1.5, diem), tu });
  }
  kq.sort((a, b) => b.diem - a.diem);
  return kq.slice(0, soLuong);
}

/**
 * Tim cap hoi dap gan nhat.
 * @returns {Promise<Array<{muc, diem, khop}>>} da sap xep giam dan
 */
async function timKienThuc(cauHoi, soLuong = 3) {
  const cm = chiMuc || (await xayChiMuc());
  if (!cm.muc.length) return [];
  const ds = await layTuDongNghia();
  const x = apTuDongNghia(chuanHoaCoBan(cauHoi), ds);
  if (!x) return [];
  const qf = dacTrung(x);
  const qv = vecto(qf, cm.idf);
  const qt = trigram(x);
  const qPad = ` ${x} `;
  const soTuNoiDung = x.split(' ').filter((w) => !TU_DEM.has(w)).length;

  const kq = [];
  for (const m of cm.muc) {
    let tot = 0;
    let khop = '';
    for (const t of m.taiLieu) {
      if (t.x === x) { tot = 1; khop = t.goc; break; }
      const c = cosin(qv, t.v);
      const tr = dice(qt, t.tri);
      const d = Math.max(c, 0.55 * c + 0.45 * tr, tr * 0.8);
      if (d > tot) { tot = d; khop = t.goc; }
    }
    // Tu khoa: moi tu khoa xuat hien trong cau -> cong diem. Mot tu khoa
    // nhieu chu ("dat coc") dang tin hon tu khoa mot chu.
    let kw = 0;
    let soTrung = 0;
    for (const k of m.tuKhoa) {
      if (qPad.includes(` ${k} `)) { soTrung++; kw += k.includes(' ') ? 0.55 : 0.4; }
    }
    kw = Math.min(1, kw);
    let diem = tot >= 1 ? 1 : Math.min(1, tot * 0.78 + kw * 0.32 + (soTrung && tot > 0.35 ? 0.06 : 0));
    // Cau qua ngan chi trung tu khoa chung chung -> ha diem cho than trong.
    if (soTuNoiDung === 0 && tot < 0.9) diem *= 0.6;
    diem += Math.min(0.03, (Number(m.dong.uu_tien) || 0) * 0.005);
    if (diem > 0.12) kq.push({ muc: m, diem: Math.min(1, diem), khop });
  }
  kq.sort((a, b) => b.diem - a.diem);
  return kq.slice(0, soLuong);
}

// ==========================================================================
// THUC DON - nhan dien mon trong cau hoi
// ==========================================================================
let menuCache = null;
let menuLuc = 0;

// So khop mon CO TINH DAU: bo dau thi "hoi" (hoi) trung "hoi" (ca hoi), "lau"
// (bao lau) trung "lau" (lau nam)... Moi tu giu hai dang: x = khong dau,
// d = co dau (null neu khach go khong dau). Hai tu bang nhau khi x bang nhau va
// (khach go khong dau HOAC dau trung khop) -> go co dau thi chinh xac, go khong
// dau van tim duoc.
function tachTuDau(s, coTeencode = true) {
  const raw = String(s || '').normalize('NFC').toLowerCase()
    .replace(/(\d+)\s*k\b/g, '$1000').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const out = [];
  for (const w of raw.split(' ').filter(Boolean)) {
    const x = boDau(w);
    if (coTeencode && x === w && TEENCODE[w] !== undefined) {
      TEENCODE[w].split(' ').forEach((p) => out.push({ x: p, d: null }));
      continue;
    }
    out.push({ x: x.replace(/([a-z])\1{2,}/g, '$1'), d: coTeencode ? (x === w ? null : w) : w });
  }
  return out;
}
function bang(q, m) { return q.x === m.x && (q.d === null || q.d === m.d); }
/** Vi tri cum `kim` (tu ten mon/nhom) trong cau khach `qs`, -1 neu khong co. */
function timCum(qs, kim) {
  for (let i = 0; i + kim.length <= qs.length; i++) {
    let ok = true;
    for (let j = 0; j < kim.length; j++) if (!bang(qs[i + j], kim[j])) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}
/** Day tu khach `qsub` co nam lien nhau trong ten mon `ms` khong. */
function trongTen(ms, qsub) {
  for (let i = 0; i + qsub.length <= ms.length; i++) {
    let ok = true;
    for (let j = 0; j < qsub.length; j++) if (!bang(qsub[j], ms[i + j])) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

const NHOM_MON = [
  { tu: ['lẩu', 'hot pot', 'nabe', 'shabu'], loai: /HOT POT/, ten: 'lẩu' },
  { tu: ['bia', 'sake', 'rượu', 'beer', 'đồ có cồn'], loai: /SAKE|BEER/, ten: 'bia & sake' },
  { tu: ['đồ uống', 'nước uống', 'thức uống', 'nước ép', 'nước ngọt', 'drink', 'giải khát', 'trà xanh', 'trà đào', 'trà sữa', 'soda', 'sinh tố', 'nước', 'uống gì'], loai: /DRINK/, ten: 'đồ uống' },
  { tu: ['tráng miệng', 'dessert', 'đồ ngọt', 'bánh ngọt', 'kem', 'mochi'], loai: /DESSERT/, ten: 'tráng miệng' },
  { tu: ['cơm', 'rice', 'cơm chiên', 'donburi'], loai: /^\d+\.\s*RICE$/, ten: 'cơm' },
  { tu: ['mì', 'miến', 'udon', 'ramen', 'soba', 'noodle'], loai: /NOODLE/, ten: 'mì' },
  { tu: ['món nướng', 'nướng', 'grill', 'grilled', 'yakitori'], loai: /GRILLED/, ten: 'món nướng' },
  { tu: ['canh', 'súp', 'soup', 'miso'], loai: /SOUP/, ten: 'súp' },
  { tu: ['tempura', 'chiên giòn', 'chiên xù', 'món chiên', 'đồ chiên'], loai: /TEMPURA/, ten: 'tempura' },
  { tu: ['khai vị', 'ăn vặt', 'appetizer', 'ăn chơi', 'món nhẹ'], loai: /APPE?RTIZER|APPETIZER/, ten: 'khai vị' },
  { tu: ['hàu', 'oyster'], loai: /OYSTER/, ten: 'hàu Nhật' },
  { tu: ['salad', 'gỏi', 'rau trộn'], loai: /SALAD/, ten: 'salad' },
  { tu: ['sashimi', 'cá sống'], loai: /SASHIMI/, ten: 'sashimi' },
  { tu: ['nigiri'], loai: /NIGIRI/, ten: 'nigiri' },
  { tu: ['gunkan'], loai: /GUNKAN/, ten: 'gunkan' },
  { tu: ['maki'], loai: /MAKI/, ten: 'maki' },
  { tu: ['temaki', 'cuốn tay'], loai: /TEMAKI/, ten: 'temaki' },
  { tu: ['cơm cuộn', 'sushi cuộn', 'cuộn', 'roll'], loai: /RICE ROLL/, ten: 'cơm cuộn' },
  { tu: ['sushi'], loai: /NIGIRI|GUNKAN|MAKI|SUSHI|TEMAKI|ROLL/, ten: 'sushi' },
  { tu: ['teppan', 'teppanyaki', 'áp chảo'], loai: /TEPPAN/, ten: 'teppanyaki' },
  { tu: ['món nóng', 'hot dish'], loai: /HOT DISH/, ten: 'món nóng' },
  { tu: ['combo', 'set'], loai: /COMBO/, ten: 'combo' },
].map((n) => ({ ...n, cum: n.tu.map((t) => tachTuDau(t, false)) }));

// Tu khoa nhom cu the: chi lay mon co chu do trong ten ("udon" -> mon udon,
// "lau" -> bo "Mi udon (them)"). Tu chung chung (nuoc, sushi...) giu ca nhom.
const LOC_THEO_TEN = new Set(['udon', 'ramen', 'soba', 'lẩu', 'hàu', 'miso', 'mochi', 'kem', 'nabe', 'yakitori',
  'trà xanh', 'trà đào', 'nước ép', 'sinh tố', 'soda', 'cơm chiên', 'miến', 'tempura', 'súp', 'canh']);

// Tu chi y dinh hoi ve mon - khong dung de khop ten mon. Co dau: so dung dau.
const TU_HOI_MON_DAU = new Set(('món giá bao nhiêu tiền có không ảnh hình xem cho xin gửi ăn ngon thử gọi order đặt mua '
  + 'phần đĩa ly lon chai còn hết bán nhà hàng quán này đó kia gì nào loại một hai ba vài các những '
  + 'photo pic menu thực đơn muốn thích tìm kiếm về mình tôi tui em anh chị bạn ơi ạ nhé nha vậy với là thì '
  + 'được shop ad mấy đâu đi sao thế nữa khác list hỏi cái nhỉ hả à ừ dạ vâng ok luôn đang hôm nay tối trưa '
  + 'sáng giới thiệu cho hông hem nhiêu rồi chưa ngon nhất nên dưới trên khoảng tầm rẻ đắt').split(' '));
const TU_HOI_MON_KD = new Set([...TU_HOI_MON_DAU].map(boDau)
  .filter((w) => !['hoi', 'ca', 'lau', 'tra', 'goi', 'kem', 'com', 'mi'].includes(w))
  .concat(['khong', 'duoc', 'vay', 'roi', 'gi', 'minh', 'oi', 'a', 'voi', 'nhu', 'the', 'nao', 'phai', 'ok']));
function laTuHoi(t) {
  if (/^\d+$/.test(t.x)) return true;
  return t.d ? TU_HOI_MON_DAU.has(t.d) : TU_HOI_MON_KD.has(t.x);
}

const BAN_CHAY = /\b(ban chay|best ?seller|ngon nhat|noi tieng|noi bat|goi y mon|goi y|recommend|nen an gi|nen goi gi|an gi ngon|mon ngon|dac san|signature|duoc yeu thich|yeu thich nhat|hot nhat|mon hot|top mon|mon gi ngon|co gi ngon)\b/;
const HOI_GIA = /\b(gia|bao nhieu|may tien|bnhieu)\b/;
const HOI_CON = /\b(con khong|con mon|het chua|het khong|con ban|co ban|co san)\b/;
const HOI_ANH = /\b(anh|hinh|photo|pic|hinh anh)\b/;
const CHI_MON_TRUOC = /\b(mon nay|mon do|mon kia|mon vua roi|mon tren|mon ay|cai nay|cai do|no)\b/;

function tenHienThi(goc) {
  const bo = String(goc || '').replace(/^\s*[A-Z]{0,5}\d{0,3}[A-Z]?\s*[-–]\s*/, '').trim() || String(goc || '');
  return bo.toLowerCase().replace(/(^|\s|\()(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}
function maMon(goc) {
  const m = String(goc || '').match(/^\s*([A-Z]{0,5}\d{0,3}[A-Z]?)\s*[-–]/);
  return m && m[1] && /[A-Z]/.test(m[1]) ? m[1] : '';
}
function tenTiengAnh(ghiChu) {
  const s = String(ghiChu || '').split('·')[0];
  return s.replace(/^\s*[A-Z]{0,5}\d{0,3}[A-Z]?\s*[-–]\s*/, '').trim();
}
function donVi(ghiChu) {
  const p = String(ghiChu || '').split('·');
  return p.length > 1 ? p[p.length - 1].trim() : 'phần';
}

async function layMenu() {
  if (menuCache && Date.now() - menuLuc < 60000) return menuCache;
  const [rows] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, m.ghichu_mon, m.images, m.tinhtrang, m.id_loai,
            l.name_loai
     FROM monan m LEFT JOIN loai_mon l ON l.id_loai = m.id_loai
     WHERE m.name_mon IS NOT NULL AND m.name_mon <> ''`);
  let banChay = new Map();
  try {
    const [bc] = await db.query(
      `SELECT id_mon, SUM(soluong) AS sl FROM hopdong
       WHERE id_mon > 0 AND tinhtrang = 3 GROUP BY id_mon`);
    banChay = new Map(bc.map((r) => [Number(r.id_mon), Number(r.sl) || 0]));
  } catch { /* bang don co the khac ten tren may khac */ }

  const mon = rows.map((r) => {
    const ten = tenHienThi(r.name_mon);
    const en = tenTiengAnh(r.ghichu_mon);
    const xTen = chuanHoaCoBan(ten);
    const xEn = chuanHoaCoBan(en);
    return {
      id: Number(r.id_mon), goc: r.name_mon, ten, en, ma: maMon(r.name_mon),
      gia: Number(r.gia_mon) || 0, anh: r.images || '', con: Number(r.tinhtrang) === 1,
      id_loai: r.id_loai, loai: loaiVi(r.name_loai).ten, icon: loaiVi(r.name_loai).icon,
      loai_goc: String(r.name_loai || ''), don_vi: donVi(r.ghichu_mon),
      xTen, xEn, qTen: tachTuDau(ten, false), qEn: tachTuDau(en, false),
      ban: banChay.get(Number(r.id_mon)) || 0,
    };
  }).filter((m) => !/^test /i.test(m.loai_goc));

  // IDF tren ten mon: "ca" xuat hien o rat nhieu mon nen it gia tri, "unagi" thi hiem.
  const df = new Map();
  for (const m of mon) for (const w of new Set([...m.qTen, ...m.qEn].map((t) => t.x))) df.set(w, (df.get(w) || 0) + 1);
  const idf = new Map();
  for (const [w, n] of df) idf.set(w, Math.log(1 + mon.length / n));
  menuCache = { mon, idf };
  menuLuc = Date.now();
  return menuCache;
}

function theMon(m) {
  return {
    id: m.id, ten: m.ten, en: m.en, ma: m.ma, gia: m.gia, don_vi: m.don_vi,
    anh: m.anh ? `/food/${m.anh}` : '', loai: m.loai, icon: m.icon, id_loai: m.id_loai, con: m.con,
    link: `/detail?monid=${m.id}`,
  };
}

const LOAI_VI = [
  [/SASHIMI COMBO/, 'Combo sashimi', '🍱'], [/SUSHI COMBO/, 'Combo sushi', '🍱'], [/DRINK/, 'Đồ uống', '🥤'],
  [/APPE?RTIZER/, 'Khai vị', '🥢'], [/SALAD/, 'Salad', '🥗'], [/OYSTER/, 'Hàu Nhật', '🦪'], [/SASHIMI/, 'Sashimi', '🍣'],
  [/GUNKAN/, 'Gunkan', '🍣'], [/NIGIRI/, 'Nigiri', '🍣'], [/TEMAKI/, 'Temaki', '🍣'], [/MAKI/, 'Maki', '🍣'],
  [/RICE ROLL/, 'Cơm cuộn', '🍣'], [/GRILLED/, 'Món nướng', '🔥'], [/TEPPAN/, 'Teppanyaki', '🥩'], [/HOT DISH/, 'Món nóng', '🍲'],
  [/SOUP/, 'Súp', '🍜'], [/NOODLE/, 'Mì', '🍜'], [/HOT POT/, 'Lẩu', '🍲'], [/RICE/, 'Cơm', '🍚'], [/TEMPURA/, 'Tempura', '🍤'],
  [/DESSERT/, 'Tráng miệng', '🍮'], [/SAKE|BEER/, 'Bia & Sake', '🍶'],
];
function loaiVi(goc) {
  const t = LOAI_VI.find(([re]) => re.test(String(goc || '').toUpperCase()));
  return t ? { ten: t[1], icon: t[2] } : { ten: String(goc || '').replace(/^\s*\d+\.\s*/, ''), icon: '🍽️' };
}
// Mon goi them ("Rau lau them", "Mi udon (them)") khong nen dung dau danh sach goi y.
function laMonPhu(m) { return /(^|\s|\()thêm\)?$/i.test(m.ten) || /\(thêm\)/i.test(m.ten); }
function xepGoiY(a, b) { return (laMonPhu(a) - laMonPhu(b)) || (b.ban - a.ban) || (a.gia - b.gia); }

function giaVN(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

function locGia(x) {
  const duoi = x.match(/\b(?:duoi|nho hon|khong qua|toi da|re hon)\s+(\d+)\s*(000|nghin|ngan|k)?\b/);
  const tren = x.match(/\b(?:tren|hon|tu|lon hon)\s+(\d+)\s*(000|nghin|ngan|k)?\b/);
  const doi = (m) => { let n = Number(m[1]); if (m[2] && m[2] !== '000') n *= 1000; else if (!m[2] && n < 1000) n *= 1000; return n; };
  return {
    max: duoi ? doi(duoi) : null,
    min: tren && !duoi ? doi(tren) : null,
    reNhat: /\b(re nhat|gia re|binh dan|tiet kiem|mon re)\b/.test(x),
    datNhat: /\b(dat nhat|cao cap|sang nhat|xin nhat|mac nhat)\b/.test(x),
  };
}

/**
 * Nhan dien mon. Tra ve null neu cau hoi khong lien quan thuc don.
 * @param {string} cauHoi
 * @param {object} nguCanh { mon_truoc: [id...] } luu trong phien
 */
async function timMon(cauHoi, nguCanh = {}, tl = MAC_DINH) {
  const { mon, idf } = await layMenu();
  if (!mon.length) return null;
  const x = chuanHoaCoBan(cauHoi);
  if (!x) return null;
  let qs = tachTuDau(cauHoi);
  // "bao lau" (thoi gian) khong phai "lau"
  qs = qs.filter((t, i) => !(t.x === 'lau' && t.d !== 'lẩu' && qs[i - 1] && qs[i - 1].x === 'bao'));
  const tuNoiDung = qs.filter((t) => !laTuHoi(t));
  const coYMon = /\b(mon|gia|bao nhieu|menu|thuc don|an|goi|order|anh|hinh|co ban|con|ngon)\b/.test(x);
  const gia = locGia(x);
  const toiDa = tl.so_mon_toi_da || 6;
  const conBan = (ds) => ds.filter((m) => m.con);

  // 1) Ma mon: "S12", "n09"
  const theoMa = mon.filter((m) => m.ma && qs.some((t) => t.x === m.ma.toLowerCase()));
  if (theoMa.length) return { kieu: 'chinh_xac', ds: theoMa.slice(0, toiDa), x };

  // 2) Ten mon day du nam trong cau - uu tien ten dai nhat ("sashimi ca hoi" thang "ca hoi").
  const doDai = (m) => Math.max(
    m.qTen.length >= 2 && timCum(qs, m.qTen) >= 0 ? m.qTen.length : 0,
    m.qEn.length >= 2 && m.xEn.length > 5 && timCum(qs, m.qEn) >= 0 ? m.qEn.length : 0);
  const chua = mon.filter((m) => doDai(m) > 0);
  if (chua.length) {
    const daiNhat = Math.max(...chua.map(doDai));
    const tot = chua.filter((m) => doDai(m) === daiNhat);
    return { kieu: tot.length === 1 ? 'chinh_xac' : 'danh_sach', ds: tot.slice(0, toiDa), tong: tot.length, x, tu_khoa: '' };
  }

  // 3) Mon vua noi o luot truoc: "mon do bao nhieu", "con khong", "cho xem anh"
  if (tl.nho_ngu_canh && nguCanh.mon_truoc && nguCanh.mon_truoc.length
      && (CHI_MON_TRUOC.test(x) || (!tuNoiDung.length && (HOI_GIA.test(x) || HOI_CON.test(x) || HOI_ANH.test(x))))) {
    const ds = mon.filter((m) => nguCanh.mon_truoc.includes(m.id));
    if (ds.length) return { kieu: 'ngu_canh', ds: ds.slice(0, toiDa), x };
  }

  // 4) Khop tung tu (nguyen lieu, ten rut gon): "ca hoi", "unagi", "luon"
  const ungVien = [];
  if (tuNoiDung.length) {
    for (const m of mon) {
      const tapTen = [...m.qTen, ...m.qEn];
      const qTrung = tuNoiDung.filter((q) => tapTen.some((t) => bang(q, t)));
      if (!qTrung.length) continue;
      let tongTen = 0; let trung = 0;
      for (const t of m.qTen) { const d = idf.get(t.x) || 1; tongTen += d; if (tuNoiDung.some((q) => bang(q, t))) trung += d; }
      const lienNhau = trongTen(m.qTen, qTrung) || trongTen(m.qEn, qTrung);
      const dTen = tongTen ? trung / tongTen : 0;
      const dQ = qTrung.length / tuNoiDung.length;
      const diem = (0.45 * dTen + 0.55 * dQ) * (lienNhau ? 1 : 0.75);
      if (dQ >= 0.5 && diem >= 0.4) ungVien.push({ m, diem, dQ, qTrung });
    }
    ungVien.sort((a, b) => b.diem - a.diem || b.m.ban - a.m.ban);
  }
  // Mot tu chung chung ("ca", "bo") chua du ket luan khi cau khong hoi ve mon.
  const tuManh = tuNoiDung.some((t) => (idf.get(t.x) || 0) > 1.6);
  const duTinCay = ungVien.length > 0 && (coYMon || ungVien[0].diem >= 0.7 || (tuManh && tuNoiDung.length <= 3));
  const tuKhoa = duTinCay ? ungVien[0].qTrung.map((t) => t.d || t.x).join(' ') : '';

  // 5) Nhom mon: "co mon lau khong", "do uong co gi"
  let nhom = null;
  for (const n of NHOM_MON) if (n.cum.some((c) => timCum(qs, c) >= 0)) { nhom = n; break; }

  if (duTinCay && ungVien[0].diem >= 0.75 && ungVien[0].dQ >= 0.99 && !nhom) {
    const top = ungVien[0].diem;
    const ds = apGia(ungVien.filter((u) => u.diem >= top - 0.12).map((u) => u.m), gia);
    if (ds.length) return { kieu: ds.length === 1 ? 'chinh_xac' : 'danh_sach', ds: ds.slice(0, toiDa), tong: ds.length, x, tu_khoa: tuKhoa };
  }
  if (nhom && (coYMon || tuNoiDung.length <= 3)) {
    let ds = conBan(mon.filter((m) => nhom.loai.test(m.loai_goc)));
    let hepLai = false;
    // "udon" -> chi mon co chu udon; "lau" -> bo "Mi udon (them)" khoi danh sach lau
    const cumKhop = nhom.cum.find((c) => timCum(qs, c) >= 0);
    const tuCum = cumKhop.map((t) => t.d).join(' ');
    const coTen = LOC_THEO_TEN.has(tuCum) ? ds.filter((m) => trongTen(m.qTen, cumKhop) || trongTen(m.qEn, cumKhop)) : [];
    const tenNhom = coTen.length && coTen.length < ds.length ? tuCum : '';
    if (coTen.length) ds = coTen;
    // "lau ca", "com luon": loc tiep theo tu con lai ngoai ten nhom
    const conLai = tuNoiDung.filter((q) => !nhom.cum.some((c) => c.some((t) => bang(q, t))));
    if (conLai.length) {
      const hep = ds.filter((m) => conLai.every((q) => [...m.qTen, ...m.qEn].some((t) => bang(q, t))));
      if (hep.length) { ds = hep; hepLai = true; }
    }
    if (ds.length) {
      ds = apGia(ds.sort(xepGoiY), gia);
      if (ds.length) {
        const tuHep = hepLai ? tuNoiDung.map((t) => t.d || t.x).join(' ') : '';
        return { kieu: hepLai ? 'danh_sach' : 'nhom', ds: ds.slice(0, toiDa), tong: ds.length, nhom, ten_nhom: tenNhom, x, id_loai: ds[0].id_loai, tu_khoa: tuHep };
      }
    }
  }
  if (duTinCay) {
    const ds = apGia(ungVien.map((u) => u.m).sort((a, b) => laMonPhu(a) - laMonPhu(b)), gia);
    if (ds.length) return { kieu: 'danh_sach', ds: ds.slice(0, toiDa), tong: ds.length, x, tu_khoa: tuKhoa };
  }

  // 6) Mon ban chay / goi y - chi lay mon an (do uong chi khi hoi), moi nhom toi da 2 mon cho da dang.
  const hoiDoUong = /\b(uong|nuoc|drink|bia|sake|ruou)\b/.test(x);
  const laDoUong = (m) => /DRINK|SAKE|BEER/.test(m.loai_goc);
  if (tl.goi_y_mon_ban_chay && BAN_CHAY.test(x)) {
    let ds = conBan(mon).filter((m) => m.anh && !laMonPhu(m) && (hoiDoUong || !laDoUong(m)));
    ds = ds.some((m) => m.ban > 0) ? ds.sort((a, b) => b.ban - a.ban || b.gia - a.gia) : ds.sort((a, b) => b.gia - a.gia);
    return { kieu: 'ban_chay', ds: daDang(apGia(ds, gia), toiDa), x };
  }

  // 7) Chi hoi theo muc gia: "mon duoi 100k", "mon re nhat"
  if ((gia.max || gia.reNhat || gia.datNhat) && coYMon) {
    const ds = apGia(conBan(mon).filter((m) => !laMonPhu(m) && (hoiDoUong || !laDoUong(m))).sort(xepGoiY), gia);
    if (ds.length) return { kieu: 'theo_gia', ds: gia.reNhat || gia.datNhat ? ds.slice(0, toiDa) : daDang(ds, toiDa), x };
  }
  return null;
}

/** Lay toi da `n` mon, moi nhom toi da 2 mon - goi y nhin phong phu hon. */
function daDang(ds, n) {
  const dem = new Map();
  const kq = [];
  for (const m of ds) {
    const k = m.id_loai;
    if ((dem.get(k) || 0) >= 2) continue;
    dem.set(k, (dem.get(k) || 0) + 1);
    kq.push(m);
    if (kq.length >= n) break;
  }
  return kq.length ? kq : ds.slice(0, n);
}

/** So lieu thuc don cho bien {so_mon} {gia_thap} {gia_cao}. */
async function thongKeMenu() {
  try {
    const { mon } = await layMenu();
    const ban = mon.filter((m) => m.con && m.gia > 0 && !laMonPhu(m));
    const an = ban.filter((m) => !/DRINK|SAKE|BEER/.test(m.loai_goc));
    return {
      so_mon: ban.length,
      gia_thap: giaVN(Math.min(...ban.map((m) => m.gia))),
      gia_cao: giaVN(Math.max(...ban.map((m) => m.gia))),
      gia_mon_thap: giaVN(Math.min(...an.map((m) => m.gia))),
    };
  } catch { return {}; }
}

function apGia(ds, g) {
  let kq = ds;
  if (g.max) kq = kq.filter((m) => m.gia <= g.max);
  if (g.min) kq = kq.filter((m) => m.gia >= g.min);
  if (g.reNhat) kq = [...kq].sort((a, b) => a.gia - b.gia);
  if (g.datNhat) kq = [...kq].sort((a, b) => b.gia - a.gia);
  return kq;
}

function traLoiMon(kq) {
  const ds = kq.ds;
  const m = ds[0];
  const x = kq.x;
  const lienKet = [];
  let vb;
  if ((kq.kieu === 'chinh_xac' || kq.kieu === 'ngu_canh') && ds.length === 1) {
    if (!m.con) {
      vb = `Dạ món **${m.ten}** hiện đang **tạm hết** ạ 😢 Bạn tham khảo món khác cùng nhóm *${m.loai}* nha!`;
    } else if (HOI_CON.test(x)) {
      vb = `Dạ món **${m.ten}** vẫn **còn phục vụ** ạ ✅ Giá **${giaVN(m.gia)}**/${m.don_vi}.`;
    } else {
      const cauMo = ['', 'Dạ ', 'Món này nè: '][Math.floor(Math.random() * 3)];
      vb = `${cauMo}**${m.ten}**${m.ma ? ` (${m.ma})` : ''} có giá **${giaVN(m.gia)}**/${m.don_vi} ${m.icon || '🍽️'}`
        + (m.en && boDau(m.en) !== boDau(m.ten) ? `\n_${m.en}_` : '')
        + `\nThuộc nhóm **${m.loai}**. Bạn muốn mình thêm vào giỏ hàng luôn không?`;
    }
    lienKet.push({ nhan: 'Xem chi tiết món', url: `/detail?monid=${m.id}` });
  } else if (kq.kieu === 'nhom') {
    vb = kq.tong > ds.length
      ? `Nhà hàng có **${kq.tong} món ${kq.ten_nhom || kq.nhom.ten}** nè 👇 Đây là ${ds.length} món được gọi nhiều nhất:`
      : `Nhà hàng có **${kq.tong} món ${kq.ten_nhom || kq.nhom.ten}** nè 👇`;
    lienKet.push({ nhan: `Xem tất cả món ${kq.nhom.ten}`, url: `/menu?id_loai=${kq.id_loai}` });
  } else if (kq.kieu === 'ban_chay') {
    vb = 'Đây là những món được khách yêu thích nhất ở nhà hàng nè 🔥 Bạn bấm vào hình để xem chi tiết nha:';
    lienKet.push({ nhan: 'Xem toàn bộ thực đơn', url: '/menu' });
  } else if (kq.kieu === 'theo_gia') {
    vb = `Mình lọc được mấy món hợp túi tiền của bạn nè 💰:`;
    lienKet.push({ nhan: 'Xem toàn bộ thực đơn', url: '/menu' });
  } else {
    const tk = kq.tu_khoa ? ` **${kq.tu_khoa}**` : '';
    vb = ds.length === 1
      ? `Bạn đang tìm món này phải không ạ? 👇`
      : `Mình tìm được ${kq.tong && kq.tong > ds.length ? kq.tong : ds.length} món${tk} cho bạn nè 👇`;
    lienKet.push({ nhan: 'Xem toàn bộ thực đơn', url: '/menu' });
  }
  const goiY = ds.length === 1
    ? ['Món bán chạy nhất', 'Đặt bàn', 'Giao hàng có mất phí không?']
    : ['Món bán chạy nhất', 'Món dưới 100k', 'Đặt bàn'];
  return { van_ban: vb, mon: ds.map(theMon), lien_ket: lienKet, goi_y: goiY };
}

// ==========================================================================
// TINH CACH - bien thay the, xung ho, emoji
// ==========================================================================
function chonNgauNhien(traLoi) {
  const ds = String(traLoi || '').split('||').map((x) => x.trim()).filter(Boolean);
  return ds.length ? ds[Math.floor(Math.random() * ds.length)] : '';
}

function buoi() {
  const h = new Date().getHours();
  if (h < 11) return 'buổi sáng';
  if (h < 14) return 'buổi trưa';
  if (h < 18) return 'buổi chiều';
  return 'buổi tối';
}

function tenGoi(hoTen) {
  const p = String(hoTen || '').trim().split(/\s+/).filter(Boolean);
  return p.length ? p[p.length - 1] : '';
}

function apDung(vb, tl, ctx = {}) {
  let s = String(vb || '');
  const ten = tl.goi_ten_khach && ctx.ten_khach ? tenGoi(ctx.ten_khach) : '';
  const bien = {
    ten_bot: tl.ten_bot, ten_nha_hang: tl.ten_nha_hang, hotline: tl.hotline,
    hotline_so: soDienThoaiGon(tl.hotline), dia_chi: tl.dia_chi, gio_mo_cua: tl.gio_mo_cua,
    email: tl.email, wifi: tl.wifi, buoi: buoi(), sdt: ctx.sdt || '',
    ...(ctx.menuTk || {}),
    ten_khach: ten ? `bạn ${ten}` : 'bạn',
  };
  s = s.replace(/\{(\w+)\}/g, (m, k) => (bien[k] !== undefined ? bien[k] : m));
  // "Chao ban" lap lai -> "Chao ban" (khi ten_khach = "ban" va cau goc da co "ban")
  s = s.replace(/\bbạn bạn\b/g, 'bạn');
  s = doiXungHo(s, tl.xung_ho);
  if (!tl.dung_emoji) s = boEmoji(s);
  return s;
}

function doiXungHo(s, kieu) {
  if (kieu === 'minh_ban') return s;
  const khach = kieu === 'em_quykhach' ? 'quý khách' : 'anh/chị';
  const Khach = kieu === 'em_quykhach' ? 'Quý khách' : 'Anh/chị';
  const bien = (re, thay) => { s = s.replace(re, thay); };
  bien(/(?<![\p{L}])mình(?![\p{L}])/gu, 'em');
  bien(/(?<![\p{L}])Mình(?![\p{L}])/gu, 'Em');
  bien(/(?<![\p{L}])bạn(?![\p{L}])/gu, khach);
  bien(/(?<![\p{L}])Bạn(?![\p{L}])/gu, Khach);
  // "anh/chị Bao" -> giu nguyen; "em xin chao anh/chi" ok.
  return s;
}

function boEmoji(s) {
  return s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu, '').replace(/ {2,}/g, ' ').replace(/ +\n/g, '\n').trim();
}

function trongGioHoatDong(tl) {
  if (tl.gio_hoat_dong !== 'khung_gio') return true;
  const p = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  const a = p(tl.gio_bat_dau); const b = p(tl.gio_ket_thuc);
  return a <= b ? now >= a && now < b : now >= a || now < b;
}

function timSoDienThoai(s) {
  const m = String(s || '').match(/(?:\+?84|0)(?:[\s.\-]?\d){8,10}/);
  if (!m) return null;
  let so = m[0].replace(/[^\d+]/g, '');
  if (so.startsWith('+84')) so = '0' + so.slice(3);
  else if (so.startsWith('84') && so.length >= 11) so = '0' + so.slice(2);
  return /^0\d{9,10}$/.test(so) ? so : null;
}

function lienKetTuChuoi(s, tl) {
  return tachDanhSach(s, /;|\n/).map((p) => {
    const [nhan, url] = p.split('|').map((x) => (x || '').trim());
    if (!nhan || !url) return null;
    return { nhan, url: url.replace('{hotline_so}', soDienThoaiGon(tl.hotline)) };
  }).filter(Boolean);
}

// ==========================================================================
// DIEM VAO: tra loi mot cau
// ==========================================================================
/**
 * @param {string} cauHoi
 * @param {object} ctx { quyen, ten_khach, id_kh, nguCanh (session object), phien }
 * @returns {Promise<object|null>} phan hoi hoac null de nhuong cho ML
 *   Them `_goi_y_gan_dung` de chatbotService dung khi ML cung khong hieu.
 */
async function traLoi(cauHoi, ctx = {}) {
  const tl = await docThietLap();
  const nc = ctx.nguCanh || {};
  ctx = { ...ctx, menuTk: await thongKeMenu() };
  const x = chuanHoaCoBan(cauHoi);
  const xong = (o, nguon, extra = {}) => ({ ...o, nguon, ...extra });

  // 0a) Tu cam
  if (tl.tu_cam.length) {
    const pad = ` ${x} `;
    if (tl.tu_cam.some((t) => { const k = chuanHoaCoBan(t); return k && pad.includes(` ${k} `); })) {
      return xong({ van_ban: apDung(tl.tin_tu_cam, tl, ctx), y_dinh: 'tu_cam' }, 'tu_cam');
    }
  }

  // 0b) Khach de lai so dien thoai
  const noiBo = ctx.kenh === 'noi_bo';
  if (tl.bat_thu_sdt && !noiBo) {
    const sdt = timSoDienThoai(cauHoi);
    if (sdt) {
      await luuLienHe(sdt, cauHoi, ctx, tl).catch(() => {});
      return xong({ van_ban: apDung(tl.tin_cam_on_sdt, tl, { ...ctx, sdt }), y_dinh: 'de_lai_sdt', goi_y: ['Xem thực đơn', 'Đặt bàn'] }, 'lien_he');
    }
  }

  // 0c) Ngoai gio hoat dong
  if (!trongGioHoatDong(tl) && !noiBo) {
    return xong({ van_ban: apDung(tl.tin_ngoai_gio, tl, ctx), y_dinh: 'ngoai_gio', chuyen_nhan_vien: true }, 'ngoai_gio');
  }

  // 1) Kho kien thuc + 2) thuc don - tinh ca hai roi chon.
  const [kt, mon] = await Promise.all([
    tl.bat_kien_thuc ? timKienThuc(cauHoi, 4).catch((e) => { console.error('[chatbot] kho kien thuc:', e.message); return []; }) : [],
    tl.bat_tim_mon ? timMon(cauHoi, nc, tl).catch((e) => { console.error('[chatbot] tim mon:', e.message); return null; }) : null,
  ]);
  const top = kt[0];
  // "ban chay" bo dau trung "chay" -> mon ban chay / ten mon chinh xac thang kho kien thuc.
  const monChac = mon && ['chinh_xac', 'ngu_canh', 'ban_chay'].includes(mon.kieu);

  if (top && top.diem >= tl.nguong_khop && !(monChac && top.diem < 0.9) && !(mon && top.diem < 0.62)) {
    const d = top.muc.dong;
    db.query('UPDATE chatbot_kien_thuc SET so_lan_dung = so_lan_dung + 1 WHERE id = ?', [d.id]).catch(() => {});
    const o = {
      van_ban: apDung(chonNgauNhien(d.tra_loi), tl, ctx),
      y_dinh: `kt:${d.nhom}`,
      tin_cay: Number(top.diem.toFixed(4)),
      id_kien_thuc: d.id,
      goi_y: tachDanhSach(d.goi_y, '|').slice(0, 4),
      lien_ket: lienKetTuChuoi(d.lien_ket, tl),
      anh: d.anh || '',
      _khop: top.khop,
    };
    return xong(o, 'kien_thuc');
  }

  const traLoiMonNgay = () => {
    const o = traLoiMon(mon);
    o.van_ban = apDung(o.van_ban, tl, ctx);
    if (!tl.hien_anh_mon) o.mon = o.mon.map((m) => ({ ...m, anh: '' }));
    return xong({ ...o, y_dinh: `mon:${mon.kieu}`, tin_cay: 1, _mon_ids: mon.ds.map((m) => m.id) }, 'thuc_don');
  };
  // Ten mon chinh xac / mon vua noi / mon ban chay: tra loi bang thuc don truoc.
  if (monChac && mon.ds.length) return traLoiMonNgay();

  // 1b) BAT TU KHOA: cau co tu khoa cua chu de -> tra loi du khong giong ca cau.
  let kw = [];
  if (tl.bat_kien_thuc && tl.bat_tu_khoa) {
    kw = await timTheoTuKhoa(cauHoi, 4).catch((e) => { console.error('[chatbot] tu khoa:', e.message); return []; });
    const dat = kw.filter((k) => k.diem >= tl.nguong_tu_khoa);
    if (dat.length) {
      // Nhieu chu de cung trung tu khoa ngang nhau -> chon chu de giong cau nhat;
      // khong phan dinh duoc thi hoi lai (goi y gan dung) thay vi doan bua.
      const diemCau = new Map(kt.map((k) => [k.muc.dong.id, k.diem]));
      const sat = dat.filter((k) => k.diem >= dat[0].diem - 0.15);
      sat.sort((a, b) => (diemCau.get(b.muc.dong.id) || 0) - (diemCau.get(a.muc.dong.id) || 0) || b.diem - a.diem);
      const chon = sat[0];
      const roRang = sat.length === 1 || (diemCau.get(chon.muc.dong.id) || 0) - (diemCau.get(sat[1].muc.dong.id) || 0) >= 0.08;
      if (roRang) {
        const d = chon.muc.dong;
        db.query('UPDATE chatbot_kien_thuc SET so_lan_dung = so_lan_dung + 1 WHERE id = ?', [d.id]).catch(() => {});
        return xong({
          van_ban: apDung(chonNgauNhien(d.tra_loi), tl, ctx),
          y_dinh: `kt:${d.nhom}`,
          tin_cay: Number(Math.min(1, Math.max(chon.diem, diemCau.get(d.id) || 0)).toFixed(4)),
          id_kien_thuc: d.id,
          goi_y: tachDanhSach(d.goi_y, '|').slice(0, 4),
          lien_ket: lienKetTuChuoi(d.lien_ket, tl),
          anh: d.anh || '',
          tu_khoa_khop: chon.tu,
          _khop: `từ khóa: ${chon.tu.join(', ')}`,
        }, 'kien_thuc');
      }
    }
  }

  if (mon && mon.ds.length) return traLoiMonNgay();

  // Khong du chac: de ML thu, kem goi y gan dung (giong cau + trung tu khoa) de dung neu ML cung bo tay.
  const daCo = new Set();
  const ganDung = [...kt.filter((k) => k.diem >= tl.nguong_goi_y), ...kw.filter((k) => k.diem >= tl.nguong_tu_khoa * 0.6)]
    .filter((k) => !daCo.has(k.muc.dong.id) && daCo.add(k.muc.dong.id)).slice(0, 3)
    .map((k) => ({ cau_hoi: k.muc.dong.cau_hoi, nhan: k.muc.dong.cau_hoi, diem: k.diem }));
  return { _chua_tra_loi: true, _goi_y_gan_dung: ganDung };
}

/** Cau tra loi cuoi cung khi khong nguon nao hieu. */
async function traLoiKhongHieu(ctx, ganDung = [], soLanKhongHieu = 1) {
  const tl = await docThietLap();
  // Tro ly noi bo: noi chuyen voi nhan vien, khong moi de lai SDT / goi hotline.
  if (ctx.kenh === 'noi_bo') {
    const goiY = ganDung.length ? ` Có phải bạn muốn hỏi **${String(ganDung[0].nhan).replace(/\?+\s*$/, '')}**?` : '';
    return {
      van_ban: apDung(`Câu này mình chưa có dữ liệu để trả lời.${goiY} Số liệu chi tiết bạn xem ở các trang **Báo cáo / Phân tích** trong hệ thống nha.`, tl, ctx),
      y_dinh: 'khong_hieu', khong_hieu: true, nguon: 'khong_hieu', goi_y: ganDung.map((g) => ({ cau_hoi: g.cau_hoi, nhan: g.nhan })),
    };
  }
  if (ganDung.length && !tl.hien_goi_y) {
    // Khong hien nut: hoi lai bang loi nhu nguoi that.
    const ds = ganDung.slice(0, 2).map((g) => `**${String(g.nhan).replace(/\?+\s*$/, '')}**`);
    const cau = ds.length === 2 ? `${ds[0]} hay ${ds[1]}` : ds[0];
    return {
      van_ban: apDung(`Ý bạn là ${cau} phải không ạ? Bạn nói rõ hơn một chút để mình trả lời đúng nha 😊`, tl, ctx),
      y_dinh: 'goi_y_gan_dung', nguon: 'goi_y',
    };
  }
  if (ganDung.length) {
    return {
      van_ban: apDung(tl.tin_goi_y_gan_dung, tl, ctx), y_dinh: 'goi_y_gan_dung',
      goi_y: ganDung.map((g) => ({ cau_hoi: g.cau_hoi, nhan: g.nhan })), nguon: 'goi_y',
    };
  }
  const chuyen = tl.tu_dong_chuyen_nv && soLanKhongHieu >= tl.so_lan_khong_hieu;
  return {
    van_ban: apDung(chuyen ? tl.tin_chuyen_nv : tl.tin_khong_hieu, tl, ctx),
    y_dinh: 'khong_hieu', khong_hieu: true, nguon: 'khong_hieu',
    chuyen_nhan_vien: chuyen,
    goi_y: chuyen || !tl.hien_goi_y ? [] : tl.goi_y_nhanh.slice(0, 4),
  };
}

async function loiChao(ctx) {
  const tl = await docThietLap();
  const goc = ctx.quyen === 'quan_ly' ? tl.loi_chao_quan_ly : tl.loi_chao;
  ctx = { ...ctx, menuTk: await thongKeMenu() };
  let vb = apDung(goc, tl, ctx);
  if (tl.chao_theo_buoi && ctx.quyen !== 'quan_ly') {
    const tienTo = { 'buổi sáng': 'Chúc bạn buổi sáng tốt lành ☀️', 'buổi trưa': 'Trưa nay bạn ăn gì chưa nè? 🍱', 'buổi chiều': 'Chiều vui vẻ nha 🌤️', 'buổi tối': 'Tối nay đi ăn sushi không bạn? 🌙' }[buoi()];
    vb += '\n\n' + apDung(tienTo, tl, ctx);
  }
  return vb;
}

async function luuLienHe(sdt, noiDung, ctx, tl) {
  await db.query(
    'INSERT INTO chatbot_lien_he (sdt, ten, noi_dung, id_kh, phien) VALUES (?, ?, ?, ?, ?)',
    [sdt, ctx.ten_khach || null, String(noiDung).slice(0, 1000), ctx.id_kh || null, ctx.phien || null]);
  if (tl.bao_nhan_vien_sdt) {
    try {
      require('./thongBaoService').guiNen('CHATBOT_DE_LAI_SDT', {
        nhom: ['QUAN_LY', 'LE_TAN'], quanTri: true, mucDo: 'quan_trong',
        tieuDe: `Khách để lại SĐT qua trợ lý ảo: ${sdt}`,
        noiDung: String(noiDung).slice(0, 300), link: '/admin/chatbot?tab=lien-he', nguoiGui: tl.ten_bot,
      });
    } catch { /* thong bao loi khong anh huong khach */ }
  }
}

// ==========================================================================
// NHAT KY
// ==========================================================================
async function ghiNhatKy(o) {
  try {
    const [kq] = await db.query(
      `INSERT INTO chatbot_hoi_thoai (cau_hoi, y_dinh, tin_cay, quyen, id_kh, id_nv, thoi_gian_ms,
         khong_hieu, tham_so, nguon, id_kien_thuc, tra_loi, phien)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [String(o.cau_hoi || '').slice(0, 500), o.y_dinh || null, o.tin_cay == null ? null : o.tin_cay,
        o.quyen || null, o.id_kh || null, o.id_nv || null, o.thoi_gian_ms || null, o.khong_hieu ? 1 : 0,
        o.tham_so ? String(o.tham_so).slice(0, 500) : null, o.nguon || null, o.id_kien_thuc || null,
        o.tra_loi ? String(o.tra_loi).slice(0, 1500) : null, o.phien || null]);
    return kq.insertId;
  } catch {
    // Chua chay migration 049 -> ghi kieu cu.
    try {
      const [kq] = await db.query(
        'INSERT INTO chatbot_hoi_thoai (cau_hoi, y_dinh, tin_cay, quyen, id_kh, id_nv, thoi_gian_ms, khong_hieu) VALUES (?,?,?,?,?,?,?,?)',
        [String(o.cau_hoi || '').slice(0, 500), o.y_dinh || null, o.tin_cay == null ? null : o.tin_cay, o.quyen || null,
          o.id_kh || null, o.id_nv || null, o.thoi_gian_ms || null, o.khong_hieu ? 1 : 0]);
      return kq.insertId;
    } catch { return null; }
  }
}

async function capNhatNhatKyML(id, o) {
  if (!id) return;
  db.query('UPDATE chatbot_hoi_thoai SET nguon = ?, tra_loi = ?, phien = ? WHERE id = ?',
    [o.nguon || 'ml', String(o.tra_loi || '').slice(0, 1500), o.phien || null, id]).catch(() => {});
}

// ==========================================================================
// QUAN LY KHO KIEN THUC
// ==========================================================================
const COT_KT = ['nhom', 'cau_hoi', 'cau_hoi_khac', 'tu_khoa', 'tra_loi', 'goi_y', 'lien_ket', 'anh', 'uu_tien', 'bat'];

function sachDong(o) {
  const d = {};
  d.nhom = (boDau(o.nhom || 'khac').replace(/[^a-z0-9_ ]/g, '').trim().replace(/\s+/g, '_') || 'khac').slice(0, 60);
  d.cau_hoi = String(o.cau_hoi || '').trim().slice(0, 500);
  d.cau_hoi_khac = (Array.isArray(o.cau_hoi_khac) ? o.cau_hoi_khac.join('\n') : String(o.cau_hoi_khac || ''))
    .split(/\r?\n|\|/).map((x) => x.trim()).filter(Boolean).join('\n').slice(0, 8000);
  d.tu_khoa = String(o.tu_khoa || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).join(', ').slice(0, 500);
  d.tra_loi = String(o.tra_loi || '').trim().slice(0, 8000);
  d.goi_y = String(o.goi_y || '').split(/\||\n/).map((x) => x.trim()).filter(Boolean).join('|').slice(0, 500);
  d.lien_ket = String(o.lien_ket || '').trim().slice(0, 500);
  d.anh = String(o.anh || '').trim().slice(0, 300);
  d.uu_tien = Math.max(-10, Math.min(10, Math.round(Number(o.uu_tien) || 0)));
  d.bat = (o.bat === undefined || o.bat === '') ? 1
    : (o.bat === true || o.bat === 1 || /^(1|on|true|co|có|x|bat|bật)$/i.test(String(o.bat).trim())) ? 1 : 0;
  return d;
}

async function danhSach({ q = '', nhom = '', trang = 1, moiTrang = 30 } = {}) {
  const dk = [];
  const ts = [];
  if (nhom) { dk.push('nhom = ?'); ts.push(nhom); }
  if (q) {
    dk.push('(cau_hoi LIKE ? OR cau_hoi_khac LIKE ? OR tu_khoa LIKE ? OR tra_loi LIKE ?)');
    const l = `%${q}%`; ts.push(l, l, l, l);
  }
  const where = dk.length ? `WHERE ${dk.join(' AND ')}` : '';
  const [[{ tong }]] = await db.query(`SELECT COUNT(*) AS tong FROM chatbot_kien_thuc ${where}`, ts);
  const [rows] = await db.query(
    `SELECT * FROM chatbot_kien_thuc ${where} ORDER BY uu_tien DESC, nhom, id DESC LIMIT ? OFFSET ?`,
    [...ts, moiTrang, (Math.max(1, trang) - 1) * moiTrang]);
  const [nhoms] = await db.query('SELECT nhom, COUNT(*) AS n FROM chatbot_kien_thuc GROUP BY nhom ORDER BY n DESC');
  return { tong: Number(tong), trang, moiTrang, rows, nhoms };
}

async function them(o, nguon = 'tay') {
  const d = sachDong(o);
  if (d.cau_hoi.length < 2 || d.tra_loi.length < 1) {
    const e = new Error('Cần nhập câu hỏi và câu trả lời.'); e.status = 400; throw e;
  }
  const [kq] = await db.query(
    `INSERT INTO chatbot_kien_thuc (${COT_KT.join(',')}, nguon) VALUES (${COT_KT.map(() => '?').join(',')}, ?)`,
    [...COT_KT.map((k) => d[k]), nguon]);
  lamMoiChiMuc();
  return kq.insertId;
}

async function sua(id, o) {
  const d = sachDong(o);
  if (d.cau_hoi.length < 2 || d.tra_loi.length < 1) {
    const e = new Error('Cần nhập câu hỏi và câu trả lời.'); e.status = 400; throw e;
  }
  await db.query(`UPDATE chatbot_kien_thuc SET ${COT_KT.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    [...COT_KT.map((k) => d[k]), id]);
  lamMoiChiMuc();
}

async function xoa(ids) {
  const ds = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  if (!ds.length) return 0;
  const [kq] = await db.query('DELETE FROM chatbot_kien_thuc WHERE id IN (?)', [ds]);
  lamMoiChiMuc();
  return kq.affectedRows;
}

async function batTat(id, bat) {
  await db.query('UPDATE chatbot_kien_thuc SET bat = ? WHERE id = ?', [bat ? 1 : 0, id]);
  lamMoiChiMuc();
}

/**
 * Ghi nhieu dong (tu file). Trung cau hoi (so sau khi chuan hoa) -> cap nhat.
 * @param {'them'|'thay'} cheDo  thay = xoa toan bo kho truoc khi nap
 */
async function napNhieu(dsDong, { cheDo = 'them', nguon = 'file' } = {}) {
  const sach = dsDong.map(sachDong).filter((d) => d.cau_hoi.length >= 2 && d.tra_loi);
  if (cheDo === 'thay') await db.query('DELETE FROM chatbot_kien_thuc');
  const [coSan] = await db.query('SELECT id, cau_hoi FROM chatbot_kien_thuc');
  const theoCau = new Map(coSan.map((r) => [chuanHoaCoBan(r.cau_hoi), r.id]));
  let themMoi = 0; let capNhat = 0;
  for (const d of sach) {
    const khoa = chuanHoaCoBan(d.cau_hoi);
    const id = theoCau.get(khoa);
    if (id) {
      await db.query(`UPDATE chatbot_kien_thuc SET ${COT_KT.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
        [...COT_KT.map((k) => d[k]), id]);
      capNhat++;
    } else {
      const [kq] = await db.query(
        `INSERT INTO chatbot_kien_thuc (${COT_KT.join(',')}, nguon) VALUES (${COT_KT.map(() => '?').join(',')}, ?)`,
        [...COT_KT.map((k) => d[k]), nguon]);
      theoCau.set(khoa, kq.insertId);
      themMoi++;
    }
  }
  lamMoiChiMuc();
  return { them: themMoi, cap_nhat: capNhat, bo_qua: dsDong.length - sach.length };
}

async function napBoMau() {
  const MAU = require('../config/chatbot-kien-thuc-mau');
  const ds = MAU.map(([nhom, cau_hoi, khac, tu_khoa, tra_loi, goi_y, lien_ket], i) => ({
    nhom, cau_hoi, cau_hoi_khac: khac.join('\n'), tu_khoa, tra_loi, goi_y, lien_ket, uu_tien: 0, bat: 1,
  }));
  return napNhieu(ds, { cheDo: 'them', nguon: 'mau' });
}

// ---------------------------------------------------------------- doc file
const TEN_COT = {
  cau_hoi: /^(cau hoi|cau hoi chinh|question|hoi|q|khach hoi)$/,
  tra_loi: /^(tra loi|cau tra loi|answer|dap|a|bot tra loi|phan hoi)$/,
  cau_hoi_khac: /^(cach hoi khac|cau hoi khac|bien the|cau tuong tu|variants?|cach hoi)$/,
  tu_khoa: /^(tu khoa|keywords?|key ?words?|tag)$/,
  nhom: /^(nhom|chu de|danh muc|category|group|topic)$/,
  goi_y: /^(goi y|goi y tiep|cau goi y|suggestions?)$/,
  lien_ket: /^(lien ket|link|links|nut|buttons?)$/,
  anh: /^(anh|hinh|image|hinh anh|anh dinh kem)$/,
  uu_tien: /^(uu tien|priority)$/,
  bat: /^(bat|kich hoat|active|enabled?)$/,
};

function anhXaCot(tieuDe) {
  const map = {};
  tieuDe.forEach((h, i) => {
    // "Cau hoi (moi dong 1 cau)" -> "cau hoi": bo phan chu thich trong ngoac
    const k = boDau(h).replace(/\([^)]*\)/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [cot, re] of Object.entries(TEN_COT)) if (!(cot in map) && re.test(k)) map[cot] = i;
  });
  return map;
}

function bangThanhDong(bang) {
  const rows = bang.filter((r) => r && r.some((c) => String(c ?? '').trim()));
  if (!rows.length) return [];
  let map = anhXaCot(rows[0].map((c) => String(c ?? '')));
  let batDau = 1;
  if (map.cau_hoi === undefined || map.tra_loi === undefined) { map = { cau_hoi: 0, tra_loi: 1 }; batDau = 0; }
  return rows.slice(batDau).map((r) => {
    const o = {};
    for (const [cot, i] of Object.entries(map)) o[cot] = String(r[i] ?? '').trim();
    return o;
  }).filter((o) => o.cau_hoi && o.tra_loi);
}

function vanBanThanhDong(txt) {
  const dong = String(txt || '').replace(/\r/g, '').split('\n');
  const kq = [];
  let cur = null; let dang = null;
  const day = () => { if (cur && cur.cau_hoi && cur.tra_loi) kq.push(cur); cur = null; dang = null; };
  const reQ = /^\s*(?:q|h|hỏi|hoi|câu hỏi|cau hoi|question|khách|khach)\s*[:：.\-)]\s*(.*)$/i;
  const reA = /^\s*(?:a|đ|d|đáp|dap|trả lời|tra loi|answer|bot|tl)\s*[:：.\-)]\s*(.*)$/i;
  const reK = /^\s*(?:từ khóa|tu khoa|keywords?|tk)\s*[:：]\s*(.*)$/i;
  for (const l of dong) {
    let m;
    if ((m = l.match(reQ))) { day(); cur = { cau_hoi: m[1].trim(), tra_loi: '' }; dang = 'q'; continue; }
    if (cur && (m = l.match(reA))) { cur.tra_loi = m[1].trim(); dang = 'a'; continue; }
    if (cur && (m = l.match(reK))) { cur.tu_khoa = m[1].trim(); continue; }
    if (!l.trim()) { if (dang === 'a') day(); continue; }
    if (cur && dang === 'a') cur.tra_loi += '\n' + l.trim();
    else if (cur && dang === 'q') cur.cau_hoi += ' ' + l.trim();
    else {
      // Dang "cau hoi | tra loi" hoac "cau hoi<TAB>tra loi" tren mot dong
      const p = l.split(/\t| \| /);
      if (p.length >= 2) kq.push({ cau_hoi: p[0].trim(), tra_loi: p.slice(1).join(' ').trim() });
    }
  }
  day();
  return kq;
}

async function docDocx(buf) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  const giai = (s) => s.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  // Bang 2+ cot -> moi hang mot cap hoi dap
  const bang = [];
  for (const tbl of xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || []) {
    for (const tr of tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []) {
      const o = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map((tc) =>
        (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(giai).join('\n').trim());
      bang.push(o);
    }
  }
  const tuBang = bang.length ? bangThanhDong(bang) : [];
  const khongBang = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, '');
  const vb = (khongBang.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(giai).join('\n');
  return [...tuBang, ...vanBanThanhDong(vb)];
}

/** Doc file nguoi dung tai len -> mang {cau_hoi, tra_loi, ...}. */
async function docFile(buf, tenFile) {
  const duoi = String(tenFile || '').toLowerCase().split('.').pop();
  if (['xlsx', 'xls', 'xlsm', 'ods', 'csv'].includes(duoi)) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buf, { type: 'buffer', codepage: 65001 });
    let tatCa = [];
    for (const ten of wb.SheetNames) {
      const bang = XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, defval: '', raw: false });
      tatCa = tatCa.concat(bangThanhDong(bang));
    }
    return tatCa;
  }
  if (duoi === 'json') {
    const d = JSON.parse(buf.toString('utf8'));
    const ds = Array.isArray(d) ? d : (d.kien_thuc || d.data || d.items || []);
    return ds.map((o) => ({
      ...o,
      cau_hoi: o.cau_hoi || o.question || o.q || o.hoi,
      tra_loi: o.tra_loi || o.answer || o.a || o.dap,
      cau_hoi_khac: o.cau_hoi_khac || o.variants || '',
      tu_khoa: Array.isArray(o.tu_khoa || o.keywords) ? (o.tu_khoa || o.keywords).join(', ') : (o.tu_khoa || o.keywords || ''),
    })).filter((o) => o.cau_hoi && o.tra_loi);
  }
  if (duoi === 'docx') return docDocx(buf);
  if (['txt', 'md', 'text'].includes(duoi)) return vanBanThanhDong(buf.toString('utf8').replace(/^﻿/, ''));
  const e = new Error('Định dạng chưa hỗ trợ. Dùng .xlsx, .xls, .csv, .docx, .txt hoặc .json'); e.status = 400; throw e;
}

/** Workbook Excel: xuat kho hien tai hoac file mau. */
async function taoExcel({ mau = false } = {}) {
  const XLSX = require('xlsx');
  const tieuDe = ['Nhóm', 'Câu hỏi', 'Cách hỏi khác (mỗi dòng 1 câu)', 'Từ khóa (cách nhau dấu phẩy)', 'Trả lời (nhiều cách cách nhau ||)', 'Gợi ý tiếp (cách nhau |)', 'Liên kết (Nhãn|url;...)', 'Ảnh (url)', 'Ưu tiên', 'Bật (1/0)'];
  let rows;
  if (mau) {
    rows = [
      ['dat_ban', 'Nhà hàng có nhận đặt bàn qua điện thoại không?', 'gọi điện đặt bàn được không\nđặt bàn qua hotline', 'dat ban, goi dien, hotline', 'Có ạ, bạn gọi {hotline} để đặt bàn nha!||Dạ được ạ, gọi {hotline} là nhân viên giữ bàn liền cho bạn 😊', 'Đặt bàn có cần cọc không?', 'Đặt bàn online|/dat-ban', '', 0, 1],
      ['thuc_don', 'Có món cho trẻ em không?', 'món cho bé\nbé ăn được món gì', 'tre em, em be, cho be', 'Bé thường thích **trứng cuộn, cơm chiên cá hồi, khoai tây lắc phô mai, udon** – đều chín và không cay nha 👶', 'Món bán chạy nhất', 'Xem thực đơn|/menu', '', 0, 1],
      ['khac', 'Nhà hàng có gửi xe đạp được không?', '', 'xe dap', 'Được ạ, bạn gửi xe đạp ở khu giữ xe máy, miễn phí nha!', '', '', '', 0, 1],
    ];
  } else {
    const [ds] = await db.query('SELECT * FROM chatbot_kien_thuc ORDER BY nhom, id');
    rows = ds.map((r) => [r.nhom, r.cau_hoi, r.cau_hoi_khac || '', r.tu_khoa || '', r.tra_loi, (r.goi_y || '').split('|').join(' | '), r.lien_ket || '', r.anh || '', r.uu_tien, r.bat]);
  }
  const ws = XLSX.utils.aoa_to_sheet([tieuDe, ...rows]);
  ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 40 }, { wch: 28 }, { wch: 70 }, { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 8 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KienThuc');
  if (mau) {
    const hd = XLSX.utils.aoa_to_sheet([
      ['HƯỚNG DẪN NHẬP KHO KIẾN THỨC TRỢ LÝ ẢO'],
      ['Bắt buộc: cột "Câu hỏi" và "Trả lời". Các cột khác không bắt buộc.'],
      ['Cách hỏi khác: mỗi dòng (Alt+Enter) một cách khách có thể hỏi -> bot hiểu được nhiều kiểu hỏi hơn.'],
      ['Từ khóa: khách nhắc tới từ khóa là bot ưu tiên câu này. Gõ có dấu hay không dấu đều được.'],
      ['Trả lời: viết nhiều cách trả lời cách nhau bằng || để bot trả lời tự nhiên, không lặp lại.'],
      ['Biến dùng được trong câu trả lời: {ten_bot} {ten_nha_hang} {hotline} {dia_chi} {gio_mo_cua} {email} {wifi} {ten_khach}'],
      ['In đậm: **chữ đậm**. Liên kết: Nhãn nút|/duong-dan ; nhiều nút cách nhau dấu chấm phẩy.'],
      ['Trùng câu hỏi với câu đã có -> hệ thống tự cập nhật câu trả lời mới.'],
      ['Cũng nhập được file Word (.docx: bảng 2 cột Hỏi | Đáp, hoặc đoạn "Hỏi: ... / Đáp: ..."), .txt, .csv, .json.'],
    ]);
    hd['!cols'] = [{ wch: 120 }];
    XLSX.utils.book_append_sheet(wb, hd, 'HuongDan');
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ---------------------------------------------------------------- thong ke
async function thongKeKho() {
  try {
    const [[t]] = await db.query(
      `SELECT COUNT(*) AS tong, SUM(bat = 1) AS dang_bat, SUM(nguon = 'file') AS tu_file,
              SUM(nguon = 'tay' OR nguon = 'hoc') AS tu_tay, SUM(nguon = 'mau') AS tu_mau, SUM(so_lan_dung) AS luot_dung
       FROM chatbot_kien_thuc`);
    const [top] = await db.query('SELECT id, cau_hoi, so_lan_dung FROM chatbot_kien_thuc WHERE so_lan_dung > 0 ORDER BY so_lan_dung DESC LIMIT 8');
    let tongBienThe = 0;
    const [bt] = await db.query('SELECT cau_hoi_khac FROM chatbot_kien_thuc WHERE bat = 1');
    bt.forEach((r) => { tongBienThe += 1 + tachDanhSach(r.cau_hoi_khac, /\r?\n/).length; });
    return { ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Number(v) || 0])), so_cach_hoi: tongBienThe, top };
  } catch {
    return { tong: 0, dang_bat: 0, tu_file: 0, tu_tay: 0, tu_mau: 0, luot_dung: 0, so_cach_hoi: 0, top: [], chua_migrate: true };
  }
}

async function theoNguon(soNgay = 30) {
  try {
    const [r] = await db.query(
      `SELECT COALESCE(nguon, 'ml') AS nguon, COUNT(*) AS n FROM chatbot_hoi_thoai
       WHERE tao_luc >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY COALESCE(nguon, 'ml') ORDER BY n DESC`, [soNgay]);
    return r.map((x) => ({ nguon: x.nguon, n: Number(x.n) }));
  } catch { return []; }
}

// ==========================================================================
// TU HOC tu cau chua tra loi duoc
//
// Moi cau khach hoi ma bot bo tay (khong hieu / phai hoi lai "y ban la...") duoc
// dem so voi kho kien thuc + thuc don + nhom cau hoi noi bo:
//   gop      - gan voi mot chu de co san -> them thanh "cach hoi khac" cua chu de
//   mon      - thuc ra la hoi mon -> lan sau bo nhan dien mon tra loi duoc
//   quan_ly  - cau so lieu noi bo (doanh thu...) -> chi tra loi khi quan ly dang nhap
//   moi      - chu de moi -> can nguoi viet cau tra loi (bot goi y san tu khoa, nhom)
// Du chac (>= nguong_tu_hoc, cach xa ung vien thu hai) thi bot TU HOC ngay sau
// khi tra loi hong; con lai cho quan ly duyet bang mot nut. Hoc = them cau vao
// `cau_hoi_khac` nen hoan tac duoc va nhin thay ro trong kho.
// Trang thai luu o chatbot_hoi_thoai.da_hoc: 0 chua xu ly, 1 da hoc, 2 bo qua.
// ==========================================================================
let daCoCotHoc = false;
async function damBaoCotHoc() {
  if (daCoCotHoc) return;
  const [r] = await db.query("SHOW COLUMNS FROM chatbot_hoi_thoai LIKE 'da_hoc'");
  if (!r.length) {
    await db.query("ALTER TABLE chatbot_hoi_thoai ADD COLUMN da_hoc TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 chua, 1 da hoc, 2 bo qua', ADD COLUMN hoc_vao INT NULL");
  }
  daCoCotHoc = true;
}

// Cau so lieu noi bo. Tranh tu de trung: "nhan vien" (khach hay xin gap nhan vien),
// "luong" (bo dau trung "so luong").
const TU_QUAN_LY = /\b(noi bo|doanh thu|loi nhuan|ton kho|nhap kho|nguyen lieu (cua nha hang )?con|con bao nhieu nguyen lieu|bao nhieu don|so don|don hom nay|so nhan vien|luong nhan vien|bang luong|tien luong|ca lam|chi phi|bao cao|kpi|cong no|thu chi|hieu suat|du bao)\b/;
const NHOM_DOAN = [
  [/dat ban|book|giu cho|coc|huy ban/, 'dat_ban'], [/tiec|sinh nhat|su kien|hoi nghi/, 'dat_tiec'],
  [/giao|ship|van chuyen|shipper/, 'giao_hang'], [/thanh toan|chuyen khoan|the|tien mat|hoa don|vat/, 'thanh_toan'],
  [/khuyen mai|uu dai|giam gia|voucher|ma giam|diem|thanh vien/, 'khuyen_mai'], [/tai khoan|dang ky|dang nhap|mat khau/, 'tai_khoan'],
  [/mon|thuc don|menu|an|uong|gia/, 'thuc_don'], [/gop y|khieu nai|phan nan|danh gia/, 'gop_y'],
  [/dia chi|gio|mo cua|wifi|dau xe|gui xe|phong|khong gian/, 'thong_tin'], [/chao|cam on|ok|vang|dung roi/, 'chao_hoi'],
];

/** Phan tich mot cau chua tra loi duoc -> de xuat hoc. */
async function phanTichHoc(cauHoi, tl) {
  const x = chuanHoaCoBan(cauHoi);
  if (TU_QUAN_LY.test(x)) return { kieu: 'quan_ly' };
  const [kt, mon] = await Promise.all([timKienThuc(cauHoi, 3).catch(() => []), timMon(cauHoi, {}, tl).catch(() => null)]);
  const top = kt[0];
  if (top && top.diem >= tl.nguong_khop) return { kieu: 'da_hieu', id_kien_thuc: top.muc.dong.id, cau_kt: top.muc.dong.cau_hoi, diem: top.diem };
  // Gio da bat duoc bang tu khoa (vd vua them tu khoa) -> coi nhu da hieu.
  if (tl.bat_tu_khoa) {
    const kw = await timTheoTuKhoa(cauHoi, 2).catch(() => []);
    if (kw[0] && kw[0].diem >= tl.nguong_tu_khoa && (!kw[1] || kw[0].diem - kw[1].diem >= 0.15)) {
      return { kieu: 'da_hieu', id_kien_thuc: kw[0].muc.dong.id, cau_kt: kw[0].muc.dong.cau_hoi, diem: kw[0].diem };
    }
  }
  if (mon && mon.ds && mon.ds.length) return { kieu: 'mon', so_mon: mon.ds.length, mon: mon.ds.slice(0, 3).map((m) => m.ten) };
  if (top && top.diem >= 0.2) {
    const cachXa = !kt[1] || top.diem - kt[1].diem >= 0.1;
    return {
      kieu: 'gop', id_kien_thuc: top.muc.dong.id, cau_kt: top.muc.dong.cau_hoi, diem: Number(top.diem.toFixed(3)),
      chac: top.diem >= tl.nguong_tu_hoc && cachXa,
      khac: kt.slice(1).filter((k) => k.diem >= 0.2).map((k) => ({ id_kien_thuc: k.muc.dong.id, cau_kt: k.muc.dong.cau_hoi, diem: Number(k.diem.toFixed(3)) })),
    };
  }
  // Chu de moi: goi y nhom + tu khoa de quan ly chi viet cau tra loi.
  const nhom = (NHOM_DOAN.find(([re]) => re.test(x)) || [null, 'khac'])[1];
  const tuKhoa = [...new Set(x.split(' ').filter((w) => w.length > 1 && !TU_DEM.has(w)))].slice(0, 5).join(', ');
  return { kieu: 'moi', nhom, tu_khoa: tuKhoa };
}

/** Them cau vao "cach hoi khac" cua chu de + danh dau da hoc. */
async function hocCau(cauHoi, idKienThuc) {
  await damBaoCotHoc();
  const cau = String(cauHoi || '').trim().slice(0, 300);
  const [[d]] = await db.query('SELECT id, cau_hoi, cau_hoi_khac FROM chatbot_kien_thuc WHERE id = ?', [idKienThuc]);
  if (!d) { const e = new Error('Chủ đề không còn tồn tại.'); e.status = 404; throw e; }
  const ds = tachDanhSach(d.cau_hoi_khac, /\r?\n/);
  const khoa = chuanHoaCoBan(cau);
  if (chuanHoaCoBan(d.cau_hoi) !== khoa && !ds.some((c) => chuanHoaCoBan(c) === khoa)) {
    ds.push(cau);
    await db.query('UPDATE chatbot_kien_thuc SET cau_hoi_khac = ? WHERE id = ?', [ds.join('\n'), d.id]);
    lamMoiChiMuc();
  }
  await db.query('UPDATE chatbot_hoi_thoai SET da_hoc = 1, hoc_vao = ? WHERE cau_hoi = ? AND da_hoc = 0', [d.id, cau]);
  return { id_kien_thuc: d.id, cau_kt: d.cau_hoi };
}

async function danhDauHoc(cauHoi, trangThai, idKienThuc = null) {
  await damBaoCotHoc();
  await db.query('UPDATE chatbot_hoi_thoai SET da_hoc = ?, hoc_vao = ? WHERE cau_hoi = ?', [trangThai, idKienThuc, String(cauHoi || '').slice(0, 500)]);
}

/** Bo cau da hoc khoi chu de va dua ve danh sach cho duyet. */
async function hoanTacHoc(cauHoi, idKienThuc) {
  await damBaoCotHoc();
  const [[d]] = await db.query('SELECT id, cau_hoi_khac FROM chatbot_kien_thuc WHERE id = ?', [idKienThuc]);
  if (d) {
    const khoa = chuanHoaCoBan(cauHoi);
    const ds = tachDanhSach(d.cau_hoi_khac, /\r?\n/).filter((c) => chuanHoaCoBan(c) !== khoa);
    await db.query('UPDATE chatbot_kien_thuc SET cau_hoi_khac = ? WHERE id = ?', [ds.join('\n'), d.id]);
    lamMoiChiMuc();
  }
  await db.query('UPDATE chatbot_hoi_thoai SET da_hoc = 0, hoc_vao = NULL WHERE cau_hoi = ?', [String(cauHoi).slice(0, 500)]);
}

/**
 * Goi ngay sau mot luot bot khong tra loi duoc (chay nen, khong lam cham khach).
 * Du chac thi hoc luon; cau "da hieu"/"mon" (do kho vua cap nhat) thi danh dau xong.
 */
async function tuHocMotCau(cauHoi) {
  try {
    const tl = await docThietLap();
    if (!tl.tu_hoc) return null;
    const p = await phanTichHoc(cauHoi, tl);
    if (p.kieu === 'gop' && p.chac) return { ...(await hocCau(cauHoi, p.id_kien_thuc)), tu_dong: true };
    if (p.kieu === 'da_hieu' || p.kieu === 'mon') { await danhDauHoc(cauHoi, 1, p.id_kien_thuc || null); return p; }
    return null;
  } catch (e) {
    console.error('[chatbot] tu hoc:', e.message);
    return null;
  }
}

/** Danh sach cau chua tra loi duoc kem de xuat hoc + nhung cau da tu hoc gan day. */
async function deXuatHoc(soNgay = 30) {
  try {
    await damBaoCotHoc();
    const tl = await docThietLap();
    const [rows] = await db.query(
      `SELECT cau_hoi, COUNT(*) AS so_lan, MAX(tao_luc) AS gan_nhat
       FROM chatbot_hoi_thoai
       WHERE (khong_hieu = 1 OR y_dinh = 'goi_y_gan_dung') AND da_hoc = 0
         AND (quyen IS NULL OR quyen = 'khach')
         AND tao_luc >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY cau_hoi ORDER BY so_lan DESC, gan_nhat DESC LIMIT 60`, [soNgay]);
    const cho = [];
    let tuHoc = 0;
    for (const r of rows) {
      const p = await phanTichHoc(r.cau_hoi, tl);
      // Bat tu hoc: xu ly luon nhung cau du chac (ke ca cau cu truoc khi bat tinh nang).
      if (tl.tu_hoc && p.kieu === 'gop' && p.chac) { await hocCau(r.cau_hoi, p.id_kien_thuc); tuHoc++; continue; }
      if (p.kieu === 'da_hieu' || p.kieu === 'mon') { await danhDauHoc(r.cau_hoi, 1, p.id_kien_thuc || null); continue; }
      cho.push({ cau_hoi: r.cau_hoi, so_lan: Number(r.so_lan), gan_nhat: r.gan_nhat, de_xuat: p });
    }
    const [daHoc] = await db.query(
      `SELECT h.cau_hoi, h.hoc_vao, MAX(h.tao_luc) AS luc, k.cau_hoi AS cau_kt
       FROM chatbot_hoi_thoai h JOIN chatbot_kien_thuc k ON k.id = h.hoc_vao
       WHERE h.da_hoc = 1 GROUP BY h.cau_hoi, h.hoc_vao, k.cau_hoi ORDER BY luc DESC LIMIT 15`);
    return { cho, da_hoc: daHoc, vua_tu_hoc: tuHoc, bat: tl.tu_hoc, nguong: tl.nguong_tu_hoc };
  } catch (e) {
    console.error('[chatbot] de xuat hoc:', e.message);
    return { cho: [], da_hoc: [], vua_tu_hoc: 0, bat: false, nguong: 0.4, loi: e.message };
  }
}

async function hoiThoaiGanDay({ gioiHan = 80, chiKhongHieu = false } = {}) {
  try {
    const [r] = await db.query(
      `SELECT id, cau_hoi, tra_loi, y_dinh, tin_cay, nguon, quyen, khong_hieu, huu_ich, phien, tao_luc
       FROM chatbot_hoi_thoai ${chiKhongHieu ? 'WHERE khong_hieu = 1' : ''} ORDER BY id DESC LIMIT ?`, [gioiHan]);
    return r;
  } catch { return []; }
}

async function dsLienHe() {
  try {
    const [r] = await db.query('SELECT * FROM chatbot_lien_he ORDER BY da_xu_ly, id DESC LIMIT 200');
    return r;
  } catch { return []; }
}

async function xuLyLienHe(id, daXuLy) {
  await db.query('UPDATE chatbot_lien_he SET da_xu_ly = ? WHERE id = ?', [daXuLy ? 1 : 0, id]);
}

module.exports = {
  deXuatHoc, hocCau, danhDauHoc, hoanTacHoc, tuHocMotCau, phanTichHoc, timTheoTuKhoa,
  MAC_DINH, docThietLap, luuThietLap, thietLapCongKhai,
  traLoi, traLoiKhongHieu, loiChao, apDung, ghiNhatKy, capNhatNhatKyML, thongKeMenu,
  timKienThuc, timMon, layMenu, lamMoiChiMuc, chuanHoaCoBan,
  danhSach, them, sua, xoa, batTat, napNhieu, napBoMau, docFile, taoExcel,
  thongKeKho, theoNguon, hoiThoaiGanDay, dsLienHe, xuLyLienHe,
  lamMoiMenu: () => { menuCache = null; },
  dongKetNoi: () => db.end(),
};

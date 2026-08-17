/**
 * Cau noi giua Node va chatbot ben ML service (Python).
 *
 * Theo dung nguyen tac chung cua he thong: ML service KHONG duoc lam sap web.
 * Neu Python chua bat hoac loi, `hoi()` khong nem loi ra ngoai ma chuyen sang
 * BO TRA LOI DU PHONG viet bang JavaScript o cuoi file - no chi hieu duoc vai
 * y dinh pho bien nhat bang tu khoa, nhung du de khach khong gap man hinh loi.
 *
 * PHAN QUYEN - diem quan trong nhat cua file nay
 *   Tham so `quyen` gui sang Python duoc suy ra tu PHIEN DANG NHAP phia server
 *   (`req.session`), khong bao giờ lay tu body request. Neu lay tu body thi
 *   khach chi can sua JSON la doc duoc doanh thu nha hang.
 */
const db = require('../config/db');

const MAC_DINH_URL = 'http://127.0.0.1:8000';
const TIMEOUT_MS = 15000;        // mot luot hoi phai nhanh; qua lau thi du phong
const TIMEOUT_HUAN_LUYEN_MS = 300000;

let urlCache = null;
let urlCacheLuc = 0;

async function layUrl() {
  const bayGio = Date.now();
  if (urlCache && bayGio - urlCacheLuc < 60000) return urlCache;
  try {
    const [rows] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'ml_service_url'");
    urlCache = (rows[0] && rows[0].gia_tri) || MAC_DINH_URL;
  } catch {
    urlCache = MAC_DINH_URL;
  }
  urlCacheLuc = bayGio;
  return urlCache;
}

async function goi(duongDan, { method = 'GET', body = null, timeout = TIMEOUT_MS } = {}) {
  const url = (await layUrl()) + duongDan;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const chiTiet = await res.text().catch(() => '');
    throw new Error(`ML service tra ve ${res.status}: ${chiTiet.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Suy ra quyen tu phien dang nhap.
 *
 * Chi admin, quan ly va ke toan moi duoc hoi so lieu kinh doanh. Danh sach vai
 * tro giu giong `requireQuanLy` trong routes/forecast.js de hai noi khong lech
 * nhau - neu mot ngay nao do doi chinh sach thi phai sua ca hai.
 */
function suyRaQuyen(session) {
  if (!session) return { quyen: 'khach', id_kh: null, id_nv: null };
  if (session.adminlogin) {
    return { quyen: 'quan_ly', id_kh: null, id_nv: session.staffId || null };
  }
  if (session.stafflogin) {
    const vaiTro = (session.staffRole || '').toLowerCase();
    const laQuanLy = /quan ly|quanly|ke toan|ketoan|manager/.test(vaiTro);
    return {
      quyen: laQuanLy ? 'quan_ly' : 'khach',
      id_kh: null,
      id_nv: session.staffId || null,
    };
  }
  return { quyen: 'khach', id_kh: session.userId || null, id_nv: null };
}

const chatbotService = {
  suyRaQuyen,

  /** Chatbot co dang bat khong (khoa `chatbot.bat` trong bang cau_hinh). */
  dangBat: async () => {
    try {
      const [rows] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'chatbot.bat'");
      return !rows[0] || String(rows[0].gia_tri) !== '0';
    } catch {
      return true;
    }
  },

  kiemTra: async () => {
    try {
      return { ...(await goi('/chatbot/trang-thai', { timeout: 5000 })) };
    } catch (err) {
      return { san_sang: false, loi: err.message };
    }
  },

  /**
   * Xu ly mot luot hoi.
   * @param {string} cauHoi   noi dung nguoi dung go
   * @param {object} session  req.session - dung de suy ra quyen, KHONG tin body
   * @param {object} nguCanh  { y_dinh_cho, cho_tham_so } luu tu luot truoc
   */
  hoi: async (cauHoi, session, nguCanh = {}) => {
    const boiCanh = suyRaQuyen(session);
    try {
      const kq = await goi('/chatbot/hoi', {
        method: 'POST',
        body: {
          cau_hoi: String(cauHoi || '').slice(0, 500),
          quyen: boiCanh.quyen,
          id_kh: boiCanh.id_kh,
          id_nv: boiCanh.id_nv,
          y_dinh_cho: nguCanh.y_dinh_cho || null,
          cho_tham_so: nguCanh.cho_tham_so || null,
        },
      });
      return { ...kq, nguon: 'ml' };
    } catch (err) {
      const duPhong = await traLoiDuPhong(cauHoi, boiCanh);
      return { ...duPhong, nguon: 'du_phong', loi_ml: err.message };
    }
  },

  huanLuyen: () => goi('/chatbot/huan-luyen', {
    method: 'POST', timeout: TIMEOUT_HUAN_LUYEN_MS,
  }),

  /** Bang so sanh mo hinh da luu - doc duoc ca khi Python dang tat. */
  danhGiaDaLuu: async () => {
    const [rows] = await db.query(
      `SELECT mo_hinh, do_chinh_xac, f1_macro, do_chinh_xac_tay, f1_macro_tay,
              giay_huan_luyen, ms_moi_cau, la_mo_hinh_chon, tao_luc
       FROM chatbot_danh_gia ORDER BY f1_macro_tay DESC`
    );
    return rows;
  },

  /** So lieu van hanh cho trang quan tri. */
  thongKe: async (soNgay = 30) => {
    const [tong] = await db.query(
      `SELECT COUNT(*) AS so_luot,
              SUM(khong_hieu) AS so_khong_hieu,
              ROUND(AVG(tin_cay), 4) AS tin_cay_tb,
              ROUND(AVG(thoi_gian_ms)) AS ms_tb,
              COUNT(DISTINCT DATE(tao_luc)) AS so_ngay
       FROM chatbot_hoi_thoai
       WHERE tao_luc >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [soNgay]
    );
    const [theoYDinh] = await db.query(
      `SELECT y_dinh, COUNT(*) AS so_luot, ROUND(AVG(tin_cay), 3) AS tin_cay_tb
       FROM chatbot_hoi_thoai
       WHERE tao_luc >= DATE_SUB(NOW(), INTERVAL ? DAY) AND khong_hieu = 0
       GROUP BY y_dinh ORDER BY so_luot DESC LIMIT 15`,
      [soNgay]
    );
    // Cau bot khong hieu - day la danh sach viec can lam de mo rong bo mau cau.
    const [khongHieu] = await db.query(
      `SELECT cau_hoi, COUNT(*) AS so_lan, MAX(tao_luc) AS gan_nhat
       FROM chatbot_hoi_thoai
       WHERE khong_hieu = 1 AND tao_luc >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY cau_hoi ORDER BY so_lan DESC, gan_nhat DESC LIMIT 30`,
      [soNgay]
    );
    const t = tong[0] || {};
    const soLuot = Number(t.so_luot) || 0;
    const soKhongHieu = Number(t.so_khong_hieu) || 0;
    return {
      so_ngay: soNgay,
      so_luot: soLuot,
      so_khong_hieu: soKhongHieu,
      ty_le_hieu: soLuot ? ((soLuot - soKhongHieu) / soLuot) * 100 : 0,
      tin_cay_tb: Number(t.tin_cay_tb) || 0,
      ms_tb: Number(t.ms_tb) || 0,
      theo_y_dinh: theoYDinh,
      khong_hieu: khongHieu,
    };
  },

  /** Khach bam thich / khong thich cau tra loi gan nhat. */
  danhGiaCauTraLoi: async (id, huuIch) => {
    await db.query(
      'UPDATE chatbot_hoi_thoai SET huu_ich = ? WHERE id = ?',
      [huuIch ? 1 : 0, id]
    );
  },
};

// --------------------------------------------------------------------------
// BO TRA LOI DU PHONG (chi dung khi Python tat)
//
// Khong co mo hinh nen chi so khop tu khoa. Pham vi hep hon han ban day du,
// nhung bao dam ba dieu: khong bao gio bao loi, khong bao gio lo so lieu noi
// bo cho khach, va luon noi ro dang o che do han che.
// --------------------------------------------------------------------------
function boDau(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const TU_KHOA_DU_PHONG = [
  { khoa: 'chatbot.gio_mo_cua', tu: ['gio mo cua', 'may gio', 'dong cua', 'mo cua'] },
  { khoa: 'chatbot.dia_chi', tu: ['dia chi', 'o dau', 'duong nao', 'dau xe', 'gui xe'] },
  { khoa: 'chatbot.lien_he', tu: ['so dien thoai', 'hotline', 'lien he', 'sdt', 'zalo'] },
  { khoa: 'chatbot.thanh_toan', tu: ['thanh toan', 'chuyen khoan', 'quet ma', 'tra tien', 'momo'] },
  { khoa: 'chatbot.giao_hang', tu: ['giao hang', 'ship', 'mang ve', 'takeaway'] },
  { khoa: 'chatbot.dat_ban', tu: ['dat ban', 'book ban', 'giu cho'] },
  { khoa: 'chatbot.dat_coc', tu: ['dat coc', 'tien coc', 'coc'] },
  { khoa: 'chatbot.chao', tu: ['xin chao', 'chao', 'hello', 'hi '] },
];

async function docCauHinh(khoa, macDinh = '') {
  try {
    const [rows] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [khoa]);
    return (rows[0] && rows[0].gia_tri) || macDinh;
  } catch {
    return macDinh;
  }
}

async function traLoiDuPhong(cauHoi, boiCanh) {
  const s = boDau(cauHoi);
  const ghiChu = '\n\n_(Trợ lý đang chạy ở chế độ hạn chế vì dịch vụ AI chưa bật.)_';

  for (const muc of TU_KHOA_DU_PHONG) {
    if (muc.tu.some((t) => s.includes(t))) {
      const noiDung = await docCauHinh(muc.khoa);
      if (noiDung) return { van_ban: noiDung + ghiChu, y_dinh: muc.khoa, tin_cay: null };
    }
  }

  // Thuc don / mon ban chay - hai cau hoi pho bien nhat, tra lai duoc bang SQL thuan.
  if (/thuc don|menu|mon gi|mon nao|ban chay|ngon nhat/.test(s)) {
    try {
      const [rows] = await db.query(
        `SELECT h.name_mon, m.gia_mon, SUM(h.soluong) AS so_luong
         FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon
         WHERE h.tinhtrang = 3 AND h.id_mon > 0 AND m.tinhtrang = 1
         GROUP BY h.id_mon, h.name_mon, m.gia_mon
         ORDER BY so_luong DESC LIMIT 8`
      );
      return {
        van_ban: 'Đây là những món khách gọi nhiều nhất ạ:' + ghiChu,
        bang: rows,
        cot: [
          { khoa: 'name_mon', nhan: 'Món' },
          { khoa: 'gia_mon', nhan: 'Giá' },
          { khoa: 'so_luong', nhan: 'Lượt gọi' },
        ],
        y_dinh: 'hoi_mon_ban_chay',
        tin_cay: null,
      };
    } catch { /* roi xuong cau tra loi chung */ }
  }

  // Duong cung: dan ve nguoi that, dung loi moi giong het ban ben Python
  // (`tra_loi._khong_hieu`). Hai duong nay chay o hai tinh huong khac nhau -
  // Python tat va Python bat nhung khong hieu cau hoi - nhung voi nguoi dung
  // thi ca hai deu la "bot khong tra loi duoc", nen phai noi cung mot cau.
  const canDangNhap = !(boiCanh && (boiCanh.id_kh || boiCanh.id_nv));
  return {
    van_ban: canDangNhap
      ? 'Xin lỗi, trợ lý ảo đang tạm thời không sẵn sàng. Bạn **đăng ký** hoặc ' +
        '**đăng nhập** vào website rồi vào **mục Chat** để nhắn trực tiếp với nhân viên nhé.'
      : 'Xin lỗi, trợ lý ảo đang tạm thời không sẵn sàng. Bạn vào **mục Chat** ' +
        'để nhắn trực tiếp với nhân viên nhé.',
    y_dinh: 'khong_hieu',
    tin_cay: null,
    chuyen_nhan_vien: true,
    can_dang_nhap: canDangNhap,
  };
}

module.exports = chatbotService;

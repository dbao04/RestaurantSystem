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
const daNgonNgu = require('./chatbotDaNgonNgu');
const triThuc = require('./chatbotTriThuc');

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
function suyRaQuyen(session, kenh = 'noi_bo') {
  if (!session) return { quyen: 'khach', id_kh: null, id_nv: null };
  // Kenh khach (widget tren trang khach hang): LUON la khach, du trinh duyet dang
  // dang nhap quan ly / nhan vien. Kenh chi ha quyen, khong bao gio nang quyen.
  if (kenh === 'khach') return { quyen: 'khach', id_kh: session.userId || null, id_nv: null };
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
  dangBat: async () => (await triThuc.docThietLap()).bat,

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
  hoi: async (cauHoi, session, nguCanh = {}, ngonNgu = 'vi', phien = null, kenh = 'noi_bo') => {
    const batDau = Date.now();
    const laKhach = kenh === 'khach';
    const boiCanh = suyRaQuyen(session, kenh);
    const cauDaChuanHoa = daNgonNgu.chuanHoaCauHoi(cauHoi, ngonNgu);
    const tl = await triThuc.docThietLap();
    // Tri nho tach theo kenh: hoi o trang nhan vien khong lan sang khung chat khach.
    const khoaNho = laKhach ? 'chatbotNho' : 'chatbotNhoNoiBo';
    const nho = (session && session[khoaNho]) || {};
    const ctx = {
      quyen: boiCanh.quyen, id_kh: boiCanh.id_kh, phien, nguCanh: nho,
      // Trang khach chi goi ten tai khoan khach, khong goi ten nhan vien / quan tri.
      ten_khach: session && (laKhach ? session.username : (session.staffName || session.adminname || session.username)),
    };
    const cauKt = ngonNgu === 'vi' ? cauHoi : cauDaChuanHoa;

    // Ghi nho phien: mon vua gioi thieu (hieu "mon do bao nhieu") + so lan khong hieu lien tiep.
    const nhoLai = (kq) => {
      if (!session) return;
      const moi = { ...nho };
      if (kq.mon && kq.mon.length) moi.mon_truoc = kq.mon.slice(0, 3).map((m) => m.id);
      moi.khong_hieu_lien = kq.khong_hieu || kq.y_dinh === 'khong_hieu' ? (nho.khong_hieu_lien || 0) + 1 : 0;
      session[khoaNho] = moi;
    };
    const hoanTat = async (kq, { daGhi = false } = {}) => {
      const sach = { ...kq };
      // Khach chon EN/JA: kho kien thuc / thuc don tra tieng Viet -> doi sang ban dich san.
      if (ngonNgu === 'en' || ngonNgu === 'ja') {
        let cauKho = null;
        if (sach.id_kien_thuc) {
          const [[d]] = await db.query('SELECT cau_hoi FROM chatbot_kien_thuc WHERE id = ?', [sach.id_kien_thuc]).catch(() => [[null]]);
          cauKho = d ? d.cau_hoi : null;
        }
        const ctxNN = { ...ctx, menuTk: await triThuc.thongKeMenu() };
        const sdt = (String(cauHoi).match(/(?:\+?84|0)[\d .-]{8,12}\d/) || [''])[0].replace(/[^\d+]/g, '');
        Object.assign(sach, daNgonNgu.dichKetQua(sach, ngonNgu, {
          cauKho, sdt,
          apDung: (vb) => triThuc.apDung(vb, tl, ctxNN),
          tenKhach: tl.goi_ten_khach ? ctx.ten_khach : '',
        }));
      }
      const khop = sach._khop;
      delete sach._khop; delete sach._mon_ids; delete sach._chua_tra_loi; delete sach._goi_y_gan_dung;
      if (boiCanh.quyen === 'quan_ly' && khop) sach.khop_cau = khop;
      if (!daGhi) {
        sach.id_nhat_ky = await triThuc.ghiNhatKy({
          // 'noi_bo' = nhan vien thuong hoi o trang nhan vien -> tach khoi cau cua khach (tu hoc chi dung cau khach).
          cau_hoi: cauHoi, y_dinh: sach.y_dinh, tin_cay: sach.tin_cay, quyen: laKhach || boiCanh.quyen === 'quan_ly' ? boiCanh.quyen : 'noi_bo',
          id_kh: boiCanh.id_kh, id_nv: boiCanh.id_nv, thoi_gian_ms: Date.now() - batDau,
          khong_hieu: sach.khong_hieu || sach.y_dinh === 'khong_hieu', nguon: sach.nguon,
          id_kien_thuc: sach.id_kien_thuc, tra_loi: sach.van_ban, phien,
        });
      }
      sach.thoi_gian_ms = Date.now() - batDau;
      nhoLai(sach);
      // Tu hoc: cau vua tra loi hong -> doi chieu kho kien thuc, du chac thi hoc
      // ngay de lan sau tra loi duoc. Chay nen, khong lam cham khach.
      if (laKhach && (sach.khong_hieu || sach.y_dinh === 'khong_hieu' || sach.y_dinh === 'goi_y_gan_dung')) {
        setImmediate(() => { triThuc.tuHocMotCau(cauHoi); });
      }
      return sach;
    };

    // Quan ly hoi so lieu -> mo hinh ML truoc (doanh thu, ban trong...), khong hieu moi xuong kho.
    let ketQuaML = null;
    const thuML = async () => {
      // Cong tac 'Dung mo hinh ML' chi ap cho khach; quan ly (kenh noi bo) luon tra duoc so lieu.
      if (!tl.bat_ml && boiCanh.quyen !== 'quan_ly') return null;
      try {
        const kq = await goi('/chatbot/hoi', {
          method: 'POST',
          body: {
            cau_hoi: String(cauDaChuanHoa || '').slice(0, 500), quyen: boiCanh.quyen,
            id_kh: boiCanh.id_kh, id_nv: boiCanh.id_nv,
            y_dinh_cho: nguCanh.y_dinh_cho || null, cho_tham_so: nguCanh.cho_tham_so || null,
          },
        });
        return { ...daNgonNgu.dichPhanHoi(kq, ngonNgu), nguon: 'ml' };
      } catch (err) {
        return { _loi: err.message };
      }
    };
    const mlHieu = (kq) => kq && !kq._loi && !kq.khong_hieu && kq.y_dinh !== 'khong_hieu';

    if (boiCanh.quyen === 'quan_ly') {
      ketQuaML = await thuML();
      if (mlHieu(ketQuaML)) {
        triThuc.capNhatNhatKyML(ketQuaML.id_nhat_ky, { tra_loi: ketQuaML.van_ban, phien });
        return hoanTat(ketQuaML, { daGhi: !!ketQuaML.id_nhat_ky });
      }
    }

    const kt = await triThuc.traLoi(cauKt, { ...ctx, kenh });
    if (!kt._chua_tra_loi) {
      if (kt.nguon === 'ngoai_gio' || kt.nguon === 'lien_he') {
        kt.can_dang_nhap = !(boiCanh.id_kh || boiCanh.id_nv);
      }
      return hoanTat(kt);
    }

    if (boiCanh.quyen !== 'quan_ly') ketQuaML = await thuML();
    if (mlHieu(ketQuaML)) {
      ketQuaML.van_ban = triThuc.apDung(ketQuaML.van_ban, tl, ctx);
      triThuc.capNhatNhatKyML(ketQuaML.id_nhat_ky, { tra_loi: ketQuaML.van_ban, phien });
      return hoanTat(ketQuaML, { daGhi: !!ketQuaML.id_nhat_ky });
    }

    // Khong nguon nao chac chan: goi y cau gan dung, khong hieu nhieu lan -> moi gap nhan vien.
    const kh = await triThuc.traLoiKhongHieu({ ...ctx, kenh }, kt._goi_y_gan_dung || [], (nho.khong_hieu_lien || 0) + 1);
    kh.can_dang_nhap = !(boiCanh.id_kh || boiCanh.id_nv);
    if (ketQuaML && ketQuaML.id_nhat_ky) {
      triThuc.capNhatNhatKyML(ketQuaML.id_nhat_ky, { nguon: kh.nguon, tra_loi: kh.van_ban, phien });
      return hoanTat(kh, { daGhi: true });
    }
    return hoanTat(kh);
  },

  /** Ban cu (chi ML + du phong) - giu de doi chieu / kiem thu. */
  hoiChiML: async (cauHoi, session, nguCanh = {}, ngonNgu = 'vi') => {
    const boiCanh = suyRaQuyen(session);
    const cauDaChuanHoa = daNgonNgu.chuanHoaCauHoi(cauHoi, ngonNgu);
    try {
      const kq = await goi('/chatbot/hoi', {
        method: 'POST',
        body: {
          cau_hoi: String(cauDaChuanHoa || '').slice(0, 500),
          quyen: boiCanh.quyen,
          id_kh: boiCanh.id_kh,
          id_nv: boiCanh.id_nv,
          y_dinh_cho: nguCanh.y_dinh_cho || null,
          cho_tham_so: nguCanh.cho_tham_so || null,
        },
      });
      return { ...daNgonNgu.dichPhanHoi(kq, ngonNgu), nguon: 'ml' };
    } catch (err) {
      const duPhong = await traLoiDuPhong(cauDaChuanHoa, boiCanh);
      return { ...daNgonNgu.dichPhanHoi(duPhong, ngonNgu), nguon: 'du_phong', loi_ml: err.message };
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

      // Thuc don vua thay moi thi chua mon nao co luot goi. Thay vi tra ve
      // bang rong, gioi thieu mon dang ban - van tra loi dung cau hoi.
      if (!rows.length) {
        const [moi] = await db.query(
          `SELECT name_mon, gia_mon FROM monan
           WHERE tinhtrang = 1 ORDER BY id_mon DESC LIMIT 8`
        );
        if (moi.length) {
          return {
            van_ban: 'Thực đơn vừa được cập nhật nên chưa có thống kê lượt gọi ạ. ' +
              'Đây là một số món đang phục vụ:' + ghiChu,
            bang: moi,
            cot: [
              { khoa: 'name_mon', nhan: 'Món' },
              { khoa: 'gia_mon', nhan: 'Giá' },
            ],
            y_dinh: 'hoi_thuc_don',
            tin_cay: null,
          };
        }
      }

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

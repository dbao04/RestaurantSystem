/**
 * Xac dinh ngon ngu cho moi yeu cau cua KHU KHACH.
 *
 * Gan vao `req.ngonNgu` va bon tien ich trong `res.locals` de view dung thang:
 *
 *   <%= t('dieu_huong.thuc_don') %>          chuoi giao dien
 *   <%= tenMon(m).chinh %>                    ten mon theo ngon ngu
 *   <%= nn %>                                 ma ngon ngu hien tai ('vi'/'en'/'ja')
 *   <% dsNgonNgu.forEach(...) %>              de dung nut doi ngon ngu
 *
 * VI SAO KHONG DAT TRONG PHIEN DANG NHAP
 * --------------------------------------
 * Kho phien mac dinh cua express-session nam trong bo nho may chu: khoi dong
 * lai la moi nguoi ve lai tieng Viet. Ngon ngu la lua chon cua thiet bi chu
 * khong phai cua phien lam viec, nen cookie moi dung - no song qua ca viec dong
 * trinh duyet lan viec may chu khoi dong lai.
 *
 * DOC COOKIE BANG TAY
 * -------------------
 * Du an khong cai `cookie-parser`, va them mot phu thuoc chi de doc mot khoa la
 * khong dang. `res.cookie()` thi Express co san.
 */
const ngonNgu = require('../services/ngonNgu');

const TEN_COOKIE = 'ngon_ngu';
const MOT_NAM = 365 * 24 * 60 * 60 * 1000;

/**
 * Nhung duong dan KHONG dich.
 *
 * Ba khu nay danh cho nhan vien nha hang - nguoi Viet. Dich ra chi lam ho phai
 * doc lai mot he thong da thuoc, va nhan doi so chuoi phai bao tri. Chan ngay o
 * middleware de khong ai lo tay dung `t()` trong do roi tuong la co ban dich.
 */
const KHONG_DICH = /^\/(admin|staff|shipper|api|kds|so-do-ban|to-chuc|cham-cong|dieu-hanh)(\/|$)/;

function docCookie(header, ten) {
  if (!header) return null;
  for (const phan of String(header).split(';')) {
    const i = phan.indexOf('=');
    if (i < 0) continue;
    if (phan.slice(0, i).trim() === ten) {
      try { return decodeURIComponent(phan.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

module.exports = function napNgonNgu() {
  return (req, res, next) => {
    const laKhuKhach = !KHONG_DICH.test(req.path);

    /*
      Thu tu uu tien: dia chi -> cookie -> trinh duyet -> tieng Viet.

      `?lang=` dung dau vi do la nguoi dung VUA bam nut doi ngon ngu; no cung
      duoc ghi xuong cookie ngay tai day, nen mo trang khac van giu nguyen lua
      chon ma khong can nut do phai biet duong dan hien tai.
    */
    const tuUrl = ngonNgu.chuanHoa(req.query.lang);
    const tuCookie = ngonNgu.chuanHoa(docCookie(req.headers.cookie, TEN_COOKIE));
    const tuTrinhDuyet = ngonNgu.doanTuTrinhDuyet(req.headers['accept-language']);

    const nn = tuUrl || tuCookie || tuTrinhDuyet || ngonNgu.MAC_DINH;

    if (tuUrl && tuUrl !== tuCookie) {
      res.cookie(TEN_COOKIE, tuUrl, {
        maxAge: MOT_NAM,
        httpOnly: false,   // de JavaScript trang doc duoc khi can
        sameSite: 'lax',
        path: '/',
      });
    }

    req.ngonNgu = nn;
    res.locals.nn = nn;
    res.locals.laKhuKhach = laKhuKhach;
    res.locals.dsNgonNgu = ngonNgu.DS_NGON_NGU;

    /*
      `t` khong nhan tham so ngon ngu: view goi t('khoa') la du.

      Bat view phai viet t('khoa', nn) o vai tram cho la vai tram co hoi quen
      mot cho, va cho quen do se im lang tra ve tieng Viet giua mot trang tieng
      Nhat - loai loi khong ai phat hien cho toi khi khach phan nan.
    */
    res.locals.t = (khoa, bien) => ngonNgu.t(khoa, nn, bien);
    res.locals.tenMon = (mon) => ngonNgu.tenMon(mon, nn);
    res.locals.tenNhom = (loai) => ngonNgu.tenNhom(loai, nn);
    res.locals.nhanDip = (gt) => ngonNgu.nhanDip(gt, nn);
    res.locals.nhanSoKhach = (so) => ngonNgu.nhanSoKhach(so, nn);

    // Dat `lang` dung cho the <html> - trinh duyet va trinh doc man hinh dung no.
    res.locals.maHtml = nn === 'ja' ? 'ja' : (nn === 'en' ? 'en' : 'vi');

    /*
      Duong dan hien tai, DA BO tham so `lang` cu.

      Nut doi ngon ngu noi them '?lang=xx' vao chuoi nay. Khong bo tham so cu thi
      bam doi ngon ngu hai lan se ra '/menu?lang=en&lang=ja' - Express lay gia
      tri dau tien, nen lan bam thu hai khong co tac dung gi.
    */
    const [duong, truyVan] = String(req.originalUrl || '/').split('?');
    const con = new URLSearchParams(truyVan || '');
    con.delete('lang');
    const chuoi = con.toString();
    res.locals.duongDanHienTai = duong + (chuoi ? '?' + chuoi : '');

    next();
  };
};

module.exports.TEN_COOKIE = TEN_COOKIE;
module.exports.KHONG_DICH = KHONG_DICH;

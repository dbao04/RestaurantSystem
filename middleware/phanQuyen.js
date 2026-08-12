/**
 * Middleware phan quyen theo co cau to chuc.
 *
 * Cung cap ba muc kiem tra, dung tuy tinh huong:
 *
 *   canQuyen('bep.mon.che_bien')   theo QUYEN chi tiet  - nen dung cho route moi
 *   canCapBac(3)                   theo CAP BAC         - "giam sat tro len"
 *   canBoPhan('BEP')               theo BO PHAN
 *   canVaiTroCu(['Bep'])           theo VAI TRO CU      - thay the requireRole
 *
 * `canVaiTroCu` ton tai de 178 route cu trong server.js chay dung ma khong phai
 * sua tung dong. No kiem tra hai lop:
 *   1. session.staffRole khop chinh xac  (hanh vi cu, khong doi gi)
 *   2. chuc danh moi co vai tro tuong duong  (Bep truong dong vai duoc 'Bep')
 * Nho lop 2, Bep truong / To truong bep / Bep pho tu dong vao duoc moi trang cua
 * 'Bep' ngay khi duoc bo nhiem, khong phai sua route nao.
 */
const phanQuyen = require('../services/phanQuyenService');

/**
 * Nap ho so quyen vao req.hoSo va res.locals.hoSo cho MOI request cua nhan vien.
 *
 * Dat ngay sau middleware session trong server.js. View dung res.locals.hoSo de
 * an/hien menu theo quyen thay vi so sanh chuoi vai tro.
 */
function napHoSo() {
  return async (req, res, next) => {
    const phien = req.session || {};

    res.locals.hoSo = null;
    res.locals.coQuyen = () => false;

    /*
     * Ban cho VIEW cua `canVaiTroCu` - va phai KHOP TUNG LOP MOT voi no.
     *
     * Khong co ham nay thi menu buoc phai viet
     * `['Thu ngan',...].includes(session.staffRole)` - dung cai bay da khien
     * quan ly nha hang bi an mat muc menu cua chinh chuc nang ho vao duoc.
     * Menu va middleware phai tra loi giong het nhau, neu khong nguoi dung se
     * thay mot he thong luc cho vao luc khong.
     *
     * Ban mac dinh nay chi co lop 1 (khop `staffRole` chinh xac) va lop quan
     * tri; ben duoi se nang cap len ban day du khi nap duoc ho so chuc danh.
     * Nguoi chua duoc bo nhiem chuc danh van thay dung menu cua vai tro cu.
     */
    res.locals.dongVaiDuoc = (ds) =>
      !!phien.adminlogin ||
      (Array.isArray(ds) ? ds : [ds]).includes(phien.staffRole);

    if (!phien.stafflogin || !phien.staffId) return next();

    try {
      const hs = await phanQuyen.hoSoQuyen(phien.staffId);
      if (!hs) return next();
      req.hoSo = hs;
      res.locals.hoSo = hs;
      // Ham tien ich dung thang trong EJS: <% if (coQuyen('luong.duyet')) { %>
      res.locals.coQuyen = (ma) => phanQuyen.coQuyen(hs, ma);
      res.locals.tuCapBac = (n) => phanQuyen.tuCapBac(hs, n);
      res.locals.dongVaiDuoc = (ds) =>
        (Array.isArray(ds) ? ds : [ds]).includes(phien.staffRole) ||
        phanQuyen.dongVaiDuoc(hs, ds);
    } catch (err) {
      console.error('[phanQuyen] không nạp được hồ sơ:', err.message);
    }
    next();
  };
}

/** Tra loi 403 dung dinh dang: JSON cho API, trang loi cho trinh duyet. */
function tuChoi(req, res, thongDiep) {
  const muonJson = req.xhr ||
    (req.headers.accept || '').includes('json') ||
    req.path.includes('/api/');

  if (muonJson) return res.status(403).json({ loi: thongDiep });
  return res.status(403).render('error', {
    title: 'Không có quyền truy cập',
    message: thongDiep,
    statusCode: 403,
    hoSo: res.locals.hoSo || null,
  });
}

/** Bat buoc dang nhap nhan vien (hoac quan tri). */
function canDangNhap(req, res, next) {
  if (req.session && (req.session.stafflogin || req.session.adminlogin)) return next();
  if ((req.headers.accept || '').includes('json') || req.xhr) {
    return res.status(401).json({ loi: 'Chưa đăng nhập.' });
  }
  return res.redirect('/staff/login');
}

/**
 * Yeu cau co quyen. Truyen mang = chi can MOT trong so do (hoac).
 * Ho tro tien to: canQuyen('kho.*').
 */
function canQuyen(maQuyen) {
  const ds = Array.isArray(maQuyen) ? maQuyen : [maQuyen];
  return (req, res, next) => {
    // Quan tri (tb_admin) dung tren he thong chuc danh - luon di qua.
    if (req.session && req.session.adminlogin) return next();
    if (!req.session || !req.session.stafflogin) return res.redirect('/staff/login');

    if (phanQuyen.coQuyen(req.hoSo, ds)) return next();
    return tuChoi(req, res,
      `Chức danh "${req.hoSo?.ten_cd || 'chưa xác định'}" của bạn không có quyền thực hiện việc này.`);
  };
}

/** Phai co DU tat ca cac quyen liet ke. */
function canDuQuyen(danhSach) {
  return (req, res, next) => {
    if (req.session && req.session.adminlogin) return next();
    if (!req.session || !req.session.stafflogin) return res.redirect('/staff/login');
    if (phanQuyen.coDuQuyen(req.hoSo, danhSach)) return next();
    return tuChoi(req, res, 'Bạn chưa đủ quyền để thực hiện việc này.');
  };
}

/** Cap bac cang nho cang cao. canCapBac(3) = giam sat tro len. */
function canCapBac(capToiThieu) {
  return (req, res, next) => {
    if (req.session && req.session.adminlogin) return next();
    if (!req.session || !req.session.stafflogin) return res.redirect('/staff/login');
    if (phanQuyen.tuCapBac(req.hoSo, capToiThieu)) return next();
    return tuChoi(req, res, 'Chức năng này dành cho cấp quản lý.');
  };
}

/** Chi nguoi thuoc mot trong cac bo phan duoc vao. */
function canBoPhan(maBoPhan) {
  const ds = Array.isArray(maBoPhan) ? maBoPhan : [maBoPhan];
  return (req, res, next) => {
    if (req.session && req.session.adminlogin) return next();
    if (!req.session || !req.session.stafflogin) return res.redirect('/staff/login');
    if (req.hoSo && ds.includes(req.hoSo.ma_bp)) return next();
    return tuChoi(req, res, 'Chức năng này thuộc bộ phận khác.');
  };
}

/**
 * Tuong thich nguoc voi requireRole cu.
 *
 * Dung trong server.js: `const requireRole = canVaiTroCu;` - 178 route giu nguyen.
 */
function canVaiTroCu(vaiTro) {
  const ds = Array.isArray(vaiTro) ? vaiTro : [vaiTro];
  return (req, res, next) => {
    if (req.session && req.session.adminlogin) return next();
    if (!req.session || !req.session.stafflogin) return res.redirect('/staff/login');

    // Lop 1 - hanh vi cu, giu nguyen cho nguoi chua duoc bo nhiem chuc danh moi.
    if (ds.includes(req.session.staffRole)) return next();

    // Lop 2 - chuc danh moi co dong vai duoc vai tro cu do khong.
    if (phanQuyen.dongVaiDuoc(req.hoSo, ds)) return next();

    return tuChoi(req, res,
      `Bạn không có quyền truy cập chức năng này. Chức danh hiện tại: ${req.hoSo?.ten_cd || req.session.staffRole || 'chưa xác định'}.`);
  };
}

/**
 * Chi cho phep thao tac tren cap duoi cua minh (hoac chinh minh).
 *
 * Dung cho duyet nghi phep, xem cham cong: to truong chi duyet duoc nguoi trong
 * nhanh cua minh, khong duyet cho bo phan khac.
 */
function canLaCapTren(layIdMucTieu) {
  return async (req, res, next) => {
    if (req.session && req.session.adminlogin) return next();
    if (!req.hoSo) return res.redirect('/staff/login');

    const mucTieu = Number(layIdMucTieu(req));
    if (!mucTieu) return tuChoi(req, res, 'Không xác định được nhân viên cần thao tác.');
    if (mucTieu === req.hoSo.id_nv) return next();

    // Cap 1 va cap 2 quan ly toan nha hang / toan bo phan.
    if (req.hoSo.cap_bac <= 2) return next();

    if (await phanQuyen.laCapTrenCua(req.hoSo.id_nv, mucTieu)) return next();
    return tuChoi(req, res, 'Nhân viên này không thuộc phạm vi quản lý của bạn.');
  };
}

module.exports = {
  napHoSo,
  canDangNhap,
  canQuyen,
  canDuQuyen,
  canCapBac,
  canBoPhan,
  canVaiTroCu,
  canLaCapTren,
  tuChoi,
};

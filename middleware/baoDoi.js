/**
 * Bao "du lieu vua doi" sau moi thao tac ghi.
 *
 * VI SAO LA MOT BANG CHU KHONG PHAI 45 LOI GOI
 * --------------------------------------------
 * He thong co khoang bon muoi lam route ghi du lieu, va gan nhu tat ca deu
 * cung mot hinh dang: nhan form, goi service, roi `res.redirect` ve danh sach.
 * Rai `realtime.doi(...)` vao tung route nghia la bon muoi lam cho sua trong
 * server.js - de sot, de dat sai nhanh (bao ca khi service nem loi), va lan
 * sau them route moi thi lai quen.
 *
 * O day doc CHINH duong dan cua yeu cau. Mot bang duy nhat noi "duong dan nay
 * dong vao mien du lieu kia", va su kien chi phat khi phan hoi da di tron ven
 * voi ma trang thai khong phai loi. Them route moi chi la them mot dong bang.
 *
 * VI SAO NGHE `res.on('finish')`
 * ------------------------------
 * Luc do phan hoi da gui xong, tuc la lenh ghi CSDL da chay xong ma khong nem.
 * Neu route that bai (500) hay bi chan quyen (403) thi khong phat gi ca - man
 * hinh nguoi khac khong viec gi phai tai lai vi mot thao tac hong.
 *
 * PHAT RONG CO AN TOAN KHONG
 * --------------------------
 * Co. Goi tin khong mang du lieu nghiep vu, chi mang ten mien. Client nhan
 * duoc se tu goi lai chinh URL no dang mo, va route do van kiem tra quyen nhu
 * thuong. Nguoi khong duoc xem bang luong co nhan 'luong:doi' cung khong doc
 * them duoc gi - xem them ghi chu ham `doi()` trong services/realtime.js.
 */
const realtime = require('../services/realtime');

const M = realtime.MIEN;

/**
 * Duong dan -> mien du lieu. Xet theo THU TU, cai khop dau tien thang, nen
 * quy tac hep phai dat truoc quy tac rong (vd `kitchen/shift` truoc `kitchen`).
 */
const BANG = [
  // --- Khu quan tri -------------------------------------------------------
  { mau: /^\/admin\/(catadd|catedit|catdel|productadd|productedit|productdel)/, mien: M.THUC_DON },
  { mau: /^\/admin\/(blogadd|blogedit|blogdel)/,                                mien: M.BLOG },
  { mau: /^\/admin\/(staffadd|staffedit|staffdel)/,                             mien: M.NHAN_SU },
  { mau: /^\/admin\/hopdong(confirm|del)/,                                      mien: M.HOP_DONG },
  { mau: /^\/admin\/leave(approve|reject)/,                                     mien: M.NGHI_PHEP },
  { mau: /^\/admin\/salary\//,                                                  mien: M.LUONG },
  { mau: /^\/admin\/schedule\//,                                                mien: M.LICH_LAM },
  { mau: /^\/admin\/xep-ca\//,                                                  mien: M.LICH_LAM },
  { mau: /^\/admin\/van-chuyen\//,                                              mien: M.GIAO_HANG },

  // --- Giao hang ----------------------------------------------------------
  // Ung dung shipper (/api/shipper/vi-tri) CO Y khong nam trong bang nay: no
  // chay bon lan mot phut cho moi shipper, va da co su kien rieng mang thang
  // toa do di theo (realtime.viTriShipper). Cho vao day thi ca he thong tu tai
  // lai trang moi 15 giay vi mot cham xe dich 20 met.
  { mau: /^\/staff\/giao-hang/,      mien: M.GIAO_HANG },
  { mau: /^\/api\/shipper\/ca$/,     mien: M.GIAO_HANG },

  // --- Ke toan ------------------------------------------------------------
  { mau: /^\/staff\/accountant\/salary\//,        mien: M.LUONG },
  { mau: /^\/staff\/accountant\/expenses\//,      mien: M.CHI_PHI },
  { mau: /^\/staff\/accountant\/leave\//,         mien: M.NGHI_PHEP },
  { mau: /^\/staff\/accountant\/staff\//,         mien: M.NHAN_SU },

  // --- Bep: kho, cong thuc, thiet bi, thuc don ----------------------------
  // `shift/close` phai dung truoc cac quy tac `kitchen/...` khac vi no la chot
  // ca bep chu khong phai sua kho.
  { mau: /^\/staff\/kitchen\/shift\//,                              mien: M.CA_BEP },
  { mau: /^\/staff\/kitchen\/(ingredient|inventory|unit|recipe)\//,  mien: M.KHO },
  { mau: /^\/staff\/kitchen\/equipment\//,                           mien: M.THIET_BI },
  { mau: /^\/staff\/kitchen\/(dish|combo|categories)\//,             mien: M.THUC_DON },
  { mau: /^\/staff\/kitchen\/mark-done\//,                           mien: M.DON_HANG },

  // --- Nghiep vu tuyen truoc ----------------------------------------------
  { mau: /^\/staff\/bookings\//,        mien: M.DAT_BAN },
  { mau: /^\/staff\/customers\//,       mien: M.KHACH_HANG },
  { mau: /^\/staff\/shift\/close/,      mien: M.CHOT_CA },
  { mau: /^\/staff\/schedule/,          mien: M.LICH_LAM },
  { mau: /^\/staff\/leave\//,           mien: M.NGHI_PHEP },
  { mau: /^\/staff\/emails\/send/,      mien: M.EMAIL },
  { mau: /^\/staff\/qr-codes\//,        mien: M.QR_BAN },
  { mau: /^\/qr\/add-dish/,             mien: M.DON_HANG },

  // --- Thao tac cua KHACH tren website -----------------------------------
  // Day moi la nguon thay doi ma nhan vien can biet som nhat: khach vua dat
  // ban hay vua huy don thi man hinh /staff/bookings phai doi ngay, chu khong
  // doi den luc le tan tinh co bam F5.
  { mau: /^\/datban$/,                  mien: M.DAT_BAN },
  { mau: /^\/cancel-order$/,            mien: M.DAT_BAN },
  { mau: /^\/my-orders\/cancel\//,      mien: M.DAT_BAN },
];

/**
 * Nhung thao tac GET co ghi du lieu.
 *
 * He thong nay dung nhieu duong dan GET de xoa / duyet / xac nhan (vi du
 * `/admin/catdel/5`, `/admin/leaveapprove/7`) - khong dung chuan REST nhung do
 * la thuc te cua ma nguon. Neu chi nghe POST thi mat han cac thao tac do, con
 * neu nghe MOI GET thi phat co ca khi nguoi ta chi mo trang xem.
 */
const GET_CO_GHI = /(del|delete|xoa|confirm|approve|reject|cancel|huy|close|pay)(\/|$)/;

function laThaoTacGhi(req) {
  if (req.method !== 'GET') return true;
  return GET_CO_GHI.test(req.path);
}

module.exports = function baoDoi() {
  return function (req, res, next) {
    if (!laThaoTacGhi(req)) return next();

    const muc = BANG.find((b) => b.mau.test(req.path));
    if (!muc) return next();

    res.on('finish', () => {
      // 4xx/5xx = thao tac khong thanh, khong lam phien man hinh nguoi khac.
      if (res.statusCode >= 400) return;
      realtime.doi(muc.mien, { duong_dan: req.path });
    });

    next();
  };
};

// De ngoai cho kiem thu: hai quy tac nay quyet dinh co phat su kien hay khong,
// sai mot ly la ca he thong nhap nhay vo co hoac im lim.
module.exports.BANG = BANG;
module.exports.laThaoTacGhi = laThaoTacGhi;

/**
 * MOT TRINH DUYET = MOT DANH TINH NOI BO.
 *
 * Phien quan tri (`adminlogin`) duoc di qua moi kiem tra quyen (khoang 90 cho
 * trong ma). Khi cung trinh duyet con dang nhap nhan vien, nguoi do mang ca hai
 * co: vi du shipper mo /staff van thay menu Dieu hanh & Quan ly, nhat ky xoa
 * mon... vi trang nhan vien thay `adminlogin` va mo het.
 *
 * Quy tac: dang nhap vai nay thi thoat vai kia. Muon dung hai vai cung luc thi
 * mo trinh duyet khac / cua so an danh.
 */

const KHOA_QUAN_TRI = ['adminlogin', 'idadmin', 'adminuser', 'adminname'];
const KHOA_NHAN_VIEN = [
  'stafflogin', 'staffId', 'staffName', 'staffRole', 'nvPhaiDoiMatKhau', 'laShipper',
  'quyen', 'idChucDanh', 'maChucDanh', 'tenChucDanh', 'capBac', 'laQuanLy',
  'idBoPhan', 'maBoPhan', 'tenBoPhan', 'vaiTroTuongDuong',
];

function boPhienQuanTri(sess) {
  if (!sess) return;
  for (const k of KHOA_QUAN_TRI) delete sess[k];
}

function boPhienNhanVien(sess) {
  if (!sess) return;
  for (const k of KHOA_NHAN_VIEN) delete sess[k];
}

// Trang thuoc khu nhan vien / khu quan tri - dung de gai quyet phien "lai" cu
// (tao truoc khi co quy tac nay): mo trang khu nao thi giu vai cua khu do.
const KHU_NHAN_VIEN = /^\/(staff|kds|so-do-ban|shipper|cham-cong)(\/|$)/;
const KHU_QUAN_TRI = /^\/admin(\/|$)/;

/** Goi moi request. Chi xu ly khi phien dang mang ca hai vai VA dang mo trang (GET). */
function gaiQuyetPhienLai(req) {
  const s = req.session;
  if (!s || !s.adminlogin || !s.stafflogin || req.method !== 'GET') return;
  if (KHU_NHAN_VIEN.test(req.path)) boPhienQuanTri(s);
  else if (KHU_QUAN_TRI.test(req.path)) boPhienNhanVien(s);
}

module.exports = { boPhienQuanTri, boPhienNhanVien, gaiQuyetPhienLai };

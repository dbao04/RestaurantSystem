/**
 * Ba luoc do quan he thuc the (ERD) cua co so du lieu.
 *
 * CSDL that co hon 60 bang; ve het vao mot hinh thi khong con doc duoc tren
 * giay A4. Ba hinh duoi day tach theo phan he va chi giu cac bang co quan he
 * khoa ngoai voi nhau:
 *   1. Ban hang   - tu thuc don toi don hang va thanh toan
 *   2. Kho        - tu nha cung cap toi nhat ky tieu hao va du bao nguyen lieu
 *   3. Nhan su    - co cau to chuc, cham cong va du lieu sinh trac hoc
 *
 * Ky phap chan qua (crow's foot): dau don la MOT ban ghi, dau chia ba la NHIEU
 * ban ghi. Cot danh dau PK la khoa chinh, FK la khoa ngoai.
 *
 * Ten cot lay dung theo lenh CREATE TABLE trong `config/gs_restaurant.sql` va
 * cac script `config/migrations/*.js`, khong dat lai cho dep.
 */
const v = require('./ve');

/* ======================================================================== */
/* 1. PHAN HE BAN HANG                                                      */
/* ======================================================================== */

function banHang() {
  const id = 'erdA';
  let s = '';

  const loaiMon = v.hopBang(30, 40, 'loai_mon', ['PK id_loai', 'name_loai', 'ghichu']);
  const monAn = v.hopBang(30, 190, 'monan', [
    'PK id_mon', 'FK id_loai', 'name_mon', 'gia_mon', 'images', 'tinhtrang',
  ]);
  const cart = v.hopBang(30, 430, 'cart', ['PK id', 'FK id_mon', 'session_id', 'soluong']);
  const qrTables = v.hopBang(30, 590, 'qr_tables', [
    'PK id', 'table_id', 'table_name', 'active_sesis', 'url',
  ]);

  const khachHang = v.hopBang(300, 40, 'khach_hang', [
    'PK id', 'ten', 'sodienthoai', 'gioitinh', 'solandat', 'passwords',
  ]);
  const viTri = v.hopBang(300, 250, 'vitri', ['PK id_vitri', 'name_vitri']);
  const ban = v.hopBang(300, 360, 'ban', [
    'PK Id_ban', 'FK id_vitri', 'number_ban', 'trangthai', 'sesis_hien_tai',
  ]);

  const hopDong = v.hopBang(600, 40, 'hopdong', [
    'PK id', 'sesis', 'FK id_mon', 'FK id_user', 'FK id_ban', 'name_mon',
    'soluong', 'gia', 'thanhtien', 'ngay_dat', 'gio_dat', 'tinhtrang',
    'trangthai_bep', 'ghi_chu_mon',
  ]);

  const payments = v.hopBang(900, 40, 'payments', [
    'PK id', 'FK sesis', 'FK payment_method_id', 'amount', 'status',
    'loai', 'ma_doi_soat', 'transaction_id', 'created_at',
  ]);
  const pttt = v.hopBang(900, 300, 'payment_methods', [
    'PK id', 'name', 'code', 'type', 'is_active',
  ]);
  const gdnh = v.hopBang(900, 440, 'giao_dich_ngan_hang', [
    'PK id', 'ma_giao_dich', 'so_tien', 'noi_dung', 'thoi_diem', 'da_khop',
  ]);
  const dcodes = v.hopBang(900, 620, 'discount_codes', [
    'PK id', 'code', 'loai_giam', 'gia_tri', 'han_dung',
  ]);

  [loaiMon, monAn, cart, qrTables, khachHang, viTri, ban, hopDong, payments, pttt, gdnh, dcodes]
    .forEach((b) => { s += b.svg; });

  /* --- quan he --- */

  // loai_mon 1 --- n monan (cung cot, noi doc)
  s += v.noiBang([[loaiMon.canh.giuaX, loaiMon.canh.duoi], [loaiMon.canh.giuaX, monAn.canh.tren]],
    { nhan: 'thuộc', viTriNhan: [loaiMon.canh.giuaX + 34, loaiMon.canh.duoi + 26] });

  // monan 1 --- n cart
  s += v.noiBang([[monAn.canh.giuaX, monAn.canh.duoi], [monAn.canh.giuaX, cart.canh.tren]],
    { nhan: 'chọn', viTriNhan: [monAn.canh.giuaX + 32, monAn.canh.duoi + 26] });

  // monan 1 --- n hopdong
  s += v.noiBang([
    [monAn.canh.phai, monAn.y + 60], [265, monAn.y + 60], [265, hopDong.y + 200],
    [hopDong.canh.trai, hopDong.y + 200],
  ], { nhan: 'gồm món', viTriNhan: [420, hopDong.y + 194] });

  // khach_hang 1 --- n hopdong
  s += v.noiBang([[khachHang.canh.phai, khachHang.y + 60], [hopDong.canh.trai, khachHang.y + 60]],
    { nhan: 'đặt', viTriNhan: [(khachHang.canh.phai + hopDong.canh.trai) / 2, khachHang.y + 52] });

  // vitri 1 --- n ban
  s += v.noiBang([[viTri.canh.giuaX, viTri.canh.duoi], [viTri.canh.giuaX, ban.canh.tren]],
    { nhan: 'khu', viTriNhan: [viTri.canh.giuaX + 28, viTri.canh.duoi + 26] });

  // ban 1 --- n hopdong
  s += v.noiBang([
    [ban.canh.phai, ban.y + 60], [545, ban.y + 60], [545, hopDong.y + 260],
    [hopDong.canh.trai, hopDong.y + 260],
  ], { nhan: 'phục vụ tại', viTriNhan: [478, ban.y + 52] });

  // qr_tables --- ban (noi qua ten ban, khong phai khoa ngoai that)
  s += v.noiBang([
    [qrTables.canh.phai, qrTables.y + 56], [ban.canh.giuaX - 34, qrTables.y + 56],
    [ban.canh.giuaX - 34, ban.canh.duoi],
  ], { dau: 'mot', cuoi: 'mot', nhan: 'table_name = number_ban', viTriNhan: [265, qrTables.y + 48] });

  // hopdong 1 --- n payments (noi theo sesis)
  s += v.noiBang([[hopDong.canh.phai, hopDong.y + 90], [payments.canh.trai, hopDong.y + 90]],
    { nhan: 'sesis', viTriNhan: [(hopDong.canh.phai + payments.canh.trai) / 2, hopDong.y + 82] });

  // payment_methods 1 --- n payments
  s += v.noiBang([[pttt.canh.giuaX, pttt.canh.tren], [pttt.canh.giuaX, payments.canh.duoi]],
    { dau: 'mot', cuoi: 'nhieu', nhan: 'hình thức', viTriNhan: [pttt.canh.giuaX + 46, pttt.canh.tren - 12] });

  // giao_dich_ngan_hang --- payments (doi soat qua ma noi dung chuyen khoan)
  s += v.noiBang([
    [gdnh.canh.trai, gdnh.y + 40], [860, gdnh.y + 40], [860, payments.y + 148],
    [payments.canh.trai, payments.y + 148],
  ], { dau: 'mot', cuoi: 'mot', nhan: 'đối soát theo ma_doi_soat', viTriNhan: [768, gdnh.y + 32] });

  // discount_codes --- payments (ma giam gia ap cho phien tra tien)
  s += v.noiBang([
    [dcodes.canh.trai, dcodes.y + 40], [845, dcodes.y + 40], [845, payments.y + 186],
    [payments.canh.trai, payments.y + 186],
  ], { dau: 'mot', cuoi: 'nhieu', nhan: 'giảm giá', viTriNhan: [800, dcodes.y + 32] });

  s += v.ghiChu(30, 748, [
    'Mỗi dòng hopdong là MỘT MÓN, không phải một hoá đơn. Các dòng cùng một lần đặt dùng chung mã phiên sesis, nhờ vậy mỗi món',
    'giữ được trạng thái bếp riêng (trangthai_bep) trong khi cả đơn vẫn có một trạng thái chung (tinhtrang).',
  ]);

  return v.khung(id, 1250, 790,
    'Lược đồ quan hệ thực thể của phân hệ bán hàng: thực đơn, đơn hàng, bàn và thanh toán', s);
}

/* ======================================================================== */
/* 2. PHAN HE KHO VA DU BAO NGUYEN LIEU                                     */
/* ======================================================================== */

function kho() {
  const id = 'erdB';
  let s = '';

  // Cot A: mua hang
  const dmh = v.hopBang(30, 40, 'don_mua_hang', [
    'PK id_dmh', 'ma_don', 'FK id_ncc', 'trang_thai', 'ngay_giao_du_kien', 'tong_tien',
    'FK id_nv_tao', 'FK id_nv_duyet', 'duyet_luc',
  ]);
  const ctdm = v.hopBang(30, 300, 'chi_tiet_don_mua', [
    'PK id', 'FK id_dmh', 'FK id_nl', 'so_luong', 'don_gia', 'so_luong_da_nhan',
  ]);
  // Cot B: nha cung cap, phieu nhap theo lo
  const ncc = v.hopBang(320, 40, 'nha_cung_cap', [
    'PK id_ncc', 'ten_ncc', 'sodienthoai', 'email', 'danh_gia', 'trangthai',
  ]);
  const phieuNhap = v.hopBang(320, 250, 'phieu_nhap', [
    'PK id_pn', 'ma_phieu', 'FK id_ncc', 'FK id_dmh', 'FK id_nv', 'thoi_diem', 'tong_tien',
  ]);
  const ctpn = v.hopBang(320, 470, 'chi_tiet_phieu_nhap', [
    'PK id_ct', 'FK id_pn', 'FK id_nl', 'so_luong', 'gia_nhap', 'so_lo',
    'han_su_dung', 'so_luong_con_lai',
  ]);
  // Cot C: nguyen lieu, cong thuc
  const dvt = v.hopBang(700, 40, 'don_vi_tinh', ['PK id_dvt', 'ten_dvt', 'ky_hieu']);
  const nl = v.hopBang(700, 175, 'nguyen_lieu', [
    'PK id_nl', 'ten_nl', 'FK id_dvt', 'so_luong', 'dinh_muc_min', 'gia_von', 'han_su_dung_ngay',
  ]);
  const congThuc = v.hopBang(700, 410, 'cong_thuc', [
    'PK id_ct', 'FK id_mon', 'FK id_nl', 'so_luong_tieu_hao',
  ]);
  const monAn = v.hopBang(700, 570, 'monan', ['PK id_mon', 'name_mon', 'gia_mon'], { lop: 'phu' });
  // Cot D: xuat kho
  const phieuXuat = v.hopBang(1030, 40, 'phieu_xuat', [
    'PK id_px', 'ma_phieu', 'ly_do', 'FK id_nv', 'thoi_diem', 'tong_gia_tri',
  ]);
  const xuatKho = v.hopBang(1030, 200, 'xuat_kho', [
    'PK id_xk', 'FK id_nl', 'FK id_mon', 'FK id_px', 'sesis', 'so_luong', 'gia_tri', 'ly_do', 'ngay_xuat',
  ]);
  // Cot E: ket qua hoc may
  const dbnl = v.hopBang(1330, 40, 'du_bao_nguyen_lieu', [
    'PK id', 'ngay_du_bao', 'FK id_nl', 'so_luong_can', 'ton_hien_tai', 'can_nhap_them', 'mo_hinh',
  ]);
  const dblk = v.hopBang(1330, 230, 'du_bao_luot_khach', [
    'PK id', 'ngay_du_bao', 'so_khach_du_bao', 'can_duoi', 'can_tren', 'mo_hinh',
  ]);
  const dgmh = v.hopBang(1330, 400, 'danh_gia_mo_hinh', [
    'PK id', 'bai_toan', 'mo_hinh', 'mae', 'rmse', 'mape', 'r2',
  ]);
  const lkh = v.hopBang(1330, 580, 'luat_ket_hop', [
    'PK id', 'mon_ve_trai', 'FK mon_ve_phai', 'do_ho_tro', 'do_tin_cay', 'do_nang',
  ]);

  [dmh, ctdm, ncc, phieuNhap, ctpn, dvt, nl, congThuc, monAn, phieuXuat, xuatKho, dbnl, dblk, dgmh, lkh]
    .forEach((b) => { s += b.svg; });

  // nha_cung_cap 1 --- n don_mua_hang
  s += v.noiBang([[ncc.canh.trai, 100], [dmh.canh.phai, 100]],
    { nhan: 'nhận đơn', viTriNhan: [(ncc.canh.trai + dmh.canh.phai) / 2, 92] });
  // don_mua_hang 1 --- n chi_tiet_don_mua
  s += v.noiBang([[dmh.canh.giuaX, dmh.canh.duoi], [dmh.canh.giuaX, ctdm.canh.tren]],
    { nhan: 'gồm', viTriNhan: [dmh.canh.giuaX + 28, dmh.canh.duoi + 26] });
  // don_mua_hang 1 --- n phieu_nhap (nhan hang nhieu dot)
  s += v.noiBang([[dmh.canh.phai, 180], [290, 180], [290, phieuNhap.y + 60], [phieuNhap.canh.trai, phieuNhap.y + 60]],
    { nhan: 'nhận theo đơn', viTriNhan: [250, 240] });
  // nha_cung_cap 1 --- n phieu_nhap
  s += v.noiBang([[ncc.canh.giuaX, ncc.canh.duoi], [ncc.canh.giuaX, phieuNhap.canh.tren]],
    { nhan: 'cung cấp', viTriNhan: [ncc.canh.giuaX + 44, ncc.canh.duoi + 26] });
  // phieu_nhap 1 --- n chi_tiet_phieu_nhap
  s += v.noiBang([[phieuNhap.canh.giuaX, phieuNhap.canh.duoi], [phieuNhap.canh.giuaX, ctpn.canh.tren]],
    { nhan: 'gồm lô', viTriNhan: [phieuNhap.canh.giuaX + 38, phieuNhap.canh.duoi + 26] });
  // don_vi_tinh 1 --- n nguyen_lieu
  s += v.noiBang([[dvt.canh.giuaX, dvt.canh.duoi], [dvt.canh.giuaX, nl.canh.tren]],
    { nhan: 'đơn vị', viTriNhan: [dvt.canh.giuaX + 38, dvt.canh.duoi + 22] });
  // nguyen_lieu 1 --- n chi_tiet_phieu_nhap
  s += v.noiBang([[nl.canh.trai, nl.y + 60], [665, nl.y + 60], [665, ctpn.y + 96], [ctpn.canh.phai, ctpn.y + 96]],
    { nhan: 'nhập theo lô', viTriNhan: [612, ctpn.y + 88] });
  // nguyen_lieu 1 --- n chi_tiet_don_mua
  s += v.noiBang([[nl.canh.trai, nl.y + 130], [640, nl.y + 130], [640, 450], [250, 450], [250, ctdm.y + 100],
    [ctdm.canh.phai, ctdm.y + 100]], { nhan: 'đặt mua', viTriNhan: [560, 442] });
  // nguyen_lieu 1 --- n cong_thuc
  s += v.noiBang([[nl.canh.giuaX, nl.canh.duoi], [nl.canh.giuaX, congThuc.canh.tren]],
    { nhan: 'định lượng', viTriNhan: [nl.canh.giuaX + 52, nl.canh.duoi + 22] });
  // monan 1 --- n cong_thuc
  s += v.noiBang([[monAn.canh.giuaX, monAn.canh.tren], [monAn.canh.giuaX, congThuc.canh.duoi]],
    { nhan: 'công thức của', viTriNhan: [monAn.canh.giuaX + 62, monAn.canh.tren - 12] });
  // nguyen_lieu 1 --- n xuat_kho
  s += v.noiBang([[nl.canh.phai, nl.y + 60], [xuatKho.canh.trai, nl.y + 60]],
    { nhan: 'tiêu hao', viTriNhan: [(nl.canh.phai + xuatKho.canh.trai) / 2, nl.y + 52] });
  // phieu_xuat 1 --- n xuat_kho
  s += v.noiBang([[phieuXuat.canh.giuaX, phieuXuat.canh.duoi], [phieuXuat.canh.giuaX, xuatKho.canh.tren]],
    { nhan: 'gồm dòng', viTriNhan: [phieuXuat.canh.giuaX + 46, phieuXuat.canh.duoi + 22] });
  // nguyen_lieu 1 --- n du_bao_nguyen_lieu (vong qua mep tren)
  s += v.noiBang([[nl.canh.phai, nl.y + 20], [995, nl.y + 20], [995, 20], [1300, 20], [1300, dbnl.y + 60],
    [dbnl.canh.trai, dbnl.y + 60]], { nhan: 'dự báo cho', viTriNhan: [1150, 14] });
  // monan 1 --- n xuat_kho
  s += v.noiBang([[monAn.canh.phai, monAn.y + 30], [995, monAn.y + 30], [995, xuatKho.canh.duoi + 30],
    [xuatKho.canh.giuaX, xuatKho.canh.duoi + 30], [xuatKho.canh.giuaX, xuatKho.canh.duoi]],
  { nhan: 'bán món nào', viTriNhan: [1180, xuatKho.canh.duoi + 24] });
  // monan 1 --- n luat_ket_hop
  s += v.noiBang([[monAn.canh.phai, monAn.y + 56], [lkh.canh.trai, monAn.y + 56]],
    { nhan: 'món được gợi ý', viTriNhan: [1180, monAn.y + 48] });

  s += v.ghiChu(30, 728, [
    'Vòng mua hàng: don_mua_hang (chờ duyệt → đã duyệt → đã đặt → nhận một phần / đã nhận) sinh ra một hoặc nhiều phieu_nhap; mỗi dòng',
    'chi_tiet_phieu_nhap là MỘT LÔ có hạn dùng riêng, so_luong_con_lai bị trừ theo hạn dùng sớm nhất trước. xuat_kho ghi cả tiêu hao do bán món',
    '(id_mon, sesis) lẫn phiếu xuất hỏng / hao hụt (id_px). Bốn bảng cột phải lưu KẾT QUẢ của phần học máy, không tham gia nghiệp vụ hằng ngày.',
  ]);

  return v.khung(id, 1560, 780,
    'Lược đồ quan hệ thực thể của phân hệ kho: mua hàng, nhập theo lô, định lượng công thức, xuất kho và các bảng kết quả học máy', s);
}

/* ======================================================================== */
/* 3. PHAN HE NHAN SU, CHAM CONG VA SINH TRAC HOC                           */
/* ======================================================================== */

function nhanSu() {
  const id = 'erdC';
  let s = '';

  const boPhan = v.hopBang(30, 40, 'bo_phan', [
    'PK id_bp', 'ma_bp', 'ten_bp', 'mau_sac', 'thu_tu', 'trang_thai',
  ]);
  const chucDanh = v.hopBang(30, 250, 'chuc_danh', [
    'PK id_cd', 'ma_cd', 'ten_cd', 'FK id_bp', 'cap_bac', 'FK id_cd_cha', 'la_quan_ly',
  ]);
  const quyen = v.hopBang(30, 500, 'quyen', ['PK id_quyen', 'ma_quyen', 'ten_quyen', 'nhom']);

  const cdQuyen = v.hopBang(330, 500, 'chuc_danh_quyen', [
    'PK id', 'FK id_cd', 'FK id_quyen', 'duoc_phep',
  ]);
  const nhanVien = v.hopBang(330, 40, 'nhan_vien', [
    'PK id_nv', 'ten', 'sodienthoai', 'email', 'FK id_cd', 'chucvu', 'username',
    'passwords', 'ngayvaolam', 'trangthai',
  ]);
  const uyQuyen = v.hopBang(330, 320, 'uy_quyen', [
    'PK id', 'FK id_nv_giao', 'FK id_nv_nhan', 'tu_ngay', 'den_ngay',
  ]);

  const chamCong = v.hopBang(660, 40, 'cham_cong', [
    'PK id', 'FK id_nv', 'ngay', 'gio_vao', 'gio_ra', 'so_gio', 'phuong_thuc',
  ]);
  const lichLam = v.hopBang(660, 250, 'lich_lam_viec', [
    'PK id', 'FK id_nv', 'ngay', 'ca', 'trang_thai',
  ]);
  const nghiPhep = v.hopBang(660, 410, 'nghi_phep', [
    'PK id', 'FK id_nv', 'tu_ngay', 'den_ngay', 'ly_do', 'trang_thai',
  ]);
  const luong = v.hopBang(660, 590, 'luong', [
    'PK id', 'FK id_nv', 'thang', 'luong_co_ban', 'phu_cap', 'thuc_linh',
  ]);

  const khuonMat = v.hopBang(990, 40, 'khuon_mat_nv', [
    'PK id', 'FK id_nv', 'vector_dac_trung', 'so_chieu', 'duong_dan_anh',
    'do_net', 'dang_dung',
  ]);
  const nhatKy = v.hopBang(990, 270, 'nhat_ky_nhan_dien', [
    'PK id', 'FK id_nv', 'ket_qua', 'do_tuong_dong', 'ly_do', 'thoi_diem',
  ]);
  const ccGps = v.hopBang(990, 460, 'cham_cong_gps', [
    'PK id', 'FK id_nv', 'vi_do', 'kinh_do', 'khoang_cach_m', 'hop_le', 'anh_selfie',
  ]);

  [boPhan, chucDanh, quyen, cdQuyen, nhanVien, uyQuyen, chamCong, lichLam,
    nghiPhep, luong, khuonMat, nhatKy, ccGps].forEach((b) => { s += b.svg; });

  s += v.noiBang([[boPhan.canh.giuaX, boPhan.canh.duoi], [boPhan.canh.giuaX, chucDanh.canh.tren]],
    { nhan: 'gồm chức danh', viTriNhan: [boPhan.canh.giuaX + 62, boPhan.canh.duoi + 26] });

  // chuc_danh tu tham chieu chinh no (cap tren truc tiep)
  s += v.noiBang([
    [chucDanh.canh.trai, chucDanh.y + 100], [12, chucDanh.y + 100],
    [12, chucDanh.y + 140], [chucDanh.canh.trai, chucDanh.y + 140],
  ], { dau: 'mot', cuoi: 'nhieu', nhan: 'cấp trên', viTriNhan: [52, chucDanh.y + 156] });

  // chuc_danh 1 --- n nhan_vien
  s += v.noiBang([
    [chucDanh.canh.phai, chucDanh.y + 60], [290, chucDanh.y + 60],
    [290, nhanVien.y + 190], [nhanVien.canh.trai, nhanVien.y + 190],
  ], { nhan: 'giữ chức danh', viTriNhan: [225, chucDanh.y + 52] });

  // quyen n --- chuc_danh_quyen --- chuc_danh (bang noi)
  s += v.noiBang([[quyen.canh.phai, quyen.y + 56], [cdQuyen.canh.trai, quyen.y + 56]], {});
  // Vong ra ngoai cot trai o x = 235: di thang xuong se cat qua bang `quyen`.
  s += v.noiBang([
    [chucDanh.canh.phai, chucDanh.y + 130], [235, chucDanh.y + 130],
    [235, cdQuyen.y + 56], [cdQuyen.canh.trai, cdQuyen.y + 56],
  ], { nhan: 'được cấp quyền', viTriNhan: [235, chucDanh.y + 122] });

  // nhan_vien --- uy_quyen (hai khoa ngoai: nguoi giao va nguoi nhan)
  s += v.noiBang([[nhanVien.canh.giuaX - 40, nhanVien.canh.duoi], [nhanVien.canh.giuaX - 40, uyQuyen.canh.tren]],
    { nhan: 'uỷ quyền', viTriNhan: [nhanVien.canh.giuaX - 88, nhanVien.canh.duoi + 24] });

  // nhan_vien 1 --- n cac bang cham cong / lich / nghi phep / luong
  // Nhan dat o GIUA DOAN NGANG DAU TIEN (giua mep hop nguon va cot doc noi),
  // la cho chac chan khong co hop nao - dat gan hop dich thi chu de len bang.
  const noiPhai = (b, yNguon, nhan) => v.noiBang(
    [[nhanVien.canh.phai, yNguon], [640, yNguon], [640, b.y + 44], [b.canh.trai, b.y + 44]],
    { nhan, viTriNhan: [(nhanVien.canh.phai + 640) / 2, yNguon - 8] }
  );
  s += noiPhai(chamCong, nhanVien.y + 60, 'chấm công');
  s += noiPhai(lichLam, nhanVien.y + 90, 'đăng ký ca');
  s += noiPhai(nghiPhep, nhanVien.y + 120, 'xin nghỉ');
  s += noiPhai(luong, nhanVien.y + 150, 'bảng lương');

  /*
   * nhan_vien 1 --- n cac bang sinh trac hoc.
   *
   * Ba bang nay deu co khoa ngoai id_nv tro ve `nhan_vien` chu khong phai ve
   * `cham_cong`, nen duong noi phai xuat phat tu nhan_vien. Duong di vong
   * xuong hanh lang trong o y ~ 370 (giua lich_lam_viec va nghi_phep) roi moi
   * di sang phai, vi di thang se cat qua cot bang cham cong o giua.
   */
  const noiXa = (b, i, nhan) => {
    const xRoi = 560 + i * 30;          // cho roi khoi canh duoi nhan_vien
    const yNgang = 382 + i * 9;         // hanh lang ngang rieng cho tung duong
    const xDoc = 930 + i * 20;          // cot doc rieng cho tung duong
    const yVao = b.y + 44;
    return v.noiBang([
      [xRoi, nhanVien.canh.duoi], [xRoi, yNgang], [xDoc, yNgang],
      [xDoc, yVao], [b.canh.trai, yVao],
    ], { nhan, viTriNhan: [(xRoi + xDoc) / 2, yNgang - 8] });
  };
  s += noiXa(khuonMat, 0, 'mẫu khuôn mặt');
  s += noiXa(nhatKy, 1, 'nhật ký nhận diện');
  s += noiXa(ccGps, 2, 'vị trí chấm công');

  s += v.ghiChu(30, 730, [
    'Quyền hiệu lực của một người đến từ ba nguồn cộng lại: quyền của chức danh (chuc_danh_quyen), quyền cấp riêng cho cá nhân',
    '(quyen_nhan_vien) và quyền tạm nhận khi được uỷ quyền trong một khoảng thời gian (uy_quyen).',
  ]);

  return v.khung(id, 1290, 770,
    'Lược đồ quan hệ thực thể của phân hệ nhân sự: cơ cấu tổ chức, phân quyền, chấm công và dữ liệu sinh trắc học', s);
}

/* ======================================================================== */
/* 4. PHAN HE GIAO HANG                                                     */
/* ======================================================================== */

// Chieu cao mot hop = 30 + 16 * so_cot. Toa do dat theo do cao thuc te cua
// tung hop de duong noi ngang luon chay qua khoang trong giua cac hop.
function giaoHang() {
  const id = 'erdD';
  let s = '';

  // Cot 1 -------------------------------------------------- y 40..230
  const dvvc = v.hopBang(30, 40, 'don_vi_van_chuyen', [
    'PK id_dv', 'ma_dv', 'ten_dv', 'loai', 'phi_co_ban', 'so_km_dau',
    'phi_moi_km', 'ban_kinh_km', 'thu_tu', 'trang_thai',
  ]);
  const nhanVien = v.hopBang(30, 430, 'nhan_vien', [
    'PK id_nv', 'ten', 'sodienthoai', 'FK id_cd',
  ]);
  const hopDong = v.hopBang(30, 600, 'hopdong', [
    'PK id', 'sesis', 'FK id_mon', 'loai_don', 'tinhtrang',
  ]);

  // Cot 2 -------------------------------------------------- y 40..230
  const shipper = v.hopBang(370, 40, 'shipper', [
    'PK id_shipper', 'FK id_dv', 'FK id_nv', 'ten', 'sdt', 'loai_xe',
    'bien_so', 'so_don_toi_da', 'trang_thai', 'tong_don',
  ]);

  // Cot 3 -------------------------------------------------- y 40..374
  const donGiao = v.hopBang(710, 40, 'don_giao_hang', [
    'PK id_giao', 'FK sesis', 'ma_giao', 'FK id_dv', 'FK id_shipper',
    'ten_nguoi_nhan', 'sdt_nguoi_nhan', 'dia_chi_giao', 'vi_do', 'kinh_do',
    'khoang_cach_km', 'phi_giao', 'tien_thu_ho', 'trang_thai',
    'FK id_nv_phan', 'ma_khu_vuc', 'phan_tu_dong', 'phan_luc', 'xac_nhan_luc',
    'lay_luc', 'giao_luc', 'hoan_tat_luc',
  ]);

  // Cot 4 -------------------------------------------------- 40..214 / 300..490 / 540..666
  const nhatKy = v.hopBang(1040, 40, 'nhat_ky_giao_hang', [
    'PK id', 'FK id_giao', 'tu_trang_thai', 'den_trang_thai', 'FK id_nv',
    'ten_nguoi', 'vi_do', 'kinh_do', 'luc',
  ]);
  const viTri = v.hopBang(1040, 300, 'vi_tri_shipper', [
    'PK id', 'FK id_shipper', 'FK id_giao', 'vi_do', 'kinh_do',
    'do_chinh_xac_m', 'toc_do_kmh', 'huong', 'pin', 'luc',
  ]);
  const viTriMoi = v.hopBang(1040, 540, 'vi_tri_shipper_moi_nhat', [
    'PK id_shipper', 'FK id_giao', 'vi_do', 'kinh_do', 'do_chinh_xac_m', 'luc',
  ]);

  // Cot 5: phan cong va khu vuc giao (migration 035)
  const phanCong = v.hopBang(1330, 330, 'phan_cong_giao', [
    'PK id', 'FK id_giao', 'FK id_shipper', 'kieu', 'ket_qua', 'ly_do_chon', 'tao_luc', 'phan_hoi_luc',
  ]);
  const khuVuc = v.hopBang(1330, 150, 'khu_vuc_giao', [
    'PK id_kv', 'ma', 'ten', 'da_giac', 'bat', 'mau',
  ]);

  [dvvc, nhanVien, hopDong, shipper, donGiao, nhatKy, viTri, viTriMoi, phanCong, khuVuc]
    .forEach((b) => { s += b.svg; });

  /* --- quan he --- */

  // don_vi_van_chuyen 1 --- n shipper
  s += v.noiBang([[dvvc.canh.phai, 100], [shipper.canh.trai, 100]],
    { nhan: 'thuộc', viTriNhan: [(dvvc.canh.phai + shipper.canh.trai) / 2, 92] });

  // don_vi_van_chuyen 1 --- n don_giao_hang: vong len tren dinh hai hop
  s += v.noiBang([
    [dvvc.canh.giuaX, dvvc.canh.tren], [dvvc.canh.giuaX, 18],
    [donGiao.canh.giuaX, 18], [donGiao.canh.giuaX, donGiao.canh.tren],
  ], { nhan: 'nhận giao', viTriNhan: [(dvvc.canh.giuaX + donGiao.canh.giuaX) / 2, 12] });

  // nhan_vien 1 --- 1 shipper: mot nhan vien co toi da mot ho so nguoi giao
  s += v.noiBang([
    [nhanVien.canh.phai, 474], [300, 474], [300, 200], [shipper.canh.trai, 200],
  ], { cuoi: 'mot', nhan: 'lập hồ sơ', viTriNhan: [246, 466] });

  // shipper 1 --- n don_giao_hang
  s += v.noiBang([[shipper.canh.phai, 170], [donGiao.canh.trai, 170]],
    { nhan: 'cầm', viTriNhan: [(shipper.canh.phai + donGiao.canh.trai) / 2, 162] });

  // hopdong 1 --- 1 don_giao_hang: moi phien don hang sinh toi da mot don giao
  s += v.noiBang([
    [hopDong.canh.phai, 650], [650, 650], [650, 340], [donGiao.canh.trai, 340],
  ], { cuoi: 'mot', nhan: 'phát sinh từ', viTriNhan: [650, 642] });

  // don_giao_hang 1 --- n nhat_ky_giao_hang
  s += v.noiBang([[donGiao.canh.phai, 100], [nhatKy.canh.trai, 100]],
    { nhan: 'ghi vết', viTriNhan: [(donGiao.canh.phai + nhatKy.canh.trai) / 2, 92] });

  // shipper 1 --- n vi_tri_shipper (vet duong: them mot dong moi nhip)
  const xVet = shipper.canh.giuaX - 28;
  s += v.noiBang([
    [xVet, shipper.canh.duoi], [xVet, 470], [viTri.canh.trai, 470],
  ], { nhan: 'vết đường', viTriNhan: [xVet + 90, 462] });

  // shipper 1 --- 1 vi_tri_shipper_moi_nhat (ghi de, moi nguoi giao mot dong)
  const xMoi = shipper.canh.giuaX + 50;
  s += v.noiBang([
    [xMoi, shipper.canh.duoi], [xMoi, 596], [viTriMoi.canh.trai, 596],
  ], { cuoi: 'mot', nhan: 'vị trí hiện tại', viTriNhan: [xMoi + 110, 588] });

  // don_giao_hang 1 --- n phan_cong_giao (moi lan moi / go don la mot dong)
  s += v.noiBang([[donGiao.canh.phai, 268], [1300, 268], [1300, 400], [phanCong.canh.trai, 400]],
    { nhan: 'lượt phân', viTriNhan: [1262, 392] });
  // khu_vuc_giao 1 --- n don_giao_hang (theo ma_khu_vuc)
  s += v.noiBang([[khuVuc.canh.trai, 232], [donGiao.canh.phai, 232]],
    { dau: 'mot', cuoi: 'nhieu', nhan: 'thuộc khu (ma_khu_vuc)', viTriNhan: [1196, 224] });
  // shipper 1 --- n phan_cong_giao: vong duoi day hinh
  s += v.noiBang([[shipper.x + 8, shipper.canh.duoi], [shipper.x + 8, 768], [phanCong.canh.giuaX, 768],
    [phanCong.canh.giuaX, phanCong.canh.duoi]], { nhan: 'shipper được mời nhận đơn', viTriNhan: [1200, 760] });

  s += v.ghiChu(410, 726, [
    'Hai bảng vị trí cố ý không gộp: vi_tri_shipper thêm một dòng mỗi nhịp để trả lời "đã đi đường nào"; vi_tri_shipper_moi_nhat ghi đè,',
    'mỗi người giao đúng một dòng, để bản đồ trả lời "đang ở đâu" mà không phải quét cả vết đường.',
  ]);

  return v.khung(id, 1560, 790,
    'Lược đồ quan hệ thực thể của phân hệ giao hàng: đơn vị vận chuyển, hồ sơ người giao, đơn giao kèm nhật ký chuyển trạng thái và hai bảng vị trí', s);
}

/* ======================================================================== */
/* 5. PHAN HE DAT BAN VA DAT TIEC                                           */
/* ======================================================================== */

/**
 * Dat ban le (reservations) va dat tiec (dat_tiec) la hai luong tach biet:
 * dat ban giu BAN theo o 15 phut, dat tiec giu ca SANH (vitri) theo buoi.
 * Toa do cac cot tinh tu be rong that cua hop ben trai de khong phai uoc luong.
 */
function datBanTiec() {
  const id = 'erdE';
  let s = '';
  const KHE = 120;   // khoang trong giua hai cot, du cho nhan quan he

  // Cot 1: ho so khach + hai bang cau hinh luat
  const rc = v.hopBang(30, 40, 'reservation_customers', [
    'PK phone', 'FK customer_id', 'full_name', 'customer_type', 'total_reservations',
    'no_show_count', 'cancelled_count', 'is_blocked',
  ]);
  const rules = v.hopBang(30, 290, 'reservation_deposit_rules', [
    'PK id', 'name', 'applies_to', 'min_guests', 'from_time', 'to_time', 'amount_type', 'amount', 'priority',
  ], { lop: 'phu' });
  const cancel = v.hopBang(30, 520, 'cancellation_policies', [
    'PK id', 'name', 'hours_before', 'refund_percent', 'applies_to',
  ], { lop: 'phu' });

  // Cot 2: luot dat ban
  const x2 = Math.max(rc.x + rc.w, rules.x + rules.w) + KHE;
  const rsv = v.hopBang(x2, 40, 'reservations', [
    'PK id', 'reservation_code', 'FK customer_id', 'phone', 'customer_name', 'reservation_date',
    'start_time', 'expected_end_time', 'guest_count', 'FK area_id', 'source', 'status',
    'deposit_status', 'deposit_amount', 'deposit_due_at', 'hold_until', 'refund_amount',
  ]);

  // Cot 3: cac bang con cua reservations
  const x3 = rsv.x + rsv.w + KHE + 20;
  const rt = v.hopBang(x3, 40, 'reservation_tables', ['PF reservation_id', 'PF table_id']);
  const lock = v.hopBang(x3, 140, 'reservation_slot_locks', ['PF table_id', 'PK slot_start', 'FK reservation_id']);
  const pre = v.hopBang(x3, 270, 'reservation_preorders', [
    'PK id', 'FK reservation_id', 'FK dish_id', 'dish_name', 'price', 'quantity', 'note',
  ]);
  const dep = v.hopBang(x3, 450, 'reservation_deposits', [
    'PK id', 'FK reservation_id', 'amount', 'status', 'paid_at', 'refunded_at', 'transaction_id',
  ]);
  const his = v.hopBang(x3, 630, 'reservation_history', [
    'PK id', 'FK reservation_id', 'from_status', 'to_status', 'note', 'changed_by',
  ]);

  // Cot 4: ban, khu vuc / sanh, mon an (bang dung chung voi phan he khac)
  const x4 = Math.max(rt.x + rt.w, lock.x + lock.w, pre.x + pre.w, dep.x + dep.w) + KHE;
  const ban = v.hopBang(x4, 40, 'ban', ['PK Id_ban', 'FK id_vitri', 'number_ban', 'so_cho', 'trangthai'], { lop: 'phu' });
  const vitri = v.hopBang(x4, 230, 'vitri', ['PK id_vitri', 'name_vitri', 'tiec_toi_thieu', 'tiec_toi_da'], { lop: 'phu' });
  const mon = v.hopBang(x4, 350, 'monan', ['PK id_mon', 'name_mon', 'gia_mon'], { lop: 'phu' });

  // Cot 5: dat tiec
  const x5 = Math.max(ban.x + ban.w, vitri.x + vitri.w) + KHE;
  const tiec = v.hopBang(x5, 40, 'dat_tiec', [
    'PK id', 'ma_tiec', 'FK customer_id', 'ho_ten', 'so_dien_thoai', 'loai_tiec', 'ngay_to_chuc', 'buoi',
    'so_khach', 'so_ban', 'FK khu_vuc_id', 'FK thuc_don_id', 'tong_du_toan', 'trang_thai', 'FK nhan_vien_xu_ly',
  ]);
  const tdt = v.hopBang(x5, 340, 'thuc_don_tiec', ['PK id', 'ma', 'loai_tiec', 'ten', 'gia_ban']);
  const ttt = v.hopBang(x5, 480, 'dat_tiec_thanh_toan', [
    'PK id', 'FK dat_tiec_id', 'so_tien', 'phuong_thuc', 'ma_giao_dich', 'nguoi_ghi_nhan',
  ]);
  const lst = v.hopBang(x5, 640, 'dat_tiec_lich_su', [
    'PK id', 'FK dat_tiec_id', 'tu_trang_thai', 'den_trang_thai', 'nguoi_doi',
  ]);

  [rc, rules, cancel, rsv, rt, lock, pre, dep, his, ban, vitri, mon, tiec, tdt, ttt, lst]
    .forEach((b) => { s += b.svg; });

  const giua = (a, b) => (a + b) / 2;

  // reservation_customers 1 --- n reservations (khop theo so dien thoai)
  s += v.noiBang([[rc.canh.phai, 100], [rsv.canh.trai, 100]],
    { nhan: 'theo SĐT', viTriNhan: [giua(rc.canh.phai, rsv.canh.trai), 92] });

  // reservations 1 --- n cac bang con
  s += v.noiBang([[rsv.canh.phai, 70], [rt.canh.trai, 70]],
    { nhan: 'xếp bàn', viTriNhan: [giua(rsv.canh.phai, rt.canh.trai), 62] });
  s += v.noiBang([[rsv.canh.phai, 190], [lock.canh.trai, 190]],
    { nhan: 'giữ ô 15 phút', viTriNhan: [giua(rsv.canh.phai, lock.canh.trai), 182] });
  s += v.noiBang([[rsv.canh.phai, 320], [pre.canh.trai, 320]],
    { nhan: 'món đặt trước', viTriNhan: [giua(rsv.canh.phai, pre.canh.trai), 312] });
  const xDep = rsv.x + rsv.w - 30;
  const xHis = rsv.x + rsv.w - 60;
  s += v.noiBang([[xDep, rsv.canh.duoi], [xDep, dep.y + 60], [dep.canh.trai, dep.y + 60]],
    { nhan: 'tiền cọc', viTriNhan: [giua(xDep, dep.canh.trai), dep.y + 52] });
  s += v.noiBang([[xHis, rsv.canh.duoi], [xHis, his.y + 50], [his.canh.trai, his.y + 50]],
    { nhan: 'lịch sử trạng thái', viTriNhan: [giua(xHis, his.canh.trai) + 10, his.y + 42] });

  // ban 1 --- n reservation_tables, ban 1 --- n reservation_slot_locks
  s += v.noiBang([[ban.canh.trai, 70], [rt.canh.phai, 70]], { nhan: 'bàn', viTriNhan: [giua(rt.canh.phai, ban.canh.trai), 62] });
  const xKhoa = ban.x - 40;
  s += v.noiBang([[ban.canh.trai, 120], [xKhoa, 120], [xKhoa, 190], [lock.canh.phai, 190]],
    { nhan: 'bị khoá', viTriNhan: [giua(lock.canh.phai, xKhoa), 182] });

  // vitri 1 --- n ban
  s += v.noiBang([[vitri.canh.giuaX, vitri.canh.tren], [vitri.canh.giuaX, ban.canh.duoi]],
    { nhan: 'gồm bàn', viTriNhan: [vitri.canh.giuaX + 40, vitri.canh.tren - 14] });
  // vitri 1 --- n reservations (khu vuc mong muon): di qua khe giua lock va pre
  s += v.noiBang([[vitri.canh.trai, 250], [rsv.canh.phai, 250]],
    { dau: 'mot', cuoi: 'nhieu', nhan: 'khu vực', viTriNhan: [giua(rsv.canh.phai, lock.canh.trai), 242] });
  // monan 1 --- n reservation_preorders
  s += v.noiBang([[mon.canh.trai, 385], [pre.canh.phai, 385]],
    { nhan: 'món', viTriNhan: [giua(pre.canh.phai, mon.canh.trai), 377] });

  // vitri (sanh) 1 --- n dat_tiec
  s += v.noiBang([[vitri.canh.phai, 290], [tiec.canh.trai, 290]],
    { nhan: 'sảnh tổ chức', viTriNhan: [giua(vitri.canh.phai, tiec.canh.trai), 282] });
  // thuc_don_tiec 1 --- n dat_tiec
  s += v.noiBang([[tdt.canh.giuaX, tdt.canh.tren], [tdt.canh.giuaX, tiec.canh.duoi]],
    { nhan: 'thực đơn', viTriNhan: [tdt.canh.giuaX + 42, tdt.canh.tren - 14] });
  // dat_tiec 1 --- n thanh toan / lich su: vong ben phai
  const xP1 = tiec.x + Math.max(tiec.w, ttt.w, lst.w) + 30;
  const xP2 = xP1 + 22;
  s += v.noiBang([[tiec.canh.phai, 200], [xP1, 200], [xP1, ttt.y + 50], [ttt.canh.phai, ttt.y + 50]],
    { nhan: 'thu nhiều đợt', viTriNhan: [xP2 + 52, ttt.y + 30] });
  s += v.noiBang([[tiec.canh.phai, 230], [xP2, 230], [xP2, lst.y + 50], [lst.canh.phai, lst.y + 50]],
    { nhan: 'lịch sử', viTriNhan: [xP2 + 36, lst.y + 30] });

  const W = xP2 + 110;
  s += v.ghiChu(30, 790, [
    'reservation_slot_locks là "hàng rào" chống đặt trùng: mỗi dòng là một ô 15 phút của một bàn, khoá chính (table_id, slot_start) nên hai lượt đặt',
    'không thể cùng giữ một ô. reservation_deposit_rules và cancellation_policies là bảng cấu hình luật, không có khoá ngoại. Đặt tiệc giữ cả sảnh',
    '(vitri) theo buổi, chỉ đơn ĐÃ XÁC NHẬN / ĐÃ CỌC mới giữ chỗ; mỗi lần đổi trạng thái hay thu tiền đều để lại một dòng lịch sử.',
  ]);

  return v.khung(id, W, 840,
    'Lược đồ quan hệ thực thể của phân hệ đặt bàn và đặt tiệc: lượt đặt, khoá ô thời gian, món đặt trước, tiền cọc, đơn tiệc và các lần thu tiền', s);
}

module.exports = { banHang, kho, nhanSu, giaoHang, datBanTiec };

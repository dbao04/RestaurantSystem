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

  const ncc = v.hopBang(30, 40, 'nha_cung_cap', [
    'PK id_ncc', 'ten_ncc', 'sodienthoai', 'email', 'danh_gia', 'trangthai',
  ]);
  const phieuNhap = v.hopBang(30, 250, 'phieu_nhap', [
    'PK id_pn', 'ma_phieu', 'FK id_ncc', 'FK id_nv', 'ngay_nhap', 'tong_tien',
  ]);
  const ctpn = v.hopBang(30, 450, 'chi_tiet_phieu_nhap', [
    'PK id_ct', 'FK id_pn', 'FK id_nl', 'so_luong', 'gia_nhap', 'so_lo',
    'han_su_dung', 'so_luong_con_lai',
  ]);

  const dvt = v.hopBang(400, 40, 'don_vi_tinh', ['PK id_dvt', 'ten_dvt', 'ky_hieu']);
  const nl = v.hopBang(400, 175, 'nguyen_lieu', [
    'PK id_nl', 'ten_nl', 'FK id_dvt', 'so_luong', 'dinh_muc_min', 'gia_von',
  ]);
  const congThuc = v.hopBang(400, 400, 'cong_thuc', [
    'PK id_ct', 'FK id_mon', 'FK id_nl', 'so_luong_tieu_hao',
  ]);
  const monAn = v.hopBang(400, 570, 'monan', ['PK id_mon', 'name_mon', 'gia_mon'], { lop: 'phu' });

  const xuatKho = v.hopBang(730, 175, 'xuat_kho', [
    'PK id_xk', 'FK id_nl', 'FK id_mon', 'sesis', 'so_luong', 'ly_do', 'ngay_xuat',
  ]);
  const dbnl = v.hopBang(730, 420, 'du_bao_nguyen_lieu', [
    'PK id', 'ngay_du_bao', 'FK id_nl', 'so_luong_can', 'ton_hien_tai',
    'can_nhap_them', 'mo_hinh',
  ]);

  const dblk = v.hopBang(1030, 175, 'du_bao_luot_khach', [
    'PK id', 'ngay_du_bao', 'so_khach_du_bao', 'can_duoi', 'can_tren', 'mo_hinh',
  ]);
  const dgmh = v.hopBang(1030, 360, 'danh_gia_mo_hinh', [
    'PK id', 'bai_toan', 'mo_hinh', 'mae', 'rmse', 'mape', 'r2',
  ]);
  const lkh = v.hopBang(1030, 550, 'luat_ket_hop', [
    'PK id', 'mon_ve_trai', 'FK mon_ve_phai', 'do_ho_tro', 'do_tin_cay', 'do_nang',
  ]);

  [ncc, phieuNhap, ctpn, dvt, nl, congThuc, monAn, xuatKho, dbnl, dblk, dgmh, lkh]
    .forEach((b) => { s += b.svg; });

  s += v.noiBang([[ncc.canh.giuaX, ncc.canh.duoi], [ncc.canh.giuaX, phieuNhap.canh.tren]],
    { nhan: 'cung cấp', viTriNhan: [ncc.canh.giuaX + 44, ncc.canh.duoi + 26] });
  s += v.noiBang([[phieuNhap.canh.giuaX, phieuNhap.canh.duoi], [phieuNhap.canh.giuaX, ctpn.canh.tren]],
    { nhan: 'gồm lô', viTriNhan: [phieuNhap.canh.giuaX + 38, phieuNhap.canh.duoi + 26] });
  s += v.noiBang([[dvt.canh.giuaX, dvt.canh.duoi], [dvt.canh.giuaX, nl.canh.tren]],
    { nhan: 'đơn vị', viTriNhan: [dvt.canh.giuaX + 38, dvt.canh.duoi + 22] });

  // nguyen_lieu 1 --- n chi_tiet_phieu_nhap (nhap theo lo)
  s += v.noiBang([
    [nl.canh.trai, nl.y + 60], [355, nl.y + 60], [355, ctpn.y + 96],
    [ctpn.canh.phai, ctpn.y + 96],
  ], { nhan: 'nhập theo lô', viTriNhan: [300, ctpn.y + 88] });

  // nguyen_lieu 1 --- n cong_thuc
  s += v.noiBang([[nl.canh.giuaX, nl.canh.duoi], [nl.canh.giuaX, congThuc.canh.tren]],
    { nhan: 'định lượng', viTriNhan: [nl.canh.giuaX + 52, nl.canh.duoi + 26] });

  // monan 1 --- n cong_thuc
  s += v.noiBang([[monAn.canh.giuaX, monAn.canh.tren], [monAn.canh.giuaX, congThuc.canh.duoi]],
    { nhan: 'công thức của', viTriNhan: [monAn.canh.giuaX + 62, monAn.canh.tren - 12] });

  // nguyen_lieu 1 --- n xuat_kho
  s += v.noiBang([[nl.canh.phai, nl.y + 60], [xuatKho.canh.trai, nl.y + 60]],
    { nhan: 'tiêu hao', viTriNhan: [(nl.canh.phai + xuatKho.canh.trai) / 2, nl.y + 52] });

  // nguyen_lieu 1 --- n du_bao_nguyen_lieu
  s += v.noiBang([
    [nl.canh.phai, nl.y + 140], [690, nl.y + 140], [690, dbnl.y + 60],
    [dbnl.canh.trai, dbnl.y + 60],
  ], { nhan: 'dự báo cho', viTriNhan: [660, dbnl.y + 52] });

  // monan 1 --- n luat_ket_hop (mon o ve phai cua luat)
  s += v.noiBang([
    [monAn.canh.phai, monAn.y + 40], [1000, monAn.y + 40], [1000, lkh.y + 60],
    [lkh.canh.trai, lkh.y + 60],
  ], { nhan: 'món được gợi ý', viTriNhan: [880, monAn.y + 32] });

  // monan 1 --- n xuat_kho
  s += v.noiBang([
    [monAn.canh.phai, monAn.y + 66], [960, monAn.y + 66], [960, xuatKho.canh.duoi + 28],
    [xuatKho.canh.giuaX, xuatKho.canh.duoi + 28], [xuatKho.canh.giuaX, xuatKho.canh.duoi],
  ], { nhan: 'bán món nào', viTriNhan: [845, xuatKho.canh.duoi + 22] });

  s += v.ghiChu(30, 690, [
    'Ba bảng bên phải là nơi lưu KẾT QUẢ của phần học máy chứ không tham gia nghiệp vụ hằng ngày:',
    'du_bao_luot_khach và du_bao_nguyen_lieu lưu số dự báo, danh_gia_mo_hinh lưu chỉ số MAE / RMSE / MAPE / R²',
    'của từng mô hình trong mỗi lần chạy, luat_ket_hop lưu các luật Apriori đã khai phá được.',
  ]);

  return v.khung(id, 1290, 745,
    'Lược đồ quan hệ thực thể của phân hệ kho: nhập theo lô, định lượng công thức, nhật ký tiêu hao và các bảng kết quả học máy', s);
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
    'FK id_nv_phan', 'phan_luc', 'lay_luc', 'giao_luc', 'hoan_tat_luc',
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

  [dvvc, nhanVien, hopDong, shipper, donGiao, nhatKy, viTri, viTriMoi]
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
  const xVet = shipper.canh.giuaX - 50;
  s += v.noiBang([
    [xVet, shipper.canh.duoi], [xVet, 420], [viTri.canh.trai, 420],
  ], { nhan: 'vết đường', viTriNhan: [xVet + 90, 412] });

  // shipper 1 --- 1 vi_tri_shipper_moi_nhat (ghi de, moi nguoi giao mot dong)
  const xMoi = shipper.canh.giuaX + 50;
  s += v.noiBang([
    [xMoi, shipper.canh.duoi], [xMoi, 596], [viTriMoi.canh.trai, 596],
  ], { cuoi: 'mot', nhan: 'vị trí hiện tại', viTriNhan: [xMoi + 110, 588] });

  s += v.ghiChu(30, 730, [
    'Hai bảng vị trí cố ý không gộp: vi_tri_shipper thêm một dòng mỗi nhịp để trả lời "đã đi đường nào"; vi_tri_shipper_moi_nhat ghi đè,',
    'mỗi người giao đúng một dòng, để bản đồ trả lời "đang ở đâu" mà không phải quét cả vết đường.',
  ]);

  return v.khung(id, 1400, 790,
    'Lược đồ quan hệ thực thể của phân hệ giao hàng: đơn vị vận chuyển, hồ sơ người giao, đơn giao kèm nhật ký chuyển trạng thái và hai bảng vị trí', s);
}

module.exports = { banHang, kho, nhanSu, giaoHang };

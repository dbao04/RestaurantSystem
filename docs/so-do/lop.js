/**
 * Hai so do lop (UML class diagram) cua he thong.
 *
 * Mot luu y ve tinh trung thuc: he thong viet bang JavaScript theo kieu
 * module - moi tep trong `services/` xuat ra mot doi tuong ham chu khong khai
 * bao `class`. Vi vay cac hop o day mang khuon mau «module»: ten hop la ten
 * tep, ngan giua la du lieu / hang so cap module, ngan duoi la cac ham duoc
 * xuat ra. Ve nhu vay giu duoc dung cau truc ma nguon that thay vi bia ra mot
 * so do lop huong doi tuong khong ton tai trong du an.
 *
 * Ky hieu: mui ten net dut = phu thuoc («use»), hinh thoi dac = quan he cau
 * thanh, hinh thoi rong = quan he gop.
 */
const v = require('./ve');

/* ======================================================================== */
/* 1. TANG DICH VU NGHIEP VU                                                */
/* ======================================================================== */

function tangDichVu() {
  const id = 'lopA';
  const W = 1260, H = 800;
  let s = '';

  // --- tang dinh tuyen ---
  const rQR = v.hopLop(30, 40, 'server.js', ['− io: Server'], [
    '+ GET /qr/table/:tableId',
    '+ POST /qr/add-dish',
    '+ GET /qr/table/:tableId/don',
  ], { khuonMau: 'router' });
  const rKds = v.hopLop(330, 40, 'routes/kds.js', [], [
    '+ GET /kds/api/don',
    '+ POST /kds/api/:buoc/:id',
    '+ GET /so-do-ban/api/du-lieu',
  ], { khuonMau: 'router' });
  const rTt = v.hopLop(650, 40, 'routes/thanhToan.js', [], [
    '+ POST /qr/thanh-toan/:sesis/tao-phien',
    '+ POST /api/webhook/ngan-hang',
    '+ GET /staff/thanh-toan/:sesis',
  ], { khuonMau: 'router' });
  const rAna = v.hopLop(1030, 40, 'routes/analytics.js', [], [
    '+ GET /analytics',
    '+ GET /analytics/api/*',
  ], { khuonMau: 'router' });

  // --- tang dich vu ---
  const sOrder = v.hopLop(30, 250, 'orderService', ['− MAT_KHAU_VO_HIEU: string'], [
    '+ layBanQR(tableId)',
    '+ phienDangMoCuaBan(tableId)',
    '+ createQROrder(tableId)',
    '+ addMultipleDishesToOrder(sesis, items)',
    '+ donCuaBanQR(tableId)',
    '+ createOrderFromCart(...)',
  ], { khuonMau: 'module' });

  const sKds = v.hopLop(330, 250, 'kdsService', [
    '+ TEN_TRANG_THAI_BEP: {0..3}',
    '+ TEN_TRANG_THAI_BAN: {0..3}',
  ], [
    '+ layDonBep()',
    '+ batDauCheBien(id)',
    '+ hoanThanhCheBien(id)',
    '+ danhDauDaPhucVu(id)',
    '+ laySoDoBan()',
  ], { khuonMau: 'module' });

  const sTt = v.hopLop(650, 250, 'thanhToanService', ['− cauHinh: object'], [
    '+ taoPhien({sesis, soTien, maPhuongThuc})',
    '+ ghiNhanGiaoDichNganHang(gd)',
    '+ layHoaDon(sesis, opts)',
    '+ xacNhan(id) / huyPhien(id)',
    '− sinhMaDoiSoat()',
  ], { khuonMau: 'module' });

  const sAna = v.hopLop(1030, 250, 'analyticsService', [], [
    '+ khoangNgay(tu, den)',
    '+ tongQuan(tu, den)',
    '+ doanhThuTheoNgay(...)',
    '+ topMonBanChay(...)',
  ], { khuonMau: 'module' });

  const sMenu = v.hopLop(30, 520, 'menuService', [], [
    '+ getAllCategories()',
    '+ getDishesByCategory(id)',
    '+ getRecipeByDish(idMon)',
    '+ addStockIn(phieu)',
  ], { khuonMau: 'module' });

  const sVietQR = v.hopLop(650, 560, 'vietQR', ['+ nganHang: map 40+ mã'], [
    '+ tlv(id, giaTri)',
    '+ noiDung(sesis)',
  ], { khuonMau: 'module' });

  const sRealtime = v.hopLop(330, 560, 'realtime', ['− io: Server'], [
    '+ phat(sesis, sk, dl)',
    '+ phong(nv)',
  ], { khuonMau: 'module' });

  const db = v.hopLop(1030, 560, 'config/db', ['− pool: mysql2.Pool'], [
    '+ query(sql, tham_so)',
    '+ getConnection()',
  ], { khuonMau: 'singleton' });

  [rQR, rKds, rTt, rAna, sOrder, sKds, sTt, sAna, sMenu, sVietQR, sRealtime, db]
    .forEach((x) => { s += x.svg; });

  /* --- quan he --- */
  const dung = (a, b, nhan) => v.quanHeLop(
    [[a.canh.giuaX, a.canh.duoi], [b.canh.giuaX, b.canh.tren]], id,
    { kieu: 'phu-thuoc', nhan, viTriNhan: [(a.canh.giuaX + b.canh.giuaX) / 2 + 42, (a.canh.duoi + b.canh.tren) / 2] }
  );
  s += dung(rQR, sOrder, '«use»');
  s += dung(rKds, sKds, '«use»');
  s += dung(rTt, sTt, '«use»');
  s += dung(rAna, sAna, '«use»');

  // Cac dich vu deu di qua mot pool CSDL duy nhat. Duong di vong theo le trai
  // va hanh lang duoi (y = 700) vi di thang se cat qua hang hop o duoi.
  const veDb = (diem) => v.quanHeLop(diem, id, { kieu: 'phu-thuoc' });
  s += veDb([[sAna.canh.giuaX, sAna.canh.duoi], [sAna.canh.giuaX, db.canh.tren]]);
  s += veDb([[sTt.canh.phai, sTt.y + 120], [1000, sTt.y + 120], [1000, db.canh.tren]]);
  s += veDb([[sMenu.canh.phai, 540], [1012, 540], [1012, db.canh.tren]]);
  s += veDb([[sOrder.canh.trai, 380], [12, 380], [12, 700], [1060, 700], [1060, db.canh.duoi]]);
  s += `<text class="tx-boi" x="600" y="692">mọi truy vấn SQL đều đi qua một pool duy nhất</text>`;

  s += v.quanHeLop([[sTt.canh.giuaX, sTt.canh.duoi], [sVietQR.canh.giuaX, sVietQR.canh.tren]], id,
    { kieu: 'cau-thanh', nhan: 'sinh mã QR', viTriNhan: [sTt.canh.giuaX + 62, sTt.canh.duoi + 26] });
  s += v.quanHeLop([[sKds.canh.giuaX, sKds.canh.duoi], [sRealtime.canh.giuaX, sRealtime.canh.tren]], id,
    { kieu: 'gop', nhan: 'phát sự kiện', viTriNhan: [sKds.canh.giuaX + 62, sKds.canh.duoi + 34] });
  s += v.quanHeLop([[sOrder.canh.giuaX, sOrder.canh.duoi], [sMenu.canh.giuaX, sMenu.canh.tren]], id,
    { kieu: 'phu-thuoc', nhan: '«use»', viTriNhan: [sOrder.canh.giuaX + 40, sOrder.canh.duoi + 26] });

  s += v.ghiChu(30, 745, [
    'Toàn bộ câu lệnh SQL nằm ở tầng dịch vụ. Tầng định tuyến chỉ nhận tham số, kiểm tra quyền rồi gọi xuống — nhờ ranh giới này,',
    'đổi một câu truy vấn hay đổi cả lược đồ bảng chỉ phải sửa trong services/ mà không lần theo hàng nghìn dòng ở tầng trên.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ lớp tầng dịch vụ nghiệp vụ: quan hệ giữa tầng định tuyến, tầng dịch vụ và pool cơ sở dữ liệu', s);
}

/* ======================================================================== */
/* 2. PHAN HE HOC MAY                                                       */
/* ======================================================================== */

function phanHeHocMay() {
  const id = 'lopB';
  const W = 1260, H = 760;
  let s = '';

  s += v.bienHeThong(20, 30, 380, 250, 'TIẾN TRÌNH WEB (Node.js)');
  s += v.bienHeThong(430, 30, 810, 620, 'TIẾN TRÌNH HỌC MÁY (Python / FastAPI)');

  const mlService = v.hopLop(50, 80, 'mlService', [
    '− urlCache: string',
    '− TIMEOUT_MS = 30000',
  ], [
    '+ duBaoLuotKhach(soNgay)',
    '+ duBaoNguyenLieu(soNgay)',
    '+ khaiPhaLuat(thamSo)',
    '+ goiYMon(idMon, soLuong)',
    '+ kiemTra()',
    '− goi(duongDan, opts)',
  ], { khuonMau: 'module' });

  const main = v.hopLop(460, 80, 'ml_service/main.py', ['− app: FastAPI'], [
    '+ POST /du-bao/luot-khach',
    '+ POST /du-bao/nguyen-lieu',
    '+ POST /goi-y/khai-pha',
    '+ POST /khuon-mat/cham-cong',
    '+ POST /chatbot/hoi',
  ], { khuonMau: 'service' });

  const forecast = v.hopLop(790, 80, 'forecast.py', [], [
    '+ du_bao_luot_khach(so_ngay)',
    '+ du_bao_nguyen_lieu(so_ngay)',
    '− _nap_chuoi_ngay()',
    '− _du_bao_de_quy(...)',
    '− _luu_du_bao_khach(...)',
  ], { khuonMau: 'module' });

  const models = v.hopLop(1060, 80, 'models.py', ['+ KetQua'], [
    '+ danh_sach_mo_hinh()',
    '+ huan_luyen_va_danh_gia(...)',
    '+ huan_luyen_lai_toan_bo(...)',
    '+ tinh_chi_so(y, y_hat)',
  ], { khuonMau: 'module' });

  const features = v.hopLop(790, 300, 'features.py', [], [
    '+ chuan_bi(df, cot, ngay)',
    '+ cot_dac_trung(...)',
    '+ them_dac_trung_lich(df)',
    '+ them_dac_trung_tre(df)',
  ], { khuonMau: 'module' });

  const apriori = v.hopLop(460, 300, 'apriori.py', ['− min_support, min_confidence'], [
    '+ khai_pha_va_luu(...)',
    '+ goi_y(id_mon, so_luong)',
    '− apriori(giao_dich)',
    '− sinh_luat(pho_bien)',
  ], { khuonMau: 'module' });

  const khuonMat = v.hopLop(460, 470, 'khuon_mat.py', [
    '− bo_phat_hien: YuNet',
    '− bo_trich: SFace',
  ], [
    '+ nhan_dien(khung)',
    '+ xac_minh(khung, id_nv)',
    '+ kiem_tra_song(...)',
    '+ dang_ky(id_nv, anh)',
  ], { khuonMau: 'module' });

  const bot = v.hopLop(790, 470, 'chatbot/bot.py', ['− nguong_tin_cay: float'], [
    '+ hoi(cau, boi_canh)',
    '+ trang_thai()',
  ], { khuonMau: 'module' });

  const dbPy = v.hopLop(1060, 470, 'ml_service/db.py', ['− engine: SQLAlchemy'], [
    '+ doc_sql(sql, tham_so)',
    '+ ghi(sql, tham_so)',
  ], { khuonMau: 'module' });

  [mlService, main, forecast, models, features, apriori, khuonMat, bot, dbPy]
    .forEach((x) => { s += x.svg; });

  s += v.quanHeLop([[mlService.canh.phai, mlService.y + 60], [main.canh.trai, mlService.y + 60]], id,
    { kieu: 'phu-thuoc', nhan: 'HTTP JSON :8000', viTriNhan: [(mlService.canh.phai + main.canh.trai) / 2, mlService.y + 52] });

  /*
   * Bon mo-dun nghiep vu deu duoc main.py goi truc tiep; chung KHONG goi lan
   * nhau. Duong noi vi vay phai toa ra tu main.py chu khong noi noi tiep cho
   * de ve - noi tiep se ve ra mot phu thuoc khong co that trong ma nguon.
   */
  s += v.quanHeLop([[main.canh.phai, main.y + 50], [forecast.canh.trai, main.y + 50]], id, { kieu: 'phu-thuoc' });
  s += v.quanHeLop([[main.canh.giuaX, main.canh.duoi], [apriori.canh.giuaX, apriori.canh.tren]], id, { kieu: 'phu-thuoc' });
  s += v.quanHeLop([
    [main.canh.trai, main.y + 70], [440, main.y + 70], [440, khuonMat.y + 40], [khuonMat.canh.trai, khuonMat.y + 40],
  ], id, { kieu: 'phu-thuoc' });
  s += v.quanHeLop([
    [main.canh.trai, main.y + 100], [450, main.y + 100], [450, 632], [bot.canh.giuaX, 632], [bot.canh.giuaX, bot.canh.duoi],
  ], id, { kieu: 'phu-thuoc' });

  s += v.quanHeLop([[forecast.canh.phai, forecast.y + 50], [models.canh.trai, forecast.y + 50]], id, { kieu: 'phu-thuoc' });
  s += v.quanHeLop([[forecast.canh.giuaX, forecast.canh.duoi], [features.canh.giuaX, features.canh.tren]], id,
    { kieu: 'phu-thuoc', nhan: 'sinh đặc trưng', viTriNhan: [forecast.canh.giuaX + 62, forecast.canh.duoi + 24] });

  // Bon mo-dun cung doc / ghi CSDL qua db.py.
  s += v.quanHeLop([[bot.canh.phai, bot.y + 50], [dbPy.canh.trai, bot.y + 50]], id, { kieu: 'phu-thuoc' });
  s += v.quanHeLop([[apriori.canh.phai, 424], [1035, 424], [1035, dbPy.canh.tren]], id, { kieu: 'phu-thuoc' });
  // Vong xuong hanh lang y = 600 vi di thang sang phai se cat qua hop bot.py.
  s += v.quanHeLop([
    [khuonMat.canh.phai, 600], [1020, 600], [1020, dbPy.canh.duoi],
  ], id, { kieu: 'phu-thuoc' });
  s += v.quanHeLop([
    [forecast.canh.phai, forecast.y + 100], [1046, forecast.y + 100], [1046, dbPy.canh.tren],
  ], id, { kieu: 'phu-thuoc', nhan: 'lưu dự báo và chỉ số', viTriNhan: [1150, 400] });

  s += v.ghiChu(30, 690, [
    'Hai tiến trình chỉ nói chuyện với nhau qua HTTP JSON, không dùng chung bộ nhớ. mlService luôn đặt hạn 30 giây và bắt lỗi:',
    'khi tiến trình Python tắt, tầng web vẫn chạy bình thường và hiển thị kết quả đã lưu trong cơ sở dữ liệu của lần chạy trước.',
  ]);

  return v.khung(id, W, H,
    'Sơ đồ lớp phân hệ học máy: mô-đun phía Node gọi sang tiến trình Python và các mô-đun dự báo, khai phá luật, nhận diện khuôn mặt, trợ lý ảo', s);
}

/* ======================================================================== */
/* 3. PHAN HE DAT BAN, DAT TIEC, KHO BEP VA THU CHI                         */
/* ======================================================================== */

/**
 * Bon phan he lam sau cung (migration 028 - 038). Cung ranh gioi ba tang nhu
 * tangDichVu(): router chi nhan tham so va kiem quyen, luat thuan tuy tach ra
 * module rieng (reservationRules) de test duoc khong can CSDL.
 */
function phanHeDatBanKho() {
  const id = 'lopC';
  let s = '';
  const C = [30, 360, 690, 1020];   // bon cot

  // --- hang 1: router ---
  const rDb = v.hopLop(C[0], 40, 'routes/datBan.js', [], [
    '+ POST /api/dat-ban',
    '+ POST /api/dat-ban/tra-cuu/doi-lich',
    '+ POST /api/reservations/walk-in',
    '+ POST /api/reservations/:id/deposit',
  ], { khuonMau: 'router' });
  const rDt = v.hopLop(C[1], 40, 'routes/datTiec.js', [], [
    '+ POST /api/dat-tiec',
    '+ POST /api/staff/dat-tiec/:id/trang-thai',
    '+ POST /api/staff/dat-tiec/:id/thanh-toan',
  ], { khuonMau: 'router' });
  const rKb = v.hopLop(C[2], 40, 'routes/khoBep.js', [], [
    '+ POST /api/kitchen/kho/nhap',
    '+ POST /api/kitchen/kho/xuat',
    '+ POST /api/kitchen/mua-hang/:id/:buoc',
  ], { khuonMau: 'router' });
  const rTc = v.hopLop(C[3], 40, 'routes/thuChi.js', [], [
    '+ GET /staff/thu-chi',
    '+ POST /api/staff/thu-chi/phieu',
    '+ POST /api/staff/thu-chi/phieu/:id/huy',
  ], { khuonMau: 'router' });

  // --- hang 2: dich vu dieu phoi ---
  const sRsv = v.hopLop(C[0], 230, 'reservationService', ['− COT_RSV: string'], [
    '+ taoLuotDat(input, ctx)',
    '+ taoWalkIn(input, ctx)',
    '+ capNhat(id, input, ctx)',
    '+ capNhatMonDatTruoc(id, items)',
    '+ ganBan(id, dsBanId)',
    '+ doiTrangThai(id, moi, ctx)',
    '+ luuCoc(id, input)',
    '+ xemTruocHuy(id)',
  ], { khuonMau: 'module' });
  const sDt = v.hopLop(C[1], 230, 'datTiecService', [
    '+ CHUYEN_TRANG_THAI: map',
    '+ GIU_CHO: [DA_XAC_NHAN, DA_COC]',
  ], [
    '+ taoDonTiec(body, ctx)',
    '+ tinhDuToan(...)',
    '+ tinhTienCoc(...)',
    '+ capNhatTrangThai(id, moi)',
    '+ ghiNhanThanhToan(id, tt)',
    '+ tinhHoanTien(don)',
    '+ ganNhanVien(id, dsNv)',
  ], { khuonMau: 'module' });
  const sKb = v.hopLop(C[2], 230, 'khoBepService', [], [
    '+ goiYMuaHang()',
    '+ taoDonMua(body, idNv)',
    '+ doiTrangThaiDon(id, buoc)',
    '+ taoPhieuNhap(body, idNv)',
    '+ taoPhieuXuat(body, idNv)',
    '+ truLoFIFO(conn, idNl, sl)',
  ], { khuonMau: 'module' });
  const sTc = v.hopLop(C[3], 230, 'thuChiService', ['+ DANH_MUC: map'], [
    '+ lapPhieu(body, nv)',
    '+ huyPhieu(id, lyDo, nv)',
    '+ baoCao(loc)',
    '+ phieuTienMatTrongCa(ca)',
    '+ xuatExcel(loc)',
  ], { khuonMau: 'module' });

  // --- hang 3: luat thuan tuy, xep ban, vong quet nen, KDS, chot ca ---
  const sRule = v.hopLop(C[0], 500, 'reservationRules', [
    '+ SLOT_MINUTES = 15',
    '+ CHUYEN_TRANG_THAI: map',
  ], [
    '+ kiemTraQuaKhu(khung)',
    '+ kiemTraGioMoCua(khung)',
    '+ kiemTraDatSatGio(khung, ch)',
    '+ tinhTienCoc({soKhach, gio, ...})',
    '+ tinhHoanTien(rsv, luc)',
    '+ batBuocChuyenDuoc(tu, den)',
  ], { khuonMau: 'module' });
  const sTab = v.hopLop(C[1], 520, 'reservationTables', [], [
    '+ goiYXepBan(khung, yeuCau)',
    '+ timToHop(dsBan, soKhach)',
    '+ khungGioThayThe(...)',
    '+ chiemO(conn, id, ban, khung)',
    '+ nhaO(conn, id)',
  ], { khuonMau: 'module' });
  const sKds = v.hopLop(C[2], 520, 'kdsService', [], [
    '+ hoanThanhCheBien(id)',
    '+ danhDauDaPhucVu(id, idNv)',
  ], { khuonMau: 'module' });
  const sCc = v.hopLop(C[3], 520, 'chotCaService', [], [
    '+ tongHopCa(nv, moc)',
    '+ chotCa(input, nv)',
    '+ duyetBienBan(id, nv)',
  ], { khuonMau: 'module' });
  const sJob = v.hopLop(C[0], sRule.y + sRule.h + 60, 'reservationJobs', ['+ CHU_KY_MS = 60000'], [
    '+ quetNoShow() → dv.doiTrangThai()',
    '+ quetCocQuaHan() → huỷ, nhả bàn',
    '+ quetNhacLich() → gửi email nhắc',
  ], { khuonMau: 'tiến trình nền' });

  [rDb, rDt, rKb, rTc, sRsv, sDt, sKb, sTc, sRule, sTab, sKds, sCc, sJob].forEach((x) => { s += x.svg; });

  /* --- quan he --- */
  const dung = (a, b) => v.quanHeLop(
    [[a.x + 40, a.canh.duoi], [a.x + 40, b.canh.tren]], id,
    { kieu: 'phu-thuoc', nhan: '«use»', viTriNhan: [a.x + 76, (a.canh.duoi + b.canh.tren) / 2 + 4] });
  s += dung(rDb, sRsv);
  s += dung(rDt, sDt);
  s += dung(rKb, sKb);
  s += dung(rTc, sTc);

  // reservationService --> reservationRules / reservationTables
  s += v.quanHeLop([[sRsv.x + 40, sRsv.canh.duoi], [sRsv.x + 40, sRule.canh.tren]], id,
    { kieu: 'phu-thuoc', nhan: 'hỏi luật', viTriNhan: [sRsv.x + 82, (sRsv.canh.duoi + sRule.canh.tren) / 2 + 4] });
  const xKhe = C[1] - 30;
  s += v.quanHeLop([[sRsv.canh.phai, sRsv.y + 70], [xKhe, sRsv.y + 70], [xKhe, sTab.y + 40], [sTab.canh.trai, sTab.y + 40]], id,
    { kieu: 'phu-thuoc', nhan: 'xếp bàn', viTriNhan: [xKhe - 28, sRsv.y + 62] });
  // datTiecService --> reservationRules (dung chung luat gio mo cua, ngay le)
  const yDt = sRule.y - 24;
  const xDich = sRule.x + sRule.w - 40;
  s += v.quanHeLop([[sDt.x + 40, sDt.canh.duoi], [sDt.x + 40, yDt], [xDich, yDt], [xDich, sRule.canh.tren]], id,
    { kieu: 'phu-thuoc', nhan: 'dùng chung luật', viTriNhan: [sDt.x + 110, yDt - 6] });
  // reservationJobs --> reservationRules (va goi reservationService)
  s += v.quanHeLop([[sJob.x + 40, sJob.canh.tren], [sJob.x + 40, sRule.canh.duoi]], id,
    { kieu: 'phu-thuoc', nhan: 'mỗi phút một nhịp', viTriNhan: [sJob.x + 110, (sRule.canh.duoi + sJob.canh.tren) / 2 + 4] });
  // kdsService --> khoBepService.truLoFIFO
  s += v.quanHeLop([[sKds.x + 60, sKds.canh.tren], [sKds.x + 60, sKb.canh.duoi]], id,
    { kieu: 'phu-thuoc', nhan: 'trừ lô FIFO', viTriNhan: [sKds.x + 116, (sKb.canh.duoi + sKds.canh.tren) / 2 + 4] });
  // chotCaService --> thuChiService.phieuTienMatTrongCa
  s += v.quanHeLop([[sCc.x + 60, sCc.canh.tren], [sCc.x + 60, sTc.canh.duoi]], id,
    { kieu: 'phu-thuoc', nhan: 'phiếu tiền mặt trong ca', viTriNhan: [sCc.x + 150, (sTc.canh.duoi + sCc.canh.tren) / 2 + 4] });
  const H = sJob.y + sJob.h + 80;
  s += v.ghiChu(30, H - 46, [
    'reservationRules không truy cập trạng thái phiên hay request: mọi hàm là hàm thuần (trừ docCauHinh), nên trang cấu hình của quản lý và tầng tạo lượt đặt',
    'dùng CHUNG một cách tính tiền cọc / hoàn tiền. Mọi module dịch vụ trên hình đều truy vấn qua pool config/db (không vẽ để tránh rối).',
  ]);

  return v.khung(id, 1350, H,
    'Sơ đồ lớp các phân hệ đặt bàn, đặt tiệc, kho bếp và thu chi: router, module điều phối, module luật thuần và tiến trình quét nền', s);
}

module.exports = { tangDichVu, phanHeHocMay, phanHeDatBanKho };

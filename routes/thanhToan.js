/**
 * ROUTER THANH TOAN
 *
 * Gom 5 nhom duong dan:
 *   /staff/thanh-toan/...   POS cho thu ngan tai quay
 *   /qr/thanh-toan/...      khach tu tra tren dien thoai tai ban (khong login)
 *   /thanh-toan/dat-coc/... khach tra truoc khi dat ban tren web (co login)
 *   /api/webhook/ngan-hang  ngan hang bao co -> tu doi soat
 *   /admin/thanh-toan/...   cau hinh tai khoan nhan tien, thue phi, doi soat
 *
 * Nhan `io` de phat su kien thoi gian thuc. Hai loai phong:
 *   'thanh_toan'   - moi may POS dang mo, de thay ban khac vua thu tien
 *   'tt:<sesis>'   - rieng mot hoa don; ca dien thoai khach lan man hinh thu
 *                    ngan cung vao phong nay nen khach quet xong thi ca hai
 *                    ben cung sang "da thanh toan" trong cung mot khoanh khac
 */
const express = require('express');
const tt = require('../services/thanhToanService');
const chotCa = require('../services/chotCaService');
const vietQR = require('../services/vietQR');
const phanQuyenMw = require('../middleware/phanQuyen');
const phanQuyen = require('../services/phanQuyenService');
const realtime = require('../services/realtime');
const db = require('../config/db');

module.exports = function (io) {
  const router = express.Router();

  /** Bat loi cua handler async va day sang errorHandler chung (trang HTML). */
  const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  /**
   * Nhu `bat` nhung LUON tra ve JSON khi loi.
   *
   * errorHandler chung chi tra JSON khi request co `X-Requested-With` hoac
   * `Accept: *json*` hoac duong dan chua '/api/'. Cac diem cuoi o day duoc goi
   * bang `fetch()` tran - khong dat header nao trong so do - nen no tra ve
   * TRANG HTML loi. Phia trinh duyet goi `r.json()` va vo voi
   * "Unexpected token '<'", che mat thong bao that ("Số tiền vượt quá phần còn
   * phải trả") dung luc thu ngan can doc no nhat.
   *
   * Loi nghiep vu (so tien sai, ma het han...) tra 400 chu khong phai 500:
   * 500 nghia la he thong hong, con day la nguoi dung nhap sai.
   */
  const batJson = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
    const ma = e.status || e.statusCode || (e.laLoiNghiepVu === false ? 500 : 400);
    if (ma >= 500) console.error('[thanh-toan]', e);
    res.status(ma).json({ thanhCong: false, loi: e.message, message: e.message });
  });

  const VAI_TRO_THU_NGAN = ['Thu ngan', 'Quay', 'Ke toan', 'Phuc vu'];

  /* ----------------------------------------------------- phong socket ---- */
  /**
   * Dang ky phong theo doi thanh toan.
   *
   * Them mot handler 'connection' nua ben canh cua realtime.khoiTao() -
   * Socket.IO cho phep nhieu handler, moi cai lo phan viec cua minh.
   *
   * Phong 'thanh_toan' chi cho nhan vien: no phat moi lan co ban nao do tra
   * tien, khach khong can va khong nen thay.
   * Phong 'tt:<sesis>' cho ca khach: khach dang cho QR cua CHINH don minh.
   * Ho da co sesis trong duong dan roi nen khong lo ro them gi.
   */
  io.on('connection', (socket) => {
    const phien = socket.request.session || {};

    // Cung mot phep thu quyen nhu requireThuNgan, nhung o day khong co `req` nen
    // phai tu nap ho so chuc danh. Neu khong lam vay thi quan ly nha hang vao
    // duoc trang nhung khong nhan duoc thong bao "ban 5 vua tra tien".
    socket.on('tt:vao-phong-quay', async () => {
      if (phien.adminlogin) return socket.join('thanh_toan');
      if (!phien.stafflogin) return;
      if (VAI_TRO_THU_NGAN.includes(phien.staffRole)) return socket.join('thanh_toan');
      try {
        const hoSo = await phanQuyen.hoSoQuyen(phien.staffId);
        if (phanQuyen.dongVaiDuoc(hoSo, VAI_TRO_THU_NGAN)) socket.join('thanh_toan');
      } catch (e) { /* khong vao duoc phong thi chi mat thong bao, khong hong gi */ }
    });

    socket.on('tt:theo-doi-don', (sesis) => {
      if (typeof sesis === 'string' && sesis.length > 0 && sesis.length <= 255) {
        socket.join('tt:' + sesis);
      }
    });

    socket.on('tt:ngung-theo-doi', (sesis) => {
      if (typeof sesis === 'string') socket.leave('tt:' + sesis);
    });
  });

  /* ---------------------------------------------------------------- quyen */

  /**
   * Quyen vao man hinh thu ngan.
   *
   * PHAI dung `canVaiTroCu` chu khong so sanh `session.staffRole` bang tay.
   * `staffRole` la chucvu_legacy cua chuc danh, ma "Quan ly nha hang" va
   * "Tro ly quan ly" deu mang legacy 'Quan ly' - khong nam trong danh sach
   * duoi day. So sanh chuoi tho khien chinh nguoi quan ly nha hang bi 403 o
   * man hinh thu tien, trong khi cot `chuc_danh.vai_tro_tuong_duong` cua ho
   * ghi ro la dong duoc vai 'Thu ngan'. `canVaiTroCu` doc dung cot do.
   */
  const requireThuNgan = phanQuyenMw.canVaiTroCu(VAI_TRO_THU_NGAN);

  function requireAdmin(req, res, next) {
    if (req.session.adminlogin) return next();
    return res.redirect('/admin/login');
  }

  function requireKhachDangNhap(req, res, next) {
    if (req.session.userlogin) return next();
    return res.redirect('/login');
  }

  /** Phat su kien cho ca hai phong lien quan den mot hoa don. */
  function phat(sesis, suKien, duLieu) {
    io.to('thanh_toan').emit(suKien, duLieu);
    io.to('tt:' + sesis).emit(suKien, duLieu);
  }

  /* ======================================================================== */
  /* POS - THU NGAN                                                           */
  /* ======================================================================== */

  // Danh sach don cho tinh tien.
  router.get('/staff/thanh-toan', requireThuNgan, bat(async (req, res) => {
    const [danhSach, tongHop] = await Promise.all([
      tt.danhSachCanThanhToan(),
      tt.tongHopTheoPhuongThuc({ tuNgay: homNay(), denNgay: homNay() }),
    ]);
    res.render('staff/thanh-toan', {
      title: 'Thu ngân',
      activePage: 'thanh-toan',
      staffName: req.session.staffName,
      danhSach,
      tongHop,
      tongHomNay: tongHop.reduce((t, r) => t + Number(r.tong_tien || 0), 0),
    });
  }));

  // --- CAC DUONG DAN TINH PHAI DUNG TRUOC /staff/thanh-toan/:sesis ---------
  // Express khop theo thu tu khai bao. Neu de ':sesis' len truoc thi
  // '/staff/thanh-toan/doi-soat' se bi hieu la mot ma don ten "doi-soat".

  // Trang doi soat sao ke ngan hang.
  router.get('/staff/thanh-toan/doi-soat', requireThuNgan, bat(async (req, res) => {
    const loc = req.query.trang_thai || null;
    const [giaoDich, phienCho, cauHinh] = await Promise.all([
      tt.danhSachGiaoDichNganHang({ trangThai: loc, gioiHan: 100 }),
      db.query(
        `SELECT p.id, p.sesis, p.amount, p.ma_doi_soat, p.created_at, pm.name AS ten_phuong_thuc
         FROM payments p LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
         WHERE p.status = 'pending' ORDER BY p.id DESC LIMIT 50`
      ).then(([r]) => r),
      tt.layCauHinh(true),
    ]);
    res.render('staff/thanh-toan-doi-soat', {
      title: 'Đối soát ngân hàng',
      activePage: 'thanh-toan',
      staffName: req.session.staffName,
      giaoDich, phienCho, cauHinh, loc,
    });
  }));

  // Lich su thanh toan.
  router.get('/staff/thanh-toan/lich-su', requireThuNgan, bat(async (req, res) => {
    const { tu_ngay, den_ngay, phuong_thuc, trang_thai } = req.query;
    const [lichSu, tongHop, phuongThuc] = await Promise.all([
      tt.lichSuThanhToan({
        tuNgay: tu_ngay || null, denNgay: den_ngay || null,
        maPhuongThuc: phuong_thuc || null,
        trangThai: trang_thai === 'tat_ca' ? null : (trang_thai || 'success'),
        gioiHan: 300,
      }),
      tt.tongHopTheoPhuongThuc({ tuNgay: tu_ngay || null, denNgay: den_ngay || null }),
      tt.danhSachPhuongThuc(),
    ]);
    res.render('staff/thanh-toan-lich-su', {
      title: 'Lịch sử thanh toán',
      activePage: 'thanh-toan',
      staffName: req.session.staffName,
      lichSu, tongHop, phuongThuc,
      loc: { tu_ngay, den_ngay, phuong_thuc, trang_thai },
    });
  }));

  // Trang thai mot phien - trinh duyet goi lien tuc lam duong du phong cho socket.
  router.get('/staff/thanh-toan/phien/:id/trang-thai', requireThuNgan, batJson(async (req, res) => {
    const p = await tt.trangThaiPhien(Number(req.params.id));
    if (!p) return res.status(404).json({ loi: 'Không tìm thấy phiên' });
    res.json(p);
  }));

  // Thu ngan bam xac nhan da nhan duoc tien (khi webhook chua dau, hoac tra the).
  router.post('/staff/thanh-toan/phien/:id/xac-nhan', requireThuNgan, batJson(async (req, res) => {
    const kq = await tt.xacNhan(Number(req.params.id), {
      maGiaoDich: req.body.ma_giao_dich || null,
      nhanVienId: req.session.staffId || null,
      ghiChu: 'Xác nhận thủ công bởi ' + (req.session.staffName || 'nhân viên'),
    });
    await ghiNhatKy(req, 'xac_nhan_thanh_toan', kq.payment.id, kq.payment);
    phat(kq.payment.sesis, 'tt:da-thanh-toan', {
      paymentId: kq.payment.id, sesis: kq.payment.sesis,
      soTien: Number(kq.payment.amount), donDaTraDu: !!kq.donDaTraDu,
    });
    res.json({ thanhCong: true, ...kq });
  }));

  router.post('/staff/thanh-toan/phien/:id/huy', requireThuNgan, batJson(async (req, res) => {
    const [[p]] = await db.query('SELECT sesis FROM payments WHERE id = ?', [req.params.id]);
    await tt.huyPhien(Number(req.params.id), req.body.ly_do || 'Hủy bởi ' + (req.session.staffName || 'nhân viên'));
    if (p) phat(p.sesis, 'tt:huy-phien', { paymentId: Number(req.params.id), sesis: p.sesis });
    res.json({ thanhCong: true });
  }));

  router.post('/staff/thanh-toan/phien/:id/hoan-tien', requireThuNgan, batJson(async (req, res) => {
    await tt.hoanTien(Number(req.params.id), {
      lyDo: req.body.ly_do || '',
      nhanVienId: req.session.staffId || null,
    });
    res.json({ thanhCong: true });
  }));

  // Bien lai in - kho giay nhiet 80mm.
  router.get('/staff/thanh-toan/bien-lai/:id', requireThuNgan, bat(async (req, res) => {
    const [[p]] = await db.query(
      `SELECT p.*, pm.name AS ten_phuong_thuc, pm.type AS loai_phuong_thuc, n.ten AS ten_nhan_vien
       FROM payments p
       LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
       LEFT JOIN nhan_vien n ON p.processed_by = n.id_nv
       WHERE p.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!p) return res.status(404).send('Không tìm thấy biên lai');
    // Bien lai chi can cac con so - khong goi y ma khuyen mai o day.
    const hoaDon = await tt.layHoaDon(p.sesis, { goiY: false });
    res.render('staff/thanh-toan-bien-lai', { layout: false, p, hoaDon });
  }));

  router.post('/staff/thanh-toan/doi-soat/:id/ghep', requireThuNgan, batJson(async (req, res) => {
    const kq = await tt.doiSoatThuCong(
      Number(req.params.id), Number(req.body.payment_id), req.session.staffId || null
    );
    if (kq.payment) {
      phat(kq.payment.sesis, 'tt:da-thanh-toan', {
        paymentId: kq.payment.id, sesis: kq.payment.sesis,
        soTien: Number(kq.payment.amount), donDaTraDu: !!kq.donDaTraDu,
      });
    }
    res.json({ thanhCong: true });
  }));

  router.post('/staff/thanh-toan/doi-soat/:id/bo-qua', requireThuNgan, batJson(async (req, res) => {
    await db.query(
      "UPDATE giao_dich_ngan_hang SET trang_thai = 'bo_qua', ghi_chu = ? WHERE id = ?",
      ['Bỏ qua bởi ' + (req.session.staffName || 'nhân viên'), req.params.id]
    );
    res.json({ thanhCong: true });
  }));

  /* ======================================================================== */
  /* CHOT CA THU NGAN                                                         */
  /* ======================================================================== */

  /**
   * Quyen DUYET bien ban chot ca.
   *
   * Chot ca thi thu ngan nao cung lam duoc, nhung DUYET thi phai la nguoi khac
   * va phai o vai giam sat tro len - neu khong thi viec doi soat chi la mot
   * bieu mau, ai lap cung la nguoi ky duyet.
   */
  const requireDuyetChotCa = phanQuyenMw.canVaiTroCu(['Ke toan', 'Quan ly']);

  // Man hinh chot ca cua chinh minh.
  router.get('/staff/chot-ca', requireThuNgan, bat(async (req, res) => {
    const idNv = req.session.staffId;
    if (!idNv) {
      return res.status(403).render('error', {
        title: 'Không chốt ca được', statusCode: 403,
        message: 'Tài khoản quản trị không gắn với nhân viên nào nên không có két để đối soát. '
          + 'Hãy đăng nhập bằng tài khoản nhân viên tại /staff/login.',
      });
    }
    const [tongHop, lichSu] = await Promise.all([
      chotCa.tongHopCa(idNv, { tienDauCa: Number(req.query.quy) || 0 }),
      chotCa.lichSuChotCa({ idNv, gioiHan: 10 }),
    ]);
    res.render('staff/chot-ca', {
      title: 'Chốt ca thu ngân',
      activePage: 'chot-ca',
      staffName: req.session.staffName,
      tongHop, lichSu,
    });
  }));

  // Tinh lai cac con so khi thu ngan doi quy dau ca - khong nap lai ca trang.
  router.get('/staff/chot-ca/tong-hop', requireThuNgan, batJson(async (req, res) => {
    const th = await chotCa.tongHopCa(req.session.staffId, {
      tienDauCa: Number(req.query.quy) || 0,
    });
    res.json(th);
  }));

  router.post('/staff/chot-ca', requireThuNgan, batJson(async (req, res) => {
    const kq = await chotCa.chotCa(req.session.staffId, {
      tienDauCa: Number(req.body.tien_dau_ca) || 0,
      tienMatDemDuoc: req.body.tien_mat_dem_duoc,
      bangMenhGia: req.body.bang_menh_gia || null,
      tenCa: req.body.ten_ca || null,
      lyDoChenhLech: req.body.ly_do_chenh_lech || null,
      ghiChu: req.body.ghi_chu || null,
    });
    await ghiNhatKyChotCa(req, 'chot_ca', kq.id, kq);
    // Bao cho giam sat biet co bien ban moi can duyet.
    io.to('thanh_toan').emit('tt:chot-ca-moi', {
      id: kq.id, nhanVien: req.session.staffName, chenhLech: kq.chenh_lech,
    });
    // Va cho moi man hinh dang mo danh sach chot ca tu tai lai. `tt:chot-ca-moi`
    // o tren chi den phong 'thanh_toan' va chi de hien thong bao; con quan ly
    // hay ke toan dang xem lich su chot ca thi khong o trong phong do.
    realtime.doi(realtime.MIEN.CHOT_CA, {
      id: kq.id, nhan_vien: req.session.staffName, chenh_lech: kq.chenh_lech,
    });
    res.json({ thanhCong: true, ...kq });
  }));

  // Lich su chot ca. Thu ngan thuong chi thay ca cua minh; nguoi co quyen duyet
  // thay het de con doi chieu giua cac quay.
  router.get('/staff/chot-ca/lich-su', requireThuNgan, bat(async (req, res) => {
    const xemHet = phanQuyen.dongVaiDuoc(req.hoSo, ['Ke toan', 'Quan ly']) || !!req.session.adminlogin;
    const lichSu = await chotCa.lichSuChotCa({
      idNv: xemHet ? null : req.session.staffId,
      tuNgay: req.query.tu_ngay || null,
      denNgay: req.query.den_ngay || null,
      chuaDuyet: req.query.chua_duyet === '1',
      gioiHan: 200,
    });
    res.render('staff/chot-ca-lich-su', {
      title: 'Lịch sử chốt ca',
      activePage: 'chot-ca',
      staffName: req.session.staffName,
      lichSu, xemHet,
      loc: { tu_ngay: req.query.tu_ngay, den_ngay: req.query.den_ngay, chua_duyet: req.query.chua_duyet },
    });
  }));

  // Bien ban chi tiet - cung la ban in.
  router.get('/staff/chot-ca/:id', requireThuNgan, bat(async (req, res) => {
    const bienBan = await chotCa.layBienBan(Number(req.params.id));
    if (!bienBan) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy', statusCode: 404, message: 'Biên bản chốt ca không tồn tại.',
      });
    }
    const xemHet = phanQuyen.dongVaiDuoc(req.hoSo, ['Ke toan', 'Quan ly']) || !!req.session.adminlogin;
    if (!xemHet && Number(bienBan.id_nv) !== Number(req.session.staffId)) {
      return res.status(403).render('error', {
        title: 'Không có quyền', statusCode: 403,
        message: 'Biên bản chốt ca này của nhân viên khác.',
      });
    }
    const phien = await chotCa.chiTietPhienCua(bienBan);
    res.render('staff/chot-ca-chi-tiet', {
      title: 'Biên bản chốt ca #' + bienBan.id,
      activePage: 'chot-ca',
      staffName: req.session.staffName,
      bienBan, phien,
      // Nguoi lap khong tu duyet duoc - an luon nut di cho khoi bam nham.
      duocDuyet: xemHet && Number(bienBan.id_nv) !== Number(req.session.staffId),
    });
  }));

  router.post('/staff/chot-ca/:id/duyet', requireDuyetChotCa, batJson(async (req, res) => {
    await chotCa.duyetBienBan(Number(req.params.id), req.session.staffId, req.body.ghi_chu || null);
    await ghiNhatKyChotCa(req, 'duyet_chot_ca', Number(req.params.id), {});
    realtime.doi(realtime.MIEN.CHOT_CA, { id: Number(req.params.id), da_duyet: true });
    res.json({ thanhCong: true });
  }));

  // --- Duong dan co tham so, phai dat SAU cac duong dan tinh o tren ---------

  // Man hinh tinh tien cho mot don.
  router.get('/staff/thanh-toan/:sesis', requireThuNgan, bat(async (req, res) => {
    const [hoaDon, phuongThuc, taiKhoan] = await Promise.all([
      tt.layHoaDon(req.params.sesis, { kenh: 'quay' }),
      tt.danhSachPhuongThuc(),
      tt.layTaiKhoanNhan(),
    ]);
    res.render('staff/thanh-toan-chi-tiet', {
      title: 'Tính tiền · ' + (hoaDon.thongTin.ten_ban || hoaDon.thongTin.ten_khach || ''),
      activePage: 'thanh-toan',
      staffName: req.session.staffName,
      hoaDon, phuongThuc, taiKhoan,
    });
  }));

  // Tinh lai hoa don khi thu ngan go ma giam gia / keo thanh diem.
  router.get('/staff/thanh-toan/:sesis/hoa-don', requireThuNgan, batJson(async (req, res) => {
    const hoaDon = await tt.layHoaDon(req.params.sesis, {
      maGiamGia: req.query.ma_giam_gia || null,
      diemDung: Number(req.query.diem_dung) || 0,
      kenh: 'quay',
    });
    res.json(hoaDon);
  }));

  router.post('/staff/thanh-toan/:sesis/tao-phien', requireThuNgan, batJson(async (req, res) => {
    const kq = await tt.taoPhien({
      sesis: req.params.sesis,
      soTien: req.body.so_tien,
      maPhuongThuc: req.body.phuong_thuc,
      loai: req.body.loai === 'dat_coc' ? 'dat_coc' : 'thanh_toan',
      nguon: 'quay',
      maGiamGia: req.body.ma_giam_gia || null,
      diemDung: Number(req.body.diem_dung) || 0,
      tienKhachDua: req.body.tien_khach_dua != null && req.body.tien_khach_dua !== ''
        ? Number(req.body.tien_khach_dua) : null,
      tienTip: Number(req.body.tien_tip) || 0,
      ghiChuPhanChia: req.body.ghi_chu_phan_chia || null,
      ghiChu: req.body.ghi_chu || null,
      nhanVienId: req.session.staffId || null,
    });
    await ghiNhatKy(req, 'tao_phien_thanh_toan', kq.payment.id, kq.payment);

    if (kq.payment.status === 'success') {
      phat(req.params.sesis, 'tt:da-thanh-toan', {
        paymentId: kq.payment.id, sesis: req.params.sesis, soTien: Number(kq.payment.amount),
      });
    } else {
      phat(req.params.sesis, 'tt:phien-moi', {
        paymentId: kq.payment.id, sesis: req.params.sesis, soTien: Number(kq.payment.amount),
      });
    }
    res.json({ thanhCong: true, ...kq });
  }));

  /* ======================================================================== */
  /* KHACH TU THANH TOAN TAI BAN (quet QR, khong can dang nhap)              */
  /* ======================================================================== */

  /**
   * Khong co dang nhap thi lay gi de xac thuc?
   *
   * Dieu kien: `sesis` phai dang la phien DANG MO cua mot ban that (co dong
   * trong qr_tables.active_sesis, hoac hopdong.id_ban tro toi mot ban dang
   * phuc vu). Sesis la chuoi ngau nhien, khong doan duoc, va het hieu luc
   * ngay khi don duoc thanh toan xong - dung mo hinh "link bi mat" giong nhu
   * cac trang dat mon tai ban khac.
   *
   * Khach chi TRA TIEN chu khong sua duoc gi, nen rui ro thap nhat.
   */
  async function kiemTraPhienBanMo(req, res, next) {
    const sesis = req.params.sesis;
    const [[don]] = await db.query(
      'SELECT sesis, tinhtrang FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]
    );
    if (!don) return res.status(404).send('Không tìm thấy đơn hàng này.');
    if (don.tinhtrang === 4) return res.status(410).send('Đơn hàng đã bị hủy.');
    req.donHang = don;
    next();
  }

  router.get('/qr/thanh-toan/:sesis', bat(kiemTraPhienBanMo), bat(async (req, res) => {
    const [hoaDon, phuongThuc] = await Promise.all([
      tt.layHoaDon(req.params.sesis, { kenh: 'khach_qr' }),
      tt.danhSachPhuongThuc(),
    ]);
    res.render('thanh-toan-qr', {
      layout: false,
      title: 'Thanh toán',
      hoaDon,
      // Khach tai ban chi duoc chon chuyen khoan. Tien mat phai qua thu ngan
      // (khong the tu bam "toi da dua tien mat"), the thi phai co may POS.
      phuongThuc: phuongThuc.filter((p) => p.code === 'vietqr'),
    });
  }));

  router.get('/qr/thanh-toan/:sesis/hoa-don', bat(kiemTraPhienBanMo), batJson(async (req, res) => {
    const hoaDon = await tt.layHoaDon(req.params.sesis, {
      maGiamGia: req.query.ma_giam_gia || null,
      kenh: 'khach_qr',
    });
    res.json(hoaDon);
  }));

  router.post('/qr/thanh-toan/:sesis/tao-phien', bat(kiemTraPhienBanMo), batJson(async (req, res) => {
    const kq = await tt.taoPhien({
      sesis: req.params.sesis,
      soTien: req.body.so_tien,
      maPhuongThuc: 'vietqr', // khoa cung, khong tin gia tri client gui len
      loai: 'thanh_toan',
      nguon: 'khach_qr',
      maGiamGia: req.body.ma_giam_gia || null,
      tienTip: Number(req.body.tien_tip) || 0,
      ghiChuPhanChia: req.body.ghi_chu_phan_chia || null,
    });
    phat(req.params.sesis, 'tt:phien-moi', {
      paymentId: kq.payment.id, sesis: req.params.sesis,
      soTien: Number(kq.payment.amount), tuKhach: true,
    });
    res.json({ thanhCong: true, ...kq });
  }));

  // Dien thoai khach hoi trang thai. Khong yeu cau dang nhap nhung chi tra ve
  // dung mot phien va khong kem thong tin khach hang.
  router.get('/qr/phien/:id/trang-thai', batJson(async (req, res) => {
    const p = await tt.trangThaiPhien(Number(req.params.id));
    if (!p) return res.status(404).json({ loi: 'Không tìm thấy phiên' });
    res.json({
      id: p.id, status: p.status, so_tien: p.amount,
      con_lai_giay: p.con_lai_giay, da_tra_du: p.da_tra_du, con_phai_tra: p.con_phai_tra,
    });
  }));

  /* ======================================================================== */
  /* DAT COC KHI DAT BAN TRUOC (khach dang nhap tren web)                     */
  /* ======================================================================== */

  router.get('/thanh-toan/dat-coc/:sesis', requireKhachDangNhap, bat(async (req, res) => {
    const sesis = req.params.sesis;
    const [[don]] = await db.query(
      'SELECT sesis, id_user, tinhtrang FROM hopdong WHERE sesis = ? LIMIT 1', [sesis]
    );
    if (!don) return res.status(404).render('error', { title: 'Không tìm thấy', message: 'Đơn đặt bàn không tồn tại.', statusCode: 404 });
    if (don.id_user !== req.session.userId) {
      return res.status(403).render('error', { title: 'Không có quyền', message: 'Đơn này không thuộc tài khoản của bạn.', statusCode: 403 });
    }

    const ch = await tt.layCauHinh();
    const hoaDon = await tt.layHoaDon(sesis, { goiY: false });
    const tienCoc = tt.lamTronLen(
      hoaDon.tien.tong_cong * Number(ch.dat_coc_phan_tram) / 100,
      1000
    );
    res.render('dat-coc', {
      title: 'Đặt cọc giữ bàn',
      hoaDon,
      tienCoc,
      phanTram: Number(ch.dat_coc_phan_tram),
    });
  }));

  router.post('/thanh-toan/dat-coc/:sesis/tao-phien', requireKhachDangNhap, batJson(async (req, res) => {
    const [[don]] = await db.query('SELECT id_user FROM hopdong WHERE sesis = ? LIMIT 1', [req.params.sesis]);
    if (!don || don.id_user !== req.session.userId) {
      return res.status(403).json({ loi: 'Đơn này không thuộc tài khoản của bạn.' });
    }
    const kq = await tt.taoPhien({
      sesis: req.params.sesis,
      soTien: req.body.so_tien,
      maPhuongThuc: 'vietqr',
      loai: 'dat_coc',
      nguon: 'web',
    });
    phat(req.params.sesis, 'tt:phien-moi', { paymentId: kq.payment.id, sesis: req.params.sesis });
    res.json({ thanhCong: true, ...kq });
  }));

  /* ======================================================================== */
  /* WEBHOOK NGAN HANG                                                        */
  /* ======================================================================== */

  /**
   * Nhan bien dong so du.
   *
   * Dinh dang body theo chuan cua SePay - dich vu doc sao ke pho bien nhat o
   * Viet Nam - de neu sau nay dau that vao thi khong phai sua code:
   *   { id, gateway, transactionDate, accountNumber, content,
   *     transferType: 'in'|'out', transferAmount, referenceCode, description }
   *
   * Xac thuc bang header `Authorization: Apikey <khoa>`. Khoa nam trong bang
   * cau_hinh_thanh_toan, xem/sinh lai o /admin/thanh-toan.
   *
   * LUON tra HTTP 200 khi da ghi nhan duoc (ke ca truong hop khong khop phien
   * nao): ben gui se ban lai lien tuc neu nhan ma khac 200, ma giao dich do
   * thi ta da luu vao hop thu roi, van doi soat tay duoc.
   */
  router.post('/api/webhook/ngan-hang', batJson(async (req, res) => {
    const ch = await tt.layCauHinh(true);
    const khoa = String(ch.webhook_api_key || '');
    const header = String(req.headers.authorization || '');
    const khoaGui = header.replace(/^Apikey\s+/i, '').replace(/^Bearer\s+/i, '').trim();

    if (!khoa || khoaGui !== khoa) {
      console.warn('[webhook] sai khoa xac thuc, tu choi. IP:', req.ip);
      return res.status(401).json({ success: false, message: 'Sai khóa xác thực' });
    }

    const b = req.body || {};
    const kq = await tt.ghiNhanGiaoDichNganHang({
      ma_tham_chieu: String(b.referenceCode || b.id || b.ma_tham_chieu || ''),
      cong_thanh_toan: b.gateway || b.cong_thanh_toan || null,
      so_tai_khoan: b.accountNumber || b.so_tai_khoan || null,
      so_tien: b.transferAmount ?? b.so_tien ?? 0,
      loai: (b.transferType || b.loai || 'in') === 'out' ? 'out' : 'in',
      noi_dung: b.content || b.description || b.noi_dung || '',
      thoi_diem: b.transactionDate || b.thoi_diem || null,
      du_lieu_tho: b,
    });

    if (kq.khop && kq.payment) {
      phat(kq.payment.sesis, 'tt:da-thanh-toan', {
        paymentId: kq.payment.id, sesis: kq.payment.sesis,
        soTien: Number(kq.payment.amount), tuWebhook: true,
        donDaTraDu: !!(kq.ketQua && kq.ketQua.donDaTraDu),
      });
      io.to('thanh_toan').emit('tt:bien-dong-so-du', { khop: true, ma: kq.ma });
    } else {
      io.to('thanh_toan').emit('tt:bien-dong-so-du', { khop: false, lyDo: kq.lyDo || null });
    }

    res.json({ success: true, matched: !!kq.khop, duplicated: !!kq.trungLap });
  }));

  /* ======================================================================== */
  /* ADMIN - CAU HINH                                                         */
  /* ======================================================================== */

  router.get('/admin/thanh-toan', requireAdmin, bat(async (req, res) => {
    const [cauHinh, taiKhoan, phuongThuc, tongHop] = await Promise.all([
      tt.layCauHinh(true),
      tt.layTaiKhoanNhan(),
      tt.danhSachPhuongThuc(),
      tt.tongHopTheoPhuongThuc({}),
    ]);

    // QR tinh (khong kem so tien) de in dan tai quay - khach tu nhap so tien.
    let qrTinh = null;
    if (taiKhoan) {
      qrTinh = await vietQR.taoQRChuyenKhoan({
        maNganHang: taiKhoan.maNganHang,
        soTaiKhoan: taiKhoan.soTaiKhoan,
        noiDung: 'NHA HANG BAO DOAN',
      }, { kichThuoc: 260 }).catch(() => null);
    }

    res.render('admin/thanh-toan', {
      title: 'Cấu hình thanh toán',
      cauHinh, taiKhoan, phuongThuc, tongHop, qrTinh,
      danhSachNganHang: vietQR.danhSachNganHang(),
      thongBao: req.query.tb || null,
    });
  }));

  router.post('/admin/thanh-toan/tai-khoan', requireAdmin, bat(async (req, res) => {
    // Sinh thu mot ma QR truoc khi luu. Neu so tai khoan hoac ma ngan hang sai
    // thi bao loi ngay tai day, thay vi de thu ngan phat hien luc khach dang
    // dung cho truoc quay.
    await vietQR.taoQRChuyenKhoan({
      maNganHang: req.body.ma_ngan_hang,
      soTaiKhoan: req.body.so_tai_khoan,
      soTien: 10000,
      noiDung: 'KIEM TRA',
    });
    await tt.luuTaiKhoanNhan(req.body);
    res.redirect('/admin/thanh-toan?tb=' + encodeURIComponent('Đã lưu tài khoản nhận tiền'));
  }));

  router.post('/admin/thanh-toan/cau-hinh', requireAdmin, bat(async (req, res) => {
    const CHO_PHEP = [
      'thue_vat', 'phi_phuc_vu', 'lam_tron', 'ty_le_tich_diem', 'gia_tri_1_diem',
      'toi_da_diem_moi_don', 'han_qr_giay', 'dat_coc_phan_tram', 'tu_dong_doi_soat',
    ];
    const capNhat = {};
    for (const k of CHO_PHEP) {
      if (req.body[k] !== undefined) capNhat[k] = req.body[k];
    }
    // Checkbox khong gui gi khi khong tich -> phai dat lai ve 0 bang tay.
    capNhat.tu_dong_doi_soat = req.body.tu_dong_doi_soat ? 1 : 0;
    await tt.luuCauHinh(capNhat);
    res.redirect('/admin/thanh-toan?tb=' + encodeURIComponent('Đã lưu cấu hình'));
  }));

  router.post('/admin/thanh-toan/sinh-khoa-webhook', requireAdmin, bat(async (req, res) => {
    const khoa = 'BAODOAN_' + Math.random().toString(36).slice(2, 14).toUpperCase()
      + Math.random().toString(36).slice(2, 8).toUpperCase();
    await tt.luuCauHinh({ webhook_api_key: khoa });
    res.redirect('/admin/thanh-toan?tb=' + encodeURIComponent('Đã sinh khóa webhook mới'));
  }));

  router.post('/admin/thanh-toan/phuong-thuc/:id/bat-tat', requireAdmin, bat(async (req, res) => {
    await db.query('UPDATE payment_methods SET is_active = 1 - is_active, updated_at = NOW() WHERE id = ?', [req.params.id]);
    res.redirect('/admin/thanh-toan');
  }));

  /* ======================================================================== */

  /** Hom nay theo gio may chu, dang YYYY-MM-DD. */
  function homNay() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** Ghi audit_logs. Bat loi rieng vi mat nhat ky khong duoc lam hong thanh toan. */
  async function ghiNhatKy(req, hanhDong, paymentId, chiTiet) {
    try {
      await db.query(
        `INSERT INTO audit_logs (action, actor_type, actor_id, actor_name, resource_type, resource_id, status, details, ip_address)
         VALUES (?, ?, ?, ?, 'payment', ?, 'success', ?, ?)`,
        [
          hanhDong,
          req.session.adminlogin ? 'admin' : (req.session.stafflogin ? 'staff' : 'customer'),
          req.session.staffId || req.session.idadmin || req.session.userId || null,
          req.session.staffName || req.session.adminname || req.session.username || null,
          paymentId,
          JSON.stringify({ sesis: chiTiet.sesis, so_tien: chiTiet.amount, ma_doi_soat: chiTiet.ma_doi_soat }),
          req.ip,
        ]
      );
    } catch (e) { /* khong chan luong thanh toan */ }
  }

  /** Nhat ky cho chot ca. Tach rieng vi resource_type khac va chi tiet khac. */
  async function ghiNhatKyChotCa(req, hanhDong, id, chiTiet) {
    try {
      await db.query(
        `INSERT INTO audit_logs (action, actor_type, actor_id, actor_name, resource_type, resource_id, status, details, ip_address)
         VALUES (?, ?, ?, ?, 'shift_closing', ?, 'success', ?, ?)`,
        [
          hanhDong,
          req.session.adminlogin ? 'admin' : 'staff',
          req.session.staffId || req.session.idadmin || null,
          req.session.staffName || req.session.adminname || null,
          id,
          JSON.stringify({
            chenh_lech: chiTiet.chenh_lech,
            tien_mat_he_thong: chiTiet.tien_mat_he_thong,
            tien_mat_dem_duoc: chiTiet.tien_mat_dem_duoc,
          }),
          req.ip,
        ]
      );
    } catch (e) { /* mat nhat ky khong duoc lam hong viec chot ca */ }
  }

  return router;
};

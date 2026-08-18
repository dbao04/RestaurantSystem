/**
 * Trung tam thoi gian thuc cua he thong.
 *
 * VI SAO CAN TAP TRUNG
 * --------------------
 * Truoc day moi noi tu goi io.to('kitchen_room').emit(...) voi ten phong viet
 * tay. Chi co hai phong ('kitchen_room', 'staff_room') nen khong the gui rieng
 * cho To truong bep, hay cho toan bo cap giam sat tro len. Module nay dinh nghia
 * mot he thong phong theo dung co cau to chuc, va moi noi khac chi goi ham o day.
 *
 * HE THONG PHONG
 * --------------
 *   nv:<id_nv>     mot nguoi cu the (moi thiet bi cua ho deu o trong)
 *   cd:<ma_cd>     tat ca nguoi giu mot chuc danh   vd cd:BEPTRUONG
 *   bp:<ma_bp>     tat ca nguoi thuoc mot bo phan   vd bp:BEP
 *   cap:<n>        tat ca nguoi co cap_bac = n
 *   to:<id_to>     mot to lam viec
 *   nhan_su        moi nhan vien dang dang nhap
 *   quan_ly        moi nguoi co la_quan_ly = 1
 *   quan_tri       phien /admin (khong phai nhan vien, khong co id_nv)
 *
 * Mot socket vao NHIEU phong cung luc. Bep truong (cap 2, bo phan BEP) se o
 * trong: nv:8, cd:BEPTRUONG, bp:BEP, cap:2, nhan_su, quan_ly, va cac to cua ho.
 * Nho vay "gui cho giam sat tro len" chi la emit vao cap:1, cap:2, cap:3.
 *
 * DANH TINH LA TIN CAY
 * --------------------
 * Socket doc thang express-session (`socket.request.session`) chu KHONG nhan
 * id tu client gui len. Truoc day client tu khai `join-room` voi role tuy y -
 * bat ky ai cung tu xung 'Bep' de nghe don bep. Nay danh tinh lay tu phien dang
 * nhap nen khong gia mao duoc.
 *
 * HIEN DIEN
 * ---------
 * Dem SO KET NOI thay vi co online/offline. Mot nguoi mo may tinh quay va dien
 * thoai la 2 ket noi; dong mot cai khong lam ho bien mat khoi bang dieu hanh.
 */
const db = require('../config/db');
const phanQuyen = require('./phanQuyenService');

let io = null;

/** id_nv -> Set<socket.id>. Nguon su that trong bo nho, DB chi la ban sao de doc. */
const ketNoiTheoNv = new Map();

// ---------------------------------------------------------------------------
// Tien ich phong
// ---------------------------------------------------------------------------
const P = {
  nv: (id) => `nv:${id}`,
  cd: (ma) => `cd:${ma}`,
  bp: (ma) => `bp:${ma}`,
  cap: (n) => `cap:${n}`,
  to: (id) => `to:${id}`,
  /**
   * Phong theo doi MOT don giao hang.
   *
   * Khac moi phong con lai o cho nguoi trong phong nay co the la KHACH, khong
   * dang nhap nhan vien. Ho vao bang ma tra cuu in tren don (`ma_giao`), va chi
   * nhan duoc toa do cua shipper dang cam DUNG don do - khong thay shipper khac,
   * khong thay don khac. Xem `socket.on('giao-hang:theo-doi')` ben duoi.
   */
  giao: (id) => `giao:${id}`,
  /**
   * Phong GIAO cua bo phan va cap bac.
   *
   * Can rieng vi phong Socket.IO chi hop duoc, khong giao duoc: neu gui vao
   * ca `bp:PV` lan `cap:3` thi MOI nguoi bo phan phuc vu deu nhan, ke ca phu
   * ban cap 6 - sai voi y "bao len cap 3 tro len cua bo phan phuc vu".
   */
  bpcap: (maBp, cap) => `bpcap:${maBp}:${cap}`,
  NHAN_SU: 'nhan_su',
  QUAN_LY: 'quan_ly',
  QUAN_TRI: 'quan_tri',
};

/**
 * Cac MIEN du lieu cua he thong.
 *
 * VI SAO CAN
 * ----------
 * Truoc day chi nhung man hinh "nong" (KDS, so do ban, thanh toan) moi co su
 * kien rieng. Con kho, thuc don, dat ban, luong... deu khong phat gi ca, nen
 * hai nguoi cung sua mot man hinh se de len nhau ma khong ai biet.
 *
 * Dat mot ten su kien cho MOI MIEN du lieu thay vi mot ten cho moi thao tac:
 * trang xem kho khong quan tam la "nhap kho" hay "sua nguyen lieu" hay "xoa
 * don vi tinh" - no chi can biet "kho vua doi, tai lai di". Nho vay them mot
 * route ghi du lieu chi la them mot dong `realtime.doi(MIEN.KHO)`.
 *
 * Goi tin CO Y khong mang du lieu nghiep vu: client se tu goi lai chinh URL
 * dang xem, va route do tu kiem tra quyen. Nho vay phat rong khong lam ro ri
 * du lieu - nguoi khong co quyen xem trang luong thi co nhan duoc 'luong:doi'
 * cung khong doc them duoc gi.
 */
const MIEN = {
  KHO: 'kho:doi',              // nguyen lieu, nhap kho, don vi tinh, cong thuc
  THIET_BI: 'thiet-bi:doi',
  THUC_DON: 'thuc-don:doi',    // mon, danh muc, combo (ca /admin lan /staff/kitchen)
  DAT_BAN: 'dat-ban:doi',
  KHACH_HANG: 'khach-hang:doi',
  DON_HANG: 'don-hang:doi',
  GIAO_HANG: 'giao-hang:doi',   // don vi van chuyen, shipper, don giao
  CHOT_CA: 'chot-ca:doi',
  CA_BEP: 'ca-bep:doi',
  NGHI_PHEP: 'nghi-phep:doi',
  LICH_LAM: 'lich-lam:doi',
  LUONG: 'luong:doi',
  CHI_PHI: 'chi-phi:doi',
  NHAN_SU: 'nhan-su:doi',
  HOP_DONG: 'hop-dong:doi',
  BLOG: 'blog:doi',
  QR_BAN: 'qr-ban:doi',
  EMAIL: 'email:doi',
};

/** Cac phong mot nhan vien thuoc ve, tinh tu ho so quyen. */
async function phongCua(hoSo) {
  const ds = [P.nv(hoSo.id_nv), P.NHAN_SU];
  if (hoSo.ma_cd) ds.push(P.cd(hoSo.ma_cd));
  if (hoSo.ma_bp) ds.push(P.bp(hoSo.ma_bp));
  if (hoSo.cap_bac) ds.push(P.cap(hoSo.cap_bac));
  if (hoSo.ma_bp && hoSo.cap_bac) ds.push(P.bpcap(hoSo.ma_bp, hoSo.cap_bac));
  if (hoSo.la_quan_ly) ds.push(P.QUAN_LY);

  const [to] = await db.query(
    'SELECT id_to FROM thanh_vien_to WHERE id_nv = ? AND trang_thai = 1',
    [hoSo.id_nv]
  );
  to.forEach((t) => ds.push(P.to(t.id_to)));
  return ds;
}

// ---------------------------------------------------------------------------
// Hien dien
// ---------------------------------------------------------------------------
async function ghiHienDien(idNv, soKetNoi, trang) {
  const trangThai = soKetNoi > 0 ? 'online' : 'offline';
  await db.query(
    `INSERT INTO hien_dien_nv (id_nv, trang_thai, so_ket_noi, trang_hien_tai, online_luc, hoat_dong_cuoi)
     VALUES (?,?,?,?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       trang_thai = VALUES(trang_thai),
       so_ket_noi = VALUES(so_ket_noi),
       trang_hien_tai = COALESCE(VALUES(trang_hien_tai), trang_hien_tai),
       online_luc = IF(so_ket_noi = 0 AND VALUES(so_ket_noi) > 0, NOW(), online_luc),
       hoat_dong_cuoi = NOW()`,
    [idNv, trangThai, soKetNoi, trang || null]
  );
}

/** Ai dang online, kem chuc danh - dung cho bang dieu hanh. */
async function dangOnline() {
  const [rows] = await db.query(
    `SELECT h.id_nv, h.trang_thai, h.so_ket_noi, h.trang_hien_tai,
            h.online_luc, h.hoat_dong_cuoi,
            n.ten, n.ma_nv, cd.ten_cd, cd.ma_cd, cd.cap_bac,
            bp.ten_bp, bp.ma_bp, bp.mau_sac
     FROM hien_dien_nv h
     JOIN nhan_vien n     ON n.id_nv = h.id_nv
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN bo_phan bp   ON bp.id_bp = cd.id_bp
     WHERE h.so_ket_noi > 0
     ORDER BY cd.cap_bac, bp.thu_tu, n.ten`
  );
  return rows.map((r) => ({ ...r, ten: String(r.ten || '').trim() }));
}

// ---------------------------------------------------------------------------
// Phat su kien
// ---------------------------------------------------------------------------

/**
 * Phat su kien den cac dich cu the.
 *
 * @param {string} tenSuKien
 * @param {object} duLieu
 * @param {object} dich - { nv, cd, bp, cap, to, quanLy, tatCa, capTroLen }
 *   capTroLen: 3 nghia la gui cho cap 1, 2, 3 (giam sat tro len)
 */
function phat(tenSuKien, duLieu, dich = {}) {
  if (!io) return;
  const goi = { ...duLieu, _luc: new Date().toISOString() };
  const phong = new Set();

  const gom = (gia_tri, ham) => {
    if (gia_tri == null) return;
    (Array.isArray(gia_tri) ? gia_tri : [gia_tri]).forEach((v) => phong.add(ham(v)));
  };

  gom(dich.nv, P.nv);
  gom(dich.cd, P.cd);
  gom(dich.bp, P.bp);
  gom(dich.cap, P.cap);
  gom(dich.to, P.to);
  if (dich.capTroLen) {
    for (let i = 1; i <= Number(dich.capTroLen); i++) phong.add(P.cap(i));
  }
  if (dich.quanLy) phong.add(P.QUAN_LY);
  if (dich.quanTri) phong.add(P.QUAN_TRI);
  if (dich.tatCa) phong.add(P.NHAN_SU);

  if (!phong.size) return;
  io.to([...phong]).emit(tenSuKien, goi);
}

/** Phat cho moi nguoi dang dang nhap (nhan vien va quan tri). */
function phatToanBo(tenSuKien, duLieu) {
  phat(tenSuKien, duLieu, { tatCa: true, quanTri: true });
}

/**
 * Bao "mien du lieu nay vua doi".
 *
 * Goi o MOI route co ghi du lieu. Client dang mo trang lien quan se tu tai lai
 * phan noi dung - khong ai phai bam F5 nua, va hai nguoi sua cung mot bang se
 * thay thay doi cua nhau trong vong mot nhip.
 *
 * `chiTiet` chi de hien thong bao cho de hieu ("Bếp vừa nhập kho"), KHONG dung
 * lam nguon du lieu - trang luon doc lai tu server.
 *
 * Mac dinh gui cho moi nhan vien VA moi phien quan tri. Truyen `dich` khi muon
 * hep hon, vi du luong chi bao cho quan ly va quan tri.
 */
function doi(mien, chiTiet, dich) {
  phat(mien, { mien, ...(chiTiet || {}) }, dich || { tatCa: true, quanTri: true });
}

/**
 * Bao mot viec can cap tren xu ly.
 *
 * Nguoi nhan = GIAO cua hai dieu kien: dung bo phan phu trach VA du cap bac.
 * Vi du dau bep bao het mon (cap_bac_toi_thieu = 4, bo phan BEP) thi To truong
 * bep / Bep pho / Bep truong nhan duoc, con phu bep cung bo phan thi khong, va
 * to truong phuc vu khac bo phan cung khong.
 *
 * Quan ly nha hang (cap 1) luon nhan moi viec - ho chiu trach nhiem cuoi cung.
 */
function phongViec(viec) {
  const capToiThieu = Number(viec.cap_bac_toi_thieu) || 4;
  const phong = new Set([P.cap(1)]);

  if (viec.ma_bp) {
    // Co bo phan phu trach: chi nguoi cua bo phan do, tu cap yeu cau tro len.
    for (let c = 1; c <= capToiThieu; c++) phong.add(P.bpcap(viec.ma_bp, c));
  } else {
    // Khong ro bo phan: bao cho moi nguoi du cap, bat ke bo phan nao.
    for (let c = 1; c <= capToiThieu; c++) phong.add(P.cap(c));
  }
  return phong;
}

function bao(viec) {
  if (!io) return;
  io.to([...phongViec(viec)]).emit('viec:moi', { ...viec, _luc: new Date().toISOString() });
}

/**
 * Viec vua doi trang thai. Ngoai nhung nguoi co tham quyen xu ly, phai bao
 * NGUOC ve nguoi da tao viec - ho can biet bao cao cua minh da duoc tiep nhan.
 */
function baoCapNhat(viec) {
  if (!io) return;
  const phong = phongViec(viec);
  if (viec.id_nv_tao) phong.add(P.nv(viec.id_nv_tao));
  io.to([...phong]).emit('viec:cap-nhat', { ...viec, _luc: new Date().toISOString() });
}

/**
 * Phat vi tri moi cua mot shipper.
 *
 * TAI SAO KHONG DUNG `doi()` NHU CAC MIEN KHAC
 * --------------------------------------------
 * `doi()` co y KHONG mang du lieu nghiep vu: nguoi nhan tu goi lai URL dang xem
 * va route do kiem tra quyen. Cach do dung cho mot bang kho hay mot danh sach
 * luong - moi vai phut doi mot lan.
 *
 * Vi tri shipper doi moi 15 giay va chi la ba con so. Bat ban do goi lai ca
 * trang moi lan nhu vay la hang tram request mot phut cho mot cham di chuyen
 * duoc 20 met. Nen goi tin nay MANG toa do di theo, va bu lai bang cach thu hep
 * nguoi nhan that chat:
 *
 *   bp:GH + quan_ly + quan_tri   nguoi dieu phoi va cap quan ly - xem duoc het
 *   nv:<id_nv cua shipper>       chinh shipper do, de dien thoai ho tu ve lai
 *   giao:<id_giao>               khach dang mo trang theo doi DUNG don do
 *
 * Khach trong phong `giao:` chi nhan toa do, khong nhan ten shipper hay so don
 * khac - xem `goiChoKhach` ben duoi.
 */
function viTriShipper(dl) {
  if (!io) return;
  const luc = new Date().toISOString();

  // Ban day du cho nguoi trong nha.
  const phongNoiBo = [P.bp('GH'), P.QUAN_LY, P.QUAN_TRI];
  if (dl.id_nv) phongNoiBo.push(P.nv(dl.id_nv));
  io.to(phongNoiBo).emit('shipper:vi-tri', { ...dl, _luc: luc });

  // Ban rut gon cho khach: chi du de ve mot cham dang chay tren ban do.
  if (dl.id_giao) {
    io.to(P.giao(dl.id_giao)).emit('giao-hang:vi-tri', {
      id_giao: dl.id_giao,
      vi_do: dl.vi_do,
      kinh_do: dl.kinh_do,
      huong: dl.huong ?? null,
      _luc: luc,
    });
  }
}

/**
 * Bao don giao hang vua doi trang thai.
 *
 * Gui cho ca ba phia cung mot luc: dieu phoi (de cap nhat bang), shipper duoc
 * phan (de dien thoai ho keu len khi co don moi), va khach dang theo doi.
 */
function donGiaoDoi(don) {
  if (!io) return;
  const luc = new Date().toISOString();
  const goi = {
    id_giao: don.id_giao, ma_giao: don.ma_giao, sesis: don.sesis,
    trang_thai: don.trang_thai, nhan: don.nhan || null,
    ten_shipper: don.ten_shipper || null, _luc: luc,
  };

  const phong = [P.bp('GH'), P.QUAN_LY, P.QUAN_TRI];
  if (don.id_nv_shipper) phong.push(P.nv(don.id_nv_shipper));
  io.to(phong).emit('giao-hang:doi-trang-thai', goi);

  if (don.id_giao) {
    io.to(P.giao(don.id_giao)).emit('giao-hang:doi-trang-thai', {
      id_giao: don.id_giao, trang_thai: don.trang_thai, nhan: don.nhan || null, _luc: luc,
    });
  }
}

// ---------------------------------------------------------------------------
// Khoi tao
// ---------------------------------------------------------------------------

/**
 * Gan vao Socket.IO server. Goi mot lan trong server.js sau khi da co io va
 * sessionMiddleware da duoc gan qua io.engine.use().
 */
function khoiTao(_io) {
  io = _io;

  // Server vua khoi dong lai: moi ket noi cu deu da chet, don bang hien dien
  // de khong con ai "online ma" tren bang dieu hanh.
  db.query("UPDATE hien_dien_nv SET so_ket_noi = 0, trang_thai = 'offline'")
    .catch((e) => console.warn('[realtime] không dọn được bảng hiện diện:', e.message));

  io.on('connection', async (socket) => {
    const phien = socket.request.session;

    // --- Khach hang: giu nguyen hanh vi cu (phong room_<userId> cho chat) ---
    if (phien && phien.userlogin && phien.userId) {
      socket.join(`room_${phien.userId}`);
    }

    /*
     * Theo doi mot don giao hang.
     *
     * Dang ky TRUOC moi nhanh phan loai ben duoi vi nguoi dung o day co the la
     * bat ky ai: khach da dang nhap, khach vang lai mo duong dan tra cuu, hay
     * chinh nhan vien mo trang khach de doi chieu.
     *
     * DANH TINH O DAY LA MA DON, KHONG PHAI PHIEN DANG NHAP
     * -----------------------------------------------------
     * Khac moi phong con lai. Khong the doi hoi dang nhap: don giao hang dat qua
     * dien thoai hay quet ma QR tai ban thi nguoi nhan khong co tai khoan nao ca.
     * `ma_giao` dong vai tro ma bi mat - no chi in tren don cua chinh khach do.
     *
     * Ba lop chan de ma bi mat do khong bi do:
     *   1. Chi nhan don CHUA XONG. Don da giao hom truoc thi ma het tac dung,
     *      nguoi nhat duoc to hoa don cu khong theo doi duoc ai.
     *   2. Moi socket vao toi da 5 phong theo doi. Khong the ngoi thu ma hang
     *      loat tren mot ket noi.
     *   3. Goi tin gui vao phong nay chi co toa do (xem `viTriShipper`), khong
     *      co ten shipper, so dien thoai hay dia chi khach.
     */
    const dangTheoDoi = new Set();
    socket.on('giao-hang:theo-doi', async (ma, traLoi) => {
      const bao = (kq) => { if (typeof traLoi === 'function') traLoi(kq); };
      const maGiao = String(ma || '').trim().toUpperCase().slice(0, 20);
      if (!/^[A-Z0-9-]{4,20}$/.test(maGiao)) return bao({ ok: false, loi: 'Mã đơn không hợp lệ.' });
      if (dangTheoDoi.size >= 5) return bao({ ok: false, loi: 'Đang theo dõi quá nhiều đơn.' });

      try {
        const [[don]] = await db.query(
          `SELECT id_giao, trang_thai FROM don_giao_hang
           WHERE ma_giao = ? AND trang_thai NOT IN ('da_giao','huy')`,
          [maGiao]
        );
        if (!don) return bao({ ok: false, loi: 'Đơn không tồn tại hoặc đã kết thúc.' });
        socket.join(P.giao(don.id_giao));
        dangTheoDoi.add(don.id_giao);
        bao({ ok: true, id_giao: don.id_giao, trang_thai: don.trang_thai });
      } catch (e) {
        console.error('[realtime] theo doi don giao:', e.message);
        bao({ ok: false, loi: 'Không kết nối được, thử lại sau.' });
      }
    });

    // --- Quan tri (/admin) ---
    //
    // Phien quan tri KHONG phai nhan vien: khong co id_nv, khong co chuc danh,
    // nen khong vao duoc he thong phong theo co cau to chuc va cung khong tinh
    // vao bang hien dien. Nhung ho van can nghe du lieu doi de bang dieu khien
    // va cac danh sach tu cap nhat. Cho vao phong rieng `quan_tri` va phong
    // `quan_ly` - ho la cap cao nhat nen moi viec canh bao deu den tay.
    if (phien && phien.adminlogin) {
      socket.join([P.QUAN_TRI, P.QUAN_LY]);
      socket.emit('realtime:san-sang', {
        quan_tri: true,
        ten: phien.adminname || 'Quản trị viên',
        phong: [P.QUAN_TRI, P.QUAN_LY],
        so_quyen: 0,
      });
      return;
    }

    // --- Nhan vien ---
    if (!phien || !phien.stafflogin || !phien.staffId) {
      // Van cho phep khach ket noi (chat), chi khong vao phong noi bo.
      socket.on('join-room', (data) => {
        // Tuong thich nguoc: trang chat cu goi join-room voi userId.
        if (data && typeof data !== 'object' && phien && phien.userId == data) {
          socket.join(`room_${data}`);
        }
      });
      return;
    }

    const idNv = Number(phien.staffId);
    let hoSo;
    try {
      hoSo = await phanQuyen.hoSoQuyen(idNv);
    } catch (e) {
      console.error('[realtime] không đọc được hồ sơ quyền:', e.message);
      return;
    }
    if (!hoSo) return;

    // Vao dung cac phong theo co cau to chuc.
    const phong = await phongCua(hoSo);
    socket.join(phong);

    // Giu tuong thich voi ma cu: kitchen_room / staff_room van con nguoi nghe.
    if (hoSo.vai_tro_tuong_duong.includes('Bep')) socket.join('kitchen_room');
    if (hoSo.vai_tro_tuong_duong.some((v) => ['Phuc vu', 'Ke toan', 'Quay', 'Thu ngan'].includes(v))) {
      socket.join('staff_room');
    }

    // --- Ghi nhan hien dien ---
    if (!ketNoiTheoNv.has(idNv)) ketNoiTheoNv.set(idNv, new Set());
    const tap = ketNoiTheoNv.get(idNv);
    const laLanDau = tap.size === 0;
    tap.add(socket.id);

    await ghiHienDien(idNv, tap.size, socket.handshake.headers.referer || null);
    if (laLanDau) {
      phat('hien-dien:thay-doi', {
        id_nv: idNv, ten: hoSo.ten, ma_cd: hoSo.ma_cd, ten_cd: hoSo.ten_cd,
        ma_bp: hoSo.ma_bp, ten_bp: hoSo.ten_bp, trang_thai: 'online',
      }, { tatCa: true });
    }

    socket.emit('realtime:san-sang', {
      id_nv: idNv,
      ten: hoSo.ten,
      chuc_danh: hoSo.ten_cd,
      bo_phan: hoSo.ten_bp,
      cap_bac: hoSo.cap_bac,
      phong,
      so_quyen: hoSo.quyen.length,
    });

    // --- Client bao dang o trang nao (de bang dieu hanh hien "đang ở KDS") ---
    socket.on('hien-dien:trang', async (trang) => {
      if (typeof trang !== 'string' || trang.length > 150) return;
      await ghiHienDien(idNv, tap.size, trang).catch(() => {});
      phat('hien-dien:thay-doi', { id_nv: idNv, trang_hien_tai: trang }, { quanLy: true });
    });

    // --- Nhip tim: giu hoat_dong_cuoi tuoi de phat hien may treo ---
    socket.on('hien-dien:nhip', async () => {
      await db.query('UPDATE hien_dien_nv SET hoat_dong_cuoi = NOW() WHERE id_nv = ?', [idNv])
        .catch(() => {});
    });

    socket.on('disconnect', async () => {
      tap.delete(socket.id);
      const con = tap.size;
      if (con === 0) ketNoiTheoNv.delete(idNv);
      await ghiHienDien(idNv, con, null).catch(() => {});
      if (con === 0) {
        phat('hien-dien:thay-doi', {
          id_nv: idNv, ten: hoSo.ten, ma_cd: hoSo.ma_cd, trang_thai: 'offline',
        }, { tatCa: true });
      }
    });
  });

  console.log('[realtime] Trung tâm thời gian thực đã sẵn sàng');
  return { phat, phatToanBo, bao, doi };
}

module.exports = {
  khoiTao,
  phat,
  phatToanBo,
  bao,
  baoCapNhat,
  doi,
  viTriShipper,
  donGiaoDoi,
  dangOnline,
  P,
  MIEN,
  get io() { return io; },
};

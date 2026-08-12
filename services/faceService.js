/**
 * Nghiep vu cham cong bang khuon mat (phia Node).
 *
 * Phan chia trach nhiem:
 *   - Python (ml_service/khuon_mat.py) lo TOAN BO thi giac may tinh: phat hien,
 *     trich vector, so khop, chong gia mao, va luu anh bang chung ra dia.
 *   - Node (file nay) lo NGHIEP VU: ghi cham cong vao bang cham_cong, ghi nhat
 *     ky nhan dien, kiem tra khoang cach thoi gian giua hai lan cham, va bao
 *     realtime cho bang dieu hanh.
 *
 * Nho vay vector khuon mat khong bao gio di qua tang Node, va moi truy van SQL
 * nam gon mot cho.
 */
const db = require('../config/db');
const mlService = require('./mlService');

let realtime = null; // nap tre de tranh vong phu thuoc voi server khoi tao

function _rt() {
  if (!realtime) {
    try { realtime = require('./realtime'); } catch { realtime = null; }
  }
  return realtime;
}

// Cac khoa cau_hinh ma tang Node can doc. Ngoai nhom `khuon_mat%` con co toa do
// nha hang va ban kinh cho phep - dung cho rang buoc GPS ben duoi.
const KHOA_CAU_HINH = "khoa LIKE 'khuon_mat%' OR khoa IN " +
  "('nha_hang_vi_do','nha_hang_kinh_do','ban_kinh_cham_cong_m')";

/** Doc tham so khuon mat tu bang cau_hinh (co gia tri mac dinh an toan). */
async function docThamSo() {
  const macDinh = {
    khuon_mat_cach_nhau_giay: 90,
    khuon_mat_bat_gps: 1,
    // Nguong tinh bang PHAN TRAM do khop - dung con so ma nguoi dung nhin thay
    // tren man hinh. Xem chu thich MAC_DINH trong ml_service/khuon_mat.py.
    khuon_mat_nguong_phan_tram: 50,
    khuon_mat_chan_cham_ho: 0,
    khuon_mat_bat_kiem_tra_song: 1,
    khuon_mat_bien_do_quay: 0.06,
    khuon_mat_bien_do_gat: 0.05,
    khuon_mat_ty_le_lai_gan: 1.12,
    nha_hang_vi_do: null,
    nha_hang_kinh_do: null,
    ban_kinh_cham_cong_m: 30,
  };
  try {
    const [rows] = await db.query(`SELECT khoa, gia_tri FROM cau_hinh WHERE ${KHOA_CAU_HINH}`);
    const ts = { ...macDinh };
    for (const r of rows) {
      const so = Number(r.gia_tri);
      ts[r.khoa] = r.gia_tri === null || r.gia_tri === '' || Number.isNaN(so) ? r.gia_tri : so;
    }
    return ts;
  } catch {
    return macDinh;
  }
}

/**
 * Khoang cach giua hai toa do, tinh bang met (cong thuc Haversine).
 *
 * Dung Haversine thay vi tru thang toa do vi mot do kinh do o vi tuyen 10.7 (TP
 * Ho Chi Minh) ngan hon mot do vi do khoang 1.7%; bo qua sai so nay thi ban
 * kinh 30 m se lech vai met - du de chan nham nguoi dung dang dung ngay cua.
 */
function khoangCachMet(viDo1, kinhDo1, viDo2, kinhDo2) {
  const R = 6371000; // ban kinh Trai Dat, met
  const rad = (d) => (d * Math.PI) / 180;
  const dPhi = rad(viDo2 - viDo1);
  const dLam = rad(kinhDo2 - kinhDo1);
  const a = Math.sin(dPhi / 2) ** 2 +
    Math.cos(rad(viDo1)) * Math.cos(rad(viDo2)) * Math.sin(dLam / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Doi chieu vi tri nguoi cham cong voi toa do nha hang.
 *
 * Tra ve { bat, hop_le, khoang_cach_m, thong_bao }.
 *   bat = false  -> quan tri da tat rang buoc GPS, hoac chua khai bao toa do
 *                   nha hang (khong the doi chieu thi khong duoc chan nguoi ta).
 *
 * Sai so cua GPS dien thoai trong nha thuong 20-50 m, nen ban kinh cau hinh
 * duoc cong them do_chinh_xac_m do trinh duyet bao ve (gioi han 100 m de khong
 * ai gia mao bang cach khai bao sai so that lon).
 */
function kiemTraViTri(ts, viTri) {
  const bat = Number(ts.khuon_mat_bat_gps) === 1;
  const viDoNH = Number(ts.nha_hang_vi_do);
  const kinhDoNH = Number(ts.nha_hang_kinh_do);
  const coToaDoNH = Number.isFinite(viDoNH) && Number.isFinite(kinhDoNH) &&
    !(viDoNH === 0 && kinhDoNH === 0);

  if (!bat || !coToaDoNH) {
    return { bat: false, hop_le: true, khoang_cach_m: null, thong_bao: null };
  }

  const co = viTri && Number.isFinite(Number(viTri.vi_do)) && Number.isFinite(Number(viTri.kinh_do));
  if (!co) {
    return {
      bat: true, hop_le: false, khoang_cach_m: null,
      thong_bao: 'Chưa lấy được vị trí GPS. ' +
        (viTri && viTri.ly_do ? viTri.ly_do + ' ' : '') +
        'Hãy cho phép trình duyệt truy cập vị trí rồi chấm công lại.',
    };
  }

  const kc = khoangCachMet(viDoNH, kinhDoNH, Number(viTri.vi_do), Number(viTri.kinh_do));
  const banKinh = Number(ts.ban_kinh_cham_cong_m) || 30;
  const buTru = Math.min(100, Math.max(0, Number(viTri.do_chinh_xac_m) || 0));
  const hopLe = kc <= banKinh + buTru;

  return {
    bat: true,
    hop_le: hopLe,
    khoang_cach_m: Math.round(kc),
    thong_bao: hopLe ? null
      : `Bạn đang cách nhà hàng khoảng ${Math.round(kc)} m, vượt quá bán kính cho phép ` +
        `${banKinh} m. Hãy đến nơi làm việc rồi chấm công.`,
  };
}

/** Cosine -> phan tram do khop de hien thi. Tra null neu chua co so lieu. */
function phanTram(diem) {
  if (diem == null || !Number.isFinite(Number(diem))) return null;
  return Math.round(Math.min(1, Math.max(0, Number(diem))) * 1000) / 10;
}

/** Ghi mot lan cham cong co toa do vao bang cham_cong_gps. */
async function ghiViTri({ idNv, loai, viTri, kiemTra, idNhatKy = null, anh = null }) {
  if (!idNv) return;
  try {
    await db.query(
      `INSERT INTO cham_cong_gps
         (id_nv, loai, vi_do, kinh_do, khoang_cach_m, hop_le, phuong_thuc, anh_selfie, id_nhat_ky)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [idNv, loai,
       viTri && Number.isFinite(Number(viTri.vi_do)) ? Number(viTri.vi_do) : null,
       viTri && Number.isFinite(Number(viTri.kinh_do)) ? Number(viTri.kinh_do) : null,
       kiemTra.khoang_cach_m, kiemTra.hop_le ? 1 : 0, 'khuon_mat_gps', anh, idNhatKy]
    );
  } catch (e) {
    console.warn('[faceService] không ghi được vị trí chấm công:', e.message);
  }
}

/**
 * Ghi mot lan nhan dien vao nhat_ky_nhan_dien.
 *
 * Ghi CA khi that bai (khong khop, gia mao) - day vua la dau vet kiem toan
 * vua la nguon so lieu that de tinh ty le chinh xac khi viet bao cao.
 */
async function ghiNhatKy({ cheDo, idNvKyVong = null, idNvNhanDien = null, ketQua,
                           doTuongDong = null, diemSong = null, duongDanAnh = null,
                           soMat = null, thoiGianMs = null, ghiChu = null,
                           khoangCachM = null, diaChiIp = null }) {
  try {
    const [r] = await db.query(
      `INSERT INTO nhat_ky_nhan_dien
         (che_do, id_nv_ky_vong, id_nv_du_doan, ket_qua, do_tuong_dong,
          diem_song, duong_dan_anh, so_mat_phat_hien, thoi_gian_xu_ly_ms, ghi_chu,
          khoang_cach_m, dia_chi_ip)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cheDo, idNvKyVong, idNvNhanDien, ketQua, doTuongDong, diemSong,
       duongDanAnh, soMat, thoiGianMs, ghiChu, khoangCachM, diaChiIp]
    );
    return r.insertId;
  } catch (e) {
    // Bang co the thieu cot neu migration 007 chua chay du - khong lam sap luong.
    console.warn('[faceService] không ghi được nhật ký nhận diện:', e.message);
    return null;
  }
}

/**
 * Cham cong bang khuon mat.
 *
 * @param {string[]} khung   day khung hinh base64 tu webcam
 * @param {object} opts      { thuThach, idNv (1:1) | null (1:N), boQuaSong, viTri, diaChiIp }
 * @returns ket qua da xu ly, kem thong tin cham cong neu thanh cong
 */
async function chamCong(khung, { thuThach = 'gat_dau', idNv = null, boQuaSong = false,
                                 viTri = null, diaChiIp = null } = {}) {
  const ts = await docThamSo();

  // 0. Rang buoc vi tri - kiem tra TRUOC khi goi Python.
  //
  // Dat truoc vi hai le: cham cong tu xa bi chan ngay trong mot phan giay thay
  // vi doi het luot nhan dien, va cau tra loi "ban dang o cach nha hang 4 km"
  // khong can biet nguoi do la ai. O che do kiosk (1:N) danh tinh chi co sau
  // khi nhan dien, nen ban ghi cham_cong_gps duoc viet o buoc 5.
  const vt = kiemTraViTri(ts, viTri);
  if (vt.bat && !vt.hop_le) {
    const idNhatKy = await ghiNhatKy({
      cheDo: idNv ? 'xac_minh' : 'nhan_dien', idNvKyVong: idNv,
      ketQua: 'sai_vi_tri', khoangCachM: vt.khoang_cach_m, diaChiIp,
      ghiChu: vt.thong_bao,
    });
    await ghiViTri({ idNv, loai: 'chan', viTri, kiemTra: vt, idNhatKy });
    return {
      ok: false, ket_qua: 'sai_vi_tri',
      khoang_cach_m: vt.khoang_cach_m,
      thong_bao: vt.thong_bao,
    };
  }

  // 1. Goi Python: liveness + nhan dien/xac minh.
  let kq;
  try {
    kq = await mlService.khuonMatChamCong(khung, thuThach, idNv, boQuaSong);
  } catch (err) {
    // Python tat hoac loi -> khong the cham cong bang khuon mat.
    return { ok: false, ket_qua: 'loi_dich_vu', thong_bao:
      'Dịch vụ nhận diện chưa sẵn sàng: ' + err.message };
  }

  const cheDo = idNv ? 'xac_minh' : 'nhan_dien';

  // 2. Khong qua kiem tra anh song.
  //
  // Python phan biet BON ly do rat khac nhau; chi MOT trong so do la cao buoc
  // gian lan. Gop chung lai vua sai ban chat, vua khong cho nguoi dung biet
  // phai lam gi de thu lai, va con thoi phong so lieu "nghi gia mao hom nay"
  // tren man hinh quan ly.
  //
  // Truoc day Node doc nguoc ly do bang bieu thuc chinh quy tren chuoi tieng
  // Viet cua Python. Cach do bo sot "khung hinh khong dong nhat" - truong hop
  // xay ra thuong xuyen khi anh sang yeu hoac nguoi dung ngoi xa camera - nen
  // nguoi that bi bao la gia mao. Nay Python tra ve `ma_ly_do` va Node chi tra
  // bang; khong con phan tich van ban giua hai tien trinh nua.
  if (kq.ket_qua === 'khong_qua_song') {
    const lyDo = (kq.song && kq.song.ly_do) || '';
    const maLyDo = (kq.song && kq.song.ma_ly_do) ||
      // Du phong khi ml_service chua khoi dong lai sau khi cap nhat.
      (/Chua lam dung dong tac/i.test(lyDo) ? 'chua_dat_thu_thach'
        : /Khong thay ro mat|Chi thay ro mat/i.test(lyDo) ? 'khong_du_khung'
        : /khong phai cung mot nguoi|khong dong nhat/i.test(lyDo) ? 'khung_khong_dong_nhat'
        : 'nghi_gia_mao');

    // ket_qua ghi vao nhat ky + cau noi cho nguoi dung, tra theo ma ly do.
    const PHAN_LOAI = {
      chua_dat_thu_thach: ['chua_dat_thu_thach',
        'Chưa nhận đủ động tác yêu cầu. Hãy làm dứt khoát hơn một chút ' +
        'và giữ khuôn mặt trong khung suốt lúc chấm, rồi thử lại.'],
      khong_du_khung: ['chua_dat_thu_thach',
        'Không thấy rõ mặt trong đủ số khung hình. Hãy ngồi gần camera hơn, ' +
        'lấy ánh sáng chiếu từ phía trước mặt, rồi thử lại.'],
      khung_khong_dong_nhat: ['khung_khong_dong_nhat',
        'Các khung hình chụp được không đồng nhất — thường do thiếu sáng, ' +
        'ngồi xa camera hoặc cử động quá nhanh. Hãy ngồi gần hơn, tránh ngược sáng ' +
        'và làm động tác chậm lại, rồi thử lại.'],
      // Chi kem diem so, khong noi them cau tieng Viet khong dau cua Python vao
      // - no lap lai dung y da noi. Cau day du van nam trong nhat ky.
      nghi_gia_mao: ['gia_mao',
        'Nghi ngờ ảnh chụp lại từ ảnh in hoặc màn hình' +
        (kq.song && kq.song.diem_song != null
          ? ' (điểm ảnh sống ' + kq.song.diem_song.toFixed(2) + ').' : '.') +
        ' Hãy dùng khuôn mặt thật.'],
    };
    const [ketQua, thongBao] = PHAN_LOAI[maLyDo] || PHAN_LOAI.nghi_gia_mao;

    await ghiNhatKy({
      cheDo, idNvKyVong: idNv, ketQua,
      diemSong: kq.song ? kq.song.diem_song : null,
      khoangCachM: vt.khoang_cach_m, diaChiIp,
      ghiChu: lyDo || 'Không qua kiểm tra ảnh sống',
    });

    return { ok: false, ket_qua: ketQua, thong_bao: thongBao, song: kq.song };
  }

  // 3. Xac dinh nhan vien.
  let idNvKq = null;
  let doTuongDong = kq.do_tuong_dong != null ? kq.do_tuong_dong : (kq.do_tuong_dong_nhat || null);

  // Python da tinh san phan tram va nguong dang ap dung; Node chi chuyen tiep de
  // man hinh khong tu quy doi mot kieu khac.
  const pt = kq.phan_tram != null ? kq.phan_tram : phanTram(doTuongDong);
  const nguongPt = kq.nguong_phan_tram != null
    ? kq.nguong_phan_tram
    : phanTram(ts.khuon_mat_nguong_phan_tram / 100);

  if (idNv) {
    // 1:1
    if (kq.ket_qua === 'thanh_cong') idNvKq = idNv;
    else if (kq.ket_qua === 'nghi_cham_ho') {
      await ghiNhatKy({ cheDo, idNvKyVong: idNv, idNvNhanDien: kq.id_nv_gan_nhat,
        ketQua: 'nghi_cham_ho', doTuongDong, diemSong: kq.song?.diem_song,
        duongDanAnh: kq.duong_dan_anh, soMat: kq.so_mat_phat_hien, thoiGianMs: kq.thoi_gian_xu_ly_ms,
        ghiChu: `Người khác (${kq.ten_gan_nhat || kq.id_nv_gan_nhat}) giống hơn` });
      return { ok: false, ket_qua: 'nghi_cham_ho',
        thong_bao: 'Nghi ngờ chấm hộ: khuôn mặt khớp với người khác hơn. Vui lòng thử lại.' };
    } else if (kq.ket_qua === 'chua_dang_ky') {
      return { ok: false, ket_qua: 'chua_dang_ky',
        thong_bao: 'Bạn chưa đăng ký khuôn mặt. Hãy vào trang đăng ký trước.' };
    } else {
      await ghiNhatKy({ cheDo, idNvKyVong: idNv, ketQua: 'khong_khop', doTuongDong,
        diemSong: kq.song?.diem_song, duongDanAnh: kq.duong_dan_anh,
        soMat: kq.so_mat_phat_hien, thoiGianMs: kq.thoi_gian_xu_ly_ms });
      // Noi ro thieu bao nhieu chu khong chi "khong khop": nguoi dung biet minh
      // dang o 47% so voi nguong 50% thi se ngoi gan hon roi thu lai, con mot
      // cau "khong khop" tron thi ho chi biet bam lai may lan nua.
      return { ok: false, ket_qua: 'khong_khop', phan_tram: pt, nguong_phan_tram: nguongPt,
        thong_bao: pt != null
          ? `Khuôn mặt chỉ khớp ${pt}%, chưa đạt mức tối thiểu ${nguongPt}%. ` +
            'Hãy ngồi gần camera hơn, lấy ánh sáng chiếu từ phía trước mặt rồi thử lại.'
          : 'Khuôn mặt không khớp. Vui lòng thử lại hoặc chấm công thủ công.' };
    }
  } else {
    // 1:N (kiosk)
    if (kq.ket_qua === 'thanh_cong' && kq.id_nv_gan_nhat) {
      idNvKq = Number(kq.id_nv_gan_nhat);
      doTuongDong = kq.do_tuong_dong;
    } else {
      await ghiNhatKy({ cheDo, ketQua: 'khong_khop', doTuongDong,
        diemSong: kq.song?.diem_song, duongDanAnh: kq.duong_dan_anh,
        soMat: kq.so_mat_phat_hien, thoiGianMs: kq.thoi_gian_xu_ly_ms });
      // O kiosk con mot ket cuc nua: khop du cao nhung hai nguoi trong thu vien
      // giong nhau qua nen khong biet chon ai (`khong_chac_chan`). Cau tra loi
      // dung trong truong hop do khong phai "lai gan camera hon" ma la "may khong
      // dam chon" - noi nham thi nguoi dung cu lai gan mai ma khong bao gio vao.
      const chuaChac = kq.ket_qua === 'khong_chac_chan';
      return { ok: false, ket_qua: 'khong_khop', phan_tram: pt, nguong_phan_tram: nguongPt,
        thong_bao: chuaChac
          ? `Khớp ${pt}% nhưng có hai hồ sơ khuôn mặt gần giống nhau nên máy không ` +
            'xác định được là ai. Hãy dùng máy chấm công cá nhân sau khi đăng nhập, ' +
            'hoặc nhờ quản lý gỡ hồ sơ khuôn mặt trùng.'
          : pt != null
            ? `Không nhận ra khuôn mặt (cao nhất ${pt}%, cần ${nguongPt}%). ` +
              'Bạn đã đăng ký chưa? Hoặc thử lại gần camera hơn.'
            : 'Không nhận ra khuôn mặt. Bạn đã đăng ký chưa? Hoặc thử lại gần camera hơn.' };
    }
  }

  // 4. Chong cham lien tuc: cach lan cham gan nhat it nhat N giay.
  const cachNhau = Number(ts.khuon_mat_cach_nhau_giay) || 90;
  const [gan] = await db.query(
    `SELECT id, ket_qua, thoi_diem, TIMESTAMPDIFF(SECOND, thoi_diem, NOW()) AS giay
     FROM nhat_ky_nhan_dien
     WHERE id_nv_du_doan = ? AND ket_qua = 'thanh_cong'
     ORDER BY thoi_diem DESC LIMIT 1`,
    [idNvKq]
  );
  if (gan.length && gan[0].giay != null && gan[0].giay < cachNhau) {
    return { ok: false, ket_qua: 'qua_nhanh',
      thong_bao: `Vừa chấm công ${gan[0].giay}s trước. Vui lòng đợi ${cachNhau - gan[0].giay}s.` };
  }

  // 5. Ghi cham cong (vao hoac ra tuy trang thai trong ngay).
  const idNhatKy = await ghiNhatKy({
    cheDo, idNvKyVong: idNv, idNvNhanDien: idNvKq, ketQua: 'thanh_cong',
    doTuongDong, diemSong: kq.song?.diem_song, duongDanAnh: kq.duong_dan_anh,
    soMat: kq.so_mat_phat_hien, thoiGianMs: kq.thoi_gian_xu_ly_ms,
    khoangCachM: vt.khoang_cach_m, diaChiIp,
  });

  const cham = await ghiChamCong(idNvKq, doTuongDong, kq.duong_dan_anh);

  // Toa do luu sau khi da biet danh tinh - o kiosk 1:N chi luc nay moi co id_nv.
  await ghiViTri({
    idNv: idNvKq, loai: cham.chieu, viTri, kiemTra: vt,
    idNhatKy, anh: kq.duong_dan_anh,
  });

  // 6. Thong tin nhan vien de hien thi + bao realtime.
  const [[nv]] = await db.query(
    `SELECT n.id_nv, n.ma_nv, TRIM(n.ten) AS ten, cd.ten_cd, bp.ten_bp, bp.mau_sac
     FROM nhan_vien n LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN bo_phan bp ON bp.id_bp = cd.id_bp WHERE n.id_nv = ?`,
    [idNvKq]
  );

  const rt = _rt();
  if (rt) {
    rt.phat('cham-cong:moi', {
      id_nv: idNvKq, ten: nv ? nv.ten : '', chieu: cham.chieu,
      gio: cham.gio, ten_cd: nv ? nv.ten_cd : null, ten_bp: nv ? nv.ten_bp : null,
    }, { quanLy: true });
  }

  return {
    ok: true, ket_qua: 'thanh_cong', chieu: cham.chieu,
    nhan_vien: nv || { id_nv: idNvKq },
    do_tuong_dong: doTuongDong,
    phan_tram: pt,
    nguong_phan_tram: nguongPt,
    khoang_cach_m: vt.khoang_cach_m,
    gio: cham.gio, tong_gio: cham.tong_gio,
    thong_bao: `${cham.chieu === 'vao' ? 'Chấm công VÀO' : 'Chấm công RA'} thành công` +
      (nv ? ` — ${nv.ten}` : ''),
    id_nhat_ky: idNhatKy,
  };
}

/**
 * Ghi vao bang cham_cong. Lan dau trong ngay la gio_vao, lan sau la gio_ra.
 * Tra ve { chieu: 'vao'|'ra', gio, tong_gio }.
 */
async function ghiChamCong(idNv, doTinCay, duongDanAnh) {
  const today = new Date();
  const ngay = today.toISOString().slice(0, 10);

  const [rows] = await db.query(
    'SELECT * FROM cham_cong WHERE id_nv = ? AND ngay = ? ORDER BY id_cc DESC LIMIT 1',
    [idNv, ngay]
  );

  const gioBayGio = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (!rows.length) {
    // Chua co ban ghi hom nay -> cham VAO.
    await db.query(
      `INSERT INTO cham_cong (id_nv, ngay, gio_vao, phuong_thuc_vao, do_tin_cay_vao, anh_vao)
       VALUES (?, ?, NOW(), 'khuon_mat', ?, ?)`,
      [idNv, ngay, doTinCay, duongDanAnh]
    );
    return { chieu: 'vao', gio: gioBayGio(), tong_gio: null };
  }

  const cc = rows[0];
  if (!cc.gio_ra) {
    // Da co gio vao, chua co gio ra -> cham RA.
    await db.query(
      `UPDATE cham_cong
       SET gio_ra = NOW(), phuong_thuc_ra = 'khuon_mat', do_tin_cay_ra = ?, anh_ra = ?,
           tong_gio = ROUND(TIMESTAMPDIFF(MINUTE, gio_vao, NOW())/60, 2)
       WHERE id_cc = ?`,
      [doTinCay, duongDanAnh, cc.id_cc]
    );
    const [[sau]] = await db.query('SELECT tong_gio FROM cham_cong WHERE id_cc = ?', [cc.id_cc]);
    return { chieu: 'ra', gio: gioBayGio(), tong_gio: sau ? sau.tong_gio : null };
  }

  // Da vao va ra roi -> tao ban ghi vao moi (ca lam thu hai trong ngay).
  await db.query(
    `INSERT INTO cham_cong (id_nv, ngay, gio_vao, phuong_thuc_vao, do_tin_cay_vao, anh_vao, ghi_chu)
     VALUES (?, ?, NOW(), 'khuon_mat', ?, ?, 'Ca bổ sung trong ngày')`,
    [idNv, ngay, doTinCay, duongDanAnh]
  );
  return { chieu: 'vao', gio: gioBayGio(), tong_gio: null };
}

/**
 * Dang ky mau khuon mat cho mot nhan vien.
 * Python lo phan anh; o day chi kiem tra nhan vien ton tai va chuyen tiep.
 */
async function dangKy(idNv, anh, nguoiDangKy = null, thayThe = false) {
  const [[nv]] = await db.query(
    'SELECT id_nv, TRIM(ten) AS ten FROM nhan_vien WHERE id_nv = ? AND trangthai = 1', [idNv]
  );
  if (!nv) throw new Error('Không tìm thấy nhân viên đang làm việc.');
  const kq = await mlService.khuonMatDangKy(idNv, anh, nguoiDangKy, thayThe);

  const rt = _rt();
  if (rt) rt.phat('khuon-mat:dang-ky', { id_nv: idNv, ten: nv.ten, so_mau: kq.tong_mau_hien_co },
    { quanLy: true });
  return { ...kq, ten: nv.ten };
}

/** Danh sach nhan vien kem so mau khuon mat da dang ky. */
async function danhSachDangKy() {
  const [rows] = await db.query(
    `SELECT n.id_nv, n.ma_nv, TRIM(n.ten) AS ten, cd.ten_cd, bp.ten_bp, bp.mau_sac,
            COUNT(k.id) AS so_mau, MAX(k.tao_luc) AS lan_dang_ky_cuoi
     FROM nhan_vien n
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN bo_phan bp   ON bp.id_bp = cd.id_bp
     LEFT JOIN khuon_mat_nv k ON k.id_nv = n.id_nv AND k.dang_dung = 1
     WHERE n.trangthai = 1
     GROUP BY n.id_nv, n.ma_nv, n.ten, cd.ten_cd, bp.ten_bp, bp.mau_sac
     ORDER BY (COUNT(k.id) = 0) DESC, cd.cap_bac, n.ten`
  );
  return rows;
}

/** Nhat ky nhan dien gan day (kem ten nguoi). */
async function nhatKyGanDay(gioiHan = 100) {
  const [rows] = await db.query(
    `SELECT j.*, TRIM(nd.ten) AS ten_nhan_dien, TRIM(kv.ten) AS ten_ky_vong
     FROM nhat_ky_nhan_dien j
     LEFT JOIN nhan_vien nd ON nd.id_nv = j.id_nv_du_doan
     LEFT JOIN nhan_vien kv ON kv.id_nv = j.id_nv_ky_vong
     ORDER BY j.thoi_diem DESC LIMIT ?`,
    [Number(gioiHan)]
  );
  return rows;
}

/** So lieu tong hop cho trang quan ly. */
async function tongQuan() {
  const [[dk]] = await db.query(
    `SELECT COUNT(DISTINCT k.id_nv) AS da_dang_ky,
            (SELECT COUNT(*) FROM nhan_vien WHERE trangthai = 1) AS tong_nv,
            COUNT(*) AS tong_mau
     FROM khuon_mat_nv k WHERE k.dang_dung = 1`
  );
  const [[hnay]] = await db.query(
    `SELECT
       SUM(ket_qua = 'thanh_cong') AS thanh_cong,
       SUM(ket_qua = 'khong_khop') AS khong_khop,
       SUM(ket_qua = 'gia_mao')    AS gia_mao,
       COUNT(*) AS tong
     FROM nhat_ky_nhan_dien WHERE DATE(thoi_diem) = CURDATE()`
  );
  return {
    da_dang_ky: Number(dk.da_dang_ky || 0),
    tong_nv: Number(dk.tong_nv || 0),
    tong_mau: Number(dk.tong_mau || 0),
    hom_nay: {
      thanh_cong: Number(hnay.thanh_cong || 0),
      khong_khop: Number(hnay.khong_khop || 0),
      gia_mao: Number(hnay.gia_mao || 0),
      tong: Number(hnay.tong || 0),
    },
  };
}

/** So mau khuon mat dang dung cua mot nhan vien (0 = chua dang ky). */
async function soMauCua(idNv) {
  try {
    const [[r]] = await db.query(
      'SELECT COUNT(*) n FROM khuon_mat_nv WHERE id_nv = ? AND dang_dung = 1', [idNv]
    );
    return Number(r.n || 0);
  } catch {
    return -1; // bang chua ton tai -> coi nhu khong ap dung
  }
}

/**
 * Cau hinh vi tri nha hang cho man hinh quan ly.
 *
 * `mac_dinh` bao cho giao dien biet toa do van con la gia tri xuat xuong (trung
 * tam Quan 1, TP Ho Chi Minh). Neu nha hang o cho khac ma khong ai sua, moi lan
 * cham cong deu bi chan vi ban kinh chi 30 m - nen phai canh bao ro.
 */
const TOA_DO_XUAT_XUONG = { vi_do: 10.762622, kinh_do: 106.660172 };

async function cauHinhViTri() {
  const ts = await docThamSo();
  const viDo = Number(ts.nha_hang_vi_do);
  const kinhDo = Number(ts.nha_hang_kinh_do);
  const coToaDo = Number.isFinite(viDo) && Number.isFinite(kinhDo) && !(viDo === 0 && kinhDo === 0);
  return {
    bat_gps: Number(ts.khuon_mat_bat_gps) === 1,
    vi_do: coToaDo ? viDo : null,
    kinh_do: coToaDo ? kinhDo : null,
    ban_kinh_m: Number(ts.ban_kinh_cham_cong_m) || 30,
    co_toa_do: coToaDo,
    mac_dinh: coToaDo &&
      Math.abs(viDo - TOA_DO_XUAT_XUONG.vi_do) < 1e-6 &&
      Math.abs(kinhDo - TOA_DO_XUAT_XUONG.kinh_do) < 1e-6,
  };
}

/** Luu cau hinh vi tri. Chi nhan gia tri hop le de khong lam hong rang buoc. */
async function luuCauHinhViTri({ viDo, kinhDo, banKinhM, batGps }) {
  const dat = [];

  if (viDo !== undefined && kinhDo !== undefined) {
    const a = Number(viDo), b = Number(kinhDo);
    if (!Number.isFinite(a) || a < -90 || a > 90) throw new Error('Vĩ độ phải nằm trong khoảng -90 đến 90.');
    if (!Number.isFinite(b) || b < -180 || b > 180) throw new Error('Kinh độ phải nằm trong khoảng -180 đến 180.');
    dat.push(['nha_hang_vi_do', String(a)], ['nha_hang_kinh_do', String(b)]);
  }
  if (banKinhM !== undefined) {
    const r = Number(banKinhM);
    if (!Number.isFinite(r) || r < 5 || r > 5000) {
      throw new Error('Bán kính phải từ 5 đến 5000 mét.');
    }
    dat.push(['ban_kinh_cham_cong_m', String(Math.round(r))]);
  }
  if (batGps !== undefined) dat.push(['khuon_mat_bat_gps', batGps ? '1' : '0']);

  if (!dat.length) throw new Error('Không có gì để lưu.');
  for (const [khoa, giaTri] of dat) {
    await db.query(
      'INSERT INTO cau_hinh (khoa, gia_tri) VALUES (?,?) ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)',
      [khoa, giaTri]
    );
  }
  return cauHinhViTri();
}

/**
 * Cau hinh NHAN DIEN (khac cau hinh vi tri o tren).
 *
 * DO KHO DONG TAC
 *   Ba bien do cua thu thach chong gia mao khong nen bat nguoi dung go tay tung
 *   so - "0.06" khong noi len dieu gi voi nguoi quan ly nha hang. Ba muc duoi
 *   day la ba bo so da do san; muc `kho` chinh la hang so cu trong ma nguon.
 *
 *   Ha do kho lam giam kha nang chan anh in / man hinh, nhung khong tat han:
 *   vat the PHANG van khong sinh ra duoc do lech mui-mat theo chieu sau, va hai
 *   dau hieu con lai (do net, ket cau tan so) van giu nguyen.
 */
const MUC_DONG_TAC = {
  de:   { khuon_mat_bien_do_quay: 0.04, khuon_mat_bien_do_gat: 0.035, khuon_mat_ty_le_lai_gan: 1.08 },
  vua:  { khuon_mat_bien_do_quay: 0.06, khuon_mat_bien_do_gat: 0.05,  khuon_mat_ty_le_lai_gan: 1.12 },
  kho:  { khuon_mat_bien_do_quay: 0.12, khuon_mat_bien_do_gat: 0.10,  khuon_mat_ty_le_lai_gan: 1.25 },
};

/** Doan xem ba bien do dang luu ung voi muc nao (khong khop thi coi la 'vua'). */
function _mucDongTac(ts) {
  for (const [ten, bo] of Object.entries(MUC_DONG_TAC)) {
    if (Object.entries(bo).every(([k, v]) => Math.abs(Number(ts[k]) - v) < 1e-6)) return ten;
  }
  return 'vua';
}

async function cauHinhNhanDien() {
  const ts = await docThamSo();
  return {
    nguong_phan_tram: Number(ts.khuon_mat_nguong_phan_tram) || 50,
    chan_cham_ho: Number(ts.khuon_mat_chan_cham_ho) === 1,
    bat_kiem_tra_song: Number(ts.khuon_mat_bat_kiem_tra_song) === 1,
    muc_dong_tac: _mucDongTac(ts),
  };
}

/** Luu cau hinh nhan dien. Chi nhan gia tri hop le. */
async function luuCauHinhNhanDien({ nguongPhanTram, chanChamHo, batKiemTraSong, mucDongTac }) {
  const dat = [];

  if (nguongPhanTram !== undefined) {
    const p = Number(nguongPhanTram);
    // Chan duoi 20%: duoi muc do thi hai nguoi bat ky cung "khop", nguong mat het
    // y nghia va he thong se cham cong cho nham nguoi. Chan tren 95%: gan nhu
    // khong ai qua noi, ke ca chinh chu.
    if (!Number.isFinite(p) || p < 20 || p > 95) {
      throw new Error('Ngưỡng khớp phải từ 20% đến 95%.');
    }
    dat.push(['khuon_mat_nguong_phan_tram', String(Math.round(p))]);
  }
  if (chanChamHo !== undefined) dat.push(['khuon_mat_chan_cham_ho', chanChamHo ? '1' : '0']);
  if (batKiemTraSong !== undefined) dat.push(['khuon_mat_bat_kiem_tra_song', batKiemTraSong ? '1' : '0']);
  if (mucDongTac !== undefined) {
    const bo = MUC_DONG_TAC[String(mucDongTac)];
    if (!bo) throw new Error('Mức động tác phải là de, vua hoặc kho.');
    for (const [k, v] of Object.entries(bo)) dat.push([k, String(v)]);
  }

  if (!dat.length) throw new Error('Không có gì để lưu.');
  for (const [khoa, giaTri] of dat) {
    await db.query(
      'INSERT INTO cau_hinh (khoa, gia_tri) VALUES (?,?) ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)',
      [khoa, giaTri]
    );
  }
  return cauHinhNhanDien();
}

async function xoa(idNv) {
  await mlService.khuonMatXoa(idNv);
  const rt = _rt();
  if (rt) rt.phat('khuon-mat:dang-ky', { id_nv: idNv, so_mau: 0 }, { quanLy: true });
  return { ok: true };
}

module.exports = {
  docThamSo,
  khoangCachMet,
  kiemTraViTri,
  cauHinhViTri,
  luuCauHinhViTri,
  cauHinhNhanDien,
  luuCauHinhNhanDien,
  chamCong,
  dangKy,
  danhSachDangKy,
  nhatKyGanDay,
  tongQuan,
  xoa,
  soMauCua,
  trangThaiDichVu: () => mlService.khuonMatTrangThai(),
  danhGia: () => mlService.khuonMatDanhGia(),
};

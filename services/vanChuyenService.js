/**
 * Nghiep vu giao hang: don vi van chuyen, shipper, don giao, va vet GPS.
 *
 * BON CAU HOI MODULE NAY TRA LOI
 * ------------------------------
 *   1. Giao toi dia chi nay het bao nhieu, co giao noi khong?   → tinhPhi()
 *   2. Don nay ai cam?                                          → phanShipper()
 *   3. Don dang o dau roi?                                      → ghiViTri() + banDo()
 *   4. Chuyen gi da xay ra voi don nay?                         → nhat_ky_giao_hang
 *
 * KHOANG CACH LA DUONG CHIM BAY, KHONG PHAI DUONG DI THAT
 * -------------------------------------------------------
 * `khoangCachKm()` dung cong thuc Haversine tren toa do. Duong di thuc te trong
 * pho luon dai hon - thuong 1.2 den 1.4 lan. Nen KHONG dung so nay lam cuoc phi
 * chinh xac tuyet doi; no la co so de bao gia va de chan don ngoai vung. Muon
 * chinh xac tung met thi phai goi mot dich vu chi duong (OSRM, Google Directions)
 * - them phu thuoc ngoai, them khoa API, va them mot diem hong khi mat mang.
 * Nha hang giao trong ban kinh 5km thi sai so nay nam trong khoang mot hai nghin
 * dong, khong dang de danh doi.
 *
 * MAY TINH PHI, KHONG PHAI TRINH DUYET
 * ------------------------------------
 * Trang dat hang co hien phi giao truoc khi khach bam xac nhan, nhung con so do
 * chi de XEM. Phi that duoc tinh lai o may chu luc tao don, tu chinh toa do va
 * bang gia trong CSDL. Neu tin vao so trinh duyet gui len thi ai cung sua duoc
 * phi giao ve 0 bang cong cu nha phat trien.
 *
 * TRANG THAI DON DI MOT CHIEU
 * ---------------------------
 *   cho_phan → da_phan → dang_lay → dang_giao → da_giao
 * cong hai loi ra bat ky luc nao: `that_bai` (giao khong duoc) va `huy`.
 * `CHUYEN_DUOC` la ban do duy nhat quyet dinh dieu do; moi noi doi trang thai
 * deu phai di qua `doiTrangThai()`. Khong co no thi shipper bam "da giao" cho
 * mot don chua he duoc phan, va bang nhat ky se ke mot cau chuyen vo ly.
 */
const db = require('../config/db');

// ---------------------------------------------------------------------------
// Trang thai
// ---------------------------------------------------------------------------

/** Nhan tieng Viet + mau, dung chung cho moi man hinh de khong noi hai giong. */
const TT = {
  cho_phan:  { nhan: 'Chờ phân shipper', mau: '#6c757d', icon: 'fa-hourglass-half' },
  da_phan:   { nhan: 'Đã phân shipper',  mau: '#0d6efd', icon: 'fa-user-check' },
  dang_lay:  { nhan: 'Đang lấy hàng',    mau: '#6f42c1', icon: 'fa-box-open' },
  dang_giao: { nhan: 'Đang giao',        mau: '#fd7e14', icon: 'fa-motorcycle' },
  da_giao:   { nhan: 'Đã giao',          mau: '#198754', icon: 'fa-circle-check' },
  that_bai:  { nhan: 'Giao thất bại',    mau: '#dc3545', icon: 'fa-triangle-exclamation' },
  huy:       { nhan: 'Đã hủy',           mau: '#adb5bd', icon: 'fa-ban' },
};

/**
 * Tu trang thai nay duoc di sang nhung trang thai nao.
 *
 * `that_bai` van quay lai `da_phan` duoc: khach khong nghe may lan dau, dieu
 * phoi goi duoc thi cho giao lai chu khong bat tao don moi - tao don moi la mat
 * lich su va mat lien ket voi don goc.
 */
const CHUYEN_DUOC = {
  cho_phan:  ['da_phan', 'huy'],
  da_phan:   ['dang_lay', 'cho_phan', 'huy'],
  dang_lay:  ['dang_giao', 'da_phan', 'huy'],
  dang_giao: ['da_giao', 'that_bai'],
  da_giao:   [],
  that_bai:  ['da_phan', 'huy'],
  huy:       [],
};

/** Don da xong han - khong con hien tren man hinh dieu phoi va ban do. */
const DA_XONG = ['da_giao', 'huy'];

/** Don dang tren duong - shipper phai bat dinh vi. */
const DANG_CHAY = ['dang_lay', 'dang_giao'];

// ---------------------------------------------------------------------------
// Toa do va cuoc phi
// ---------------------------------------------------------------------------

/**
 * Doi mot gia tri tho thanh so, hoac null neu no khong PHAI la mot so.
 *
 * `Number()` mot minh khong du: `Number(null)`, `Number('')` va
 * `Number([])` deu ra 0 - mot so hop le hoan toan. Voi toa do thi 0 khong phai
 * la "khong co gia tri", no la mot diem that ngoai bien Guinea. Moi cho trong
 * tep nay nhan toa do tu form hay tu JSON deu phai di qua day, neu khong mot o
 * de trong se bien thanh mot dia chi giao hang giua Dai Tay Duong.
 */
function so(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Khoang cach duong chim bay giua hai toa do, tinh bang km (Haversine).
 *
 * Tra ve null neu thieu toa do - de nguoi goi phan biet duoc "0 km" (cung mot
 * cho) voi "khong biet o dau". Tinh nham hai truong hop nay thanh mot se cho
 * don khong co toa do mot muc phi giao bang 0.
 */
function khoangCachKm(viDo1, kinhDo1, viDo2, kinhDo2) {
  /*
   * Loai null/undefined/chuoi rong TRUOC khi goi Number().
   *
   * `Number(null)` la 0 va `Number('')` cung la 0 - ca hai deu lot qua
   * `Number.isFinite`. Chi kiem tra bang isFinite thi mot don thieu toa do se
   * duoc coi la nam o toa do (0, 0) giua Vinh Guinea, va ham tra ve mot khoang
   * cach hon 1.197 km trong ve rat that. Don do se bi tu choi voi ly do "vuot
   * ban kinh" thay vi "chua co toa do" - hai chuyen phai sua khac han nhau.
   */
  const a = [viDo1, kinhDo1, viDo2, kinhDo2].map(so);
  if (a.some((n) => n === null)) return null;

  const R = 6371; // ban kinh Trai Dat, km
  const rad = (d) => (d * Math.PI) / 180;
  const dPhi = rad(a[2] - a[0]);
  const dLam = rad(a[3] - a[1]);
  const s =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(a[2])) * Math.sin(dLam / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 100) / 100;
}

/** Doc mot loat khoa cau hinh, tra ve object. Khoa thieu = undefined. */
async function docCauHinh(khoa) {
  const ds = Array.isArray(khoa) ? khoa : [khoa];
  if (!ds.length) return {};
  const [rows] = await db.query(
    `SELECT khoa, gia_tri FROM cau_hinh WHERE khoa IN (${ds.map(() => '?').join(',')})`,
    ds
  );
  const kq = {};
  rows.forEach((r) => { kq[r.khoa] = r.gia_tri; });
  return kq;
}

/**
 * Toa do nha hang - dung chung voi cham cong GPS.
 *
 * Co y doc lai tu `cau_hinh` thay vi goi `faceService.cauHinhViTri()`: phan he
 * giao hang khong nen phu thuoc vao phan he nhan dien khuon mat (keo theo ca
 * dich vu Python). Hai noi cung doc mot cap khoa nen khong bao gio lech nhau.
 */
async function toaDoNhaHang() {
  const c = await docCauHinh(['nha_hang_vi_do', 'nha_hang_kinh_do']);
  const viDo = Number(c.nha_hang_vi_do);
  const kinhDo = Number(c.nha_hang_kinh_do);
  if (!Number.isFinite(viDo) || !Number.isFinite(kinhDo) || (viDo === 0 && kinhDo === 0)) {
    return null;
  }
  return { vi_do: viDo, kinh_do: kinhDo };
}

/** Tham so van hanh cua phan he, da ep kieu san. */
async function thamSo() {
  const c = await docCauHinh([
    'giao_hang.bat', 'giao_hang.ban_kinh_km', 'giao_hang.mien_phi_tu',
    'giao_hang.nhip_gps_giay', 'giao_hang.giu_vet_ngay', 'giao_hang.tu_dong_tao_don',
  ]);
  return {
    bat: c['giao_hang.bat'] !== '0',
    ban_kinh_km: Number(c['giao_hang.ban_kinh_km']) || 5,
    mien_phi_tu: Number(c['giao_hang.mien_phi_tu']) || 0,
    nhip_gps_giay: Math.max(5, Number(c['giao_hang.nhip_gps_giay']) || 15),
    giu_vet_ngay: Math.max(1, Number(c['giao_hang.giu_vet_ngay']) || 7),
    tu_dong_tao_don: c['giao_hang.tu_dong_tao_don'] !== '0',
  };
}

/**
 * Bao gia cho mot dia chi.
 *
 * Tra ve MOT object mo ta day du tinh huong, khong nem loi khi ngoai vung: trang
 * dat hang can hien "cách 7.2 km, ngoài bán kính 5 km" chu khong phai mot thong
 * bao loi trong rong. Nguoi goi tu quyet dinh chan hay khong dua vao `giao_duoc`.
 *
 * @param {number} viDo, kinhDo  toa do noi nhan
 * @param {number} tienHang      tong tien mon, de xet mien phi giao
 * @param {number} [idDv]        chon san mot don vi; khong truyen thi tu chon
 */
async function tinhPhi(viDo, kinhDo, tienHang = 0, idDv = null) {
  const [goc, ts] = await Promise.all([toaDoNhaHang(), thamSo()]);

  if (!goc) {
    return {
      giao_duoc: false, ly_do: 'Nhà hàng chưa khai tọa độ. Vào Chấm công → Cấu hình vị trí để đặt.',
      khoang_cach_km: null, phi: 0, id_dv: null, don_vi: null, mien_phi: false,
    };
  }
  const km = khoangCachKm(goc.vi_do, goc.kinh_do, viDo, kinhDo);
  if (km === null) {
    return {
      giao_duoc: false, ly_do: 'Chưa xác định được vị trí giao hàng.',
      khoang_cach_km: null, phi: 0, id_dv: null, don_vi: null, mien_phi: false,
    };
  }

  // Chon don vi: uu tien don vi duoc chi dinh; khong thi lay don vi RE NHAT
  // trong so nhung don vi con voi toi dia chi nay. Sap theo thu_tu de khi hai
  // don vi bang gia thi doi nha (thu_tu = 1) duoc uu tien - ho theo doi GPS duoc.
  const [dsDv] = await db.query(
    `SELECT * FROM don_vi_van_chuyen
     WHERE trang_thai = 1 ${idDv ? 'AND id_dv = ?' : ''}
     ORDER BY thu_tu, id_dv`,
    idDv ? [idDv] : []
  );
  const trongTam = dsDv.filter((d) => km <= Number(d.ban_kinh_km));

  if (!trongTam.length) {
    const xa = dsDv.length ? Math.max(...dsDv.map((d) => Number(d.ban_kinh_km))) : ts.ban_kinh_km;
    return {
      giao_duoc: false,
      ly_do: `Địa chỉ cách nhà hàng ${km} km, vượt bán kính giao hàng ${xa} km.`,
      khoang_cach_km: km, phi: 0, id_dv: null, don_vi: null, mien_phi: false,
    };
  }

  const tinhCho = (dv) => {
    const kmVuot = Math.max(0, km - Number(dv.so_km_dau));
    // Lam tron len tung 0.5 km: nhay tung km lam phi vot len 5000d chi vi lech
    // 50m, con tinh tung met thi con so le loi nhu 17.340d.
    const buoc = Math.ceil(kmVuot * 2) / 2;
    return Math.round(Number(dv.phi_co_ban) + buoc * Number(dv.phi_moi_km));
  };

  const chon = trongTam
    .map((dv) => ({ dv, phi: tinhCho(dv) }))
    .sort((a, b) => a.phi - b.phi || a.dv.thu_tu - b.dv.thu_tu)[0];

  const mienPhi = ts.mien_phi_tu > 0 && Number(tienHang) >= ts.mien_phi_tu;

  return {
    giao_duoc: true,
    ly_do: null,
    khoang_cach_km: km,
    phi: mienPhi ? 0 : chon.phi,
    phi_goc: chon.phi,
    mien_phi: mienPhi,
    mien_phi_tu: ts.mien_phi_tu,
    id_dv: chon.dv.id_dv,
    don_vi: {
      id_dv: chon.dv.id_dv, ten_dv: chon.dv.ten_dv, loai: chon.dv.loai,
      thoi_gian_cam_ket_phut: chon.dv.thoi_gian_cam_ket_phut,
    },
  };
}

// ---------------------------------------------------------------------------
// Don vi van chuyen
// ---------------------------------------------------------------------------

const dsDonVi = async ({ chiHoatDong = false } = {}) => {
  const [rows] = await db.query(
    `SELECT dv.*,
            (SELECT COUNT(*) FROM shipper s WHERE s.id_dv = dv.id_dv) AS so_shipper,
            (SELECT COUNT(*) FROM don_giao_hang g
              WHERE g.id_dv = dv.id_dv AND g.trang_thai NOT IN ('da_giao','huy')) AS don_dang_chay
     FROM don_vi_van_chuyen dv
     ${chiHoatDong ? 'WHERE dv.trang_thai = 1' : ''}
     ORDER BY dv.thu_tu, dv.id_dv`
  );
  return rows;
};

const donVi = async (idDv) => {
  const [[r]] = await db.query('SELECT * FROM don_vi_van_chuyen WHERE id_dv = ?', [idDv]);
  return r || null;
};

/**
 * Chuan hoa va kiem tra du lieu mot don vi truoc khi ghi.
 *
 * Kiem tra o day chu khong o route: ca them lan sua deu goi, va man hinh quan
 * tri lan API deu di qua mot bo luat. Bang gia am hay ban kinh 0 khong phai loi
 * go nham vo hai - no lam moi don sau do bao gia sai.
 */
function chuanHoaDonVi(d) {
  // Rieng cho form: nguoi dung go '15.000' hay '15 000' deu phai hieu duoc,
  // nen bo moi ky tu khong phai chu so truoc khi doi. Khac `so()` o tren -
  // ham do co y NGHIEM NGAT vi no xu ly toa do, noi mot ky tu thua la sai vi tri.
  const soTien = (v, mac = 0) => {
    const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : mac;
  };
  const ma = String(d.ma_dv || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const ten = String(d.ten_dv || '').trim();

  if (!ma) throw new Error('Mã đơn vị không được để trống (chỉ chữ hoa, số và dấu gạch dưới).');
  if (ma.length > 20) throw new Error('Mã đơn vị tối đa 20 ký tự.');
  if (!ten) throw new Error('Tên đơn vị không được để trống.');

  const phiCoBan = soTien(d.phi_co_ban, 15000);
  const phiMoiKm = soTien(d.phi_moi_km, 5000);
  const soKmDau = soTien(d.so_km_dau, 2);
  const banKinh = soTien(d.ban_kinh_km, 5);
  const camKet = soTien(d.thoi_gian_cam_ket_phut, 45);

  if (phiCoBan < 0 || phiMoiKm < 0) throw new Error('Phí giao hàng không được âm.');
  if (soKmDau < 0 || soKmDau > 50) throw new Error('Số km đầu phải từ 0 đến 50.');
  if (banKinh <= 0 || banKinh > 100) throw new Error('Bán kính phục vụ phải từ 0.1 đến 100 km.');
  if (camKet <= 0 || camKet > 600) throw new Error('Thời gian cam kết phải từ 1 đến 600 phút.');

  return {
    ma_dv: ma,
    ten_dv: ten,
    loai: d.loai === 'doi_tac' ? 'doi_tac' : 'noi_bo',
    sdt: String(d.sdt || '').trim() || null,
    email: String(d.email || '').trim() || null,
    dia_chi: String(d.dia_chi || '').trim() || null,
    phi_co_ban: phiCoBan,
    so_km_dau: soKmDau,
    phi_moi_km: phiMoiKm,
    ban_kinh_km: banKinh,
    thoi_gian_cam_ket_phut: Math.round(camKet),
    mau_sac: /^#[0-9a-fA-F]{6}$/.test(String(d.mau_sac || '')) ? d.mau_sac : '#0d6efd',
    ghi_chu: String(d.ghi_chu || '').trim() || null,
    thu_tu: Math.round(soTien(d.thu_tu, 0)),
    trang_thai: Number(d.trang_thai) === 0 ? 0 : 1,
  };
}

const themDonVi = async (duLieu) => {
  const d = chuanHoaDonVi(duLieu);
  const [kq] = await db.query(
    `INSERT INTO don_vi_van_chuyen
       (ma_dv, ten_dv, loai, sdt, email, dia_chi, phi_co_ban, so_km_dau, phi_moi_km,
        ban_kinh_km, thoi_gian_cam_ket_phut, mau_sac, ghi_chu, thu_tu, trang_thai)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [d.ma_dv, d.ten_dv, d.loai, d.sdt, d.email, d.dia_chi, d.phi_co_ban, d.so_km_dau,
     d.phi_moi_km, d.ban_kinh_km, d.thoi_gian_cam_ket_phut, d.mau_sac, d.ghi_chu,
     d.thu_tu, d.trang_thai]
  ).catch((e) => {
    if (e.code === 'ER_DUP_ENTRY') throw new Error(`Mã đơn vị "${d.ma_dv}" đã tồn tại.`);
    throw e;
  });
  return kq.insertId;
};

const suaDonVi = async (idDv, duLieu) => {
  const d = chuanHoaDonVi(duLieu);
  await db.query(
    `UPDATE don_vi_van_chuyen SET
       ma_dv=?, ten_dv=?, loai=?, sdt=?, email=?, dia_chi=?, phi_co_ban=?, so_km_dau=?,
       phi_moi_km=?, ban_kinh_km=?, thoi_gian_cam_ket_phut=?, mau_sac=?, ghi_chu=?,
       thu_tu=?, trang_thai=?
     WHERE id_dv = ?`,
    [d.ma_dv, d.ten_dv, d.loai, d.sdt, d.email, d.dia_chi, d.phi_co_ban, d.so_km_dau,
     d.phi_moi_km, d.ban_kinh_km, d.thoi_gian_cam_ket_phut, d.mau_sac, d.ghi_chu,
     d.thu_tu, d.trang_thai, idDv]
  ).catch((e) => {
    if (e.code === 'ER_DUP_ENTRY') throw new Error(`Mã đơn vị "${d.ma_dv}" đã tồn tại.`);
    throw e;
  });
};

/**
 * Xoa don vi. Chi xoa duoc khi chua tung dung.
 *
 * Don vi da co don giao hang thi NGUNG chu khong xoa: xoa di thi cac don cu mat
 * ten don vi da giao chung, va bao cao chi phi van chuyen thang truoc rong.
 */
const xoaDonVi = async (idDv) => {
  const [[d]] = await db.query('SELECT COUNT(*) AS n FROM don_giao_hang WHERE id_dv = ?', [idDv]);
  if (Number(d.n) > 0) {
    throw new Error(`Đơn vị này đã có ${d.n} đơn giao — hãy chuyển sang "Ngừng hoạt động" thay vì xóa để giữ lịch sử.`);
  }
  const [[s]] = await db.query('SELECT COUNT(*) AS n FROM shipper WHERE id_dv = ?', [idDv]);
  if (Number(s.n) > 0) {
    throw new Error(`Đơn vị này còn ${s.n} shipper — chuyển họ sang đơn vị khác trước khi xóa.`);
  }
  await db.query('DELETE FROM don_vi_van_chuyen WHERE id_dv = ?', [idDv]);
};

// ---------------------------------------------------------------------------
// Shipper
// ---------------------------------------------------------------------------

/**
 * Danh sach shipper kem vi tri moi nhat va so don dang cam.
 *
 * `phut_truoc` la tuoi cua tin hieu GPS. Man hinh dieu phoi dung no de phan biet
 * "dang chay" voi "dien thoai tat may tu nua tieng truoc" - hai truong hop nhin
 * tren ban do giong het nhau neu chi ve cham cuoi cung.
 */
const dsShipper = async ({ idDv = null, chiRanh = false } = {}) => {
  const dieuKien = [];
  const bien = [];
  if (idDv) { dieuKien.push('s.id_dv = ?'); bien.push(idDv); }
  if (chiRanh) dieuKien.push("s.trang_thai <> 'nghi'");

  const [rows] = await db.query(
    `SELECT s.*, dv.ten_dv, dv.ma_dv, dv.loai AS loai_dv, dv.mau_sac,
            nv.ten AS ten_nv, nv.ma_nv, nv.sodienthoai AS sdt_nv,
            v.vi_do, v.kinh_do, v.luc AS vi_tri_luc, v.pin, v.toc_do_kmh, v.huong,
            TIMESTAMPDIFF(MINUTE, v.luc, NOW()) AS phut_truoc,
            (SELECT COUNT(*) FROM don_giao_hang g
              WHERE g.id_shipper = s.id_shipper
                AND g.trang_thai IN ('da_phan','dang_lay','dang_giao')) AS don_dang_cam
     FROM shipper s
     JOIN don_vi_van_chuyen dv ON dv.id_dv = s.id_dv
     LEFT JOIN nhan_vien nv ON nv.id_nv = s.id_nv
     LEFT JOIN vi_tri_shipper_moi_nhat v ON v.id_shipper = s.id_shipper
     ${dieuKien.length ? 'WHERE ' + dieuKien.join(' AND ') : ''}
     ORDER BY dv.thu_tu, s.trang_thai, s.ten`,
    bien
  );
  return rows.map((r) => ({
    ...r,
    // Ten trong bang `shipper` la ban chup luc tao. Nguoi doi ten trong ho so
    // nhan su thi lay ten moi - mot nguoi khong nen co hai ten tren hai man hinh.
    ten: String(r.ten_nv || r.ten || '').trim(),
    sdt: r.sdt || r.sdt_nv || null,
    con_nhan_don: r.trang_thai === 'san_sang' && Number(r.don_dang_cam) < Number(r.so_don_toi_da),
  }));
};

const shipper = async (idShipper) => {
  const ds = await dsShipper();
  return ds.find((s) => Number(s.id_shipper) === Number(idShipper)) || null;
};

/** Ho so shipper cua mot nhan vien - de ung dung /shipper biet minh la ai. */
const shipperCuaNhanVien = async (idNv) => {
  const [[r]] = await db.query(
    `SELECT s.*, dv.ten_dv, dv.ma_dv, dv.mau_sac
     FROM shipper s JOIN don_vi_van_chuyen dv ON dv.id_dv = s.id_dv
     WHERE s.id_nv = ?`, [idNv]
  );
  return r || null;
};

const themShipper = async (d) => {
  const idDv = Number(d.id_dv);
  if (!idDv) throw new Error('Phải chọn đơn vị vận chuyển.');
  const idNv = Number(d.id_nv) || null;
  let ten = String(d.ten || '').trim();

  if (idNv) {
    const [[nv]] = await db.query('SELECT ten FROM nhan_vien WHERE id_nv = ?', [idNv]);
    if (!nv) throw new Error('Không tìm thấy nhân viên này.');
    if (!ten) ten = String(nv.ten || '').trim();
  }
  if (!ten) throw new Error('Phải nhập tên shipper (hoặc chọn một nhân viên).');

  const [kq] = await db.query(
    `INSERT INTO shipper (id_dv, id_nv, ten, sdt, loai_xe, bien_so, so_don_toi_da, trang_thai, ghi_chu)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [idDv, idNv, ten, String(d.sdt || '').trim() || null,
     ['xe_may', 'xe_dap', 'xe_dien', 'o_to'].includes(d.loai_xe) ? d.loai_xe : 'xe_may',
     String(d.bien_so || '').trim().toUpperCase() || null,
     Math.min(20, Math.max(1, Number(d.so_don_toi_da) || 3)),
     ['san_sang', 'dang_giao', 'nghi'].includes(d.trang_thai) ? d.trang_thai : 'nghi',
     String(d.ghi_chu || '').trim() || null]
  ).catch((e) => {
    if (e.code === 'ER_DUP_ENTRY') throw new Error('Nhân viên này đã là shipper rồi.');
    throw e;
  });
  return kq.insertId;
};

const suaShipper = async (idShipper, d) => {
  const idNv = Number(d.id_nv) || null;
  await db.query(
    `UPDATE shipper SET id_dv=?, id_nv=?, ten=?, sdt=?, loai_xe=?, bien_so=?,
            so_don_toi_da=?, trang_thai=?, ghi_chu=? WHERE id_shipper=?`,
    [Number(d.id_dv), idNv, String(d.ten || '').trim(), String(d.sdt || '').trim() || null,
     ['xe_may', 'xe_dap', 'xe_dien', 'o_to'].includes(d.loai_xe) ? d.loai_xe : 'xe_may',
     String(d.bien_so || '').trim().toUpperCase() || null,
     Math.min(20, Math.max(1, Number(d.so_don_toi_da) || 3)),
     ['san_sang', 'dang_giao', 'nghi'].includes(d.trang_thai) ? d.trang_thai : 'nghi',
     String(d.ghi_chu || '').trim() || null, idShipper]
  ).catch((e) => {
    if (e.code === 'ER_DUP_ENTRY') throw new Error('Nhân viên này đã là shipper rồi.');
    throw e;
  });
};

/** Shipper tu bat / tat ca truc trong ung dung. Khong duoc tat khi con don. */
const doiCaShipper = async (idShipper, trangThai) => {
  if (!['san_sang', 'nghi'].includes(trangThai)) throw new Error('Trạng thái ca không hợp lệ.');
  if (trangThai === 'nghi') {
    const [[d]] = await db.query(
      `SELECT COUNT(*) AS n FROM don_giao_hang
       WHERE id_shipper = ? AND trang_thai IN ('da_phan','dang_lay','dang_giao')`, [idShipper]
    );
    if (Number(d.n) > 0) {
      throw new Error(`Bạn còn ${d.n} đơn chưa xong — giao xong hoặc báo điều phối chuyển đơn trước khi tan ca.`);
    }
  }
  await db.query('UPDATE shipper SET trang_thai = ? WHERE id_shipper = ?', [trangThai, idShipper]);
};

const xoaShipper = async (idShipper) => {
  const [[d]] = await db.query(
    `SELECT COUNT(*) AS n FROM don_giao_hang
     WHERE id_shipper = ? AND trang_thai NOT IN ('da_giao','huy')`, [idShipper]
  );
  if (Number(d.n) > 0) throw new Error(`Shipper này còn ${d.n} đơn đang chạy — chuyển đơn cho người khác trước.`);
  // Don da giao xong van giu id_shipper nho FK ON DELETE SET NULL, nhung ten
  // nguoi giao da duoc chep vao `nhat_ky_giao_hang` nen lich su khong mat.
  await db.query('DELETE FROM shipper WHERE id_shipper = ?', [idShipper]);
};

/**
 * Nhan vien nao co the tro thanh shipper.
 *
 * Loc san nguoi da la shipper. KHONG loc theo chuc danh: khi moi cai dat, chua
 * ai duoc bo nhiem SHIPPER ca, loc theo chuc danh se cho ra danh sach rong va
 * nguoi dung khong hieu vi sao khong them duoc ai.
 */
const nhanVienChuaLaShipper = async () => {
  const [rows] = await db.query(
    `SELECT n.id_nv, n.ma_nv, n.ten, n.sodienthoai, cd.ten_cd, bp.ten_bp
     FROM nhan_vien n
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN bo_phan bp ON bp.id_bp = cd.id_bp
     WHERE n.trangthai = 1 AND n.trang_thai_lam_viec = 'dang_lam'
       AND n.id_nv NOT IN (SELECT id_nv FROM shipper WHERE id_nv IS NOT NULL)
     ORDER BY (cd.ma_cd = 'SHIPPER') DESC, n.ten`
  );
  return rows.map((r) => ({ ...r, ten: String(r.ten || '').trim() }));
};

// ---------------------------------------------------------------------------
// Don giao hang
// ---------------------------------------------------------------------------

/**
 * Ma tra cuu ngan cho khach: GH + ngay + so thu tu trong ngay.
 *
 * Khach doc `sesis` ('k3n8fh2p9qa1x') qua dien thoai la khong the. `GH0818-007`
 * doc duoc, va nhin la biet don cua ngay nao.
 *
 * `boQua` de nhay so khi ma vua sinh bi trung. Dem-roi-cong-mot khong phai la
 * phep sinh khoa an toan: hai khach bam dat trong cung mot nhip se cung dem ra
 * 6 va cung doi ma GH0818-007. Khoa UNIQUE o CSDL bat duoc va nguoi goi thu
 * lai voi `boQua` lon hon - xem vong lap trong `taoDonGiao`.
 */
async function sinhMaGiao(conn, boQua = 0) {
  const nay = new Date();
  const tien = `GH${String(nay.getMonth() + 1).padStart(2, '0')}${String(nay.getDate()).padStart(2, '0')}`;
  const [[r]] = await conn.query(
    'SELECT COUNT(*) AS n FROM don_giao_hang WHERE ma_giao LIKE ?', [tien + '%']
  );
  return `${tien}-${String(Number(r.n) + 1 + boQua).padStart(3, '0')}`;
}

/**
 * Tao don giao hang cho mot don da co trong `hopdong`.
 *
 * Phi giao TINH LAI o day tu toa do, khong nhan tu tham so - xem ghi chu dau
 * tep. `tienHang` doc thang tu CSDL vi cung ly do.
 *
 * Idempotent: goi hai lan cho cung mot `sesis` tra ve don da co thay vi tao
 * trung. Khach bam nut hai lan hoac tai lai trang xac nhan la chuyen thuong.
 */
const taoDonGiao = async (sesis, d = {}) => {
  const [[daCo]] = await db.query('SELECT * FROM don_giao_hang WHERE sesis = ?', [sesis]);
  if (daCo) return daCo;

  const [dong] = await db.query(
    `SELECT h.id_user, SUM(h.thanhtien) AS tien_hang, k.ten, k.sodienthoai, k.diachi
     FROM hopdong h LEFT JOIN khach_hang k ON k.id = h.id_user
     WHERE h.sesis = ? GROUP BY h.id_user, k.ten, k.sodienthoai, k.diachi`,
    [sesis]
  );
  if (!dong.length) throw new Error('Không tìm thấy đơn hàng này.');
  const don = dong[0];

  const viDo = so(d.vi_do);
  const kinhDo = so(d.kinh_do);
  const coToaDo = viDo !== null && kinhDo !== null;
  const tienHang = Number(don.tien_hang) || 0;

  const bao = coToaDo
    ? await tinhPhi(viDo, kinhDo, tienHang, d.id_dv || null)
    : { giao_duoc: true, khoang_cach_km: null, phi: 0, id_dv: d.id_dv || null, don_vi: null };

  // Ngoai vung ma dieu phoi VAN muon tao (goi dien thoa thuan rieng) thi cho
  // qua, chi khi khach tu dat tren website moi chan. `batBuocTrongVung` do
  // nguoi goi quyet dinh.
  if (d.batBuocTrongVung && !bao.giao_duoc) throw new Error(bao.ly_do);

  const camKet = bao.don_vi ? Number(bao.don_vi.thoi_gian_cam_ket_phut) : 45;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    /*
      Thu toi ba lan de vuot qua va cham ma_giao.

      Chi bat ER_DUP_ENTRY tren `uq_gh_ma`, khong bat chung: trung `uq_gh_sesis`
      nghia la don giao cho don hang nay da ton tai - thu lai bao nhieu lan cung
      the, va cau tra loi dung la tra ve don da co (xu ly o khoi catch ben duoi).
    */
    let maGiao = null;
    let kq = null;
    for (let lan = 0; lan < 3; lan++) {
      maGiao = await sinhMaGiao(conn, lan);
      try {
        kq = await conn.query(
          `INSERT INTO don_giao_hang
             (sesis, ma_giao, id_dv, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_giao,
              vi_do, kinh_do, khoang_cach_km, phi_giao, tien_thu_ho, ghi_chu,
              du_kien_luc, trang_thai)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'cho_phan')`,
          [sesis, maGiao, bao.id_dv,
           String(d.ten_nguoi_nhan || don.ten || '').trim() || 'Khách hàng',
           String(d.sdt_nguoi_nhan || don.sodienthoai || '').trim(),
           String(d.dia_chi_giao || don.diachi || '').trim(),
           coToaDo ? viDo : null, coToaDo ? kinhDo : null,
           bao.khoang_cach_km, bao.phi,
           Number(d.tien_thu_ho) || 0,
           String(d.ghi_chu || '').trim() || null,
           camKet]
        );
        break;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY' && String(e.message).includes('uq_gh_ma')) continue;
        throw e;
      }
    }
    if (!kq) throw new Error('Không sinh được mã đơn giao — thử lại sau vài giây.');
    kq = kq[0];

    // Danh dau don la don giao hang de moi man hinh cu (dat ban, bep, thu ngan)
    // phan biet duoc voi khach an tai cho.
    await conn.query("UPDATE hopdong SET loai_don = 'giao_hang' WHERE sesis = ?", [sesis]);

    await conn.query(
      `INSERT INTO nhat_ky_giao_hang (id_giao, tu_trang_thai, den_trang_thai, id_nv, ten_nguoi, ghi_chu)
       VALUES (?, NULL, 'cho_phan', ?, ?, ?)`,
      [kq.insertId, d.id_nv || null, d.ten_nguoi || 'Hệ thống',
       bao.khoang_cach_km !== null ? `Tạo đơn, cách nhà hàng ${bao.khoang_cach_km} km` : 'Tạo đơn (chưa có tọa độ)']
    );

    await conn.commit();
    const [[moi]] = await db.query('SELECT * FROM don_giao_hang WHERE id_giao = ?', [kq.insertId]);
    return moi;
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      const [[co]] = await db.query('SELECT * FROM don_giao_hang WHERE sesis = ?', [sesis]);
      if (co) return co;
    }
    throw e;
  } finally {
    conn.release();
  }
};

/** Cau SELECT dung chung cho moi man hinh xem don - mot noi de sua. */
const CHON_DON = `
  SELECT g.*,
         dv.ten_dv, dv.ma_dv, dv.loai AS loai_dv, dv.mau_sac,
         s.ten AS ten_shipper_luu, s.sdt AS sdt_shipper, s.bien_so, s.loai_xe, s.id_nv AS id_nv_shipper,
         nv.ten AS ten_nv_shipper,
         k.ten AS ten_khach, k.sodienthoai AS sdt_khach,
         (SELECT SUM(h.thanhtien) FROM hopdong h WHERE h.sesis = g.sesis) AS tien_hang,
         (SELECT COUNT(*) FROM hopdong h WHERE h.sesis = g.sesis) AS so_mon,
         (SELECT MIN(h.tinhtrang) FROM hopdong h WHERE h.sesis = g.sesis) AS tinhtrang_don,
         (SELECT MIN(h.trangthai_bep) FROM hopdong h WHERE h.sesis = g.sesis) AS bep_xong,
         v.vi_do AS shipper_vi_do, v.kinh_do AS shipper_kinh_do, v.luc AS shipper_luc,
         TIMESTAMPDIFF(MINUTE, v.luc, NOW()) AS shipper_phut_truoc
  FROM don_giao_hang g
  LEFT JOIN don_vi_van_chuyen dv ON dv.id_dv = g.id_dv
  LEFT JOIN shipper s  ON s.id_shipper = g.id_shipper
  LEFT JOIN nhan_vien nv ON nv.id_nv = s.id_nv
  LEFT JOIN hopdong h1 ON h1.id = (SELECT MIN(id) FROM hopdong WHERE sesis = g.sesis)
  LEFT JOIN khach_hang k ON k.id = h1.id_user
  LEFT JOIN vi_tri_shipper_moi_nhat v ON v.id_shipper = g.id_shipper
`;

/** Bo sung cac truong tinh toan ma view nao cung can. */
function tomTat(r) {
  if (!r) return null;
  return {
    ...r,
    ten_shipper: String(r.ten_nv_shipper || r.ten_shipper_luu || '').trim() || null,
    tt: TT[r.trang_thai] || { nhan: r.trang_thai, mau: '#6c757d', icon: 'fa-question' },
    dang_chay: DANG_CHAY.includes(r.trang_thai),
    da_xong: DA_XONG.includes(r.trang_thai),
    // Bep da lam xong het chua - dieu phoi khong nen phan shipper di lay hang
    // khi bep con dang nau; xe cho truoc cua bep 20 phut la lang phi mot chuyen.
    bep_da_xong: Number(r.bep_xong) === 1,
    tong_thu: Number(r.tien_hang || 0) + Number(r.phi_giao || 0),
    chuyen_duoc: CHUYEN_DUOC[r.trang_thai] || [],
  };
}

const donGiao = async (idGiao) => {
  const [[r]] = await db.query(`${CHON_DON} WHERE g.id_giao = ?`, [idGiao]);
  return tomTat(r);
};

const donGiaoTheoSesis = async (sesis) => {
  const [[r]] = await db.query(`${CHON_DON} WHERE g.sesis = ?`, [sesis]);
  return tomTat(r);
};

const donGiaoTheoMa = async (maGiao) => {
  const [[r]] = await db.query(`${CHON_DON} WHERE g.ma_giao = ?`, [maGiao]);
  return tomTat(r);
};

/**
 * Danh sach don cho man hinh dieu phoi.
 *
 * Mac dinh chi lay don DANG CHAY: man hinh dieu phoi la noi lam viec, khong
 * phai kho lich su. Don da giao hom qua nam lan vao giua se che mat don dang
 * cho o dau danh sach.
 */
const dsDonGiao = async ({ trangThai = null, idShipper = null, idDv = null,
                           ngay = null, dangChay = true, gioiHan = 200 } = {}) => {
  const dk = [];
  const bien = [];
  if (trangThai) {
    const ds = Array.isArray(trangThai) ? trangThai : [trangThai];
    dk.push(`g.trang_thai IN (${ds.map(() => '?').join(',')})`);
    bien.push(...ds);
  } else if (dangChay) {
    dk.push("g.trang_thai NOT IN ('da_giao','huy')");
  }
  if (idShipper) { dk.push('g.id_shipper = ?'); bien.push(idShipper); }
  if (idDv) { dk.push('g.id_dv = ?'); bien.push(idDv); }
  if (ngay) { dk.push('DATE(g.tao_luc) = ?'); bien.push(ngay); }

  const [rows] = await db.query(
    `${CHON_DON} ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
     ORDER BY FIELD(g.trang_thai,'cho_phan','dang_giao','dang_lay','da_phan','that_bai','da_giao','huy'),
              g.tao_luc DESC
     LIMIT ?`,
    [...bien, Math.min(500, Number(gioiHan) || 200)]
  );
  return rows.map(tomTat);
};

/** Cac mon trong don - shipper can biet minh dang cam gi. */
const monCuaDon = async (sesis) => {
  const [rows] = await db.query(
    `SELECT id, name_mon, soluong, gia, thanhtien, ghi_chu_mon, images
     FROM hopdong WHERE sesis = ? ORDER BY id`, [sesis]
  );
  return rows;
};

const nhatKy = async (idGiao) => {
  const [rows] = await db.query(
    `SELECT n.*, nv.ten AS ten_nv
     FROM nhat_ky_giao_hang n LEFT JOIN nhan_vien nv ON nv.id_nv = n.id_nv
     WHERE n.id_giao = ? ORDER BY n.luc, n.id`, [idGiao]
  );
  return rows.map((r) => ({
    ...r,
    ten_nguoi: String(r.ten_nv || r.ten_nguoi || 'Hệ thống').trim(),
    tt: TT[r.den_trang_thai] || { nhan: r.den_trang_thai, mau: '#6c757d', icon: 'fa-circle' },
  }));
};

// ---------------------------------------------------------------------------
// Phan cong va doi trang thai
// ---------------------------------------------------------------------------

/**
 * Giao don cho mot shipper.
 *
 * Kiem tra suc chua truoc khi ghi: mot nguoi cam 8 don cung luc thi don thu 8
 * chac chan nguoi, va khach cua don do khong hieu vi sao doi mai. `so_don_toi_da`
 * la cai phanh do.
 */
const phanShipper = async (idGiao, idShipper, nguoi = {}) => {
  const don = await donGiao(idGiao);
  if (!don) throw new Error('Không tìm thấy đơn giao hàng.');
  if (DA_XONG.includes(don.trang_thai)) throw new Error(`Đơn đã ${TT[don.trang_thai].nhan.toLowerCase()}, không phân lại được.`);

  const sp = await shipper(idShipper);
  if (!sp) throw new Error('Không tìm thấy shipper.');
  if (sp.trang_thai === 'nghi') throw new Error(`${sp.ten} đang không trong ca — báo họ bật ca trước.`);

  // Phan lai chinh nguoi dang cam thi khong tinh them mot suat.
  const dangCam = Number(sp.don_dang_cam) - (Number(don.id_shipper) === Number(idShipper) ? 1 : 0);
  if (dangCam >= Number(sp.so_don_toi_da)) {
    throw new Error(`${sp.ten} đang cầm ${dangCam}/${sp.so_don_toi_da} đơn — chọn người khác hoặc tăng hạn mức.`);
  }

  await db.query(
    `UPDATE don_giao_hang
     SET id_shipper = ?, id_dv = ?, id_nv_phan = ?, trang_thai = 'da_phan',
         phan_luc = NOW(), ly_do = NULL
     WHERE id_giao = ?`,
    [idShipper, sp.id_dv, nguoi.id_nv || null, idGiao]
  );
  await db.query("UPDATE shipper SET trang_thai = 'dang_giao' WHERE id_shipper = ? AND trang_thai = 'san_sang'", [idShipper]);

  await ghiNhatKy(idGiao, don.trang_thai, 'da_phan', nguoi, `Giao cho ${sp.ten}${sp.bien_so ? ' (' + sp.bien_so + ')' : ''}`);
  return donGiao(idGiao);
};

/** Go shipper khoi don, tra ve hang cho. */
const goShipper = async (idGiao, nguoi = {}, lyDo = '') => {
  const don = await donGiao(idGiao);
  if (!don) throw new Error('Không tìm thấy đơn giao hàng.');
  if (!don.id_shipper) throw new Error('Đơn này chưa phân cho ai.');
  if (don.trang_thai === 'dang_giao') {
    throw new Error('Shipper đã rời nhà hàng với đơn này — hãy báo giao thất bại rồi phân lại.');
  }
  const idCu = don.id_shipper;
  await db.query(
    `UPDATE don_giao_hang SET id_shipper = NULL, trang_thai = 'cho_phan', phan_luc = NULL, lay_luc = NULL
     WHERE id_giao = ?`, [idGiao]
  );
  await ghiNhatKy(idGiao, don.trang_thai, 'cho_phan', nguoi,
    `Gỡ khỏi ${don.ten_shipper || 'shipper'}${lyDo ? ': ' + lyDo : ''}`);
  await capNhatCaShipper(idCu);
  return donGiao(idGiao);
};

/**
 * Doi trang thai don - LOI VAO DUY NHAT cho moi thay doi trang thai.
 *
 * Kiem tra ba dieu, theo dung thu tu:
 *   1. Buoc chuyen co hop le khong (bang CHUYEN_DUOC)
 *   2. Nguoi bam co phai shipper cua don khong (neu la shipper bam)
 *   3. Trang thai moi co doi hoi them gi khong (that_bai phai co ly do)
 *
 * Toa do `vi_do/kinh_do` la CUA NGUOI BAM luc bam, khong bat buoc. Ghi lai vi
 * day la bang chung duy nhat cho tranh chap "da giao roi ma khach bao chua nhan".
 */
const doiTrangThai = async (idGiao, moi, nguoi = {}, tuyChon = {}) => {
  const don = await donGiao(idGiao);
  if (!don) throw new Error('Không tìm thấy đơn giao hàng.');

  const cu = don.trang_thai;
  if (cu === moi) return don;
  if (!(CHUYEN_DUOC[cu] || []).includes(moi)) {
    throw new Error(`Không chuyển được từ "${TT[cu].nhan}" sang "${TT[moi] ? TT[moi].nhan : moi}".`);
  }

  // Shipper chi dong duoc vao don CUA MINH. Dieu phoi (co truyen `laDieuPhoi`)
  // thi khong bi rang buoc nay - ho phai xu ly duoc don cua nguoi da tat may.
  if (nguoi.id_shipper && !tuyChon.laDieuPhoi &&
      Number(don.id_shipper) !== Number(nguoi.id_shipper)) {
    throw new Error('Đơn này không phải của bạn.');
  }
  if (moi === 'that_bai' && !String(tuyChon.ly_do || '').trim()) {
    throw new Error('Phải ghi lý do giao thất bại (khách không nghe máy, sai địa chỉ...).');
  }

  // Moc thoi gian di kem tung trang thai. Ghi trong cung mot cau lenh voi
  // trang thai de hai thu khong bao gio lech nhau.
  const dat = ['trang_thai = ?'];
  const bien = [moi];
  if (moi === 'dang_lay')  dat.push('lay_luc = COALESCE(lay_luc, NOW())');
  if (moi === 'dang_giao') dat.push('giao_luc = COALESCE(giao_luc, NOW())');
  if (['da_giao', 'that_bai', 'huy'].includes(moi)) dat.push('hoan_tat_luc = NOW()');
  if (moi === 'da_giao' && Number(don.tien_thu_ho) > 0) dat.push('da_thu_ho = 1');
  if (['that_bai', 'huy'].includes(moi)) { dat.push('ly_do = ?'); bien.push(String(tuyChon.ly_do || '').trim() || null); }

  bien.push(idGiao);
  await db.query(`UPDATE don_giao_hang SET ${dat.join(', ')} WHERE id_giao = ?`, bien);

  // Don giao xong thi don goc coi nhu da thanh toan (tinhtrang = 3): khach giao
  // hang tra tien cho shipper hoac da tra truoc, khong ai ra quay thanh toan nua.
  if (moi === 'da_giao') {
    await db.query('UPDATE hopdong SET tinhtrang = 3 WHERE sesis = ? AND tinhtrang < 3', [don.sesis]);
    if (don.id_shipper) {
      await db.query(
        'UPDATE shipper SET tong_don = tong_don + 1, tong_don_thanh_cong = tong_don_thanh_cong + 1 WHERE id_shipper = ?',
        [don.id_shipper]
      );
    }
  }
  if (moi === 'that_bai' && don.id_shipper) {
    await db.query('UPDATE shipper SET tong_don = tong_don + 1 WHERE id_shipper = ?', [don.id_shipper]);
  }

  await ghiNhatKy(idGiao, cu, moi, nguoi, tuyChon.ly_do || tuyChon.ghi_chu || null,
                  tuyChon.vi_do, tuyChon.kinh_do);
  if (don.id_shipper) await capNhatCaShipper(don.id_shipper);

  return donGiao(idGiao);
};

/**
 * Shipper con don nao dang cam khong - neu het thi tra ve 'san_sang'.
 *
 * Goi sau MOI thay doi phan cong. Khong co buoc nay thi nguoi da giao xong het
 * van hien la 'dang_giao' tren man hinh dieu phoi va khong duoc phan don moi.
 */
async function capNhatCaShipper(idShipper) {
  const [[d]] = await db.query(
    `SELECT COUNT(*) AS n FROM don_giao_hang
     WHERE id_shipper = ? AND trang_thai IN ('da_phan','dang_lay','dang_giao')`, [idShipper]
  );
  const con = Number(d.n) > 0;
  await db.query(
    `UPDATE shipper SET trang_thai = ?
     WHERE id_shipper = ? AND trang_thai <> 'nghi'`,
    [con ? 'dang_giao' : 'san_sang', idShipper]
  );
}

async function ghiNhatKy(idGiao, cu, moi, nguoi = {}, ghiChu = null, viDo = null, kinhDo = null) {
  await db.query(
    `INSERT INTO nhat_ky_giao_hang
       (id_giao, tu_trang_thai, den_trang_thai, id_nv, ten_nguoi, ghi_chu, vi_do, kinh_do)
     VALUES (?,?,?,?,?,?,?,?)`,
    [idGiao, cu, moi, nguoi.id_nv || null, nguoi.ten || null,
     ghiChu ? String(ghiChu).slice(0, 300) : null,
     so(viDo), so(kinhDo)]
  );
}

// ---------------------------------------------------------------------------
// Vi tri GPS
// ---------------------------------------------------------------------------

/**
 * Ghi mot nhip vi tri cua shipper.
 *
 * GHI HAI CHO, CO Y:
 *   `vi_tri_shipper`            them mot dong  → vet duong di
 *   `vi_tri_shipper_moi_nhat`   ghi de mot dong → ban do doc nhanh
 * Xem ghi chu trong migration 019 ve ly do khong gop lam mot.
 *
 * LOC TIN HIEU RAC
 * ----------------
 * GPS dien thoai trong nha hoac giua toa nha cao tang co the nhay vai tram met.
 * Diem co `do_chinh_xac_m` > 200 bi bo: ve len ban do se thanh mot duong zic zac
 * vo ly, va dieu phoi se tuong shipper dang di lung tung.
 *
 * Tra ve `{ ghi: false, ly_do }` thay vi nem loi - ung dung shipper goi ham nay
 * moi 15 giay, mot diem xau khong dang de hien thong bao do len man hinh ho.
 */
const ghiViTri = async (idShipper, d = {}) => {
  const viDo = so(d.vi_do);
  const kinhDo = so(d.kinh_do);
  if (viDo === null || kinhDo === null ||
      viDo < -90 || viDo > 90 || kinhDo < -180 || kinhDo > 180) {
    return { ghi: false, ly_do: 'Tọa độ không hợp lệ.' };
  }
  const doChinhXac = so(d.do_chinh_xac_m);
  if (doChinhXac !== null && doChinhXac > 200) {
    return { ghi: false, ly_do: `Tín hiệu GPS yếu (sai số ${Math.round(doChinhXac)}m), bỏ qua điểm này.` };
  }

  // Don dang chay cua shipper - gan diem nay vao dung chuyen de sau con ve lai
  // lo trinh cua tung don.
  const [[don]] = await db.query(
    `SELECT id_giao FROM don_giao_hang
     WHERE id_shipper = ? AND trang_thai IN ('dang_lay','dang_giao')
     ORDER BY FIELD(trang_thai,'dang_giao','dang_lay'), phan_luc LIMIT 1`,
    [idShipper]
  );
  const idGiao = don ? don.id_giao : null;

  const mucPin = so(d.pin);
  const pin = mucPin === null ? null : Math.max(0, Math.min(100, Math.round(mucPin)));

  await db.query(
    `INSERT INTO vi_tri_shipper (id_shipper, id_giao, vi_do, kinh_do, do_chinh_xac_m, toc_do_kmh, huong, pin)
     VALUES (?,?,?,?,?,?,?,?)`,
    [idShipper, idGiao, viDo, kinhDo, doChinhXac, so(d.toc_do_kmh), so(d.huong), pin]
  );
  await db.query(
    `INSERT INTO vi_tri_shipper_moi_nhat
       (id_shipper, id_giao, vi_do, kinh_do, do_chinh_xac_m, toc_do_kmh, huong, pin, luc)
     VALUES (?,?,?,?,?,?,?,?, NOW())
     ON DUPLICATE KEY UPDATE
       id_giao = VALUES(id_giao), vi_do = VALUES(vi_do), kinh_do = VALUES(kinh_do),
       do_chinh_xac_m = VALUES(do_chinh_xac_m), toc_do_kmh = VALUES(toc_do_kmh),
       huong = VALUES(huong), pin = VALUES(pin), luc = VALUES(luc)`,
    [idShipper, idGiao, viDo, kinhDo, doChinhXac, so(d.toc_do_kmh), so(d.huong), pin]
  );

  return { ghi: true, id_giao: idGiao, vi_do: viDo, kinh_do: kinhDo };
};

/**
 * Du lieu cho ban do dieu phoi: nha hang, shipper dang online, don dang chay.
 *
 * `phut_truoc` > 3 coi nhu mat tin hieu. Ban do lam nhat cham do va ghi ro
 * "mất tín hiệu 12 phút" - de dieu phoi goi dien hoi thay vi ngoi doi.
 */
const banDo = async () => {
  const [goc, ts] = await Promise.all([toaDoNhaHang(), thamSo()]);
  const [shippers] = await db.query(
    `SELECT s.id_shipper, s.ten, s.sdt, s.bien_so, s.loai_xe, s.trang_thai,
            nv.ten AS ten_nv,
            dv.ten_dv, dv.mau_sac,
            v.vi_do, v.kinh_do, v.luc, v.toc_do_kmh, v.huong, v.pin,
            TIMESTAMPDIFF(SECOND, v.luc, NOW()) AS giay_truoc,
            (SELECT COUNT(*) FROM don_giao_hang g
              WHERE g.id_shipper = s.id_shipper
                AND g.trang_thai IN ('da_phan','dang_lay','dang_giao')) AS don_dang_cam
     FROM shipper s
     JOIN don_vi_van_chuyen dv ON dv.id_dv = s.id_dv
     LEFT JOIN nhan_vien nv ON nv.id_nv = s.id_nv
     LEFT JOIN vi_tri_shipper_moi_nhat v ON v.id_shipper = s.id_shipper
     WHERE s.trang_thai <> 'nghi'
     ORDER BY s.ten`
  );

  const don = await dsDonGiao({ dangChay: true });

  return {
    nha_hang: goc,
    nhip_gps_giay: ts.nhip_gps_giay,
    shippers: shippers.map((s) => ({
      ...s,
      ten: String(s.ten_nv || s.ten || '').trim(),
      co_vi_tri: s.vi_do !== null && s.kinh_do !== null,
      mat_tin_hieu: s.giay_truoc === null || Number(s.giay_truoc) > 180,
      phut_truoc: s.giay_truoc === null ? null : Math.floor(Number(s.giay_truoc) / 60),
    })),
    don: don.map((g) => ({
      id_giao: g.id_giao, ma_giao: g.ma_giao, sesis: g.sesis,
      trang_thai: g.trang_thai, nhan: g.tt.nhan, mau: g.tt.mau,
      ten_nguoi_nhan: g.ten_nguoi_nhan, sdt_nguoi_nhan: g.sdt_nguoi_nhan,
      dia_chi_giao: g.dia_chi_giao, vi_do: g.vi_do, kinh_do: g.kinh_do,
      khoang_cach_km: g.khoang_cach_km, phi_giao: g.phi_giao,
      tien_hang: g.tien_hang, ten_shipper: g.ten_shipper, id_shipper: g.id_shipper,
      ten_dv: g.ten_dv, du_kien_luc: g.du_kien_luc, bep_da_xong: g.bep_da_xong,
    })),
  };
};

/** Vet duong di cua mot don, de ve lai lo trinh sau khi giao xong. */
const vetCuaDon = async (idGiao) => {
  const [rows] = await db.query(
    `SELECT vi_do, kinh_do, toc_do_kmh, luc FROM vi_tri_shipper
     WHERE id_giao = ? ORDER BY luc, id`, [idGiao]
  );
  return rows;
};

/**
 * Don bang vet cu.
 *
 * Goi tu mot lenh dinh ky hoac tay. Chi dong den `vi_tri_shipper`: bang vi tri
 * hien tai va nhat ky trang thai deu nho va la bang chung, khong duoc don.
 */
const donVetCu = async () => {
  const ts = await thamSo();
  const [kq] = await db.query(
    'DELETE FROM vi_tri_shipper WHERE luc < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [ts.giu_vet_ngay]
  );
  return kq.affectedRows;
};

// ---------------------------------------------------------------------------
// Thong ke
// ---------------------------------------------------------------------------

/**
 * So lieu cho dau man hinh dieu phoi.
 *
 * `tre_han` dem don da qua `du_kien_luc` ma chua giao xong - day la con so duy
 * nhat noi len chat luong dich vu, va la thu dieu phoi phai nhin dau tien.
 */
const thongKe = async (ngay = null) => {
  const loc = ngay ? 'DATE(tao_luc) = ?' : 'DATE(tao_luc) = CURDATE()';
  const bien = ngay ? [ngay] : [];
  const [[r]] = await db.query(
    `SELECT COUNT(*) AS tong,
            SUM(trang_thai = 'cho_phan')  AS cho_phan,
            SUM(trang_thai IN ('da_phan','dang_lay','dang_giao')) AS dang_chay,
            SUM(trang_thai = 'da_giao')   AS da_giao,
            SUM(trang_thai = 'that_bai')  AS that_bai,
            SUM(trang_thai = 'huy')       AS huy,
            SUM(phi_giao)                 AS tien_phi,
            AVG(CASE WHEN trang_thai = 'da_giao' AND phan_luc IS NOT NULL
                     THEN TIMESTAMPDIFF(MINUTE, phan_luc, hoan_tat_luc) END) AS phut_tb
     FROM don_giao_hang WHERE ${loc}`, bien
  );
  const [[tre]] = await db.query(
    `SELECT COUNT(*) AS n FROM don_giao_hang
     WHERE trang_thai NOT IN ('da_giao','huy','that_bai')
       AND du_kien_luc IS NOT NULL AND du_kien_luc < NOW()`
  );
  return {
    tong: Number(r.tong || 0),
    cho_phan: Number(r.cho_phan || 0),
    dang_chay: Number(r.dang_chay || 0),
    da_giao: Number(r.da_giao || 0),
    that_bai: Number(r.that_bai || 0),
    huy: Number(r.huy || 0),
    tien_phi: Number(r.tien_phi || 0),
    phut_tb: r.phut_tb === null ? null : Math.round(Number(r.phut_tb)),
    tre_han: Number(tre.n || 0),
  };
};

module.exports = {
  TT, CHUYEN_DUOC, DA_XONG, DANG_CHAY,
  khoangCachKm, toaDoNhaHang, thamSo, tinhPhi,
  dsDonVi, donVi, themDonVi, suaDonVi, xoaDonVi,
  dsShipper, shipper, shipperCuaNhanVien, themShipper, suaShipper,
  doiCaShipper, xoaShipper, nhanVienChuaLaShipper,
  taoDonGiao, donGiao, donGiaoTheoSesis, donGiaoTheoMa, dsDonGiao, monCuaDon, nhatKy,
  phanShipper, goShipper, doiTrangThai,
  ghiViTri, banDo, vetCuaDon, donVetCu,
  thongKe,
};

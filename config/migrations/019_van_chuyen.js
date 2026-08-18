/**
 * Migration 019 - Don vi van chuyen va theo doi shipper bang GPS.
 *
 * VI SAO CAN
 * ----------
 * `hopdong.loai_don` da co gia tri 'giao_hang' tu migration 003, va cau tra loi
 * san cua tro ly ao van hua "nha hang co giao hang trong ban kinh 5km". Nhung
 * trong toan he thong khong co CHO NAO ghi don do se di dau, ai cam, va bao gio
 * toi. Don giao hang hien nam lan trong danh sach dat ban, khong phan biet duoc
 * voi khach an tai cho.
 *
 * Migration nay dung phan he van chuyen tren dung mo hinh to chuc san co: mot
 * bo phan moi (GH), hai chuc danh moi (dieu phoi + shipper), sau bang du lieu,
 * va sau quyen chi tiet.
 *
 * SAU BANG DUOC THEM
 *
 * 1. `don_vi_van_chuyen` - DON VI van chuyen, noi bo hay doi tac.
 *    Khong gan cung mot doi ship duy nhat: nha hang co doi shipper cua minh cho
 *    ban kinh gan, va thue doi tac (Ahamove, Grab...) cho don xa hoac gio cao
 *    diem. Moi don vi co bang gia rieng (phi mo cua, so km dau, phi moi km) va
 *    ban kinh phuc vu rieng, nen phi giao tinh duoc ngay tai luc dat chu khong
 *    phai goi dien hoi.
 *
 * 2. `shipper` - nguoi giao hang.
 *    Tach khoi `nhan_vien` chu khong them cot vao do, vi shipper cua DOI TAC
 *    khong phai nhan vien nha hang: khong cham cong, khong tinh luong, khong co
 *    tai khoan dang nhap. `id_nv` de NULL cho truong hop do. Shipper noi bo thi
 *    `id_nv` tro ve ho so nhan su that, va ho dang nhap bang chinh tai khoan
 *    nhan vien de mo ung dung /shipper.
 *
 * 3. `don_giao_hang` - MOT dong cho MOT don (mot `sesis`), khong phai mot dong
 *    moi mon. `hopdong` luu theo tung mon nen mot don la nhieu dong; dia chi
 *    giao, phi ship, shipper phu trach la thuoc tinh cua ca don, viet vao tung
 *    mon se lap lai va de lech nhau.
 *
 * 4. `nhat_ky_giao_hang` - lich su doi trang thai, kem toa do luc doi.
 *    Khi khach khieu nai "shipper bao da giao ma toi khong nhan duoc", cau tra
 *    loi nam o day: luc 19:42 nguoi do bam "da giao" tai toa do cach nha khach
 *    800m. Khong co bang nay thi chi con loi khai hai ben.
 *
 * 5. `vi_tri_shipper` - VET duong di, moi nhip GPS mot dong.
 *    Dung de ve lai lo trinh sau khi don da xong, va de doi soat quang duong
 *    thuc te voi khoang cach tinh theo duong chim bay.
 *
 * 6. `vi_tri_shipper_moi_nhat` - VI TRI HIEN TAI, moi shipper dung mot dong.
 *    Ban do dieu phoi ve lai moi vai giay. Doc "diem moi nhat cua moi shipper"
 *    tu bang vet la mot truy van nhom-va-lay-cuc-dai tren bang lon nhat he
 *    thong (moi shipper sinh ~240 dong/gio). Mot bang ghi de tai cho khien truy
 *    van ban do luon la mot lan quet vai chuc dong.
 *
 * TAI SAO TACH LAM HAI BANG VI TRI
 * --------------------------------
 * Hai bang tra loi hai cau hoi khac nhau va co vong doi khac nhau: vi tri hien
 * tai phai doc RAT nhanh va chi can dung mot dong; vet duong doc hiem khi nhung
 * lon rat nhanh va don duoc theo ngay. Gop lai thi hoac ban do cham dan theo
 * thoi gian, hoac phai xoa vet - mat kha nang doi soat.
 *
 * QUYEN
 * -----
 * Sau quyen moi trong nhom 'Giao hàng'. Dang chu y nhat la tach
 * `giao_hang.cap_nhat` (shipper tu doi trang thai don CUA MINH) khoi
 * `giao_hang.phan_cong` (dieu phoi giao don cho nguoi khac): shipper duoc bam
 * "da giao" nhung khong duoc tu nhan them don hay go don cua dong nghiep.
 *
 * Chay lai duoc nhieu lan (idempotent):
 *    node config/migrations/019_van_chuyen.js
 */
const db = require('../db');

// ---------------------------------------------------------------------------
// Du lieu mac dinh
// ---------------------------------------------------------------------------

/**
 * Hai don vi mac dinh: doi cua nha hang va mot doi tac de san.
 *
 * Bang gia dat theo mat bang giao do an TP.HCM 2025: mo cua ~15k cho 2km dau,
 * sau do ~5k/km. Doi tac dat cao hon mot chut va ban kinh rong hon - dung cho
 * don xa ma doi nha khong voi toi.
 */
const DON_VI_MAC_DINH = [
  {
    ma_dv: 'NOIBO', ten_dv: 'Đội giao hàng nhà hàng', loai: 'noi_bo',
    sdt: '', phi_co_ban: 15000, so_km_dau: 2, phi_moi_km: 5000,
    ban_kinh_km: 5, thoi_gian_cam_ket_phut: 45, mau_sac: '#198754', thu_tu: 1,
    ghi_chu: 'Shipper của nhà hàng, theo dõi được vị trí trực tiếp trên bản đồ.',
  },
  {
    ma_dv: 'DOITAC', ten_dv: 'Đối tác giao hàng ngoài', loai: 'doi_tac',
    sdt: '', phi_co_ban: 20000, so_km_dau: 2, phi_moi_km: 6000,
    ban_kinh_km: 10, thoi_gian_cam_ket_phut: 60, mau_sac: '#fd7e14', thu_tu: 2,
    ghi_chu: 'Dùng cho đơn ngoài bán kính đội nhà hoặc giờ cao điểm.',
  },
];

/** Bo phan moi. Mau va icon theo dung quy uoc cua bang `bo_phan`. */
const BO_PHAN_GH = {
  ma_bp: 'GH', ten_bp: 'Giao hàng',
  mo_ta: 'Điều phối và giao đơn mang đi, theo dõi shipper trên bản đồ',
  mau_sac: '#e83e8c', icon: 'fa-motorcycle', thu_tu: 9,
};

/**
 * Hai chuc danh moi.
 *
 * Dieu phoi dat cap 4 (ngang To truong) chu khong phai cap 3: ho dieu don trong
 * pham vi bo phan minh, khong giam sat bo phan khac. Cap tren truc tiep la Tro
 * ly quan ly (TLQL) - giong nhanh Le tan va Phuc vu.
 *
 * `vai_tro_tuong_duong` cho ca hai deu KHONG chua 'Bep' hay 'Thu ngan': shipper
 * khong duoc di lac vao man hinh bep hay quay thu ngan chi vi he thong cu chi
 * biet so sanh chuoi vai tro.
 */
const CHUC_DANH_GH = [
  {
    ma_cd: 'DPGH', ten_cd: 'Điều phối giao hàng', ten_rut_gon: 'Điều phối GH',
    cap_bac: 4, ma_cd_cha: 'TLQL', la_quan_ly: 1,
    vai_tro_tuong_duong: 'Quay,Nhan vien chung', chucvu_legacy: 'Nhan vien chung',
    trach_nhiem: 'Nhận đơn giao hàng, chọn đơn vị vận chuyển, phân đơn cho shipper, theo dõi tiến độ trên bản đồ và xử lý đơn giao thất bại.',
    dinh_bien: 1, thu_tu: 23,
  },
  {
    ma_cd: 'SHIPPER', ten_cd: 'Nhân viên giao hàng', ten_rut_gon: 'Shipper',
    cap_bac: 5, ma_cd_cha: 'DPGH', la_quan_ly: 0,
    vai_tro_tuong_duong: 'Nhan vien chung', chucvu_legacy: 'Nhan vien chung',
    trach_nhiem: 'Nhận đơn được phân, lấy hàng tại bếp, giao tận nơi, cập nhật trạng thái và bật định vị trong suốt chuyến giao.',
    dinh_bien: 4, thu_tu: 24,
  },
];

/** Quyen moi. `la_nhay_cam` = 1 cho nhung viec doi tien hoac doi cau hinh. */
const QUYEN_MOI = [
  { ma_q: 'giao_hang.xem',        ten_q: 'Xem đơn giao hàng',              nhay: 0 },
  { ma_q: 'giao_hang.phan_cong',  ten_q: 'Phân đơn cho shipper',            nhay: 0 },
  { ma_q: 'giao_hang.cap_nhat',   ten_q: 'Cập nhật trạng thái đơn của mình', nhay: 0 },
  { ma_q: 'giao_hang.theo_doi',   ten_q: 'Xem bản đồ theo dõi shipper',     nhay: 0 },
  { ma_q: 'giao_hang.shipper',    ten_q: 'Quản lý shipper',                 nhay: 0 },
  { ma_q: 'giao_hang.don_vi',     ten_q: 'Quản lý đơn vị vận chuyển - bảng giá', nhay: 1 },
];

/**
 * Chuc danh nao duoc quyen nao.
 *
 * Quan ly nha hang va Tro ly duoc tat ca - ho chiu trach nhiem cuoi cung. Giam
 * sat phuc vu va Truong le tan chi duoc XEM va theo doi ban do: khach dung o
 * sanh hoi "don toi toi dau roi" thi ho tra loi duoc ngay ma khong dong duoc
 * vao viec dieu phoi.
 */
const CAP_QUYEN = {
  QLNH:     ['giao_hang.xem', 'giao_hang.phan_cong', 'giao_hang.cap_nhat', 'giao_hang.theo_doi', 'giao_hang.shipper', 'giao_hang.don_vi'],
  TLQL:     ['giao_hang.xem', 'giao_hang.phan_cong', 'giao_hang.cap_nhat', 'giao_hang.theo_doi', 'giao_hang.shipper', 'giao_hang.don_vi'],
  DPGH:     ['giao_hang.xem', 'giao_hang.phan_cong', 'giao_hang.cap_nhat', 'giao_hang.theo_doi', 'giao_hang.shipper'],
  SHIPPER:  ['giao_hang.xem', 'giao_hang.cap_nhat'],
  GSPV:     ['giao_hang.xem', 'giao_hang.theo_doi'],
  TRUONGLT: ['giao_hang.xem', 'giao_hang.theo_doi'],
  NVLT:     ['giao_hang.xem'],
  GSTN:     ['giao_hang.xem'],
  NVTN:     ['giao_hang.xem'],
};

/**
 * Tham so van hanh, de trong `cau_hinh` de quan ly sua duoc ma khong dong ma nguon.
 *
 * `nhip_gps_giay` la danh doi giua do muot cua ban do va pin dien thoai shipper:
 * 15 giay la muc thay duoc xe di lien mach tren ban do ma khong ngon pin ro ret.
 * `giu_vet_ngay` gioi han bang vet - mot shipper chay ca ngay sinh khoang 2000
 * dong, giu 7 ngay la du de doi soat khieu nai ma bang khong phinh vo han.
 */
const CAU_HINH = [
  ['giao_hang.bat', '1', 'Bat (1) / tat (0) nhan don giao hang tren website'],
  ['giao_hang.ban_kinh_km', '5', 'Ban kinh giao hang toi da (km) - ngoai vung nay website tu choi nhan don'],
  ['giao_hang.mien_phi_tu', '500000', 'Don tu so tien nay tro len duoc mien phi giao (0 = khong mien)'],
  ['giao_hang.nhip_gps_giay', '15', 'Bao nhieu giay ung dung shipper gui vi tri mot lan'],
  ['giao_hang.giu_vet_ngay', '7', 'Giu vet duong di bao nhieu ngay roi tu don'],
  ['giao_hang.tu_dong_tao_don', '1', 'Tu tao don giao hang khi khach chon hinh thuc Giao hang (1) hay de dieu phoi tao tay (0)'],
];

// ---------------------------------------------------------------------------
// Tien ich kiem tra - de chay lai nhieu lan khong hong gi
// ---------------------------------------------------------------------------

async function coBang(bang) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`, [bang]
  );
  return r[0].n > 0;
}

async function coCot(bang, cot) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [bang, cot]
  );
  return r[0].n > 0;
}

// ---------------------------------------------------------------------------
// [1/7] Cac bang du lieu
// ---------------------------------------------------------------------------

async function bangDonVi() {
  console.log('\n[1/7] Bang don_vi_van_chuyen');
  await db.query(`
    CREATE TABLE IF NOT EXISTS don_vi_van_chuyen (
      id_dv                  INT           NOT NULL AUTO_INCREMENT,
      ma_dv                  VARCHAR(20)   NOT NULL,
      ten_dv                 VARCHAR(120)  NOT NULL,
      loai                   ENUM('noi_bo','doi_tac') NOT NULL DEFAULT 'noi_bo',
      sdt                    VARCHAR(20)   DEFAULT NULL,
      email                  VARCHAR(150)  DEFAULT NULL,
      dia_chi                VARCHAR(255)  DEFAULT NULL,
      phi_co_ban             DECIMAL(10,2) NOT NULL DEFAULT 15000 COMMENT 'Phi mo cua, da gom so_km_dau',
      so_km_dau              DECIMAL(4,1)  NOT NULL DEFAULT 2     COMMENT 'So km dau da nam trong phi_co_ban',
      phi_moi_km             DECIMAL(10,2) NOT NULL DEFAULT 5000  COMMENT 'Phi cho moi km vuot qua so_km_dau',
      ban_kinh_km            DECIMAL(4,1)  NOT NULL DEFAULT 5     COMMENT 'Ban kinh phuc vu toi da',
      thoi_gian_cam_ket_phut INT           NOT NULL DEFAULT 45,
      mau_sac                VARCHAR(20)   NOT NULL DEFAULT '#0d6efd' COMMENT 'Mau cham tren ban do dieu phoi',
      ghi_chu                TEXT          DEFAULT NULL,
      thu_tu                 INT           NOT NULL DEFAULT 0,
      trang_thai             TINYINT(1)    NOT NULL DEFAULT 1,
      tao_luc                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_dv),
      UNIQUE KEY uq_dv_ma (ma_dv),
      KEY idx_dv_trang_thai (trang_thai, thu_tu)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  for (const d of DON_VI_MAC_DINH) {
    // INSERT IGNORE: quan ly da sua bang gia thi giu nguyen gia cua ho.
    await db.query(
      `INSERT IGNORE INTO don_vi_van_chuyen
         (ma_dv, ten_dv, loai, sdt, phi_co_ban, so_km_dau, phi_moi_km,
          ban_kinh_km, thoi_gian_cam_ket_phut, mau_sac, thu_tu, ghi_chu)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.ma_dv, d.ten_dv, d.loai, d.sdt, d.phi_co_ban, d.so_km_dau, d.phi_moi_km,
       d.ban_kinh_km, d.thoi_gian_cam_ket_phut, d.mau_sac, d.thu_tu, d.ghi_chu]
    );
  }
  const [n] = await db.query('SELECT COUNT(*) AS n FROM don_vi_van_chuyen');
  console.log(`      co ${n[0].n} don vi van chuyen`);
}

async function bangShipper() {
  console.log('\n[2/7] Bang shipper');
  await db.query(`
    CREATE TABLE IF NOT EXISTS shipper (
      id_shipper          INT          NOT NULL AUTO_INCREMENT,
      id_dv               INT          NOT NULL,
      id_nv               INT          DEFAULT NULL COMMENT 'NULL = shipper cua doi tac, khong phai nhan vien',
      ten                 VARCHAR(120) NOT NULL,
      sdt                 VARCHAR(20)  DEFAULT NULL,
      loai_xe             ENUM('xe_may','xe_dap','xe_dien','o_to') NOT NULL DEFAULT 'xe_may',
      bien_so             VARCHAR(20)  DEFAULT NULL,
      so_don_toi_da       INT          NOT NULL DEFAULT 3 COMMENT 'So don duoc cam cung luc',
      trang_thai          ENUM('san_sang','dang_giao','nghi') NOT NULL DEFAULT 'nghi',
      tong_don            INT          NOT NULL DEFAULT 0,
      tong_don_thanh_cong INT          NOT NULL DEFAULT 0,
      ghi_chu             VARCHAR(255) DEFAULT NULL,
      tao_luc             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_shipper),
      UNIQUE KEY uq_shipper_nv (id_nv),
      KEY idx_shipper_dv (id_dv),
      KEY idx_shipper_tt (trang_thai),
      CONSTRAINT fk_shipper_dv FOREIGN KEY (id_dv) REFERENCES don_vi_van_chuyen (id_dv),
      CONSTRAINT fk_shipper_nv FOREIGN KEY (id_nv) REFERENCES nhan_vien (id_nv) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  console.log('      xong');
}

async function bangDonGiao() {
  console.log('\n[3/7] Bang don_giao_hang');
  await db.query(`
    CREATE TABLE IF NOT EXISTS don_giao_hang (
      id_giao         INT           NOT NULL AUTO_INCREMENT,
      sesis           VARCHAR(191)  NOT NULL COMMENT 'Khoa don trong bang hopdong',
      ma_giao         VARCHAR(20)   NOT NULL COMMENT 'Ma ngan cho khach tra cuu',
      id_dv           INT           DEFAULT NULL,
      id_shipper      INT           DEFAULT NULL,
      ten_nguoi_nhan  VARCHAR(120)  NOT NULL,
      sdt_nguoi_nhan  VARCHAR(20)   NOT NULL,
      dia_chi_giao    VARCHAR(300)  NOT NULL,
      vi_do           DOUBLE        DEFAULT NULL,
      kinh_do         DOUBLE        DEFAULT NULL,
      khoang_cach_km  DECIMAL(6,2)  DEFAULT NULL COMMENT 'Duong chim bay tu nha hang',
      phi_giao        DECIMAL(10,2) NOT NULL DEFAULT 0,
      tien_thu_ho     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'COD - 0 neu khach da tra truoc',
      da_thu_ho       TINYINT(1)    NOT NULL DEFAULT 0,
      trang_thai      ENUM('cho_phan','da_phan','dang_lay','dang_giao','da_giao','that_bai','huy')
                      NOT NULL DEFAULT 'cho_phan',
      ghi_chu         VARCHAR(300)  DEFAULT NULL,
      ly_do           VARCHAR(300)  DEFAULT NULL COMMENT 'Ly do that bai / huy',
      id_nv_phan      INT           DEFAULT NULL,
      du_kien_luc     DATETIME      DEFAULT NULL,
      tao_luc         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      phan_luc        DATETIME      DEFAULT NULL,
      lay_luc         DATETIME      DEFAULT NULL COMMENT 'Shipper da lay hang tai bep',
      giao_luc        DATETIME      DEFAULT NULL COMMENT 'Bat dau roi nha hang',
      hoan_tat_luc    DATETIME      DEFAULT NULL,
      PRIMARY KEY (id_giao),
      UNIQUE KEY uq_gh_sesis (sesis),
      UNIQUE KEY uq_gh_ma (ma_giao),
      KEY idx_gh_tt (trang_thai, tao_luc),
      KEY idx_gh_shipper (id_shipper, trang_thai),
      KEY idx_gh_dv (id_dv),
      CONSTRAINT fk_gh_dv      FOREIGN KEY (id_dv)      REFERENCES don_vi_van_chuyen (id_dv),
      CONSTRAINT fk_gh_shipper FOREIGN KEY (id_shipper) REFERENCES shipper (id_shipper) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  console.log('      xong');
}

async function bangNhatKy() {
  console.log('\n[4/7] Bang nhat_ky_giao_hang');
  await db.query(`
    CREATE TABLE IF NOT EXISTS nhat_ky_giao_hang (
      id             INT          NOT NULL AUTO_INCREMENT,
      id_giao        INT          NOT NULL,
      tu_trang_thai  VARCHAR(20)  DEFAULT NULL,
      den_trang_thai VARCHAR(20)  NOT NULL,
      id_nv          INT          DEFAULT NULL,
      ten_nguoi      VARCHAR(120) DEFAULT NULL COMMENT 'Ghi lai ten tai thoi diem do, khong join nguoc',
      ghi_chu        VARCHAR(300) DEFAULT NULL,
      vi_do          DOUBLE       DEFAULT NULL COMMENT 'Shipper dang o dau luc bam nut',
      kinh_do        DOUBLE       DEFAULT NULL,
      luc            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_nkgh_giao (id_giao, luc),
      CONSTRAINT fk_nkgh_giao FOREIGN KEY (id_giao) REFERENCES don_giao_hang (id_giao) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  console.log('      xong');
}

async function bangViTri() {
  console.log('\n[5/7] Hai bang vi tri');

  // Vet duong di - moi nhip GPS mot dong, chi them chu khong sua.
  await db.query(`
    CREATE TABLE IF NOT EXISTS vi_tri_shipper (
      id             BIGINT    NOT NULL AUTO_INCREMENT,
      id_shipper     INT       NOT NULL,
      id_giao        INT       DEFAULT NULL COMMENT 'Dang tren chuyen nao - NULL la dang ranh',
      vi_do          DOUBLE    NOT NULL,
      kinh_do        DOUBLE    NOT NULL,
      do_chinh_xac_m FLOAT     DEFAULT NULL,
      toc_do_kmh     FLOAT     DEFAULT NULL,
      huong          FLOAT     DEFAULT NULL COMMENT 'Do, 0 = huong Bac',
      pin            TINYINT   DEFAULT NULL COMMENT 'Phan tram pin dien thoai',
      luc            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_vt_shipper (id_shipper, luc),
      KEY idx_vt_giao (id_giao, luc),
      CONSTRAINT fk_vt_shipper FOREIGN KEY (id_shipper) REFERENCES shipper (id_shipper) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Vi tri hien tai - moi shipper dung mot dong, ghi de tai cho.
  await db.query(`
    CREATE TABLE IF NOT EXISTS vi_tri_shipper_moi_nhat (
      id_shipper     INT       NOT NULL,
      id_giao        INT       DEFAULT NULL,
      vi_do          DOUBLE    NOT NULL,
      kinh_do        DOUBLE    NOT NULL,
      do_chinh_xac_m FLOAT     DEFAULT NULL,
      toc_do_kmh     FLOAT     DEFAULT NULL,
      huong          FLOAT     DEFAULT NULL,
      pin            TINYINT   DEFAULT NULL,
      luc            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_shipper),
      KEY idx_vtmn_luc (luc),
      CONSTRAINT fk_vtmn_shipper FOREIGN KEY (id_shipper) REFERENCES shipper (id_shipper) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  console.log('      xong');
}

// ---------------------------------------------------------------------------
// [6/7] Co cau to chuc + quyen
// ---------------------------------------------------------------------------

async function toChuc() {
  console.log('\n[6/7] Bo phan, chuc danh, quyen');

  if (!(await coBang('bo_phan')) || !(await coBang('chuc_danh')) || !(await coBang('quyen'))) {
    console.log('      [BO QUA] chua chay migration 008_co_cau_to_chuc - khong co bang to chuc.');
    console.log('      Chay 008 truoc roi chay lai 019 de co bo phan Giao hang va cac quyen.');
    return;
  }

  // --- Bo phan ---
  await db.query(
    `INSERT IGNORE INTO bo_phan (ma_bp, ten_bp, mo_ta, mau_sac, icon, thu_tu)
     VALUES (?,?,?,?,?,?)`,
    [BO_PHAN_GH.ma_bp, BO_PHAN_GH.ten_bp, BO_PHAN_GH.mo_ta,
     BO_PHAN_GH.mau_sac, BO_PHAN_GH.icon, BO_PHAN_GH.thu_tu]
  );
  const [[bp]] = await db.query('SELECT id_bp FROM bo_phan WHERE ma_bp = ?', [BO_PHAN_GH.ma_bp]);
  console.log(`      bo phan GH: id_bp = ${bp.id_bp}`);

  // --- Chuc danh ---
  // Chen theo dung thu tu mang: SHIPPER co cha la DPGH nen DPGH phai co truoc.
  for (const c of CHUC_DANH_GH) {
    let idCha = null;
    if (c.ma_cd_cha) {
      const [[cha]] = await db.query('SELECT id_cd FROM chuc_danh WHERE ma_cd = ?', [c.ma_cd_cha]);
      idCha = cha ? cha.id_cd : null;
    }
    await db.query(
      `INSERT IGNORE INTO chuc_danh
         (ma_cd, ten_cd, ten_rut_gon, id_bp, cap_bac, id_cd_cha, la_quan_ly,
          vai_tro_tuong_duong, chucvu_legacy, trach_nhiem, dinh_bien, thu_tu)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [c.ma_cd, c.ten_cd, c.ten_rut_gon, bp.id_bp, c.cap_bac, idCha, c.la_quan_ly,
       c.vai_tro_tuong_duong, c.chucvu_legacy, c.trach_nhiem, c.dinh_bien, c.thu_tu]
    );
  }
  console.log(`      chuc danh: ${CHUC_DANH_GH.map((c) => c.ma_cd).join(', ')}`);

  // --- Quyen ---
  // `thu_tu` noi tiep sau quyen cuoi cung dang co, de nhom moi nam cuoi danh
  // sach thay vi chen lan giua cac nhom cu tren man hinh phan quyen.
  const [[max]] = await db.query('SELECT COALESCE(MAX(thu_tu), 0) AS m FROM quyen');
  let thuTu = Number(max.m) + 1;
  for (const q of QUYEN_MOI) {
    await db.query(
      `INSERT IGNORE INTO quyen (ma_q, ten_q, nhom_q, la_nhay_cam, thu_tu) VALUES (?,?,?,?,?)`,
      [q.ma_q, q.ten_q, 'Giao hàng', q.nhay, thuTu++]
    );
  }
  console.log(`      quyen: them ${QUYEN_MOI.length} ma trong nhom "Giao hàng"`);

  // --- Cap quyen cho chuc danh ---
  let soCap = 0;
  for (const [maCd, dsQuyen] of Object.entries(CAP_QUYEN)) {
    const [[cd]] = await db.query('SELECT id_cd FROM chuc_danh WHERE ma_cd = ?', [maCd]);
    if (!cd) {
      console.log(`      [bo qua] khong thay chuc danh ${maCd}`);
      continue;
    }
    for (const maQ of dsQuyen) {
      const [[q]] = await db.query('SELECT id_q FROM quyen WHERE ma_q = ?', [maQ]);
      if (!q) continue;
      const [kq] = await db.query(
        `INSERT IGNORE INTO chuc_danh_quyen (id_cd, id_q, duoc_cap) VALUES (?,?,1)`,
        [cd.id_cd, q.id_q]
      );
      soCap += kq.affectedRows;
    }
  }
  console.log(`      da cap ${soCap} dong quyen moi cho cac chuc danh`);
}

// ---------------------------------------------------------------------------
// [7/7] Tham so van hanh
// ---------------------------------------------------------------------------

async function thamSo() {
  console.log('\n[7/7] Tham so trong cau_hinh');
  for (const [khoa, giaTri, moTa] of CAU_HINH) {
    // INSERT IGNORE chu khong ON DUPLICATE UPDATE: chay lai migration khong
    // duoc keo cau hinh nguoi dung da chinh ve lai mac dinh.
    await db.query(
      'INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?,?,?)',
      [khoa, giaTri, moTa]
    );
  }
  console.log(`      ${CAU_HINH.length} khoa cau hinh`);
}

// ---------------------------------------------------------------------------
// Kiem tra sau migration
// ---------------------------------------------------------------------------

async function kiemTra() {
  console.log('\n[Kiem tra]');
  const bang = ['don_vi_van_chuyen', 'shipper', 'don_giao_hang',
                'nhat_ky_giao_hang', 'vi_tri_shipper', 'vi_tri_shipper_moi_nhat'];
  const thieu = [];
  for (const b of bang) {
    const co = await coBang(b);
    console.log(`      ${b.padEnd(24)}: ${co ? 'co' : 'THIEU'}`);
    if (!co) thieu.push(b);
  }

  const [dv] = await db.query('SELECT COUNT(*) AS n FROM don_vi_van_chuyen WHERE trang_thai = 1');
  console.log(`      don vi dang hoat dong    : ${dv[0].n}`);

  if (await coBang('quyen')) {
    const [q] = await db.query("SELECT COUNT(*) AS n FROM quyen WHERE ma_q LIKE 'giao_hang.%'");
    console.log(`      quyen giao_hang.*        : ${q[0].n}/${QUYEN_MOI.length}`);
  }

  // `hopdong.loai_don` la noi don giao hang duoc danh dau. Khong co cot nay thi
  // phan he van chay nhung khong loc duoc don nao la don giao.
  const coLoaiDon = await coCot('hopdong', 'loai_don');
  console.log(`      hopdong.loai_don         : ${coLoaiDon ? 'co' : 'THIEU'}`);

  if (thieu.length) throw new Error('Thieu bang: ' + thieu.join(', '));
  if (!coLoaiDon) throw new Error('Thieu cot hopdong.loai_don - chay migration 003 truoc.');
  if (Number(dv[0].n) === 0) throw new Error('Khong co don vi van chuyen nao hoat dong.');
}

async function main() {
  console.log('=== Migration 019: don vi van chuyen + theo doi shipper GPS ===');
  await bangDonVi();
  await bangShipper();
  await bangDonGiao();
  await bangNhatKy();
  await bangViTri();
  await toChuc();
  await thamSo();
  await kiemTra();
  console.log('\n=== Hoan tat migration 019 ===');
  console.log('Buoc tiep theo:');
  console.log('  1. Vao /admin/van-chuyen de sua bang gia hai don vi mac dinh.');
  console.log('  2. Vao /admin/van-chuyen/shipper de them shipper (chon nhan vien co san).');
  console.log('  3. Bo nhiem chuc danh SHIPPER cho ho o /to-chuc/quan-ly de ho mo duoc /shipper.');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});

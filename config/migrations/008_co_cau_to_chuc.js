/**
 * Migration 008 - Co cau to chuc nhan su chuyen nghiep.
 *
 * VAN DE CUA HE THONG CU
 * ----------------------
 * `nhan_vien.chucvu` la mot ENUM PHANG gom 6 gia tri ('Phuc vu','Bep','Ke toan',
 * 'Quay','Thu ngan','Nhan vien chung'). Khong co cap bac, khong co duong bao cao,
 * khong phan biet Bep truong voi Phu bep - ca hai deu la 'Bep' va co quyen y het
 * nhau. Toan bo phan quyen trong server.js la so sanh chuoi:
 * `requireRole(['Bep'])`. 178 route dang dung cach nay.
 *
 * CACH GIAI QUYET
 * ---------------
 * Dung mo hinh 4 tang chuan cua nganh F&B:
 *
 *     bo_phan  (Dieu hanh, Le tan, Phuc vu, Bep, Bar, Thu ngan, Ke toan, Kho)
 *        │
 *     chuc_danh  (23 chuc danh, co cap_bac 1-6 va id_cd_cha = bao cao cho ai)
 *        │
 *     chuc_danh_quyen  ──▶  quyen  (danh muc quyen chi tiet, dang 'bep.mon.che_bien')
 *        │
 *     nhan_vien.id_cd
 *
 * Ben canh do co `to_lam_viec` + `thanh_vien_to` de mo hinh hoa TO (team) voi to
 * truong / to pho - thu ma cap bac chuc danh khong dien ta duoc, vi mot nha hang
 * co the co nhieu to phuc vu cung cap bac nhung khac khu vuc.
 *
 * TUONG THICH NGUOC - DIEM QUAN TRONG NHAT
 * ----------------------------------------
 * KHONG sua 178 route cu. Moi chuc danh co cot `vai_tro_tuong_duong` liet ke cac
 * gia tri ENUM cu ma chuc danh do duoc phep dong vai. Vi du Bep truong co
 * 'Bep', Quan ly nha hang co ca 5 vai tro. Middleware `requireRole` moi se:
 *     1. Khop chinh xac session.staffRole nhu cu  (duong cu, khong doi)
 *     2. Neu truot, kiem tra vai_tro_tuong_duong cua chuc danh moi
 * Nho vay Bep truong vao duoc moi trang cua 'Bep' ma khong phai sua route nao.
 *
 * Cot `nhan_vien.chucvu` cu VAN GIU NGUYEN va van duoc ghi dong bo - dung nguyen
 * tac "khong xoa cot cu" cua migration 001.
 *
 * Chay lai duoc nhieu lan (idempotent).
 */
const db = require('../db');

// Dung utf8/utf8_general_ci giong cac bang cu (nhan_vien, monan...). Neu dung
// utf8mb4 thi moi lenh JOIN voi bang cu se bao "Illegal mix of collations".
const DUOI_BANG = 'ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci';

// ---------------------------------------------------------------------------
// 1. DINH NGHIA BANG
// ---------------------------------------------------------------------------
const BANG_MOI = {
  /** Bo phan / phong ban. Muc to nhat cua so do to chuc. */
  bo_phan: `
    id_bp INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ma_bp VARCHAR(20) NOT NULL,
    ten_bp VARCHAR(100) NOT NULL,
    mo_ta VARCHAR(255) NULL,
    mau_sac VARCHAR(20) NOT NULL DEFAULT '#6c757d',
    icon VARCHAR(40) NOT NULL DEFAULT 'fa-users',
    thu_tu INT(11) NOT NULL DEFAULT 0,
    trang_thai TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bp_ma (ma_bp)`,

  /**
   * Chuc danh. `cap_bac` 1 (cao nhat) -> 6 (thap nhat), `id_cd_cha` la duong
   * bao cao. Hai thu nay khac nhau: cap_bac dung de so sanh tham quyen, id_cd_cha
   * dung de dung so do va dinh tuyen phe duyet.
   */
  chuc_danh: `
    id_cd INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ma_cd VARCHAR(30) NOT NULL,
    ten_cd VARCHAR(100) NOT NULL,
    ten_rut_gon VARCHAR(30) NULL,
    id_bp INT(11) NOT NULL,
    cap_bac TINYINT(2) NOT NULL DEFAULT 5,
    id_cd_cha INT(11) NULL,
    la_quan_ly TINYINT(1) NOT NULL DEFAULT 0,
    vai_tro_tuong_duong VARCHAR(255) NULL,
    chucvu_legacy VARCHAR(30) NULL,
    mo_ta TEXT NULL,
    trach_nhiem TEXT NULL,
    dinh_bien INT(11) NOT NULL DEFAULT 0,
    thu_tu INT(11) NOT NULL DEFAULT 0,
    trang_thai TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cd_ma (ma_cd),
    INDEX idx_cd_bp (id_bp),
    INDEX idx_cd_cha (id_cd_cha),
    INDEX idx_cd_cap (cap_bac)`,

  /** Danh muc quyen. Ma dang 'nhom.doi_tuong.hanh_dong'. */
  quyen: `
    id_q INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ma_q VARCHAR(60) NOT NULL,
    ten_q VARCHAR(150) NOT NULL,
    nhom_q VARCHAR(40) NOT NULL,
    mo_ta VARCHAR(255) NULL,
    la_nhay_cam TINYINT(1) NOT NULL DEFAULT 0,
    thu_tu INT(11) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_q_ma (ma_q),
    INDEX idx_q_nhom (nhom_q)`,

  /**
   * Gan quyen cho chuc danh. `duoc_cap = 0` la phu dinh tuong minh, dung khi
   * muon cat mot quyen ma chuc danh le ra duoc thua ke.
   */
  chuc_danh_quyen: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_cd INT(11) NOT NULL,
    id_q INT(11) NOT NULL,
    duoc_cap TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cdq (id_cd, id_q),
    INDEX idx_cdq_cd (id_cd)`,

  /**
   * Quyen cap rieng cho MOT nhan vien, de len tren quyen cua chuc danh. Dung cho
   * truong hop dac thu: mot phuc vu duoc tin tuong giao them quyen huy don.
   */
  quyen_nhan_vien: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_nv INT(11) NOT NULL,
    id_q INT(11) NOT NULL,
    duoc_cap TINYINT(1) NOT NULL DEFAULT 1,
    ly_do VARCHAR(255) NULL,
    nguoi_cap INT(11) NULL,
    het_han DATETIME NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_qnv (id_nv, id_q),
    INDEX idx_qnv_nv (id_nv)`,

  /** To lam viec - nhom nguoi cung ca / cung khu vuc, co to truong. */
  to_lam_viec: `
    id_to INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ma_to VARCHAR(30) NOT NULL,
    ten_to VARCHAR(100) NOT NULL,
    id_bp INT(11) NOT NULL,
    id_to_truong INT(11) NULL,
    khu_vuc VARCHAR(100) NULL,
    ca_lam VARCHAR(30) NULL,
    mo_ta VARCHAR(255) NULL,
    trang_thai TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_to_ma (ma_to),
    INDEX idx_to_bp (id_bp)`,

  thanh_vien_to: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_to INT(11) NOT NULL,
    id_nv INT(11) NOT NULL,
    vai_tro_trong_to ENUM('to_truong','to_pho','thanh_vien') NOT NULL DEFAULT 'thanh_vien',
    tu_ngay DATE NULL,
    den_ngay DATE NULL,
    trang_thai TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tvt (id_to, id_nv),
    INDEX idx_tvt_nv (id_nv)`,

  /**
   * Uy quyen tam thoi. To truong nghi phep thi giao quyen cho to pho trong
   * khoang thoi gian xac dinh - het han la tu het hieu luc, khong can nho thu hoi.
   */
  uy_quyen: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_nv_giao INT(11) NOT NULL,
    id_nv_nhan INT(11) NOT NULL,
    id_cd_uy_quyen INT(11) NULL,
    pham_vi VARCHAR(255) NULL,
    tu_luc DATETIME NOT NULL,
    den_luc DATETIME NOT NULL,
    ly_do VARCHAR(255) NULL,
    trang_thai ENUM('hieu_luc','da_thu_hoi','het_han') NOT NULL DEFAULT 'hieu_luc',
    nguoi_duyet INT(11) NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_uq_nhan (id_nv_nhan, trang_thai),
    INDEX idx_uq_giao (id_nv_giao)`,

  /** Nhat ky moi thay doi ve to chuc: bo nhiem, doi quyen, chuyen bo phan. */
  nhat_ky_to_chuc: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    hanh_dong VARCHAR(50) NOT NULL,
    id_nv_muc_tieu INT(11) NULL,
    id_cd_cu INT(11) NULL,
    id_cd_moi INT(11) NULL,
    chi_tiet TEXT NULL,
    nguoi_thuc_hien VARCHAR(100) NULL,
    id_nguoi_thuc_hien INT(11) NULL,
    dia_chi_ip VARCHAR(45) NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nktc_nv (id_nv_muc_tieu),
    INDEX idx_nktc_luc (tao_luc)`,

  /**
   * Hien dien thoi gian thuc. Mot nhan vien co the mo nhieu tab / nhieu may nen
   * dem `so_ket_noi` thay vi co online true/false - dong tab nay khong lam nguoi
   * do bien mat khi tab kia con mo.
   */
  hien_dien_nv: `
    id_nv INT(11) NOT NULL PRIMARY KEY,
    trang_thai ENUM('online','ban','vang','offline') NOT NULL DEFAULT 'offline',
    so_ket_noi INT(11) NOT NULL DEFAULT 0,
    trang_hien_tai VARCHAR(150) NULL,
    thiet_bi VARCHAR(100) NULL,
    online_luc DATETIME NULL,
    hoat_dong_cuoi DATETIME NULL,
    cap_nhat_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hd_trang_thai (trang_thai)`,

  /**
   * Viec can nguoi cap tren xu ly: bao het mon, xin huy don, xin giam gia,
   * su co. Day la xuong song cua luong "escalation" theo cap bac.
   */
  viec_can_xu_ly: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    loai VARCHAR(40) NOT NULL,
    tieu_de VARCHAR(200) NOT NULL,
    noi_dung TEXT NULL,
    muc_do ENUM('thap','binh_thuong','cao','khan') NOT NULL DEFAULT 'binh_thuong',
    id_nv_tao INT(11) NULL,
    id_bp_xu_ly INT(11) NULL,
    cap_bac_toi_thieu TINYINT(2) NOT NULL DEFAULT 4,
    id_nv_xu_ly INT(11) NULL,
    trang_thai ENUM('cho','dang_xu_ly','xong','tu_choi') NOT NULL DEFAULT 'cho',
    tham_chieu VARCHAR(60) NULL,
    ket_qua TEXT NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    xu_ly_luc DATETIME NULL,
    INDEX idx_vcxl_tt (trang_thai, muc_do),
    INDEX idx_vcxl_bp (id_bp_xu_ly)`,
};

// Cot bo sung cho bang nhan_vien cu.
const COT_NHAN_VIEN = {
  ma_nv: "VARCHAR(20) NULL AFTER id_nv",
  id_cd: "INT(11) NULL AFTER chucvu",
  id_bp: "INT(11) NULL AFTER id_cd",
  id_quan_ly: "INT(11) NULL AFTER id_bp",
  ngay_bo_nhiem: "DATE NULL AFTER id_quan_ly",
  trang_thai_lam_viec: "ENUM('dang_lam','nghi_phep','tam_nghi','da_nghi_viec') NOT NULL DEFAULT 'dang_lam' AFTER trangthai",
};

// ---------------------------------------------------------------------------
// 2. DU LIEU GOC
// ---------------------------------------------------------------------------
const BO_PHAN = [
  ['DH',  'Điều hành',        'Ban quản lý nhà hàng, chịu trách nhiệm toàn bộ hoạt động', '#5a3e36', 'fa-crown',        1],
  ['LT',  'Lễ tân',           'Đón khách, xếp bàn, nhận đặt chỗ',                          '#0d6efd', 'fa-concierge-bell', 2],
  ['PV',  'Phục vụ',          'Phục vụ tại bàn, ghi món, chăm sóc khách trong bữa ăn',      '#198754', 'fa-utensils',     3],
  ['BEP', 'Bếp',              'Chế biến món ăn, kiểm soát chất lượng và an toàn thực phẩm', '#dc3545', 'fa-fire',         4],
  ['BAR', 'Bar - Pha chế',    'Pha chế đồ uống, cocktail, cà phê',                         '#6f42c1', 'fa-cocktail',     5],
  ['TN',  'Thu ngân',         'Thu tiền, xuất hóa đơn, chốt ca quầy',                       '#fd7e14', 'fa-cash-register', 6],
  ['KT',  'Kế toán',          'Lương, thu chi, báo cáo tài chính',                          '#20c997', 'fa-calculator',   7],
  ['KHO', 'Kho - Mua hàng',   'Nhập hàng, quản lý tồn kho, làm việc với nhà cung cấp',      '#6c757d', 'fa-boxes',        8],
];

/**
 * Gia tri ghi vao cot cu `nhan_vien.chucvu` cho tung chuc danh.
 *
 * Tach rieng khoi `vai_tro_tuong_duong` vi hai cot phuc vu hai viec khac nhau -
 * xem giai thich o khoi chu thich cua CHUC_DANH ben duoi.
 */
const CHUCVU_LEGACY = {
  QLNH: 'Quan ly', TLQL: 'Quan ly', QLBEP: 'Quan ly',
  BEPTRUONG: 'Bep', BEPPHO: 'Bep', TOTRUONGBEP: 'Bep', DAUBEP: 'Bep',
  PHUBEP: 'Nhan vien chung', TAPVUBEP: 'Nhan vien chung',
  TRUONGBAR: 'Bep', NVBAR: 'Bep',
  TRUONGLT: 'Quay', NVLT: 'Quay',
  GSPV: 'Phuc vu', TOTRUONGPV: 'Phuc vu', NVPV: 'Phuc vu', PHUBAN: 'Nhan vien chung',
  GSTN: 'Thu ngan', NVTN: 'Thu ngan',
  KTTRUONG: 'Ke toan', NVKT: 'Ke toan',
  THUKHO: 'Bep', NVKHO: 'Nhan vien chung',
};

/**
 * [ma, ten, ten_rut_gon, ma_bp, cap_bac, ma_cd_cha, la_quan_ly, vai_tro_tuong_duong,
 *  dinh_bien, trach_nhiem]
 *
 * cap_bac: 1 Quản lý nhà hàng · 2 Trưởng bộ phận · 3 Giám sát · 4 Tổ trưởng
 *          5 Nhân viên chính thức · 6 Phụ việc / thử việc
 *
 * HAI COT TUONG THICH NGUOC, DUNG CHO HAI VIEC KHAC NHAU:
 *
 *   vai_tro_tuong_duong  cac vai tro cu ma chuc danh nay duoc phep DONG VAI.
 *                        Quyet dinh viec vao duoc route cu hay khong.
 *                        Bep truong co 'Bep' nen vao duoc moi trang cua bep.
 *
 *   chucvu_legacy        gia tri ghi vao cot `nhan_vien.chucvu` cu.
 *                        Chi de HIEN THI dung o cac man hinh cu chua nang cap.
 *
 * Vi sao tach: neu dung chung mot cot thi Quan ly nha hang se bi ghi
 * chucvu = 'Phuc vu' (phan tu dau danh sach) - dung ve quyen nhung doc thi sai
 * hoan toan o man hinh danh sach nhan vien cu.
 */
const CHUC_DANH = [
  // --- Điều hành -----------------------------------------------------------
  ['QLNH', 'Quản lý nhà hàng', 'QL nhà hàng', 'DH', 1, null, 1,
    'Phuc vu,Bep,Ke toan,Quay,Thu ngan,Nhan vien chung', 1,
    'Chịu trách nhiệm cuối cùng về doanh thu, chất lượng dịch vụ và nhân sự toàn nhà hàng. Duyệt các quyết định vượt thẩm quyền trưởng bộ phận.'],
  ['TLQL', 'Trợ lý quản lý nhà hàng', 'Trợ lý QL', 'DH', 2, 'QLNH', 1,
    'Phuc vu,Quay,Thu ngan,Nhan vien chung', 1,
    'Thay mặt quản lý điều hành ca, xử lý khiếu nại khách, tổng hợp báo cáo ca.'],

  // --- Lễ tân --------------------------------------------------------------
  ['TRUONGLT', 'Trưởng lễ tân', 'Trưởng LT', 'LT', 3, 'TLQL', 1,
    'Quay,Phuc vu,Nhan vien chung', 1,
    'Điều phối sơ đồ bàn, quản lý đặt chỗ trong ngày, phân công lễ tân theo khung giờ.'],
  ['NVLT', 'Lễ tân', 'Lễ tân', 'LT', 5, 'TRUONGLT', 0,
    'Quay,Nhan vien chung', 4,
    'Đón và tiễn khách, xác nhận đặt bàn, dẫn khách vào bàn, tiếp nhận yêu cầu ban đầu.'],

  // --- Phục vụ -------------------------------------------------------------
  ['GSPV', 'Giám sát phục vụ', 'GS phục vụ', 'PV', 3, 'TLQL', 1,
    'Phuc vu,Quay,Thu ngan,Nhan vien chung', 2,
    'Giám sát chất lượng phục vụ toàn sảnh, xử lý phàn nàn tại chỗ, duyệt giảm giá trong hạn mức.'],
  ['TOTRUONGPV', 'Tổ trưởng phục vụ', 'Tổ trưởng PV', 'PV', 4, 'GSPV', 1,
    'Phuc vu,Nhan vien chung', 4,
    'Phụ trách một khu vực bàn, chia việc trong tổ, kèm nhân viên mới, báo cáo giám sát.'],
  ['NVPV', 'Nhân viên phục vụ', 'Phục vụ', 'PV', 5, 'TOTRUONGPV', 0,
    'Phuc vu,Nhan vien chung', 12,
    'Ghi món, chuyển món ra bàn, theo dõi tiến độ bàn phụ trách, dọn bàn sau khi khách rời.'],
  ['PHUBAN', 'Phụ bàn', 'Phụ bàn', 'PV', 6, 'TOTRUONGPV', 0,
    'Nhan vien chung', 6,
    'Dọn dẹp, tiếp đồ dùng, hỗ trợ nhân viên phục vụ trong giờ cao điểm.'],

  // --- Bếp -----------------------------------------------------------------
  ['QLBEP', 'Quản lý bếp', 'QL bếp', 'BEP', 2, 'QLNH', 1,
    'Bep,Ke toan,Nhan vien chung', 1,
    'Quản lý chi phí bếp, định mức nguyên liệu, nhà cung cấp và an toàn thực phẩm. Duyệt phiếu nhập kho.'],
  ['BEPTRUONG', 'Bếp trưởng', 'Bếp trưởng', 'BEP', 2, 'QLBEP', 1,
    'Bep,Nhan vien chung', 1,
    'Chịu trách nhiệm thực đơn và chất lượng món. Quyết định báo hết món, điều phối toàn bộ khu bếp.'],
  ['BEPPHO', 'Bếp phó', 'Bếp phó', 'BEP', 3, 'BEPTRUONG', 1,
    'Bep,Nhan vien chung', 2,
    'Thay bếp trưởng điều hành ca bếp, kiểm soát tiến độ ra món và định lượng.'],
  ['TOTRUONGBEP', 'Tổ trưởng bếp', 'Tổ trưởng bếp', 'BEP', 4, 'BEPPHO', 1,
    'Bep,Nhan vien chung', 3,
    'Phụ trách một tổ chế biến (món nóng / món lạnh / nướng), chia món cho đầu bếp, kiểm món trước khi ra.'],
  ['DAUBEP', 'Đầu bếp', 'Đầu bếp', 'BEP', 5, 'TOTRUONGBEP', 0,
    'Bep,Nhan vien chung', 8,
    'Chế biến món theo đúng công thức và định lượng, cập nhật trạng thái món trên màn hình bếp.'],
  ['PHUBEP', 'Phụ bếp', 'Phụ bếp', 'BEP', 6, 'TOTRUONGBEP', 0,
    'Nhan vien chung', 6,
    'Sơ chế nguyên liệu, chuẩn bị nguyên liệu đầu ca, hỗ trợ đầu bếp.'],
  ['TAPVUBEP', 'Tạp vụ bếp', 'Tạp vụ bếp', 'BEP', 6, 'TOTRUONGBEP', 0,
    'Nhan vien chung', 3,
    'Vệ sinh dụng cụ, khu bếp, đảm bảo tiêu chuẩn an toàn thực phẩm.'],

  // --- Bar -----------------------------------------------------------------
  ['TRUONGBAR', 'Trưởng bar', 'Trưởng bar', 'BAR', 3, 'TLQL', 1,
    'Bep,Quay,Nhan vien chung', 1,
    'Quản lý công thức đồ uống, tồn kho quầy bar, phân ca nhân viên pha chế.'],
  ['NVBAR', 'Nhân viên pha chế', 'Pha chế', 'BAR', 5, 'TRUONGBAR', 0,
    'Bep,Nhan vien chung', 3,
    'Pha chế đồ uống theo đơn, cập nhật trạng thái đồ uống trên màn hình bếp.'],

  // --- Thu ngân ------------------------------------------------------------
  ['GSTN', 'Giám sát thu ngân', 'GS thu ngân', 'TN', 3, 'TLQL', 1,
    'Thu ngan,Quay,Ke toan,Nhan vien chung', 1,
    'Kiểm soát tiền mặt, duyệt hủy hóa đơn, đối chiếu chốt ca của các quầy.'],
  ['NVTN', 'Thu ngân', 'Thu ngân', 'TN', 5, 'GSTN', 0,
    'Thu ngan,Quay,Nhan vien chung', 4,
    'Thu tiền, in hóa đơn, áp mã giảm giá hợp lệ, chốt ca quầy cuối ngày.'],

  // --- Kế toán -------------------------------------------------------------
  ['KTTRUONG', 'Kế toán trưởng', 'KT trưởng', 'KT', 2, 'QLNH', 1,
    'Ke toan,Thu ngan,Nhan vien chung', 1,
    'Lập bảng lương, kiểm soát thu chi, báo cáo tài chính trình quản lý nhà hàng duyệt.'],
  ['NVKT', 'Kế toán viên', 'Kế toán', 'KT', 5, 'KTTRUONG', 0,
    'Ke toan,Nhan vien chung', 2,
    'Nhập liệu thu chi, theo dõi công nợ, chuẩn bị số liệu cho kế toán trưởng.'],

  // --- Kho -----------------------------------------------------------------
  ['THUKHO', 'Thủ kho', 'Thủ kho', 'KHO', 4, 'QLBEP', 1,
    'Bep,Ke toan,Nhan vien chung', 1,
    'Nhập xuất kho theo lô, kiểm kê định kỳ, cảnh báo hạn sử dụng và tồn tối thiểu.'],
  ['NVKHO', 'Nhân viên kho', 'NV kho', 'KHO', 5, 'THUKHO', 0,
    'Nhan vien chung', 2,
    'Nhận hàng, sắp xếp kho, hỗ trợ kiểm kê.'],
];

/** [ma_quyen, ten, nhom, la_nhay_cam] */
const QUYEN = [
  // Đơn hàng & đặt bàn
  ['donhang.xem',            'Xem danh sách đơn / đặt bàn',        'Đơn hàng', 0],
  ['donhang.tao',            'Tạo đơn / đặt bàn hộ khách',         'Đơn hàng', 0],
  ['donhang.sua',            'Sửa đơn đã tạo',                     'Đơn hàng', 0],
  ['donhang.xac_nhan',       'Xác nhận đơn đặt trước',             'Đơn hàng', 0],
  ['donhang.huy',            'Hủy đơn',                            'Đơn hàng', 1],
  ['donhang.thanh_toan',     'Thanh toán đơn',                     'Đơn hàng', 1],
  ['donhang.giam_gia',       'Áp giảm giá thủ công',               'Đơn hàng', 1],
  ['donhang.in_hoa_don',     'In hóa đơn',                         'Đơn hàng', 0],

  // Bếp
  ['bep.kds.xem',            'Xem màn hình bếp (KDS)',             'Bếp', 0],
  ['bep.mon.che_bien',       'Đổi trạng thái chế biến món',        'Bếp', 0],
  ['bep.mon.uu_tien',        'Đẩy món lên ưu tiên',                'Bếp', 0],
  ['bep.mon.bao_het',        'Báo hết món / mở bán lại',           'Bếp', 1],
  ['bep.cong_thuc.xem',      'Xem công thức - định lượng',         'Bếp', 0],
  ['bep.cong_thuc.sua',      'Sửa công thức - định lượng',         'Bếp', 1],
  ['bep.thiet_bi.quan_ly',   'Quản lý thiết bị bếp',               'Bếp', 0],

  // Bàn & khu vực
  ['ban.xem',                'Xem sơ đồ bàn',                      'Bàn', 0],
  ['ban.doi_trang_thai',     'Đổi trạng thái bàn',                 'Bàn', 0],
  ['ban.sap_xep',            'Sắp xếp lại sơ đồ bàn',              'Bàn', 1],
  ['ban.qr.quan_ly',         'Tạo / xóa mã QR bàn',                'Bàn', 0],

  // Thực đơn
  ['menu.xem',               'Xem thực đơn quản trị',              'Thực đơn', 0],
  ['menu.them',              'Thêm món / combo',                   'Thực đơn', 0],
  ['menu.sua',               'Sửa món / combo',                    'Thực đơn', 0],
  ['menu.xoa',               'Xóa món / combo',                    'Thực đơn', 1],
  ['menu.doi_gia',           'Đổi giá bán',                        'Thực đơn', 1],

  // Kho
  ['kho.xem',                'Xem tồn kho',                        'Kho', 0],
  ['kho.nhap',               'Lập phiếu nhập kho',                 'Kho', 0],
  ['kho.nhap.duyet',         'Duyệt phiếu nhập kho',               'Kho', 1],
  ['kho.xuat',               'Xuất kho thủ công',                  'Kho', 1],
  ['kho.kiem_ke',            'Kiểm kê kho',                        'Kho', 0],
  ['kho.nguyen_lieu.quan_ly','Thêm / sửa nguyên liệu',             'Kho', 0],

  // Nhân sự
  ['nhansu.xem',             'Xem danh sách nhân sự',              'Nhân sự', 0],
  ['nhansu.them',            'Thêm nhân viên',                     'Nhân sự', 1],
  ['nhansu.sua',             'Sửa hồ sơ nhân viên',                'Nhân sự', 1],
  ['nhansu.xoa',             'Xóa / cho nghỉ việc',                'Nhân sự', 1],
  ['nhansu.phan_ca',         'Phân ca - xếp lịch làm việc',        'Nhân sự', 0],
  ['nhansu.duyet_ca',        'Duyệt đăng ký ca',                   'Nhân sự', 0],
  ['nhansu.nghi_phep.duyet', 'Duyệt đơn nghỉ phép',                'Nhân sự', 1],
  ['nhansu.cham_cong.xem',   'Xem bảng chấm công cả bộ phận',      'Nhân sự', 0],
  ['nhansu.cham_cong.sua',   'Sửa dữ liệu chấm công',              'Nhân sự', 1],

  // Lương
  ['luong.xem',              'Xem bảng lương',                     'Lương', 1],
  ['luong.lap',              'Lập bảng lương',                     'Lương', 1],
  ['luong.duyet',            'Duyệt bảng lương',                   'Lương', 1],
  ['luong.chi',              'Xác nhận đã chi lương',              'Lương', 1],

  // Tổ chức
  ['to_chuc.xem',            'Xem sơ đồ tổ chức',                  'Tổ chức', 0],
  ['to_chuc.chuc_danh',      'Thêm / sửa chức danh',               'Tổ chức', 1],
  ['to_chuc.phan_quyen',     'Cấp - thu hồi quyền',                'Tổ chức', 1],
  ['to_chuc.bo_nhiem',       'Bổ nhiệm - điều chuyển nhân sự',     'Tổ chức', 1],
  ['to_chuc.uy_quyen',       'Ủy quyền tạm thời',                  'Tổ chức', 1],
  ['to_chuc.to.quan_ly',     'Quản lý tổ làm việc',                'Tổ chức', 0],

  // Điều hành ca
  ['dieu_hanh.bang_dieu_khien','Xem bảng điều hành thời gian thực','Điều hành', 0],
  ['dieu_hanh.viec.tao',     'Tạo việc cần xử lý',                 'Điều hành', 0],
  ['dieu_hanh.viec.xu_ly',   'Nhận và xử lý việc được báo lên',    'Điều hành', 0],
  ['dieu_hanh.thong_bao.gui','Gửi thông báo cho bộ phận',          'Điều hành', 0],
  ['dieu_hanh.chot_ca',      'Chốt ca',                            'Điều hành', 0],
  ['dieu_hanh.chot_ca.duyet','Duyệt chốt ca',                      'Điều hành', 1],

  // Khách hàng
  ['khach_hang.xem',         'Xem danh sách khách hàng',           'Khách hàng', 0],
  ['khach_hang.sua',         'Thêm / sửa khách hàng',              'Khách hàng', 0],
  ['khach_hang.chat',        'Trả lời tin nhắn khách',             'Khách hàng', 0],
  ['khach_hang.email',       'Gửi email cho khách',                'Khách hàng', 0],

  // Báo cáo
  ['bao_cao.doanh_thu',      'Báo cáo doanh thu',                  'Báo cáo', 1],
  ['bao_cao.van_hanh',       'Báo cáo vận hành',                   'Báo cáo', 0],
  ['bao_cao.nhan_su',        'Báo cáo nhân sự',                    'Báo cáo', 1],
  ['bao_cao.ai_ml',          'Xem dự báo AI / ML',                 'Báo cáo', 0],

  // Hệ thống
  ['he_thong.cau_hinh',      'Sửa cấu hình hệ thống',              'Hệ thống', 1],
  ['he_thong.audit',         'Xem nhật ký kiểm toán',              'Hệ thống', 1],
];

/**
 * Ma quyen cho tung chuc danh. Dung tien to '*' de lay ca nhom:
 *   'donhang.*' = tat ca quyen bat dau bang 'donhang.'
 */
const PHAN_QUYEN = {
  QLNH: ['*'],

  TLQL: ['donhang.*', 'bep.kds.xem', 'ban.*', 'menu.xem', 'kho.xem',
    'nhansu.xem', 'nhansu.phan_ca', 'nhansu.duyet_ca', 'nhansu.nghi_phep.duyet',
    'nhansu.cham_cong.xem', 'to_chuc.xem', 'to_chuc.uy_quyen', 'to_chuc.to.quan_ly',
    'dieu_hanh.*', 'khach_hang.*', 'bao_cao.van_hanh', 'bao_cao.doanh_thu', 'bao_cao.ai_ml'],

  // --- Lễ tân
  TRUONGLT: ['donhang.xem', 'donhang.tao', 'donhang.sua', 'donhang.xac_nhan',
    'ban.*', 'khach_hang.*', 'nhansu.xem', 'nhansu.phan_ca', 'nhansu.cham_cong.xem',
    'to_chuc.xem', 'to_chuc.to.quan_ly', 'dieu_hanh.bang_dieu_khien',
    'dieu_hanh.viec.tao', 'dieu_hanh.viec.xu_ly', 'dieu_hanh.thong_bao.gui',
    'bao_cao.van_hanh'],
  NVLT: ['donhang.xem', 'donhang.tao', 'donhang.xac_nhan', 'ban.xem',
    'ban.doi_trang_thai', 'khach_hang.xem', 'khach_hang.sua', 'khach_hang.chat',
    'to_chuc.xem', 'dieu_hanh.viec.tao'],

  // --- Phục vụ
  GSPV: ['donhang.*', 'bep.kds.xem', 'ban.*', 'menu.xem', 'khach_hang.*',
    'nhansu.xem', 'nhansu.phan_ca', 'nhansu.duyet_ca', 'nhansu.cham_cong.xem',
    'to_chuc.xem', 'to_chuc.to.quan_ly', 'to_chuc.uy_quyen',
    'dieu_hanh.*', 'bao_cao.van_hanh'],
  TOTRUONGPV: ['donhang.xem', 'donhang.tao', 'donhang.sua', 'donhang.xac_nhan',
    'donhang.in_hoa_don', 'bep.kds.xem', 'ban.xem', 'ban.doi_trang_thai',
    'menu.xem', 'khach_hang.xem', 'khach_hang.chat', 'nhansu.xem',
    'nhansu.cham_cong.xem', 'to_chuc.xem', 'to_chuc.to.quan_ly',
    'dieu_hanh.bang_dieu_khien', 'dieu_hanh.viec.tao', 'dieu_hanh.viec.xu_ly',
    'dieu_hanh.thong_bao.gui'],
  NVPV: ['donhang.xem', 'donhang.tao', 'donhang.sua', 'bep.kds.xem', 'ban.xem',
    'ban.doi_trang_thai', 'menu.xem', 'khach_hang.xem', 'khach_hang.chat',
    'to_chuc.xem', 'dieu_hanh.viec.tao'],
  PHUBAN: ['ban.xem', 'ban.doi_trang_thai', 'to_chuc.xem', 'dieu_hanh.viec.tao'],

  // --- Bếp
  QLBEP: ['bep.*', 'kho.*', 'menu.*', 'donhang.xem', 'nhansu.xem', 'nhansu.phan_ca',
    'nhansu.duyet_ca', 'nhansu.nghi_phep.duyet', 'nhansu.cham_cong.xem',
    'to_chuc.xem', 'to_chuc.to.quan_ly', 'to_chuc.uy_quyen', 'dieu_hanh.*',
    'bao_cao.van_hanh', 'bao_cao.doanh_thu', 'bao_cao.ai_ml'],
  BEPTRUONG: ['bep.*', 'menu.*', 'kho.xem', 'kho.nhap', 'kho.kiem_ke',
    'kho.nguyen_lieu.quan_ly', 'donhang.xem', 'nhansu.xem', 'nhansu.phan_ca',
    'nhansu.cham_cong.xem', 'to_chuc.xem', 'to_chuc.to.quan_ly', 'to_chuc.uy_quyen',
    'dieu_hanh.bang_dieu_khien', 'dieu_hanh.viec.tao', 'dieu_hanh.viec.xu_ly',
    'dieu_hanh.thong_bao.gui', 'dieu_hanh.chot_ca', 'bao_cao.van_hanh', 'bao_cao.ai_ml'],
  BEPPHO: ['bep.kds.xem', 'bep.mon.che_bien', 'bep.mon.uu_tien', 'bep.mon.bao_het',
    'bep.cong_thuc.xem', 'bep.thiet_bi.quan_ly', 'menu.xem', 'kho.xem', 'kho.nhap',
    'kho.kiem_ke', 'donhang.xem', 'nhansu.xem', 'nhansu.cham_cong.xem',
    'to_chuc.xem', 'to_chuc.to.quan_ly', 'dieu_hanh.bang_dieu_khien',
    'dieu_hanh.viec.tao', 'dieu_hanh.viec.xu_ly', 'dieu_hanh.thong_bao.gui',
    'dieu_hanh.chot_ca'],
  TOTRUONGBEP: ['bep.kds.xem', 'bep.mon.che_bien', 'bep.mon.uu_tien', 'bep.mon.bao_het',
    'bep.cong_thuc.xem', 'menu.xem', 'kho.xem', 'kho.kiem_ke', 'donhang.xem',
    'nhansu.xem', 'to_chuc.xem', 'to_chuc.to.quan_ly',
    'dieu_hanh.bang_dieu_khien', 'dieu_hanh.viec.tao', 'dieu_hanh.viec.xu_ly'],
  DAUBEP: ['bep.kds.xem', 'bep.mon.che_bien', 'bep.cong_thuc.xem', 'menu.xem',
    'kho.xem', 'donhang.xem', 'to_chuc.xem', 'dieu_hanh.viec.tao'],
  PHUBEP: ['bep.kds.xem', 'bep.cong_thuc.xem', 'kho.xem', 'to_chuc.xem',
    'dieu_hanh.viec.tao'],
  TAPVUBEP: ['bep.kds.xem', 'to_chuc.xem', 'dieu_hanh.viec.tao'],

  // --- Bar
  TRUONGBAR: ['bep.kds.xem', 'bep.mon.che_bien', 'bep.mon.uu_tien', 'bep.mon.bao_het',
    'bep.cong_thuc.xem', 'bep.cong_thuc.sua', 'menu.xem', 'menu.them', 'menu.sua',
    'kho.xem', 'kho.nhap', 'kho.kiem_ke', 'donhang.xem', 'nhansu.xem',
    'nhansu.phan_ca', 'nhansu.cham_cong.xem', 'to_chuc.xem', 'to_chuc.to.quan_ly',
    'dieu_hanh.bang_dieu_khien', 'dieu_hanh.viec.tao', 'dieu_hanh.viec.xu_ly',
    'dieu_hanh.chot_ca'],
  NVBAR: ['bep.kds.xem', 'bep.mon.che_bien', 'bep.cong_thuc.xem', 'menu.xem',
    'kho.xem', 'donhang.xem', 'to_chuc.xem', 'dieu_hanh.viec.tao'],

  // --- Thu ngân
  GSTN: ['donhang.*', 'ban.xem', 'menu.xem', 'khach_hang.*', 'nhansu.xem',
    'nhansu.phan_ca', 'nhansu.cham_cong.xem', 'to_chuc.xem', 'to_chuc.to.quan_ly',
    'dieu_hanh.bang_dieu_khien', 'dieu_hanh.viec.tao', 'dieu_hanh.viec.xu_ly',
    'dieu_hanh.thong_bao.gui', 'dieu_hanh.chot_ca', 'dieu_hanh.chot_ca.duyet',
    'bao_cao.doanh_thu', 'bao_cao.van_hanh'],
  NVTN: ['donhang.xem', 'donhang.sua', 'donhang.xac_nhan', 'donhang.thanh_toan',
    'donhang.in_hoa_don', 'ban.xem', 'menu.xem', 'khach_hang.xem', 'khach_hang.sua',
    'to_chuc.xem', 'dieu_hanh.viec.tao', 'dieu_hanh.chot_ca'],

  // --- Kế toán
  KTTRUONG: ['luong.*', 'bao_cao.*', 'nhansu.xem', 'nhansu.sua',
    'nhansu.cham_cong.xem', 'nhansu.cham_cong.sua', 'nhansu.nghi_phep.duyet',
    'donhang.xem', 'kho.xem', 'khach_hang.xem', 'to_chuc.xem',
    'dieu_hanh.bang_dieu_khien', 'dieu_hanh.chot_ca.duyet', 'he_thong.audit'],
  NVKT: ['luong.xem', 'luong.lap', 'bao_cao.doanh_thu', 'bao_cao.van_hanh',
    'nhansu.xem', 'nhansu.cham_cong.xem', 'donhang.xem', 'kho.xem',
    'khach_hang.xem', 'to_chuc.xem'],

  // --- Kho
  THUKHO: ['kho.*', 'bep.cong_thuc.xem', 'menu.xem', 'nhansu.xem', 'to_chuc.xem',
    'to_chuc.to.quan_ly', 'dieu_hanh.bang_dieu_khien', 'dieu_hanh.viec.tao',
    'dieu_hanh.viec.xu_ly', 'bao_cao.van_hanh', 'bao_cao.ai_ml'],
  NVKHO: ['kho.xem', 'kho.nhap', 'kho.kiem_ke', 'to_chuc.xem', 'dieu_hanh.viec.tao'],
};

/** Nhom cu -> chuc danh moi. Ap dung khi backfill lan dau. */
const ANH_XA_CU = {
  'Phuc vu': 'NVPV',
  'Bep': 'DAUBEP',
  'Ke toan': 'NVKT',
  'Thu ngan': 'NVTN',
  'Quay': 'NVLT',
  'Nhan vien chung': 'NVPV',
};

/** [ma_to, ten_to, ma_bp, ca_lam, khu_vuc] */
const TO_LAM_VIEC = [
  ['PV-A', 'Tổ phục vụ khu A (Sảnh)',  'PV',  'Ca sáng',  'Sảnh chính'],
  ['PV-B', 'Tổ phục vụ khu B (VIP)',   'PV',  'Ca chiều', 'Phòng VIP'],
  ['BEP-NONG', 'Tổ bếp nóng',          'BEP', 'Cả ngày',  'Khu bếp nóng'],
  ['BEP-LANH', 'Tổ bếp lạnh - salad',  'BEP', 'Cả ngày',  'Khu bếp lạnh'],
  ['BEP-NUONG', 'Tổ nướng - chiên',    'BEP', 'Cả ngày',  'Khu nướng'],
  ['LT-1', 'Tổ lễ tân',                'LT',  'Cả ngày',  'Quầy đón khách'],
  ['TN-1', 'Tổ thu ngân',              'TN',  'Cả ngày',  'Quầy thu ngân'],
];

// ---------------------------------------------------------------------------
// 3. TIEN ICH
// ---------------------------------------------------------------------------
async function bangTonTai(ten) {
  const [r] = await db.query(
    'SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [ten]
  );
  return r[0].n > 0;
}

async function cotTonTai(bang, cot) {
  const [r] = await db.query(
    'SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [bang, cot]
  );
  return r[0].n > 0;
}

// ---------------------------------------------------------------------------
// 4. CAC BUOC
// ---------------------------------------------------------------------------
async function taoBang() {
  console.log('\n[1/7] Tạo bảng');
  for (const [ten, dinhNghia] of Object.entries(BANG_MOI)) {
    const co = await bangTonTai(ten);
    await db.query(`CREATE TABLE IF NOT EXISTS \`${ten}\` (${dinhNghia}) ${DUOI_BANG}`);
    console.log(`   ${co ? '·' : '+'} ${ten}${co ? ' (đã có)' : ''}`);
  }
}

async function themCotNhanVien() {
  console.log('\n[2/7] Bổ sung cột cho nhan_vien');
  for (const [cot, dinhNghia] of Object.entries(COT_NHAN_VIEN)) {
    if (await cotTonTai('nhan_vien', cot)) {
      console.log(`   · ${cot} (đã có)`);
      continue;
    }
    await db.query(`ALTER TABLE nhan_vien ADD COLUMN \`${cot}\` ${dinhNghia}`);
    console.log(`   + ${cot}`);
  }
  // Chi so tra cuu theo chuc danh / quan ly truc tiep.
  const [idx] = await db.query(
    "SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'nhan_vien' AND index_name = 'idx_nv_cd'"
  );
  if (!idx[0].n) {
    await db.query('ALTER TABLE nhan_vien ADD INDEX idx_nv_cd (id_cd), ADD INDEX idx_nv_ql (id_quan_ly)');
    console.log('   + chỉ số idx_nv_cd, idx_nv_ql');
  }

  // Cot cu chua co gia tri nao cho cap quan ly. Them 'Quan ly' vao ENUM de
  // Quan ly nha hang khong bi ghi nham thanh 'Phuc vu' o cac man hinh cu.
  // Them gia tri vao cuoi ENUM khong lam doi du lieu dang co.
  const [enumHienTai] = await db.query(
    "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'nhan_vien' AND column_name = 'chucvu'"
  );
  if (enumHienTai.length && !String(enumHienTai[0].column_type).includes("'Quan ly'")) {
    await db.query(
      `ALTER TABLE nhan_vien MODIFY chucvu
       ENUM('Phuc vu','Bep','Ke toan','Quay','Thu ngan','Nhan vien chung','Quan ly')
       DEFAULT 'Nhan vien chung'`
    );
    console.log("   + giá trị 'Quan ly' vào ENUM nhan_vien.chucvu");
  } else {
    console.log("   · ENUM nhan_vien.chucvu đã có 'Quan ly'");
  }

  // Bang chuc_danh tao tu lan chay truoc co the chua co cot nay.
  if (!(await cotTonTai('chuc_danh', 'chucvu_legacy'))) {
    await db.query('ALTER TABLE chuc_danh ADD COLUMN chucvu_legacy VARCHAR(30) NULL AFTER vai_tro_tuong_duong');
    console.log('   + chuc_danh.chucvu_legacy');
  }
}

async function napBoPhan() {
  console.log('\n[3/7] Nạp bộ phận');
  for (const [ma, ten, moTa, mau, icon, thuTu] of BO_PHAN) {
    await db.query(
      `INSERT INTO bo_phan (ma_bp, ten_bp, mo_ta, mau_sac, icon, thu_tu)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE ten_bp=VALUES(ten_bp), mo_ta=VALUES(mo_ta),
         mau_sac=VALUES(mau_sac), icon=VALUES(icon), thu_tu=VALUES(thu_tu)`,
      [ma, ten, moTa, mau, icon, thuTu]
    );
  }
  console.log(`   ✓ ${BO_PHAN.length} bộ phận`);
}

async function napChucDanh() {
  console.log('\n[4/7] Nạp chức danh');
  const [bp] = await db.query('SELECT id_bp, ma_bp FROM bo_phan');
  const idBp = new Map(bp.map((b) => [b.ma_bp, b.id_bp]));

  // Vong 1: chen chuc danh, chua noi id_cd_cha (cha co the chua ton tai).
  let thuTu = 0;
  for (const [ma, ten, rutGon, maBp, cap, , laQL, vaiTro, dinhBien, trachNhiem] of CHUC_DANH) {
    await db.query(
      `INSERT INTO chuc_danh (ma_cd, ten_cd, ten_rut_gon, id_bp, cap_bac, la_quan_ly,
                              vai_tro_tuong_duong, chucvu_legacy, dinh_bien, trach_nhiem, thu_tu)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE ten_cd=VALUES(ten_cd), ten_rut_gon=VALUES(ten_rut_gon),
         id_bp=VALUES(id_bp), cap_bac=VALUES(cap_bac), la_quan_ly=VALUES(la_quan_ly),
         vai_tro_tuong_duong=VALUES(vai_tro_tuong_duong),
         chucvu_legacy=VALUES(chucvu_legacy), dinh_bien=VALUES(dinh_bien),
         trach_nhiem=VALUES(trach_nhiem), thu_tu=VALUES(thu_tu)`,
      [ma, ten, rutGon, idBp.get(maBp), cap, laQL, vaiTro,
       CHUCVU_LEGACY[ma] || 'Nhan vien chung', dinhBien, trachNhiem, thuTu++]
    );
  }

  // Vong 2: noi duong bao cao.
  const [cd] = await db.query('SELECT id_cd, ma_cd FROM chuc_danh');
  const idCd = new Map(cd.map((c) => [c.ma_cd, c.id_cd]));
  for (const [ma, , , , , maCha] of CHUC_DANH) {
    await db.query('UPDATE chuc_danh SET id_cd_cha = ? WHERE ma_cd = ?',
      [maCha ? idCd.get(maCha) || null : null, ma]);
  }
  console.log(`   ✓ ${CHUC_DANH.length} chức danh, đã nối đường báo cáo`);
  return idCd;
}

async function napQuyen(idCd) {
  console.log('\n[5/7] Nạp danh mục quyền và phân quyền');
  let thuTu = 0;
  for (const [ma, ten, nhom, nhayCam] of QUYEN) {
    await db.query(
      `INSERT INTO quyen (ma_q, ten_q, nhom_q, la_nhay_cam, thu_tu) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE ten_q=VALUES(ten_q), nhom_q=VALUES(nhom_q),
         la_nhay_cam=VALUES(la_nhay_cam), thu_tu=VALUES(thu_tu)`,
      [ma, ten, nhom, nhayCam, thuTu++]
    );
  }

  const [qs] = await db.query('SELECT id_q, ma_q FROM quyen');
  const idQ = new Map(qs.map((q) => [q.ma_q, q.id_q]));
  const tatCaMa = qs.map((q) => q.ma_q);

  /** Bung tien to '*' thanh danh sach ma quyen cu the. */
  const bung = (mau) => {
    if (mau === '*') return tatCaMa;
    if (mau.endsWith('*')) {
      const tienTo = mau.slice(0, -1);
      return tatCaMa.filter((m) => m.startsWith(tienTo));
    }
    return tatCaMa.includes(mau) ? [mau] : [];
  };

  let tong = 0;
  for (const [maCd, mauList] of Object.entries(PHAN_QUYEN)) {
    const id = idCd.get(maCd);
    if (!id) continue;
    const maQuyen = [...new Set(mauList.flatMap(bung))];
    for (const mq of maQuyen) {
      await db.query(
        `INSERT INTO chuc_danh_quyen (id_cd, id_q, duoc_cap) VALUES (?,?,1)
         ON DUPLICATE KEY UPDATE duoc_cap = 1`,
        [id, idQ.get(mq)]
      );
    }
    tong += maQuyen.length;
    console.log(`   · ${maCd.padEnd(12)} ${String(maQuyen.length).padStart(3)} quyền`);
  }
  console.log(`   ✓ ${QUYEN.length} quyền, ${tong} lượt gán`);
}

async function napTo(idCd) {
  console.log('\n[6/7] Nạp tổ làm việc');
  const [bp] = await db.query('SELECT id_bp, ma_bp FROM bo_phan');
  const idBp = new Map(bp.map((b) => [b.ma_bp, b.id_bp]));
  for (const [ma, ten, maBp, ca, khuVuc] of TO_LAM_VIEC) {
    await db.query(
      `INSERT INTO to_lam_viec (ma_to, ten_to, id_bp, ca_lam, khu_vuc) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE ten_to=VALUES(ten_to), id_bp=VALUES(id_bp),
         ca_lam=VALUES(ca_lam), khu_vuc=VALUES(khu_vuc)`,
      [ma, ten, idBp.get(maBp), ca, khuVuc]
    );
  }
  console.log(`   ✓ ${TO_LAM_VIEC.length} tổ`);
}

/**
 * Chuyen nhan vien cu sang chuc danh moi.
 *
 * Chi dat cho nguoi CHUA co id_cd - chay lai lan hai se khong ghi de ket qua
 * bo nhiem thu cong ma quan ly da lam tren giao dien.
 */
async function chuyenNhanVien(idCd) {
  console.log('\n[7/7] Chuyển nhân viên sang chức danh mới');
  const [nv] = await db.query(
    'SELECT id_nv, ten, username, chucvu, id_cd FROM nhan_vien ORDER BY id_nv'
  );

  const chuaGan = [];
  let daGan = 0;
  for (const n of nv) {
    if (n.id_cd) continue;

    const cu = (n.chucvu || '').trim();
    const maMoi = ANH_XA_CU[cu];
    if (!maMoi) {
      // chucvu rong: khong doan bua, de quan ly tu bo nhiem tren giao dien.
      chuaGan.push(n);
      continue;
    }
    const id = idCd.get(maMoi);
    const [bp] = await db.query('SELECT id_bp FROM chuc_danh WHERE id_cd = ?', [id]);
    await db.query(
      'UPDATE nhan_vien SET id_cd = ?, id_bp = ?, ngay_bo_nhiem = COALESCE(ngayvaolam, CURDATE()) WHERE id_nv = ?',
      [id, bp[0] ? bp[0].id_bp : null, n.id_nv]
    );
    daGan++;
  }

  // Ma nhan vien cho ai chua co.
  await db.query("UPDATE nhan_vien SET ma_nv = CONCAT('NV', LPAD(id_nv, 4, '0')) WHERE ma_nv IS NULL OR ma_nv = ''");

  // Noi duong bao cao: quan ly truc tiep = nguoi giu chuc danh cha, cung bo phan.
  await db.query(`
    UPDATE nhan_vien n
    JOIN chuc_danh cd   ON cd.id_cd = n.id_cd
    LEFT JOIN (
      SELECT c.id_cd_cha, MIN(x.id_nv) AS id_nv
      FROM nhan_vien x JOIN chuc_danh c ON c.id_cd = x.id_cd
      WHERE x.trangthai = 1 AND c.id_cd_cha IS NOT NULL
      GROUP BY c.id_cd_cha
    ) t ON t.id_cd_cha = cd.id_cd
    JOIN nhan_vien sep ON sep.id_cd = cd.id_cd_cha AND sep.trangthai = 1
    SET n.id_quan_ly = sep.id_nv
    WHERE n.id_quan_ly IS NULL AND n.id_nv <> sep.id_nv`);

  console.log(`   ✓ ${daGan} nhân viên đã được gán chức danh`);
  if (chuaGan.length) {
    console.log(`\n   ⚠ ${chuaGan.length} nhân viên có chucvu rỗng - CẦN BỔ NHIỆM THỦ CÔNG`);
    console.log('     (vào /to-chuc/quan-ly để gán, hệ thống không tự đoán chức danh)');
    for (const n of chuaGan) {
      console.log(`     - #${n.id_nv} ${String(n.ten).trim()} (username: ${n.username})`);
    }
  }
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Migration 008: cơ cấu tổ chức nhân sự ===');
  await taoBang();
  await themCotNhanVien();
  await napBoPhan();
  const idCd = await napChucDanh();
  await napQuyen(idCd);
  await napTo(idCd);
  await chuyenNhanVien(idCd);

  const [[tk]] = await db.query(`
    SELECT (SELECT COUNT(*) FROM bo_phan)   AS bp,
           (SELECT COUNT(*) FROM chuc_danh) AS cd,
           (SELECT COUNT(*) FROM quyen)     AS q,
           (SELECT COUNT(*) FROM chuc_danh_quyen) AS cdq,
           (SELECT COUNT(*) FROM nhan_vien WHERE id_cd IS NOT NULL) AS nv`);
  console.log('\n=== Xong ===');
  console.log(`Bộ phận ${tk.bp} · Chức danh ${tk.cd} · Quyền ${tk.q} · Lượt gán ${tk.cdq} · Nhân viên đã có chức danh ${tk.nv}`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => { console.error('Migration 008 lỗi:', e); process.exit(1); });
}

module.exports = { main, CHUC_DANH, BO_PHAN, QUYEN, PHAN_QUYEN };

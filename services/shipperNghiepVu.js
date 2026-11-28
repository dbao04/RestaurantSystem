/**
 * NGHIEP VU SHIPPER NHA HANG - cac khau bo sung quanh vong doi don giao.
 *
 * Quy trinh mot don, nhin tu phia shipper:
 *
 *   1. Nhan don (da co: phanCongGiaoService.xacNhan / tuChoi)
 *   2. Toi quay lay hang ("Dang lay hang")
 *   3. KIEM HANG: tick du tung mon + xac nhan da niem phong tui      → kiemHang()
 *      Chua kiem thi khong bam "Di giao" duoc (vanChuyenService.doiTrangThai).
 *   4. Dang giao: chi duong, goi khach (moi lan bam goi duoc ghi lai) → ghiCuocGoi()
 *   5. DA DEN NOI: bao cho khach tren trang theo doi                  → denNoi()
 *   6a. Giao xong: khach doc MA NHAN HANG 4 so (OTP) cho shipper nhap → kiemTraMaNhanHang()
 *       Khong co ma thi van chot bang GPS + ly do nhu truoc.
 *   6b. Khong giao duoc: chon ly do chuan (LY_DO_THAT_BAI). "Khach khong nghe
 *       may" chi chap nhan khi da toi noi, goi >= 2 lan va cho du so phut.
 *       Hang mang VE QUAN (hoan_hang = 'dang_mang_ve'), quay xac nhan
 *       nhan lai                                                     → nhanLaiHang()
 *   7. Bao su co bat ky luc nao (xe hong, tai nan, ket xe...)         → baoSuCo()
 *   8. CHOT CA: tong ket so don, km, phi ship, tien thu ho; khong cho tan ca
 *      khi con don dang cam, con hang chua tra ve quan, con tien chua nop → chotCa()
 *
 * Cot / bang moi duoc tu them luc chay (damBaoCauTruc) - khong bat ai phai nho
 * chay migration; config/migrations/046_shipper_nghiep_vu.js goi cung ham nay.
 */
const db = require('../config/db');

// ---------------------------------------------------------------------------
// Cau truc CSDL
// ---------------------------------------------------------------------------

const COT_MOI = [
  ['kiem_hang_luc', 'DATETIME NULL'],
  ['den_noi_luc', 'DATETIME NULL'],
  ['so_lan_goi', 'INT NOT NULL DEFAULT 0'],
  ['goi_cuoi_luc', 'DATETIME NULL'],
  ['ma_nhan_hang', 'CHAR(4) NULL'],
  ['xac_nhan_giao', 'VARCHAR(20) NULL'],
  ['ma_ly_do_that_bai', 'VARCHAR(40) NULL'],
  ['hoan_hang', 'VARCHAR(20) NULL'],
  ['hoan_hang_luc', 'DATETIME NULL'],
  ['nhan_lai_boi', 'VARCHAR(120) NULL'],
  ['su_co', 'VARCHAR(300) NULL'],
  ['su_co_luc', 'DATETIME NULL'],
  // Shipper bao thieu / sai mon khi kiem hang tai quay (baoThieuMon).
  ['thieu_mon', 'VARCHAR(500) NULL'],
  ['thieu_mon_luc', 'DATETIME NULL'],
  // Danh sach dong mon (id hopdong) luc shipper kiem hang - xuat phat thi doi chieu
  // lai, don bi them / bo mon sau khi kiem thi phai kiem lai.
  ['kiem_hang_mon', 'VARCHAR(1000) NULL'],
];

let _damBao = null;
function damBaoCauTruc() {
  if (!_damBao) {
    _damBao = (async () => {
      const [co] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_giao_hang'`);
      const daCo = new Set(co.map((r) => r.COLUMN_NAME));
      for (const [ten, kieu] of COT_MOI) {
        if (!daCo.has(ten)) await db.query(`ALTER TABLE don_giao_hang ADD COLUMN ${ten} ${kieu}`);
      }
      const [coSp] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shipper' AND COLUMN_NAME = 'ca_bat_dau'`);
      if (!coSp.length) await db.query('ALTER TABLE shipper ADD COLUMN ca_bat_dau DATETIME NULL');
      const [coKv] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shipper' AND COLUMN_NAME = 'khu_vuc'`);
      // Khu phu trach: danh sach ma khu ('GV,BT'), NULL = giao moi khu.
      if (!coKv.length) await db.query('ALTER TABLE shipper ADD COLUMN khu_vuc VARCHAR(100) NULL');
      await db.query(`
        CREATE TABLE IF NOT EXISTS ca_shipper (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_shipper INT NOT NULL,
          bat_dau DATETIME NOT NULL,
          ket_thuc DATETIME NOT NULL,
          so_don_giao INT NOT NULL DEFAULT 0,
          so_don_that_bai INT NOT NULL DEFAULT 0,
          tong_km DECIMAL(8,2) NOT NULL DEFAULT 0,
          phi_ship DECIMAL(12,2) NOT NULL DEFAULT 0,
          tien_thu_ho DECIMAL(12,2) NOT NULL DEFAULT 0,
          ghi_chu VARCHAR(300) NULL,
          INDEX idx_ca_shipper (id_shipper, ket_thuc)
        )`);
    })().catch((e) => { _damBao = null; throw e; });
  }
  return _damBao;
}

// ---------------------------------------------------------------------------
// Danh muc
// ---------------------------------------------------------------------------

/** Ly do giao that bai chuan - de thong ke va ap chinh sach dung. */
const LY_DO_THAT_BAI = {
  khach_khong_nghe: { nhan: 'Khách không nghe máy', canDenNoi: true },
  sai_dia_chi:      { nhan: 'Sai / không tìm được địa chỉ', canDenNoi: true },
  khach_tu_choi:    { nhan: 'Khách từ chối nhận hàng', canDenNoi: true },
  khach_hen_lai:    { nhan: 'Khách hẹn giao lại giờ khác', canDenNoi: false },
  su_co_xe:         { nhan: 'Sự cố xe / tai nạn trên đường', canDenNoi: false },
  hang_hong:        { nhan: 'Hàng bị đổ vỡ / hư hỏng', canDenNoi: false },
  khac:             { nhan: 'Lý do khác', canDenNoi: false, canGhiChu: true },
};

const LOAI_SU_CO = {
  xe_hong:  'Xe hỏng / thủng lốp',
  tai_nan:  'Tai nạn / va chạm',
  ket_xe:   'Kẹt xe nặng, sẽ trễ',
  thoi_tiet: 'Mưa lớn / ngập đường',
  khach_doi: 'Khách đổi địa chỉ / yêu cầu khác',
  khac:     'Sự cố khác',
};

/** Su kien ghi vao nhat_ky_giao_hang (cot den_trang_thai) ngoai cac trang thai don. */
const SU_KIEN = {
  kiem_hang:     { nhan: 'Đã kiểm đủ hàng, niêm phong túi', mau: '#6f42c1', icon: 'fa-clipboard-check' },
  den_noi:       { nhan: 'Shipper đã đến nơi giao', mau: '#20c997', icon: 'fa-location-dot' },
  goi_khach:     { nhan: 'Shipper gọi cho khách', mau: '#6c757d', icon: 'fa-phone', noiBo: true },
  su_co:         { nhan: 'Báo sự cố', mau: '#dc3545', icon: 'fa-triangle-exclamation', noiBo: true },
  nhan_lai_hang: { nhan: 'Quầy đã nhận lại hàng hoàn', mau: '#0d6efd', icon: 'fa-box', noiBo: true },
  thieu_mon:     { nhan: 'Nhà hàng đang làm bù món còn thiếu', mau: '#fd7e14', icon: 'fa-utensils' },
  bo_mon:        { nhan: 'Món đã hết - bỏ khỏi đơn và hoàn điểm cho khách', mau: '#dc3545', icon: 'fa-ban' },
};

async function thamSo() {
  const [rows] = await db.query(
    "SELECT khoa, gia_tri FROM cau_hinh WHERE khoa IN ('giao_hang.phut_cho_khach','giao_hang.so_lan_goi_toi_thieu')")
    .catch(() => [[]]);
  const m = Object.fromEntries(rows.map((r) => [r.khoa, Number(r.gia_tri)]));
  return {
    phutChoKhach: m['giao_hang.phut_cho_khach'] > 0 ? m['giao_hang.phut_cho_khach'] : 5,
    soLanGoiToiThieu: m['giao_hang.so_lan_goi_toi_thieu'] > 0 ? m['giao_hang.so_lan_goi_toi_thieu'] : 2,
  };
}

// ---------------------------------------------------------------------------
// Tien ich
// ---------------------------------------------------------------------------

function loi(thongBao, ma = null) {
  const e = new Error(thongBao);
  if (ma) e.ma = ma;
  return e;
}

async function layDonCuaShipper(idGiao, idShipper) {
  await damBaoCauTruc();
  const [[d]] = await db.query('SELECT * FROM don_giao_hang WHERE id_giao = ? LIMIT 1', [idGiao]);
  if (!d) throw loi('Không tìm thấy đơn giao hàng.');
  if (idShipper && Number(d.id_shipper) !== Number(idShipper)) throw loi('Đơn này không phải của bạn.');
  return d;
}

async function ghiSuKien(idGiao, trangThai, suKien, nguoi = {}, ghiChu = null, viDo = null, kinhDo = null) {
  await db.query(
    `INSERT INTO nhat_ky_giao_hang (id_giao, tu_trang_thai, den_trang_thai, id_nv, ten_nguoi, ghi_chu, vi_do, kinh_do)
     VALUES (?,?,?,?,?,?,?,?)`,
    [idGiao, trangThai, suKien, nguoi.id_nv || null, nguoi.ten || null,
      ghiChu ? String(ghiChu).slice(0, 300) : null, viDo ?? null, kinhDo ?? null]);
}

/** Ma 4 so cho khach doc khi nhan hang. Sinh mot lan, giu nguyen ve sau. */
async function layMaNhanHang(idGiao) {
  await damBaoCauTruc();
  const ma = String(Math.floor(1000 + Math.random() * 9000));
  await db.query('UPDATE don_giao_hang SET ma_nhan_hang = ? WHERE id_giao = ? AND ma_nhan_hang IS NULL', [ma, idGiao]);
  const [[d]] = await db.query('SELECT ma_nhan_hang FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  return d ? d.ma_nhan_hang : null;
}

// ---------------------------------------------------------------------------
// Cac khau
// ---------------------------------------------------------------------------

/**
 * Kiem hang tai quay. `monIds` la cac dong hopdong shipper da tick; phai du
 * MOI mon cua don. `niemPhong` = da dan niem phong / buoc tui.
 */
/** "Dau van" danh sach mon: id cac dong con so luong, sap xep - de biet don co doi mon sau khi kiem. */
function dauVanMon(dong) {
  return dong.map((m) => Number(m.id)).sort((a, b) => a - b).join(',').slice(0, 1000);
}

async function kiemHang(idGiao, idShipper, { monIds = [], niemPhong = false } = {}, nguoi = {}) {
  const d = await layDonCuaShipper(idGiao, idShipper);
  if (d.trang_thai !== 'dang_lay') throw loi('Chỉ kiểm hàng khi đang ở quầy lấy hàng.');
  // RANG BUOC: bep phai lam xong HET mon (trangthai_bep >= 2) thi shipper moi duoc
  // nhan hang. Truoc day tick + "Xac nhan du hang" duoc ca khi mon con dang nau.
  const [chuaXong] = await db.query(
    'SELECT name_mon, soluong FROM hopdong WHERE sesis = ? AND id_mon > 0 AND soluong > 0 AND trangthai_bep < 2', [d.sesis]);
  if (chuaXong.length) {
    const ds = chuaXong.slice(0, 4).map((m) => `${String(m.name_mon).trim()} x${m.soluong}`).join(', ');
    throw loi(`Bếp chưa làm xong: ${ds}${chuaXong.length > 4 ? '…' : ''}. Chờ bếp báo xong hết món rồi mới nhận hàng.`);
  }
  const [mon] = await db.query(
    'SELECT id FROM hopdong WHERE sesis = ? AND soluong > 0', [d.sesis]);
  const daTick = new Set((Array.isArray(monIds) ? monIds : []).map(Number));
  const thieu = mon.filter((m) => !daTick.has(Number(m.id)));
  if (thieu.length) throw loi(`Còn ${thieu.length} món chưa kiểm. Đối chiếu đủ từng món với phiếu rồi tick lại.`);
  if (!niemPhong) throw loi('Hãy niêm phong / buộc kín túi hàng rồi tick xác nhận.');
  await db.query(
    `UPDATE don_giao_hang SET kiem_hang_luc = NOW(), kiem_hang_mon = ?, thieu_mon = NULL, thieu_mon_luc = NULL,
            su_co = IF(su_co LIKE ?, NULL, su_co), su_co_luc = IF(su_co IS NULL, NULL, su_co_luc)
      WHERE id_giao = ?`, [dauVanMon(mon), `${TIEN_TO_THIEU}%`, idGiao]);
  await ghiSuKien(idGiao, d.trang_thai, 'kiem_hang', nguoi, `Đã kiểm ${mon.length} món, túi đã niêm phong`);
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * THIEU / SAI MON khi kiem hang tai quay.
 *
 * Truoc day shipper chi chon duoc "Su co khac" va go tay: bep / quay khong
 * duoc bao, don dung im o buoc 2. Gio:
 *   1. Shipper danh dau mon thieu / sai (+ ghi chu) -> baoThieuMon:
 *      - mon do quay lai hang cho cua BEP (trangthai_bep = 0) kem ghi chu
 *        "[LAM BU] ..." de bep biet la mon lam lai cho don giao;
 *      - don gan co thieu_mon + su_co (dieu phoi thay), bo dau "da kiem hang",
 *        du kien giao lui them PHUT_BU phut;
 *      - bao bep + quan ly bep + dieu phoi + thu ngan.
 *   2. Bep lam xong -> shipper tick lai -> kiemHang go co.
 *   3. Mon HET han, khong lam duoc -> quay / dieu phoi boMonThieu: bo mon khoi
 *      don + hoan diem dung gia mon (loi nha hang, ly do het_mon).
 * ------------------------------------------------------------------------- */
const TIEN_TO_THIEU = 'Thiếu/sai món';
const TIEN_TO_BU = '[LÀM BÙ]';
const PHUT_BU = 15;

async function baoThieuMon(idGiao, idShipper, { monIds = [], loai = 'thieu', ghiChu = '' } = {}, nguoi = {}) {
  const d = await layDonCuaShipper(idGiao, idShipper);
  if (d.trang_thai !== 'dang_lay') throw loi('Chỉ báo thiếu / sai món khi đang ở quầy lấy hàng.');
  const ids = [...new Set((Array.isArray(monIds) ? monIds : [monIds]).map(Number).filter((x) => x > 0))];
  if (!ids.length) throw loi('Chọn ít nhất một món bị thiếu hoặc sai.');
  const [mon] = await db.query(
    'SELECT id, name_mon, soluong, ghi_chu_mon FROM hopdong WHERE sesis = ? AND soluong > 0 AND id IN (?)', [d.sesis, ids]);
  if (mon.length !== ids.length) throw loi('Có món không thuộc đơn này - tải lại trang rồi chọn lại.');
  const [[bep]] = await db.query(
    "SELECT GROUP_CONCAT(name_mon SEPARATOR ', ') AS ds FROM hopdong WHERE id IN (?) AND trangthai_bep < 2", [ids]);
  if (bep && bep.ds) throw loi(`Bếp chưa làm xong ${String(bep.ds).trim()} - chờ bếp báo xong, chưa phải thiếu món.`);

  const kieu = loai === 'sai' ? 'sai món' : 'thiếu';
  const ghi = String(ghiChu || '').trim().slice(0, 150);
  const ghiBep = `${TIEN_TO_BU} Shipper báo ${kieu}${ghi ? ': ' + ghi : ''}`;
  const dsTen = mon.map((m) => `${m.name_mon} x${m.soluong}`).join(', ');
  const noiDung = `${TIEN_TO_THIEU} (${kieu}): ${dsTen}${ghi ? ' - ' + ghi : ''}`.slice(0, 500);

  // Mon quay lai bep. Ghi chu cu cua khach (it cay...) van giu, chen "[LAM BU]" len dau.
  for (const m of mon) {
    const cu = String(m.ghi_chu_mon || '').replace(/^\[LÀM BÙ\][^|]*\|\s*/, '');
    await db.query('UPDATE hopdong SET trangthai_bep = 0, ghi_chu_mon = ? WHERE id = ?',
      [(ghiBep + (cu ? ' | ' + cu : '')).slice(0, 255), m.id]);
  }
  await db.query(
    `UPDATE don_giao_hang
        SET thieu_mon = ?, thieu_mon_luc = NOW(), kiem_hang_luc = NULL,
            su_co = ?, su_co_luc = NOW(),
            du_kien_luc = GREATEST(COALESCE(du_kien_luc, NOW()), NOW()) + INTERVAL ? MINUTE
      WHERE id_giao = ?`, [noiDung, noiDung.slice(0, 300), PHUT_BU, idGiao]);
  await ghiSuKien(idGiao, d.trang_thai, 'thieu_mon', nguoi, noiDung);

  try {
    await require('./thongBaoService').gui('don_giao_thieu_mon', {
      tieuDe: `Đơn giao ${d.ma_giao}: shipper báo ${kieu} món - làm bù gấp`,
      noiDung: `${dsTen}${ghi ? ' · ' + ghi : ''}. Shipper đang chờ ở quầy.`,
      link: `/staff/giao-hang/${idGiao}`, nguoiGui: nguoi.ten || 'Shipper',
    });
  } catch (e) { console.error('[thieu-mon] thong bao:', e.message); }
  return { ok: true, ma_giao: d.ma_giao, mon: mon.map((m) => m.id), noi_dung: noiDung };
}

/**
 * Mon het han (khong lam bu duoc): bo khoi don + hoan diem dung gia dong mon.
 * Chi bo duoc mon cua don CHUA roi nha hang.
 */
async function boMonThieu(idGiao, idDong, nguoi = {}) {
  await damBaoCauTruc();
  const [[d]] = await db.query('SELECT * FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  if (!d) throw loi('Không tìm thấy đơn giao hàng.');
  if (!['cho_phan', 'da_phan', 'dang_lay'].includes(d.trang_thai)) {
    throw loi('Đơn đã rời nhà hàng hoặc đã kết thúc - không bỏ món được nữa.');
  }
  const [[m]] = await db.query('SELECT id, name_mon, soluong, thanhtien FROM hopdong WHERE id = ? AND sesis = ? AND soluong > 0', [idDong, d.sesis]);
  if (!m) throw loi('Món không thuộc đơn này hoặc đã bỏ rồi.');
  const [[con]] = await db.query('SELECT COUNT(*) AS n FROM hopdong WHERE sesis = ? AND id_mon > 0 AND soluong > 0 AND id <> ?', [d.sesis, idDong]);
  if (!Number(con.n)) throw loi('Đây là món cuối cùng của đơn - hãy HỦY ĐƠN (lý do "Nhà hàng hết món") thay vì bỏ món.');

  const tien = Math.round(Number(m.thanhtien) || 0);
  let soDiem = 0;
  if (tien > 0) {
    const kq = await require('./chinhSachGiaoService').hoanDiemMotPhan(idGiao, {
      so_tien: tien, ma_ly_do: 'het_mon', ghi_chu: `Bỏ món ${m.name_mon} x${m.soluong}`, nguoi,
    });
    soDiem = kq.so_diem;
  }
  await db.query(
    `UPDATE hopdong SET soluong = 0, thanhtien = 0,
            ghi_chu_mon = LEFT(CONCAT('[ĐÃ BỎ - hết món, hoàn điểm] ', COALESCE(ghi_chu_mon, '')), 255)
      WHERE id = ?`, [idDong]);
  await db.query('UPDATE don_giao_hang SET kiem_hang_luc = NULL, kiem_hang_mon = NULL WHERE id_giao = ?', [idGiao]);
  await ghiSuKien(idGiao, d.trang_thai, 'bo_mon', nguoi, `Bỏ ${m.name_mon} x${m.soluong} (hết món) - hoàn ${soDiem} điểm`);

  // Het mon con thieu -> go co thieu mon.
  const [[conBu]] = await db.query(
    "SELECT COUNT(*) AS n FROM hopdong WHERE sesis = ? AND soluong > 0 AND ghi_chu_mon LIKE ? AND trangthai_bep < 2",
    [d.sesis, `${TIEN_TO_BU}%`]);
  if (!Number(conBu.n)) {
    await db.query(
      `UPDATE don_giao_hang SET thieu_mon = NULL, thieu_mon_luc = NULL,
              su_co = IF(su_co LIKE ?, NULL, su_co) WHERE id_giao = ?`, [`${TIEN_TO_THIEU}%`, idGiao]);
  }
  return { ok: true, ten_mon: m.name_mon, so_tien: tien, so_diem: soDiem, ma_giao: d.ma_giao };
}

/** Shipper ghi nhan da den diem giao. */
async function denNoi(idGiao, idShipper, { vi_do = null, kinh_do = null } = {}, nguoi = {}) {
  const d = await layDonCuaShipper(idGiao, idShipper);
  if (d.trang_thai !== 'dang_giao') throw loi('Chỉ báo đã đến nơi khi đơn đang giao.');
  if (d.den_noi_luc) return { ok: true, den_noi_luc: d.den_noi_luc };
  let ghiChu = null;
  if (vi_do != null && kinh_do != null && d.vi_do != null) {
    const km = require('./vanChuyenService').khoangCachKm(Number(vi_do), Number(kinh_do), Number(d.vi_do), Number(d.kinh_do));
    ghiChu = `Cách điểm giao khoảng ${Math.round(km * 1000)}m`;
  }
  await db.query('UPDATE don_giao_hang SET den_noi_luc = NOW() WHERE id_giao = ? AND den_noi_luc IS NULL', [idGiao]);
  await ghiSuKien(idGiao, d.trang_thai, 'den_noi', nguoi, ghiChu, vi_do, kinh_do);
  return { ok: true };
}

/** Moi lan bam "Goi khach" - bang chung da lien lac truoc khi bao khong nghe may. */
async function ghiCuocGoi(idGiao, idShipper, nguoi = {}) {
  const d = await layDonCuaShipper(idGiao, idShipper);
  if (!['dang_lay', 'dang_giao'].includes(d.trang_thai)) return { ok: true, so_lan_goi: d.so_lan_goi };
  await db.query('UPDATE don_giao_hang SET so_lan_goi = so_lan_goi + 1, goi_cuoi_luc = NOW() WHERE id_giao = ?', [idGiao]);
  await ghiSuKien(idGiao, d.trang_thai, 'goi_khach', nguoi, `Lần gọi thứ ${Number(d.so_lan_goi || 0) + 1}`);
  return { ok: true, so_lan_goi: Number(d.so_lan_goi || 0) + 1 };
}

/**
 * Kiem tra dieu kien bao "khong giao duoc" cua SHIPPER. Tra ve chuoi ly do day
 * du de luu. Dieu phoi khong di qua day (ho xu ly don cua nguoi da tat may).
 */
async function kiemTraThatBai(d, maLyDo, ghiChu) {
  const ld = LY_DO_THAT_BAI[maLyDo];
  if (!ld) throw loi('Hãy chọn lý do không giao được.');
  const note = String(ghiChu || '').trim();
  if (ld.canGhiChu && note.length < 5) throw loi('Lý do khác: hãy ghi rõ (ít nhất 5 ký tự).');
  if (ld.canDenNoi && !d.den_noi_luc) throw loi(`"${ld.nhan}" chỉ báo được khi bạn đã đến nơi - bấm "Đã đến nơi" trước.`);
  if (maLyDo === 'khach_khong_nghe') {
    const ts = await thamSo();
    if (Number(d.so_lan_goi || 0) < ts.soLanGoiToiThieu) {
      throw loi(`Hãy gọi khách ít nhất ${ts.soLanGoiToiThieu} lần bằng nút "Gọi khách" (mới gọi ${Number(d.so_lan_goi || 0)} lần).`);
    }
    const [[t]] = await db.query('SELECT TIMESTAMPDIFF(SECOND, ?, NOW()) AS giay', [d.den_noi_luc]);
    const con = ts.phutChoKhach * 60 - Number(t.giay || 0);
    if (con > 0) throw loi(`Chờ khách thêm ${Math.ceil(con / 60)} phút nữa (quy định chờ ${ts.phutChoKhach} phút kể từ lúc đến nơi).`, 'CHUA_DU_GIO_CHO');
  }
  return ld.nhan + (note ? ' - ' + note : '');
}

/** Quay xac nhan da nhan lai hang hoan tu shipper. */
async function nhanLaiHang(idGiao, nguoi = {}) {
  const d = await layDonCuaShipper(idGiao, null);
  if (d.hoan_hang !== 'dang_mang_ve') throw loi('Đơn này không có hàng đang mang về.');
  await db.query(
    "UPDATE don_giao_hang SET hoan_hang = 'da_nhan_lai', hoan_hang_luc = NOW(), nhan_lai_boi = ? WHERE id_giao = ? AND hoan_hang = 'dang_mang_ve'",
    [nguoi.ten || null, idGiao]);
  await ghiSuKien(idGiao, d.trang_thai, 'nhan_lai_hang', nguoi, 'Hàng hoàn đã về quầy');
  return { ok: true };
}

/** Bao su co. Gan vao don (neu co) de dieu phoi thay ngay tren danh sach. */
async function baoSuCo(idShipper, { id_giao = null, loai, ghi_chu = '', vi_do = null, kinh_do = null } = {}, nguoi = {}) {
  await damBaoCauTruc();
  if (!LOAI_SU_CO[loai]) throw loi('Chọn loại sự cố.');
  const noiDung = LOAI_SU_CO[loai] + (String(ghi_chu || '').trim() ? ' - ' + String(ghi_chu).trim() : '');
  const ids = [];
  if (id_giao) {
    const d = await layDonCuaShipper(Number(id_giao), idShipper);
    ids.push(d);
  } else {
    const [ds] = await db.query(
      "SELECT * FROM don_giao_hang WHERE id_shipper = ? AND trang_thai IN ('da_phan','dang_lay','dang_giao')", [idShipper]);
    ids.push(...ds);
  }
  for (const d of ids) {
    await db.query('UPDATE don_giao_hang SET su_co = ?, su_co_luc = NOW() WHERE id_giao = ?', [noiDung.slice(0, 300), d.id_giao]);
    await ghiSuKien(d.id_giao, d.trang_thai, 'su_co', nguoi, noiDung, vi_do, kinh_do);
  }
  return { ok: true, so_don: ids.length, noi_dung: noiDung, don: ids.map((d) => d.id_giao) };
}

/** Dieu phoi da xu ly su co - go co canh bao khoi don. */
async function xuLyXongSuCo(idGiao) {
  await damBaoCauTruc();
  await db.query('UPDATE don_giao_hang SET su_co = NULL, su_co_luc = NULL WHERE id_giao = ?', [idGiao]);
}

// ---------------------------------------------------------------------------
// Ca lam
// ---------------------------------------------------------------------------

async function batDauCa(idShipper) {
  await damBaoCauTruc();
  await db.query('UPDATE shipper SET ca_bat_dau = COALESCE(ca_bat_dau, NOW()) WHERE id_shipper = ?', [idShipper]);
}

/** So lieu ca hien tai + nhung gi dang chan tan ca. */
async function tongKetCa(idShipper) {
  await damBaoCauTruc();
  const [[sp]] = await db.query('SELECT ca_bat_dau, trang_thai FROM shipper WHERE id_shipper = ?', [idShipper]);
  const batDau = (sp && sp.ca_bat_dau) || new Date(new Date().setHours(0, 0, 0, 0));
  const [[s]] = await db.query(
    `SELECT SUM(trang_thai = 'da_giao') AS giao, SUM(trang_thai = 'that_bai' OR (trang_thai = 'huy' AND ma_ly_do_that_bai IS NOT NULL)) AS that_bai,
            COALESCE(SUM(CASE WHEN trang_thai IN ('da_giao','that_bai') THEN khoang_cach_km END), 0) AS km,
            COALESCE(SUM(CASE WHEN trang_thai = 'da_giao' THEN phi_giao END), 0) AS phi,
            COALESCE(SUM(CASE WHEN trang_thai = 'da_giao' AND da_thu_ho = 1 THEN tien_thu_ho END), 0) AS thu_ho
       FROM don_giao_hang WHERE id_shipper = ? AND hoan_tat_luc >= ?`, [idShipper, batDau]);
  const [[dc]] = await db.query(
    "SELECT COUNT(*) AS n FROM don_giao_hang WHERE id_shipper = ? AND trang_thai IN ('da_phan','dang_lay','dang_giao')", [idShipper]);
  const [hoan] = await db.query(
    "SELECT ma_giao FROM don_giao_hang WHERE id_shipper = ? AND hoan_hang = 'dang_mang_ve'", [idShipper]);
  const giu = await require('./thuHoShipperService').tienDangGiu(idShipper).catch(() => ({ tong: 0, don: [] }));

  const chan = [];
  if (Number(dc.n)) chan.push(`Còn ${dc.n} đơn đang cầm - giao xong hoặc báo điều phối chuyển đơn.`);
  if (hoan.length) chan.push(`Còn hàng hoàn chưa trả về quầy: ${hoan.map((h) => h.ma_giao).join(', ')}.`);
  if (Number(giu.tong) > 0) chan.push(`Còn giữ ${Math.round(giu.tong).toLocaleString('vi-VN')}đ tiền thu hộ - nộp ở quầy thu ngân.`);

  return {
    bat_dau: batDau,
    so_phut: Math.max(0, Math.round((Date.now() - new Date(batDau).getTime()) / 60000)),
    so_don_giao: Number(s.giao || 0),
    so_don_that_bai: Number(s.that_bai || 0),
    tong_km: Math.round(Number(s.km || 0) * 10) / 10,
    phi_ship: Number(s.phi || 0),
    tien_thu_ho: Number(s.thu_ho || 0),
    tien_dang_giu: Number(giu.tong || 0),
    chan,
    tan_ca_duoc: chan.length === 0,
  };
}

/** Tan ca: luu bien ban ca, chuyen shipper sang nghi. */
async function chotCa(idShipper, ghiChu = null) {
  const tk = await tongKetCa(idShipper);
  if (!tk.tan_ca_duoc) throw loi(tk.chan.join(' '), 'CHUA_TAN_CA_DUOC');
  await db.query(
    `INSERT INTO ca_shipper (id_shipper, bat_dau, ket_thuc, so_don_giao, so_don_that_bai, tong_km, phi_ship, tien_thu_ho, ghi_chu)
     VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
    [idShipper, tk.bat_dau, tk.so_don_giao, tk.so_don_that_bai, tk.tong_km, tk.phi_ship, tk.tien_thu_ho,
      ghiChu ? String(ghiChu).slice(0, 300) : null]);
  await db.query("UPDATE shipper SET trang_thai = 'nghi', ca_bat_dau = NULL WHERE id_shipper = ?", [idShipper]);
  return tk;
}

module.exports = {
  damBaoCauTruc, LY_DO_THAT_BAI, LOAI_SU_CO, SU_KIEN, thamSo,
  layMaNhanHang, kiemHang, denNoi, ghiCuocGoi, kiemTraThatBai, nhanLaiHang,
  baoSuCo, xuLyXongSuCo, batDauCa, tongKetCa, chotCa, baoThieuMon, boMonThieu, TIEN_TO_BU, dauVanMon,
};

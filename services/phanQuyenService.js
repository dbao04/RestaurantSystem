/**
 * Phan quyen theo chuc danh (RBAC).
 *
 * Quyen hieu luc cua mot nhan vien = hop cua ba nguon, uu tien tu duoi len:
 *
 *   1. chuc_danh_quyen    quyen mac dinh cua chuc danh dang giu
 *   2. uy_quyen           quyen muon tam tu nguoi khac, con trong han
 *   3. quyen_nhan_vien    cap / cat rieng cho ca nhan  (duoc_cap = 0 la CAT)
 *
 * Buoc 3 di sau cung va co the phu dinh: neu quan ly muon cat quyen 'donhang.huy'
 * cua mot to truong cu the ma khong doi ca chuc danh, chi can them mot dong
 * quyen_nhan_vien voi duoc_cap = 0.
 *
 * TUONG THICH NGUOC
 * -----------------
 * 178 route cu goi requireRole(['Bep']) - so sanh chuoi voi nhan_vien.chucvu.
 * Ham `dongVaiDuoc()` o day tra loi cau hoi "chuc danh moi nay co duoc dong vai
 * tro cu do khong", dua vao cot chuc_danh.vai_tro_tuong_duong. Nho vay Bep truong
 * (chuc danh moi) vao duoc moi trang cua 'Bep' (vai tro cu) ma khong sua route.
 *
 * BO NHO DEM
 * ----------
 * Quyen doc o gan nhu moi request nen phai dem. Dem theo id_nv, TTL 60 giay, va
 * xoa ngay khi co thay doi phan quyen (goi xoaDem/xoaToanBoDem tu cho sua).
 */
const db = require('../config/db');

const TTL_MS = 60_000;

/** id_nv -> { luc, duLieu } */
const dem = new Map();

function xoaDem(idNv) {
  if (idNv == null) return dem.clear();
  dem.delete(Number(idNv));
}
function xoaToanBoDem() {
  dem.clear();
}

// ---------------------------------------------------------------------------
// Doc quyen
// ---------------------------------------------------------------------------

/**
 * Ho so quyen day du cua mot nhan vien.
 *
 * Tra ve null neu khong tim thay nhan vien (da xoa, hoac id sai).
 */
async function hoSoQuyen(idNv) {
  const id = Number(idNv);
  if (!id) return null;

  const trongDem = dem.get(id);
  if (trongDem && Date.now() - trongDem.luc < TTL_MS) return trongDem.duLieu;

  const [nvRows] = await db.query(
    `SELECT n.id_nv, n.ma_nv, n.ten, n.chucvu, n.id_cd, n.id_bp, n.id_quan_ly,
            n.trangthai, n.trang_thai_lam_viec,
            cd.ma_cd, cd.ten_cd, cd.ten_rut_gon, cd.cap_bac, cd.la_quan_ly,
            cd.vai_tro_tuong_duong, cd.id_cd_cha,
            bp.ma_bp, bp.ten_bp, bp.mau_sac, bp.icon,
            sep.ten AS ten_quan_ly, sepcd.ten_cd AS chuc_danh_quan_ly
     FROM nhan_vien n
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN bo_phan   bp ON bp.id_bp = cd.id_bp
     LEFT JOIN nhan_vien sep   ON sep.id_nv = n.id_quan_ly
     LEFT JOIN chuc_danh sepcd ON sepcd.id_cd = sep.id_cd
     WHERE n.id_nv = ?`,
    [id]
  );
  if (!nvRows.length) return null;
  const nv = nvRows[0];

  // 1. Quyen tu chuc danh
  const [quyenCd] = nv.id_cd
    ? await db.query(
        `SELECT q.ma_q FROM chuc_danh_quyen cq
         JOIN quyen q ON q.id_q = cq.id_q
         WHERE cq.id_cd = ? AND cq.duoc_cap = 1`,
        [nv.id_cd]
      )
    : [[]];

  // 2. Quyen muon qua uy quyen con hieu luc
  const [uyQuyen] = await db.query(
    `SELECT u.id, u.id_nv_giao, u.id_cd_uy_quyen, u.den_luc, u.pham_vi,
            g.ten AS ten_nguoi_giao, cd.ten_cd AS ten_cd_uy_quyen
     FROM uy_quyen u
     LEFT JOIN nhan_vien g  ON g.id_nv = u.id_nv_giao
     LEFT JOIN chuc_danh cd ON cd.id_cd = u.id_cd_uy_quyen
     WHERE u.id_nv_nhan = ? AND u.trang_thai = 'hieu_luc'
       AND NOW() BETWEEN u.tu_luc AND u.den_luc`,
    [id]
  );

  const quyenMuon = new Set();
  for (const uq of uyQuyen) {
    // Uu tien chuc danh duoc ghi ro tren phieu uy quyen; neu khong co thi lay
    // chuc danh hien tai cua nguoi giao.
    const idCdNguon = uq.id_cd_uy_quyen ||
      (await db.query('SELECT id_cd FROM nhan_vien WHERE id_nv = ?', [uq.id_nv_giao]))[0][0]?.id_cd;
    if (!idCdNguon) continue;
    const [qs] = await db.query(
      `SELECT q.ma_q FROM chuc_danh_quyen cq JOIN quyen q ON q.id_q = cq.id_q
       WHERE cq.id_cd = ? AND cq.duoc_cap = 1`,
      [idCdNguon]
    );
    qs.forEach((r) => quyenMuon.add(r.ma_q));
  }

  // 3. Cap / cat rieng cho ca nhan
  const [rieng] = await db.query(
    `SELECT q.ma_q, qn.duoc_cap FROM quyen_nhan_vien qn
     JOIN quyen q ON q.id_q = qn.id_q
     WHERE qn.id_nv = ? AND (qn.het_han IS NULL OR qn.het_han > NOW())`,
    [id]
  );

  const tap = new Set(quyenCd.map((r) => r.ma_q));
  quyenMuon.forEach((m) => tap.add(m));
  for (const r of rieng) {
    if (r.duoc_cap) tap.add(r.ma_q);
    else tap.delete(r.ma_q); // phu dinh tuong minh - di sau cung
  }

  const duLieu = {
    id_nv: nv.id_nv,
    ma_nv: nv.ma_nv,
    ten: String(nv.ten || '').trim(),
    // Chuc danh moi
    id_cd: nv.id_cd,
    ma_cd: nv.ma_cd,
    ten_cd: nv.ten_cd,
    ten_rut_gon: nv.ten_rut_gon,
    cap_bac: nv.cap_bac == null ? 9 : Number(nv.cap_bac),
    la_quan_ly: Boolean(nv.la_quan_ly),
    id_cd_cha: nv.id_cd_cha,
    // Bo phan
    id_bp: nv.id_bp,
    ma_bp: nv.ma_bp,
    ten_bp: nv.ten_bp,
    mau_bp: nv.mau_sac,
    icon_bp: nv.icon,
    // Quan ly truc tiep
    id_quan_ly: nv.id_quan_ly,
    ten_quan_ly: nv.ten_quan_ly ? String(nv.ten_quan_ly).trim() : null,
    chuc_danh_quan_ly: nv.chuc_danh_quan_ly,
    // Vai tro cu - giu de 178 route cu chay dung
    vai_tro_cu: (nv.chucvu || '').trim(),
    vai_tro_tuong_duong: (nv.vai_tro_tuong_duong || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
    // Quyen
    quyen: [...tap].sort(),
    uy_quyen: uyQuyen.map((u) => ({
      id: u.id,
      tu_nguoi: String(u.ten_nguoi_giao || '').trim(),
      chuc_danh: u.ten_cd_uy_quyen,
      den_luc: u.den_luc,
      pham_vi: u.pham_vi,
    })),
    trang_thai_lam_viec: nv.trang_thai_lam_viec || 'dang_lam',
  };

  dem.set(id, { luc: Date.now(), duLieu });
  return duLieu;
}

// ---------------------------------------------------------------------------
// Kiem tra
// ---------------------------------------------------------------------------

/**
 * Ho so co quyen `maQuyen` khong?
 *
 * Ho tro tien to: coQuyen(hs, 'bep.*') dung khi co BAT KY quyen nao nhom bep.
 * Truyen mang thi chi can THOA MOT trong so do (hoac).
 */
function coQuyen(hoSo, maQuyen) {
  if (!hoSo) return false;
  const ds = Array.isArray(maQuyen) ? maQuyen : [maQuyen];
  return ds.some((ma) => {
    if (ma === '*') return hoSo.quyen.length > 0;
    if (ma.endsWith('*')) {
      const tienTo = ma.slice(0, -1);
      return hoSo.quyen.some((q) => q.startsWith(tienTo));
    }
    return hoSo.quyen.includes(ma);
  });
}

/** Phai co DU tat ca cac quyen liet ke. */
function coDuQuyen(hoSo, danhSach) {
  if (!hoSo) return false;
  return danhSach.every((ma) => coQuyen(hoSo, ma));
}

/**
 * Chuc danh nay co duoc dong vai mot trong cac vai tro CU khong?
 *
 * Day la cau noi tuong thich nguoc cho requireRole cua server.js.
 */
function dongVaiDuoc(hoSo, vaiTroCu) {
  if (!hoSo) return false;
  const ds = Array.isArray(vaiTroCu) ? vaiTroCu : [vaiTroCu];
  // Vai tro cu ghi trong nhan_vien.chucvu van tinh - nguoi chua duoc bo nhiem
  // chuc danh moi khong bi mat quyen dang co.
  if (hoSo.vai_tro_cu && ds.includes(hoSo.vai_tro_cu)) return true;
  return ds.some((v) => hoSo.vai_tro_tuong_duong.includes(v));
}

/** Cap bac cang NHO cang cao. Quan ly nha hang = 1. */
function tuCapBac(hoSo, capToiThieu) {
  return Boolean(hoSo) && hoSo.cap_bac <= Number(capToiThieu);
}

/**
 * A co phai cap tren cua B khong (theo duong bao cao chuc danh)?
 *
 * Dung khi duyet nghi phep, xem cham cong cap duoi: chi cap tren truc tiep hoac
 * gian tiep moi duoc xem. Di nguoc len toi da 10 bac de tranh vong lap neu du
 * lieu bi loi.
 */
async function laCapTrenCua(idNvA, idNvB) {
  const a = Number(idNvA), b = Number(idNvB);
  if (!a || !b || a === b) return false;

  const [rows] = await db.query('SELECT id_nv, id_quan_ly FROM nhan_vien WHERE trangthai = 1');
  const sep = new Map(rows.map((r) => [r.id_nv, r.id_quan_ly]));

  let hienTai = sep.get(b);
  for (let i = 0; i < 10 && hienTai; i++) {
    if (hienTai === a) return true;
    hienTai = sep.get(hienTai);
  }
  return false;
}

/**
 * Danh sach id nhan vien duoi quyen (de quy toan bo cay).
 * Dung cho bao cao "bo phan cua toi", duyet nghi phep, xem lich to.
 */
async function capDuoiCua(idNv) {
  const goc = Number(idNv);
  if (!goc) return [];
  const [rows] = await db.query(
    'SELECT id_nv, id_quan_ly FROM nhan_vien WHERE trangthai = 1'
  );
  const con = new Map();
  for (const r of rows) {
    if (!r.id_quan_ly) continue;
    if (!con.has(r.id_quan_ly)) con.set(r.id_quan_ly, []);
    con.get(r.id_quan_ly).push(r.id_nv);
  }
  const ketQua = [];
  const hangDoi = [goc];
  const daTham = new Set([goc]);
  while (hangDoi.length) {
    const cur = hangDoi.shift();
    for (const c of con.get(cur) || []) {
      if (daTham.has(c)) continue; // chan vong lap du lieu loi
      daTham.add(c);
      ketQua.push(c);
      hangDoi.push(c);
    }
  }
  return ketQua;
}

// ---------------------------------------------------------------------------
// Nap vao session
// ---------------------------------------------------------------------------

/**
 * Nap ho so quyen vao session luc dang nhap.
 *
 * Van ghi `staffRole` = chucvu cu de 178 route cu khong doi hanh vi.
 */
async function napVaoSession(req, idNv) {
  const hs = await hoSoQuyen(idNv);
  if (!hs) return null;
  req.session.quyen = hs.quyen;
  req.session.idChucDanh = hs.id_cd;
  req.session.maChucDanh = hs.ma_cd;
  req.session.tenChucDanh = hs.ten_cd;
  req.session.capBac = hs.cap_bac;
  req.session.laQuanLy = hs.la_quan_ly;
  req.session.idBoPhan = hs.id_bp;
  req.session.maBoPhan = hs.ma_bp;
  req.session.tenBoPhan = hs.ten_bp;
  req.session.vaiTroTuongDuong = hs.vai_tro_tuong_duong;
  return hs;
}

/** Danh muc quyen day du, gom theo nhom - dung cho man hinh phan quyen. */
async function danhMucQuyen() {
  const [rows] = await db.query(
    'SELECT id_q, ma_q, ten_q, nhom_q, mo_ta, la_nhay_cam FROM quyen ORDER BY thu_tu, id_q'
  );
  const nhom = new Map();
  for (const r of rows) {
    if (!nhom.has(r.nhom_q)) nhom.set(r.nhom_q, []);
    nhom.get(r.nhom_q).push(r);
  }
  return [...nhom.entries()].map(([ten, ds]) => ({ nhom: ten, quyen: ds }));
}

module.exports = {
  hoSoQuyen,
  coQuyen,
  coDuQuyen,
  dongVaiDuoc,
  tuCapBac,
  laCapTrenCua,
  capDuoiCua,
  napVaoSession,
  danhMucQuyen,
  xoaDem,
  xoaToanBoDem,
};

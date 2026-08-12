/**
 * Nghiep vu co cau to chuc: bo phan, chuc danh, to lam viec, bo nhiem, uy quyen.
 *
 * Moi thao tac lam thay doi to chuc deu:
 *   1. Ghi `nhat_ky_to_chuc` (ai doi gi, luc nao) - bo nhiem la viec nhay cam
 *   2. Xoa bo nho dem quyen cua nguoi bi anh huong
 *   3. Phat su kien thoi gian thuc de so do to chuc cua moi nguoi tu cap nhat
 *
 * Ba viec nay di lien nhau nen goi chung trong ham `apDung()` o cuoi file, tranh
 * truong hop sua CSDL xong lai quen xoa dem khien nguoi dung van giu quyen cu.
 */
const db = require('../config/db');
const phanQuyen = require('./phanQuyenService');
const realtime = require('./realtime');

// ---------------------------------------------------------------------------
// DOC
// ---------------------------------------------------------------------------

/** Toan bo bo phan kem so nhan su thuc te so voi dinh bien. */
async function danhSachBoPhan() {
  const [rows] = await db.query(
    `SELECT bp.*,
            (SELECT COUNT(*) FROM nhan_vien n JOIN chuc_danh c ON c.id_cd = n.id_cd
              WHERE c.id_bp = bp.id_bp AND n.trangthai = 1) AS so_nhan_su,
            (SELECT COALESCE(SUM(dinh_bien),0) FROM chuc_danh WHERE id_bp = bp.id_bp AND trang_thai = 1) AS dinh_bien,
            (SELECT COUNT(*) FROM chuc_danh WHERE id_bp = bp.id_bp AND trang_thai = 1) AS so_chuc_danh
     FROM bo_phan bp WHERE bp.trang_thai = 1 ORDER BY bp.thu_tu, bp.id_bp`
  );
  return rows;
}

/** Chuc danh kem bo phan, cap tren va so nguoi dang giu. */
async function danhSachChucDanh({ idBp = null } = {}) {
  const dieuKien = idBp ? 'AND cd.id_bp = ?' : '';
  const [rows] = await db.query(
    `SELECT cd.*, bp.ma_bp, bp.ten_bp, bp.mau_sac, bp.icon,
            cha.ten_cd AS ten_cd_cha, cha.ma_cd AS ma_cd_cha,
            (SELECT COUNT(*) FROM nhan_vien n WHERE n.id_cd = cd.id_cd AND n.trangthai = 1) AS so_nguoi,
            (SELECT COUNT(*) FROM chuc_danh_quyen q WHERE q.id_cd = cd.id_cd AND q.duoc_cap = 1) AS so_quyen
     FROM chuc_danh cd
     JOIN bo_phan bp ON bp.id_bp = cd.id_bp
     LEFT JOIN chuc_danh cha ON cha.id_cd = cd.id_cd_cha
     WHERE cd.trang_thai = 1 ${dieuKien}
     ORDER BY cd.cap_bac, bp.thu_tu, cd.thu_tu`,
    idBp ? [idBp] : []
  );
  return rows;
}

/**
 * So do to chuc dang cay, bat dau tu chuc danh khong co cha.
 *
 * Tra ve cay chuc danh, moi nut kem danh sach nguoi dang giu chuc danh do va
 * trang thai online cua ho - de ve so do "song".
 */
async function soDoToChuc() {
  const [cd] = await db.query(
    `SELECT cd.id_cd, cd.ma_cd, cd.ten_cd, cd.ten_rut_gon, cd.cap_bac, cd.id_cd_cha,
            cd.la_quan_ly, cd.dinh_bien, cd.trach_nhiem,
            bp.ma_bp, bp.ten_bp, bp.mau_sac, bp.icon
     FROM chuc_danh cd JOIN bo_phan bp ON bp.id_bp = cd.id_bp
     WHERE cd.trang_thai = 1 ORDER BY cd.cap_bac, cd.thu_tu`
  );

  const [nv] = await db.query(
    `SELECT n.id_nv, n.ma_nv, n.ten, n.id_cd, n.trang_thai_lam_viec,
            COALESCE(h.so_ket_noi, 0) AS so_ket_noi,
            h.trang_hien_tai
     FROM nhan_vien n
     LEFT JOIN hien_dien_nv h ON h.id_nv = n.id_nv
     WHERE n.trangthai = 1 AND n.id_cd IS NOT NULL
     ORDER BY n.ten`
  );

  const nguoiTheoCd = new Map();
  for (const n of nv) {
    if (!nguoiTheoCd.has(n.id_cd)) nguoiTheoCd.set(n.id_cd, []);
    nguoiTheoCd.get(n.id_cd).push({
      id_nv: n.id_nv,
      ma_nv: n.ma_nv,
      ten: String(n.ten || '').trim(),
      online: n.so_ket_noi > 0,
      trang_hien_tai: n.trang_hien_tai,
      trang_thai_lam_viec: n.trang_thai_lam_viec,
    });
  }

  const nut = new Map(
    cd.map((c) => [c.id_cd, { ...c, nguoi: nguoiTheoCd.get(c.id_cd) || [], con: [] }])
  );
  const goc = [];
  for (const c of cd) {
    const n = nut.get(c.id_cd);
    if (c.id_cd_cha && nut.has(c.id_cd_cha)) nut.get(c.id_cd_cha).con.push(n);
    else goc.push(n);
  }
  return goc;
}

/** Nhan su kem chuc danh, bo phan, cap tren, trang thai online. */
async function danhSachNhanSu({ idBp = null, chuaCoChucDanh = false } = {}) {
  const dk = [];
  const thamSo = [];
  if (idBp) { dk.push('cd.id_bp = ?'); thamSo.push(idBp); }
  if (chuaCoChucDanh) dk.push('n.id_cd IS NULL');

  const [rows] = await db.query(
    `SELECT n.id_nv, n.ma_nv, n.ten, n.sodienthoai, n.email, n.username,
            n.chucvu, n.id_cd, n.id_quan_ly, n.ngayvaolam, n.ngay_bo_nhiem,
            n.trangthai, n.trang_thai_lam_viec,
            cd.ma_cd, cd.ten_cd, cd.ten_rut_gon, cd.cap_bac, cd.la_quan_ly,
            bp.id_bp, bp.ma_bp, bp.ten_bp, bp.mau_sac, bp.icon,
            sep.ten AS ten_quan_ly,
            COALESCE(h.so_ket_noi, 0) AS so_ket_noi, h.trang_hien_tai, h.hoat_dong_cuoi
     FROM nhan_vien n
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN bo_phan bp   ON bp.id_bp = cd.id_bp
     LEFT JOIN nhan_vien sep ON sep.id_nv = n.id_quan_ly
     LEFT JOIN hien_dien_nv h ON h.id_nv = n.id_nv
     WHERE n.trangthai = 1 ${dk.length ? 'AND ' + dk.join(' AND ') : ''}
     ORDER BY cd.cap_bac IS NULL, cd.cap_bac, bp.thu_tu, n.ten`,
    thamSo
  );
  return rows.map((r) => ({
    ...r,
    ten: String(r.ten || '').trim(),
    ten_quan_ly: r.ten_quan_ly ? String(r.ten_quan_ly).trim() : null,
    online: r.so_ket_noi > 0,
  }));
}

/** To lam viec kem to truong va so thanh vien. */
async function danhSachTo() {
  const [rows] = await db.query(
    `SELECT t.*, bp.ma_bp, bp.ten_bp, bp.mau_sac,
            tt.ten AS ten_to_truong, ttcd.ten_cd AS chuc_danh_to_truong,
            (SELECT COUNT(*) FROM thanh_vien_to v WHERE v.id_to = t.id_to AND v.trang_thai = 1) AS so_thanh_vien
     FROM to_lam_viec t
     JOIN bo_phan bp ON bp.id_bp = t.id_bp
     LEFT JOIN nhan_vien tt   ON tt.id_nv = t.id_to_truong
     LEFT JOIN chuc_danh ttcd ON ttcd.id_cd = tt.id_cd
     WHERE t.trang_thai = 1 ORDER BY bp.thu_tu, t.ten_to`
  );
  return rows.map((r) => ({
    ...r,
    ten_to_truong: r.ten_to_truong ? String(r.ten_to_truong).trim() : null,
  }));
}

async function thanhVienTo(idTo) {
  const [rows] = await db.query(
    `SELECT v.*, n.ten, n.ma_nv, cd.ten_cd, cd.cap_bac,
            COALESCE(h.so_ket_noi,0) AS so_ket_noi
     FROM thanh_vien_to v
     JOIN nhan_vien n ON n.id_nv = v.id_nv
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN hien_dien_nv h ON h.id_nv = n.id_nv
     WHERE v.id_to = ? AND v.trang_thai = 1
     ORDER BY FIELD(v.vai_tro_trong_to,'to_truong','to_pho','thanh_vien'), n.ten`,
    [idTo]
  );
  return rows.map((r) => ({ ...r, ten: String(r.ten || '').trim(), online: r.so_ket_noi > 0 }));
}

/** Quyen cua mot chuc danh, danh dau cai nao dang duoc cap. */
async function quyenCuaChucDanh(idCd) {
  const [tatCa] = await db.query(
    'SELECT id_q, ma_q, ten_q, nhom_q, la_nhay_cam FROM quyen ORDER BY thu_tu, id_q'
  );
  const [dangCo] = await db.query(
    'SELECT id_q FROM chuc_danh_quyen WHERE id_cd = ? AND duoc_cap = 1', [idCd]
  );
  const tap = new Set(dangCo.map((r) => r.id_q));

  const nhom = new Map();
  for (const q of tatCa) {
    if (!nhom.has(q.nhom_q)) nhom.set(q.nhom_q, []);
    nhom.get(q.nhom_q).push({ ...q, duoc_cap: tap.has(q.id_q) });
  }
  return [...nhom.entries()].map(([ten, ds]) => ({ nhom: ten, quyen: ds }));
}

/**
 * Viec can xu ly, loc dung theo tham quyen nguoi xem.
 *
 * Phai khop CA HAI dieu kien, giong het cach realtime chon nguoi nhan - neu
 * khac nhau thi se co canh "nhan duoc thong bao nhung mo danh sach lai khong
 * thay", hoac nguoc lai.
 *   1. Du cap bac         cap_bac_toi_thieu >= cap cua minh
 *   2. Dung bo phan       viec cua bo phan minh, hoac viec khong ghi bo phan
 * Quan ly nha hang (cap 1) thay tat ca, khong loc bo phan.
 */
async function vieccanXuLy({ idBp = null, capBac = 9, gomDaXong = false } = {}) {
  const dk = ["(v.trang_thai IN ('cho','dang_xu_ly'))"];
  const ts = [];
  if (gomDaXong) dk.length = 0;

  dk.push('v.cap_bac_toi_thieu >= ?'); ts.push(capBac);
  if (idBp && Number(capBac) > 1) {
    dk.push('(v.id_bp_xu_ly = ? OR v.id_bp_xu_ly IS NULL)'); ts.push(idBp);
  }

  const [rows] = await db.query(
    `SELECT v.*, nt.ten AS ten_nguoi_tao, cdt.ten_cd AS chuc_danh_nguoi_tao,
            nx.ten AS ten_nguoi_xu_ly, bp.ten_bp, bp.ma_bp, bp.mau_sac
     FROM viec_can_xu_ly v
     LEFT JOIN nhan_vien nt  ON nt.id_nv = v.id_nv_tao
     LEFT JOIN chuc_danh cdt ON cdt.id_cd = nt.id_cd
     LEFT JOIN nhan_vien nx  ON nx.id_nv = v.id_nv_xu_ly
     LEFT JOIN bo_phan bp    ON bp.id_bp = v.id_bp_xu_ly
     ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
     ORDER BY FIELD(v.muc_do,'khan','cao','binh_thuong','thap'), v.tao_luc DESC
     LIMIT 200`,
    ts
  );
  return rows.map((r) => ({
    ...r,
    ten_nguoi_tao: r.ten_nguoi_tao ? String(r.ten_nguoi_tao).trim() : null,
    ten_nguoi_xu_ly: r.ten_nguoi_xu_ly ? String(r.ten_nguoi_xu_ly).trim() : null,
  }));
}

/** So lieu tong hop cho bang dieu hanh. */
async function tongQuanVanHanh() {
  const [[nhanSu]] = await db.query(
    `SELECT COUNT(*) AS tong,
            SUM(CASE WHEN COALESCE(h.so_ket_noi,0) > 0 THEN 1 ELSE 0 END) AS dang_online,
            SUM(CASE WHEN n.trang_thai_lam_viec = 'nghi_phep' THEN 1 ELSE 0 END) AS nghi_phep
     FROM nhan_vien n LEFT JOIN hien_dien_nv h ON h.id_nv = n.id_nv
     WHERE n.trangthai = 1`
  );
  const [theoBoPhan] = await db.query(
    `SELECT bp.id_bp, bp.ma_bp, bp.ten_bp, bp.mau_sac, bp.icon,
            COUNT(n.id_nv) AS tong,
            SUM(CASE WHEN COALESCE(h.so_ket_noi,0) > 0 THEN 1 ELSE 0 END) AS online,
            (SELECT COALESCE(SUM(dinh_bien),0) FROM chuc_danh WHERE id_bp = bp.id_bp AND trang_thai = 1) AS dinh_bien
     FROM bo_phan bp
     LEFT JOIN chuc_danh cd ON cd.id_bp = bp.id_bp AND cd.trang_thai = 1
     LEFT JOIN nhan_vien n  ON n.id_cd = cd.id_cd AND n.trangthai = 1
     LEFT JOIN hien_dien_nv h ON h.id_nv = n.id_nv
     WHERE bp.trang_thai = 1
     GROUP BY bp.id_bp, bp.ma_bp, bp.ten_bp, bp.mau_sac, bp.icon, bp.thu_tu
     ORDER BY bp.thu_tu`
  );
  const [[viec]] = await db.query(
    `SELECT SUM(trang_thai = 'cho') AS cho,
            SUM(trang_thai = 'dang_xu_ly') AS dang_xu_ly,
            SUM(trang_thai = 'cho' AND muc_do = 'khan') AS khan
     FROM viec_can_xu_ly WHERE DATE(tao_luc) = CURDATE()`
  );
  return {
    nhan_su: {
      tong: Number(nhanSu.tong || 0),
      dang_online: Number(nhanSu.dang_online || 0),
      nghi_phep: Number(nhanSu.nghi_phep || 0),
    },
    theo_bo_phan: theoBoPhan.map((b) => ({
      ...b, tong: Number(b.tong || 0), online: Number(b.online || 0),
      dinh_bien: Number(b.dinh_bien || 0),
    })),
    viec: {
      cho: Number(viec.cho || 0),
      dang_xu_ly: Number(viec.dang_xu_ly || 0),
      khan: Number(viec.khan || 0),
    },
  };
}

// ---------------------------------------------------------------------------
// GHI
// ---------------------------------------------------------------------------

/** Ghi nhat ky + xoa dem quyen + phat su kien. Goi sau MOI thay doi to chuc. */
async function apDung({ hanhDong, idNvMucTieu = null, idCdCu = null, idCdMoi = null,
                        chiTiet = null, nguoiThucHien = null, idNguoiThucHien = null,
                        ip = null, suKien = 'to-chuc:cap-nhat', duLieuPhat = {} }) {
  await db.query(
    `INSERT INTO nhat_ky_to_chuc
       (hanh_dong, id_nv_muc_tieu, id_cd_cu, id_cd_moi, chi_tiet,
        nguoi_thuc_hien, id_nguoi_thuc_hien, dia_chi_ip)
     VALUES (?,?,?,?,?,?,?,?)`,
    [hanhDong, idNvMucTieu, idCdCu, idCdMoi,
     chiTiet ? String(chiTiet).slice(0, 2000) : null, nguoiThucHien, idNguoiThucHien, ip]
  );

  if (idNvMucTieu) phanQuyen.xoaDem(idNvMucTieu);
  else phanQuyen.xoaToanBoDem();

  realtime.phatToanBo(suKien, { hanh_dong: hanhDong, ...duLieuPhat });
}

/**
 * Bo nhiem: dat chuc danh moi cho mot nhan vien.
 *
 * Dong bo luon `chucvu` cu theo vai tro tuong duong DAU TIEN cua chuc danh moi,
 * de cac route cu van doc duoc gia tri hop le - ENUM khong nhan chuoi la.
 */
async function boNhiem(idNv, idCd, boi = {}) {
  const [[nv]] = await db.query('SELECT id_nv, ten, id_cd, chucvu FROM nhan_vien WHERE id_nv = ?', [idNv]);
  if (!nv) throw new Error('Không tìm thấy nhân viên.');

  const [[cd]] = await db.query(
    `SELECT cd.*, bp.ma_bp, bp.ten_bp FROM chuc_danh cd
     JOIN bo_phan bp ON bp.id_bp = cd.id_bp WHERE cd.id_cd = ?`, [idCd]
  );
  if (!cd) throw new Error('Không tìm thấy chức danh.');

  // Gia tri ghi vao cot cu `chucvu`. Uu tien `chucvu_legacy` da khai bao rieng;
  // chi khi thieu moi lay tam vai tro dau tien trong danh sach dong vai.
  const vaiTroCu = (cd.chucvu_legacy || '').trim() ||
    (cd.vai_tro_tuong_duong || '').split(',')[0].trim() ||
    'Nhan vien chung';

  // Cap tren truc tiep = nguoi dang giu chuc danh cha, cung bo phan neu co.
  const [sep] = cd.id_cd_cha
    ? await db.query(
        'SELECT id_nv FROM nhan_vien WHERE id_cd = ? AND trangthai = 1 ORDER BY id_nv LIMIT 1',
        [cd.id_cd_cha])
    : [[]];

  await db.query(
    `UPDATE nhan_vien SET id_cd = ?, id_bp = ?, chucvu = ?, id_quan_ly = ?,
            ngay_bo_nhiem = CURDATE() WHERE id_nv = ?`,
    [idCd, cd.id_bp, vaiTroCu, sep[0] ? sep[0].id_nv : null, idNv]
  );

  // Noi cap duoi vao nguoi vua duoc bo nhiem.
  //
  // Nhan vien phuc vu truoc do khong co cap tren truc tiep vi chua ai giu chuc
  // To truong phuc vu. Ngay khi co nguoi giu chuc do, ho phai duoc noi vao -
  // neu khong so do to chuc se mai bi dut o giua.
  const [noi] = await db.query(
    `UPDATE nhan_vien n JOIN chuc_danh c ON c.id_cd = n.id_cd
     SET n.id_quan_ly = ?
     WHERE c.id_cd_cha = ? AND n.id_nv <> ? AND n.trangthai = 1 AND n.id_quan_ly IS NULL`,
    [idNv, idCd, idNv]
  );

  await apDung({
    hanhDong: 'bo_nhiem',
    idNvMucTieu: idNv,
    idCdCu: nv.id_cd,
    idCdMoi: idCd,
    chiTiet: `${String(nv.ten).trim()} → ${cd.ten_cd} (${cd.ten_bp})`,
    ...boi,
    duLieuPhat: { id_nv: idNv, ten: String(nv.ten).trim(), ten_cd: cd.ten_cd, ten_bp: cd.ten_bp },
  });

  // Bao rieng cho nguoi duoc bo nhiem de giao dien cua ho tai lai quyen.
  realtime.phat('quyen:thay-doi', {
    ly_do: 'Bạn vừa được bổ nhiệm chức danh mới: ' + cd.ten_cd,
  }, { nv: idNv });

  return {
    id_nv: idNv, chuc_danh: cd.ten_cd, bo_phan: cd.ten_bp, vai_tro_cu: vaiTroCu,
    cap_duoi_duoc_noi: noi.affectedRows || 0,
  };
}

/** Dat lai toan bo quyen cua mot chuc danh theo danh sach id_q duoc chon. */
async function datQuyenChucDanh(idCd, danhSachIdQ, boi = {}) {
  const ids = [...new Set((danhSachIdQ || []).map(Number).filter(Boolean))];
  const ketNoi = await db.getConnection();
  try {
    await ketNoi.beginTransaction();
    await ketNoi.query('DELETE FROM chuc_danh_quyen WHERE id_cd = ?', [idCd]);
    if (ids.length) {
      await ketNoi.query(
        'INSERT INTO chuc_danh_quyen (id_cd, id_q, duoc_cap) VALUES ' +
          ids.map(() => '(?,?,1)').join(','),
        ids.flatMap((q) => [idCd, q])
      );
    }
    await ketNoi.commit();
  } catch (e) {
    await ketNoi.rollback();
    throw e;
  } finally {
    ketNoi.release();
  }

  const [[cd]] = await db.query('SELECT ten_cd FROM chuc_danh WHERE id_cd = ?', [idCd]);
  // Quyen cua ca chuc danh doi -> dem cua MOI nguoi giu chuc danh do phai bo.
  phanQuyen.xoaToanBoDem();
  await apDung({
    hanhDong: 'phan_quyen',
    idCdMoi: idCd,
    chiTiet: `${cd ? cd.ten_cd : idCd}: ${ids.length} quyền`,
    ...boi,
    suKien: 'to-chuc:quyen-doi',
    duLieuPhat: { id_cd: idCd, ten_cd: cd ? cd.ten_cd : null, so_quyen: ids.length },
  });

  // Nguoi dang giu chuc danh nay can tai lai giao dien.
  const [nguoi] = await db.query('SELECT id_nv FROM nhan_vien WHERE id_cd = ? AND trangthai = 1', [idCd]);
  nguoi.forEach((n) => realtime.phat('quyen:thay-doi', {
    ly_do: 'Quyền của chức danh bạn đang giữ vừa được cập nhật.',
  }, { nv: n.id_nv }));

  return ids.length;
}

/** Them hoac sua chuc danh. */
async function luuChucDanh(duLieu, boi = {}) {
  const { id_cd, ma_cd, ten_cd, ten_rut_gon, id_bp, cap_bac, id_cd_cha,
          la_quan_ly, vai_tro_tuong_duong, dinh_bien, trach_nhiem } = duLieu;

  if (!ma_cd || !ten_cd || !id_bp) throw new Error('Thiếu mã, tên hoặc bộ phận.');
  const cap = Math.min(Math.max(Number(cap_bac) || 5, 1), 6);

  // Chan tu tro thanh cap tren cua chinh minh.
  if (id_cd && Number(id_cd_cha) === Number(id_cd)) {
    throw new Error('Chức danh không thể báo cáo cho chính nó.');
  }

  if (id_cd) {
    await db.query(
      `UPDATE chuc_danh SET ma_cd=?, ten_cd=?, ten_rut_gon=?, id_bp=?, cap_bac=?,
              id_cd_cha=?, la_quan_ly=?, vai_tro_tuong_duong=?, dinh_bien=?, trach_nhiem=?
       WHERE id_cd=?`,
      [ma_cd, ten_cd, ten_rut_gon || null, id_bp, cap, id_cd_cha || null,
       la_quan_ly ? 1 : 0, vai_tro_tuong_duong || null, Number(dinh_bien) || 0,
       trach_nhiem || null, id_cd]
    );
  } else {
    await db.query(
      `INSERT INTO chuc_danh (ma_cd, ten_cd, ten_rut_gon, id_bp, cap_bac, id_cd_cha,
                              la_quan_ly, vai_tro_tuong_duong, dinh_bien, trach_nhiem)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [ma_cd, ten_cd, ten_rut_gon || null, id_bp, cap, id_cd_cha || null,
       la_quan_ly ? 1 : 0, vai_tro_tuong_duong || null, Number(dinh_bien) || 0,
       trach_nhiem || null]
    );
  }

  phanQuyen.xoaToanBoDem();
  await apDung({
    hanhDong: id_cd ? 'sua_chuc_danh' : 'them_chuc_danh',
    idCdMoi: id_cd || null,
    chiTiet: `${ma_cd} - ${ten_cd}`,
    ...boi,
    duLieuPhat: { ma_cd, ten_cd },
  });
}

/** Ngung su dung mot chuc danh. Khong xoa cung de giu lich su nhat ky. */
async function ngungChucDanh(idCd, boi = {}) {
  const [[dem]] = await db.query(
    'SELECT COUNT(*) n FROM nhan_vien WHERE id_cd = ? AND trangthai = 1', [idCd]
  );
  if (dem.n > 0) {
    throw new Error(`Còn ${dem.n} nhân viên đang giữ chức danh này. Hãy điều chuyển họ trước.`);
  }
  await db.query('UPDATE chuc_danh SET trang_thai = 0 WHERE id_cd = ?', [idCd]);
  await apDung({ hanhDong: 'ngung_chuc_danh', idCdMoi: idCd, ...boi });
}

/** Tao / cap nhat to lam viec. */
async function luuTo(duLieu, boi = {}) {
  const { id_to, ma_to, ten_to, id_bp, id_to_truong, khu_vuc, ca_lam, mo_ta } = duLieu;
  if (!ma_to || !ten_to || !id_bp) throw new Error('Thiếu mã, tên hoặc bộ phận của tổ.');

  if (id_to) {
    await db.query(
      `UPDATE to_lam_viec SET ma_to=?, ten_to=?, id_bp=?, id_to_truong=?, khu_vuc=?,
              ca_lam=?, mo_ta=? WHERE id_to=?`,
      [ma_to, ten_to, id_bp, id_to_truong || null, khu_vuc || null, ca_lam || null, mo_ta || null, id_to]
    );
  } else {
    await db.query(
      `INSERT INTO to_lam_viec (ma_to, ten_to, id_bp, id_to_truong, khu_vuc, ca_lam, mo_ta)
       VALUES (?,?,?,?,?,?,?)`,
      [ma_to, ten_to, id_bp, id_to_truong || null, khu_vuc || null, ca_lam || null, mo_ta || null]
    );
  }

  // To truong phai la thanh vien cua to, voi dung vai tro.
  if (id_to && id_to_truong) {
    await db.query(
      "UPDATE thanh_vien_to SET vai_tro_trong_to = 'thanh_vien' WHERE id_to = ? AND vai_tro_trong_to = 'to_truong'",
      [id_to]
    );
    await db.query(
      `INSERT INTO thanh_vien_to (id_to, id_nv, vai_tro_trong_to, tu_ngay)
       VALUES (?,?,'to_truong',CURDATE())
       ON DUPLICATE KEY UPDATE vai_tro_trong_to = 'to_truong', trang_thai = 1`,
      [id_to, id_to_truong]
    );
  }

  await apDung({
    hanhDong: id_to ? 'sua_to' : 'them_to',
    chiTiet: `${ma_to} - ${ten_to}`,
    ...boi,
    suKien: 'to-chuc:to-doi',
    duLieuPhat: { ma_to, ten_to },
  });
}

/** Them / doi vai tro / bo thanh vien khoi to. */
async function datThanhVienTo(idTo, idNv, vaiTro, boi = {}) {
  if (vaiTro === 'bo') {
    await db.query('UPDATE thanh_vien_to SET trang_thai = 0, den_ngay = CURDATE() WHERE id_to = ? AND id_nv = ?', [idTo, idNv]);
  } else {
    if (vaiTro === 'to_truong') {
      await db.query(
        "UPDATE thanh_vien_to SET vai_tro_trong_to = 'thanh_vien' WHERE id_to = ? AND vai_tro_trong_to = 'to_truong'",
        [idTo]
      );
      await db.query('UPDATE to_lam_viec SET id_to_truong = ? WHERE id_to = ?', [idNv, idTo]);
    }
    await db.query(
      `INSERT INTO thanh_vien_to (id_to, id_nv, vai_tro_trong_to, tu_ngay, trang_thai)
       VALUES (?,?,?,CURDATE(),1)
       ON DUPLICATE KEY UPDATE vai_tro_trong_to = VALUES(vai_tro_trong_to), trang_thai = 1, den_ngay = NULL`,
      [idTo, idNv, vaiTro]
    );
  }

  await apDung({
    hanhDong: 'to_thanh_vien',
    idNvMucTieu: idNv,
    chiTiet: `tổ #${idTo}: ${vaiTro}`,
    ...boi,
    suKien: 'to-chuc:to-doi',
    duLieuPhat: { id_to: idTo, id_nv: idNv, vai_tro: vaiTro },
  });
}

/** Lap phieu uy quyen tam thoi. */
async function taoUyQuyen(duLieu, boi = {}) {
  const { id_nv_giao, id_nv_nhan, id_cd_uy_quyen, tu_luc, den_luc, ly_do, pham_vi } = duLieu;
  if (!id_nv_giao || !id_nv_nhan) throw new Error('Thiếu người giao hoặc người nhận.');
  if (Number(id_nv_giao) === Number(id_nv_nhan)) throw new Error('Không thể tự ủy quyền cho chính mình.');
  if (!tu_luc || !den_luc) throw new Error('Thiếu khoảng thời gian ủy quyền.');
  if (new Date(den_luc) <= new Date(tu_luc)) throw new Error('Thời điểm kết thúc phải sau thời điểm bắt đầu.');

  const [kq] = await db.query(
    `INSERT INTO uy_quyen (id_nv_giao, id_nv_nhan, id_cd_uy_quyen, pham_vi, tu_luc, den_luc, ly_do, nguoi_duyet)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id_nv_giao, id_nv_nhan, id_cd_uy_quyen || null, pham_vi || null,
     tu_luc, den_luc, ly_do || null, boi.idNguoiThucHien || null]
  );

  phanQuyen.xoaDem(id_nv_nhan);
  await apDung({
    hanhDong: 'uy_quyen',
    idNvMucTieu: id_nv_nhan,
    chiTiet: `#${id_nv_giao} ủy quyền cho #${id_nv_nhan} từ ${tu_luc} đến ${den_luc}`,
    ...boi,
    duLieuPhat: { id: kq.insertId },
  });

  realtime.phat('quyen:thay-doi', {
    ly_do: 'Bạn vừa được ủy quyền tạm thời. Quyền mới có hiệu lực ngay.',
  }, { nv: id_nv_nhan });

  return kq.insertId;
}

async function thuHoiUyQuyen(id, boi = {}) {
  const [[uq]] = await db.query('SELECT id_nv_nhan FROM uy_quyen WHERE id = ?', [id]);
  if (!uq) throw new Error('Không tìm thấy phiếu ủy quyền.');
  await db.query("UPDATE uy_quyen SET trang_thai = 'da_thu_hoi' WHERE id = ?", [id]);
  phanQuyen.xoaDem(uq.id_nv_nhan);
  await apDung({ hanhDong: 'thu_hoi_uy_quyen', idNvMucTieu: uq.id_nv_nhan, ...boi });
  realtime.phat('quyen:thay-doi', { ly_do: 'Phiếu ủy quyền của bạn đã bị thu hồi.' }, { nv: uq.id_nv_nhan });
}

async function danhSachUyQuyen() {
  const [rows] = await db.query(
    `SELECT u.*, g.ten AS ten_giao, nh.ten AS ten_nhan,
            cdg.ten_cd AS cd_giao, cdn.ten_cd AS cd_nhan,
            (u.trang_thai = 'hieu_luc' AND NOW() BETWEEN u.tu_luc AND u.den_luc) AS dang_hieu_luc
     FROM uy_quyen u
     JOIN nhan_vien g  ON g.id_nv = u.id_nv_giao
     JOIN nhan_vien nh ON nh.id_nv = u.id_nv_nhan
     LEFT JOIN chuc_danh cdg ON cdg.id_cd = g.id_cd
     LEFT JOIN chuc_danh cdn ON cdn.id_cd = nh.id_cd
     ORDER BY u.tao_luc DESC LIMIT 100`
  );
  return rows.map((r) => ({
    ...r,
    ten_giao: String(r.ten_giao || '').trim(),
    ten_nhan: String(r.ten_nhan || '').trim(),
  }));
}

/** Bao mot viec len cap tren. */
async function taoViec(duLieu, boi = {}) {
  const { loai, tieu_de, noi_dung, muc_do, id_bp_xu_ly, cap_bac_toi_thieu, tham_chieu } = duLieu;
  if (!tieu_de) throw new Error('Thiếu tiêu đề.');

  const [kq] = await db.query(
    `INSERT INTO viec_can_xu_ly (loai, tieu_de, noi_dung, muc_do, id_nv_tao,
                                 id_bp_xu_ly, cap_bac_toi_thieu, tham_chieu)
     VALUES (?,?,?,?,?,?,?,?)`,
    [loai || 'khac', tieu_de, noi_dung || null, muc_do || 'binh_thuong',
     boi.idNguoiThucHien || null, id_bp_xu_ly || null,
     Math.min(Math.max(Number(cap_bac_toi_thieu) || 4, 1), 6), tham_chieu || null]
  );

  const [[viec]] = await db.query(
    `SELECT v.*, bp.ma_bp, n.ten AS ten_nguoi_tao, cd.ten_cd AS chuc_danh_nguoi_tao
     FROM viec_can_xu_ly v
     LEFT JOIN bo_phan bp   ON bp.id_bp = v.id_bp_xu_ly
     LEFT JOIN nhan_vien n  ON n.id_nv = v.id_nv_tao
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     WHERE v.id = ?`, [kq.insertId]
  );
  if (viec) {
    viec.ten_nguoi_tao = String(viec.ten_nguoi_tao || '').trim();
    realtime.bao(viec);
  }
  return kq.insertId;
}

/** Nhan / hoan tat / tu choi mot viec. */
async function capNhatViec(id, trangThai, idNvXuLy, ketQua = null) {
  const hopLe = ['cho', 'dang_xu_ly', 'xong', 'tu_choi'];
  if (!hopLe.includes(trangThai)) throw new Error('Trạng thái không hợp lệ.');

  await db.query(
    `UPDATE viec_can_xu_ly
     SET trang_thai = ?, id_nv_xu_ly = ?, ket_qua = ?,
         xu_ly_luc = IF(? IN ('xong','tu_choi'), NOW(), xu_ly_luc)
     WHERE id = ?`,
    [trangThai, idNvXuLy || null, ketQua, trangThai, id]
  );

  const [[viec]] = await db.query(
    `SELECT v.*, bp.ma_bp, nx.ten AS ten_nguoi_xu_ly
     FROM viec_can_xu_ly v
     LEFT JOIN bo_phan bp   ON bp.id_bp = v.id_bp_xu_ly
     LEFT JOIN nhan_vien nx ON nx.id_nv = v.id_nv_xu_ly
     WHERE v.id = ?`, [id]
  );
  if (!viec) return null;
  viec.ten_nguoi_xu_ly = String(viec.ten_nguoi_xu_ly || '').trim();

  // Cung tap nguoi nhan nhu luc bao viec, cong them chinh nguoi da tao.
  realtime.baoCapNhat(viec);
  return viec;
}

/** Nhat ky thay doi to chuc gan day. */
async function nhatKy(gioiHan = 100) {
  const [rows] = await db.query(
    `SELECT k.*, n.ten AS ten_muc_tieu, cdc.ten_cd AS cd_cu, cdm.ten_cd AS cd_moi
     FROM nhat_ky_to_chuc k
     LEFT JOIN nhan_vien n   ON n.id_nv = k.id_nv_muc_tieu
     LEFT JOIN chuc_danh cdc ON cdc.id_cd = k.id_cd_cu
     LEFT JOIN chuc_danh cdm ON cdm.id_cd = k.id_cd_moi
     ORDER BY k.tao_luc DESC LIMIT ?`,
    [Number(gioiHan)]
  );
  return rows.map((r) => ({
    ...r, ten_muc_tieu: r.ten_muc_tieu ? String(r.ten_muc_tieu).trim() : null,
  }));
}

module.exports = {
  danhSachBoPhan,
  danhSachChucDanh,
  soDoToChuc,
  danhSachNhanSu,
  danhSachTo,
  thanhVienTo,
  quyenCuaChucDanh,
  vieccanXuLy,
  tongQuanVanHanh,
  boNhiem,
  datQuyenChucDanh,
  luuChucDanh,
  ngungChucDanh,
  luuTo,
  datThanhVienTo,
  taoUyQuyen,
  thuHoiUyQuyen,
  danhSachUyQuyen,
  taoViec,
  capNhatViec,
  nhatKy,
};

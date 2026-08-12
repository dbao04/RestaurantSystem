/**
 * Nghiep vu quan ly bang cham cong (danh cho quan ly / ke toan / quan tri).
 *
 * Vi sao co file nay: cham cong thu cong da bi go bo, nhan vien chi cham duoc
 * bang khuon mat. Nhung thuc te van co truong hop khong the cham: camera hong,
 * ML service chet giua ca, nguoi moi chua kip dang ky mau. Neu khong co duong
 * nao sua lai thi bang cong thang do sai.
 *
 * Diem khac biet voi hai route /staff/clock-in cu da xoa:
 *   - Chi nguoi CO QUYEN `nhansu.cham_cong.sua` moi sua duoc, khong phai ai
 *     dang nhap cung cham duoc cho minh.
 *   - BAT BUOC nhap ly do. Khong co ly do thi khong ghi.
 *   - Moi thao tac ghi vao audit_logs kem nguoi thuc hien, gia tri truoc/sau.
 *   - Ban ghi bi sua duoc danh dau phuong_thuc = 'sua_tay', nen bao cao phan
 *     biet duoc dong nao la khuon mat that, dong nao la nguoi sua vao.
 *
 * Tuc la: van co loi thoat, nhung loi thoat co danh tinh va co dau vet.
 */
const db = require('../config/db');
const audit = require('./auditService');

/** Ghep 'HH:MM' cua mot ngay thanh chuoi DATETIME cho MySQL. */
function ghepGio(ngay, hhmm) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) throw new Error(`Giờ "${hhmm}" không hợp lệ, cần dạng HH:MM.`);
  const gio = Number(m[1]), phut = Number(m[2]);
  if (gio > 23 || phut > 59) throw new Error(`Giờ "${hhmm}" không hợp lệ.`);
  return `${ngay} ${String(gio).padStart(2, '0')}:${String(phut).padStart(2, '0')}:00`;
}

function chuanHoaNgay(ngay) {
  const s = String(ngay || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Ngày không hợp lệ.');
  return s;
}

/**
 * Bang cong mot ngay: MOI nhan vien dang lam viec deu co mot dong, ke ca nguoi
 * chua cham. Dung LEFT JOIN chu khong phai loc tu bang cham_cong, vi cai quan
 * ly can nhin nhat la ai CHUA cham - dieu ma mot bang chi chua nguoi da cham
 * khong bao gio noi ra duoc.
 */
async function bangNgay(ngay) {
  const n = chuanHoaNgay(ngay);
  const [rows] = await db.query(
    `SELECT n.id_nv, n.ma_nv, TRIM(n.ten) AS ten,
            cd.ten_cd, bp.ten_bp, bp.mau_sac,
            c.id_cc, c.gio_vao, c.gio_ra, c.tong_gio, c.ghi_chu,
            c.phuong_thuc_vao, c.phuong_thuc_ra,
            c.do_tin_cay_vao, c.do_tin_cay_ra,
            g.khoang_cach_m, g.hop_le AS gps_hop_le
     FROM nhan_vien n
     LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN bo_phan  bp ON bp.id_bp = cd.id_bp
     LEFT JOIN cham_cong c ON c.id_nv = n.id_nv AND c.ngay = ?
     LEFT JOIN cham_cong_gps g
            ON g.id_nv = n.id_nv AND DATE(g.thoi_diem) = ? AND g.hop_le = 1
           AND g.id = (SELECT MAX(g2.id) FROM cham_cong_gps g2
                        WHERE g2.id_nv = n.id_nv AND DATE(g2.thoi_diem) = ? AND g2.hop_le = 1)
     WHERE n.trangthai = 1
     ORDER BY (c.id_cc IS NULL) DESC, cd.cap_bac, n.ten`,
    [n, n, n]
  );
  return rows;
}

/** So lieu tom tat cua ngay - de len dau trang. */
async function tongQuanNgay(ngay) {
  const n = chuanHoaNgay(ngay);
  const [[r]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM nhan_vien WHERE trangthai = 1) AS tong_nv,
       COUNT(DISTINCT c.id_nv)                              AS da_cham,
       SUM(c.gio_ra IS NULL)                                AS chua_ra,
       SUM(c.phuong_thuc_vao = 'sua_tay' OR c.phuong_thuc_ra = 'sua_tay') AS sua_tay,
       ROUND(SUM(c.tong_gio), 2)                            AS tong_gio
     FROM cham_cong c WHERE c.ngay = ?`,
    [n]
  );
  const tong = Number(r.tong_nv || 0);
  const daCham = Number(r.da_cham || 0);
  return {
    tong_nv: tong,
    da_cham: daCham,
    chua_cham: Math.max(0, tong - daCham),
    chua_ra: Number(r.chua_ra || 0),
    sua_tay: Number(r.sua_tay || 0),
    tong_gio: Number(r.tong_gio || 0),
  };
}

/** Nhan vien dang lam viec - cho o chon khi them ban ghi thieu. */
async function dsNhanVien() {
  const [rows] = await db.query(
    `SELECT n.id_nv, n.ma_nv, TRIM(n.ten) AS ten, cd.ten_cd
     FROM nhan_vien n LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     WHERE n.trangthai = 1 ORDER BY cd.cap_bac, n.ten`
  );
  return rows;
}

/** Lich su sua chua cham cong - doc tu audit_logs. */
async function nhatKySua(gioiHan = 60) {
  try {
    const [rows] = await db.query(
      `SELECT id, action, actor_name, resource_id, details, created_at
       FROM audit_logs WHERE action LIKE 'cham_cong.%'
       ORDER BY id DESC LIMIT ?`,
      [Number(gioiHan)]
    );
    return rows.map(r => {
      let ct = null;
      try { ct = typeof r.details === 'string' ? JSON.parse(r.details) : r.details; } catch { ct = null; }
      return { ...r, details: ct };
    });
  } catch (e) {
    console.warn('[chamCongService] không đọc được nhật ký sửa:', e.message);
    return [];
  }
}

/** Thong tin nguoi thuc hien, lay tu phien dang nhap chu khong tu body. */
function nguoiThucHien(req) {
  if (req.hoSo) {
    return { id: req.hoSo.id_nv, ten: `${req.hoSo.ten}${req.hoSo.ten_cd ? ' (' + req.hoSo.ten_cd + ')' : ''}`, loai: 'staff' };
  }
  if (req.session && req.session.adminlogin) {
    return { id: req.session.adminid || null, ten: req.session.adminname || 'Quản trị', loai: 'admin' };
  }
  return { id: null, ten: 'Không rõ', loai: 'system' };
}

async function ghiAudit(req, hanhDong, idCc, chiTiet) {
  const ng = nguoiThucHien(req);
  await audit.log({
    action: 'cham_cong.' + hanhDong,
    actor_type: ng.loai, actor_id: ng.id, actor_name: ng.ten,
    resource_type: 'cham_cong', resource_id: idCc || null,
    status: 'success', details: chiTiet,
    ip_address: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    user_agent: req.get ? req.get('user-agent') : null,
  });
}

function batBuocLyDo(lyDo) {
  const s = String(lyDo || '').trim();
  // 8 ky tu de chan kieu ghi "ok" / "abc" cho co - ly do phai doc duoc ve sau.
  if (s.length < 8) throw new Error('Phải ghi lý do sửa (ít nhất 8 ký tự) — đây là dữ liệu tính lương.');
  if (s.length > 255) throw new Error('Lý do quá dài (tối đa 255 ký tự).');
  return s;
}

async function docBanGhi(idCc) {
  const [[r]] = await db.query(
    `SELECT c.*, TRIM(n.ten) AS ten FROM cham_cong c
     JOIN nhan_vien n ON n.id_nv = c.id_nv WHERE c.id_cc = ?`, [Number(idCc)]
  );
  if (!r) throw new Error('Không tìm thấy bản ghi chấm công.');
  return r;
}

const hhmm = (d) => d ? new Date(d).toTimeString().slice(0, 5) : null;

/**
 * Sua gio vao / gio ra cua mot ban ghi.
 *
 * Chi danh dau 'sua_tay' cho CHIEU thuc su bi doi. Neu quan ly chi sua gio ra
 * thi gio vao van giu nguyen phuong_thuc 'khuon_mat' - de bao cao khong bao la
 * ca dong deu la sua tay trong khi mot nua van co bang chung khuon mat.
 */
async function sua(req, idCc, { gioVao, gioRa, lyDo }) {
  const ly = batBuocLyDo(lyDo);
  const cu = await docBanGhi(idCc);
  const ngay = chuanHoaNgay(cu.ngay instanceof Date ? cu.ngay.toISOString() : cu.ngay);

  const vaoMoi = gioVao === undefined ? undefined : (gioVao ? ghepGio(ngay, gioVao) : null);
  const raMoi = gioRa === undefined ? undefined : (gioRa ? ghepGio(ngay, gioRa) : null);

  const vaoCuoi = vaoMoi === undefined ? cu.gio_vao : vaoMoi;
  const raCuoi = raMoi === undefined ? cu.gio_ra : raMoi;
  if (!vaoCuoi && raCuoi) throw new Error('Không thể có giờ ra mà không có giờ vào.');
  if (vaoCuoi && raCuoi && new Date(raCuoi) <= new Date(vaoCuoi)) {
    throw new Error('Giờ ra phải sau giờ vào.');
  }

  const doiVao = vaoMoi !== undefined && hhmm(vaoMoi) !== hhmm(cu.gio_vao);
  const doiRa = raMoi !== undefined && hhmm(raMoi) !== hhmm(cu.gio_ra);
  if (!doiVao && !doiRa) throw new Error('Không có gì thay đổi.');

  const dat = [], tham = [];
  if (doiVao) {
    dat.push('gio_vao = ?', "phuong_thuc_vao = 'sua_tay'", 'do_tin_cay_vao = NULL');
    tham.push(vaoMoi);
  }
  if (doiRa) {
    dat.push('gio_ra = ?', "phuong_thuc_ra = 'sua_tay'", 'do_tin_cay_ra = NULL');
    tham.push(raMoi);
  }
  // tong_gio tinh lai tu hai moc cuoi cung, khong tin gia tri cu.
  dat.push(`tong_gio = CASE WHEN gio_vao IS NOT NULL AND gio_ra IS NOT NULL
              THEN ROUND(TIMESTAMPDIFF(MINUTE, gio_vao, gio_ra)/60, 2) ELSE NULL END`);
  dat.push("ghi_chu = TRIM(CONCAT(COALESCE(ghi_chu,''), ' | ', ?))");
  tham.push(`[Sửa ${new Date().toLocaleString('vi-VN')}] ${ly}`);

  tham.push(Number(idCc));
  await db.query(`UPDATE cham_cong SET ${dat.join(', ')} WHERE id_cc = ?`, tham);

  const moi = await docBanGhi(idCc);
  await ghiAudit(req, 'sua', idCc, {
    id_nv: cu.id_nv, ten: cu.ten, ngay,
    truoc: { gio_vao: hhmm(cu.gio_vao), gio_ra: hhmm(cu.gio_ra), tong_gio: cu.tong_gio },
    sau: { gio_vao: hhmm(moi.gio_vao), gio_ra: hhmm(moi.gio_ra), tong_gio: moi.tong_gio },
    ly_do: ly,
  });
  return moi;
}

/** Them ban ghi cho nguoi khong cham duoc (camera hong, chua dang ky mau...). */
async function them(req, { idNv, ngay, gioVao, gioRa, lyDo }) {
  const ly = batBuocLyDo(lyDo);
  const n = chuanHoaNgay(ngay);
  const id = Number(idNv);
  if (!id) throw new Error('Chưa chọn nhân viên.');

  const [[nv]] = await db.query(
    'SELECT TRIM(ten) AS ten FROM nhan_vien WHERE id_nv = ? AND trangthai = 1', [id]
  );
  if (!nv) throw new Error('Không tìm thấy nhân viên đang làm việc.');

  const vao = ghepGio(n, gioVao);
  if (!vao) throw new Error('Phải có giờ vào.');
  const ra = gioRa ? ghepGio(n, gioRa) : null;
  if (ra && new Date(ra) <= new Date(vao)) throw new Error('Giờ ra phải sau giờ vào.');

  const [[trung]] = await db.query(
    'SELECT COUNT(*) n FROM cham_cong WHERE id_nv = ? AND ngay = ?', [id, n]
  );
  if (Number(trung.n) > 0) {
    throw new Error(`${nv.ten} đã có bản ghi chấm công ngày này. Hãy sửa bản ghi đó thay vì thêm mới.`);
  }

  const [kq] = await db.query(
    `INSERT INTO cham_cong (id_nv, ngay, gio_vao, gio_ra, tong_gio,
                            phuong_thuc_vao, phuong_thuc_ra, ghi_chu)
     VALUES (?, ?, ?, ?, ?, 'sua_tay', ?, ?)`,
    [id, n, vao, ra,
     ra ? Math.round(((new Date(ra) - new Date(vao)) / 3600000) * 100) / 100 : null,
     ra ? 'sua_tay' : null,
     `[Thêm ${new Date().toLocaleString('vi-VN')}] ${ly}`]
  );

  await ghiAudit(req, 'them', kq.insertId, {
    id_nv: id, ten: nv.ten, ngay: n,
    sau: { gio_vao: gioVao, gio_ra: gioRa || null }, ly_do: ly,
  });
  return { id_cc: kq.insertId };
}

/** Xoa ban ghi. Luu nguyen ban ghi cu vao audit de con phuc hoi duoc. */
async function xoa(req, idCc, lyDo) {
  const ly = batBuocLyDo(lyDo);
  const cu = await docBanGhi(idCc);
  await db.query('DELETE FROM cham_cong WHERE id_cc = ?', [Number(idCc)]);
  await ghiAudit(req, 'xoa', idCc, {
    id_nv: cu.id_nv, ten: cu.ten,
    ngay: chuanHoaNgay(cu.ngay instanceof Date ? cu.ngay.toISOString() : cu.ngay),
    truoc: { gio_vao: hhmm(cu.gio_vao), gio_ra: hhmm(cu.gio_ra), tong_gio: cu.tong_gio },
    ly_do: ly,
  });
  return { ok: true };
}

module.exports = {
  bangNgay, tongQuanNgay, dsNhanVien, nhatKySua,
  sua, them, xoa,
};

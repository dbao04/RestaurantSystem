/**
 * TU DONG PHAN DON GIAO HANG - chia deu cho shipper.
 *
 * QUY TAC CHON NGUOI (theo thu tu uu tien, xem `xepHang`):
 *   0. Du dieu kien: trong ca (khong 'nghi'), con suc chua (dang cam < toi da),
 *      chua tung tu choi / bo lo don nay.
 *   1. TAI TRONG NGAY it nhat - so don (hoac tong phi ship, tuy cau hinh) da
 *      nhan hom nay. Day la tieu chi "chia deu".
 *   2. Dang cam it don hon (de don toi nhanh hon).
 *   3. Dang online (GPS moi) truoc nguoi mat tin hieu.
 *   4. Doi lau nhat ke tu lan duoc phan gan nhat - xoay vong khi bang tai.
 *   5. Gan nha hang hon (lay hang nhanh hon).
 *
 * GHEP DON (bat/tat trong cau hinh, xem `danhGiaGhep`):
 *   Shipper DANG CHO LAY don o quan (moi don cua ho con 'da_phan'/'dang_lay',
 *   chua ai xuat phat) ma don moi tien duong - chen vao lo trinh toi uu chi
 *   phai di vong them <= `ghep_them_km` km va chuyen chua qua `ghep_so_diem`
 *   diem - thi duoc uu tien ngay sau tieu chi "dang mo app". Mot chuyen giao
 *   2-3 nha gan nhau nhanh hon hai shipper chay hai chuyen rieng.
 *   Shipper da roi quan (co don 'dang_giao') khong ghep them: phai quay ve lay.
 *
 * XAC NHAN: don phan tu dong o trang thai cho shipper bam "Nhan don" trong N
 * phut. Tu choi / qua han -> go ra, ghi lai, phan cho nguoi KE TIEP (loai tru
 * nguoi vua tu choi). Don bi tu choi KHONG tinh vao tai cua nguoi do vi
 * `id_shipper` cua don da doi sang nguoi khac.
 *
 * HANG CHO: khong ai du dieu kien -> don nam o 'cho_phan'. Phan lai khi co
 * nguoi giao xong / vao ca (goi `phanHangCho`), va tac vu nen moi 30 giay.
 *
 * DONG THOI: moi lan chon + phan nam trong GET_LOCK cua MySQL - hai don toi
 * cung mot giay khong the cung nhet vao suat cuoi cung cua mot shipper.
 */
const db = require('../config/db');
const vc = require('./vanChuyenService');
const realtime = require('./realtime');

const KHOA = 'phan_cong_giao_hang';
const HE_THONG = { id_nv: null, ten: 'Hệ thống (tự động)' };

async function thamSo() {
  const [rows] = await db.query("SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'giao_hang.%'");
  const c = Object.fromEntries(rows.map((r) => [r.khoa, r.gia_tri]));
  return {
    tu_dong: c['giao_hang.tu_dong_phan'] !== '0',
    tieu_chi: c['giao_hang.tieu_chi_chia'] === 'thu_nhap' ? 'thu_nhap' : 'so_don',
    phut_xac_nhan: Math.min(30, Math.max(1, Number(c['giao_hang.phut_cho_xac_nhan']) || 3)),
    phut_mat_tin_hieu: Math.max(2, Number(c['giao_hang.phut_mat_tin_hieu']) || 10),
    chi_trong_khu_vuc: c['giao_hang.chi_trong_khu_vuc'] !== '0',
    // Chong vong phan lai vo han: sau N lan tu phan ma khong ai nhan, hoac don
    // da qua X gio ke tu luc tao, dung tu phan va bao dieu phoi xu ly tay.
    so_lan_toi_da: Math.min(20, Math.max(1, Number(c['giao_hang.so_lan_tu_phan_toi_da']) || 3)),
    gio_toi_da: Math.min(72, Math.max(1, Number(c['giao_hang.gio_toi_da_tu_phan']) || 12)),
    // Ghep don cung huong vao mot chuyen.
    ghep_bat: c['giao_hang.ghep_bat'] !== '0',
    ghep_them_km: Math.min(10, Math.max(0.3, Number(c['giao_hang.ghep_them_km']) || 2)),
    ghep_so_diem: Math.min(8, Math.max(2, Math.round(Number(c['giao_hang.ghep_so_diem'])) || 3)),
  };
}

async function luuThamSo(d) {
  const ghi = [];
  if (d.tu_dong !== undefined) ghi.push(['giao_hang.tu_dong_phan', d.tu_dong ? '1' : '0']);
  if (d.chi_trong_khu_vuc !== undefined) ghi.push(['giao_hang.chi_trong_khu_vuc', d.chi_trong_khu_vuc ? '1' : '0']);
  if (['so_don', 'thu_nhap'].includes(d.tieu_chi)) ghi.push(['giao_hang.tieu_chi_chia', d.tieu_chi]);
  if (Number(d.phut_xac_nhan) >= 1) ghi.push(['giao_hang.phut_cho_xac_nhan', String(Math.min(30, Math.round(d.phut_xac_nhan)))]);
  if (d.ghep_bat !== undefined) ghi.push(['giao_hang.ghep_bat', d.ghep_bat ? '1' : '0']);
  if (Number(d.ghep_them_km) > 0) ghi.push(['giao_hang.ghep_them_km', String(Math.min(10, Math.max(0.3, Math.round(Number(d.ghep_them_km) * 10) / 10)))]);
  if (Number(d.ghep_so_diem) >= 2) ghi.push(['giao_hang.ghep_so_diem', String(Math.min(8, Math.round(Number(d.ghep_so_diem))))]);
  for (const [k, v] of ghi) {
    await db.query('INSERT INTO cau_hinh (khoa, gia_tri) VALUES (?, ?) ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)', [k, v]);
  }
}

// ------------------------------------------------------------------ bang cong bang

/**
 * Tinh hinh moi shipper hom nay - dung cho ca thuat toan lan man hinh.
 * `tai` = so don hoac tong phi, tuy tieu chi.
 */
async function bangShipper(ts) {
  ts = ts || await thamSo();
  await require('./shipperNghiepVu').damBaoCauTruc();
  const [rows] = await db.query(`
    SELECT s.id_shipper, COALESCE(nv.ten, s.ten) AS ten, s.sdt, s.trang_thai, s.so_don_toi_da, s.loai_xe, s.bien_so, s.khu_vuc,
           (SELECT COUNT(*) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai IN ('da_phan','dang_lay','dang_giao')) AS dang_cam,
           (SELECT COUNT(*) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai <> 'huy' AND DATE(g.phan_luc) = CURDATE()) AS don_hom_nay,
           (SELECT COUNT(*) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai = 'da_giao' AND DATE(g.hoan_tat_luc) = CURDATE()) AS da_giao_hom_nay,
           (SELECT COALESCE(SUM(g.phi_giao),0) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai <> 'huy' AND DATE(g.phan_luc) = CURDATE()) AS phi_hom_nay,
           (SELECT MAX(g.phan_luc) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper) AS phan_gan_nhat,
           (SELECT COUNT(*) FROM phan_cong_giao p WHERE p.id_shipper = s.id_shipper
              AND p.ket_qua = 'tu_choi' AND DATE(p.tao_luc) = CURDATE()) AS tu_choi_hom_nay,
           (SELECT COUNT(*) FROM phan_cong_giao p WHERE p.id_shipper = s.id_shipper
              AND p.ket_qua = 'het_han' AND DATE(p.tao_luc) = CURDATE()) AS het_han_hom_nay,
           v.vi_do, v.kinh_do, TIMESTAMPDIFF(MINUTE, v.luc, NOW()) AS phut_gps
      FROM shipper s
      JOIN don_vi_van_chuyen dv ON dv.id_dv = s.id_dv AND dv.loai = 'noi_bo' AND dv.trang_thai = 1
      LEFT JOIN nhan_vien nv ON nv.id_nv = s.id_nv
      LEFT JOIN vi_tri_shipper_moi_nhat v ON v.id_shipper = s.id_shipper
     ORDER BY s.id_shipper`);
  const goc = await vc.toaDoNhaHang();
  return rows.map((r) => {
    const n = (x) => Number(x) || 0;
    const online = r.phut_gps != null && n(r.phut_gps) <= ts.phut_mat_tin_hieu;
    const kmNH = goc && r.vi_do != null ? vc.khoangCachKm(goc.vi_do, goc.kinh_do, r.vi_do, r.kinh_do) : null;
    return {
      ...r,
      ten: String(r.ten || '').trim(),
      dang_cam: n(r.dang_cam), don_hom_nay: n(r.don_hom_nay), da_giao_hom_nay: n(r.da_giao_hom_nay),
      phi_hom_nay: n(r.phi_hom_nay), tu_choi_hom_nay: n(r.tu_choi_hom_nay), het_han_hom_nay: n(r.het_han_hom_nay),
      so_don_toi_da: n(r.so_don_toi_da),
      trong_ca: r.trang_thai !== 'nghi',
      con_suc_chua: n(r.dang_cam) < n(r.so_don_toi_da),
      online, km_toi_nha_hang: kmNH,
      tai: ts.tieu_chi === 'thu_nhap' ? n(r.phi_hom_nay) : n(r.don_hom_nay),
      // Khu phu trach ([] = giao moi khu).
      khu: String(r.khu_vuc || '').split(',').map((x) => x.trim()).filter(Boolean),
    };
  });
}

/**
 * Loc theo KHU VUC cua don: shipper phu trach dung khu do truoc; neu khong ai
 * trong so do du dieu kien thi moi toi shipper giao moi khu. Shipper chi phu
 * trach KHU KHAC thi khong nhan don nay.
 */
function locTheoKhu(ds, maKhu, ts) {
  if (!maKhu || !ts.chi_trong_khu_vuc) return ds;
  const dungKhu = ds.filter((s) => s.khu.includes(maKhu));
  return dungKhu.length ? dungKhu : ds.filter((s) => !s.khu.length);
}

/** Sap xep ung vien theo quy tac o dau file. Tra ve [] neu khong ai du dieu kien. */
function xepHang(ds, loaiTru = new Set()) {
  return ds
    .filter((s) => s.trong_ca && s.con_suc_chua && !loaiTru.has(Number(s.id_shipper)))
    .sort((a, b) =>
      // Nguoi DANG MO APP (GPS moi) truoc: phan cho nguoi khong cam may chi
      // lam don mat 3 phut cho xac nhan roi lai chuyen.
      Number(b.online) - Number(a.online) ||
      // Ghep chuyen: nguoi dang cho lay don cung huong, it phai di vong nhat.
      Number(!!b.ghep) - Number(!!a.ghep) ||
      (a.ghep && b.ghep ? a.ghep.them_km - b.ghep.them_km : 0) ||
      a.tai - b.tai ||
      a.dang_cam - b.dang_cam ||
      (a.phan_gan_nhat ? new Date(a.phan_gan_nhat).getTime() : 0) - (b.phan_gan_nhat ? new Date(b.phan_gan_nhat).getTime() : 0) ||
      (a.km_toi_nha_hang ?? 99) - (b.km_toi_nha_hang ?? 99) ||
      a.id_shipper - b.id_shipper);
}

/**
 * Danh dau shipper nao GHEP duoc don moi vao chuyen dang cho lay (s.ghep).
 * Dieu kien: dang cam >= 1 don, MOI don con o quan ('da_phan'/'dang_lay'),
 * them don moi khong vuot `ghep_so_diem`, va so km di vong them (lo trinh toi
 * uu truoc / sau khi chen) <= `ghep_them_km`. Thieu toa do -> khong ghep.
 */
async function danhGiaGhep(ds, don, ts) {
  if (!ts.ghep_bat || !don) return;
  const lt = require('./loTrinhGiao');
  if (!lt.coToaDo(don)) return;
  const coDon = ds.filter((s) => s.dang_cam > 0);
  if (!coDon.length) return;
  const goc = await vc.toaDoNhaHang();
  if (!lt.coToaDo(goc)) return;
  const [rows] = await db.query(
    `SELECT id_giao, id_shipper, trang_thai, vi_do, kinh_do, du_kien_luc FROM don_giao_hang
      WHERE id_shipper IN (?) AND trang_thai IN ('da_phan','dang_lay','dang_giao') AND id_giao <> ?`,
    [coDon.map((s) => s.id_shipper), don.id_giao]);
  const han = (d) => (d.du_kien_luc ? new Date(d.du_kien_luc).getTime() : null);
  for (const s of coDon) {
    const cua = rows.filter((r) => Number(r.id_shipper) === Number(s.id_shipper));
    if (!cua.length || cua.some((r) => r.trang_thai === 'dang_giao')) continue;   // da roi quan
    if (cua.length + 1 > ts.ghep_so_diem) continue;
    const kq = lt.kmThemKhiGhep(goc,
      cua.map((r) => ({ id: r.id_giao, vi_do: r.vi_do, kinh_do: r.kinh_do, han: han(r) })),
      { id: don.id_giao, vi_do: don.vi_do, kinh_do: don.kinh_do, han: han(don) });
    if (!kq || kq.them_km > ts.ghep_them_km) continue;
    s.ghep = { them_km: Math.round(kq.them_km * 10) / 10, so_don: cua.length, km_chuyen: Math.round(kq.km_sau * 10) / 10 };
  }
}

function lyDoChon(s, ts, soUngVien) {
  const p = [
    ts.tieu_chi === 'thu_nhap'
      ? `ít phí ship nhất hôm nay (${Math.round(s.phi_hom_nay).toLocaleString('vi-VN')}đ)`
      : `ít đơn nhất hôm nay (${s.don_hom_nay} đơn)`,
    s.dang_cam ? `đang cầm ${s.dang_cam}/${s.so_don_toi_da}` : 'đang rảnh',
    s.online ? 'đang online' : 'chưa có GPS gần đây',
  ];
  if (s.km_toi_nha_hang != null) p.push(`cách nhà hàng ${s.km_toi_nha_hang} km`);
  if (s.ghep) p.unshift(`ghép chuyến với ${s.ghep.so_don} đơn đang chờ lấy (đi vòng thêm ~${s.ghep.them_km} km, cả chuyến ~${s.ghep.km_chuyen} km)`);
  return `Chọn trong ${soUngVien} người: ${p.join(' · ')}`.slice(0, 300);
}

/**
 * Shipper da tu choi / bo lo don nay GAN DAY. Chi tinh 15 phut gan nhat: truoc
 * day loai tru vinh vien, nen khi ca doi deu da bo lo mot luot thi don ket mai
 * o "Cho phan" du shipper da quay lai cam may.
 */
async function nguoiDaLoaiTru(idGiao) {
  const [r] = await db.query(
    `SELECT DISTINCT id_shipper FROM phan_cong_giao
      WHERE id_giao = ? AND ket_qua IN ('tu_choi','het_han') AND COALESCE(phan_hoi_luc, tao_luc) > NOW() - INTERVAL 15 MINUTE`,
    [idGiao]);
  return new Set(r.map((x) => Number(x.id_shipper)));
}

/**
 * CO NEN DUNG TU PHAN DON NAY KHONG?
 *
 * Truoc day: shipper khong bam nhan trong N phut -> go ra, phan nguoi khac; nguoi
 * bo lo chi bi loai tru 15 phut -> het 15 phut ca doi lai du dieu kien -> vong
 * phan chay MAI MAI (don GH1107-001 tao tu 07/11 bi phan lai moi 3-8 phut, moi
 * lan mot thong bao "Ban duoc phan don" cho shipper).
 *
 * Dung khi:
 *   - da co `so_lan_toi_da` lan tu phan lien tiep ket thuc tu choi / qua han
 *     (tinh tu lan dieu phoi phan tay gan nhat - phan tay = bat dau vong moi), hoac
 *   - don da tao qua `gio_toi_da` gio (mon da nguoi, khach co the da huy).
 * Don dung o 'cho_phan' cho dieu phoi; dieu phoi duoc bao MOT lan moi vong.
 * @returns {Promise<string|null>} ly do dung, null = cu phan tiep
 */
async function lyDoDungTuPhan(idGiao, ts) {
  const [[d]] = await db.query(
    'SELECT ma_giao, TIMESTAMPDIFF(MINUTE, tao_luc, NOW()) AS phut_tuoi FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  if (!d) return null;
  const [[tay]] = await db.query(
    "SELECT COALESCE(MAX(id), 0) AS id FROM phan_cong_giao WHERE id_giao = ? AND kieu = 'thu_cong'", [idGiao]);
  const [[lo]] = await db.query(
    `SELECT COUNT(*) AS n FROM phan_cong_giao
      WHERE id_giao = ? AND id > ? AND kieu = 'tu_dong' AND ket_qua IN ('tu_choi', 'het_han')`, [idGiao, tay.id]);
  let lyDo = null;
  if (Number(lo.n) >= ts.so_lan_toi_da) lyDo = `${lo.n} lần tự phân liên tiếp không shipper nào nhận`;
  else if (Number(d.phut_tuoi) > ts.gio_toi_da * 60) lyDo = `đơn đã tạo quá ${ts.gio_toi_da} giờ`;
  if (lyDo) await baoDieuPhoiDonKet(idGiao, d.ma_giao, lyDo, tay.id);
  return lyDo;
}

async function baoDieuPhoiDonKet(idGiao, maGiao, lyDo, vong) {
  try {
    const nv = require('./thongBaoNghiepVu');
    if (await nv.daBao(`giao_ket:${idGiao}:${vong}`)) return;   // da bao trong vong nay
    await require('./thongBaoService').gui('don_giao_ket', {
      tieuDe: `Đơn giao ${maGiao} cần điều phối xử lý`,
      noiDung: `Đã dừng tự phân: ${lyDo}. Phân tay cho shipper, gọi khách xác nhận hoặc hủy đơn.`,
      link: `/staff/giao-hang/${idGiao}`, nguoiGui: HE_THONG.ten,
    });
  } catch (e) {
    console.error('[phan-cong-giao] bao don ket:', e.message);
  }
}

async function voiKhoa(fn) {
  const conn = await db.getConnection();
  try {
    const [[k]] = await conn.query('SELECT GET_LOCK(?, 10) AS ok', [KHOA]);
    if (!k || Number(k.ok) !== 1) return null;
    try { return await fn(); } finally { await conn.query('SELECT RELEASE_LOCK(?)', [KHOA]); }
  } finally {
    conn.release();
  }
}

function baoDoi(don) {
  try {
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    if (don) realtime.donGiaoDoi({ ...don, nhan: don.tt ? don.tt.nhan : null });
  } catch (_) { /* realtime chua san sang (chay tu script) */ }
}

// ------------------------------------------------------------------ phan don

/**
 * Tu dong phan MOT don dang 'cho_phan'.
 * @returns {Promise<{phan: boolean, id_shipper?, ten?, ly_do}>}
 */
async function tuDongPhan(idGiao, { batBuoc = false } = {}) {
  const ts = await thamSo();
  if (!ts.tu_dong && !batBuoc) return { phan: false, ly_do: 'Đang tắt tự động phân đơn.' };
  return voiKhoa(async () => {
    const [[don]] = await db.query('SELECT id_giao, trang_thai, id_shipper, ma_khu_vuc, vi_do, kinh_do, du_kien_luc FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
    if (!don) return { phan: false, ly_do: 'Không tìm thấy đơn.' };
    if (don.trang_thai !== 'cho_phan' || don.id_shipper) return { phan: false, ly_do: 'Đơn đã có người nhận.' };
    // Don hen gio: chi phan tu (gio hen - phut_len_bep_truoc) - khong de shipper cam don cua ngay mai.
    const [[sd]] = await db.query('SELECT sesis FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
    const chuaToi = sd && await require('./chinhSachGiaoService').henChuaToi(sd.sesis);
    if (chuaToi && !batBuoc) {
      return { phan: false, hen_gio: true, ly_do: `Đơn hẹn giờ – tự phân shipper từ ${String(chuaToi.getHours()).padStart(2, '0')}:${String(chuaToi.getMinutes()).padStart(2, '0')} ngày ${chuaToi.getDate()}/${chuaToi.getMonth() + 1}.` };
    }
    const dung = await lyDoDungTuPhan(idGiao, ts);
    if (dung) return { phan: false, can_xu_ly_tay: true, ly_do: `Dừng tự phân (${dung}) – chờ điều phối xử lý.` };

    const ds = await bangShipper(ts);
    await danhGiaGhep(ds, don, ts);
    const loaiTru = await nguoiDaLoaiTru(idGiao);
    // Thu trong shipper dung khu truoc; khong ai ranh moi toi shipper giao moi khu.
    let ung = xepHang(locTheoKhu(ds, don.ma_khu_vuc, ts), loaiTru);
    if (!ung.length && don.ma_khu_vuc && ts.chi_trong_khu_vuc) {
      ung = xepHang(ds.filter((s) => !s.khu.length), loaiTru);
    }
    if (!ung.length) return { phan: false, ly_do: 'Không có shipper nào rảnh – đơn vào hàng chờ.' };

    const chon = ung[0];
    const lyDo = (chon.khu.includes(don.ma_khu_vuc) ? `Phụ trách khu ${don.ma_khu_vuc} · ` : '') + lyDoChon(chon, ts, ung.length);
    await vc.phanShipper(idGiao, chon.id_shipper, HE_THONG);
    await db.query('UPDATE don_giao_hang SET phan_tu_dong = 1, xac_nhan_luc = NULL WHERE id_giao = ?', [idGiao]);
    await db.query(
      "INSERT INTO phan_cong_giao (id_giao, id_shipper, kieu, ket_qua, ly_do_chon, tao_luc) VALUES (?, ?, 'tu_dong', 'cho_xac_nhan', ?, NOW())",
      [idGiao, chon.id_shipper, lyDo]);
    baoDoi(await vc.donGiao(idGiao));
    return { phan: true, id_shipper: chon.id_shipper, ten: chon.ten, ly_do: lyDo };
  }).then((kq) => kq || { phan: false, ly_do: 'Hệ thống đang bận phân đơn khác.' });
}

/** Phan lan luot moi don dang cho (cu nhat truoc). */
async function phanHangCho() {
  const ts = await thamSo();
  if (!ts.tu_dong) return { da_phan: 0 };
  const [cho] = await db.query(
    `SELECT id_giao FROM don_giao_hang
      WHERE trang_thai = 'cho_phan' AND id_shipper IS NULL AND tao_luc > NOW() - INTERVAL ? HOUR
      ORDER BY tao_luc LIMIT 50`, [ts.gio_toi_da]);
  let daPhan = 0;
  for (const d of cho) {
    const kq = await tuDongPhan(d.id_giao);
    if (kq.phan) daPhan++;
    else if (/Không có shipper/.test(kq.ly_do || '')) break; // het nguoi ranh, dung som
  }
  return { da_phan: daPhan, con_cho: cho.length - daPhan };
}

/** Ghi lai mot lan phan TAY cua dieu phoi (de bang cong bang va nhat ky day du). */
async function ghiPhanTay(idGiao, idShipper) {
  await db.query(
    "UPDATE phan_cong_giao SET ket_qua = 'bi_go', ly_do_ket_thuc = 'Điều phối phân lại bằng tay', phan_hoi_luc = NOW() WHERE id_giao = ? AND ket_qua = 'cho_xac_nhan'",
    [idGiao]);
  await db.query(
    "INSERT INTO phan_cong_giao (id_giao, id_shipper, kieu, ket_qua, ly_do_chon, tao_luc, phan_hoi_luc) VALUES (?, ?, 'thu_cong', 'da_nhan', 'Điều phối chọn trực tiếp', NOW(), NOW())",
    [idGiao, idShipper]);
  await db.query('UPDATE don_giao_hang SET phan_tu_dong = 0, xac_nhan_luc = NOW() WHERE id_giao = ?', [idGiao]);
}

// ------------------------------------------------------------------ phan hoi cua shipper

async function donCuaShipperChoXacNhan(idGiao, idShipper) {
  const [[d]] = await db.query('SELECT * FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  if (!d) throw new Error('Không tìm thấy đơn.');
  if (Number(d.id_shipper) !== Number(idShipper)) throw new Error('Đơn này không còn là của bạn (có thể đã quá thời gian xác nhận).');
  if (d.trang_thai !== 'da_phan') throw new Error('Đơn đã bắt đầu giao, không nhận / từ chối được nữa.');
  return d;
}

async function xacNhan(idGiao, idShipper) {
  const d = await donCuaShipperChoXacNhan(idGiao, idShipper);
  if (d.xac_nhan_luc) return { ok: true };
  await db.query('UPDATE don_giao_hang SET xac_nhan_luc = NOW() WHERE id_giao = ?', [idGiao]);
  await db.query(
    "UPDATE phan_cong_giao SET ket_qua = 'da_nhan', phan_hoi_luc = NOW() WHERE id_giao = ? AND id_shipper = ? AND ket_qua = 'cho_xac_nhan'",
    [idGiao, idShipper]);
  await db.query(
    "INSERT INTO nhat_ky_giao_hang (id_giao, tu_trang_thai, den_trang_thai, ten_nguoi, ghi_chu) VALUES (?, 'da_phan', 'da_phan', 'Shipper', 'Shipper đã xác nhận nhận đơn')",
    [idGiao]);
  baoDoi(await vc.donGiao(idGiao));
  return { ok: true };
}

async function tuChoi(idGiao, idShipper, lyDo, nguoi = {}) {
  const d = await donCuaShipperChoXacNhan(idGiao, idShipper);
  if (d.xac_nhan_luc) throw new Error('Bạn đã nhận đơn này – muốn trả đơn hãy gọi điều phối.');
  const ly = String(lyDo || '').trim() || 'Không ghi lý do';
  await db.query(
    "UPDATE phan_cong_giao SET ket_qua = 'tu_choi', ly_do_ket_thuc = ?, phan_hoi_luc = NOW() WHERE id_giao = ? AND id_shipper = ? AND ket_qua = 'cho_xac_nhan'",
    [ly.slice(0, 300), idGiao, idShipper]);
  await vc.goShipper(idGiao, nguoi, `Shipper từ chối: ${ly}`);
  const kq = await tuDongPhan(idGiao, { batBuoc: true });
  baoDoi(await vc.donGiao(idGiao));
  return kq;
}

/** Don phan tu dong qua han chua xac nhan -> chuyen nguoi khac. */
async function quetHetHan() {
  const ts = await thamSo();
  const [qua] = await db.query(`
    SELECT id_giao, id_shipper FROM don_giao_hang
     WHERE trang_thai = 'da_phan' AND phan_tu_dong = 1 AND xac_nhan_luc IS NULL
       AND phan_luc < NOW() - INTERVAL ? MINUTE`, [ts.phut_xac_nhan]);
  for (const d of qua) {
    await db.query(
      "UPDATE phan_cong_giao SET ket_qua = 'het_han', ly_do_ket_thuc = ?, phan_hoi_luc = NOW() WHERE id_giao = ? AND id_shipper = ? AND ket_qua = 'cho_xac_nhan'",
      [`Quá ${ts.phut_xac_nhan} phút không xác nhận`, d.id_giao, d.id_shipper]);
    await vc.goShipper(d.id_giao, HE_THONG, `Quá ${ts.phut_xac_nhan} phút không xác nhận`).catch(() => {});
    await tuDongPhan(d.id_giao, { batBuoc: true });
  }
  return qua.length;
}

// ------------------------------------------------------------------ man hinh dieu phoi

async function nhatKyHomNay(gioiHan = 60) {
  const [rows] = await db.query(`
    SELECT p.*, g.ma_giao, g.dia_chi_giao, g.ma_khu_vuc, COALESCE(nv.ten, s.ten) AS ten_shipper
      FROM phan_cong_giao p
      JOIN don_giao_hang g ON g.id_giao = p.id_giao
      JOIN shipper s ON s.id_shipper = p.id_shipper
      LEFT JOIN nhan_vien nv ON nv.id_nv = s.id_nv
     WHERE DATE(p.tao_luc) = CURDATE()
     ORDER BY p.tao_luc DESC LIMIT ?`, [gioiHan]);
  return rows;
}

/**
 * Vi sao tung don dang nam o 'cho_phan' - de man hinh dieu phoi ghi DUNG ly do
 * (truoc day luon ghi "chua co shipper ranh", ke ca khi shipper ranh ca).
 *   hen_gio : don hen gio, chua toi luc tu phan (gio hen - phut_len_bep_truoc)
 *   ket     : da dung tu phan (qua gio_toi_da gio / so_lan_toi_da lan khong ai nhan) -> can xu ly tay
 *   dang_tim: dang cho shipper du dieu kien (het suc chua, ngoai khu, ...)
 * Cung dieu kien voi lyDoDungTuPhan / tuDongPhan, nhung chi DOC - khong gui thong bao.
 */
async function phanLoaiDonCho(ts) {
  const ds = await vc.dsDonGiao({ trangThai: 'cho_phan', dangChay: false, gioiHan: 100 });
  if (!ds.length) return [];
  const [lo] = await db.query(
    `SELECT p.id_giao, COUNT(*) AS n FROM phan_cong_giao p
      WHERE p.id_giao IN (?) AND p.kieu = 'tu_dong' AND p.ket_qua IN ('tu_choi', 'het_han')
        AND p.id > COALESCE((SELECT MAX(t.id) FROM phan_cong_giao t WHERE t.id_giao = p.id_giao AND t.kieu = 'thu_cong'), 0)
      GROUP BY p.id_giao`, [ds.map((d) => d.id_giao)]);
  const soLo = new Map(lo.map((r) => [Number(r.id_giao), Number(r.n)]));
  const gio = (d) => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return ds.map((d) => {
    const n = soLo.get(Number(d.id_giao)) || 0;
    const phutTuoi = (Date.now() - new Date(d.tao_luc).getTime()) / 60000;
    let loai = 'dang_tim';
    let lyDo = 'Đang chờ shipper đủ điều kiện (còn suất, đúng khu)';
    if (d.cho_hen) {
      loai = 'hen_gio';
      lyDo = `Hẹn giao ${gio(d.hen_gio)} – tự phân lúc ${gio(d.tu_phan_luc)}`;
    } else if (n >= ts.so_lan_toi_da) {
      loai = 'ket'; lyDo = `${n} lần tự phân liên tiếp không shipper nào nhận`;
    } else if (phutTuoi > ts.gio_toi_da * 60) {
      loai = 'ket'; lyDo = `Đơn đã tạo quá ${ts.gio_toi_da} giờ`;
    }
    return { id_giao: d.id_giao, ma_giao: d.ma_giao, dia_chi_giao: d.dia_chi_giao, tao_luc: d.tao_luc, loai, ly_do: lyDo };
  });
}

async function tongQuan() {
  const ts = await thamSo();
  const [bang, [[dem]], nhatKy] = await Promise.all([
    bangShipper(ts),
    db.query(`SELECT SUM(trang_thai = 'cho_phan') AS cho_phan,
                     SUM(trang_thai = 'da_phan' AND phan_tu_dong = 1 AND xac_nhan_luc IS NULL) AS cho_xac_nhan,
                     SUM(trang_thai IN ('da_phan','dang_lay','dang_giao')) AS dang_chay
                FROM don_giao_hang WHERE trang_thai NOT IN ('da_giao','huy')`),
    nhatKyHomNay(),
  ]);
  const trongCa = bang.filter((s) => s.trong_ca);
  const tai = trongCa.map((s) => s.tai);
  const donCho = await phanLoaiDonCho(ts);
  return {
    ts, bang, don_cho: donCho,
    so_cho_hen: donCho.filter((d) => d.loai === 'hen_gio').length,
    so_ket: donCho.filter((d) => d.loai === 'ket').length,
    so_dang_tim: donCho.filter((d) => d.loai === 'dang_tim').length,
    cho_phan: Number(dem.cho_phan) || 0, cho_xac_nhan: Number(dem.cho_xac_nhan) || 0, dang_chay: Number(dem.dang_chay) || 0,
    chenh_lech: tai.length ? Math.max(...tai) - Math.min(...tai) : 0,
    thu_tu_tiep: xepHang(bang).map((s) => s.id_shipper),
    nhat_ky: nhatKy,
  };
}

// ------------------------------------------------------------------ tac vu nen

let henGio = null;
function batDau() {
  if (henGio) return;
  henGio = setInterval(async () => {
    try {
      // Sua trang thai ca lech truoc (shipper hien 'dang_giao' ma het don thi
      // khong bao gio duoc phan don moi).
      await require('./vanChuyenService').dongBoCaShipper();
      await quetHetHan();
      await phanHangCho();
    } catch (e) {
      console.error('[phan-cong-giao] tác vụ nền lỗi:', (e.message || e.code || String(e)));
    }
  }, 30000);
  if (henGio.unref) henGio.unref();
}

/** Gan khu phu trach cho shipper. `dsMa` rong = giao moi khu. */
async function ganKhuVuc(idShipper, dsMa) {
  await require('./shipperNghiepVu').damBaoCauTruc();
  const hopLe = new Set((await require('./khuVucGiaoService').dsKhuVuc({ boDem: true })).map((k) => k.ma));
  const ma = [...new Set((Array.isArray(dsMa) ? dsMa : String(dsMa || '').split(',')).map((x) => String(x).trim()).filter((x) => hopLe.has(x)))];
  await db.query('UPDATE shipper SET khu_vuc = ? WHERE id_shipper = ?', [ma.length ? ma.join(',') : null, idShipper]);
  return ma;
}

module.exports = {
  thamSo, luuThamSo, bangShipper, xepHang, danhGiaGhep, locTheoKhu, ganKhuVuc, tuDongPhan, phanHangCho, ghiPhanTay,
  xacNhan, tuChoi, quetHetHan, tongQuan, batDau,
};

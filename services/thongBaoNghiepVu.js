/**
 * TANG LUONG THONG BAO - noi DUY NHAT quyet dinh su kien nghiep vu nao gui
 * thong bao cho ai (danh muc: thongBaoService.LUONG).
 *
 * CACH LAM: boc (wrap) cac ham nghiep vu da export. Ham goc chay xong va THANH
 * CONG thi moi gui thong bao, gui NEN (khong lam cham phan hoi) va moi loi bi
 * nuot - thong bao hong khong bao gio lam hong nghiep vu.
 * => Code nghiep vu khong biet gi ve thong bao; doc mot file nay la thay toan
 *    bo luong. Goi `cai()` mot lan luc khoi dong server (truoc khi co request).
 *
 * Them hai viec dinh ky (khong gan voi mot thao tac cu the):
 *   - Ton kho xuong duoi dinh muc (moi 15 phut, moi nguyen lieu toi da 1 lan/ngay)
 *   - Cong no nha cung cap qua han (moi ngay mot lan)
 */
const db = require('../config/db');
const tb = require('./thongBaoService');

const vnd = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const nen = (fn) => setImmediate(() => Promise.resolve().then(fn).catch((e) => console.error('[thong-bao]', e.message)));

/** Boc mot ham export: sau khi ham goc thanh cong thi chay `sau(kq, thamSo)` o nen. */
function boc(mod, ten, sau, truoc = null) {
  const goc = mod[ten];
  if (typeof goc !== 'function' || goc.__daBocThongBao) return;
  const moi = async function (...thamSo) {
    // `truoc`: doc trang thai CU (vd. ai dang giu don) truoc khi nghiep vu doi no.
    const cu = truoc ? await Promise.resolve().then(() => truoc(thamSo)).catch(() => null) : null;
    const kq = await goc.apply(this, thamSo);
    nen(() => sau(kq, thamSo, cu));
    return kq;
  };
  moi.__daBocThongBao = true;
  mod[ten] = moi;
}

const motDong = async (sql, ts) => { const [[r]] = await db.query(sql, ts); return r || null; };
/** Khach that (co tai khoan), khong phai tai khoan vang lai QR_. */
async function khachThat(idKh) {
  if (!idKh) return null;
  const k = await motDong('SELECT id, sodienthoai FROM khach_hang WHERE id = ?', [idKh]);
  return k && !String(k.sodienthoai || '').startsWith('QR_') ? k.id : null;
}

// ------------------------------------------------- nguoi nhan theo van hanh
/** Trong `ids`, ai dang trong ca (cham cong vao hom nay, chua cham ra). */
async function trongCa(ids) {
  if (!ids.length) return [];
  const [r] = await db.query(
    'SELECT DISTINCT id_nv FROM cham_cong WHERE ngay = CURDATE() AND gio_vao IS NOT NULL AND gio_ra IS NULL AND id_nv IN (?)', [ids]);
  return r.map((x) => x.id_nv);
}
/** Phuc vu dang trong ca; khong ai cham cong thi ca bo phan Phuc vu (khong de lot thong bao). */
async function phucVuTrongCa() {
  const tatCa = await tb.idNhanVien({ nhom: ['PHUC_VU'] });
  const ca = await trongCa(tatCa);
  return ca.length ? ca : tatCa;
}
/**
 * Phuc vu PHU TRACH don/ban: nguoi phuc vu da goi mon cho ban (hopdong.id_nv_phuc_vu).
 * Ban chua co ai phu trach (khach tu goi QR, thu ngan goi ho) -> phuc vu dang trong ca.
 */
async function phucVuCuaDon(sesis) {
  const [r] = await db.query('SELECT DISTINCT id_nv_phuc_vu AS id FROM hopdong WHERE sesis = ? AND id_nv_phuc_vu IS NOT NULL', [sesis]);
  if (r.length) {
    const pv = new Set((await tb.idNhanVien({ nhom: ['PHUC_VU'] })).map(Number));
    const rieng = r.map((x) => Number(x.id)).filter((id) => pv.has(id));
    if (rieng.length) return rieng;
  }
  return phucVuTrongCa();
}
/** Ghi nhan nhan vien PHUC VU da goi mon cho don (de "mon xong" bao dung nguoi). */
async function ghiNhanPhucVu(sesis, idNv) {
  if (!sesis || !idNv) return;
  try {
    const pv = (await tb.idNhanVien({ nhom: ['PHUC_VU'] })).map(Number);
    if (!pv.includes(Number(idNv))) return;      // thu ngan / quan ly goi ho: khong nhan thay phuc vu
    await db.query('UPDATE hopdong SET id_nv_phuc_vu = ? WHERE sesis = ? AND id_mon > 0 AND id_nv_phuc_vu IS NULL', [idNv, sesis]);
  } catch (e) { console.error('[thong-bao] ghi nhan phuc vu:', e.message); }
}

// ------------------------------------------------- mon moi -> bep / bar
/** Nhom `nhom` (BEP/BAR) dang trong ca; chua ai cham cong thi ca bo phan. */
async function boPhanTrongCa(nhom) {
  const tatCa = await tb.idNhanVien({ nhom: [nhom] });
  const ca = await trongCa(tatCa);
  return ca.length ? ca : tatCa;
}
// Do uong (theo ten loai mon) -> Bar pha che; con lai -> Bep.
const LA_DO_UONG = /DRINK|SAKE|BEER|BIA|RƯỢU|RUOU|ĐỒ UỐNG|DO UONG|NƯỚC|NUOC|BAR/i;
// POS / so do ban goi addDishToOrder TUNG MON mot: gom cac mon cua cung mot
// don trong vai giay thanh MOT thong bao, khong bao 5 lan cho 5 mon.
const GOM_MS = Number(process.env.TB_GOM_MON_MS) || 2500;
const hangMonMoi = new Map();   // sesis -> { mon: Map(id_mon -> qty), hen }
function gomMonMoi(sesis, dong, nguon) {
  if (!sesis || !dong.length) return;
  let h = hangMonMoi.get(sesis);
  if (!h) { h = { mon: new Map(), nguon }; hangMonMoi.set(sesis, h); }
  for (const { id, qty } of dong) {
    if (Number(id) > 0 && Number(qty) > 0) h.mon.set(Number(id), (h.mon.get(Number(id)) || 0) + Number(qty));
  }
  clearTimeout(h.hen);
  h.hen = setTimeout(() => {
    hangMonMoi.delete(sesis);
    nen(() => guiMonMoi(sesis, h.mon, h.nguon));
  }, GOM_MS);
  if (h.hen.unref) h.hen.unref();
}
async function guiMonMoi(sesis, monMap, nguon) {
  if (!monMap.size) return;
  const don = await motDong(
    `SELECT h.loai_don, DATE_FORMAT(h.ngay_dat, '%Y-%m-%d') AS ngay, b.number_ban
       FROM hopdong h LEFT JOIN ban b ON b.Id_ban = h.id_ban WHERE h.sesis = ? LIMIT 1`, [sesis]);
  if (!don) return;
  // Mon goi truoc cho luot dat ngay khac: bep chua lam bay gio, khong bao.
  const homNay = (await motDong("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d")).d;
  if (don.ngay && don.ngay > homNay) return;
  const [mon] = await db.query(
    'SELECT m.id_mon, m.name_mon, l.name_loai FROM monan m LEFT JOIN loai_mon l ON l.id_loai = m.id_loai WHERE m.id_mon IN (?)',
    [[...monMap.keys()]]);
  const noi = don.number_ban ? `Bàn ${don.number_ban}`
    : (don.loai_don === 'giao_hang' || /^GH|giao/i.test(don.loai_don || '') ? 'Đơn giao hàng' : 'Đơn mang về');
  const nhomMon = { bep: [], bar: [] };
  for (const m of mon) {
    (LA_DO_UONG.test(m.name_loai || '') ? nhomMon.bar : nhomMon.bep)
      .push(`${String(m.name_mon).trim()} x${monMap.get(Number(m.id_mon))}`);
  }
  const gui1 = async (loai, nhom, ds, viec) => {
    if (!ds.length) return;
    await tb.gui(loai, {
      nv: await boPhanTrongCa(nhom), nhom: [],
      tieuDe: `${noi}: ${ds.length} món mới cần ${viec}`,
      noiDung: ds.join(', ') + (nguon ? ` · ${nguon}` : ''),
      link: '/kds', nguoiGui: nguon || 'Gọi món',
    });
  };
  await gui1('mon_moi_bep', 'BEP', nhomMon.bep, 'chế biến');
  await gui1('mon_moi_bar', 'BAR', nhomMon.bar, 'pha chế');
}

async function tenBan(sesis) {
  const r = await motDong('SELECT b.number_ban FROM hopdong h JOIN ban b ON b.Id_ban = h.id_ban WHERE h.sesis = ? AND h.id_ban > 0 LIMIT 1', [sesis]);
  return r && r.number_ban ? `Bàn ${r.number_ban}` : null;
}
async function idNvShipper(idShipper) {
  if (!idShipper) return null;
  const sp = await motDong('SELECT id_nv FROM shipper WHERE id_shipper = ?', [idShipper]);
  return sp && sp.id_nv ? sp.id_nv : null;
}

// ----------------------------------------- chong lap cho thong bao dinh ky
let daTaoBangDaBao = false;
async function daBao(khoa) {
  if (!daTaoBangDaBao) {
    await db.query(`CREATE TABLE IF NOT EXISTS thong_bao_da_bao (
      khoa VARCHAR(120) PRIMARY KEY, luc DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY (luc)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    daTaoBangDaBao = true;
  }
  const [kq] = await db.query('INSERT IGNORE INTO thong_bao_da_bao (khoa) VALUES (?)', [khoa]);
  return kq.affectedRows === 0;   // true = da bao truoc do
}

// ---------------------------------------- goi truc tiep tu code nghiep vu
/**
 * Sau khi hoa don TAI BAN tra du (thanhToanService.hauKyThanhToan /
 * hoanTatBangTienCoc). Ham noi bo cua service nen khong boc duoc -> goi thang.
 */
function sauThanhToanTaiBan({ sesis, idBan, payment = null }) {
  nen(async () => {
    const ban = idBan ? await motDong('SELECT number_ban FROM ban WHERE Id_ban = ?', [idBan]) : null;
    const noi = ban ? `Bàn ${ban.number_ban}` : `Đơn ${String(sesis).slice(0, 14)}`;
    const pv = await phucVuCuaDon(sesis);
    // Khach tu tra = khong nhan vien nao xu ly VA khong phai tien mat
    // (webhook ngan hang / khach tu quet QR chuyen khoan).
    let tuTra = false;
    if (payment && !payment.processed_by && payment.payment_method_id) {
      const pt = await motDong('SELECT code FROM payment_methods WHERE id = ?', [payment.payment_method_id]);
      tuTra = !!pt && pt.code !== 'tien_mat';
    }
    if (tuTra) {
      await tb.gui('khach_tu_thanh_toan', {
        nhom: ['THU_NGAN'], nv: pv,
        tieuDe: `${noi} đã tự chuyển khoản đủ ${vnd(payment.amount)}`,
        noiDung: 'Hệ thống đã tự xác nhận tiền vào tài khoản, hóa đơn đã đóng. Không cần thu tiền nữa.',
        link: '/staff/thanh-toan/lich-su',
      });
    }
    if (idBan) {
      await tb.gui('ban_can_don', {
        nv: pv, nhom: [], truNv: payment && payment.processed_by,
        tieuDe: `${noi} đã thanh toán - cần dọn bàn`,
        noiDung: 'Dọn và set lại bàn, sau đó chuyển bàn về "Trống" trên sơ đồ bàn để đón khách mới.',
        link: '/so-do-ban',
      });
    }
  });
}

let daCai = false;
function cai() {
  if (daCai) return;
  daCai = true;

  // ===================================================== DAT BAN & TIEC
  const rs = require('./reservationService');
  boc(rs, 'taoLuotDat', async (kq, [input = {}]) => {
    if (!kq || String(input.source || '').toUpperCase() !== 'ONLINE') return;  // nhan vien dat ho thi khong bao
    await tb.gui('dat_ban_moi', {
      tieuDe: `Đặt bàn online mới ${kq.ma}${kq.vao_danh_sach_cho ? ' (danh sách chờ)' : ''}`,
      noiDung: `${kq.so_khach} khách · ${kq.khung.ngay} ${kq.khung.tu}${kq.coc ? ' · cọc ' + vnd(kq.coc) : ''}. Khách: ${input.customer_name || input.ten || ''}`,
      link: '/staff/dat-ban', nguoiGui: 'Đặt bàn online',
    });
  });
  boc(rs, 'doiTrangThai', async (kq, [, den, ctx = {}]) => {
    if (!kq) return;
    const r = await motDong('SELECT customer_id, customer_name, reservation_date, start_time FROM reservations WHERE id = ?', [kq.id]);
    const TEN = { CONFIRMED: 'đã được xác nhận', CANCELLED: 'đã bị hủy', REJECTED: 'bị từ chối', ARRIVED: 'đã ghi nhận khách đến', NO_SHOW: 'được ghi nhận vắng mặt', COMPLETED: 'đã hoàn tất' };
    if (den === 'CANCELLED' && !ctx.nhanVienId) {
      await tb.gui('dat_ban_huy', { tieuDe: `Khách hủy đặt bàn ${kq.ma}`, noiDung: `${r ? r.customer_name : ''} hủy lượt đặt.`, link: '/staff/dat-ban' });
    }
    const idKh = await khachThat(r && r.customer_id);
    if (idKh && TEN[den]) {
      await tb.gui('dat_ban_khach', { kh: [idKh], tieuDe: `Đặt bàn ${kq.ma} ${TEN[den]}`, link: '/my-orders', nguoiGui: 'Nhà hàng Bảo Đoàn' });
    }
  });

  const dt = require('./datTiecService');
  boc(dt, 'taoDonTiec', async (kq) => {
    if (!kq) return;
    await tb.gui('dat_tiec_moi', {
      tieuDe: `Yêu cầu đặt tiệc mới ${kq.ma}`,
      noiDung: `${kq.ngay} · ${kq.buoi} ${kq.gio || ''} · ${kq.so_ban} bàn · ${kq.sanh} · dự toán ${vnd(kq.tong_du_toan)}`,
      link: '/staff/dat-tiec', nguoiGui: 'Đặt tiệc online',
    });
  });
  boc(dt, 'capNhatTrangThai', async (kq, [id, o = {}, nhanVien = {}]) => {
    if (!kq || !kq.ok) return;
    const t = await motDong('SELECT ma_tiec, customer_id, ngay_to_chuc, so_ban, trang_thai FROM dat_tiec WHERE id = ?', [id]);
    if (!t) return;
    if (['DA_XAC_NHAN', 'DA_COC'].includes(t.trang_thai)) {
      await tb.gui('dat_tiec_chot', {
        tieuDe: `Tiệc ${t.ma_tiec} ${t.trang_thai === 'DA_COC' ? 'đã đặt cọc' : 'đã xác nhận'} - chuẩn bị nguyên liệu`,
        noiDung: `${t.so_ban} bàn, ngày ${new Date(t.ngay_to_chuc).toLocaleDateString('vi-VN')}. Xem "Kế hoạch nguyên liệu" ở trang Đặt tiệc.`,
        link: '/staff/dat-tiec', truNv: nhanVien.id || null,
      });
    }
    const idKh = await khachThat(t.customer_id);
    const TEN = {
      DA_XAC_NHAN: 'đã được xác nhận', DA_COC: 'đã nhận tiền cọc', HOAN_THANH: 'đã hoàn tất', HUY: 'đã bị hủy',
      CHO_COC: 'đã có báo giá - mời quý khách đặt cọc để giữ sảnh',
      CHO_THANH_TOAN: 'đã chốt hóa đơn - mời quý khách thanh toán phần còn lại',
    };
    if (idKh && TEN[t.trang_thai]) {
      const canTra = ['CHO_COC', 'CHO_THANH_TOAN'].includes(t.trang_thai);
      await tb.gui('dat_tiec_khach', {
        kh: [idKh], tieuDe: `Tiệc ${t.ma_tiec} ${TEN[t.trang_thai]}`, nguoiGui: 'Nhà hàng Bảo Đoàn',
        link: canTra ? `/dat-tiec/thanh-toan/${t.ma_tiec}` : '/my-orders?tab=tiec', mucDo: canTra ? 'quan_trong' : undefined,
      });
    }
  });

  // ===================================================== GIAO HANG
  const cs = require('./chinhSachGiaoService');
  boc(cs, 'sauKhiThanhToan', async (kq, [sesis]) => {
    const g = await motDong("SELECT id_giao, ma_giao, dia_chi_giao, trang_thai FROM don_giao_hang WHERE sesis = ? LIMIT 1", [sesis]);
    if (g) {
      // Don giao da tra tien -> bep bat dau nau (mon da nam tren KDS).
      const [mg] = await db.query('SELECT id_mon AS id, soluong AS qty FROM hopdong WHERE sesis = ? AND id_mon > 0 AND soluong > 0 AND trangthai_bep = 0', [sesis]);
      gomMonMoi(sesis, mg, `Đơn giao ${g.ma_giao}`);
    }
    if (!g || g.trang_thai !== 'cho_phan') return;
    await tb.gui('don_giao_moi', { tieuDe: `Đơn giao ${g.ma_giao} đã thanh toán, chờ phân shipper`, noiDung: g.dia_chi_giao, link: `/staff/giao-hang/${g.id_giao}` });
  });
  const vc = require('./vanChuyenService');
  boc(vc, 'phanShipper', async (don, thamSo, cu) => {
    if (!don || !don.id_shipper) return;
    const shipperCu = cu && cu.id_shipper ? Number(cu.id_shipper) : null;
    if (shipperCu === Number(don.id_shipper)) return;          // phan lai dung nguoi dang giu: khong bao lai
    const idNv = await idNvShipper(don.id_shipper);
    if (idNv) {
      await tb.gui('don_giao_phan', {
        nv: [idNv], tieuDe: `Bạn được phân đơn giao ${don.ma_giao}`,
        noiDung: `${don.dia_chi_giao || ''}${Number(don.tien_thu_ho) > 0 ? ' · thu hộ ' + vnd(don.tien_thu_ho) : ''}`, link: '/shipper/',
      });
    }
    // Don chuyen tu shipper khac sang: bao nguoi cu de khong di lay nham.
    const idNvCu = await idNvShipper(shipperCu);
    if (idNvCu) {
      await tb.gui('don_giao_phan', {
        nv: [idNvCu], mucDo: 'quan_trong', tieuDe: `Đơn ${don.ma_giao} đã chuyển cho shipper khác`,
        noiDung: `Điều phối đã giao đơn này cho ${don.ten_shipper || 'shipper khác'} - bạn không cần lấy / giao đơn này nữa.`, link: '/shipper/',
      });
    }
  }, ([idGiao]) => motDong('SELECT id_shipper FROM don_giao_hang WHERE id_giao = ?', [idGiao]));
  boc(vc, 'doiTrangThai', async (don, [, moi, nguoi = {}, tuyChon = {}]) => {
    if (!don) return;
    const lienKet = `/staff/giao-hang/${don.id_giao}`;
    if (moi === 'dang_lay') {
      await tb.gui('don_giao_nhan', { tieuDe: `${don.ten_shipper || 'Shipper'} đang đến lấy đơn ${don.ma_giao}`, link: lienKet, truNv: nguoi.id_nv });
    }
    if (moi === 'da_giao') {
      const thuHo = Number(don.tien_thu_ho) || 0;
      await tb.gui('don_giao_hoan_thanh', {
        nhom: thuHo > 0 ? ['DIEU_PHOI', 'THU_NGAN'] : ['DIEU_PHOI'], truNv: nguoi.id_nv,
        tieuDe: `Đã giao xong đơn ${don.ma_giao}${thuHo > 0 ? ` - shipper giữ ${vnd(thuHo)} thu hộ` : ''}`,
        noiDung: `${don.ten_shipper || 'Shipper'} giao thành công cho ${don.ten_nguoi_nhan || 'khách'}.` +
          (thuHo > 0 ? ' Thu ngân nhận tiền thu hộ khi shipper về nộp (Giao hàng → Thu hộ).' : ''),
        link: thuHo > 0 ? '/staff/giao-hang/thu-ho' : lienKet,
      });
    }
    if (moi === 'huy') {
      const idSp = await idNvShipper(don.id_shipper);
      // Bep chi can biet khi don DA vao hang cho bep (don chua tra tien khong hien tren KDS)
      // hoac co mon dang / da nau.
      const dangNau = await motDong(
        `SELECT SUM(trangthai_bep IN (1, 2)) + IF(? IS NOT NULL, SUM(trangthai_bep = 0), 0) AS n
           FROM hopdong WHERE sesis = ? AND id_mon > 0`, [don.phan_luc || (Number(don.da_thanh_toan) ? 1 : null), don.sesis]);
      await tb.gui('don_giao_huy', {
        nv: idSp ? [idSp] : [], nhom: dangNau && dangNau.n > 0 ? ['DIEU_PHOI', 'BEP_QUAN_LY'] : ['DIEU_PHOI'], truNv: nguoi.id_nv,
        tieuDe: `Đơn giao ${don.ma_giao} đã bị hủy`,
        noiDung: `Lý do: ${tuyChon.ly_do || ''}.` + (idSp ? ' Shipper không cần đến lấy / giao đơn này nữa.' : '') +
          (dangNau && dangNau.n > 0 ? ' Bếp ngừng làm các món còn lại của đơn.' : ''),
        link: lienKet,
      });
      const h = await motDong('SELECT id_user FROM hopdong WHERE sesis = ? LIMIT 1', [don.sesis]);
      const idKh = await khachThat(h && h.id_user);
      if (idKh && tuyChon.ma_ly_do !== 'khach_doi_y') {
        await tb.gui('don_giao_khach', { kh: [idKh], nguoiGui: 'Nhà hàng Bảo Đoàn', tieuDe: `Đơn ${don.ma_giao} đã bị hủy`, noiDung: `Lý do: ${tuyChon.ly_do || ''}. Tiền đã trả (nếu có) sẽ được hoàn theo chính sách.`, link: `/theo-doi/${don.ma_giao}` });
      }
    }
    if (moi === 'that_bai') {
      await tb.gui('don_giao_su_co', { tieuDe: `Giao thất bại đơn ${don.ma_giao}`, noiDung: `Lý do: ${tuyChon.ly_do || ''}. Shipper: ${don.ten_shipper || ''}`, link: `/staff/giao-hang/${don.id_giao}` });
    }
    if (['dang_giao', 'da_giao'].includes(moi)) {
      const h = await motDong('SELECT id_user FROM hopdong WHERE sesis = ? LIMIT 1', [don.sesis]);
      const idKh = await khachThat(h && h.id_user);
      if (idKh) {
        await tb.gui('don_giao_khach', {
          kh: [idKh], nguoiGui: 'Nhà hàng Bảo Đoàn',
          tieuDe: moi === 'dang_giao' ? `Đơn ${don.ma_giao} đang trên đường giao` : `Đơn ${don.ma_giao} đã giao thành công`,
          noiDung: moi === 'dang_giao' ? 'Shipper đã nhận hàng và đang giao tới bạn. Theo dõi vị trí shipper trên bản đồ.' : 'Cảm ơn bạn đã đặt món!',
          link: `/theo-doi/${don.ma_giao}`,
        });
      }
    }
  });
  const pc = require('./phanCongGiaoService');
  boc(pc, 'xacNhan', async (kq, [idGiao, idShipper]) => {
    const g = await motDong('SELECT g.ma_giao, s.ten FROM don_giao_hang g LEFT JOIN shipper s ON s.id_shipper = ? WHERE g.id_giao = ?', [idShipper, idGiao]);
    if (g) await tb.gui('don_giao_nhan', { tieuDe: `${g.ten || 'Shipper'} đã nhận đơn ${g.ma_giao}`, link: `/staff/giao-hang/${idGiao}` });
  });
  boc(pc, 'tuChoi', async (kq, [idGiao, , lyDo, nguoi = {}]) => {
    const g = await motDong('SELECT ma_giao FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
    await tb.gui('don_giao_su_co', {
      tieuDe: `Shipper từ chối đơn ${g ? g.ma_giao : idGiao}`,
      noiDung: `${nguoi.ten || 'Shipper'}: ${lyDo || 'không ghi lý do'}${kq && kq.phan ? ' · đã chuyển cho ' + kq.ten : ' · chưa có shipper thay'}`,
      link: `/staff/giao-hang/${idGiao}`,
    });
  });
  const thuHo = require('./thuHoShipperService');
  boc(thuHo, 'nhanTien', async (kq, [idShipper, , nguoiNhan = {}]) => {
    const sp = await motDong('SELECT id_nv FROM shipper WHERE id_shipper = ?', [idShipper]);
    await tb.gui('thu_ho_da_nop', {
      nv: sp && sp.id_nv ? [sp.id_nv] : [], truNv: nguoiNhan.id_nv,
      tieuDe: `Đã nhận ${vnd(kq.tong)} tiền thu hộ (${kq.so_don} đơn)`,
      noiDung: `${nguoiNhan.ten || 'Thu ngân'} đã nhận tiền thu hộ các đơn ${kq.ma.join(', ')}. Tiền đã vào sổ quỹ.`, link: '/staff/thu-chi',
    });
  });

  // ===================================================== THANH TOAN & QUY
  const tt = require('./thanhToanService');
  boc(tt, 'hoanTien', async (kq, [paymentId, o = {}]) => {
    const p = await motDong('SELECT sesis, amount FROM payments WHERE id = ?', [paymentId]);
    await tb.gui('hoan_tien', {
      tieuDe: `Đã hoàn ${vnd(p ? p.amount : 0)} cho khách`, noiDung: `Đơn ${p ? p.sesis : ''} · lý do: ${o.lyDo || ''}`,
      link: '/staff/thanh-toan/lich-su', truNv: o.nhanVienId || null,
    });
  });
  boc(tt, 'ghiNhanGiaoDichNganHang', async (kq, [gd = {}]) => {
    if (!kq || kq.khop || kq.trungLap || gd.loai === 'out' || ['sai_tai_khoan'].includes(kq.lyDo)) return;
    if (String(gd.ma_tham_chieu || '').startsWith('GIALAP-')) return;   // giao dich gia lap demo
    await tb.gui('ngan_hang_lech', {
      tieuDe: `Chuyển khoản ${vnd(gd.so_tien)} chưa khớp hóa đơn`,
      noiDung: `Nội dung: ${String(gd.noi_dung || '').slice(0, 120)}. Cần thu ngân / kế toán đối soát tay.`, link: '/staff/thanh-toan/doi-soat',
    });
  });
  const cc = require('./chotCaService');
  boc(cc, 'chotCa', async (kq, [idNv]) => {
    if (!kq) return;
    const nv = await motDong('SELECT ten FROM nhan_vien WHERE id_nv = ?', [idNv]);
    const lech = Math.round(Number(kq.chenh_lech) || 0);
    await tb.gui('chot_ca_moi', {
      mucDo: lech ? 'quan_trong' : 'tin', truNv: idNv,
      tieuDe: `${nv ? String(nv.ten).trim() : 'Thu ngân'} chốt ca${lech ? ` - lệch ${lech > 0 ? '+' : ''}${lech.toLocaleString('vi-VN')}đ` : ''}`,
      noiDung: lech ? 'Biên bản có chênh lệch tiền mặt, cần kiểm tra lý do trước khi duyệt.' : 'Biên bản chốt ca chờ duyệt.',
      link: `/staff/chot-ca/${kq.id}`,
    });
  });
  boc(cc, 'duyetBienBan', async (kq, [id, nguoiDuyetId]) => {
    const s = await motDong('SELECT id_nv FROM shift_closings WHERE id = ?', [id]);
    if (s && s.id_nv && Number(s.id_nv) !== Number(nguoiDuyetId)) {
      await tb.gui('chot_ca_duyet', { nv: [s.id_nv], tieuDe: 'Biên bản chốt ca của bạn đã được duyệt', link: `/staff/chot-ca/${id}` });
    }
  });
  const thuChi = require('./thuChiService');
  boc(thuChi, 'lapPhieu', async (kq, [, idNv]) => {
    if (!kq || kq.trang_thai !== 'cho_duyet') return;
    const p = await motDong('SELECT so_tien, noi_dung FROM phieu_thu_chi WHERE id = ?', [kq.id]);
    await tb.gui('phieu_chi_cho_duyet', {
      tieuDe: `Phiếu chi ${kq.ma_phieu} (${vnd(p && p.so_tien)}) chờ duyệt`, noiDung: p ? p.noi_dung : '', link: '/staff/thu-chi', truNv: idNv,
    });
  });
  boc(thuChi, 'duyetPhieu', async (kq, [id, idNvDuyet]) => {
    const p = await motDong('SELECT id_nv, ma_phieu, so_tien FROM phieu_thu_chi WHERE id = ?', [id]);
    if (p && p.id_nv && Number(p.id_nv) !== Number(idNvDuyet)) {
      await tb.gui('phieu_chi_ket_qua', { nv: [p.id_nv], tieuDe: `Phiếu chi ${p.ma_phieu} (${vnd(p.so_tien)}) đã được duyệt`, link: '/staff/thu-chi' });
    }
  });
  boc(thuChi, 'huyPhieu', async (kq, [id, o = {}]) => {
    const p = await motDong('SELECT id_nv, ma_phieu FROM phieu_thu_chi WHERE id = ?', [id]);
    if (p && p.id_nv && Number(p.id_nv) !== Number(o.idNv)) {
      await tb.gui('phieu_chi_ket_qua', { nv: [p.id_nv], tieuDe: `Phiếu ${p.ma_phieu} đã bị hủy`, noiDung: `Lý do: ${o.lyDo || ''}`, link: '/staff/thu-chi', mucDo: 'quan_trong' });
    }
  });
  const ks = require('./khoaSoService');
  boc(ks, 'moKhoa', async (kq, [id, o = {}]) => {
    const k = await motDong('SELECT loai, tu_ngay, den_ngay FROM khoa_so WHERE id = ?', [id]);
    const ky = k ? (k.loai === 'thang' ? `tháng ${new Date(k.tu_ngay).getMonth() + 1}/${new Date(k.tu_ngay).getFullYear()}` : `ngày ${new Date(k.tu_ngay).toLocaleDateString('vi-VN')}`) : '';
    await tb.gui('khoa_so', { tieuDe: `Sổ ${ky} đã bị mở khóa`, noiDung: `Lý do: ${o.lyDo || ''}`, link: '/staff/ke-toan/chot-so', truNv: o.idNv });
  });

  // ===================================================== LUONG & NHAN SU
  const kt = require('./accountantService');
  const linkLuong = (m, y) => `/staff/accountant/salary?month=${m}&year=${y}`;
  boc(kt, 'submitAllSalaries', async (n, [m, y, idNvGui]) => {
    if (!n) return;
    await tb.gui('luong_cho_duyet', { tieuDe: `${n} bảng lương tháng ${m}/${y} chờ duyệt`, link: linkLuong(m, y), truNv: idNvGui });
  });
  boc(kt, 'submitSalaryForApproval', async (kq, [id, idNvGui]) => {
    const l = await motDong('SELECT l.thang, l.nam, l.trang_thai, n.ten FROM luong l JOIN nhan_vien n ON n.id_nv = l.id_nv WHERE l.id_luong = ?', [id]);
    if (!l || Number(l.trang_thai) !== 1) return;
    await tb.gui('luong_cho_duyet', { tieuDe: `Bảng lương ${String(l.ten).trim()} tháng ${l.thang}/${l.nam} chờ duyệt`, link: linkLuong(l.thang, l.nam), truNv: idNvGui });
  });
  boc(kt, 'approveAllSalaries', async (n, [m, y, idNvDuyet]) => {
    if (!n) return;
    const [gui] = await db.query('SELECT DISTINCT id_nv_gui FROM luong WHERE thang = ? AND nam = ? AND trang_thai = 2 AND id_nv_gui IS NOT NULL', [m, y]);
    await tb.gui('luong_ket_qua', { nv: gui.map((g) => g.id_nv_gui), tieuDe: `Bảng lương tháng ${m}/${y} đã được duyệt (${n})`, noiDung: 'Kế toán có thể chi lương.', link: linkLuong(m, y), truNv: idNvDuyet });
  });
  boc(kt, 'rejectAllSalaries', async (n, [m, y, lyDo, idNvDuyet]) => {
    if (!n) return;
    const [gui] = await db.query('SELECT DISTINCT id_nv_gui FROM luong WHERE thang = ? AND nam = ? AND trang_thai = 0 AND id_nv_gui IS NOT NULL', [m, y]);
    await tb.gui('luong_ket_qua', { nv: gui.map((g) => g.id_nv_gui), mucDo: 'khan', tieuDe: `Bảng lương tháng ${m}/${y} bị trả về`, noiDung: `Lý do: ${lyDo}`, link: linkLuong(m, y), truNv: idNvDuyet });
  });
  boc(kt, 'paySalaries', async (kq, [m, y]) => {
    if (!kq || !kq.ma_phieu) return;
    const [ds] = await db.query(
      `SELECT l.id_nv, l.tong_luong, l.phuong_thuc_chi FROM luong l JOIN phieu_thu_chi p ON p.id = l.id_phieu_chi
        WHERE p.ma_phieu = ? AND l.thang = ? AND l.nam = ?`, [kq.ma_phieu, m, y]);
    for (const l of ds) {
      await tb.gui('luong_da_chi', {
        nv: [l.id_nv], tieuDe: `Lương tháng ${m}/${y} đã được chi: ${vnd(l.tong_luong)}`,
        noiDung: l.phuong_thuc_chi === 'tien_mat' ? 'Nhận tiền mặt tại phòng kế toán.' : 'Đã chuyển khoản vào tài khoản của bạn.', link: '/staff/profile',
      });
    }
  });

  const np = require('./nghiPhepService');
  boc(np, 'taoDon', async (kq, [idNv, body = {}]) => {
    if (!kq) return;
    const nv = await motDong('SELECT ten, id_quan_ly FROM nhan_vien WHERE id_nv = ?', [idNv]);
    const nhan = nv && nv.id_quan_ly ? { nv: [nv.id_quan_ly] } : { nhom: ['QUAN_LY'] };
    await tb.gui('nghi_phep_moi', {
      ...nhan, truNv: idNv,
      tieuDe: `${nv ? String(nv.ten).trim() : 'Nhân viên'} xin nghỉ ${kq.so_ngay} ngày`,
      noiDung: `${body.ngay_bat_dau || ''} → ${body.ngay_ket_thuc || ''}: ${body.ly_do || ''}`, link: '/staff/duyet-nghi-phep',
    });
  });
  boc(np, 'xuLy', async (kq, [, , o = {}]) => {
    if (!kq || !kq.id_nv) return;
    await tb.gui('nghi_phep_ket_qua', {
      nv: [kq.id_nv], mucDo: o.dongY ? 'tin' : 'quan_trong',
      tieuDe: `Đơn nghỉ phép của bạn ${o.dongY ? 'đã được duyệt' : 'bị từ chối'}`, noiDung: o.lyDo ? `Ghi chú: ${o.lyDo}` : '', link: '/staff/leave',
    });
  });

  // ===================================================== KHO & MUA HANG
  const kho = require('./khoBepService');
  boc(kho, 'taoDonMua', async (kq, [, idNv]) => {
    if (!kq) return;
    const d = await motDong('SELECT trang_thai, tong_tien FROM don_mua_hang WHERE id_dmh = ?', [kq.id]).catch(() => null);
    if (d && d.trang_thai !== 'cho_duyet') return;
    await tb.gui('don_mua_cho_duyet', { tieuDe: `Đơn mua hàng ${kq.ma_don} chờ duyệt`, noiDung: d && d.tong_tien ? `Giá trị ${vnd(d.tong_tien)}` : '', link: `/staff/kitchen/mua-hang/${kq.id}`, truNv: idNv });
  });
  boc(kho, 'doiTrangThaiDon', async (kq, [id, buoc, o = {}]) => {
    if (!['duyet', 'huy'].includes(buoc)) return;
    const d = await motDong('SELECT ma_don, id_nv_tao FROM don_mua_hang WHERE id_dmh = ?', [id]);
    if (!d) return;
    await tb.gui('don_mua_ket_qua', {
      nv: d.id_nv_tao ? [d.id_nv_tao] : [], truNv: o.idNv, mucDo: buoc === 'huy' ? 'quan_trong' : 'tin',
      tieuDe: `Đơn mua ${d.ma_don} ${buoc === 'duyet' ? 'đã được duyệt' : 'đã bị hủy'}`, noiDung: buoc === 'huy' ? `Lý do: ${o.lyDo || ''}` : 'Có thể đặt hàng nhà cung cấp.',
      link: `/staff/kitchen/mua-hang/${id}`,
    });
  });
  const kk = require('./kiemKeService');
  boc(kk, 'taoPhieu', async (kq, [, idNv]) => {
    if (!kq) return;
    await tb.gui('kiem_ke_cho_chot', { tieuDe: `Phiếu kiểm kê ${kq.ma_phieu} đã mở`, noiDung: 'Sau khi đếm xong cần bếp trưởng / quản lý chốt.', link: `/staff/kitchen/kho/kiem-ke/${kq.id}`, truNv: idNv });
  });

  // ===================================================== VAN HANH TAI BAN
  const kds = require('./kdsService');
  boc(kds, 'hoanThanhCheBien', async (mon) => {
    if (!mon || !mon.sesis) return;
    const g = await motDong('SELECT id_giao, ma_giao, id_shipper, trang_thai FROM don_giao_hang WHERE sesis = ? LIMIT 1', [mon.sesis]);
    if (g) {
      // Don giao: chi bao khi MON CUOI CUNG cua don xong -> shipper den lay.
      const con = await motDong('SELECT MIN(trangthai_bep) AS m FROM hopdong WHERE sesis = ? AND id_mon > 0 AND soluong > 0', [mon.sesis]);
      if (!con || Number(con.m) < 2 || ['huy', 'da_giao', 'dang_giao'].includes(g.trang_thai)) return;
      const idSp = await idNvShipper(g.id_shipper);
      await tb.gui('don_giao_bep_xong', {
        nv: idSp ? [idSp] : [],
        tieuDe: `Đơn ${g.ma_giao}: bếp đã làm xong${idSp ? ' - đến lấy hàng' : ' - chưa có shipper'}`,
        noiDung: idSp ? 'Đến quầy nhận hàng, kiểm đủ món rồi bấm "Đã lấy hàng" trên app.' : 'Đơn đã sẵn sàng nhưng chưa phân shipper - phân ngay để món không nguội.',
        link: idSp ? '/shipper/' : `/staff/giao-hang/${g.id_giao}`,

      });
      return;
    }
    const noi = mon.number_ban ? `Bàn ${mon.number_ban}` : 'Đơn mang về';
    await tb.gui('mon_xong', {
      nv: await phucVuCuaDon(mon.sesis), nhom: [],
      tieuDe: `${noi}: ${String(mon.name_mon).trim()} x${mon.soluong} đã xong`,
      noiDung: `Lấy món ở quầy bếp mang ra ${noi.toLowerCase()}, rồi bấm "Đã phục vụ" trên màn hình bếp.`,
      link: '/kds', nguoiGui: 'Bếp',
    });
  });
  const os = require('./orderService');
  // Mon moi -> chuong Bep / Bar (gom theo don, xem gomMonMoi).
  boc(os, 'addDishToOrder', async (kq, [sesis, idMon, qty]) => {
    gomMonMoi(sesis, [{ id: idMon, qty }], 'Nhân viên gọi món');
  });
  boc(os, 'addMultipleDishesToOrder', async (kq, [sesis, items = []]) => {
    gomMonMoi(sesis, items.map((it) => ({ id: it.id || it.id_mon, qty: it.qty })), 'Khách gọi qua QR');
    const ids = items.map((it) => Number(it.id || it.id_mon)).filter(Boolean);
    const [mon] = ids.length ? await db.query('SELECT id_mon, name_mon FROM monan WHERE id_mon IN (?)', [ids]) : [[]];
    const ten = new Map(mon.map((m) => [Number(m.id_mon), String(m.name_mon).trim()]));
    const noi = (await tenBan(sesis)) || 'Khách QR';
    const tong = items.reduce((t, it) => t + (Number(it.qty) || 0), 0);
    await tb.gui('goi_mon_qr', {
      nv: await phucVuCuaDon(sesis), nhom: [],
      tieuDe: `${noi} vừa tự gọi ${tong} món qua QR`,
      noiDung: items.map((it) => `${ten.get(Number(it.id || it.id_mon)) || 'Món'} x${it.qty}`).join(', ') + '. Bếp đã nhận; kiểm tra bàn có cần thêm bát đũa / nước.',
      link: '/so-do-ban', nguoiGui: 'Gọi món QR',
    });
  });

  // ===================================================== MON TAM NGUNG / BAN LAI
  // Can trang thai TRUOC khi sua -> boc rieng (doc truoc, so sau).
  const ps = require('./personnelService');
  if (typeof ps.updateProduct === 'function' && !ps.updateProduct.__daBocThongBao) {
    const gocSuaMon = ps.updateProduct;
    const moiSuaMon = async function (id, data) {
      const truoc = await motDong('SELECT name_mon, tinhtrang FROM monan WHERE id_mon = ?', [id]).catch(() => null);
      const kq = await gocSuaMon.apply(this, [id, data]);
      nen(async () => {
        const sau = await motDong('SELECT name_mon, tinhtrang FROM monan WHERE id_mon = ?', [id]);
        if (!truoc || !sau || Number(truoc.tinhtrang) === Number(sau.tinhtrang)) return;
        const ban = Number(sau.tinhtrang) === 1;
        await tb.gui('mon_tam_ngung', {
          tieuDe: `${String(sau.name_mon).trim()} ${ban ? 'đã bán lại' : 'tạm ngưng bán'}`,
          noiDung: ban ? 'Món đã có lại trên thực đơn.' : 'Báo khách khi gọi món này; món đã ẩn khỏi thực đơn.',
          link: '/staff/kitchen/dishes', mucDo: ban ? 'tin' : 'quan_trong',
        });
      });
      return kq;
    };
    moiSuaMon.__daBocThongBao = true;
    ps.updateProduct = moiSuaMon;
  }

  batDinhKy();
}

// ===================================================== VIEC DINH KY
/** Da co thong bao loai + link nay trong ngay chua (chong lap). */
async function daGuiHomNay(loai, link) {
  const r = await motDong("SELECT id_tb FROM thong_bao WHERE loai = ? AND link = ? AND DATE(created_at) = CURDATE() LIMIT 1", [loai, link]);
  return !!r;
}

async function quetTonKho() {
  const [ds] = await db.query(
    `SELECT id_nl, ten_nl, so_luong, dinh_muc_min FROM nguyen_lieu
      WHERE dinh_muc_min > 0 AND so_luong < dinh_muc_min ORDER BY (so_luong / dinh_muc_min) LIMIT 50`).catch(() => [[]]);
  const moi = [];
  const ngay = new Date().toISOString().slice(0, 10);
  for (const n of ds) {
    const link = `/staff/kitchen/mua-hang#nl-${n.id_nl}`;
    if (!(await daBao(`ton_kho:${n.id_nl}:${ngay}`))) moi.push({ ...n, link });
  }
  if (!moi.length) return;
  // Gom thanh MOT thong bao / lan quet de khong ngap chuong.
  await tb.gui('ton_kho_thap', {
    tieuDe: `${moi.length} nguyên liệu dưới định mức`,
    noiDung: moi.slice(0, 8).map((n) => `${String(n.ten_nl).trim()}: còn ${Number(n.so_luong)} / định mức ${Number(n.dinh_muc_min)}`).join('\n') + (moi.length > 8 ? '\n…' : ''),
    link: moi.length === 1 ? moi[0].link : '/staff/kitchen/mua-hang',
  });
}

/** Mon cho qua thoi gian chuan (cau_hinh bep.sla_phut) ma chua xong -> bep truong + giam sat phuc vu. */
async function quetMonTre() {
  const sla = await require('./thoiGianChoService').slaPhut().catch(() => 25);
  const [ds] = await db.query(
    `SELECT h.id, h.name_mon, h.soluong, b.number_ban,
            TIMESTAMPDIFF(MINUTE, TIMESTAMP(h.ngay_dat, h.gio_dat), NOW()) AS phut
       FROM hopdong h LEFT JOIN ban b ON b.Id_ban = h.id_ban
      WHERE h.ngay_dat = CURDATE() AND h.id_mon > 0 AND h.soluong > 0 AND h.trangthai_bep IN (0, 1)
        AND h.tinhtrang <> 3
        AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(h.ngay_dat, h.gio_dat), NOW()) BETWEEN ? AND 240
      ORDER BY phut DESC LIMIT 30`, [sla]);
  const moi = [];
  for (const m of ds) if (!(await daBao(`mon_tre:${m.id}`))) moi.push(m);
  if (!moi.length) return;
  await tb.gui('mon_tre', {
    tieuDe: `${moi.length} món chờ quá ${sla} phút chưa ra`,
    noiDung: moi.slice(0, 8).map((m) => `${m.number_ban ? 'Bàn ' + m.number_ban : 'Mang về/giao'}: ${String(m.name_mon).trim()} x${m.soluong} - chờ ${m.phut} phút`).join('\n') +
      '\nĐẩy món lên trước, báo phục vụ xin lỗi khách nếu cần.',
    link: '/kds',
  });
}

/** Khach dat ban sap den (con <= 15 phut) -> le tan + phuc vu trong ca chuan bi ban. */
async function quetDatBanSapDen() {
  const [ds] = await db.query(
    `SELECT r.id, r.reservation_code, r.customer_name, r.guest_count, TIME_FORMAT(r.start_time, '%H:%i') AS gio,
            r.special_requests, r.occasion,
            (SELECT GROUP_CONCAT(b.number_ban ORDER BY b.number_ban SEPARATOR ', ')
               FROM reservation_tables rt JOIN ban b ON b.Id_ban = rt.table_id WHERE rt.reservation_id = r.id) AS ban
       FROM reservations r
      WHERE r.reservation_date = CURDATE() AND r.status IN ('CONFIRMED', 'PENDING')
        AND TIMESTAMP(r.reservation_date, r.start_time) BETWEEN NOW() AND NOW() + INTERVAL 15 MINUTE
      LIMIT 20`);
  for (const r of ds) {
    if (await daBao(`sap_den:${r.id}`)) continue;
    await tb.gui('dat_ban_sap_den', {
      nv: await phucVuTrongCa(),
      tieuDe: `${r.gio}: ${String(r.customer_name || 'Khách').trim()} (${r.guest_count} khách) sắp đến${r.ban ? ' - bàn ' + r.ban : ''}`,
      noiDung: [`Mã ${r.reservation_code}.`, r.ban ? 'Set bàn sẵn, đặt biển "Đã đặt".' : 'Chưa xếp bàn - lễ tân xếp bàn ngay.',
        r.occasion ? `Dịp: ${r.occasion}.` : '', r.special_requests ? `Yêu cầu: ${r.special_requests}` : ''].filter(Boolean).join(' '),
      link: '/staff/dat-ban',
    });
  }
}

async function quetCongNo() {
  const link = '/staff/cong-no-ncc';
  if (await daGuiHomNay('cong_no_qua_han', link)) return;
  const ds = await require('./congNoNccService').tongHop().catch(() => []);
  const qua = ds.filter((x) => x.qua_han > 0);
  if (!qua.length) return;
  await tb.gui('cong_no_qua_han', {
    tieuDe: `Công nợ quá hạn ${vnd(qua.reduce((s, x) => s + x.qua_han, 0))} (${qua.length} nhà cung cấp)`,
    noiDung: qua.slice(0, 6).map((x) => `${x.ten_ncc}: ${vnd(x.qua_han)}`).join('\n'),
    link,
  });
}

let henGio = null;
function batDinhKy() {
  if (henGio || process.env.NODE_ENV === 'test') return;
  const loi = (ten) => (e) => console.error(`[thong-bao] ${ten}:`, e.message);
  const cham = () => {
    quetTonKho().catch(loi('ton kho')); quetCongNo().catch(loi('cong no'));
    require('./duyetNhapKhoService').quetPhieuTon().catch(loi('phieu nhap ton'));
  };
  const nhanh = () => { quetMonTre().catch(loi('mon tre')); quetDatBanSapDen().catch(loi('dat ban sap den')); };
  setTimeout(cham, 30 * 1000);
  setTimeout(nhanh, 20 * 1000);
  henGio = setInterval(cham, 15 * 60 * 1000);
  const henNhanh = setInterval(nhanh, 2 * 60 * 1000);   // van hanh: can biet trong vai phut
  for (const h of [henGio, henNhanh]) if (h.unref) h.unref();
}

module.exports = {
  daBao,
  cai, boc, quetTonKho, quetCongNo, quetMonTre, quetDatBanSapDen,
  sauThanhToanTaiBan, ghiNhanPhucVu, phucVuCuaDon, phucVuTrongCa,
};

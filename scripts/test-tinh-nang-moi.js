/**
 * KIEM THU TU DONG CAC TINH NANG MOI (commit 5803fe7)
 *
 *   A. Chinh sach giao hang: vung giao, phi ship bac thang, bat buoc dong y chinh
 *      sach, thanh toan truoc 100%, huy do khach (khong hoan) / do nha hang (hoan diem)
 *   B. Rang buoc quy mo ban: nhom nho 1 ban, khong thua ban, khong thua ghe
 *   C. Khong gian & Dat tiec: tao don, kiem tra hop le, trung lich
 *   D. Phieu thu / chi: lap, kiem tra hop le, huy, phan quyen
 *   E. Kho bep: phieu nhap / xuat (FEFO, ton kho), don mua hang (duyet 4 mat)
 *   F. KDS: don giao chua thanh toan khong vao bep
 *   G. Doi mon dat truoc: han dish_edit_cutoff_days, khach / nhan vien, dong bo bep
 *
 * Yeu cau: server dang chay o http://127.0.0.1:3000, CSDL da chay migration 031-036.
 * Chay:  node scripts/test-tinh-nang-moi.js
 *
 * Moi du lieu tao ra (don tiec, phieu thu chi, phieu kho, don mua) duoc don sach
 * khi ket thuc; ton kho nguyen lieu duoc tra ve dung so truoc khi chay.
 */
const path = require('path');
const db = require(path.join(__dirname, '..', 'config', 'db'));
const rules = require(path.join(__dirname, '..', 'services', 'reservationRules'));
const chinhSach = require(path.join(__dirname, '..', 'services', 'chinhSachGiaoService'));

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const KQ = { dat: 0, hong: 0, loi: [] };
const DON_DEP = { tiec: [], phieu: [], pn: [], px: [], dmh: [], rsv: [] };

// ------------------------------------------------------------------ tien ich

function ok(ten, dk, chiTiet = '') {
  if (dk) { KQ.dat++; console.log(`  \x1b[32m✓\x1b[0m ${ten}${chiTiet ? ` \x1b[2m— ${chiTiet}\x1b[0m` : ''}`); }
  else { KQ.hong++; KQ.loi.push(`${ten}${chiTiet ? ` — ${chiTiet}` : ''}`); console.log(`  \x1b[31m✗ ${ten}\x1b[0m${chiTiet ? ` — ${chiTiet}` : ''}`); }
}
function nhom(t) { console.log(`\n\x1b[1m\x1b[36m▶ ${t}\x1b[0m`); }

function ngayCong(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mot "trinh duyet" giu cookie rieng. */
class Phien {
  constructor() { this.cookie = {}; }
  hdrCookie() { return Object.entries(this.cookie).map(([k, v]) => `${k}=${v}`).join('; '); }
  async goi(duong, { method = 'GET', form, json } = {}) {
    const headers = { Cookie: this.hdrCookie() };
    let body;
    if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    else if (form !== undefined) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
    const r = await fetch(BASE + duong, { method, headers, body, redirect: 'manual' });
    for (const c of r.headers.getSetCookie ? r.headers.getSetCookie() : []) {
      const [kv] = c.split(';'); const i = kv.indexOf('=');
      this.cookie[kv.slice(0, i)] = kv.slice(i + 1);
    }
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch (_) { /* html */ }
    return { status: r.status, location: r.headers.get('location') || '', text, data };
  }
}

async function dangNhapNV(user, pass = '123456') {
  const p = new Phien();
  await p.goi('/staff/login');
  const r = await p.goi('/staff/login', { method: 'POST', form: { username: user, password: pass } });
  p.ok = r.status === 302 && !/login/.test(r.location);
  return p;
}

async function taoKhach() {
  const p = new Phien();
  const hau = String(Date.now()).slice(-6);
  const kh = { ten: `AUTOTEST Khach ${hau}`, sodienthoai: `097${hau}`, email: `autotest_new_${hau}@gmail.com`,
    diachi: 'Gò Vấp, TP.HCM', passwords: 'TestPassword123!', repass: 'TestPassword123!' };
  await p.goi('/register', { method: 'POST', form: kh });
  const r = await p.goi('/login', { method: 'POST', form: { sdt: kh.sodienthoai, pass: kh.passwords } });
  p.ok = r.status === 302;
  p.kh = kh;
  return p;
}

async function themMonVaoGio(p) {
  const [[mon]] = await db.query('SELECT id_mon FROM monan WHERE tinhtrang = 1 ORDER BY gia_mon DESC LIMIT 1');
  await p.goi('/add-to-cart', { method: 'POST', form: { monid: mon.id_mon, soluong: 2 } });
}

// Toa do da kiem: trong vung (Go Vap ~0.8 km), ngoai vung (Q1, Bitexco)
const TRONG_VUNG = { vi_do: '10.830000', kinh_do: '106.688000' };
const NGOAI_VUNG = { vi_do: '10.771663', kinh_do: '106.704384' };

/** Dat mot don giao: luu dia chi -> dat don. Tra ve { r, sesis }. */
async function datDonGiao(p, { dongY = true, toaDo = TRONG_VUNG } = {}) {
  await themMonVaoGio(p);
  await p.goi('/giao-hang', { method: 'POST', form: {
    dia_chi_giao: '1 Nguyễn Văn Bảo, Gò Vấp, TP.HCM', ten_nguoi_nhan: p.kh.ten,
    sdt_nguoi_nhan: p.kh.sodienthoai, ...toaDo, ghi_chu_giao: 'AUTOTEST' } });
  const form = { hinh_thuc: 'giao_hang', dia_chi_giao: '1 Nguyễn Văn Bảo, Gò Vấp, TP.HCM', ...toaDo,
    datebook: ngayCong(0), timebook: '18:00' };
  if (dongY) form.dong_y_chinh_sach = '1';
  const r = await p.goi('/datban', { method: 'POST', form });
  const m = /\/thanh-toan\/don-hang\/([^/?#]+)/.exec(r.location);
  return { r, sesis: m ? decodeURIComponent(m[1]) : null };
}

async function donGiao(sesis) {
  const [[d]] = await db.query('SELECT * FROM don_giao_hang WHERE sesis = ?', [sesis]);
  return d;
}

// ====================================================================== A
async function testGiaoHang(nv) {
  nhom('A. Chính sách giao hàng (vùng giao, phí bậc thang, thanh toán trước, hủy & hoàn điểm)');

  const trang = await new Phien().goi('/chinh-sach-giao-hang');
  ok('Trang chính sách giao hàng hiển thị (GET /chinh-sach-giao-hang)', trang.status === 200 && /giao/i.test(trang.text));

  // --- Bao gia
  const bg1 = await new Phien().goi(`/api/giao-hang/bao-gia?vi_do=${TRONG_VUNG.vi_do}&kinh_do=${TRONG_VUNG.kinh_do}&tien_hang=200000`);
  ok('Báo giá trong vùng giao: giao được, có phí và chi tiết chặng', bg1.data && bg1.data.giao_duoc === true && bg1.data.phi > 0,
    bg1.data ? `${bg1.data.khoang_cach_km} km → ${bg1.data.phi}đ` : bg1.status);
  const bg2 = await new Phien().goi(`/api/giao-hang/bao-gia?vi_do=${NGOAI_VUNG.vi_do}&kinh_do=${NGOAI_VUNG.kinh_do}&tien_hang=200000`);
  ok('Báo giá ngoài khu vực (Q1) bị từ chối kèm lý do', bg2.data && bg2.data.giao_duoc === false && !!bg2.data.ly_do);
  const bg3 = await new Phien().goi('/api/giao-hang/bao-gia?vi_do=&kinh_do=');
  ok('Báo giá thiếu tọa độ không bị hiểu thành điểm (0,0)', bg3.status === 200 && bg3.data && bg3.data.giao_duoc === false
    && !(Number(bg3.data.khoang_cach_km) > 1000), bg3.data && bg3.data.ly_do);

  // --- Phi bac thang (ham thuan)
  const dv = { so_km_dau: 2, phi_co_ban: 15000, phi_moi_km: 5000 };
  const p1 = chinhSach.tinhPhiDonVi(1, dv); const p6 = chinhSach.tinhPhiDonVi(6.3, dv); const p10 = chinhSach.tinhPhiDonVi(10, dv);
  ok('Phí ship: ≤ km đầu chỉ tính phí trọn gói', p1.phi === 15000, `${p1.phi}đ`);
  ok('Phí ship 6,3 km làm tròn 6,5 km, chặng 5–8 km giảm 20%', p6.km_tinh_phi === 6.5 && p6.phi === 36000, `${p6.phi}đ`);
  const dg = p10.chi_tiet.map((c) => c.don_gia).filter(Boolean);
  ok('Phí ship bậc thang: đơn giá/km giảm dần theo chặng', dg.length === 3 && dg[0] > dg[1] && dg[1] > dg[2], dg.join(' > '));

  // --- Dat don
  const kh = await taoKhach();
  ok('Khách test đăng ký & đăng nhập', kh.ok);

  const khongDongY = await datDonGiao(kh, { dongY: false });
  ok('Đặt đơn giao khi CHƯA đồng ý chính sách bị chặn', !khongDongY.sesis && /Chính sách giao hàng/.test(khongDongY.r.text));

  const ngoaiVung = await datDonGiao(kh, { toaDo: NGOAI_VUNG });
  ok('Đặt đơn giao tới địa chỉ ngoài khu vực bị chặn', !ngoaiVung.sesis && /khu vực/i.test(ngoaiVung.r.text));

  const d1 = await datDonGiao(kh);
  ok('Đặt đơn giao hợp lệ → chuyển sang trang thanh toán trước (không COD)', !!d1.sesis, d1.r.location);
  if (!d1.sesis) return;
  let g1 = await donGiao(d1.sesis);
  ok('Đơn mới ở trạng thái chờ thanh toán, có hạn giữ đơn', g1 && g1.trang_thai === 'cho_thanh_toan' && !!g1.han_thanh_toan,
    g1 && `${g1.ma_giao} / ${g1.trang_thai}`);

  const tt = await kh.goi(`/thanh-toan/don-hang/${encodeURIComponent(d1.sesis)}`);
  ok('Trang thanh toán đơn giao hiển thị VietQR (món + ship)', tt.status === 200 && /VietQR|qr/i.test(tt.text));

  const nguoiLa = await taoKhach();
  const la = await nguoiLa.goi(`/thanh-toan/don-hang/${encodeURIComponent(d1.sesis)}`);
  ok('Khách khác không xem/thanh toán được đơn của người khác (403)', la.status === 403);

  // KDS: don chua tra tien khong duoc vao bep
  const bep = await dangNhapNV('beptruong');
  const kds1 = await bep.goi('/kds/api/don');
  ok('KDS: đơn giao CHƯA thanh toán không hiện trong bếp', kds1.status === 200 && !kds1.text.includes(d1.sesis));

  // Thanh toan gia lap
  const gl = await kh.goi(`/thanh-toan/don-hang/${encodeURIComponent(d1.sesis)}/gia-lap`, { method: 'POST', json: {} });
  g1 = await donGiao(d1.sesis);
  ok('Thanh toán trước 100% (giả lập) → đơn rời trạng thái chờ thanh toán', gl.status === 200 && gl.data && gl.data.thanhCong
    && g1.trang_thai !== 'cho_thanh_toan', g1 && g1.trang_thai);
  const gl2 = await kh.goi(`/thanh-toan/don-hang/${encodeURIComponent(d1.sesis)}/gia-lap`, { method: 'POST', json: {} });
  ok('Không thanh toán lặp lần 2 cho đơn đã trả', gl2.status === 400);

  const kds2 = await bep.goi('/kds/api/don');
  ok('KDS: đơn giao ĐÃ thanh toán xuất hiện trong bếp', kds2.status === 200 && kds2.text.includes(d1.sesis));

  const td = await new Phien().goi(`/theo-doi/${g1.ma_giao}`);
  ok('Trang theo dõi đơn giao (GET /theo-doi/:ma)', td.status === 200 && td.text.includes(g1.ma_giao));

  // Khach tu huy don da tra -> loi khach -> khong hoan
  const huy1 = await kh.goi(`/theo-doi/${g1.ma_giao}/huy`, { method: 'POST', form: {} });
  g1 = await donGiao(d1.sesis);
  ok('Khách tự hủy đơn đã trả: đơn bị hủy, lỗi khách, KHÔNG hoàn điểm',
    huy1.status === 302 && g1.trang_thai === 'huy' && g1.ben_loi === 'khach' && Number(g1.diem_hoan) === 0,
    `${g1.trang_thai}/${g1.ben_loi}/diem_hoan=${g1.diem_hoan}`);

  // Don 2: huy truoc khi tra tien -> mien phi
  const d2 = await datDonGiao(kh);
  if (d2.sesis) {
    const h2 = await kh.goi(`/thanh-toan/don-hang/${encodeURIComponent(d2.sesis)}/huy`, { method: 'POST', json: {} });
    const g2 = await donGiao(d2.sesis);
    ok('Khách hủy đơn khi chưa thanh toán (POST /thanh-toan/don-hang/:sesis/huy)', h2.status === 200 && g2.trang_thai === 'huy');
  } else ok('Tạo đơn thứ 2 để hủy trước thanh toán', false, d2.r.location || d2.r.status);

  // Don 3: tra tien -> dieu phoi huy vi loi nha hang -> hoan diem
  const d3 = await datDonGiao(kh);
  const dp = await dangNhapNV('dieuphoi');
  ok('Đăng nhập Điều phối giao hàng', dp.ok);
  if (d3.sesis) {
    await kh.goi(`/thanh-toan/don-hang/${encodeURIComponent(d3.sesis)}/gia-lap`, { method: 'POST', json: {} });
    let g3 = await donGiao(d3.sesis);
    const kxLyDo = await dp.goi(`/staff/giao-hang/${g3.id_giao}/trang-thai`, { method: 'POST', form: { trang_thai: 'huy' } });
    g3 = await donGiao(d3.sesis);
    ok('Điều phối hủy đơn mà KHÔNG chọn lý do bị từ chối', kxLyDo.status === 302 && g3.trang_thai !== 'huy');
    const xx = await dp.goi(`/staff/giao-hang/${g3.id_giao}/trang-thai`, { method: 'POST', form: { trang_thai: 'huy', ma_ly_do: 'het_mon', ly_do: 'AUTOTEST' } });
    g3 = await donGiao(d3.sesis);
    ok('Điều phối hủy do LỖI NHÀ HÀNG → hoàn 100% bằng điểm', xx.status === 302 && g3.trang_thai === 'huy'
      && g3.ben_loi === 'nha_hang' && Number(g3.diem_hoan) > 0, `diem_hoan=${g3.diem_hoan}`);
    const [[hd]] = await db.query('SELECT COUNT(*) n FROM hoan_diem_giao_hang WHERE id_giao = ?', [g3.id_giao]);
    ok('Ghi nhận lịch sử hoàn điểm (hoan_diem_giao_hang)', Number(hd.n) > 0);
    const khHuy = await kh.goi(`/theo-doi/${g3.ma_giao}/huy`, { method: 'POST', form: {} });
    ok('Không hủy lại đơn đã hủy', /loi=/.test(khHuy.location));
  } else ok('Tạo đơn thứ 3 (hủy do nhà hàng)', false);

  // Don 4: di HET luong giao hang - kiem tra THONG BAO cho tung vai tro o moi buoc.
  await kichBanThongBaoGiaoHang(kh, dp);

  const shipperXem = await (await dangNhapNV('phucvu')).goi('/staff/giao-hang/dieu-phoi');
  ok('RBAC: Phục vụ không vào được trang điều phối giao hàng', shipperXem.status !== 200, `HTTP ${shipperXem.status}`);
}

// ====================================================================== B
/**
 * Thong bao theo luong giao hang: tra tien -> dieu phoi biet; phan don -> shipper
 * biet; shipper nhan -> dieu phoi biet; bep xong mon cuoi -> shipper den lay;
 * dang giao / da giao -> khach + dieu phoi biet.
 */
async function kichBanThongBaoGiaoHang(kh, dp) {
  const [[moc]] = await db.query('SELECT COALESCE(MAX(id_tb), 0) AS m FROM thong_bao');
  const choTb = async (loai, dk = () => true) => {
    for (let i = 0; i < 30; i++) {
      const [r] = await db.query(
        `SELECT t.*, n.username FROM thong_bao t LEFT JOIN nhan_vien n ON n.id_nv = t.id_nv
          WHERE t.id_tb > ? AND t.loai = ?`, [moc.m, loai]);
      const loc = r.filter(dk);
      if (loc.length) return loc;
      await new Promise((ok2) => setTimeout(ok2, 150));
    }
    return [];
  };
  const d4 = await datDonGiao(kh);
  if (!d4.sesis) { ok('Tạo đơn thứ 4 (luồng thông báo giao hàng)', false); return; }
  await kh.goi(`/thanh-toan/don-hang/${encodeURIComponent(d4.sesis)}/gia-lap`, { method: 'POST', json: {} });
  let g4 = await donGiao(d4.sesis);
  let tb = await choTb('don_giao_moi', (x) => x.tieu_de.includes(g4.ma_giao) && x.username === 'dieuphoi');
  ok('TB: khách trả tiền đơn giao → Điều phối nhận "chờ phân shipper"', tb.some((x) => x.username === 'dieuphoi'), tb.map((x) => x.username).join(','));

  const sp = await dangNhapNV('shipper1');
  const [[s1]] = await db.query("SELECT s.id_shipper, s.id_nv FROM shipper s JOIN nhan_vien n ON n.id_nv = s.id_nv WHERE n.username = 'shipper1'");
  const phan = await dp.goi(`/staff/giao-hang/${g4.id_giao}/phan`, { method: 'POST', form: { id_shipper: String(s1.id_shipper) } });
  g4 = await donGiao(d4.sesis);
  ok('Điều phối phân đơn cho shipper1', Number(g4.id_shipper) === Number(s1.id_shipper), `${phan.status} ${g4.trang_thai}`);
  tb = await choTb('don_giao_phan', (x) => Number(x.id_nv) === Number(s1.id_nv) && x.tieu_de.includes(g4.ma_giao));
  ok('TB: shipper được phân nhận "Bạn được phân đơn" (link app shipper)', tb.length === 1 && tb[0].link === '/shipper/', tb[0] && tb[0].tieu_de);

  await sp.goi(`/api/shipper/don/${g4.id_giao}/xac-nhan`, { method: 'POST', json: {} });
  tb = await choTb('don_giao_nhan', (x) => x.tieu_de.includes(g4.ma_giao) && x.username === 'dieuphoi');
  ok('TB: shipper xác nhận nhận đơn → Điều phối biết', tb.some((x) => x.username === 'dieuphoi'));

  // Bep lam xong TUNG mon: chi mon CUOI moi bao shipper den lay (1 lan).
  const bep = await dangNhapNV('daubep');
  const [mon] = await db.query('SELECT id FROM hopdong WHERE sesis = ? AND id_mon > 0 AND soluong > 0', [d4.sesis]);
  for (const m of mon) await bep.goi(`/kds/api/hoan-thanh/${m.id}`, { method: 'POST', json: {} });
  // Cho RIENG tung nguoi nhan: thong bao ghi lan luot tung dong.
  const bxDp = await choTb('don_giao_bep_xong', (x) => x.tieu_de.includes(g4.ma_giao) && x.username === 'dieuphoi');
  tb = await choTb('don_giao_bep_xong', (x) => x.tieu_de.includes(g4.ma_giao) && Number(x.id_nv) === Number(s1.id_nv));
  ok('TB: bếp xong món cuối đơn giao → shipper được báo đến lấy + Điều phối',
    tb.length === 1 && bxDp.length === 1, `${mon.length} món, shipper ${tb.length}, điều phối ${bxDp.length}`);
  const [phucVu] = await db.query("SELECT t.id_tb FROM thong_bao t WHERE t.id_tb > ? AND t.loai = 'mon_xong'", [moc.m]);
  ok('TB: món của đơn giao KHÔNG báo nhầm cho phục vụ bàn', phucVu.length === 0);

  // Shipper di lay -> giao -> giao xong (toa do dung diem giao de qua kiem tra GPS).
  const viTri = { vi_do: String(g4.vi_do), kinh_do: String(g4.kinh_do) };
  const buoc = async (tt) => (await sp.goi(`/api/shipper/don/${g4.id_giao}/trang-thai`, { method: 'POST', json: { trang_thai: tt, ...viTri } })).data || {};
  let r = await buoc('dang_lay');
  tb = await choTb('don_giao_nhan', (x) => /đang đến lấy/.test(x.tieu_de) && x.tieu_de.includes(g4.ma_giao) && x.username === 'dieuphoi');
  ok('TB: shipper "đang lấy hàng" → Điều phối biết', r.ok && tb.some((x) => x.username === 'dieuphoi'), r.thong_bao);
  await sp.goi(`/api/shipper/don/${g4.id_giao}/kiem-hang`, { method: 'POST', json: { mon_ids: mon.map((m) => m.id), niem_phong: true } });
  r = await buoc('dang_giao');
  const [[khDb]] = await db.query('SELECT id FROM khach_hang WHERE sodienthoai = ?', [kh.kh.sodienthoai]);
  tb = await choTb('don_giao_khach', (x) => Number(x.id_kh) === Number(khDb.id) && /đang trên đường/.test(x.tieu_de));
  ok('TB: đang giao → khách nhận "đơn đang trên đường giao"', r.ok && tb.length === 1, r.thong_bao);
  await sp.goi(`/api/shipper/don/${g4.id_giao}/den-noi`, { method: 'POST', json: viTri });
  const [[ma]] = await db.query('SELECT ma_nhan_hang FROM don_giao_hang WHERE id_giao = ?', [g4.id_giao]);
  r = (await sp.goi(`/api/shipper/don/${g4.id_giao}/trang-thai`, { method: 'POST',
    json: { trang_thai: 'da_giao', ...viTri, ma_nhan_hang: ma && ma.ma_nhan_hang } })).data || {};
  g4 = await donGiao(d4.sesis);
  ok('Shipper giao thành công đơn 4', g4.trang_thai === 'da_giao', r.thong_bao);
  tb = await choTb('don_giao_hoan_thanh', (x) => x.tieu_de.includes(g4.ma_giao) && x.username === 'dieuphoi');
  ok('TB: giao xong → Điều phối nhận "đã giao xong"', tb.some((x) => x.username === 'dieuphoi'));
  tb = await choTb('don_giao_khach', (x) => Number(x.id_kh) === Number(khDb.id) && /giao thành công/.test(x.tieu_de));
  ok('TB: giao xong → khách nhận "đã giao thành công"', tb.length === 1);
  const chuong = await kh.goi('/api/thong-bao?la=khach');
  ok('Chuông khách hàng hiện thông báo đơn giao', chuong.data && chuong.data.ds && chuong.data.ds.some((x) => x.loai === 'don_giao_khach'));
}

async function testQuyMoBan() {
  nhom('B. Ràng buộc quy mô bàn (đặt bàn)');
  const ch = await rules.docCauHinh();
  const t = (cho, k) => (rules.kiemTraQuyMoBan(cho, k, ch) || { ma: 'OK' }).ma;
  ok('2 khách – 1 bàn 2 chỗ: hợp lệ', t([2], 2) === 'OK');
  ok('2 khách – bàn 4 chỗ: hợp lệ (≤ ngưỡng 1 bàn)', t([4], 2) === 'OK');
  ok('2 khách – ghép 2 bàn: chặn ONE_TABLE_ONLY', t([2, 2], 2) === 'ONE_TABLE_ONLY');
  ok('2 khách – bàn 8 chỗ: chặn TOO_MANY_SEATS', t([8], 2) === 'TOO_MANY_SEATS');
  ok('5 khách – bàn 4 chỗ: chặn NOT_ENOUGH_SEATS', t([4], 5) === 'NOT_ENOUGH_SEATS');
  ok('10 khách – 3 bàn (6+4+4): chặn EXTRA_TABLE', t([6, 4, 4], 10) === 'EXTRA_TABLE');
  ok('10 khách – 2 bàn (6+4): hợp lệ', t([6, 4], 10) === 'OK');
  ok('30 khách – 40 chỗ: chặn thừa ghế', t([10, 10, 10, 10], 30) !== 'OK');
  ok('Không chọn bàn: NO_TABLE', t([], 2) === 'NO_TABLE');

  // Qua API that
  const [ban] = await db.query(`SELECT Id_ban, so_cho, id_vitri FROM ban WHERE cho_dat_truoc = 1 AND trangthai IN (0,1)
                                 AND ghi_chu_bao_tri IS NULL ORDER BY id_vitri, so_cho`);
  const nho = ban.filter((b) => b.so_cho <= 2);
  const cap = nho.find((a) => nho.some((b) => b !== a && b.id_vitri === a.id_vitri));
  const ngay = ngayCong(10);
  const kh = await taoKhach(); // dat ban online can dang nhap
  const base = { customer_name: 'AUTOTEST Quy mo', phone: '0971234567', reservation_date: ngay, start_time: '14:00', guest_count: 2 };
  if (cap) {
    const cap2 = nho.find((b) => b !== cap && b.id_vitri === cap.id_vitri);
    const r = await kh.goi('/api/dat-ban', { method: 'POST', json: { ...base, table_ids: [cap.Id_ban, cap2.Id_ban] } });
    ok('API: 2 khách tự chọn 2 bàn bị từ chối', r.status >= 400 && r.data && r.data.ok === false, r.data && (r.data.ma || r.data.thong_bao));
  }
  const lon = ban.find((b) => b.so_cho >= 8);
  if (lon) {
    const r = await kh.goi('/api/dat-ban', { method: 'POST', json: { ...base, table_ids: [lon.Id_ban] } });
    ok(`API: 2 khách chọn bàn ${lon.so_cho} chỗ bị từ chối`, r.status >= 400 && r.data && r.data.ok === false, r.data && (r.data.ma || r.data.thong_bao));
  }
  const kd = await kh.goi(`/api/dat-ban/kha-dung?reservation_date=${ngay}&start_time=14:00&guest_count=2`);
  const gy = kd.data && kd.data.goi_y;
  ok('API gợi ý cho 2 khách: đúng 1 bàn, không thừa quá 2 ghế', gy && gy.so_ban === 1 && gy.tong_cho <= 4, gy && `${gy.so_ban} bàn/${gy.tong_cho} chỗ`);
}

// ====================================================================== C
async function testDatTiec() {
  nhom('C. Không gian nhà hàng & Đặt tiệc');
  const k = await taoKhach(); // dat tiec can dang nhap
  {
    const an = new Phien();
    const g = await an.goi('/dat-tiec');
    ok('Khách chưa đăng nhập mở /dat-tiec → chuyển sang đăng nhập', g.status === 302 && /\/login\?tiep=/.test(g.location), g.location);
    const a1 = await an.goi('/api/dat-tiec', { method: 'POST', json: {} });
    const a2 = await an.goi('/api/dat-ban', { method: 'POST', json: {} });
    const gh = await an.goi('/cart');
    ok('API đặt tiệc / đặt bàn chặn khách chưa đăng nhập (401), giỏ giao hàng chuyển đăng nhập', a1.status === 401 && a2.status === 401 && gh.status === 302, `${a1.status}/${a2.status}/${gh.status}`);
  }
  const kg = await k.goi('/khong-gian');
  ok('Trang không gian nhà hàng (GET /khong-gian)', kg.status === 200);
  const tr = await k.goi('/dat-tiec');
  ok('Trang đặt tiệc (GET /dat-tiec)', tr.status === 200);

  const dv = require(path.join(__dirname, '..', 'services', 'datTiecService'));
  const [sanhDs, tdDs] = await Promise.all([dv.docSanhTiec(), dv.docThucDon()]);
  ok('Có sảnh tiệc và thực đơn tiệc trong CSDL', sanhDs.length > 0 && tdDs.length > 0, `${sanhDs.length} sảnh, ${tdDs.length} thực đơn`);
  if (!sanhDs.length || !tdDs.length) return;
  // Dat tiec online chi o Sanh Gala (services/datTiecQuyTrinh.js).
  const sanh = await require(path.join(__dirname, '..', 'services', 'datTiecQuyTrinh')).sanhGala(); const td = tdDs[0];

  // Chon mot ngay xa con trong buoi TOI cho sanh nay
  let ngay = null;
  for (let i = 200; i < 260; i++) {
    const n = ngayCong(i);
    const kin = await dv.lichDaKin(n, n);
    if (!kin.some((x) => Number(x.khu_vuc_id) === Number(sanh.id) && x.buoi === 'TOI')) { ngay = n; break; }
  }
  const hopLe = { ho_ten: 'AUTOTEST Đặt tiệc', so_dien_thoai: '0971112233', email: 'autotest@gmail.com',
    loai_tiec: 'SINH_NHAT', ngay_to_chuc: ngay, buoi: 'TOI', gio_bat_dau: '18:00',
    so_khach: sanh.tiec_toi_thieu, thuc_don_id: td.id, ghi_chu: 'AUTOTEST', dong_y_chinh_sach: true };

  const loi = async (ten, sua) => {
    const r = await k.goi('/api/dat-tiec', { method: 'POST', json: { ...hopLe, ...sua } });
    ok(ten, r.status === 400 && r.data && r.data.ok === false, r.data && r.data.thong_bao);
  };
  await loi('Từ chối SĐT không hợp lệ', { so_dien_thoai: '12345' });
  await loi('Từ chối đặt tiệc gấp (< 3 ngày)', { ngay_to_chuc: ngayCong(1) });
  await loi('Từ chối đặt quá 12 tháng', { ngay_to_chuc: ngayCong(400) });
  await loi('Từ chối giờ không thuộc buổi', { gio_bat_dau: '11:00' });
  await loi('Từ chối số khách vượt sức chứa sảnh', { so_khach: sanh.tiec_toi_da + 1 });
  await loi('Từ chối loại tiệc không tồn tại', { loai_tiec: 'XYZ' });
  await loi('Từ chối khi chưa đồng ý chính sách đặt tiệc', { dong_y_chinh_sach: false });
  await loi('Ít hơn số khách tối thiểu → không đủ điều kiện, mời đặt bàn', { so_khach: sanh.tiec_toi_thieu - 1 });

  const r = await k.goi('/api/dat-tiec', { method: 'POST', json: hopLe });
  const ma = r.data && r.data.ma;
  ok('Tạo yêu cầu đặt tiệc hợp lệ (201) kèm dự toán & số bàn, giữ sảnh chờ cọc', r.status === 201 && !!ma && r.data.tong_du_toan > 0 && r.data.trang_thai === 'CHO_COC'
    && r.data.so_ban === Math.ceil(hopLe.so_khach / dv.KHACH_MOI_BAN), ma && `${ma} · ${r.data.so_ban} bàn · ${r.data.tong_du_toan}đ`);
  if (!r.data || !r.data.id) return;
  DON_DEP.tiec.push(r.data.id);

  // Don thu 2 cung sanh, cung buoi -> bi chan ngay (don dau dang giu sanh cho coc).
  const r2 = await k.goi('/api/dat-tiec', { method: 'POST', json: { ...hopLe, ho_ten: 'AUTOTEST Tiệc 2' } });
  if (r2.data && r2.data.id) DON_DEP.tiec.push(r2.data.id);
  ok('Khách khác đặt trùng sảnh + buổi đang giữ chỗ → bị chặn ngay', r2.status === 409, r2.data && r2.data.thong_bao);

  const lt = await dangNhapNV('letan');
  const ds = await lt.goi('/staff/dat-tiec');
  ok('Nhân viên xem danh sách đặt tiệc (GET /staff/dat-tiec)', ds.status === 200 && ds.text.includes(ma));
  const xn = await lt.goi(`/api/staff/dat-tiec/${r.data.id}/trang-thai`, { method: 'POST',
    json: { trang_thai: 'DA_COC', so_tien: r.data.tien_coc, phuong_thuc: 'tien_mat', ghi_chu_noi_bo: 'AUTOTEST' } });
  ok('Lễ tân thu cọc tại quầy → giữ sảnh chính thức', xn.status === 200 && xn.data.ok, xn.data && xn.data.thong_bao);

  const lich = await k.goi(`/api/dat-tiec/lich?ngay=${ngay}`);
  ok('Lịch sảnh báo buổi tối đã kín (giờ tô đỏ) sau khi cọc', lich.data && lich.data.kin.some((x) => Number(x.khu_vuc_id) === Number(sanh.id) && x.buoi === 'TOI')
    && lich.data.buoi.find((b) => b.ma === 'TOI').gio.every((g) => !g.trong));

  const r3 = await k.goi('/api/dat-tiec', { method: 'POST', json: { ...hopLe, ho_ten: 'AUTOTEST Tiệc 3' } });
  if (r3.data && r3.data.id) DON_DEP.tiec.push(r3.data.id);
  ok('Chặn đặt tiệc trùng sảnh + buổi đã giữ chỗ (CONFLICT)', r3.status === 409 || (r3.data && r3.data.ma === 'CONFLICT'), r3.data && r3.data.thong_bao);


  const sai = await lt.goi(`/api/staff/dat-tiec/${r.data.id}/trang-thai`, { method: 'POST', json: { trang_thai: 'ABC' } });
  ok('Từ chối trạng thái không hợp lệ', sai.status === 400);
  const an = await new Phien().goi(`/api/staff/dat-tiec/${r.data.id}/trang-thai`, { method: 'POST', json: { trang_thai: 'HUY' } });
  ok('API nhân viên đặt tiệc chặn khi chưa đăng nhập (401)', an.status === 401);
  const bep = await dangNhapNV('daubep');
  const bepXem = await bep.goi('/staff/dat-tiec');
  ok('RBAC: Đầu bếp không vào được quản lý đặt tiệc', bepXem.status !== 200, `HTTP ${bepXem.status}`);
}

// C2 (dat tiec chi tiet: phan cong, sua don, coc/hoan theo cau hinh) da bo:
// sau khi gop nhanh bao, luong do duoc kiem trong tests/tichHop.test.js
// ("dat tiec: vong doi dung thu tu, coc va thanh toan...").

// ====================================================================== D
async function testThuChi() {
  nhom('D. Phiếu thu / chi & chốt ca');
  const tn = await dangNhapNV('thungan');
  const kt = await dangNhapNV('ketoan');
  ok('Đăng nhập Thu ngân & Kế toán', tn.ok && kt.ok);

  const trang = await tn.goi('/staff/thu-chi');
  ok('Thu ngân mở sổ thu chi (GET /staff/thu-chi)', trang.status === 200);
  const xl = await kt.goi('/staff/thu-chi/excel');
  ok('Kế toán xuất Excel sổ thu chi', xl.status === 200);

  const hl = { loai: 'chi', danh_muc: 'vat_tu', so_tien: '150000', phuong_thuc: 'tien_mat', noi_dung: 'AUTOTEST mua đá viên', doi_tuong: 'AUTOTEST' };
  const sai = async (ten, sua) => {
    const r = await tn.goi('/api/staff/thu-chi/phieu', { method: 'POST', json: { ...hl, ...sua } });
    ok(ten, r.status === 400 && r.data && r.data.ok === false, r.data && r.data.thong_bao);
  };
  await sai('Từ chối số tiền < 1.000đ', { so_tien: '500' });
  await sai('Từ chối số tiền vượt hạn mức 500 triệu', { so_tien: '600000000' });
  await sai('Từ chối danh mục thu "bán hàng" lập tay', { loai: 'thu', danh_muc: 'ban_hang' });
  await sai('Từ chối thiếu nội dung', { noi_dung: '' });
  await sai('Từ chối phương thức không hợp lệ', { phuong_thuc: 'bitcoin' });

  const r = await tn.goi('/api/staff/thu-chi/phieu', { method: 'POST', json: hl });
  ok('Thu ngân lập phiếu chi hợp lệ (201)', r.status === 201 && r.data && /^P?C/i.test(r.data.ma_phieu || ''), r.data && r.data.ma_phieu);
  const r2 = await tn.goi('/api/staff/thu-chi/phieu', { method: 'POST', json: { ...hl, loai: 'thu', danh_muc: 'thanh_ly', noi_dung: 'AUTOTEST thanh lý vỏ chai' } });
  ok('Thu ngân lập phiếu thu hợp lệ (201)', r2.status === 201 && r2.data && !!r2.data.ma_phieu, r2.data && r2.data.ma_phieu);
  [r, r2].forEach((x) => x.data && x.data.id && DON_DEP.phieu.push(x.data.id));
  if (r.data && r.data.id) {
    const inP = await tn.goi(`/staff/thu-chi/phieu/${r.data.id}/in`);
    ok('In phiếu thu/chi', inP.status === 200 && inP.text.includes(r.data.ma_phieu));
    const thieu = await tn.goi(`/api/staff/thu-chi/phieu/${r.data.id}/huy`, { method: 'POST', json: { ly_do: '' } });
    ok('Hủy phiếu bắt buộc ghi lý do', thieu.status === 400);
    const h = await tn.goi(`/api/staff/thu-chi/phieu/${r.data.id}/huy`, { method: 'POST', json: { ly_do: 'AUTOTEST lập nhầm' } });
    const [[p]] = await db.query('SELECT trang_thai FROM phieu_thu_chi WHERE id = ?', [r.data.id]);
    ok('Hủy phiếu có lý do → trạng thái đã hủy', h.status === 200 && p.trang_thai === 'da_huy');
    const h2 = await tn.goi(`/api/staff/thu-chi/phieu/${r.data.id}/huy`, { method: 'POST', json: { ly_do: 'AUTOTEST lần 2' } });
    ok('Không hủy lặp phiếu đã hủy', h2.status === 400);
  }
  const ktLap = await kt.goi('/api/staff/thu-chi/phieu', { method: 'POST', json: hl });
  if (ktLap.data && ktLap.data.id) DON_DEP.phieu.push(ktLap.data.id);
  // Tai lieu chuc nang ke toan: KE TOAN lap phieu chi; thu ngan chi lap khoan nho tai quay.
  ok('RBAC: Kế toán lập được phiếu thu chi', ktLap.status === 201, `HTTP ${ktLap.status}`);
  const tnLon = await tn.goi('/api/staff/thu-chi/phieu', { method: 'POST', json: { ...hl, loai: 'chi', danh_muc: 'vat_tu', so_tien: '50000000' } });
  if (tnLon.data && tnLon.data.id) DON_DEP.phieu.push(tnLon.data.id);
  ok('RBAC: Thu ngân không lập phiếu chi lớn (vượt hạn mức quầy)', tnLon.status === 403, `HTTP ${tnLon.status}`);
  const pv = await (await dangNhapNV('phucvu')).goi('/staff/thu-chi');
  ok('RBAC: Phục vụ không xem được sổ thu chi', pv.status !== 200, `HTTP ${pv.status}`);
  const cc = await tn.goi('/staff/chot-ca/tong-hop');
  ok('Tổng hợp chốt ca có tính phiếu thu/chi tiền mặt', cc.status === 200 && !!cc.data, cc.text.slice(0, 80));
}

// ====================================================================== E
async function testKhoBep() {
  nhom('E. Kho bếp: phiếu nhập / xuất, đơn mua hàng');
  // Phan quyen kho (services/phanQuyenKho.js): THU KHO nhap / xuat / nhan hang,
  // bep truong chi de xuat don mua, quan ly duyet.
  const bt = await dangNhapNV('beptruong');
  const tk = await dangNhapNV('thukho');
  const ql = await dangNhapNV('quanly');
  ok('Đăng nhập Bếp trưởng, Thủ kho & Quản lý', bt.ok && tk.ok && ql.ok);
  const btNhap = await bt.goi('/api/kitchen/kho/nhap', { method: 'POST', json: { dong: [] } });
  ok('RBAC: Bếp trưởng không tự lập phiếu nhập kho (403)', btNhap.status === 403, `HTTP ${btNhap.status}`);
  const btForm = await bt.goi('/staff/kitchen/kho/xuat/moi');
  ok('RBAC: Bếp trưởng không mở được form lập phiếu xuất (403)', btForm.status === 403, `HTTP ${btForm.status}`);

  for (const [u, ten] of [['/staff/kitchen/kho', 'Sổ kho'], ['/staff/kitchen/mua-hang', 'Mua hàng'], ['/staff/kitchen/thong-ke', 'Thống kê bếp'],
    ['/staff/kitchen/kho/nhap/moi', 'Lập phiếu nhập'], ['/staff/kitchen/kho/xuat/moi', 'Lập phiếu xuất']]) {
    const r = await (u.includes('thong-ke') ? bt : tk).goi(u);
    ok(`Trang ${ten} (GET ${u})`, r.status === 200, `HTTP ${r.status}`);
  }

  const [[nl]] = await db.query('SELECT id_nl, ten_nl, so_luong, gia_von FROM nguyen_lieu WHERE so_luong > 5 ORDER BY id_nl LIMIT 1');
  const [loTruoc] = await db.query('SELECT id_ct, so_luong_con_lai FROM chi_tiet_phieu_nhap WHERE id_nl = ?', [nl.id_nl]);
  const tonTruoc = Number(nl.so_luong);
  const ton = async () => Number((await db.query('SELECT so_luong FROM nguyen_lieu WHERE id_nl = ?', [nl.id_nl]))[0][0].so_luong);

  try {
    const pnSai = await tk.goi('/api/kitchen/kho/nhap', { method: 'POST', json: { dong: [{ id_nl: nl.id_nl, so_luong: 0, don_gia: 1000 }] } });
    ok('Phiếu nhập số lượng 0 bị từ chối', pnSai.status === 400);
    // Quy trinh duyet phieu nhap (duyetNhapKhoService): thieu chung tu bi chan;
    // hang chi vao kho sau khi bep truong kiem chat luong.
    const pnKhongCt = await tk.goi('/api/kitchen/kho/nhap', { method: 'POST', json: { dong: [{ id_nl: nl.id_nl, so_luong: 1, don_gia: 1000 }] } });
    ok('Phiếu nhập thiếu số hóa đơn và lý do bị từ chối', pnKhongCt.status === 400, pnKhongCt.data && pnKhongCt.data.thong_bao);
    const pn = await tk.goi('/api/kitchen/kho/nhap', { method: 'POST', json: {
      ghi_chu: 'AUTOTEST', so_chung_tu: 'AUTOTEST-HD', dong: [{ id_nl: nl.id_nl, so_luong: 3, don_gia: Math.max(1000, Math.round(Number(nl.gia_von)) || 1000), so_lo: 'AUTOTEST', han_su_dung: ngayCong(2) }] } });
    if (pn.data && pn.data.id) DON_DEP.pn.push(pn.data.id);
    const t0 = await ton();
    ok('Thủ kho lập phiếu nhận hàng → chờ QC, tồn CHƯA tăng', pn.status === 201 && pn.data.trang_thai_duyet === 'cho_qc' && Math.abs(t0 - tonTruoc) < 1e-6, `${tonTruoc} → ${t0}`);
    const qc = await bt.goi(`/api/kitchen/kho/nhap/${pn.data && pn.data.id}/qc`, { method: 'POST', json: { dong: [] } });
    const t1 = await ton();
    ok(`Bếp trưởng QC đạt → nhập kho 3 ${nl.ten_nl}, tồn tăng đúng 3`, qc.status === 200 && Math.abs(t1 - tonTruoc - 3) < 1e-6, `${tonTruoc} → ${t1} (${pn.data && pn.data.ma_phieu})`);

    const xSai = await tk.goi('/api/kitchen/kho/xuat', { method: 'POST', json: { ly_do: 'hu_hong', dong: [{ id_nl: nl.id_nl, so_luong: 1 }] } });
    ok('Xuất hủy/hư hỏng bắt buộc ghi nguyên nhân', xSai.status === 400);
    const xVuot = await tk.goi('/api/kitchen/kho/xuat', { method: 'POST', json: { ly_do: 'dung_noi_bo', dong: [{ id_nl: nl.id_nl, so_luong: t1 + 1000 }] } });
    ok('Xuất vượt tồn kho bị chặn', xVuot.status === 400 && /tồn kho/i.test((xVuot.data && xVuot.data.thong_bao) || ''));
    const px = await tk.goi('/api/kitchen/kho/xuat', { method: 'POST', json: { ly_do: 'hu_hong', ghi_chu: 'AUTOTEST hư hỏng', dong: [{ id_nl: nl.id_nl, so_luong: 1 }] } });
    if (px.data && px.data.id) DON_DEP.px.push(px.data.id);
    const t2 = await ton();
    ok('Xuất kho 1 → tồn giảm đúng 1', px.status === 201 && Math.abs(t1 - t2 - 1) < 1e-6, `${t1} → ${t2}`);
    const [[lo]] = await db.query("SELECT so_luong_con_lai FROM chi_tiet_phieu_nhap WHERE id_pn = ?", [pn.data.id]);
    ok('FEFO: trừ lô hết hạn sớm nhất trước (lô AUTOTEST HSD +2 ngày)', lo && Number(lo.so_luong_con_lai) <= 2,
      `lô AUTOTEST còn ${lo && lo.so_luong_con_lai}`);
    if (px.data) {
      const inP = await tk.goi(`/staff/kitchen/kho/phieu/xuat/${px.data.id}`);
      ok('In phiếu xuất kho', inP.status === 200 && inP.text.includes(px.data.ma_phieu));
    }

    // Don mua hang: tao -> tu duyet bi chan -> quan ly duyet -> dat hang -> nhan hang
    const dmSai = await bt.goi('/api/kitchen/mua-hang', { method: 'POST', json: { dong: [{ id_nl: nl.id_nl, so_luong: 1 }, { id_nl: nl.id_nl, so_luong: 2 }] } });
    ok('Đơn mua lặp nguyên liệu bị từ chối', dmSai.status === 400);
    const dm = await bt.goi('/api/kitchen/mua-hang', { method: 'POST', json: { ghi_chu: 'AUTOTEST', ngay_giao_du_kien: ngayCong(2), dong: [{ id_nl: nl.id_nl, so_luong: 2, don_gia: 1000 }] } });
    ok('Bếp trưởng tạo đơn mua hàng (chờ duyệt)', dm.status === 201 && !!dm.data.ma_don, dm.data && dm.data.ma_don);
    if (dm.data && dm.data.id) {
      DON_DEP.dmh.push(dm.data.id);
      const id = dm.data.id;
      const nhanSom = await tk.goi('/api/kitchen/kho/nhap', { method: 'POST', json: { id_dmh: id, dong: [{ id_nl: nl.id_nl, so_luong: 2, don_gia: 1000 }] } });
      ok('Không nhận hàng cho đơn chưa duyệt', nhanSom.status === 400);
      const tuDuyet = await bt.goi(`/api/kitchen/mua-hang/${id}/duyet`, { method: 'POST', json: {} });
      ok('Người lập không được tự duyệt đơn mua (403)', tuDuyet.status === 403);
      const db1 = await (await dangNhapNV('daubep')).goi(`/api/kitchen/mua-hang/${id}/duyet`, { method: 'POST', json: {} });
      ok('Đầu bếp không có quyền duyệt đơn mua (403)', db1.status === 403);
      const duyet = await ql.goi(`/api/kitchen/mua-hang/${id}/duyet`, { method: 'POST', json: {} });
      ok('Quản lý duyệt đơn mua', duyet.status === 200);
      const dat = await bt.goi(`/api/kitchen/mua-hang/${id}/dat_hang`, { method: 'POST', json: {} });
      ok('Đánh dấu đã đặt hàng NCC', dat.status === 200);
      const nhan = await tk.goi('/api/kitchen/kho/nhap', { method: 'POST', json: { id_dmh: id, ghi_chu: 'AUTOTEST', so_chung_tu: 'AUTOTEST-HD2', dong: [{ id_nl: nl.id_nl, so_luong: 2, don_gia: 1000 }] } });
      if (nhan.data && nhan.data.id) DON_DEP.pn.push(nhan.data.id);
      // Don mua chi tinh "da nhan" phan hang DAT kiem tra chat luong.
      const qcDon = await bt.goi(`/api/kitchen/kho/nhap/${nhan.data && nhan.data.id}/qc`, { method: 'POST', json: { dong: [] } });
      const [[d]] = await db.query('SELECT trang_thai FROM don_mua_hang WHERE id_dmh = ?', [id]);
      ok('Nhận hàng + QC đạt → đơn mua chuyển "đã nhận"', nhan.status === 201 && qcDon.status === 200 && d.trang_thai === 'da_nhan', d.trang_thai);
      const huy = await bt.goi(`/api/kitchen/mua-hang/${id}/huy`, { method: 'POST', json: { ly_do: 'AUTOTEST' } });
      ok('Không hủy được đơn đã nhận hàng', huy.status === 400);
      const ct = await bt.goi(`/staff/kitchen/mua-hang/${id}`);
      ok('Trang chi tiết đơn mua', ct.status === 200);
    }
    const pv = await (await dangNhapNV('thungan')).goi('/staff/kitchen/kho');
    ok('RBAC: Thu ngân không vào được kho bếp', pv.status !== 200, `HTTP ${pv.status}`);
  } finally {
    // Tra ton kho & lo ve nhu cu
    await db.query('UPDATE nguyen_lieu SET so_luong = ?, gia_von = ? WHERE id_nl = ?', [tonTruoc, nl.gia_von, nl.id_nl]);
    for (const l of loTruoc) await db.query('UPDATE chi_tiet_phieu_nhap SET so_luong_con_lai = ? WHERE id_ct = ?', [l.so_luong_con_lai, l.id_ct]);
  }
}

// ====================================================================== G
async function testDoiMonDatTruoc() {
  nhom('G. Đổi món đặt trước (hạn dish_edit_cutoff_days)');
  const ch = await rules.docCauHinh();
  const han = Number(ch.dish_edit_cutoff_days);
  ok('Tham số dish_edit_cutoff_days đã có (migration 037)', Number.isFinite(han), `= ${ch.dish_edit_cutoff_days}`);

  const moc = (ms) => ({ mocBatDau: new Date(Date.now() + ms) });
  const nem = (f) => { try { f(); return null; } catch (e) { return e.ma || e.message; } };
  ok('Hàm kiểm hạn: còn 10 ngày → cho đổi', nem(() => rules.kiemTraHanSuaMon(moc(10 * 864e5), { dish_edit_cutoff_days: 1 })) === null);
  ok('Hàm kiểm hạn: còn 3 giờ → DISH_EDIT_TOO_LATE', nem(() => rules.kiemTraHanSuaMon(moc(3 * 36e5), { dish_edit_cutoff_days: 1 })) === 'DISH_EDIT_TOO_LATE');
  ok('Hàm kiểm hạn: nhân viên (boQua) luôn được đổi', nem(() => rules.kiemTraHanSuaMon(moc(36e5), { dish_edit_cutoff_days: 1 }, { boQua: true })) === null);
  ok('Hàm kiểm hạn: 0 ngày = không giới hạn', nem(() => rules.kiemTraHanSuaMon(moc(60e3), { dish_edit_cutoff_days: 0 })) === null);

  const [mon] = await db.query('SELECT id_mon, name_mon, gia_mon FROM monan WHERE tinhtrang = 1 ORDER BY id_mon LIMIT 2');
  const it = (m, sl) => ({ dish_id: m.id_mon, dish_name: m.name_mon, price: Number(m.gia_mon), quantity: sl });
  const sdt = `096${String(Date.now()).slice(-7)}`;
  const k = await taoKhach();
  const tao = async (ngay, gio) => {
    const r = await k.goi('/api/dat-ban', { method: 'POST', json: { customer_name: 'AUTOTEST Doi mon', phone: sdt,
      reservation_date: ngay, start_time: gio, guest_count: 2, items: [it(mon[0], 1)] } });
    if (r.data && r.data.id) DON_DEP.rsv.push(r.data.id);
    return r;
  };

  // Luot dat xa (12 ngay) -> con trong han
  const r1 = await tao(ngayCong(12), '14:00');
  const ma1 = r1.data && r1.data.ma;
  ok('Tạo lượt đặt kèm 1 món gọi trước', r1.status === 201 && !!ma1, ma1 || (r1.data && r1.data.thong_bao));
  if (!ma1) return;

  // Dat moi voi gia gia mao 1d / ten gia mao -> phai luu gia & ten that tu thuc don
  const gm = await k.goi('/api/dat-ban', { method: 'POST', json: { customer_name: 'AUTOTEST Doi mon', phone: sdt,
    reservation_date: ngayCong(13), start_time: '14:00', guest_count: 2,
    items: [{ ...it(mon[0], 1), price: 1, dish_name: '<b>Món giả</b>' }, { dish_id: 99999999, dish_name: 'Không tồn tại', price: 1, quantity: 1 }] } });
  if (gm.data && gm.data.id) DON_DEP.rsv.push(gm.data.id);
  const [poGm] = gm.data && gm.data.id
    ? await db.query('SELECT dish_name, price FROM reservation_preorders WHERE reservation_id = ?', [gm.data.id]) : [[]];
  ok('Đặt bàn mới: bỏ qua giá/tên giả của client, bỏ món không tồn tại', poGm.length === 1
    && Number(poGm[0].price) === Number(mon[0].gia_mon) && poGm[0].dish_name === mon[0].name_mon,
    JSON.stringify(poGm));

  const tc = await k.goi('/api/dat-ban/tra-cuu', { method: 'POST', json: { ma: ma1, dien_thoai: sdt } });
  const rr = tc.data && tc.data.r;
  ok('Tra cứu trả về mon_dat_truoc & sua_mon_duoc = true', rr && rr.sua_mon_duoc === true && rr.mon_dat_truoc.length === 1);

  const doi = await k.goi('/api/dat-ban/tra-cuu/doi-mon', { method: 'POST', json: { ma: ma1, dien_thoai: sdt, items: [it(mon[0], 2), it(mon[1], 1)] } });
  ok('Khách đổi món trong hạn (HTTP 200, ok)', doi.status === 200 && doi.data && doi.data.ok, doi.data && doi.data.thong_bao);
  const dsTraVe = doi.data && doi.data.r && doi.data.r.mon_dat_truoc;
  ok('Phản hồi đổi món trả về danh sách món mới (r.mon_dat_truoc)', Array.isArray(dsTraVe) && dsTraVe.length === 2,
    Array.isArray(dsTraVe) ? `${dsTraVe.length} món` : `r.mon_dat_truoc = ${JSON.stringify(dsTraVe)}`);
  const [[po]] = await db.query('SELECT COUNT(*) n, SUM(quantity) sl FROM reservation_preorders WHERE reservation_id = ?', [r1.data.id]);
  ok('CSDL: reservation_preorders thay thế toàn bộ danh sách cũ', Number(po.n) === 2 && Number(po.sl) === 3, `${po.n} dòng / ${po.sl} phần`);
  const [hd] = await db.query('SELECT id FROM hopdong WHERE sesis = ?', [ma1]);
  ok('Đồng bộ lại hopdong (bếp/POS) theo món mới', hd.length >= 1, `${hd.length} dòng hopdong`);
  const [[ls]] = await db.query("SELECT COUNT(*) n FROM reservation_history WHERE reservation_id = ? AND note LIKE 'Đổi món%'", [r1.data.id]);
  ok('Ghi nhật ký "Đổi món đặt trước"', Number(ls.n) === 1);

  const saiSdt = await new Phien().goi('/api/dat-ban/tra-cuu/doi-mon', { method: 'POST', json: { ma: ma1, dien_thoai: '0900000000', items: [] } });
  ok('Sai SĐT + không đăng nhập → 404, không đổi được', saiSdt.status === 404);
  const [[po2]] = await db.query('SELECT COUNT(*) n FROM reservation_preorders WHERE reservation_id = ?', [r1.data.id]);
  ok('…và danh sách món không bị xóa', Number(po2.n) === 2);

  // Gia tu client: thu gui gia 1d
  const gia = await k.goi('/api/dat-ban/tra-cuu/doi-mon', { method: 'POST', json: { ma: ma1, dien_thoai: sdt, items: [{ ...it(mon[0], 1), price: 1 }] } });
  const [[pg]] = await db.query('SELECT price FROM reservation_preorders WHERE reservation_id = ? LIMIT 1', [r1.data.id]);
  ok('Giá món lấy từ thực đơn, không tin giá client gửi lên', gia.status !== 200 || Number(pg.price) === Number(mon[0].gia_mon),
    `client gửi 1đ → lưu ${pg && pg.price}đ (giá thật ${mon[0].gia_mon}đ)`);

  // Luot dat sat gio (trong 24h) -> qua han voi khach, nhan vien van sua duoc
  let gan = new Date(Date.now() + 3 * 36e5);
  if (gan.getHours() >= 20 || gan.getHours() < 10) {
    gan = new Date(Date.now() + 24 * 36e5); gan.setHours(11, 0, 0, 0);
    if (gan.getTime() - Date.now() > 23 * 36e5) gan = new Date(gan.getTime() - 24 * 36e5);
  }
  const gioGan = `${String(gan.getHours()).padStart(2, '0')}:${gan.getMinutes() < 30 ? '00' : '30'}`;
  const ngayGan = `${gan.getFullYear()}-${String(gan.getMonth() + 1).padStart(2, '0')}-${String(gan.getDate()).padStart(2, '0')}`;
  const r2 = await tao(ngayGan, gioGan);
  if (r2.data && r2.data.ma) {
    const tc2 = await k.goi('/api/dat-ban/tra-cuu', { method: 'POST', json: { ma: r2.data.ma, dien_thoai: sdt } });
    const d2 = await k.goi('/api/dat-ban/tra-cuu/doi-mon', { method: 'POST', json: { ma: r2.data.ma, dien_thoai: sdt, items: [it(mon[1], 1)] } });
    if (han > 0) {
      ok(`Lượt đặt sát giờ (hạn ${han} ngày): tra cứu báo sua_mon_duoc = false`, tc2.data && tc2.data.r && tc2.data.r.sua_mon_duoc === false);
      ok('Khách đổi món quá hạn bị chặn DISH_EDIT_TOO_LATE', d2.status >= 400 && d2.data && d2.data.ma === 'DISH_EDIT_TOO_LATE', d2.data && d2.data.thong_bao);
    } else {
      // Quan tri dat dish_edit_cutoff_days = 0 (khong gioi han) -> khach doi mon sat gio van duoc.
      ok('Hạn = 0 (không giới hạn): lượt sát giờ vẫn sua_mon_duoc = true', tc2.data && tc2.data.r && tc2.data.r.sua_mon_duoc === true);
      ok('Hạn = 0: khách đổi món sát giờ được chấp nhận', d2.status === 200 && d2.data && d2.data.ok, d2.data && d2.data.thong_bao);
    }
    const lt = await dangNhapNV('letan');
    const nv = await lt.goi(`/api/reservations/${r2.data.id}/mon-dat-truoc`, { method: 'PUT', json: { items: [it(mon[1], 3)] } });
    ok('Nhân viên đổi món giúp khách dù đã quá hạn', nv.status === 200 && nv.data.ok, nv.data && nv.data.thong_bao);
  } else ok('Tạo lượt đặt sát giờ để kiểm hạn', false, `${ngayGan} ${gioGan}: ${r2.data && r2.data.thong_bao}`);

  const an = await new Phien().goi(`/api/reservations/${r1.data.id}/mon-dat-truoc`, { method: 'PUT', json: { items: [] } });
  ok('API nhân viên đổi món chặn khi chưa đăng nhập (401)', an.status === 401);

  // Luot da huy -> khong doi duoc
  await db.query("UPDATE reservations SET status = 'CANCELLED' WHERE id = ?", [r1.data.id]);
  const huy = await k.goi('/api/dat-ban/tra-cuu/doi-mon', { method: 'POST', json: { ma: ma1, dien_thoai: sdt, items: [it(mon[0], 1)] } });
  ok('Lượt đã hủy không đổi món được (CLOSED_RESERVATION)', huy.status >= 400 && huy.data && huy.data.ma === 'CLOSED_RESERVATION', huy.data && huy.data.thong_bao);
}

// ====================================================================== don dep
async function donDep() {
  if (DON_DEP.rsv.length) {
    const [ma] = await db.query('SELECT reservation_code FROM reservations WHERE id IN (?)', [DON_DEP.rsv]);
    const q2 = (sql, v) => db.query(sql, [v]).catch((e) => console.warn('  (dọn dẹp)', e.message));
    if (ma.length) await q2('DELETE FROM hopdong WHERE sesis IN (?)', ma.map((x) => x.reservation_code));
    // Coc dat ban dong bo sang payments theo ma dat ban - xoa kem (khong de tien coc ao).
    if (ma.length) await q2('DELETE FROM payments WHERE sesis IN (?)', ma.map((x) => x.reservation_code));
    for (const t of ['reservation_preorders', 'reservation_tables', 'reservation_history']) await q2(`DELETE FROM ${t} WHERE reservation_id IN (?)`, DON_DEP.rsv);
    await q2('DELETE FROM reservations WHERE id IN (?)', DON_DEP.rsv);
  }
  const q = (sql, ids) => (ids.length ? db.query(sql, [ids]).catch((e) => console.warn('  (dọn dẹp)', e.message)) : null);
  // Tien coc / thanh toan tiec nam trong payments (sesis = ma tiec) - xoa truoc khi xoa don.
  if (DON_DEP.tiec.length) {
    const [maTiec] = await db.query('SELECT ma_tiec FROM dat_tiec WHERE id IN (?)', [DON_DEP.tiec]).catch(() => [[]]);
    if (maTiec.length) await q('DELETE FROM payments WHERE sesis IN (?)', maTiec.map((x) => x.ma_tiec));
  }
  await q('DELETE FROM dat_tiec_thanh_toan WHERE dat_tiec_id IN (?)', DON_DEP.tiec);
  await q('DELETE FROM dat_tiec_lich_su WHERE dat_tiec_id IN (?)', DON_DEP.tiec);
  await q('DELETE FROM dat_tiec WHERE id IN (?)', DON_DEP.tiec);
  await q('DELETE FROM phieu_thu_chi WHERE id IN (?)', DON_DEP.phieu);
  await q('DELETE FROM xuat_kho WHERE id_px IN (?)', DON_DEP.px);
  await q('DELETE FROM phieu_xuat WHERE id_px IN (?)', DON_DEP.px);
  await q('DELETE FROM chi_tiet_phieu_nhap WHERE id_pn IN (?)', DON_DEP.pn);
  await q('DELETE FROM phieu_nhap WHERE id_pn IN (?)', DON_DEP.pn);
  await q('DELETE FROM chi_tiet_don_mua WHERE id_dmh IN (?)', DON_DEP.dmh);
  await q('DELETE FROM don_mua_hang WHERE id_dmh IN (?)', DON_DEP.dmh);
}

/*
 * Tai khoan test dang nhap bang 123456, nhung he thong BAT nhan vien doi mat
 * khau mac dinh (cau_hinh bao_mat.bat_doi_mk_nhan_vien) va mot so tai khoan
 * that (vd quanly) da doi mat khau rieng. Trong luc chay: tam tat luat doi mat
 * khau + tam dat 123456; KET THUC luon tra lai dung nhu cu.
 */
const TK_TEST = ['beptruong', 'daubep', 'dieuphoi', 'ketoan', 'letan', 'phucvu', 'quanly', 'shipper1', 'thukho', 'thungan'];
async function chuanBiTaiKhoan() {
  const md5 = require('md5');
  const [goc] = await db.query('SELECT id_nv, passwords FROM nhan_vien WHERE username IN (?)', [TK_TEST]);
  const [[co]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'bao_mat.bat_doi_mk_nhan_vien'");
  const [[kh]] = await db.query('SELECT COALESCE(MAX(id), 0) AS m FROM khach_hang');
  const [[tbMoc]] = await db.query('SELECT COALESCE(MAX(id_tb), 0) AS m FROM thong_bao');
  for (const g of goc) await db.query('UPDATE nhan_vien SET passwords = ? WHERE id_nv = ?', [md5('123456'), g.id_nv]);
  if (co) await db.query("UPDATE cau_hinh SET gia_tri = '0' WHERE khoa = 'bao_mat.bat_doi_mk_nhan_vien'");
  return async () => {
    await new Promise((ok) => setTimeout(ok, 3500));  // thong bao gui nen ghi xong (gom mon moi -> bep 2,5s)
    await db.query('DELETE FROM thong_bao WHERE id_tb > ?', [tbMoc.m]).catch(() => {});
    for (const g of goc) await db.query('UPDATE nhan_vien SET passwords = ? WHERE id_nv = ?', [g.passwords, g.id_nv]).catch(() => {});
    if (co) await db.query("UPDATE cau_hinh SET gia_tri = ? WHERE khoa = 'bao_mat.bat_doi_mk_nhan_vien'", [co.gia_tri]).catch(() => {});
    // Khach AUTOTEST do lan chay nay dang ky (taoKhach) + MOI don / thanh toan
    // cua ho - neu khong, don giao thu va payments lan vao doanh thu, so quy that.
    await xoaKhachAutotest(kh.m).catch((e) => console.warn('  (dọn khách test)', e.message));
  };
}

async function xoaKhachAutotest(tuId = 0) {
  const [ks] = await db.query("SELECT id FROM khach_hang WHERE id > ? AND ten LIKE 'AUTOTEST Khach%'", [tuId]);
  if (!ks.length) return 0;
  const ids = ks.map((k) => k.id);
  const [ss] = await db.query('SELECT DISTINCT sesis FROM hopdong WHERE id_user IN (?)', [ids]);
  const sesis = ss.map((s) => s.sesis);
  const q = (sql, v) => db.query(sql, [v]).catch(() => {});
  if (sesis.length) {
    const [gs] = await db.query('SELECT id_giao FROM don_giao_hang WHERE sesis IN (?)', [sesis]);
    const idGiao = gs.map((g) => g.id_giao);
    if (idGiao.length) {
      for (const t of ['nhat_ky_giao_hang', 'phan_cong_giao', 'vi_tri_shipper']) await q(`DELETE FROM ${t} WHERE id_giao IN (?)`, idGiao);
      await q('DELETE FROM don_giao_hang WHERE id_giao IN (?)', idGiao);
    }
    const [ps] = await db.query('SELECT id FROM payments WHERE sesis IN (?)', [sesis]);
    if (ps.length) await q('UPDATE giao_dich_ngan_hang SET payment_id = NULL WHERE payment_id IN (?)', ps.map((p) => p.id));
    for (const t of ['payments', 'xuat_kho', 'huy_mon']) await q(`DELETE FROM ${t} WHERE sesis IN (?)`, sesis);
    await q('DELETE FROM hopdong WHERE sesis IN (?)', sesis);
  }
  for (const t of ['loyalty_transactions', 'loyalty_points']) await q(`DELETE FROM ${t} WHERE id_kh IN (?)`, ids);
  await q('DELETE FROM khach_hang WHERE id IN (?)', ids);
  return ids.length;
}

(async () => {
  const t0 = Date.now();
  console.log('\x1b[1m🚀 KIỂM THỬ TỰ ĐỘNG CÁC TÍNH NĂNG MỚI\x1b[0m  →  ' + BASE);
  const traLai = await chuanBiTaiKhoan();
  process.on('SIGINT', () => { traLai().finally(() => process.exit(130)); });
  const nhomTest = [testGiaoHang, testQuyMoBan, testDatTiec, testThuChi, testKhoBep, testDoiMonDatTruoc];
  for (const f of nhomTest) {
    try { await f(); } catch (e) { ok(`${f.name} chạy không lỗi`, false, e.stack.split('\n').slice(0, 2).join(' ')); }
  }
  await donDep();
  await traLai();
  console.log(`\n\x1b[1m══ KẾT QUẢ: ${KQ.dat} ĐẠT · ${KQ.hong} HỎNG · ${((Date.now() - t0) / 1000).toFixed(1)}s ══\x1b[0m`);
  if (KQ.loi.length) { console.log('\x1b[31mCác kịch bản hỏng:\x1b[0m'); KQ.loi.forEach((l, i) => console.log(`  ${i + 1}. ${l}`)); }
  process.exit(KQ.hong ? 1 : 0);
})();

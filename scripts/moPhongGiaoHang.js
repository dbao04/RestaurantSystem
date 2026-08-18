/**
 * Mo phong VAN HANH giao hang theo thoi gian thuc.
 *
 * KHONG PHAI MOT SCRIPT SINH DU LIEU
 * ----------------------------------
 * Cach nhanh nhat de co du lieu trong la INSERT thang vao `don_giao_hang` va
 * `vi_tri_shipper`. Script nay CO Y khong lam the. Moi buoc deu di qua dung
 * duong ma nguoi that di:
 *
 *   khach dat don   →  POST /login, /add-to-cart, /datban  (hinh thuc Giao hang)
 *   dieu phoi phan  →  POST /staff/giao-hang/:id/phan
 *   shipper bat ca  →  POST /api/shipper/ca
 *   shipper chay    →  POST /api/shipper/vi-tri            (moi vai giay)
 *   shipper doi tt  →  POST /api/shipper/don/:id/trang-thai
 *
 * Nho vay MOI thu deu that: cuoc phi do may chu tinh lai tu toa do, trang thai
 * di qua bang `CHUYEN_DUOC`, nhat ky duoc ghi kem toa do luc bam nut, va quan
 * trong nhat - `realtime.viTriShipper()` phat that, nen ban do dieu phoi va
 * trang theo doi cua khach dong ngay truoc mat.
 *
 * INSERT thang thi ban co du lieu dep trong CSDL va mot ban do dung im.
 *
 * DUONG DI DUOC NOI SUY, KHONG PHAI DUONG THAT
 * --------------------------------------------
 * Xe di theo duong thang tu nha hang toi diem giao, cong mot chut nhieu ngau
 * nhien cho khoi thang tap. Ve dung duong pho can mot dich vu chi duong ngoai -
 * xem ghi chu "Cuoc phi" trong HUONG_DAN_GIAO_HANG.md. Voi muc dich xem he
 * thong co chay khong thi duong thang la du: cai dang kiem tra la dong du lieu,
 * khong phai hinh dang tuyen duong.
 *
 * Chay:  node scripts/moPhongGiaoHang.js
 *        node scripts/moPhongGiaoHang.js --don=5 --nhip=3 --phut=6
 */
const db = require('../config/db');
const vc = require('../services/vanChuyenService');

// ---------------------------------------------------------------------------
// Tham so dong lenh
// ---------------------------------------------------------------------------
function thamSoLenh() {
  const t = { don: 3, nhip: 4, phut: 5, goc: process.env.MO_PHONG_GOC || 'http://127.0.0.1:3000' };
  for (const a of process.argv.slice(2)) {
    const m = /^--([a-z]+)=(.+)$/.exec(a);
    if (!m) continue;
    if (m[1] === 'goc') t.goc = m[2];
    else if (t[m[1]] !== undefined) t[m[1]] = Number(m[2]) || t[m[1]];
  }
  t.don = Math.max(1, Math.min(8, t.don));
  t.nhip = Math.max(2, Math.min(30, t.nhip));
  t.phut = Math.max(1, Math.min(60, t.phut));
  return t;
}
const TS = thamSoLenh();

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Mot phien HTTP co giu cookie
// ---------------------------------------------------------------------------
/**
 * `fetch` cua Node khong tu giu cookie, ma toan bo he thong nay xac thuc bang
 * cookie phien. Mot lop boc mong la du: nho `set-cookie` roi gan lai o lan sau.
 *
 * `redirect: 'manual'` de doc duoc ma 302 - dang nhap thanh cong hay that bai
 * deu tra ve 302, chi khac o dia chi chuyen toi, nen phai nhin duoc header.
 */
class Phien {
  constructor(goc, ten) { this.goc = goc; this.ten = ten; this.cookie = ''; }

  async goi(duongDan, { method = 'GET', form = null, json = null } = {}) {
    const dau = {};
    if (this.cookie) dau.cookie = this.cookie;
    let than;
    if (form) { dau['content-type'] = 'application/x-www-form-urlencoded'; than = new URLSearchParams(form).toString(); }
    if (json) { dau['content-type'] = 'application/json'; than = JSON.stringify(json); }

    const r = await fetch(this.goc + duongDan, { method, headers: dau, body: than, redirect: 'manual' });
    const moi = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (moi.length) this.cookie = moi.map((c) => c.split(';')[0]).join('; ');
    return r;
  }

  async json(duongDan, tuyChon) {
    const r = await this.goi(duongDan, tuyChon);
    const chu = await r.text();
    try { return { ma: r.status, dl: JSON.parse(chu) }; }
    catch { return { ma: r.status, dl: null, tho: chu.slice(0, 200) }; }
  }
}

// ---------------------------------------------------------------------------
// Toa do
// ---------------------------------------------------------------------------
/**
 * Mot diem cach `goc` dung `km` theo huong `gocDo`.
 *
 * Mot do vi do luon la ~111.32 km; mot do kinh do thi HEP DAN khi ve gan cuc,
 * nen phai chia cho cos(vi do). Bo phep chia do thi o vi do 10.8 (TP.HCM) moi
 * diem se lech ve phia dong khoang 2%, du de mot don "trong ban kinh 5km" bi
 * tinh thanh 5.1km va bi tu choi.
 */
function diemCach(goc, km, gocDo) {
  const rad = (gocDo * Math.PI) / 180;
  const dVi = (km * Math.cos(rad)) / 111.32;
  const dKinh = (km * Math.sin(rad)) / (111.32 * Math.cos((goc.vi_do * Math.PI) / 180));
  return { vi_do: goc.vi_do + dVi, kinh_do: goc.kinh_do + dKinh };
}

/** Diem tren duong thang tu A toi B, `t` chay tu 0 den 1, kem mot chut nhieu. */
function noiSuy(a, b, t, nhieu = 0.00012) {
  const r = () => (Math.random() - 0.5) * 2 * nhieu;
  return {
    vi_do: a.vi_do + (b.vi_do - a.vi_do) * t + (t > 0 && t < 1 ? r() : 0),
    kinh_do: a.kinh_do + (b.kinh_do - a.kinh_do) * t + (t > 0 && t < 1 ? r() : 0),
  };
}

// ---------------------------------------------------------------------------
// Cac dia chi giao - trai deu quanh nha hang, deu trong ban kinh
// ---------------------------------------------------------------------------
const DIA_CHI = [
  { km: 1.2, goc: 35,  chu: '145 Nguyễn Văn Bảo, P.4, Gò Vấp' },
  { km: 2.1, goc: 150, chu: '27B Lê Đức Thọ, P.7, Gò Vấp' },
  { km: 2.8, goc: 250, chu: '312 Phan Văn Trị, P.11, Bình Thạnh' },
  { km: 1.7, goc: 310, chu: '58 Quang Trung, P.10, Gò Vấp' },
  { km: 3.4, goc: 80,  chu: '90 Nguyễn Thái Sơn, P.3, Gò Vấp' },
  { km: 2.4, goc: 200, chu: '15 Nguyên Hồng, P.1, Bình Thạnh' },
  { km: 3.9, goc: 120, chu: '221 Nguyễn Oanh, P.17, Gò Vấp' },
  { km: 1.0, goc: 20,  chu: '6 Lê Lai, P.12, Gò Vấp' },
];

const GHI_CHU = [
  'Gọi trước khi tới, nhà cổng xanh',
  'Gửi bảo vệ tầng trệt giúp em',
  'Bấm chuông căn 302',
  '', '',
];

// ---------------------------------------------------------------------------
// Buoc 1 - khach dat don qua dung luong web
// ---------------------------------------------------------------------------
async function datDonQuaWeb(khach, mon, nhaHang, i) {
  const p = new Phien(TS.goc, khach.ten);
  const dn = await p.goi('/login', { method: 'POST', form: { sdt: khach.sodienthoai, pass: '123456' } });
  if (dn.status !== 302 || String(dn.headers.get('location') || '').includes('login')) {
    throw new Error(`khách ${khach.sodienthoai} đăng nhập không được`);
  }

  // Moi don mot hai mon, lay xoay vong cho khoi don nao cung giong don nao.
  const soMon = 1 + (i % 2);
  for (let k = 0; k < soMon; k++) {
    const m = mon[(i * 2 + k) % mon.length];
    await p.goi('/add-to-cart', { method: 'POST', form: { monid: m.id_mon, soluong: 1 + (k % 2) } });
  }

  const dc = DIA_CHI[i % DIA_CHI.length];
  const diem = diemCach(nhaHang, dc.km, dc.goc);
  const nay = new Date();
  const gio = new Date(nay.getTime() + 45 * 60000);

  const r = await p.goi('/datban', {
    method: 'POST',
    form: {
      hinh_thuc: 'giao_hang',
      datebook: `${nay.getFullYear()}-${String(nay.getMonth() + 1).padStart(2, '0')}-${String(nay.getDate()).padStart(2, '0')}`,
      timebook: `${String(gio.getHours()).padStart(2, '0')}:${String(gio.getMinutes()).padStart(2, '0')}`,
      dia_chi_giao: dc.chu,
      ten_nguoi_nhan: String(khach.ten).trim(),
      sdt_nguoi_nhan: khach.sodienthoai,
      ghi_chu_giao: GHI_CHU[i % GHI_CHU.length],
      vi_do: diem.vi_do,
      kinh_do: diem.kinh_do,
      hoten: String(khach.ten).trim(),
      sdt: khach.sodienthoai,
    },
  });

  const toi = String(r.headers.get('location') || '');
  const m = /\/theo-doi\/([A-Z0-9-]+)/.exec(toi);
  if (!m) {
    // /datban tra ve HTML kem alert() khi tu choi - doc ra de bao dung ly do.
    const chu = await r.text();
    const alert = /alert\((?:"|')(.+?)(?:"|')\)/.exec(chu);
    throw new Error(alert ? alert[1] : `không tạo được đơn (HTTP ${r.status})`);
  }
  return { ma_giao: m[1], dia_chi: dc.chu, diem };
}

// ---------------------------------------------------------------------------
// Buoc 2 - dieu phoi phan don
// ---------------------------------------------------------------------------
async function phienQuanTri() {
  const p = new Phien(TS.goc, 'quản trị');
  const r = await p.goi('/admin/login', { method: 'POST', form: { adminuser: 'admin', adminpass: '123456' } });
  if (r.status !== 302 || String(r.headers.get('location') || '').includes('login')) {
    throw new Error('đăng nhập quản trị không được (admin/123456)');
  }
  return p;
}

// ---------------------------------------------------------------------------
// Buoc 3 - shipper
// ---------------------------------------------------------------------------
async function phienShipper(username) {
  const p = new Phien(TS.goc, username);
  const r = await p.goi('/staff/login', { method: 'POST', form: { username, password: '123456' } });
  if (r.status !== 302 || String(r.headers.get('location') || '').includes('login')) {
    throw new Error(`shipper ${username} đăng nhập không được`);
  }
  const ca = await p.json('/api/shipper/ca', { method: 'POST', json: { trang_thai: 'san_sang' } });
  if (ca.ma !== 200) throw new Error(`${username} bật ca không được: ${(ca.dl || {}).thong_bao || ca.ma}`);
  return p;
}

/**
 * Mot chuyen giao: bam trang thai va gui GPS doc duong.
 *
 * Toa do gui kem MOI lan doi trang thai, khong chi khi chay: do la bang chung
 * duy nhat khi khach khieu nai "shipper bao da giao ma toi khong nhan duoc".
 */
async function chayChuyen(p, don, nhaHang, ghi) {
  const dich = { vi_do: Number(don.vi_do), kinh_do: Number(don.kinh_do) };
  const soBuoc = Math.max(6, Math.round((TS.phut * 60) / TS.nhip));

  const guiViTri = async (diem, tocDo) => {
    await p.json('/api/shipper/vi-tri', {
      method: 'POST',
      json: {
        vi_do: diem.vi_do, kinh_do: diem.kinh_do,
        do_chinh_xac_m: 8 + Math.random() * 12,
        toc_do_kmh: tocDo,
        pin: 60 + Math.round(Math.random() * 35),
      },
    });
  };

  const doiTrangThai = async (tt, diem) => {
    const r = await p.json(`/api/shipper/don/${don.id_giao}/trang-thai`, {
      method: 'POST',
      json: { trang_thai: tt, vi_do: diem.vi_do, kinh_do: diem.kinh_do },
    });
    if (r.ma !== 200) throw new Error(`${don.ma_giao} → ${tt}: ${(r.dl || {}).thong_bao || r.ma}`);
    ghi(`${don.ma_giao}  ${(r.dl.nhan || tt)}`);
  };

  // Dang o nha hang, cho bep dong goi.
  await guiViTri(nhaHang, 0);
  await doiTrangThai('dang_lay', nhaHang);
  await nghi(TS.nhip * 1000);

  await doiTrangThai('dang_giao', nhaHang);

  for (let b = 1; b <= soBuoc; b++) {
    const t = b / soBuoc;
    const diem = noiSuy(nhaHang, dich, t);
    // Cham dan o doan cuoi - dang tim so nha.
    await guiViTri(diem, t > 0.88 ? 8 + Math.random() * 6 : 22 + Math.random() * 14);
    if (b % 4 === 0 || b === soBuoc) {
      ghi(`${don.ma_giao}  đang giao · ${Math.round(t * 100)}% quãng đường`);
    }
    await nghi(TS.nhip * 1000);
  }

  await doiTrangThai('da_giao', dich);
}

// ---------------------------------------------------------------------------
// Dieu phoi ca cuoc mo phong
// ---------------------------------------------------------------------------
function batDau(chu) { console.log(`\n${chu}\n${'─'.repeat(64)}`); }
function moc(chu) {
  const g = new Date().toLocaleTimeString('vi-VN');
  console.log(`  ${g}  ${chu}`);
}

async function main() {
  console.log('╔' + '═'.repeat(62) + '╗');
  console.log('║  MÔ PHỎNG VẬN HÀNH GIAO HÀNG THEO THỜI GIAN THỰC' + ' '.repeat(14) + '║');
  console.log('╚' + '═'.repeat(62) + '╝');
  console.log(`  Máy chủ: ${TS.goc}`);
  console.log(`  ${TS.don} đơn · GPS mỗi ${TS.nhip} giây · mỗi chuyến ~${TS.phut} phút`);

  // --- Tien quyet ---
  batDau('0. Kiểm tra trước khi chạy');

  let thu;
  try { thu = await fetch(TS.goc + '/theo-doi', { redirect: 'manual' }); }
  catch { throw new Error(`Không gọi được ${TS.goc} — máy chủ chưa chạy? (npm start)`); }
  if (thu.status !== 200) throw new Error(`${TS.goc}/theo-doi trả về ${thu.status} — máy chủ chưa nạp mã mới, hãy khởi động lại.`);
  moc('máy chủ đang chạy và đã có phân hệ giao hàng');

  const nhaHang = await vc.toaDoNhaHang();
  if (!nhaHang) throw new Error('Chưa khai tọa độ nhà hàng — vào /to-chuc/cham-cong → Cấu hình vị trí.');
  moc(`tọa độ nhà hàng ${nhaHang.vi_do}, ${nhaHang.kinh_do}`);

  const [dsSp] = await db.query(
    `SELECT s.id_shipper, s.ten, s.bien_so, n.username
     FROM shipper s JOIN nhan_vien n ON n.id_nv = s.id_nv
     WHERE n.username IS NOT NULL AND n.trangthai = 1 ORDER BY s.id_shipper`
  );
  if (!dsSp.length) throw new Error('Chưa có shipper nào gắn với nhân viên. Chạy: node scripts/taoNhanSuGiaoHang.js');
  moc(`${dsSp.length} shipper có tài khoản đăng nhập`);

  const [mon] = await db.query(
    'SELECT id_mon, name_mon FROM monan WHERE tinhtrang = 1 ORDER BY id_mon LIMIT 12'
  );
  if (!mon.length) throw new Error('Không có món nào đang phục vụ để đặt.');

  // Khach vang lai cua ma QR khong dang nhap duoc (mat khau vo hieu hoa) - loai ra.
  const [khach] = await db.query(
    `SELECT id, ten, sodienthoai FROM khach_hang
     WHERE sodienthoai NOT LIKE 'QR_%' AND passwords = MD5('123456') LIMIT 8`
  );
  if (!khach.length) {
    throw new Error("Không có khách hàng nào dùng mật khẩu '123456' để mô phỏng đặt đơn.");
  }
  moc(`${khach.length} tài khoản khách dùng được`);

  // --- 1. Khach dat don ---
  batDau('1. Khách đặt đơn trên website (chọn "Giao tận nơi")');
  const daDat = [];
  for (let i = 0; i < TS.don; i++) {
    const k = khach[i % khach.length];
    try {
      const d = await datDonQuaWeb(k, mon, nhaHang, i);
      daDat.push(d);
      moc(`${d.ma_giao}  ${String(k.ten).trim()} → ${d.dia_chi}`);
    } catch (e) {
      moc(`[bỏ qua] ${String(k.ten).trim()}: ${e.message}`);
    }
  }
  if (!daDat.length) throw new Error('Không đặt được đơn nào.');

  // --- 2. Dieu phoi phan don ---
  batDau('2. Điều phối phân đơn cho shipper');
  const qt = await phienQuanTri();
  const { dl: bd } = await qt.json('/api/giao-hang/ban-do');
  const choPhan = (bd.don || []).filter((g) => g.trang_thai === 'cho_phan');

  // Bat ca TRUOC khi phan: may chu tu choi phan don cho nguoi ngoai ca - dung
  // rang buoc that, khong duoc di duong vong.
  const phienSp = new Map();
  for (const s of dsSp) {
    try {
      phienSp.set(s.id_shipper, await phienShipper(s.username));
      moc(`${s.ten} (${s.username}) đã vào ca`);
    } catch (e) { moc(`[bỏ qua] ${e.message}`); }
  }
  if (!phienSp.size) throw new Error('Không shipper nào vào ca được.');

  const idSp = [...phienSp.keys()];
  const chuyen = [];
  for (let i = 0; i < choPhan.length; i++) {
    const g = choPhan[i];
    const s = dsSp.find((x) => x.id_shipper === idSp[i % idSp.length]);
    const r = await qt.goi(`/staff/giao-hang/${g.id_giao}/phan`, {
      method: 'POST', form: { id_shipper: s.id_shipper },
    });
    if (r.status === 302) {
      moc(`${g.ma_giao}  →  ${s.ten} (${s.bien_so})`);
      chuyen.push({ don: g, shipper: s });
    } else {
      moc(`[lỗi] không phân được ${g.ma_giao} (HTTP ${r.status})`);
    }
  }
  if (!chuyen.length) throw new Error('Không phân được đơn nào.');

  // --- 3. Chay that ---
  batDau('3. Shipper lên đường — mở bản đồ để xem trực tiếp');
  console.log(`     ${TS.goc}/staff/giao-hang/ban-do`);
  daDat.forEach((d) => console.log(`     ${TS.goc}/theo-doi/${d.ma_giao}   (trang của khách)`));
  console.log('');

  /*
    Cac chuyen chay SONG SONG, khong noi duoi nhau.
    Ba xe cung dich chuyen mot luc moi giong vao gio cao diem that, va do moi la
    thu can nhin: ban do co ve duoc nhieu cham cung luc khong, danh sach ben
    phai co cap nhat kip khong.
  */
  const ketQua = await Promise.allSettled(
    chuyen.map(({ don, shipper }) =>
      chayChuyen(phienSp.get(shipper.id_shipper), don, nhaHang, moc))
  );

  const hong = ketQua.filter((r) => r.status === 'rejected');
  hong.forEach((r) => moc(`[lỗi] ${r.reason.message}`));

  // --- 4. Tong ket ---
  batDau('4. Kết quả');
  const tk = await vc.thongKe();
  console.log(`  Đơn hôm nay        : ${tk.tong}`);
  console.log(`  Đã giao xong       : ${tk.da_giao}`);
  console.log(`  Còn đang chạy      : ${tk.dang_chay}`);
  console.log(`  Phí giao thu được  : ${tk.tien_phi.toLocaleString('vi-VN')} đ`);
  if (tk.phut_tb !== null) console.log(`  Trung bình mỗi đơn : ${tk.phut_tb} phút`);

  const [[vet]] = await db.query('SELECT COUNT(*) AS n FROM vi_tri_shipper');
  console.log(`  Điểm GPS đã ghi    : ${vet.n}`);

  console.log('\n  Xem lại lộ trình thật của từng đơn ở /staff/giao-hang (bấm "Chi tiết").');
  console.log('  Shipper vẫn đang trong ca — vào /staff/giao-hang để phân tiếp đơn mới.\n');

  await db.end();
  process.exit(hong.length ? 1 : 0);
}

main().catch((e) => {
  console.error('\nLỗi: ' + e.message + '\n');
  process.exit(1);
});

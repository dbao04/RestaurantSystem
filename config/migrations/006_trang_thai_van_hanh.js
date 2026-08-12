/**
 * Migration 006 - Dung trang thai van hanh hien tai de demo KDS + so do ban.
 *
 * Toan bo don mo phong deu da "thanh toan xong" nen man hinh bep se trong tron.
 * Script nay tao ra mot lat cat van hanh CUA HOM NAY: vai ban dang phuc vu, mot
 * so mon dang cho bep, mot so dang che bien, mot so cho mang ra.
 *
 * Chay lai duoc nhieu lan - moi lan se dung lai lat cat moi cho ngay hom nay.
 */
const db = require('../db');

function taoRng(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = taoRng(551122);
const chon = (a) => a[Math.floor(rand() * a.length)];
const randInt = (lo, hi) => Math.floor(rand() * (hi - lo + 1)) + lo;

/**
 * Dinh dang DATETIME theo gio DIA PHUONG.
 *
 * Khong dung toISOString() vi ham do doi sang UTC: may chay o UTC+7 se ghi moc
 * bep som hon 7 tieng so voi `gio_dat`, khien man hinh bep bao "cho 424 phut".
 */
function dinhDangCucBo(d) {
  if (!d) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Ty le ban theo trang thai, tinh tren TONG SO BAN dang co.
 *
 * Truoc day day la so tuyet doi (4 / 2 / 1) hop voi nha hang 9 ban. Tu khi
 * migration 011 nang len 40 ban thi so co dinh do chi lap day 17% - so do nhin
 * nhu vua khai truong. Dung ty le de lat cat luon dung voi quy mo hien tai:
 * khoang nua so ban co khach vao gio cao diem.
 */
const TEN_TRANG_THAI = { 0: 'Trống', 1: 'Đang phục vụ', 2: 'Đã đặt trước', 3: 'Đang dọn' };

const TY_LE_BAN = [
  // [trang thai, ty le tren tong so ban]
  [1, 0.30], // dang phuc vu
  [2, 0.15], // da dat truoc
  [3, 0.07], // dang don
];

/**
 * Chia so ban theo ty le, moi trang thai it nhat 1 ban.
 * Tra ve dang [[trang_thai, so_ban], ...] nhu bien KICH_BAN_BAN cu.
 */
function kichBanBan(tongBan) {
  return TY_LE_BAN.map(([tt, ty]) => [tt, Math.max(1, Math.round(tongBan * ty))]);
}

/**
 * Tron xen ke cac khu de ban ban ron trai deu ca 4 khu.
 *
 * `KICH_BAN_BAN` lay N ban dau danh sach; neu danh sach xep theo `Id_ban` thi
 * toan bo ban dang phuc vu se don ve mot khu (cac ban cu deu thuoc Sanh chinh
 * va Phong VIP), con San vuon / Tang 2 luon trong tron.
 */
function xenKeTheoKhu(bans) {
  const theoKhu = new Map();
  for (const b of bans) {
    const k = b.id_vitri;
    if (!theoKhu.has(k)) theoKhu.set(k, []);
    theoKhu.get(k).push(b);
  }
  const nhom = [...theoKhu.values()];
  const kq = [];
  for (let i = 0; kq.length < bans.length; i++) {
    for (const n of nhom) if (i < n.length) kq.push(n[i]);
  }
  return kq;
}

async function main() {
  console.log('=== Migration 006: trang thai van hanh ===');

  // --- Don sach lat cat cu ---
  console.log('\n[1/3] Don lat cat cu');
  const [xoa] = await db.query(
    "DELETE FROM hopdong WHERE sesis LIKE 'LIVE%'"
  );
  console.log(`  ~ xoa ${xoa.affectedRows} dong don demo cu`);
  await db.query('UPDATE ban SET trangthai = 0, sesis_hien_tai = NULL');

  // --- Nap danh muc ---
  const [mons] = await db.query(
    'SELECT id_mon, name_mon, gia_mon, images FROM monan WHERE tinhtrang = 1'
  );
  const [bans] = await db.query('SELECT Id_ban, number_ban, id_vitri FROM ban ORDER BY Id_ban');
  const [khachs] = await db.query('SELECT id, ten FROM khach_hang WHERE sodienthoai NOT LIKE "QR_%"');
  const [nvs] = await db.query("SELECT id_nv FROM nhan_vien WHERE trangthai = 1");

  if (!mons.length || !bans.length) {
    console.log('Thieu du lieu mon an hoac ban, dung lai.');
    await db.end();
    return;
  }

  // --- Tao cac phien dang phuc vu ---
  console.log('\n[2/3] Tao phien dang phuc vu');
  const dsBan = xenKeTheoKhu(bans);
  const kichBan = kichBanBan(bans.length);
  let idx = 0;
  let tongMon = 0;
  console.log(`  (${bans.length} bàn: ` +
    kichBan.map(([tt, n]) => `${n} ${TEN_TRANG_THAI[tt]}`).join(', ') + ')');

  for (const [trangThai, soBan] of kichBan) {
    for (let i = 0; i < soBan && idx < dsBan.length; i++, idx++) {
      const ban = dsBan[idx];

      if (trangThai !== 1) {
        // Ban dat truoc / dang don thi chua co mon.
        await db.query('UPDATE ban SET trangthai = ? WHERE Id_ban = ?', [trangThai, ban.Id_ban]);
        continue;
      }

      const sesis = `LIVE${String(ban.Id_ban).padStart(2, '0')}${Date.now().toString(36).slice(-4)}`;
      const khach = khachs.length ? chon(khachs) : null;
      const nv = nvs.length ? chon(nvs).id_nv : null;
      const soKhach = randInt(2, 6);

      // Gio order rai deu trong 5-50 phut vua qua de cot "cho bao lau" co y nghia.
      const phutTruoc = randInt(5, 50);
      const luc = new Date(Date.now() - phutTruoc * 60000);
      const gio = luc.toTimeString().slice(0, 5);

      const soMon = randInt(3, 6);
      const daChon = new Set();
      for (let k = 0; k < soMon; k++) {
        const mon = chon(mons);
        if (daChon.has(mon.id_mon)) continue;
        daChon.add(mon.id_mon);

        // Phan bo trang thai bep: mot so cho, mot so dang lam, mot so xong.
        const r = rand();
        let ttBep = 0;
        if (r > 0.72) ttBep = 2;
        else if (r > 0.38) ttBep = 1;

        const sl = randInt(1, 3);
        const bepBatDau = ttBep >= 1
          ? new Date(luc.getTime() + randInt(1, 4) * 60000)
          : null;
        const bepKetThuc = ttBep === 2
          ? new Date(bepBatDau.getTime() + randInt(6, 22) * 60000)
          : null;
        const fmt = dinhDangCucBo;

        await db.query(
          `INSERT INTO hopdong
             (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user,
              gia, thanhtien, images, tinhtrang, trangthai_bep, ngay_dat, gio_dat,
              loai_don, id_ban, id_nv_phuc_vu, bep_bat_dau, bep_ket_thuc)
           VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, 1, ?, CURDATE(), ?, 'tai_cho', ?, ?, ?, ?)`,
          [
            sesis, mon.id_mon, mon.name_mon, khach ? khach.id : 0,
            gio, sl, 'Ăn thường', String(soKhach),
            mon.gia_mon, mon.gia_mon * sl, mon.images || '',
            ttBep, `${gio}:00`, ban.Id_ban, nv,
            fmt(bepBatDau), fmt(bepKetThuc),
          ]
        );
        tongMon++;
      }

      await db.query(
        'UPDATE ban SET trangthai = 1, sesis_hien_tai = ? WHERE Id_ban = ?',
        [sesis, ban.Id_ban]
      );
      console.log(`  + Bàn ${ban.number_ban}: ${daChon.size} món, order ${phutTruoc} phút trước`);
    }
  }

  // --- Tom tat ---
  console.log('\n[3/3] Kiem tra');
  const [bep] = await db.query(
    `SELECT trangthai_bep, COUNT(*) AS n FROM hopdong
     WHERE tinhtrang = 1 AND id_mon > 0 AND ngay_dat = CURDATE()
     GROUP BY trangthai_bep ORDER BY trangthai_bep`
  );
  const ten = { 0: 'Chờ chế biến', 1: 'Đang chế biến', 2: 'Hoàn thành', 3: 'Đã phục vụ' };
  console.table(bep.map((r) => ({ trang_thai: ten[r.trangthai_bep], so_mon: r.n })));

  const [ban] = await db.query('SELECT trangthai, COUNT(*) AS n FROM ban GROUP BY trangthai');
  console.table(ban.map((r) => ({ trang_thai_ban: TEN_TRANG_THAI[r.trangthai], so_ban: r.n })));

  console.log(`\nTong ${tongMon} mon dang hoat dong.`);
  console.log('=== Hoan tat migration 006 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});

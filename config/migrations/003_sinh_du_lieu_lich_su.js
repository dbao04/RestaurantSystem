/**
 * Migration 003 - Sinh du lieu lich su mo phong (~12 thang).
 *
 * Vi sao can: DB that chi co 16 don hang. Apriori va cac mo hinh du bao chuoi
 * thoi gian khong the hoc duoc gi tu 16 quan sat. Script nay sinh du lieu theo
 * cac quy luat co that cua nganh F&B de mo hinh co cai de hoc VA de ta co
 * "ground truth" doi chieu khi danh gia mo hinh:
 *
 *   - Hieu ung thu trong tuan (cuoi tuan dong khach hon ~50%)
 *   - Hieu ung mua vu theo thang
 *   - Ngay le / Tet
 *   - Khung gio cao diem (trua 11-13h, toi 18-21h)
 *   - Nhom mon di kem nhau (de Apriori tim ra luat co y nghia)
 *
 * Toan bo don sinh ra deu co co `la_du_lieu_mo_phong = 1` nen co the xoa sach
 * bat cu luc nao ma khong dung den 16 don that.
 *
 * Dung PRNG co seed => chay lai cho ra dung bo du lieu cu (quan trong khi viet
 * bao cao: so lieu trong luan van phai tai lap duoc).
 */
const db = require('../db');

const NGAY_BAT_DAU = '2025-08-01';
const NGAY_KET_THUC = '2026-08-03';
const SEED = 20260804;

// --------------------------------------------------------------------------
// PRNG co seed (mulberry32)
// --------------------------------------------------------------------------
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
const rng = taoRng(SEED);

const rand = () => rng();
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chon = (arr) => arr[Math.floor(rand() * arr.length)];
/** Nhieu phan phoi chuan (Box-Muller) de so lieu khong bi "phang". */
function nhieuChuan(mean = 0, sd = 1) {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --------------------------------------------------------------------------
// Cac he so mo phong
// --------------------------------------------------------------------------
// CN=0, T2=1 ... T7=6
const HE_SO_THU = [1.42, 0.84, 0.80, 0.86, 0.95, 1.26, 1.58];

// Thang 1..12 - mua le hoi cuoi nam va he dong khach hon.
const HE_SO_THANG = {
  1: 1.18, 2: 1.10, 3: 0.94, 4: 1.02, 5: 1.06, 6: 1.12,
  7: 1.15, 8: 1.08, 9: 0.96, 10: 0.98, 11: 1.04, 12: 1.25,
};

/** Ngay le duong lich trong khoang mo phong -> he so nhan. */
const NGAY_LE = {
  '2025-09-02': 1.7,  // Quoc khanh
  '2025-10-20': 1.5,  // Phu nu Viet Nam
  '2025-11-20': 1.45, // Nha giao Viet Nam
  '2025-12-24': 1.9,  // Giang sinh
  '2025-12-25': 1.8,
  '2025-12-31': 2.0,  // Tat nien
  '2026-01-01': 1.6,
  '2026-02-14': 1.95, // Valentine
  '2026-02-16': 2.1,  // Tat nien am lich
  '2026-02-17': 0.25, // Mung 1 Tet - quan gan nhu dong cua
  '2026-02-18': 0.35, // Mung 2
  '2026-02-19': 0.7,  // Mung 3
  '2026-02-20': 1.15,
  '2026-02-21': 1.35,
  '2026-03-08': 1.85, // Quoc te phu nu
  '2026-04-26': 1.4,  // Gio to Hung Vuong
  '2026-04-30': 1.75, // Giai phong mien Nam
  '2026-05-01': 1.7,  // Quoc te lao dong
  '2026-06-01': 1.5,  // Quoc te thieu nhi
};

/**
 * Phan bo khach theo khung gio (trong so). Nha hang mo 10h-22h.
 * Hai dinh: trua va toi - dung voi thuc te nha hang Viet.
 */
const PHAN_BO_GIO = [
  [10, 3], [11, 12], [12, 16], [13, 9], [14, 4], [15, 3],
  [16, 4], [17, 7], [18, 15], [19, 18], [20, 14], [21, 7],
];

// --------------------------------------------------------------------------
// Kich ban bua an - quyet dinh chat luong luat ket hop tim duoc
// --------------------------------------------------------------------------
/**
 * Moi kich ban mo ta mot kieu khach. `nhom` liet ke cac nhom mon se duoc rut,
 * kem xac suat xuat hien va so luong mon rut ra. Chinh cau truc nay tao ra
 * quan he dong xuat hien giua cac mon -> Apriori se hoc duoc.
 */
const KICH_BAN = [
  {
    ten: 'gia_dinh',
    trong_so: 24,
    so_khach: [4, 8],
    loai_don: 'tai_cho',
    nhom: [
      { pool: 'sashimi', p: 0.85, sl: [1, 2] },
      { pool: 'sushi', p: 0.95, sl: [2, 4] },
      { pool: 'nuong', p: 0.8, sl: [1, 2] },
      { pool: 'com', p: 0.6, sl: [1, 2] },
      { pool: 'khai_vi', p: 0.7, sl: [1, 2] },
      { pool: 'nuoc_ngot', p: 0.85, sl: [2, 4] },
    ],
  },
  {
    ten: 'nhau',
    trong_so: 18,
    so_khach: [3, 6],
    loai_don: 'tai_cho',
    nhom: [
      { pool: 'sashimi', p: 0.95, sl: [1, 3] },
      { pool: 'nuong', p: 0.9, sl: [2, 3] },
      { pool: 'khai_vi', p: 0.8, sl: [1, 2] },
      { pool: 'bia', p: 0.95, sl: [3, 8] },
    ],
  },
  {
    ten: 'trua_van_phong',
    trong_so: 22,
    so_khach: [1, 3],
    loai_don: 'tai_cho',
    gio_uu_tien: [11, 12, 13],
    nhom: [
      { pool: 'com', p: 0.7, sl: [1, 2] },
      { pool: 'mi', p: 0.55, sl: [1, 1] },
      { pool: 'sup', p: 0.45, sl: [1, 1] },
      { pool: 'nuoc_re', p: 0.9, sl: [1, 2] },
    ],
  },
  {
    ten: 'cap_doi',
    trong_so: 13,
    so_khach: [2, 2],
    loai_don: 'tai_cho',
    gio_uu_tien: [18, 19, 20],
    nhom: [
      { pool: 'sashimi', p: 0.8, sl: [1, 2] },
      { pool: 'sushi', p: 0.9, sl: [1, 3] },
      { pool: 'trang_mieng', p: 0.75, sl: [1, 2] },
      { pool: 'nuoc_ngot', p: 0.8, sl: [2, 2] },
    ],
  },
  {
    ten: 'lau_nhom',
    trong_so: 8,
    so_khach: [4, 8],
    loai_don: 'tai_cho',
    gio_uu_tien: [18, 19, 20],
    nhom: [
      { pool: 'lau', p: 1.0, sl: [1, 2] },
      { pool: 'khai_vi', p: 0.7, sl: [1, 2] },
      { pool: 'bia', p: 0.75, sl: [2, 6] },
      { pool: 'com', p: 0.4, sl: [1, 1] },
    ],
  },
  {
    ten: 'mang_ve',
    trong_so: 9,
    so_khach: [1, 2],
    loai_don: 'mang_ve',
    nhom: [
      { pool: 'sushi', p: 0.85, sl: [1, 3] },
      { pool: 'com', p: 0.6, sl: [1, 1] },
      { pool: 'nuoc_re', p: 0.5, sl: [1, 2] },
    ],
  },
  {
    ten: 'giao_hang',
    trong_so: 6,
    so_khach: [1, 4],
    loai_don: 'giao_hang',
    nhom: [
      { pool: 'sushi', p: 0.8, sl: [1, 3] },
      { pool: 'com', p: 0.65, sl: [1, 2] },
      { pool: 'mon_nong', p: 0.5, sl: [1, 1] },
      { pool: 'nuoc_ngot', p: 0.6, sl: [1, 3] },
    ],
  },
];


/**
 * Gan mon vao nhom theo DANH MUC, khong theo ten mon.
 *
 * Ban dau nhom duoc liet ke bang ten mon ('Bo lagu', 'Chagio'...). Cach do
 * chet ngay lan dau nha hang thay thuc don: toan bo ten cu bien mat, moi nhom
 * rong sach, script sinh ra 0 don va Apriori khong con gi de hoc.
 *
 * Gan theo danh muc thi ben hon nhieu - nha hang them bot mon trong danh muc
 * la chuyen thuong xuyen, con xoa han mot danh muc thi hiem. Khop theo phan
 * chu HOA sau so thu tu: "05. SASHIMI" -> SASHIMI.
 *
 * Mot danh muc duoc phep nam trong nhieu nhom (do uong vua la `nuoc_ngot` vua
 * co the la `nuoc_re`); loc them bang tu khoa o `LOC_TEN` ben duoi.
 */
const NHOM_DANH_MUC = {
  sashimi:     ['SASHIMI', 'SASHIMI COMBO'],
  sushi:       ['GUNKAN', 'NIGIRI', 'SUSHI COMBO', 'MAKI', 'TEMAKI', 'RICE ROLL'],
  nuong:       ['GRILLED', 'TEPPAN YAKI'],
  mon_nong:    ['HOT DISH', 'TEMPURA'],
  khai_vi:     ['APPERTIZER', 'SALAD', 'JAPANESE OYSTER'],
  sup:         ['SOUP'],
  mi:          ['NOODLE'],
  lau:         ['HOT POT'],
  com:         ['RICE'],
  trang_mieng: ['DESSERT'],
  nuoc_ngot:   ['DRINK'],
  nuoc_re:     ['DRINK'],
  bia:         ['SAKE - BEER'],
};

/**
 * Loc them trong nhom, theo tu khoa trong ten mon.
 *
 * `nuoc_re` la nuoc khach goi kem bua trua cho re - nuoc suoi, tra. Neu de ca
 * danh muc DRINK thi khach an trua cung goi matcha latte 59k, sai ban chat va
 * lam nhoe luat ket hop cua nhom trua van phong.
 */
const LOC_TEN = {
  nuoc_re: (ten) => /NƯỚC SUỐI|TRÀ|COCA|SPRITE|STING/i.test(ten),
};

const LOAI_TIEC = ['Sinh nhật', 'Họp mặt gia đình', 'Liên hoan công ty', 'Hẹn hò', 'Ăn thường', 'Tiếp khách'];

// --------------------------------------------------------------------------
// Ho tro ngay thang
// --------------------------------------------------------------------------
const iso = (d) => d.toISOString().slice(0, 10);

function* duyetNgay(tu, den) {
  const d = new Date(tu + 'T00:00:00Z');
  const cuoi = new Date(den + 'T00:00:00Z');
  while (d <= cuoi) {
    yield new Date(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function chonGio(kichBan) {
  if (kichBan.gio_uu_tien && rand() < 0.8) return chon(kichBan.gio_uu_tien);
  const tong = PHAN_BO_GIO.reduce((s, [, w]) => s + w, 0);
  let r = rand() * tong;
  for (const [gio, w] of PHAN_BO_GIO) {
    r -= w;
    if (r <= 0) return gio;
  }
  return 19;
}

function chonKichBan() {
  const tong = KICH_BAN.reduce((s, k) => s + k.trong_so, 0);
  let r = rand() * tong;
  for (const k of KICH_BAN) {
    r -= k.trong_so;
    if (r <= 0) return k;
  }
  return KICH_BAN[0];
}

// --------------------------------------------------------------------------
async function xoaDuLieuMoPhongCu() {
  const [r] = await db.query('DELETE FROM hopdong WHERE la_du_lieu_mo_phong = 1');
  if (r.affectedRows) console.log(`  ~ xoa ${r.affectedRows} dong mo phong cu`);
  await db.query("DELETE FROM xuat_kho WHERE ly_do = 'ban_hang_mo_phong'");
  await db.query("DELETE FROM chi_tiet_phieu_nhap WHERE id_pn IN (SELECT id_pn FROM phieu_nhap WHERE ghi_chu = 'mo_phong')");
  await db.query("DELETE FROM phieu_nhap WHERE ghi_chu = 'mo_phong'");
}

async function main() {
  console.log('=== Migration 003: sinh du lieu lich su ===');
  console.log(`Khoang: ${NGAY_BAT_DAU} -> ${NGAY_KET_THUC}, seed=${SEED}`);

  console.log('\n[1/4] Don du lieu mo phong cu');
  await xoaDuLieuMoPhongCu();

  // --- Nap danh muc mon ---
  const [mons] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, l.name_loai
     FROM monan m JOIN loai_mon l ON l.id_loai = m.id_loai
     WHERE m.tinhtrang = 1`
  );
  // Gan mon vao nhom theo danh muc. `tenNen` bo so thu tu o dau ten danh muc
  // ("05. SASHIMI" -> "SASHIMI") de doi so thu tu khong lam vo anh xa.
  const tenNen = (s) => String(s).replace(/^\s*\d+\.\s*/, '').trim().toUpperCase();
  const monTheoDanhMuc = new Map();
  for (const m of mons) {
    const k = tenNen(m.name_loai);
    if (!monTheoDanhMuc.has(k)) monTheoDanhMuc.set(k, []);
    monTheoDanhMuc.get(k).push(m);
  }

  const pool = {};
  const nhomRong = [];
  for (const [nhom, dsDanhMuc] of Object.entries(NHOM_DANH_MUC)) {
    const loc = LOC_TEN[nhom];
    pool[nhom] = [];
    for (const dm of dsDanhMuc) {
      for (const m of monTheoDanhMuc.get(dm) || []) {
        if (loc && !loc(m.name_mon)) continue;
        pool[nhom].push(m);
      }
    }
    if (!pool[nhom].length) nhomRong.push(nhom);
  }

  console.log('  Nhom mon:');
  for (const [nhom, ds] of Object.entries(pool)) {
    console.log(`      ${nhom.padEnd(12)} ${String(ds.length).padStart(3)} mon`);
  }

  /*
    Dung han neu co nhom rong.

    Ban truoc gan nhom theo ten mon; khi thuc don doi, moi nhom rong sach nhung
    script van chay het, in ra "sinh 0 don" roi bao hoan tat - loi im lang.
    Tha hong to con hon sinh ra mot bo du lieu rong ma khong ai nhan ra.
  */
  if (nhomRong.length) {
    throw new Error(
      `Cac nhom mon khong co mon nao: ${nhomRong.join(', ')}. ` +
      'Kiem tra NHOM_DANH_MUC co con khop ten danh muc trong bang loai_mon khong.'
    );
  }

  const [khachs] = await db.query('SELECT id FROM khach_hang');
  const idKhachs = khachs.map((k) => k.id);

  // --- Sinh don ---
  console.log('\n[2/4] Sinh don hang');
  const rows = [];
  let soDon = 0;
  let soNgay = 0;
  const tieuHaoTheoNgay = new Map(); // 'ngay|id_mon' -> tong so luong ban

  for (const d of duyetNgay(NGAY_BAT_DAU, NGAY_KET_THUC)) {
    const ngay = iso(d);
    const thu = d.getUTCDay();
    const thang = d.getUTCMonth() + 1;

    // Xu huong tang truong nhe theo thoi gian (~12%/nam) + cac he so mua vu.
    const viTri = soNgay / 368;
    const heSoTangTruong = 1 + 0.12 * viTri;
    const heSo =
      HE_SO_THU[thu] * (HE_SO_THANG[thang] || 1) * (NGAY_LE[ngay] || 1) * heSoTangTruong;

    let soDonNgay = Math.round(38 * heSo + nhieuChuan(0, 4));
    soDonNgay = Math.max(0, soDonNgay);
    soNgay++;

    for (let i = 0; i < soDonNgay; i++) {
      const kb = chonKichBan();
      const gio = chonGio(kb);
      const phut = randInt(0, 59);
      const gioDat = `${String(gio).padStart(2, '0')}:${String(phut).padStart(2, '0')}:00`;
      const sesis = `SIM${ngay.replace(/-/g, '')}${String(i).padStart(3, '0')}`;
      const soKhach = randInt(kb.so_khach[0], kb.so_khach[1]);
      const idUser = rand() < 0.45 && idKhachs.length ? chon(idKhachs) : 0;
      const loaiTiec = chon(LOAI_TIEC);

      // ~4% don bi huy -> phuc vu chi so "ty le huy" tren dashboard.
      const tinhTrang = rand() < 0.04 ? 2 : 3;

      const daChon = new Set();
      for (const g of kb.nhom) {
        if (rand() > g.p) continue;
        const ds = pool[g.pool];
        if (!ds || !ds.length) continue;
        const soMon = randInt(g.sl[0], g.sl[1]);
        for (let k = 0; k < soMon; k++) {
          const mon = chon(ds);
          if (daChon.has(mon.id_mon)) continue;
          daChon.add(mon.id_mon);

          // So luong phan: nuoc/bia goi nhieu hon mon chinh.
          const nhieu = g.pool === 'bia' || g.pool === 'nuoc_ngot' || g.pool === 'nuoc_re';
          const soLuong = nhieu ? randInt(1, Math.min(4, Math.ceil(soKhach / 1.5) + 1)) : randInt(1, 2);
          const thanhTien = mon.gia_mon * soLuong;

          rows.push([
            sesis, mon.id_mon, mon.name_mon, idUser, ngay, gioDat.slice(0, 5),
            soLuong, loaiTiec, String(soKhach), mon.gia_mon, thanhTien,
            mon.images || '', tinhTrang, 1, ngay, gioDat, kb.loai_don, 1,
          ]);

          if (tinhTrang === 3) {
            const key = `${ngay}|${mon.id_mon}`;
            tieuHaoTheoNgay.set(key, (tieuHaoTheoNgay.get(key) || 0) + soLuong);
          }
        }
      }
      if (daChon.size) soDon++;
    }
  }

  console.log(`  sinh ${soDon} don / ${rows.length} dong mon tren ${soNgay} ngay`);

  // Chen theo lo de tranh goi query qua nhieu lan.
  const COT = `(sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user,
                gia, thanhtien, images, tinhtrang, trangthai_bep, ngay_dat, gio_dat,
                loai_don, la_du_lieu_mo_phong)`;
  const LO = 500;
  for (let i = 0; i < rows.length; i += LO) {
    const lo = rows.slice(i, i + LO);
    const placeholders = lo.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    await db.query(`INSERT INTO hopdong ${COT} VALUES ${placeholders}`, lo.flat());
    if ((i / LO) % 20 === 0) {
      process.stdout.write(`\r  da chen ${Math.min(i + LO, rows.length)}/${rows.length}`);
    }
  }
  console.log(`\r  da chen ${rows.length}/${rows.length} dong mon`);

  // --- Quy doi mon ban ra thanh tieu hao nguyen lieu ---
  console.log('\n[3/4] Sinh nhat ky xuat kho tu cong thuc');
  const [cts] = await db.query('SELECT id_mon, id_nl, so_luong_tieu_hao FROM cong_thuc');
  const ctTheoMon = new Map();
  for (const c of cts) {
    if (!ctTheoMon.has(c.id_mon)) ctTheoMon.set(c.id_mon, []);
    ctTheoMon.get(c.id_mon).push(c);
  }

  // Gop theo (ngay, nguyen lieu) - neu ghi tung don se ra hang tram nghin dong
  // ma khong them thong tin gi cho bai toan du bao theo ngay.
  const xuat = new Map();
  for (const [key, sl] of tieuHaoTheoNgay) {
    const [ngay, idMon] = key.split('|');
    const ct = ctTheoMon.get(Number(idMon));
    if (!ct) continue;
    for (const c of ct) {
      const k = `${ngay}|${c.id_nl}`;
      xuat.set(k, (xuat.get(k) || 0) + c.so_luong_tieu_hao * sl);
    }
  }

  const xuatRows = [...xuat].map(([k, sl]) => {
    const [ngay, idNl] = k.split('|');
    // Hao hut thuc te 2-6% so voi dinh muc cong thuc.
    const haoHut = 1 + 0.02 + rand() * 0.04;
    return [Number(idNl), Math.round(sl * haoHut * 1000) / 1000, 'ban_hang_mo_phong', ngay];
  });

  for (let i = 0; i < xuatRows.length; i += LO) {
    const lo = xuatRows.slice(i, i + LO);
    const ph = lo.map(() => '(?,?,?,?)').join(',');
    await db.query(
      `INSERT INTO xuat_kho (id_nl, so_luong, ly_do, ngay_xuat) VALUES ${ph}`,
      lo.flat()
    );
  }
  console.log(`  + ${xuatRows.length} dong xuat kho (gop theo ngay x nguyen lieu)`);

  // --- Phieu nhap hang tuan ---
  console.log('\n[4/4] Sinh phieu nhap hang');
  const [nls] = await db.query(
    'SELECT id_nl, ten_nl, gia_von, han_su_dung_ngay FROM nguyen_lieu WHERE gia_von > 0'
  );
  const [nccs] = await db.query('SELECT id_ncc FROM nha_cung_cap');
  const idNccs = nccs.map((n) => n.id_ncc);

  // Tieu hao trung binh 1 ngay cho moi nguyen lieu -> co so tinh luong nhap.
  const tbNgay = new Map();
  for (const [k, sl] of xuat) {
    const idNl = Number(k.split('|')[1]);
    tbNgay.set(idNl, (tbNgay.get(idNl) || 0) + sl);
  }
  for (const [k, v] of tbNgay) tbNgay.set(k, v / soNgay);

  let soPhieu = 0;
  let ngayIdx = 0;
  for (const d of duyetNgay(NGAY_BAT_DAU, NGAY_KET_THUC)) {
    ngayIdx++;
    if (d.getUTCDay() !== 1) continue; // nhap hang vao thu Hai hang tuan
    const ngay = iso(d);
    const maPhieu = `PN${ngay.replace(/-/g, '')}`;
    const idNcc = idNccs.length ? chon(idNccs) : null;

    const [pn] = await db.query(
      'INSERT INTO phieu_nhap (ma_phieu, id_ncc, ngay_nhap, ghi_chu, trangthai) VALUES (?, ?, ?, ?, 1)',
      [maPhieu, idNcc, ngay, 'mo_phong']
    );
    soPhieu++;

    let tong = 0;
    const ct = [];
    for (const nl of nls) {
      const tb = tbNgay.get(nl.id_nl) || 0;
      if (tb <= 0) continue;
      // Nhap du dung 7 ngay + dem an toan 20%, lech ngau nhien +-15%.
      const luong = tb * 7 * 1.2 * (0.85 + rand() * 0.3);
      if (luong < 0.01) continue;
      const soLuong = Math.round(luong * 100) / 100;
      const gia = Number(nl.gia_von) * (0.95 + rand() * 0.12);
      tong += soLuong * gia;
      const hsd = new Date(d);
      hsd.setUTCDate(hsd.getUTCDate() + nl.han_su_dung_ngay);
      ct.push([
        pn.insertId, nl.id_nl, soLuong, Math.round(gia), `L${ngay.replace(/-/g, '')}`,
        iso(hsd), 0,
      ]);
    }
    if (ct.length) {
      const ph = ct.map(() => '(?,?,?,?,?,?,?)').join(',');
      await db.query(
        `INSERT INTO chi_tiet_phieu_nhap
         (id_pn, id_nl, so_luong, gia_nhap, so_lo, han_su_dung, so_luong_con_lai)
         VALUES ${ph}`,
        ct.flat()
      );
    }
    await db.query('UPDATE phieu_nhap SET tong_tien = ? WHERE id_pn = ?', [
      Math.round(tong),
      pn.insertId,
    ]);
  }
  console.log(`  + ${soPhieu} phieu nhap (nhap hang thu Hai hang tuan)`);

  // --- Tom tat ---
  const [tk] = await db.query(`
    SELECT COUNT(DISTINCT sesis) AS so_don, COUNT(*) AS so_dong,
           MIN(ngay_dat) AS tu_ngay, MAX(ngay_dat) AS den_ngay,
           ROUND(SUM(CASE WHEN tinhtrang = 3 THEN thanhtien ELSE 0 END)) AS doanh_thu
    FROM hopdong WHERE id_mon > 0`);
  console.log('\n=== Tong ket toan bo bang hopdong ===');
  console.table(tk);
  await db.end();
}

main().catch((err) => {
  console.error('Sinh du lieu that bai:', err);
  process.exit(1);
});

/**
 * Kiem tra giao dien khu khach tren dien thoai - chay sau moi lan sua CSS/EJS
 * cua trang khach.
 *
 * VI SAO CAN SCRIPT NAY
 * Loi bo cuc dien thoai khong lam trang vo, khong ghi vao log, khong co ngoai le
 * nao nem ra. Trang van tra 200 trong khi hero an nua man hinh dau, danh muc
 * xep thanh 11 hang, hay nut cham chi cao 26px. Chi mo bang mat moi thay - va
 * mo bang mat thi lan sau quen mat.
 *
 * Nen script mo Chrome that o hai kho man hinh roi DO bang JavaScript trong
 * trang, doi chieu voi nguong. Bay phep kiem tra, moi phep bat mot loi da that
 * su xay ra khi lam phan nay:
 *
 *   1. TRAN NGANG      trang bi keo ngang tren dien thoai
 *   2. HERO            hero trang trong tung an 439px/844px cua man hinh dau
 *   3. DANH MUC        22 danh muc tung xuong dong thanh khoi cao 592px
 *   4. LUOI MON        minmax(300px,1fr) chi vua 1 cot -> 1,5 mon moi man hinh
 *   5. VUNG CHAM       gio hang 33px, nut ngon ngu 26px - duoi nguong 44px
 *   6. TEN NHA HANG    bi cat thanh "Bao Doan Restau..." sau khi noi vung cham
 *   7. NUT CHAT        phai an khi cuon xuong, hien khi cuon len, giu khi dang
 *                      mo cua so chat, va KHONG BAO GIO an tren may tinh
 *
 * Phep 8 la chot chan quan trong nhat: do lai o 1440px de chac chan khong co
 * thay doi nao ro ri ra ngoai diem ngat dien thoai.
 *
 * Chay:  npm run dienthoai:check      (web server phai dang chay)
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const GOC = process.env.KIEM_TRA_URL || 'http://127.0.0.1:3000';
const DT = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const MT = { width: 1440, height: 900, deviceScaleFactor: 1 };

const TRANG = ['/menu?id_loai=32&lang=vi', '/about?lang=vi', '/cart?lang=vi',
               '/detail?monid=274&lang=vi', '/thanh-vien?lang=vi'];

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

let soDat = 0;
let soHong = 0;
function dat(ten, ok, chiTiet) {
  if (ok) { soDat++; console.log(`  [OK]  ${ten}`); }
  else { soHong++; console.log(`  [HONG] ${ten}${chiTiet !== undefined ? '  ->  ' + JSON.stringify(chiTiet) : ''}`); }
}

function timChrome() {
  const co = CHROME.find((p) => fs.existsSync(p));
  if (!co) {
    console.error('Khong tim thay Chrome/Edge. Sua danh sach CHROME trong tep nay.');
    process.exit(1);
  }
  return co;
}

/** Do mot trang: tra ve cac so do can doi chieu. */
function doTrang() {
  const q = (s) => document.querySelector(s);
  const cao = (s) => { const e = q(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
  const nav = [...document.querySelectorAll('.nh-nav__actions > a, .nh-nav__actions > button, .nh-lang__nut, .nh-burger')]
    .map((e) => ({ ten: e.className || e.tagName, cao: Math.round(e.getBoundingClientRect().height) }))
    .filter((x) => x.cao > 0 && x.cao < 44);
  const ten = q('.nh-brand__name');
  const luoi = q('.nh-grid');
  const cats = q('.nh-cats');
  return {
    tran: document.documentElement.scrollWidth > window.innerWidth + 1,
    rong: document.documentElement.scrollWidth,
    khung: window.innerWidth,
    hero: cao('.nh-subhero'),
    cats: cats ? Math.round(cats.getBoundingClientRect().height) : null,
    catsWrap: cats ? getComputedStyle(cats).flexWrap : null,
    cot: luoi ? getComputedStyle(luoi).gridTemplateColumns.split(' ').length : null,
    chamNho: nav,
    tenCat: ten ? ten.scrollWidth > Math.ceil(ten.getBoundingClientRect().width) : null,
    caoTrang: document.body.scrollHeight,
  };
}

async function main() {
  const tr = await puppeteer.launch({ executablePath: timChrome(), headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const t = await tr.newPage();
  const loiJs = [];
  t.on('pageerror', (e) => loiJs.push(e.message));

  const mo = async (url) => {
    const rp = await t.goto(GOC + url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 700));
    return rp.status();
  };

  // ---- Dien thoai ----
  await t.setViewport(DT);
  console.log(`\nDIEN THOAI ${DT.width}x${DT.height}`);

  console.log('\n1. Khong tran ngang');
  const doDT = {};
  for (const url of TRANG) {
    const ma = await mo(url);
    const d = await t.evaluate(doTrang);
    doDT[url] = d;
    dat(`${url.split('?')[0]} tra ${ma}, khong tran ngang`, ma === 200 && !d.tran, { ma, rong: d.rong, khung: d.khung });
  }

  console.log('\n2. Hero trang trong chi con dai mang (<= 120px)');
  for (const url of TRANG) dat(`${url.split('?')[0]} hero ${doDT[url].hero}px`, doDT[url].hero !== null && doDT[url].hero <= 120, doDT[url].hero);

  console.log('\n3. Danh muc cuon ngang mot hang');
  const dm = doDT[TRANG[0]];
  dat('khong xuong dong (flex-wrap: nowrap)', dm.catsWrap === 'nowrap', dm.catsWrap);
  dat(`khoi danh muc thap (${dm.cats}px <= 70px)`, dm.cats !== null && dm.cats <= 70, dm.cats);

  console.log('\n4. Luoi mon 2 cot');
  dat(`trang Thuc don co ${dm.cot} cot`, dm.cot === 2, dm.cot);

  console.log('\n5. Vung cham thanh dieu huong >= 44px');
  dat('khong nut nao duoi 44px', dm.chamNho.length === 0, dm.chamNho);

  console.log('\n6. Ten nha hang khong bi cat');
  dat('ten hien du o 390px', dm.tenCat === false, dm.tenCat);

  console.log('\n7. Ngan keo menu phu kin chieu cao man hinh');
  // Da tung hong: `backdrop-filter` tren .nh-nav.is-solid bien thanh nav thanh
  // khoi chua cua phan tu fixed ben trong, ngan keo tut con 128px va cac muc
  // menu thanh chu trang tren nen kem. Do chieu cao that thay vi tin vao CSS.
  await mo(TRANG[0]);
  await t.evaluate(() => document.querySelector('.nh-burger').click());
  await new Promise((r) => setTimeout(r, 600));
  const nk = await t.evaluate(() => {
    const l = document.querySelector('.nh-nav__links');
    const r = l.getBoundingClientRect();
    const cuoi = [...l.querySelectorAll('a')].pop();
    return { cao: Math.round(r.height), khung: window.innerHeight,
             mucCuoiTrongNgan: cuoi ? cuoi.getBoundingClientRect().bottom <= r.bottom : null,
             nen: getComputedStyle(l).backgroundColor };
  });
  dat(`ngan keo cao ${nk.cao}px = het man hinh ${nk.khung}px`, nk.cao >= nk.khung - 1, nk);
  dat('muc menu cuoi cung nam trong nen sam', nk.mucCuoiTrongNgan === true, nk);
  // Da tung thieu: "Dat ban" va "Dang nhap" o hang cong cu deu mang
  // .d-none-mobile (an duoi 760px) ma ngan keo khong co muc thay the, nen tren
  // dien thoai khong con loi vao dang nhap nao.
  const duongDan = await t.evaluate(() =>
    [...document.querySelectorAll('.nh-nav__links a')].map((a) => a.getAttribute('href')));
  dat('ngan keo co loi vao dang nhap', duongDan.includes('/login') || duongDan.includes('/logout'), duongDan);
  dat('ngan keo co loi vao dat ban', duongDan.includes('/datban'), duongDan);

  console.log('\n8. Nut tro ly ao an/hien theo huong cuon');
  await mo(TRANG[0]);
  const anKhong = () => t.evaluate(() => document.getElementById('cb-nut').classList.contains('cb-nut--an'));
  const cuon = async (y) => { await t.evaluate((v) => window.scrollTo(0, v), y); await new Promise((r) => setTimeout(r, 600)); };
  dat('dau trang: nut hien', (await anKhong()) === false);
  await cuon(1400);
  dat('cuon xuong: nut an', (await anKhong()) === true);
  await cuon(900);
  dat('cuon len: nut hien lai', (await anKhong()) === false);
  await t.evaluate(() => document.getElementById('cb-nut').click());
  await new Promise((r) => setTimeout(r, 400));
  await cuon(2200);
  dat('dang mo cua so chat: nut van hien', (await anKhong()) === false);

  // ---- May tinh: chot chan khong ro ri ----
  await t.setViewport(MT);
  console.log(`\nMAY TINH ${MT.width}x${MT.height} (chot chan: bo cuc cu phai giu nguyen)`);
  await mo(TRANG[0]);
  const dMT = await t.evaluate(doTrang);
  dat(`hero van cao (${dMT.hero}px >= 400px)`, dMT.hero >= 400, dMT.hero);
  dat('danh muc van xuong dong', dMT.catsWrap === 'wrap', dMT.catsWrap);
  dat(`luoi mon van 3 cot (${dMT.cot})`, dMT.cot === 3, dMT.cot);
  dat('khong tran ngang', !dMT.tran);
  await cuon(1400);
  dat('nut tro ly ao KHONG an tren may tinh', (await anKhong()) === false);

  console.log('\n9. Khong loi JavaScript');
  dat('khong trang nao nem loi', loiJs.length === 0, loiJs);

  await tr.close();
  console.log(`\n=== ${soDat} dat, ${soHong} hong ===\n`);
  process.exit(soHong ? 1 : 0);
}

main().catch((e) => { console.error('Kiem tra that bai:', e.message); process.exit(1); });

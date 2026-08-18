/**
 * Kiem tra bo da ngon ngu - chay truoc khi giao hang hoac sau khi sua locales.
 *
 * Bon phep kiem tra, moi phep bat mot loai loi da that su xay ra khi lam:
 *
 *   1. THIEU KHOA      en/ja thieu khoa nao thi cho do lui ve tieng Viet - man
 *                      hinh khong vo, chi lang le sai ngon ngu. Loai loi khong
 *                      ai phat hien cho toi luc khach phan nan.
 *   2. THUA KHOA       khoa co o en/ja ma khong co o vi = go nham ten khoa,
 *                      va no se khong bao gio duoc dung toi.
 *   3. LAN TIENG ANH   ban tieng Nhat con sot tu Latin (da tung xay ra: mot
 *                      chuoi con nguyen chu 'season', mot chuoi con 'support').
 *   4. TEN MON         bao nhieu mon dich duoc sang tieng Nhat, va con mon nao
 *                      cho ra chuoi lap ky tu (dau hieu tra tung tu bi trung).
 *
 * Chay:  npm run ngonngu:check
 */
const nn = require('../services/ngonNgu');
const vi = require('../locales/vi');
const en = require('../locales/en');
const ja = require('../locales/ja');

const D = '─'.repeat(64);
let loi = 0;

function muc(t) { console.log(`\n${t}\n${D}`); }

muc('1. Doi chieu khoa giua ba ngon ngu');
const kVi = Object.keys(vi);
for (const [ten, bo] of [['en', en], ['ja', ja]]) {
  const thieu = kVi.filter((k) => !(k in bo));
  const thua = Object.keys(bo).filter((k) => !(k in vi));
  console.log(`  ${ten}: ${Object.keys(bo).length}/${kVi.length} khoa`);
  if (thieu.length) { loi++; console.log(`     THIEU (${thieu.length}): ${thieu.slice(0, 8).join(', ')}`); }
  if (thua.length) { loi++; console.log(`     THUA  (${thua.length}): ${thua.slice(0, 8).join(', ')}`); }
  if (!thieu.length && !thua.length) console.log('     khop hoan toan');
}

muc('2. Chuoi rong');
for (const [ten, bo] of [['vi', vi], ['en', en], ['ja', ja]]) {
  const rong = Object.entries(bo).filter(([, v]) => !String(v).trim()).map(([k]) => k);
  if (rong.length) { loi++; console.log(`  ${ten}: ${rong.join(', ')}`); }
}
if (!loi) console.log('  khong co chuoi rong');

muc('3. Ban tieng Nhat con lan chu Latin');
// Ten thuong hieu va dong ban quyen duoc phep giu chu Latin.
const CHO_PHEP = /^(chung\.ten_nha_hang|chan_trang\.ban_quyen)$/;
let lan = 0;
for (const [k, v] of Object.entries(ja)) {
  if (CHO_PHEP.test(k)) continue;
  const chu = String(v).replace(/<[^>]+>/g, '').replace(/\{[a-z_]+\}/g, '');
  const tu = chu.match(/[A-Za-z]{3,}/g);
  if (tu) { lan++; loi++; console.log(`  [${k}] ${tu.join(', ')}`); }
}
if (!lan) console.log('  sach - khong con tu Latin lac');

muc('4. Ten mon sang tieng Nhat');
(async () => {
  const db = require('../config/db');
  try {
    const [r] = await db.query("SELECT name_mon, ghichu_mon FROM monan WHERE ghichu_mon <> ''");
    let dich = 0;
    const ngo = [];
    for (const m of r) {
      const anh = nn.tenTiengAnh(m.ghichu_mon);
      const nhat = nn.tenTiengNhat(anh);
      if (nhat) dich++;
      else ngo.push(anh);
      // Ky tu lap ba lan lien tiep = dau hieu tra tung tu bi trung nghia.
      if (nhat && /(.)\1{2,}/.test(nhat)) ngo.push(`[LAP] ${anh} -> ${nhat}`);
    }
    console.log(`  ${dich}/${r.length} mon dich duoc sang tieng Nhat`);
    if (ngo.length) {
      console.log(`  ${ngo.length} mon chi hien duoc tieng Anh:`);
      ngo.slice(0, 10).forEach((x) => console.log(`     ${x}`));
    }
  } catch (e) {
    console.log('  (bo qua - khong ket noi duoc CSDL: ' + (e.code || e.message) + ')');
  }
  await db.end().catch(() => {});

  muc('KET LUAN');
  console.log(loi ? `  ${loi} van de can sua.` : '  Khong co van de nao.');
  process.exit(loi ? 1 : 0);
})();

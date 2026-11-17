/**
 * Sinh css/che-do-toi.css: ban che do toi cho cac view khu khach co mau sang
 * ghi cung trong <style> rieng hoac thuoc tinh style="...".
 *
 * VI SAO CAN: o che do toi, cac bien mau --nh-ink / --nh-espresso doi thanh mau
 * kem SANG (lam mau chu). View nao tu ghi `background: #fff` cho the cua minh se
 * thanh "nen trang + chu kem" -> loa mat, gan nhu khong doc duoc. Sua tay hon
 * 150 cho trong 20 file vua lau vua de sot, nen script nay doc tung quy tac
 * va anh xa mau theo mot bang co dinh:
 *
 *   nen trang / kem            -> be mat toi (--nh-surface, --nh-surface-2)
 *   nen xanh/do/vang/lam nhat  -> cung tong, trong suot tren nen toi
 *   chu dam (trung tinh)       -> --nh-ink ; chu xam vua -> --nh-muted
 *   chu dam co mau             -> ban sang cung tong (xanh/do/vang/lam)
 *   vien nhat                  -> --nh-border
 *
 * GIU NGUYEN: khoi chua ma QR (phai nen trang moi quet duoc), ban do, va chu
 * nam tren nen dam/vang (nut bam) - chu do van dung mau toi.
 *
 * Chay lai sau khi sua giao dien:  npm run giaodien:toi
 * File sinh ra nap TRUOC nhahang.css, nen quy tac viet tay trong nhahang.css
 * (muc "CHE DO TOI - VA CAC KHOI NEN SANG ...") thang khi trung.
 */
const fs = require('fs');
const path = require('path');

const GOC = path.join(__dirname, '..');
const VIEWS = path.join(GOC, 'views');
// Da co che do toi viet tay day du - khong sinh them de khoi de nhau.
const BO_QUA_FILE = new Set(['partials/chatbot.ejs', 'huong-dan-dat-ban.ejs']);
const BO_QUA_SELECTOR = /qr|leaflet|map|ban-do|bando|#gh-cart-map|print|@page/i;
const T = '[data-theme="dark"]';

// ------------------------------------------------------------- mau sac
function hex(s) {
  s = s.toLowerCase();
  if (s === 'white') return [255, 255, 255];
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbaChuoi(s) {
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)$/);
  return m ? { c: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null;
}
function docMau(s) {
  s = s.trim();
  const h = hex(s);
  if (h) return { c: h, a: 1 };
  return rgbaChuoi(s);
}
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}
function tong(c) {
  const { h, l } = hsl(c);
  // Do dam mau thuc (max-min) thay vi do bao hoa HSL: mau rat nhat nhu kem
  // #faf7f1 co do bao hoa HSL cao nhung nhin la trang - phai xep trung tinh.
  const chroma = (Math.max(...c) - Math.min(...c)) / 255;
  if (chroma < (l > 0.9 ? 0.045 : 0.15)) return 'trung';
  if (h >= 345 || h < 15) return 'do';
  if (h < 50) return 'cam';      // cam / vang dat / nau
  if (h < 70) return 'vang';
  if (h < 170) return 'xanh';
  if (h < 265) return 'lam';
  if (h < 345) return 'tim';
  return 'trung';
}
const NEN_TONG = {
  do: 'rgba(239, 68, 68, .12)', cam: 'rgba(245, 158, 11, .12)', vang: 'rgba(234, 179, 8, .12)',
  xanh: 'rgba(34, 197, 94, .12)', lam: 'rgba(99, 102, 241, .14)', tim: 'rgba(168, 85, 247, .14)',
};
const CHU_TONG = { do: '#fca5a5', cam: '#fcd34d', vang: '#fde047', xanh: '#86efac', lam: '#a5b4fc', tim: '#d8b4fe' };
const VIEN_TONG = {
  do: 'rgba(239, 68, 68, .4)', cam: 'rgba(245, 158, 11, .4)', vang: 'rgba(234, 179, 8, .4)',
  xanh: 'rgba(34, 197, 94, .4)', lam: 'rgba(99, 102, 241, .45)', tim: 'rgba(168, 85, 247, .45)',
};

/** Nen sang -> gia tri toi tuong ung, hoac null neu khong phai nen sang. */
function nenToi(giaTri) {
  const v = giaTri.trim();
  // Gradient toan mau sang: lay mau dau lam dai dien.
  if (/gradient\(/.test(v)) {
    const ds = v.match(/#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)|\bwhite\b/g) || [];
    const mau = ds.map(docMau).filter(Boolean);
    if (!mau.length || !mau.every((m) => hsl(m.c).l > 0.86 || m.a < 0.25)) return null;
    return nenToi(ds[0]);
  }
  const tachMau = v.match(/#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)|\bwhite\b/);
  if (!tachMau) return null;
  const m = docMau(tachMau[0]);
  if (!m || m.a < 0.5) return null;
  const { l } = hsl(m.c);
  if (l < 0.86) return null;
  const t = tong(m.c);
  if (t === 'trung') return l > 0.975 ? 'var(--nh-surface)' : 'var(--nh-surface-2)';
  return NEN_TONG[t];
}
/** Chu toi -> chu sang tuong ung (chi ap khi chu dang nam tren nen sang/khong nen). */
function chuToi(giaTri) {
  const tachMau = giaTri.trim().match(/^(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))/);
  if (!tachMau) return null;
  const m = docMau(tachMau[1]);
  if (!m) return null;
  const { h, l, s } = hsl(m.c);
  if (l > 0.6) return null;               // chu da sang
  if (h >= 35 && h <= 52 && s > 0.4 && l > 0.4) return null; // vang dong thuong hieu: doc tot tren nen toi
  const t = tong(m.c);
  if (t === 'trung' || (t === 'cam' && s < 0.45 && l < 0.3)) return l < 0.3 ? 'var(--nh-ink)' : 'var(--nh-muted)';
  return CHU_TONG[t];
}
function vienToi(giaTri) {
  const tachMau = giaTri.match(/#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)/);
  if (!tachMau) return null;
  const m = docMau(tachMau[0]);
  if (!m) return null;
  const { l } = hsl(m.c);
  if (l < 0.78) return null;
  const t = tong(m.c);
  return t === 'trung' ? 'var(--nh-border)' : VIEN_TONG[t];
}

// ------------------------------------------------------------- doc CSS
/** Tach CSS thanh [{media, sel, decls}] (ho tro mot tang @media). */
function tachCss(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ra = [];
  let i = 0;
  const docKhoi = (media) => {
    while (i < css.length) {
      const mo = css.indexOf('{', i), dong = css.indexOf('}', i);
      if (dong !== -1 && (mo === -1 || dong < mo)) { i = dong + 1; return; }
      if (mo === -1) { i = css.length; return; }
      const dau = css.slice(i, mo).trim();
      i = mo + 1;
      if (dau.startsWith('@media') || dau.startsWith('@supports')) { docKhoi(dau); continue; }
      if (dau.startsWith('@')) { // @keyframes...: bo qua ca khoi
        let sau = 1;
        while (i < css.length && sau > 0) { if (css[i] === '{') sau++; else if (css[i] === '}') sau--; i++; }
        continue;
      }
      const ket = css.indexOf('}', i);
      ra.push({ media, sel: dau, decls: css.slice(i, ket) });
      i = ket + 1;
    }
  };
  docKhoi(null);
  return ra;
}
function tachKhai(decls) {
  const o = {};
  decls.split(';').forEach((d) => {
    const k = d.indexOf(':');
    if (k < 0) return;
    o[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).replace(/!important/, '').trim();
  });
  return o;
}

/** Tu mot bo khai bao -> cac khai bao che do toi (hoac rong). */
function chuyenKhai(kb, quanTrong) {
  const ra = [];
  const imp = quanTrong ? ' !important' : '';
  const nenGoc = kb['background-color'] || kb.background;
  let nenMoi = null, nenDam = false;
  if (nenGoc) {
    nenMoi = nenToi(nenGoc);
    if (!nenMoi && !/transparent|none|inherit|url\(|var\(--nh-(cream|surface)/.test(nenGoc)) nenDam = true;
  }
  if (nenMoi) ra.push(`background: ${nenMoi}${imp}`);
  // Chu: chi doi khi khong nam tren nen dam/vang cua chinh no (nut bam).
  if (kb.color && !nenDam) {
    const c = chuToi(kb.color);
    if (c) ra.push(`color: ${c}${imp}`);
  }
  const vien = kb['border-color'] || kb.border || kb['border-bottom'] || kb['border-top'] || kb['border-left'];
  if (vien && !nenDam) {
    const v = vienToi(vien);
    if (v) {
      if (kb.border || kb['border-color']) ra.push(`border-color: ${v}${imp}`);
      else ['border-bottom', 'border-top', 'border-left'].forEach((b) => { if (kb[b]) ra.push(`${b}-color: ${v}${imp}`); });
    }
  }
  if (nenMoi && kb['box-shadow'] && kb['box-shadow'] !== 'none') ra.push(`box-shadow: none${imp}`);
  return ra;
}

// ------------------------------------------------------------- duyet view
function dsView() {
  const ds = [];
  (function duyet(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const rel = path.relative(VIEWS, p).replace(/\\/g, '/');
      if (/^(admin|staff)\/|shipper/.test(rel)) continue;
      if (fs.statSync(p).isDirectory()) duyet(p);
      else if (f.endsWith('.ejs') && !BO_QUA_FILE.has(rel)) ds.push(rel);
    }
  }(VIEWS));
  return ds.sort();
}

const khoi = [];
const daCo = new Set();
let soQuyTac = 0;
for (const rel of dsView()) {
  const src = fs.readFileSync(path.join(VIEWS, rel), 'utf8');
  const ra = [];
  // 1. <style> rieng cua view
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = m[1].replace(/<%[\s\S]*?%>/g, '');
    for (const q of tachCss(css)) {
      if (/data-theme/.test(q.sel) || BO_QUA_SELECTOR.test(q.sel)) continue;
      const kb = chuyenKhai(tachKhai(q.decls), false);
      if (!kb.length) continue;
      const sel = q.sel.split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => (/^(html|body)\b/.test(s) ? null : `${T} ${s}`)).filter(Boolean).join(',\n');
      if (!sel) continue;
      const dong = `${sel} { ${kb.join('; ')}; }`;
      const toan = (q.media ? q.media + '|' : '') + dong;
      if (daCo.has(toan)) continue;
      daCo.add(toan);
      ra.push(q.media ? `${q.media} {\n  ${dong}\n}` : dong);
      soQuyTac++;
    }
  }
  // 2. Thuoc tinh style="..." viet thang trong HTML
  const html = src.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  for (const m of html.matchAll(/style="([^"<]*)"/g)) {
    const st = m[1];
    const truoc = html.slice(Math.max(0, m.index - 160), m.index);
    if (BO_QUA_SELECTOR.test(truoc.slice(truoc.lastIndexOf('<'))) || /<%/.test(st)) continue;
    const kb = tachKhai(st);
    // Moi khai bao mau duoc khop rieng bang chuoi con cua thuoc tinh style.
    for (const [ten, giaTri] of Object.entries(kb)) {
      let moi = null, thuocTinh = null;
      if ((ten === 'background' || ten === 'background-color')) { moi = nenToi(giaTri); thuocTinh = 'background'; }
      else if (ten === 'color' && !(kb.background && !nenToi(kb.background)) && !(kb['background-color'] && !nenToi(kb['background-color']))) { moi = chuToi(giaTri); thuocTinh = 'color'; }
      if (!moi) continue;
      // Khop ca hai cach viet: "ten:gia tri" va "ten: gia tri".
      const goc = giaTri.split(/\s/)[0];
      const mau = [`${ten}:${goc}`, `${ten}: ${goc}`];
      const sel = mau.map((x) => (ten === 'color'
        ? [`${T} [style^="${x}"]`, `${T} [style*="; ${x}"]`, `${T} [style*=";${x}"]`]
        : [`${T} [style*="${x}"]`])).flat().join(',\n');
      const dong = `${sel} { ${thuocTinh}: ${moi} !important; }`;
      if (daCo.has(dong)) continue;
      daCo.add(dong);
      ra.push(dong);
      soQuyTac++;
    }
  }
  if (ra.length) khoi.push(`/* ---- views/${rel} ---- */\n` + ra.join('\n'));
}

const dau = `/*
 * TU DONG SINH boi scripts/taoCheDoToi.js - DUNG SUA TAY.
 * Sua giao dien xong thi chay lai: npm run giaodien:toi
 * Muon chinh rieng mot cho: viet vao css/nhahang.css (nap SAU file nay).
 */
`;
fs.writeFileSync(path.join(GOC, 'css', 'che-do-toi.css'), dau + khoi.join('\n\n') + '\n');
console.log(`Da sinh css/che-do-toi.css: ${soQuyTac} quy tac tu ${khoi.length} view.`);

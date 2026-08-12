/**
 * Soat hinh hoc cua cac so do MOI (lop, ERD, tuan tu, hoat dong) ngay trong
 * Node, khong can mo trinh duyet.
 *
 *   node docs\so-do\kiem-hinh-hoc.js
 *
 * `kiem-tra.js` soat cac so do use case / BPMN bang Chrome vi phai do bBox
 * that cua chu trong e-lip. Cac so do moi deu la HOP CHU NHAT nen kiem tra
 * bang toa do la du chinh xac, va chay duoc o bat ky may nao:
 *
 *   1. hop tran ra ngoai khung ve
 *   2. hai hop de len nhau
 *   3. duong noi xuyen qua mot hop khong phai hop dau / hop cuoi
 *   4. chu tran ra ngoai khung ve
 *
 * In ra danh sach vi pham; thoat voi ma 1 neu co loi de dung duoc trong script.
 */
const v = require('./ve');

const soCua = (s, ten) => {
  const m = new RegExp(ten + '="(-?[\\d.]+)"').exec(s);
  return m ? Number(m[1]) : null;
};

/** Lay tat ca hop chu nhat "co vien" trong mot chuoi SVG. */
function layHop(svg) {
  const hop = [];
  const re = /<rect[^>]*>/g;
  let m;
  while ((m = re.exec(svg))) {
    const t = m[0];
    // Bo qua cac hop trang tri: ngan ten (nam de len hop chinh), thanh kich
    // hoat, khung tuong tac (mui ten di xuyen qua la dung), lan boi.
    if (/class="[^"]*(ngan-ten|kich-hoat|khung-tt|khung-bien|lan|the)/.test(t)) continue;
    const x = soCua(t, 'x'), y = soCua(t, 'y');
    const w = soCua(t, 'width'), h = soCua(t, 'height');
    if (x === null || y === null || !w || !h) continue;
    hop.push({ x, y, w, h, ten: '' });
  }
  // Nut bat dau / ket thuc cua so do hoat dong la hinh tron - quy ve hop vuong
  // ngoai tiep de dung chung mot phep kiem tra.
  const reTron = /<g class="nut-(dau|cuoi)">([\s\S]*?)<\/g>/g;
  let g;
  while ((g = reTron.exec(svg))) {
    const c = /<circle[^>]*>/.exec(g[2]);
    if (!c) continue;
    const cx = soCua(c[0], 'cx'), cy = soCua(c[0], 'cy'), r = soCua(c[0], 'r') || 12;
    hop.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, ten: 'nút ' + g[1] });
  }
  return hop;
}

/** Lay tat ca doan thang cua duong noi (line + polyline). */
function layDoan(svg) {
  const doan = [];
  let m;
  const reLine = /<line[^>]*>/g;
  while ((m = reLine.exec(svg))) {
    const t = m[0];
    if (!/class="(qh-lop|lk|lk-dut|luong|tin|tin-tra|noi-bang)/.test(t)) continue;
    doan.push([[soCua(t, 'x1'), soCua(t, 'y1')], [soCua(t, 'x2'), soCua(t, 'y2')]]);
  }
  const rePoly = /<polyline[^>]*points="([^"]+)"[^>]*>/g;
  while ((m = rePoly.exec(svg))) {
    const diem = m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number));
    for (let i = 0; i < diem.length - 1; i++) doan.push([diem[i], diem[i + 1]]);
  }
  return doan;
}

/** Chu trong SVG, kem uoc luong be rong theo class. */
function layChu(svg) {
  const chu = [];
  const re = /<text([^>]*)>([^<]*)<\/text>/g;
  let m;
  while ((m = re.exec(svg))) {
    const thuoc = m[1];
    const noi = m[2].replace(/&#\d+;/g, 'x').replace(/&[a-z]+;/g, 'x');
    if (!noi.trim()) continue;
    const co = /tx-(lop-ten|bang-ten|dt)/.test(thuoc) ? 12
      : /tx-(cot|lop|tin|khoa|boi|dk|khoi|ghi)/.test(thuoc) ? 10.5 : 11;
    const neo = /text-anchor:start/.test(thuoc) ? 'start'
      : /tx-(cot|lop|khoa|ghi)\b/.test(thuoc) ? 'start' : 'middle';
    chu.push({
      x: soCua(thuoc, 'x'), y: soCua(thuoc, 'y'),
      w: v.rongChu(noi, co), neo, noi: noi.slice(0, 34),
      ngoai: /tx-(boi|ghi|tin|dk|khoi|sk|luong)\b/.test(thuoc),
    });
  }
  return chu;
}

const deNhau = (a, b, le = 4) =>
  a.x + a.w - le > b.x && b.x + b.w - le > a.x &&
  a.y + a.h - le > b.y && b.y + b.h - le > a.y;

/** Doan thang co di xuyen ruot hop khong (bo qua hai dau mut cham vien). */
function xuyenHop(d, h, le = 5) {
  const [a, b] = d;
  const N = 40;
  for (let i = 1; i < N; i++) {
    const u = i / N;
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u;
    if (x > h.x + le && x < h.x + h.w - le && y > h.y + le && y < h.y + h.h - le) return true;
  }
  return false;
}

/** Soat mot hinh. Tra ve mang mo ta vi pham (rong = dat). */
function soat(ten, svg) {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const [W, H] = [Number(vb[1]), Number(vb[2])];
  const hop = layHop(svg);
  const doan = layDoan(svg);
  const chu = layChu(svg);
  const loi = [];

  hop.forEach((h, i) => {
    if (h.x < 0 || h.y < 0 || h.x + h.w > W || h.y + h.h > H) {
      loi.push(`hộp #${i} tràn khung (${h.x},${h.y} ${h.w}x${h.h} / khung ${W}x${H})`);
    }
  });

  for (let i = 0; i < hop.length; i++) {
    for (let j = i + 1; j < hop.length; j++) {
      if (deNhau(hop[i], hop[j])) loi.push(`hộp #${i} đè lên hộp #${j}`);
    }
  }

  doan.forEach((d, k) => {
    hop.forEach((h, i) => {
      if (xuyenHop(d, h)) {
        loi.push(`đường #${k} (${d[0]}→${d[1]}) xuyên qua hộp #${i} tại (${h.x},${h.y})`);
      }
    });
  });

  chu.forEach((t) => {
    const trai = t.neo === 'middle' ? t.x - t.w / 2 : t.x;
    if (trai < -2 || trai + t.w > W + 2 || t.y < 0 || t.y > H) {
      loi.push(`chữ "${t.noi}" tràn khung (x=${Math.round(trai)}..${Math.round(trai + t.w)}, y=${t.y})`);
    }
    // Nhan quan he va ghi chu nam NGOAI hop; chu ben trong hop khong xet vi do
    // chinh la noi dung cua hop.
    if (!t.ngoai) return;
    const oChu = { x: trai, y: t.y - 9, w: t.w, h: 12 };
    hop.forEach((h, i) => {
      if (deNhau(oChu, h, 1)) loi.push(`nhãn "${t.noi}" đè lên hộp #${i} tại (${h.x},${h.y})`);
    });
  });

  return loi;
}

if (require.main === module) {
  const nhom = {
    erd: require('./erd'),
    'tuan-tu': require('./tuan-tu'),
    'hoat-dong': require('./hoat-dong'),
    lop: require('./lop'),
  };
  let tongLoi = 0;
  // `veTuanTu` la ham dung chung de cac so do goi lai, khong phai mot hinh.
  const KHONG_PHAI_HINH = new Set(['veTuanTu']);
  for (const [ten, mod] of Object.entries(nhom)) {
    for (const [ham, fn] of Object.entries(mod)) {
      if (KHONG_PHAI_HINH.has(ham)) continue;
      const loi = soat(ten + '.' + ham, fn());
      const nhan = (ten + '.' + ham).padEnd(22);
      if (loi.length) {
        tongLoi += loi.length;
        console.log(`✗ ${nhan} ${loi.length} lỗi`);
        loi.slice(0, 12).forEach((x) => console.log('    - ' + x));
        if (loi.length > 12) console.log(`    ... và ${loi.length - 12} lỗi nữa`);
      } else {
        console.log(`✓ ${nhan} đạt`);
      }
    }
  }
  console.log(tongLoi ? `\nTổng ${tongLoi} lỗi hình học` : '\nKhông có lỗi hình học');
  process.exit(tongLoi ? 1 : 0);
}

module.exports = { soat };

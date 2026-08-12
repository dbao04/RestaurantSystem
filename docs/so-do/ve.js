/**
 * Bo ve SVG dung chung cho so do use case (UML) va so do quy trinh (BPMN).
 *
 * Tat ca hinh deu ve bang toa do tuyet doi tren mot luoi co dinh, khong dung
 * thu vien nao - nho vay SVG xuat ra tu chua duoc trong trang, khong phu thuoc
 * mang, va scale khong vo net.
 */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ds = (x) => (Array.isArray(x) ? x : [x]);

/* ------------------------------------------------------------------ chung */

/** Dinh nghia dau mui ten. Moi hinh mot bo id rieng vi id la pham vi tai lieu. */
function dinhNghia(id) {
  return `<defs>
    <marker id="mui-${id}" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
    </marker>
    <marker id="mui-rong-${id}" viewBox="0 0 12 12" refX="11" refY="6"
            markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <path d="M0,0 L12,6 L0,12 z" fill="none" stroke="currentColor" stroke-width="1.4"/>
    </marker>
  </defs>`;
}

function khung(id, w, h, nhan, than) {
  return `<svg class="hinh" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(nhan)}"
     xmlns="http://www.w3.org/2000/svg">${dinhNghia(id)}${than}</svg>`;
}

/* -------------------------------------------------------------- use case */

/**
 * Tac nhan ve kieu nguoi que UML.
 * (x, y) la goc tren cua dau; DIEM NEO de noi duong lien ket la (x, y + 31).
 */
function tacNhan(x, y, nhan, { lop = '', nhanTren = false, nhanTrai = false, nhanPhai = false } = {}) {
  const l = ds(nhan);
  // Ba cho dat ten, chon theo huong cac duong lien ket toa ra:
  //   duoi chan  - mac dinh, hop khi chi co vai duong
  //   tren dau   - khi cac duong deu di xuong
  //   ben trai   - khi duong toa ra CA len va xuong ve phia phai (quat lon):
  //                luc do tren dau lan duoi chan deu bi duong cat qua chu.
  const chu = l
    .map((t, i) => {
      if (nhanTrai || nhanPhai) {
        const yy = y + 35 - (l.length - 1) * 7 + i * 14;
        const neo = nhanTrai ? 'end' : 'start';
        const xx = nhanTrai ? x - 24 : x + 24;
        return `<text class="tx-tn" style="text-anchor:${neo}" x="${xx}" y="${yy}">${esc(t)}</text>`;
      }
      const yy = nhanTren ? y - 12 - (l.length - 1 - i) * 14 : y + 88 + i * 14;
      return `<text class="tx-tn" x="${x}" y="${yy}">${esc(t)}</text>`;
    })
    .join('');
  return `<g class="tn ${lop}">
    <circle cx="${x}" cy="${y + 11}" r="11"/>
    <line x1="${x}" y1="${y + 22}" x2="${x}" y2="${y + 48}"/>
    <line x1="${x - 17}" y1="${y + 31}" x2="${x + 17}" y2="${y + 31}"/>
    <line x1="${x}" y1="${y + 48}" x2="${x - 13}" y2="${y + 70}"/>
    <line x1="${x}" y1="${y + 48}" x2="${x + 13}" y2="${y + 70}"/>
    ${chu}
  </g>`;
}

/** Tac nhan phu / he thong ngoai: ve bang hop co khuon mau <<he thong>>. */
function heThongNgoai(cx, cy, nhan, w = 168) {
  const l = ds(nhan);
  const h = 26 + l.length * 15;
  return `<g class="ht-ngoai">
    <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="3"/>
    <text class="tx-khuon" x="${cx}" y="${cy - h / 2 + 15}">&#171;h&#7879; th&#7889;ng ngo&#224;i&#187;</text>
    ${l.map((t, i) => `<text class="tx-ht" x="${cx}" y="${cy - h / 2 + 31 + i * 15}">${esc(t)}</text>`).join('')}
  </g>`;
}

/** Mot ca su dung: hinh e-lip, chu can giua, tu xuong dong theo mang. */
function ucElip(cx, cy, dong, { rx = 150, ry = 28, lop = '' } = {}) {
  const l = ds(dong);
  const y0 = cy + 5 - (l.length - 1) * 8;
  return `<g class="uc ${lop}">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>
    ${l.map((t, i) => `<text class="tx-uc" x="${cx}" y="${y0 + i * 16}">${esc(t)}</text>`).join('')}
  </g>`;
}

/** Bien he thong (system boundary). */
function bienHeThong(x, y, w, h, ten) {
  return `<g class="bien">
    <rect class="khung-bien" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
    <text class="tx-bien" x="${x + w / 2}" y="${y + 26}">${esc(ten)}</text>
  </g>`;
}

/** Lien ket tac nhan - ca su dung (duong lien tuc, khong mui ten). */
const lienKet = (x1, y1, x2, y2) =>
  `<line class="lk" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

/** Quan he <<include>> / <<extend>>: mui ten net dut. */
function quanHe(x1, y1, x2, y2, khuonMau, id, lech = { x: 0, y: -7 }) {
  const mx = (x1 + x2) / 2 + lech.x;
  const my = (y1 + y2) / 2 + lech.y;
  return `<g class="qh">
    <line class="lk-dut" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#mui-${id})"/>
    <text class="tx-khuon" x="${mx}" y="${my}">&#171;${esc(khuonMau)}&#187;</text>
  </g>`;
}

/* ------------------------------------------------------------------ BPMN */

const LAN_CAO = 150;
const NHAN_RONG = 46;

/** Mot lan (hang boi) cua pool BPMN. */
function lan(y, ten, w, cao = LAN_CAO) {
  return `<g>
    <rect class="lan" x="${NHAN_RONG}" y="${y}" width="${w - NHAN_RONG}" height="${cao}"/>
    <rect class="lan-nhan" x="0" y="${y}" width="${NHAN_RONG}" height="${cao}"/>
    <text class="tx-lan" transform="translate(23,${y + cao / 2}) rotate(-90)">${esc(ten)}</text>
  </g>`;
}

/* Kich thuoc cong viec BPMN - cac ham do canh ben duoi deu suy tu day. */
const VIEC_RONG = 138;
const VIEC_CAO = 54;

/** Cong viec (task). `lop` = 'tu-dong' cho buoc he thong tu chay. */
function viec(cx, cy, dong, lop = '') {
  const l = ds(dong);
  const y0 = cy + 4.5 - (l.length - 1) * 7;
  const bieuTuong = lop.includes('tu-dong')
    ? `<g class="bt"><rect x="${cx - VIEC_RONG / 2 + 6}" y="${cy - 21}" width="11" height="11" rx="1.5"/>
       <line x1="${cx - VIEC_RONG / 2 + 8.5}" y1="${cy - 18}" x2="${cx - VIEC_RONG / 2 + 14.5}" y2="${cy - 18}"/>
       <line x1="${cx - VIEC_RONG / 2 + 8.5}" y1="${cy - 15.5}" x2="${cx - VIEC_RONG / 2 + 14.5}" y2="${cy - 15.5}"/></g>`
    : '';
  return `<g class="viec ${lop}">
    <rect x="${cx - VIEC_RONG / 2}" y="${cy - VIEC_CAO / 2}" width="${VIEC_RONG}" height="${VIEC_CAO}" rx="7"/>
    ${bieuTuong}
    ${l.map((t, i) => `<text class="tx-viec" x="${cx}" y="${y0 + i * 14}">${esc(t)}</text>`).join('')}
  </g>`;
}

/**
 * Su kien: loai = 'dau' | 'giua' | 'cuoi'.
 * `nhanTren` dat ten len tren vong tron - dung khi luong di vao / di ra theo
 * chieu doc, vi luc do cho ben duoi da co duong ve di qua.
 */
function suKien(cx, cy, nhan, loai = 'dau', nhanTren = false) {
  const l = ds(nhan);
  const vong =
    loai === 'giua'
      ? `<circle cx="${cx}" cy="${cy}" r="19"/><circle cx="${cx}" cy="${cy}" r="15"/>`
      : `<circle cx="${cx}" cy="${cy}" r="19"/>`;
  const thu =
    loai === 'giua'
      ? `<path class="thu" d="M${cx - 8},${cy - 5} h16 v10 h-16 z M${cx - 8},${cy - 5} l8,6 l8,-6"/>`
      : '';
  const chu = l
    .map((t, i) => {
      const yy = nhanTren ? cy - 30 - (l.length - 1 - i) * 13 : cy + 34 + i * 13;
      return `<text class="tx-sk" x="${cx}" y="${yy}">${esc(t)}</text>`;
    })
    .join('');
  return `<g class="sk sk-${loai}">${vong}${thu}${chu}</g>`;
}

/** Cong re nhanh (gateway XOR). */
function cong(cx, cy, nhan, tren = true) {
  const l = ds(nhan);
  const y0 = tren ? cy - 32 - (l.length - 1) * 13 : cy + 40;
  return `<g class="cong">
    <polygon points="${cx},${cy - 24} ${cx + 24},${cy} ${cx},${cy + 24} ${cx - 24},${cy}"/>
    <line x1="${cx - 8}" y1="${cy - 8}" x2="${cx + 8}" y2="${cy + 8}"/>
    <line x1="${cx - 8}" y1="${cy + 8}" x2="${cx + 8}" y2="${cy - 8}"/>
    ${l.map((t, i) => `<text class="tx-sk" x="${cx}" y="${y0 + i * 13}">${esc(t)}</text>`).join('')}
  </g>`;
}

/** Luong trinh tu: danh sach diem [[x,y], ...] + nhan tuy chon. */
function luong(diem, id, nhan = null, viTriNhan = null, lop = '') {
  const d = diem.map((p) => p.join(',')).join(' ');
  const chu = nhan
    ? `<text class="tx-luong" x="${viTriNhan[0]}" y="${viTriNhan[1]}">${esc(nhan)}</text>`
    : '';
  return `<polyline class="luong ${lop}" points="${d}" marker-end="url(#mui-${id})"/>${chu}`;
}

/** Ghi chu dinh kem (text annotation). */
function ghiChu(x, y, dong, neo = null) {
  const l = ds(dong);
  const duong = neo
    ? `<line class="lk-dut" x1="${x}" y1="${y - 10}" x2="${neo[0]}" y2="${neo[1]}"/>`
    : '';
  return `<g class="ghi-chu">${duong}
    ${l.map((t, i) => `<text class="tx-ghi" x="${x}" y="${y + i * 13}">${esc(t)}</text>`).join('')}
  </g>`;
}

/* ============================ SO DO LOP & LUOC DO CSDL ==================== */

/**
 * Uoc luong be rong mot chuoi khi ve bang Segoe UI.
 *
 * Dung de TU TINH be rong hop lop / hop bang thay vi go tay: them mot thuoc
 * tinh dai hon la hop tu no rong ra, khong bao gio de chu tran ra ngoai vien.
 * Dau tieng Viet khong lam chu rong them nen bo qua khi dem.
 */
function rongChu(s, co = 11) {
  let n = 0;
  for (const k of String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')) {
    if ('WM@%'.includes(k)) n += 0.85;
    else if (k === ' ') n += 0.29;
    else if ('iljI.,:;|!\'`'.includes(k)) n += 0.31;
    else if (k >= 'A' && k <= 'Z') n += 0.66;
    else if (k >= '0' && k <= '9') n += 0.56;
    else n += 0.54;
  }
  return n * co;
}

const CAO_DONG = 16;          // chieu cao mot dong trong hop lop / hop bang
const CAO_DAU = 24;           // chieu cao ngan ten

/** Bon canh cua mot hop chu nhat - dung de noi duong ma khong phai nho so. */
const canhHop = (x, y, w, h) => ({
  trai: x, phai: x + w, tren: y, duoi: y + h,
  giuaX: x + w / 2, giuaY: y + h / 2,
});

/**
 * Mot lop trong so do lop: hop ba ngan (ten - thuoc tinh - phuong thuc).
 *
 * Tra ve OBJECT chu khong phai chuoi, vi nguoi goi con can toa do canh hop de
 * noi quan he. Dung: `const A = v.hopLop(...); s += A.svg; ... A.canh.phai`.
 */
function hopLop(x, y, ten, thuocTinh = [], phuongThuc = [], { w = null, khuonMau = null, lop = '' } = {}) {
  const dong = [...thuocTinh, ...phuongThuc];
  const rong = w || Math.max(
    132,
    Math.ceil(rongChu(ten, 12.5)) + 30,
    ...dong.map((t) => Math.ceil(rongChu(t, 10.5)) + 22),
    khuonMau ? Math.ceil(rongChu(khuonMau, 10)) + 26 : 0
  );
  const caoDau = CAO_DAU + (khuonMau ? 13 : 0);
  const cao = caoDau + (thuocTinh.length + phuongThuc.length) * CAO_DONG +
              (thuocTinh.length ? 6 : 0) + (phuongThuc.length ? 6 : 0);

  let y0 = y + caoDau;
  const veNgan = (ds_, dam) => {
    if (!ds_.length) return '';
    const g = `<line x1="${x}" y1="${y0}" x2="${x + rong}" y2="${y0}"/>` +
      ds_.map((t, i) => `<text class="tx-lop${dam ? ' pt' : ''}" x="${x + 11}" y="${y0 + 12 + i * CAO_DONG}">${esc(t)}</text>`).join('');
    y0 += ds_.length * CAO_DONG + 6;
    return g;
  };

  const than =
    `<rect class="vien" x="${x}" y="${y}" width="${rong}" height="${cao}" rx="3"/>` +
    `<rect class="ngan-ten" x="${x}" y="${y}" width="${rong}" height="${caoDau}" rx="3"/>` +
    (khuonMau ? `<text class="tx-khuon" x="${x + rong / 2}" y="${y + 14}">&#171;${esc(khuonMau)}&#187;</text>` : '') +
    `<text class="tx-lop-ten" x="${x + rong / 2}" y="${y + caoDau - 8}">${esc(ten)}</text>` +
    veNgan(thuocTinh, false) + veNgan(phuongThuc, true);

  return {
    svg: `<g class="lop ${lop}">${than}</g>`,
    x, y, w: rong, h: cao, canh: canhHop(x, y, rong, cao),
  };
}

/**
 * Mot bang trong luoc do CSDL.
 *
 * `cot` la mang chuoi, co the mo dau bang 'PK ' hoac 'FK ' de danh dau khoa -
 * phan danh dau duoc tach ra ve rieng bang mau nhan, phan con lai la ten cot.
 */
function hopBang(x, y, ten, cot = [], { w = null, lop = '' } = {}) {
  const tach = cot.map((c) => {
    const m = /^(PK|FK|PF)\s+(.*)$/.exec(String(c));
    return m ? { khoa: m[1], ten: m[2] } : { khoa: '', ten: String(c) };
  });
  const rong = w || Math.max(
    124,
    Math.ceil(rongChu(ten, 12)) + 26,
    ...tach.map((c) => Math.ceil(rongChu(c.ten, 10.5)) + (c.khoa ? 46 : 24))
  );
  const cao = CAO_DAU + tach.length * CAO_DONG + 6;

  const than =
    `<rect class="vien" x="${x}" y="${y}" width="${rong}" height="${cao}" rx="3"/>` +
    `<rect class="ngan-ten" x="${x}" y="${y}" width="${rong}" height="${CAO_DAU}" rx="3"/>` +
    `<text class="tx-bang-ten" x="${x + rong / 2}" y="${y + 16}">${esc(ten)}</text>` +
    `<line x1="${x}" y1="${y + CAO_DAU}" x2="${x + rong}" y2="${y + CAO_DAU}"/>` +
    tach.map((c, i) => {
      const yy = y + CAO_DAU + 13 + i * CAO_DONG;
      const nhan = c.khoa
        ? `<text class="tx-khoa" x="${x + 8}" y="${yy}">${esc(c.khoa)}</text>`
        : '';
      return nhan + `<text class="tx-cot" x="${x + (c.khoa ? 30 : 10)}" y="${yy}">${esc(c.ten)}</text>`;
    }).join('');

  return {
    svg: `<g class="bang ${lop}">${than}</g>`,
    x, y, w: rong, h: cao, canh: canhHop(x, y, rong, cao),
  };
}

/**
 * Duong quan he giua hai bang (ky phap chan quaa - crow's foot).
 *
 * `diem` la duong gap khuc do nguoi goi dat; huong cua dau mut suy tu doan
 * dau va doan cuoi nen khong phai khai bao them. `dau` / `cuoi` nhan gia tri
 * 'mot' (mot ban ghi) hoac 'nhieu' (nhieu ban ghi).
 */
function noiBang(diem, { dau = 'mot', cuoi = 'nhieu', nhan = null, viTriNhan = null } = {}) {
  const d = diem.map((p) => p.join(',')).join(' ');
  const huong = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  };
  // `hDau` va `hCuoi` deu la vector TRO RA NGOAI hop, nen dau mut ve theo dung
  // chieu do - ve nguoc lai la ky hieu nam de len ten cot ben trong hop.
  const mut = (p, [hx, hy], loai) => {
    const L = 11, R = 7;
    const gx = hx, gy = hy;                // huong tro ra ngoai hop
    if (loai === 'nhieu') {
      const [px, py] = [-gy, gx];          // vector vuong goc
      return [0, 1, -1].map((k) =>
        `<line x1="${p[0]}" y1="${p[1]}" x2="${p[0] + gx * L + px * R * k}" y2="${p[1] + gy * L + py * R * k}"/>`
      ).join('');
    }
    const [px, py] = [-gy, gx];
    return `<line x1="${p[0] + gx * L - px * R}" y1="${p[1] + gy * L - py * R}" ` +
           `x2="${p[0] + gx * L + px * R}" y2="${p[1] + gy * L + py * R}"/>`;
  };
  const hDau = huong(diem[0], diem[1]);
  const hCuoi = huong(diem[diem.length - 2], diem[diem.length - 1]).map((k) => -k);
  const chu = nhan
    ? `<text class="tx-boi" x="${viTriNhan[0]}" y="${viTriNhan[1]}">${esc(nhan)}</text>`
    : '';
  return `<g class="noi-bang">
    <polyline class="qh-lop" points="${d}"/>
    ${mut(diem[0], hDau, dau)}${mut(diem[diem.length - 1], hCuoi, cuoi)}${chu}
  </g>`;
}

/**
 * Quan he giua hai lop trong so do lop.
 *
 * `kieu`: 'ket-hop' (duong lien), 'phu-thuoc' (net dut co mui ten),
 * 'gop' (hinh thoi rong - aggregation), 'cau-thanh' (hinh thoi dac - composition).
 */
function quanHeLop(diem, id, { kieu = 'ket-hop', nhan = null, viTriNhan = null, boi = null } = {}) {
  const d = diem.map((p) => p.join(',')).join(' ');
  const [a, b] = [diem[0], diem[1]];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const thoi = (dac) => {
    const L = 16, R = 6;
    const p1 = [a[0], a[1]];
    const p2 = [a[0] + ux * L / 2 + px * R, a[1] + uy * L / 2 + py * R];
    const p3 = [a[0] + ux * L, a[1] + uy * L];
    const p4 = [a[0] + ux * L / 2 - px * R, a[1] + uy * L / 2 - py * R];
    return `<polygon class="thoi ${dac ? 'dac' : ''}" points="${[p1, p2, p3, p4].map((q) => q.join(',')).join(' ')}"/>`;
  };
  const dauMut = kieu === 'gop' ? thoi(false) : kieu === 'cau-thanh' ? thoi(true) : '';
  const lopDuong = kieu === 'phu-thuoc' ? 'lk-dut' : 'qh-lop';
  const mui = kieu === 'phu-thuoc' ? ` marker-end="url(#mui-${id})"` : '';
  const chu = nhan
    ? `<text class="tx-boi" x="${viTriNhan[0]}" y="${viTriNhan[1]}">${esc(nhan)}</text>` : '';
  const soBoi = (boi || [])
    .map(([t, x, y]) => `<text class="tx-boi" x="${x}" y="${y}">${esc(t)}</text>`).join('');
  return `<g class="qh-lop-g"><polyline class="${lopDuong}" points="${d}" fill="none"${mui}/>${dauMut}${chu}${soBoi}</g>`;
}

/* ============================== SO DO TUAN TU ============================= */

const DT_CAO = 40;

/** Dau doi tuong (dinh danh) tren so do tuan tu. */
function doiTuong(cx, y, ten, { w = null, lop = '' } = {}) {
  const l = ds(ten);
  const rong = w || Math.max(112, ...l.map((t) => Math.ceil(rongChu(t, 11.5)) + 26));
  const cao = Math.max(DT_CAO, 16 + l.length * 15);
  const y0 = y + cao / 2 + 4.5 - (l.length - 1) * 7.5;
  return {
    svg: `<g class="doi-tuong ${lop}">
      <rect x="${cx - rong / 2}" y="${y}" width="${rong}" height="${cao}" rx="4"/>
      ${l.map((t, i) => `<text class="tx-dt" x="${cx}" y="${y0 + i * 15}">${esc(t)}</text>`).join('')}
    </g>`,
    cx, w: rong, h: cao, duoi: y + cao,
  };
}

/** Duong doi (lifeline) net dut chay suot chieu cao so do. */
const duongDoi = (cx, y1, y2) =>
  `<line class="duong-doi" x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}"/>`;

/** Thanh kich hoat (activation bar) tren duong doi. */
const kichHoat = (cx, y1, y2, lech = 0) =>
  `<rect class="kich-hoat" x="${cx - 6 + lech}" y="${y1}" width="12" height="${Math.max(6, y2 - y1)}"/>`;

/**
 * Thong diep giua hai doi tuong.
 *   loai: 'goi'  mui ten net lien (goi dong bo)
 *         'tra'  mui ten net dut  (tra ket qua)
 *         'tu'   mui ten quay lai chinh no (self-call)
 */
function thongDiep(x1, x2, y, nhan, id, { loai = 'goi', lechNhan = -6 } = {}) {
  const l = ds(nhan);
  const lopD = loai === 'tra' ? 'tin-tra' : 'tin';
  if (loai === 'tu') {
    const w = 34;
    const chu = l.map((t, i) => `<text class="tx-tin" style="text-anchor:start" x="${x1 + w + 8}" y="${y + 4 + i * 12}">${esc(t)}</text>`).join('');
    return `<g class="td"><polyline class="${lopD}" points="${x1 + 6},${y - 9} ${x1 + w},${y - 9} ${x1 + w},${y + 9} ${x1 + 8},${y + 9}"
      marker-end="url(#mui-${id})"/>${chu}</g>`;
  }
  const giua = (x1 + x2) / 2;
  const chu = l
    .map((t, i) => `<text class="tx-tin" x="${giua}" y="${y + lechNhan - (l.length - 1 - i) * -12}">${esc(t)}</text>`)
    .join('');
  return `<g class="td">
    <line class="${lopD}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-end="url(#mui-${id})"/>
    ${chu}
  </g>`;
}

/**
 * Khung tuong tac (combined fragment): alt / opt / loop / par.
 * `chia` la danh sach toa do y ke vach ngan giua cac nhanh cua alt.
 */
function khoiTuongTac(x, y, w, h, ten, dieuKien, { chia = [] } = {}) {
  const rongThe = Math.max(38, Math.ceil(rongChu(ten, 10)) + 18);
  return `<g class="khoi">
    <rect class="khung-tt" x="${x}" y="${y}" width="${w}" height="${h}"/>
    <path class="the" d="M${x},${y} h${rongThe} l10,14 v6 h-${rongThe + 10} z"/>
    <text class="tx-khoi" style="text-anchor:start" x="${x + 7}" y="${y + 14}">${esc(ten)}</text>
    ${dieuKien ? `<text class="tx-dk" style="text-anchor:start" x="${x + rongThe + 22}" y="${y + 15}">[${esc(dieuKien)}]</text>` : ''}
    ${chia.map(([yy, dk]) => `<line class="chia" x1="${x}" y1="${yy}" x2="${x + w}" y2="${yy}"/>
      <text class="tx-dk" style="text-anchor:start" x="${x + 8}" y="${yy + 13}">[${esc(dk)}]</text>`).join('')}
  </g>`;
}

/* ============================= SO DO HOAT DONG =========================== */

/** Nut khoi dau: vong tron dac. */
const nutDau = (cx, cy) => `<g class="nut-dau"><circle cx="${cx}" cy="${cy}" r="10"/></g>`;

/** Nut ket thuc: vong tron dac long trong vong tron rong. */
const nutCuoi = (cx, cy) =>
  `<g class="nut-cuoi"><circle class="ngoai" cx="${cx}" cy="${cy}" r="12"/><circle class="trong" cx="${cx}" cy="${cy}" r="7"/></g>`;

/**
 * Hanh dong: hop bo goc tron.
 *
 * Tra ve object (khong phai chuoi) vi nguoi goi con can toa do bon canh de noi
 * luong: `const a = v.hanhDong(...); s += a.svg; ... a.canh.duoi`.
 */
function hanhDong(cx, cy, dong, { w = null, lop = '' } = {}) {
  const l = ds(dong);
  const rong = w || Math.max(126, ...l.map((t) => Math.ceil(rongChu(t, 11)) + 26));
  const cao = Math.max(38, 16 + l.length * 14);
  const y0 = cy + 4.5 - (l.length - 1) * 7;
  const x = cx - rong / 2, y = cy - cao / 2;
  return {
    svg: `<g class="hd ${lop}">
      <rect x="${x}" y="${y}" width="${rong}" height="${cao}" rx="13"/>
      ${l.map((t, i) => `<text class="tx-viec" x="${cx}" y="${y0 + i * 14}">${esc(t)}</text>`).join('')}
    </g>`,
    cx, cy, x, y, w: rong, h: cao, canh: canhHop(x, y, rong, cao),
  };
}

/** Nut quyet dinh / hoi tu: hinh thoi tran (khong co dau X nhu cong BPMN). */
function quyetDinh(cx, cy, nhan, { tren = true, r = 26 } = {}) {
  const l = ds(nhan || []);
  const y0 = tren ? cy - r - 10 - (l.length - 1) * 13 : cy + r + 22;
  return `<g class="qd">
    <polygon points="${cx},${cy - r} ${cx + r + 6},${cy} ${cx},${cy + r} ${cx - r - 6},${cy}"/>
    ${l.map((t, i) => `<text class="tx-sk" x="${cx}" y="${y0 + i * 13}">${esc(t)}</text>`).join('')}
  </g>`;
}

/** Thanh dong bo (fork / join). `doc = true` cho thanh dung. */
const thanhDongBo = (cx, cy, dai, doc = false) =>
  doc
    ? `<rect class="thanh-db" x="${cx - 3}" y="${cy - dai / 2}" width="6" height="${dai}" rx="2"/>`
    : `<rect class="thanh-db" x="${cx - dai / 2}" y="${cy - 3}" width="${dai}" height="6" rx="2"/>`;

/** Lan doc (swimlane theo cot) cho so do hoat dong. */
function lanDoc(x, y, w, h, ten) {
  return `<g class="lan-doc">
    <rect class="lan" x="${x}" y="${y + 28}" width="${w}" height="${h - 28}"/>
    <rect class="lan-nhan" x="${x}" y="${y}" width="${w}" height="28"/>
    <text class="tx-lan" x="${x + w / 2}" y="${y + 18}">${esc(ten)}</text>
  </g>`;
}

/**
 * Quy tac to mau / co chu cho moi ky hieu trong SVG.
 *
 * Dung o HAI noi: nhung vao trang HTML (o do cac bien --* lay tu theme cua
 * trang), va nhung vao tung file SVG roi (o do bien duoc dinh nghia ngay tren
 * the <svg> bang bang mau sang, de anh chen vao Word van dung mau).
 */
const CSS_KY_HIEU = `
text{fill:currentColor;font-family:var(--sans);}
.tx-uc{font-size:12.5px;text-anchor:middle;}
.tx-tn{font-size:12.5px;font-weight:650;text-anchor:middle;}
.tx-bien{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-anchor:middle;fill:var(--muc-mo);}
.tx-khuon{font-size:10.5px;text-anchor:middle;fill:var(--muc-mo);font-style:italic;}
.tx-ht{font-size:12px;text-anchor:middle;}
.tx-ghi{font-size:11px;fill:var(--muc-mo);font-style:italic;}
.tx-viec{font-size:11px;text-anchor:middle;}
.tx-sk{font-size:11px;text-anchor:middle;fill:var(--muc-mo);}
.tx-lan{font-size:11.5px;font-weight:700;text-anchor:middle;letter-spacing:.04em;}
.tx-luong{font-size:10.5px;text-anchor:middle;fill:var(--muc-mo);}
.tn circle,.tn line{fill:none;stroke:currentColor;stroke-width:1.5;}
.uc ellipse{fill:var(--giay);stroke:currentColor;stroke-width:1.25;}
.uc-phu ellipse{fill:var(--nhan-nen);stroke:var(--nhan);}
.uc-ngoai ellipse{fill:var(--giay);stroke:var(--nhan);stroke-width:1.5;stroke-dasharray:6 3.5;}
.uc-dn ellipse{fill:var(--nhan-nen);stroke:var(--nhan);stroke-width:1.6;}
.uc-dn .dn-ngan{stroke:var(--nhan);stroke-width:1;}
.goi rect{fill:none;stroke:var(--vien-dam);stroke-width:1.1;stroke-dasharray:3 3;}
.tx-goi{font-size:11px;font-weight:700;letter-spacing:.07em;fill:var(--nhan);}
.bien rect{fill:none;stroke:var(--vien-dam);stroke-width:1.2;}
.ht-ngoai rect{fill:var(--giay-2);stroke:var(--vien-dam);stroke-width:1.1;}
.lk{stroke:currentColor;stroke-width:1.05;fill:none;}
.lk-dut{stroke:currentColor;stroke-width:1.05;stroke-dasharray:5 4;fill:none;}
.lan{fill:none;stroke:var(--vien-dam);stroke-width:1;}
.lan-nhan{fill:var(--nhan-nen);stroke:var(--vien-dam);stroke-width:1;}
.viec rect{fill:var(--giay);stroke:currentColor;stroke-width:1.25;}
.viec.tu-dong rect{fill:var(--nhan-nen);stroke:var(--nhan);}
.bt rect,.bt line{fill:none;stroke:var(--nhan);stroke-width:1;}
.sk circle{fill:var(--giay);stroke:currentColor;stroke-width:1.6;}
.sk-cuoi circle{stroke-width:3.4;}
.thu{fill:none;stroke:currentColor;stroke-width:1.1;}
.cong polygon{fill:var(--giay);stroke:currentColor;stroke-width:1.25;}
.cong line{stroke:currentColor;stroke-width:1.25;}
.luong{fill:none;stroke:currentColor;stroke-width:1.2;}

/* --- so do lop va luoc do CSDL --- */
.tx-lop-ten{font-size:12.5px;font-weight:700;text-anchor:middle;}
.tx-bang-ten{font-size:12px;font-weight:700;text-anchor:middle;font-family:var(--mono-svg);}
.tx-lop{font-size:10.5px;}
.tx-lop.pt{font-style:italic;}
.tx-cot{font-size:10.5px;font-family:var(--mono-svg);}
.tx-khoa{font-size:9.5px;font-weight:700;fill:var(--nhan);}
.tx-boi{font-size:10px;fill:var(--muc-mo);text-anchor:middle;}
.lop rect.vien,.bang rect.vien{fill:var(--giay);stroke:currentColor;stroke-width:1.25;}
.lop rect.ngan-ten,.bang rect.ngan-ten{fill:var(--nhan-nen);stroke:currentColor;stroke-width:1.25;}
.lop line,.bang line{stroke:currentColor;stroke-width:1.1;}
.lop.phu rect.ngan-ten,.bang.phu rect.ngan-ten{fill:var(--giay-2);}
.qh-lop{stroke:currentColor;stroke-width:1.15;fill:none;}
.noi-bang line{stroke:currentColor;stroke-width:1.15;fill:none;}
.thoi{fill:var(--giay);stroke:currentColor;stroke-width:1.15;}
.thoi.dac{fill:currentColor;}

/* --- so do tuan tu --- */
.tx-dt{font-size:11.5px;font-weight:650;text-anchor:middle;}
.tx-tin{font-size:10.5px;text-anchor:middle;}
.tx-khoi{font-size:10px;font-weight:700;letter-spacing:.06em;}
.tx-dk{font-size:10px;font-style:italic;fill:var(--muc-mo);}
.doi-tuong rect{fill:var(--nhan-nen);stroke:var(--nhan);stroke-width:1.3;}
.doi-tuong.ngoai rect{fill:var(--giay-2);stroke:var(--vien-dam);}
.duong-doi{stroke:var(--vien-dam);stroke-width:1;stroke-dasharray:5 5;}
.kich-hoat{fill:var(--giay-2);stroke:currentColor;stroke-width:1;}
.tin{stroke:currentColor;stroke-width:1.25;fill:none;}
.tin-tra{stroke:currentColor;stroke-width:1.05;fill:none;stroke-dasharray:5 4;}
.khoi rect{fill:none;stroke:var(--vien-dam);stroke-width:1.1;}
.khoi path.the{fill:var(--giay-2);stroke:var(--vien-dam);stroke-width:1.1;}
.khoi line.chia{stroke:var(--vien-dam);stroke-width:1;stroke-dasharray:6 4;}

/* --- so do hoat dong --- */
.nut-dau circle{fill:currentColor;}
.nut-cuoi circle.ngoai{fill:none;stroke:currentColor;stroke-width:1.5;}
.nut-cuoi circle.trong{fill:currentColor;}
.hd rect{fill:var(--giay);stroke:currentColor;stroke-width:1.25;}
.hd.tu-dong rect{fill:var(--nhan-nen);stroke:var(--nhan);}
.qd polygon{fill:var(--giay);stroke:currentColor;stroke-width:1.25;}
.thanh-db{fill:currentColor;}`;

/** Bang mau sang, dung cho file SVG roi (in ra giay / chen vao Word). */
const BIEN_MAU_SANG = `
--sans:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;
--mono-svg:Consolas,"Cascadia Mono",ui-monospace,Menlo,monospace;
--giay:#ffffff; --giay-2:#e9efec; --muc:#141c1a; --muc-mo:#5b6b66;
--vien-dam:#a6b6b0; --nhan:#0f6b62; --nhan-nen:#e2efec;`;

/** Bien mot hinh thanh file SVG doc lap, tu chua mau va co chu. */
function fileSvg(svg) {
  return svg.replace(
    /^<svg /,
    '<svg xmlns:xlink="http://www.w3.org/1999/xlink" '
  ).replace(
    /(<svg[^>]*>)/,
    `$1<style>svg{${BIEN_MAU_SANG} color:var(--muc); background:var(--giay);}${CSS_KY_HIEU}</style>`
  );
}

/* Canh cua cac hinh BPMN - dung de noi luong ma khong phai nho so. */
const canh = {
  vTrai: (cx) => cx - VIEC_RONG / 2,
  vPhai: (cx) => cx + VIEC_RONG / 2,
  vTren: (cy) => cy - VIEC_CAO / 2,
  vDuoi: (cy) => cy + VIEC_CAO / 2,
  cTrai: (cx) => cx - 24,
  cPhai: (cx) => cx + 24,
  cTren: (cy) => cy - 24,
  cDuoi: (cy) => cy + 24,
  sk: 19,
};

module.exports = {
  esc, khung, tacNhan, heThongNgoai, ucElip, bienHeThong, lienKet, quanHe,
  lan, viec, suKien, cong, luong, ghiChu, canh, LAN_CAO, NHAN_RONG,
  VIEC_RONG, VIEC_CAO, CSS_KY_HIEU, fileSvg,
  // so do lop, luoc do CSDL, tuan tu, hoat dong
  rongChu, canhHop, hopLop, hopBang, noiBang, quanHeLop,
  doiTuong, duongDoi, kichHoat, thongDiep, khoiTuongTac, DT_CAO,
  nutDau, nutCuoi, hanhDong, quyetDinh, thanhDongBo, lanDoc,
};

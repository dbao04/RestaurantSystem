/**
 * SO DO USE CASE TONG QUAT - dung bo cuc kinh dien theo mau de bai.
 *
 * Dac diem cua bo cuc nay (khac han cach gom nhom truoc do):
 *   - MOT khung he thong duy nhat, tac nhan dung han ben ngoai, trai va phai.
 *   - Tac nhan co quan he KE THUA (generalization, mui ten tam giac rong):
 *       Khách hàng thành viên  --|>  Khách vãng lai
 *       sau chuc danh nhan vien --|>  Nhân viên chung
 *     Ke thua ve dung mot lan theo kieu "shared target": nhieu nhanh chum vao
 *     mot than roi mot mui ten duy nhat cham vao tac nhan cha.
 *   - "Đăng nhập" nam giua, mang diem mo rong (extension point) "Đăng xuất";
 *     moi ca su dung doi hoi phien dang nhap deu <<include>> ve no.
 *
 * Ca su dung cua Khách vãng lai KHONG include "Đăng nhập" - dung nhu he thong
 * that: quet ma QR goi mon tai ban chay duoc ma khong can tai khoan.
 */
const v = require('./ve');

/* ---------------------------------------------------------------- luoi ve */

const RX = 150;        // ban kinh ngang e-lip ca su dung
const RY = 20;
const BUOC = 52;       // khoang cach giua hai hang
const Y0 = 178;        // hang dau tien

const X_TN_TRAI = 140;   // tac nhan cot trai
const X_TN_PHAI = 1400;  // tac nhan cot phai
const CX_TRAI = 370;     // tam e-lip cot trai   (220 .. 520)
const CX_PHAI = 1160;    // tam e-lip cot phai   (1010 .. 1310)
const BIEN_X = 210;
const BIEN_W = 1120;     // khung he thong: 210 .. 1330
const X_THAN_KE_THUA = 1352; // than cua cay ke thua ben phai

const DN_CX = 765;       // "Đăng nhập"
const DN_RX = 116;
const DN_RY = 50;
const DX_CY = 104;       // "Đăng xuất"

/* ------------------------------------------------------------- noi dung */

/** Cot trai: [ten tac nhan, ke thua tac nhan nao, can dang nhap?, cac ca su dung] */
const TRAI = [
  {
    ten: ['Khách', 'vãng lai'],
    dangNhap: false,
    uc: [
      'Xem thực đơn, tìm món',
      'Xem tin tức, bài viết',
      'Quét mã QR gọi món tại bàn',
      'Đăng ký tài khoản',
    ],
  },
  {
    ten: ['Khách hàng', 'thành viên'],
    keThua: 0,
    uc: [
      'Quản lý thông tin cá nhân',
      'Quản lý giỏ hàng',
      'Đặt bàn trực tuyến',
      'Đặt cọc bằng mã VietQR',
      'Quản lý đơn đặt bàn',
      ['Đánh giá, bình luận sau khi', 'hoàn thành đơn hàng'],
      'Chat với nhân viên tư vấn',
      'Đổi điểm tích luỹ, áp mã giảm giá',
    ],
  },
  {
    ten: ['Kế toán'],
    keThuaNvChung: true,
    uc: [
      'Quản lý bảng lương',
      'Quản lý thu chi',
      'Quản lý nghỉ phép',
      'Quản lý email gửi khách',
      'Xem báo cáo kế toán',
    ],
  },
  {
    ten: ['Quản lý', 'nhà hàng'],
    keThuaNvChung: true,
    uc: [
      'Xem báo cáo doanh thu tổng',
      'Xem dashboard phân tích vận hành',
      'Dự báo lượt khách',
      'Dự báo nhu cầu nguyên liệu',
      'Khai phá luật kết hợp (Apriori)',
      'Xem đánh giá mô hình dự báo',
      'Quản lý nhân sự, phân quyền',
    ],
  },
  {
    ten: ['Quản trị', 'hệ thống'],
    uc: [
      'Quản lý danh mục, món ăn',
      'Quản lý bài viết',
      'Quản lý nhân viên, hợp đồng',
      ['Quản lý mã giảm giá,', 'phương thức thanh toán'],
      ['Cấu hình tài khoản nhận tiền,', 'khoá webhook'],
      'Quản lý cơ cấu tổ chức',
    ],
  },
];

/** Cot phai. Nhóm "Nhân viên chung" dat cuoi de cay ke thua chum xuong no. */
const PHAI = [
  {
    ten: ['Nhân viên', 'phục vụ'],
    keThuaNvChung: true,
    uc: [
      'Quản lý sơ đồ bàn',
      'Quản lý đơn đặt bàn',
      'Quản lý mã QR của bàn',
      'Mang món ra bàn',
      'Nhắn tin với khách hàng để tư vấn',
      'In phiếu đặt bàn',
    ],
  },
  {
    ten: ['Thu ngân'],
    keThuaNvChung: true,
    uc: [
      'Thanh toán cho khách hàng',
      'Sinh mã VietQR theo số tiền',
      'Xuất hoá đơn, in biên lai',
      'Hoàn tiền / huỷ phiên',
      'Đối soát giao dịch ngân hàng',
      'Chốt ca thu ngân',
    ],
  },
  {
    ten: ['Nhân viên', 'bếp'],
    keThuaNvChung: true,
    uc: [
      'Quản lý màn hình bếp (KDS)',
      'Quản lý loại món, món, combo',
      'Quản lý công thức, đơn vị tính',
      'Quản lý trang thiết bị bếp',
      'Chốt ca bếp',
    ],
  },
  {
    ten: ['Thủ kho'],
    keThuaNvChung: true,
    uc: [
      'Quản lý nguyên liệu, nhập kho',
      'Cảnh báo lô sắp hết hạn',
    ],
  },
  {
    ten: ['Nhân viên', 'chung'],
    laNvChung: true,
    uc: [
      'Xem lịch làm việc',
      'Đăng ký lịch làm việc',
      'Quản lý thông tin cá nhân',
      'Xem thông báo',
      'Chấm công bằng khuôn mặt',
      'Xin nghỉ phép',
      'Đổi mật khẩu',
    ],
  },
];

/* ------------------------------------------------------------------- ve */

/** Diem tren e-lip theo huong nhin ve (tx, ty). */
function tren(cx, cy, rx, ry, tx, ty) {
  const dx = tx - cx;
  const dy = ty - cy;
  const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
  return [Math.round(cx + dx * t), Math.round(cy + dy * t)];
}

/**
 * Diem dat nhan cua mot mui ten: cach goc `d` pixel DOC THEO duong, day len
 * tren duong `lech` pixel.
 *
 * Khong dung "lay diem tai hoanh do co dinh" vi cac mui ten toa ve mot tam:
 * duong cang doc thi tai cung mot hoanh do da chay cang xa, khien nhan cua cac
 * hang lien tiep dinh vao nhau. Do doc theo duong thi nhan giu dung khoang
 * cach hang, khong bao gio chong nhau.
 */
function diemNhan(x1, y1, x2, y2, d = 70, lech = 8) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return [
    Math.round(x1 + (dx / len) * d),
    Math.round(y1 + (dy / len) * d - lech),
  ];
}

function veCot(cot, { cx, xTacNhan, benTrai }) {
  const ket = { svg: '', hang: [], tacNhan: [] };
  let hang = 0;

  for (const nhom of cot) {
    const dau = hang;
    for (const mo of nhom.uc) {
      const cy = Y0 + hang * BUOC;
      ket.svg += v.ucElip(cx, cy, mo, { rx: RX, ry: RY });
      ket.hang.push({ cy, dangNhap: nhom.dangNhap !== false });
      hang++;
    }
    const cuoi = hang - 1;

    // Tac nhan dat giua khoi ca su dung cua chinh no.
    const neoY = (Y0 + dau * BUOC + Y0 + cuoi * BUOC) / 2;
    ket.svg += v.tacNhan(xTacNhan, neoY - 31, nhom.ten,
      benTrai ? { nhanTrai: true } : { nhanPhai: true });
    // Duong lien ket ket thuc o dinh e-lip phia tac nhan -> khong cat e-lip khac.
    const mep = benTrai ? cx - RX : cx + RX;
    for (let i = dau; i <= cuoi; i++) {
      ket.svg += v.lienKet(xTacNhan, neoY, mep, Y0 + i * BUOC);
    }
    ket.tacNhan.push({ ...nhom, neoY, x: xTacNhan });
  }
  return ket;
}

function tongQuatMau() {
  const id = 'uc0';
  const trai = veCot(TRAI, { cx: CX_TRAI, xTacNhan: X_TN_TRAI, benTrai: true });
  const phai = veCot(PHAI, { cx: CX_PHAI, xTacNhan: X_TN_PHAI, benTrai: false });

  const hangCuoi = Math.max(
    trai.hang[trai.hang.length - 1].cy,
    phai.hang[phai.hang.length - 1].cy
  );
  const bienY = 24;
  const bienH = hangCuoi + RY + 34 - bienY;
  const H = bienY + bienH + 74;   // chua duong ke thua chay vong duoi
  const W = 1500;

  const dnCy = Math.round(bienY + bienH / 2);

  let s = '';
  s += `<g class="bien"><rect x="${BIEN_X}" y="${bienY}" width="${BIEN_W}" height="${bienH}" rx="4"/></g>`;
  s += `<text class="tx-bien" x="${BIEN_X + BIEN_W / 2}" y="${bienY + 24}">HỆ THỐNG QUẢN LÝ NHÀ HÀNG THÔNG MINH</text>`;
  s += trai.svg + phai.svg;

  /* --- Đăng nhập (co diem mo rong) va Đăng xuất --- */
  s += `<g class="uc uc-dn">
    <ellipse cx="${DN_CX}" cy="${dnCy}" rx="${DN_RX}" ry="${DN_RY}"/>
    <text class="tx-uc" x="${DN_CX}" y="${dnCy - 20}">Đăng nhập</text>
    <line class="dn-ngan" x1="${DN_CX - 96}" y1="${dnCy - 8}" x2="${DN_CX + 96}" y2="${dnCy - 8}"/>
    <text class="tx-khuon" x="${DN_CX}" y="${dnCy + 8}">extension points</text>
    <text class="tx-uc" x="${DN_CX}" y="${dnCy + 26}">Đăng xuất</text>
  </g>`;
  s += v.ucElip(DN_CX, DX_CY, 'Đăng xuất', { rx: 82, ry: 28 });
  s += `<line class="lk-dut" x1="${DN_CX}" y1="${DX_CY + 28}" x2="${DN_CX}" y2="${dnCy - DN_RY}"
        marker-end="url(#mui-${id})"/>`;
  s += `<text class="tx-khuon" x="${DN_CX + 44}" y="${DX_CY + 92}">&#171;extend&#187;</text>`;

  /* --- <<include>> tu moi ca su dung can phien dang nhap ve "Đăng nhập" --- */
  const veInclude = (hang, mepX) => {
    let r = '';
    for (const { cy, dangNhap } of hang) {
      if (!dangNhap) continue;
      const [ex, ey] = tren(DN_CX, dnCy, DN_RX, DN_RY, mepX, cy);
      r += `<line class="lk-dut" x1="${mepX}" y1="${cy}" x2="${ex}" y2="${ey}"
            marker-end="url(#mui-${id})"/>`;
      const [nx, ny] = diemNhan(mepX, cy, ex, ey);
      r += `<text class="tx-khuon" x="${nx}" y="${ny}">&#171;include&#187;</text>`;
    }
    return r;
  };
  s += veInclude(trai.hang, CX_TRAI + RX);
  s += veInclude(phai.hang, CX_PHAI - RX);

  /* --- Ke thua giua cac tac nhan --- */
  const mui = `marker-end="url(#mui-rong-${id})"`;

  // Khách hàng thành viên --|> Khách vãng lai (canh nhau, mot duong doc)
  const cha = trai.tacNhan[0];
  const con = trai.tacNhan[1];
  s += `<line class="lk" x1="${con.x}" y1="${con.neoY - 31}" x2="${cha.x}" y2="${cha.neoY + 39}" ${mui}/>`;

  // Cay ke thua "Nhân viên chung": mot than doc, nhieu nhanh, mot mui ten.
  const nvChung = phai.tacNhan.find((t) => t.laNvChung);
  const conNv = [
    ...phai.tacNhan.filter((t) => t.keThuaNvChung),
    ...trai.tacNhan.filter((t) => t.keThuaNvChung),
  ];
  const yDuoi = [H - 46, H - 26];   // hai duong vong duoi cho tac nhan cot trai
  let iDuoi = 0;
  let thanDayNhat = nvChung.neoY;

  for (const c of conNv) {
    if (c.x === X_TN_PHAI) {
      // Cung cot: re ngang vao than
      s += `<polyline class="lk" points="${c.x - 20},${c.neoY} ${X_THAN_KE_THUA},${c.neoY}"/>`;
      thanDayNhat = Math.max(thanDayNhat, c.neoY);
    } else {
      // Cot trai: vong theo le duoi khung roi nhap vao than
      const yv = yDuoi[iDuoi];
      const xv = 40 + iDuoi * 16;
      s += `<polyline class="lk" points="${c.x - 22},${c.neoY} ${xv},${c.neoY} ${xv},${yv} ${X_THAN_KE_THUA},${yv}"/>`;
      thanDayNhat = Math.max(thanDayNhat, yv);
      iDuoi++;
    }
  }
  s += `<line class="lk" x1="${X_THAN_KE_THUA}" y1="${nvChung.neoY}" x2="${X_THAN_KE_THUA}" y2="${thanDayNhat}"/>`;
  s += `<line class="lk" x1="${X_THAN_KE_THUA}" y1="${nvChung.neoY}" x2="${nvChung.x + 20}" y2="${nvChung.neoY}" ${mui}/>`;

  const soCa = trai.hang.length + phai.hang.length + 2;
  return v.khung(
    id, W, H,
    `Sơ đồ use case tổng quát: ${soCa} ca sử dụng, chín tác nhân với quan hệ kế thừa, mọi chức năng cần phiên đăng nhập đều include về ca sử dụng Đăng nhập ở giữa`,
    s
  );
}

module.exports = { tongQuatMau, TRAI, PHAI };

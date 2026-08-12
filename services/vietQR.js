/**
 * VIETQR - Sinh ma QR chuyen khoan ngan hang theo chuan EMVCo / NAPAS 247.
 *
 * Tai sao tu sinh chuoi QR thay vi goi API img.vietqr.io:
 *   1. Khong phu thuoc mang ngoai. Hoi dong cham co the ngat Internet, may
 *      demo co the khong ra duoc Internet - goi API ngoai la mat trang.
 *   2. Khong can dang ky merchant voi bat ky cong thanh toan nao. Ma sinh ra
 *      la ma chuyen khoan lien ngan hang 24/7 thong thuong, app ngan hang nao
 *      cung quet duoc.
 *   3. Khong lo ro so tai khoan sang ben thu ba.
 *
 * ---------------------------------------------------------------------------
 * CAU TRUC MOT PAYLOAD EMVCo
 *
 * Toan bo ma QR la mot chuoi ASCII gom nhieu truong noi tiep nhau, moi truong
 * viet theo dang TLV: <ID 2 ky tu><DO DAI 2 ky tu><NOI DUNG>.
 * Truong long nhau duoc thi noi dung lai la mot chuoi TLV con.
 *
 *   00 02 01                       Phien ban payload, luon la "01"
 *   01 02 12                       11 = QR tinh (khong kem so tien)
 *                                  12 = QR dong (kem so tien) <- ta dung cai nay
 *   38 xx                          Thong tin don vi thu huong (NAPAS)
 *      00 10 A000000727              GUID cua NAPAS, co dinh
 *      01 xx                         Dinh danh ben thu huong
 *         00 06 <BIN>                  Ma ngan hang 6 so
 *         01 xx <so tai khoan>
 *      02 08 QRIBFTTA                Dich vu: chuyen nhanh den TAI KHOAN
 *                                    (QRIBFTTC neu chuyen den so THE)
 *   53 03 704                      Ma tien te VND theo ISO 4217
 *   54 xx <so tien>                Chi co o QR dong
 *   58 02 VN                       Ma quoc gia
 *   62 xx                          Du lieu bo sung
 *      08 xx <noi dung CK>           <- ma doi soat cua ta nam o day
 *   63 04 <CRC>                    Kiem tra du CRC-16, tinh tren TOAN BO
 *                                  chuoi phia truoc KE CA "6304"
 *
 * THU TU CAC TRUONG KHONG DUOC DAO. Nhieu app ngan hang doc tuan tu, dao thu
 * tu la bao "ma khong hop le".
 * ---------------------------------------------------------------------------
 */

/** Ma ngan hang -> BIN 6 so do NAPAS cap. Dung cho truong 38.01.00. */
const NGAN_HANG = {
  VCB:      { bin: '970436', ten: 'Vietcombank',        dayDu: 'NH TMCP Ngoại thương Việt Nam' },
  TCB:      { bin: '970407', ten: 'Techcombank',        dayDu: 'NH TMCP Kỹ thương Việt Nam' },
  MB:       { bin: '970422', ten: 'MB Bank',            dayDu: 'NH TMCP Quân đội' },
  ACB:      { bin: '970416', ten: 'ACB',                dayDu: 'NH TMCP Á Châu' },
  BIDV:     { bin: '970418', ten: 'BIDV',               dayDu: 'NH Đầu tư và Phát triển Việt Nam' },
  ICB:      { bin: '970415', ten: 'VietinBank',         dayDu: 'NH TMCP Công thương Việt Nam' },
  VBA:      { bin: '970405', ten: 'Agribank',           dayDu: 'NH NN&PTNT Việt Nam' },
  VPB:      { bin: '970432', ten: 'VPBank',             dayDu: 'NH TMCP Việt Nam Thịnh Vượng' },
  TPB:      { bin: '970423', ten: 'TPBank',             dayDu: 'NH TMCP Tiên Phong' },
  STB:      { bin: '970403', ten: 'Sacombank',          dayDu: 'NH TMCP Sài Gòn Thương Tín' },
  HDB:      { bin: '970437', ten: 'HDBank',             dayDu: 'NH TMCP Phát triển TP.HCM' },
  VIB:      { bin: '970441', ten: 'VIB',                dayDu: 'NH TMCP Quốc tế Việt Nam' },
  SHB:      { bin: '970443', ten: 'SHB',                dayDu: 'NH TMCP Sài Gòn - Hà Nội' },
  OCB:      { bin: '970448', ten: 'OCB',                dayDu: 'NH TMCP Phương Đông' },
  MSB:      { bin: '970426', ten: 'MSB',                dayDu: 'NH TMCP Hàng Hải' },
  SEAB:     { bin: '970440', ten: 'SeABank',            dayDu: 'NH TMCP Đông Nam Á' },
  EIB:      { bin: '970431', ten: 'Eximbank',           dayDu: 'NH TMCP Xuất Nhập khẩu Việt Nam' },
  LPB:      { bin: '970449', ten: 'LPBank',             dayDu: 'NH TMCP Lộc Phát Việt Nam' },
  NAB:      { bin: '970428', ten: 'Nam A Bank',         dayDu: 'NH TMCP Nam Á' },
  ABB:      { bin: '970425', ten: 'ABBANK',             dayDu: 'NH TMCP An Bình' },
  BAB:      { bin: '970409', ten: 'BacA Bank',          dayDu: 'NH TMCP Bắc Á' },
  PVCB:     { bin: '970412', ten: 'PVcomBank',          dayDu: 'NH TMCP Đại Chúng Việt Nam' },
  SCB:      { bin: '970429', ten: 'SCB',                dayDu: 'NH TMCP Sài Gòn' },
  VAB:      { bin: '970427', ten: 'VietABank',          dayDu: 'NH TMCP Việt Á' },
  VIETBANK: { bin: '970433', ten: 'VietBank',           dayDu: 'NH TMCP Việt Nam Thương Tín' },
  BVB:      { bin: '970438', ten: 'BaoViet Bank',       dayDu: 'NH TMCP Bảo Việt' },
  VCCB:     { bin: '970454', ten: 'BVBank',             dayDu: 'NH TMCP Bản Việt' },
  KLB:      { bin: '970452', ten: 'KienlongBank',       dayDu: 'NH TMCP Kiên Long' },
  PGB:      { bin: '970430', ten: 'PGBank',             dayDu: 'NH TMCP Thịnh vượng và Phát triển' },
  SGICB:    { bin: '970400', ten: 'SaigonBank',         dayDu: 'NH TMCP Sài Gòn Công Thương' },
  DOB:      { bin: '970406', ten: 'DongA Bank',         dayDu: 'NH TMCP Đông Á' },
  GPB:      { bin: '970408', ten: 'GPBank',             dayDu: 'NH TM TNHH MTV Dầu Khí Toàn Cầu' },
  NCB:      { bin: '970419', ten: 'NCB',                dayDu: 'NH TMCP Quốc Dân' },
  CBB:      { bin: '970444', ten: 'CBBank',             dayDu: 'NH TM TNHH MTV Xây dựng Việt Nam' },
  COOPBANK: { bin: '970446', ten: 'Co-opBank',          dayDu: 'NH Hợp tác xã Việt Nam' },
  VRB:      { bin: '970421', ten: 'VRB',                dayDu: 'NH Liên doanh Việt - Nga' },
  IVB:      { bin: '970434', ten: 'Indovina Bank',      dayDu: 'NH TNHH Indovina' },
  SHBVN:    { bin: '970424', ten: 'Shinhan Bank',       dayDu: 'NH TNHH MTV Shinhan Việt Nam' },
  WVN:      { bin: '970457', ten: 'Woori Bank',         dayDu: 'NH TNHH MTV Woori Việt Nam' },
  HSBC:     { bin: '458761', ten: 'HSBC',               dayDu: 'NH TNHH MTV HSBC Việt Nam' },
  SCVN:     { bin: '970410', ten: 'Standard Chartered', dayDu: 'NH TNHH MTV Standard Chartered VN' },
  PBVN:     { bin: '970439', ten: 'Public Bank',        dayDu: 'NH TNHH MTV Public Việt Nam' },
  HLBVN:    { bin: '970442', ten: 'Hong Leong Bank',    dayDu: 'NH TNHH MTV Hong Leong Việt Nam' },
  CAKE:     { bin: '546034', ten: 'CAKE by VPBank',     dayDu: 'NH số CAKE by VPBank' },
  Ubank:    { bin: '546035', ten: 'Ubank by VPBank',    dayDu: 'NH số Ubank by VPBank' },
  TIMO:     { bin: '963388', ten: 'Timo',               dayDu: 'NH số Timo by BVBank' },
  VTLMONEY: { bin: '971005', ten: 'Viettel Money',      dayDu: 'Tổng CT Dịch vụ số Viettel' },
  VNPTMONEY:{ bin: '971011', ten: 'VNPT Money',         dayDu: 'Tổng CT Dịch vụ viễn thông VNPT' },
};

/** Dich vu chuyen tien nhanh NAPAS. TA = den tai khoan, TC = den so the. */
const DICH_VU = { TAI_KHOAN: 'QRIBFTTA', THE: 'QRIBFTTC' };

/**
 * Dong goi mot truong TLV.
 *
 * Do dai luon la 2 chu so, nen noi dung khong duoc vuot 99 KY TU. Cho chac
 * chan, ham nem loi thay vi cat bot am tham - cat bot se sinh ma QR quet duoc
 * nhung sai noi dung, loi kieu do rat kho lan ra.
 */
function tlv(id, giaTri) {
  const noiDung = String(giaTri);
  if (noiDung.length > 99) {
    throw new Error(`Truong VietQR ${id} dai ${noiDung.length} ky tu, toi da 99`);
  }
  return id + String(noiDung.length).padStart(2, '0') + noiDung;
}

/**
 * CRC-16/CCITT-FALSE: da thuc 0x1021, gia tri khoi tao 0xFFFF, khong dao bit,
 * khong XOR dau ra. Day dung la bien the ma EMVCo quy dinh - dung nham bien
 * the khac (vi du CRC-16/ARC) thi app ngan hang se bao "ma QR khong hop le".
 */
function crc16(chuoi) {
  let crc = 0xffff;
  for (let i = 0; i < chuoi.length; i++) {
    crc ^= chuoi.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff; // JS dung 32 bit, phai cat lai ve 16 bit sau moi vong
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Bo dau tieng Viet va cac ky tu ngoai ASCII.
 *
 * Truong "noi dung chuyen khoan" di qua he thong lien ngan hang chi an toan
 * voi ASCII. De nguyen "Thanh toan don Bàn 5" thi sao ke ngan hang se hien
 * thanh "Thanh toan don Ba?n 5" hoac mat hoan toan, luc do khong doi soat duoc.
 */
function boDau(chuoi) {
  return String(chuoi || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // dau thanh da tach roi boi NFD
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sinh chuoi payload VietQR.
 *
 * @param {object} p
 * @param {string} p.maNganHang  Khoa trong NGAN_HANG (vd 'VCB') hoac BIN 6 so
 * @param {string} p.soTaiKhoan
 * @param {number} [p.soTien]    Bo trong -> QR tinh, khach tu nhap so tien
 * @param {string} [p.noiDung]   Noi dung CK, se duoc bo dau va cat con 25 ky tu
 * @param {string} [p.dichVu]    DICH_VU.TAI_KHOAN (mac dinh) hoac DICH_VU.THE
 * @returns {string} chuoi de ma hoa thanh anh QR
 */
function taoPayload({ maNganHang, soTaiKhoan, soTien, noiDung, dichVu = DICH_VU.TAI_KHOAN }) {
  const bin = /^\d{6}$/.test(String(maNganHang || ''))
    ? String(maNganHang)
    : (NGAN_HANG[String(maNganHang || '').toUpperCase()] || {}).bin;

  if (!bin) throw new Error(`Khong biet ngan hang "${maNganHang}". Xem danh sach trong services/vietQR.js`);

  const stk = String(soTaiKhoan || '').replace(/\s/g, '');
  if (!stk) throw new Error('Thieu so tai khoan nhan tien');

  // Truong 38: thong tin ben thu huong, long 3 tang TLV.
  const thuHuong = tlv('00', bin) + tlv('01', stk);
  const truong38 = tlv('00', 'A000000727') + tlv('01', thuHuong) + tlv('02', dichVu);

  // So tien phai la so nguyen duong dang chuoi, KHONG dau phan cach nghin,
  // KHONG phan thap phan (VND khong co don vi le trong QR).
  const coSoTien = Number(soTien) > 0;
  const tienChuoi = coSoTien ? String(Math.round(Number(soTien))) : null;

  // Noi dung CK: 25 ky tu la nguong an toan chung cua cac app ngan hang.
  const moTa = boDau(noiDung).slice(0, 25);

  let payload =
    tlv('00', '01') +
    tlv('01', coSoTien ? '12' : '11') +
    tlv('38', truong38) +
    tlv('53', '704') +
    (coSoTien ? tlv('54', tienChuoi) : '') +
    tlv('58', 'VN') +
    (moTa ? tlv('62', tlv('08', moTa)) : '');

  // CRC tinh tren chuoi da co san "6304" o cuoi. Quen "6304" la sai CRC.
  payload += '6304';
  return payload + crc16(payload);
}

/**
 * Sinh anh QR dang data URL, nhung vao <img src> duoc ngay.
 *
 * `qrcode` da co san trong package.json (dung cho /staff/qr-codes) nen khong
 * phat sinh phu thuoc moi.
 */
async function taoAnhQR(payload, { kichThuoc = 320, vien = 1 } = {}) {
  const QRCode = require('qrcode');
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M', // M la muc NAPAS khuyen nghi cho QR chuyen khoan
    margin: vien,
    width: kichThuoc,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });
}

/** Sinh ca payload lan anh trong mot lan goi - ham dung nhieu nhat. */
async function taoQRChuyenKhoan(thongTin, tuyChonAnh) {
  const payload = taoPayload(thongTin);
  const anh = await taoAnhQR(payload, tuyChonAnh);
  const nh = NGAN_HANG[String(thongTin.maNganHang || '').toUpperCase()];
  return {
    payload,
    anh,
    nganHang: nh ? nh.ten : thongTin.maNganHang,
    nganHangDayDu: nh ? nh.dayDu : '',
    soTaiKhoan: thongTin.soTaiKhoan,
    soTien: Number(thongTin.soTien) || 0,
    noiDung: boDau(thongTin.noiDung).slice(0, 25),
  };
}

/** Danh sach ngan hang cho <select> trong trang cau hinh. */
function danhSachNganHang() {
  return Object.entries(NGAN_HANG)
    .map(([ma, v]) => ({ ma, bin: v.bin, ten: v.ten, dayDu: v.dayDu }))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
}

module.exports = {
  NGAN_HANG,
  DICH_VU,
  taoPayload,
  taoAnhQR,
  taoQRChuyenKhoan,
  danhSachNganHang,
  boDau,
  crc16,
  tlv,
};

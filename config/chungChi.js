/**
 * Sinh va nap chung chi tu ky cho HTTPS trong mang LAN.
 *
 * VI SAO CAN. Trinh duyet chi cho phep `getUserMedia` (camera) va
 * `geolocation` (GPS) tren "secure context": HTTPS, hoac localhost. Nhan vien
 * mo trang bang dien thoai qua `http://192.168.1.x:3000` thi doi tuong
 * `navigator.mediaDevices` KHONG TON TAI - khong phai bi tu choi quyen, ma la
 * khong co san. Khong co cach nao lach bang JavaScript. Vay nen muon cham cong
 * bang dien thoai thi bat buoc phai co HTTPS.
 *
 * VI SAO TU KY. Chung chi that (Let's Encrypt) doi mot ten mien cong khai va
 * ket noi internet. Nha hang chay trong mang noi bo, mat mang van phai cham
 * cong duoc, va khong nen mo he thong nhan su ra internet chi de lay cai chung
 * chi. Chung chi tu ky giai quyet dung van de: du de trinh duyet coi trang la
 * secure context, doi lai moi may phai bam qua canh bao mot lan.
 *
 * HAI DIEU DE SAI, da xu ly ben duoi:
 *
 *   1. iOS va Chrome hien dai BO QUA truong Common Name, chi doc
 *      subjectAltName. Chung chi khong co SAN chua dia chi IP thi Safari tu
 *      choi thang, khong cho bam "vao tiep". Nen phai liet ke moi IPv4 LAN vao
 *      SAN duoi dang kieu 7 (IP), khong phai kieu 2 (DNS).
 *
 *   2. iOS 13 tro len tu choi chung chi co han dung qua 825 ngay. Nen dat 800
 *      ngay chu khong phai 10 nam.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const THU_MUC = path.join(__dirname, 'chung-chi');
const DUONG_DAN_KHOA = path.join(THU_MUC, 'khoa.pem');
const DUONG_DAN_CHUNG_CHI = path.join(THU_MUC, 'chung-chi.pem');
const DUONG_DAN_DAU_VAN = path.join(THU_MUC, 'dia-chi.json');

/**
 * Moi dia chi IPv4 cua may nay tren mang LAN.
 *
 * Bo qua interface noi bo (127.x) va cac dia chi link-local 169.254.x - may
 * khac khong goi vao do duoc. Tren Windows co WSL, `os.networkInterfaces()`
 * con tra ve mang ao cua WSL/Hyper-V; van dua het vao SAN cho chac, thua mot
 * vai dia chi trong chung chi khong hai gi.
 */
function diaChiLan() {
  const ds = [];
  const cac = os.networkInterfaces();
  for (const ten of Object.keys(cac)) {
    for (const dc of cac[ten] || []) {
      if (dc.family !== 'IPv4' && dc.family !== 4) continue;
      if (dc.internal) continue;
      if (dc.address.startsWith('169.254.')) continue;
      ds.push(dc.address);
    }
  }
  return ds.sort();
}

/** Danh sach dia chi ma chung chi can bao phu. */
function _tenMien() {
  return ['localhost', ...diaChiLan(), '127.0.0.1', '::1'];
}

/** Han dung THAT doc tu chung chi (chuoi ISO), null neu khong doc duoc. */
function _hanDung(cert) {
  try {
    return new (require('crypto').X509Certificate)(cert).validTo;
  } catch {
    return null;
  }
}

/** Chung chi da co con dung cho tap dia chi hien tai khong. */
function _conDung(dsHienTai) {
  try {
    const cu = JSON.parse(fs.readFileSync(DUONG_DAN_DAU_VAN, 'utf8'));
    if (!Array.isArray(cu.dia_chi)) return false;
    // Router doi IP cho may chu -> chung chi cu khong con phu, phai sinh lai.
    // Neu khong, dien thoai bao NET::ERR_CERT_COMMON_NAME_INVALID rat kho doan.
    const thieu = dsHienTai.some((d) => !cu.dia_chi.includes(d));
    if (thieu) return false;
    if (cu.het_han && new Date(cu.het_han).getTime() < Date.now() + 7 * 864e5) return false;
    return fs.existsSync(DUONG_DAN_KHOA) && fs.existsSync(DUONG_DAN_CHUNG_CHI);
  } catch {
    return false;
  }
}

/**
 * Tra ve { key, cert } de dua vao https.createServer.
 *
 * Dung lai chung chi da sinh neu con phu het dia chi hien tai - sinh lai moi
 * lan khoi dong se bat nhan vien bam qua canh bao lai tu dau moi lan.
 *
 * Bat dong bo vi selfsigned v5 dung WebCrypto (sinh khoa RSA 2048 la thao tac
 * async). Goi bang `await` trong server.js truoc khi listen.
 *
 * @returns {Promise<{key: string, cert: string, dia_chi: string[], moi: boolean} | null>}
 *          null neu khong sinh duoc (thieu thu vien) - goi y cho chay HTTP.
 */
async function layChungChi() {
  const dsDiaChi = _tenMien();

  if (_conDung(dsDiaChi)) {
    return {
      key: fs.readFileSync(DUONG_DAN_KHOA, 'utf8'),
      cert: fs.readFileSync(DUONG_DAN_CHUNG_CHI, 'utf8'),
      dia_chi: diaChiLan(),
      moi: false,
    };
  }

  let selfsigned;
  try {
    selfsigned = require('selfsigned');
  } catch {
    console.warn('[https] Thiếu gói "selfsigned" - chạy `npm install selfsigned` để bật HTTPS.');
    return null;
  }

  // Kieu 2 = DNS, kieu 7 = dia chi IP. Safari doi dung kieu 7 cho IP; ghi IP
  // vao o DNS thi no khong khop va van bao chung chi sai.
  const altNames = dsDiaChi.map((d) =>
    /^[\d.]+$/.test(d) || d === '::1' ? { type: 7, ip: d } : { type: 2, value: d }
  );

  // Ten tuy chon la `notAfterDate` chu KHONG phai `days` - selfsigned v5 bo qua
  // `days` khong bao loi, va lang le cap chung chi 365 ngay.
  const NGAY = 800;   // iOS tu choi chung chi dai hon 825 ngay
  const kq = await selfsigned.generate(
    [{ name: 'commonName', value: 'NhaHang Local' }],
    {
      notAfterDate: new Date(Date.now() + NGAY * 864e5),
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [{ name: 'subjectAltName', altNames }],
    }
  );

  fs.mkdirSync(THU_MUC, { recursive: true });
  // Khoa rieng: chi chu so huu doc duoc. Windows bo qua che do nay, tren Linux
  // thi co tac dung.
  fs.writeFileSync(DUONG_DAN_KHOA, kq.private, { mode: 0o600 });
  fs.writeFileSync(DUONG_DAN_CHUNG_CHI, kq.cert);
  fs.writeFileSync(
    DUONG_DAN_DAU_VAN,
    // Doc han THAT tu chung chi vua sinh chu khong tu tinh lai theo NGAY: neu
    // thu vien lai lang le doi cach hieu tuy chon, dau van van khop voi thuc te
    // va `_conDung` khong bao gio ket luan sai.
    JSON.stringify({ dia_chi: dsDiaChi, het_han: _hanDung(kq.cert) }, null, 2)
  );

  return { key: kq.private, cert: kq.cert, dia_chi: diaChiLan(), moi: true };
}

module.exports = { layChungChi, diaChiLan, THU_MUC };

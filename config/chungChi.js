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

/**
 * Ten card mang cua cac phan mem may ao pho bien.
 *
 * Dat o day chu khong o utils/diaChiQR.js vi diaChiQR da `require` tep nay -
 * de mau o tren thi thanh phu thuoc vong. diaChiQR nhap lai tu day.
 */
const TEN_CARD_AO = /vethernet|wsl|virtualbox|vmware|vmnet|hyper-v|loopback|docker|tailscale|zerotier|tap-|npcap|bluetooth/i;

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

/**
 * Chi cac dia chi tren card mang THAT - bo card ao (WSL, VMware, VirtualBox,
 * Docker...).
 *
 * VI SAO CAN TACH RIENG. Dien thoai cua nhan vien chi bao gio goi vao dia chi
 * Wi-Fi that. Nhung dia chi cua card ao thi doi luon: WSL nhan dia chi moi sau
 * moi lan Windows hoac WSL khoi dong lai. Neu lay ca hai loai lam can cu de
 * quyet dinh cap lai chung chi thi cu moi lan do la chung chi doi, va NGOAI LE
 * MA MOI DIEN THOAI DA BAM CHAP NHAN TRUOC DO HET HIEU LUC. Nhan vien mo trang
 * cham cong se thay "khong ket noi duoc may chu" (service worker nuot loi chung
 * chi thanh loi mang) va khong ai doan ra vi sao.
 *
 * Card ao VAN duoc dua vao SAN khi da sinh chung chi - thua vai dia chi khong
 * hai gi. Chung chi chi khong cap lai VI RIENG chung nua.
 */
function diaChiThat() {
  const ds = [];
  const cac = os.networkInterfaces();
  for (const ten of Object.keys(cac)) {
    if (TEN_CARD_AO.test(ten)) continue;
    for (const dc of cac[ten] || []) {
      if (dc.family !== 'IPv4' && dc.family !== 4) continue;
      if (dc.internal) continue;
      if (dc.address.startsWith('169.254.')) continue;
      ds.push(dc.address);
    }
  }
  return ds.sort();
}

/**
 * Dia chi CO KHA NANG NHAT la dia chi dien thoai vao duoc, xep dau danh sach.
 *
 * VI SAO CAN THEM MOT BUOC NUA SAU `diaChiThat()`
 * -----------------------------------------------
 * `diaChiThat()` loc theo TEN card mang, nhung ten khong phai luc nao cung noi
 * len ban chat. Tren may nay VirtualBox tao mot card ten "Ethernet 3" - khong
 * chua tu khoa nao trong `TEN_CARD_AO` - nen no lot qua va dung canh dia chi
 * Wi-Fi that. Nguoi dung nhin bang dia chi luc khoi dong thay hai dong nhu nhau
 * va khong co cach nao biet cai nao dung.
 *
 * DAU HIEU DUNG DE XEP HANG
 * -------------------------
 * Card ao gan nhu luon TU LAM cong cho mang rieng cua no, nen dia chi ket thuc
 * bang `.1` (192.168.56.1, 192.168.198.1, 172.26.224.1...). May tinh noi vao
 * router that thi duoc router cap mot dia chi bat ky trong dai, rat hiem khi
 * la `.1` - do la dia chi cua chinh router.
 *
 * Day la PHONG DOAN, khong phai chan ly: mot may dat IP tinh la `.1` se bi xep
 * sau. Nen ham nay chi SAP XEP chu khong loai bo dia chi nao - bang dia chi van
 * in het, chi khac la cai kha nang dung nhat duoc dua len truoc va danh dau.
 */
function diaChiDeXuat() {
  const that = diaChiThat();
  const ao = diaChiLan().filter((x) => !that.includes(x));

  const diem = (ip) => {
    let d = 0;
    if (!ip.endsWith('.1')) d += 10;        // khong phai cong cua mang rieng
    if (ip.startsWith('192.168.')) d += 2;  // dai gia dinh pho bien nhat
    return d;
  };
  const sap = (ds) => [...ds].sort((a, b) => diem(b) - diem(a) || a.localeCompare(b));

  // Card that len truoc card ao, trong moi nhom lai xep theo diem.
  return [...sap(that), ...sap(ao)];
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
    /*
      Chi xet dia chi tren card mang THAT.

      Router doi IP cho may chu -> chung chi cu khong con phu, phai sinh lai;
      neu khong, dien thoai bao NET::ERR_CERT_COMMON_NAME_INVALID rat kho doan.

      Nhung dia chi card ao doi thi KHONG cap lai: xem ghi chu o `diaChiThat()`.
      Truoc day lay ca card ao lam can cu, nen moi lan WSL doi dia chi la moi
      dien thoai phai bam chap nhan chung chi lai tu dau.
    */
    const thieu = diaChiThat().some((d) => !cu.dia_chi.includes(d));
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

module.exports = { layChungChi, diaChiLan, diaChiThat, diaChiDeXuat, TEN_CARD_AO, THU_MUC };

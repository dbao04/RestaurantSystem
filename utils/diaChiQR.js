/**
 * Dia chi nhung vao ma QR dan o ban.
 *
 * VAN DE GOC: URL nhung vao ma QR truoc day lay thang tu `req.get('host')` luc
 * nhan vien bam "Tao ma QR". Nhan vien thuong mo trang quan tri bang
 * http://localhost:3000, nen moi ma QR sinh ra deu mang chu `localhost`. Khach
 * quet ma bang dien thoai thi `localhost` tro ve chinh cai dien thoai do -
 * khong co may chu nao o day nen trang khong bao gio hien ra. May tinh tai quay
 * quet thu lai chay binh thuong, nen loi rat de bi bo qua.
 *
 * CHON CARD MANG NAO - phan kho nhat cua file nay
 *   Mot may Windows binh thuong co RAT NHIEU dia chi IPv4 cung luc: Wi-Fi that,
 *   card ao cua WSL, cua VMware, cua VirtualBox... May chay he thong nay co 5
 *   dia chi. Chi MOT trong so do la dia chi ma dien thoai khach nhin thay duoc;
 *   bon con lai la mang ao chi ton tai ben trong may. Lay bua phan tu dau danh
 *   sach la ra card ao va ma QR van hong y nhu cu.
 *
 *   Cach do dung: mo mot socket UDP "connect" toi mot dia chi ngoai Internet.
 *   Khong co goi tin nao duoc gui di (UDP connect chi la thao tac cuc bo), nhung
 *   he dieu hanh phai tra loi cau hoi "neu gui ra ngoai thi di bang card nao,
 *   dia chi nguon la gi" - va dia chi do chinh la card mang that. Cach nay hoi
 *   thang bang dinh tuyen cua he dieu hanh nen dung tren moi may, khong phu
 *   thuoc vao ten card hay dai IP.
 *
 * THU TU UU TIEN
 *   1. `QR_BASE_URL` trong .env thang tat ca. Dat khoa nay khi he thong da co
 *      ten mien that (vi du https://nhahang.vn), hoac khi muon tu chi dinh IP
 *      vi may do sai.
 *   2. Dia chi tunnel trong tep `.qr-tunnel` neu dang mo. Xem phan duoi.
 *   3. Ten may trong request neu no khong phai loopback. Nhan vien mo trang
 *      bang http://192.168.100.12:3000 thi giu dung dia chi do.
 *   4. Dia chi do duoc bang socket UDP nhu tren.
 *   5. Neu do that bai: bo cac card co ten quen thuoc cua may ao roi lay dia chi
 *      dau tien con lai.
 *
 * KHACH O MANG KHAC - TEP `.qr-tunnel`
 *   Moi dia chi 192.168.x.x deu la dia chi NOI BO: chi may nao cam chung mot
 *   router moi goi toi duoc. Khach ngoi trong quan dung 4G, hoac nguoi cham
 *   diem do an tu nha, se khong bao gio mo duoc ma QR dan o ban du go tay dung
 *   tung ky tu. Muon ho vao duoc thi phai co mot dia chi cong khai tren
 *   Internet, va cach lam khong can thue may chu la mo mot "tunnel".
 *
 *   `npm run qr:online` chay Cloudflare Tunnel: no mo mot ket noi tu may nay ra
 *   Cloudflare roi phat lai cong 3000 duoi mot ten mien https that. Script do
 *   ghi dia chi vua nhan duoc vao tep `.qr-tunnel` o thu muc goc du an, va ham
 *   `goc()` doc lai tep do moi 2 giay. Nho vay khong can khoi dong lai server:
 *   mo tunnel len la ma QR trong trang quan tri doi sang dia chi Internet ngay,
 *   tat tunnel di la tu quay ve dia chi LAN nhu cu.
 *
 * VE HTTP HAY HTTPS
 *   Dia chi LAN luon dung http. Chung chi https cua he thong la chung chi tu
 *   ky, dien thoai khach se bao "Ket noi khong an toan" va phan lon ung dung
 *   quet QR chan luon khong cho bam tiep. Trang thuc don qua QR khong dung
 *   camera hay GPS nen khong can secure context - xem ghi chu HTTPS o cuoi
 *   server.js.
 *
 *   Rieng dia chi tunnel thi nguoc lai: Cloudflare cap chung chi that nen dien
 *   thoai tin ngay, khong hien canh bao nao. Do cung la ly do trang cham cong
 *   khuon mat chay duoc qua tunnel ma khong chay duoc qua dia chi LAN.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const chungChi = require('../config/chungChi');

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);

// Ten card mang cua cac phan mem may ao pho bien. Chi dung cho duong du phong
// khi phep do UDP that bai - do UDP van la cach chinh vi no khong phu thuoc ten.
const TEN_CARD_AO = /vethernet|wsl|virtualbox|vmware|vmnet|hyper-v|loopback|docker|tailscale|zerotier|tap-|npcap|bluetooth/i;

let ipDaDo = null;   // ket qua phep do UDP gan nhat

// Tep do `scripts/moOnline.js` ghi ra khi tunnel dung len, va xoa khi tat.
const TEP_TUNNEL = path.join(__dirname, '..', '.qr-tunnel');
let tunnel = { docLuc: 0, url: '' };

/**
 * Do dia chi cua card mang that va nho lai.
 *
 * Chay mot lan luc nap module va lap lai moi 5 phut, vi router co the doi IP
 * cua may chu giua chung. Socket duoc `unref()` de khong giu tien trinh Node
 * song them.
 */
function doDiaChi() {
  let s;
  try {
    s = dgram.createSocket('udp4');
  } catch {
    return;
  }
  const dong = () => { try { s.close(); } catch { /* da dong roi */ } };
  s.unref();
  s.on('error', dong);
  try {
    // 8.8.8.8 chi dong vai "mot dia chi nao do ngoai Internet". Khong he co ket
    // noi nao duoc mo va khong can co mang de phep do nay chay.
    s.connect(53, '8.8.8.8', () => {
      try {
        const dc = s.address().address;
        if (dc && !LOOPBACK.has(dc)) ipDaDo = dc;
      } catch { /* khong doc duoc thi giu ket qua cu */ }
      dong();
    });
  } catch {
    dong();
  }
}

doDiaChi();
setInterval(doDiaChi, 5 * 60000).unref();

/** Dia chi IPv4 that, da bo cac card ao doan duoc theo ten. */
function diaChiKhongPhaiMayAo() {
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
  return ds;
}

/** Dia chi may chu nen dung cho ma QR (chi phan IP, khong co cong). */
function ipMayChu() {
  return ipDaDo || diaChiKhongPhaiMayAo()[0] || chungChi.diaChiLan()[0] || 'localhost';
}

/**
 * Dia chi tunnel dang mo, hoac chuoi rong neu khong co.
 *
 * Doc dia tep nen phai chan lai: `goc()` duoc goi moi lan ve mot ma QR, con
 * trang so do ban thi ve hang chuc ma mot luc. Nho ket qua 2 giay la du de tat
 * mo tunnel co hieu luc gan nhu tuc thi ma khong dong vao dia lien tuc.
 */
function gocTunnel() {
  const gio = Date.now();
  if (gio - tunnel.docLuc < 2000) return tunnel.url;
  tunnel.docLuc = gio;
  try {
    const doc = JSON.parse(fs.readFileSync(TEP_TUNNEL, 'utf8'));
    const url = String(doc.url || '').trim().replace(/\/+$/, '');
    tunnel.url = /^https?:\/\//i.test(url) ? url : '';
  } catch {
    // Khong co tep (tunnel dang tat) hoac tep dang duoc ghi do: coi nhu khong co.
    tunnel.url = '';
  }
  return tunnel.url;
}

/** Tach ten may khoi chuoi `host` (bo cong, bo ngoac cua IPv6). */
function tachTenMay(host) {
  return String(host || '')
    .replace(/:\d+$/, '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
}

/**
 * Goc dia chi (`http://<may>:<cong>`) de dan truoc duong dan cua ma QR.
 * Khong bao gio co dau `/` o cuoi. Goi duoc ca khi khong co `req`.
 */
function goc(req) {
  const khaiBao = String(process.env.QR_BASE_URL || '').trim();
  if (khaiBao) return khaiBao.replace(/\/+$/, '');

  const qua = gocTunnel();
  if (qua) return qua;

  const cong = process.env.PORT || 3000;
  const tenMay = tachTenMay(req && req.get && req.get('host'));

  if (tenMay && !LOOPBACK.has(tenMay)) return `http://${tenMay}:${cong}`;
  return `http://${ipMayChu()}:${cong}`;
}

/**
 * Dung lai mot URL da luu trong `qr_tables` theo goc dia chi hien tai.
 *
 * Cac ma QR tao truoc ban va nhung chuoi `http://localhost:3000/...` vao cot
 * `url`. Ham nay giu nguyen duong dan va tham so cua chung, chi thay phan
 * `http://localhost:3000`, de trang quan tri ve ra ma QR DUNG cho nhan vien in
 * lai. Luu y: to giay da in va dan tren ban thi khong sua duoc tu xa - phai in
 * lai roi dan de len.
 */
function chuanHoa(url, req) {
  const gocMoi = goc(req);
  try {
    const cu = new URL(String(url));
    return gocMoi + cu.pathname + cu.search;
  } catch {
    // Cot `url` rong hoac hong: khong con gi de va, tra ve nguyen trang.
    return url;
  }
}

/** Moi dia chi IPv4 cua may - de trang quan tri goi y khi may do sai card. */
function danhSachDiaChi() {
  return chungChi.diaChiLan();
}

/**
 * Dia chi mo tren DIEN THOAI de cham cong duoc.
 *
 * Khac `goc()` o mot diem duy nhat nhung quyet dinh: dia chi nay BAT BUOC phai
 * la secure context. Trang thuc don qua ma QR khong dung camera nen `goc()` tra
 * ve http cho gon; trang cham cong thi nguoc lai - mo bang http la
 * `navigator.mediaDevices` khong ton tai, khong co cach nao lach.
 *
 * Thu tu uu tien va vi sao:
 *   1. QR_BASE_URL neu la https - nguoi quan tri da khai bao ten mien that.
 *   2. Tunnel Cloudflare (`npm run qr:online`) - chung chi that, dien thoai vao
 *      thang khong canh bao gi. Day la duong tot nhat cho nhan vien.
 *   3. https://<ip-lan>:3443 - chung chi tu ky, moi may phai bam qua canh bao
 *      mot lan. Van chay duoc, nhung phai noi truoc cho nguoi dung biet, nen
 *      tra kem co `tu_ky`.
 *
 * Tra ve null khi khong co duong nao (BAT_HTTPS=0 va khong co tunnel) - luc do
 * giao dien phai noi that la chua cham cong bang dien thoai duoc, thay vi dua
 * ra mot dia chi bam vao khong len.
 */
function diaChiDienThoai(req) {
  const khaiBao = String(process.env.QR_BASE_URL || '').trim().replace(/\/+$/, '');
  if (/^https:\/\//i.test(khaiBao)) return { url: khaiBao, tu_ky: false, nguon: 'cau_hinh' };

  const qua = gocTunnel();
  if (/^https:\/\//i.test(qua)) return { url: qua, tu_ky: false, nguon: 'tunnel' };

  if (String(process.env.BAT_HTTPS || '1') === '0') return null;

  const cong = Number(process.env.HTTPS_PORT) || 3443;
  const tenMay = tachTenMay(req && req.get && req.get('host'));
  const may = tenMay && !LOOPBACK.has(tenMay) ? tenMay : ipMayChu();
  if (!may || LOOPBACK.has(may)) return null;
  return { url: `https://${may}:${cong}`, tu_ky: true, nguon: 'lan' };
}

module.exports = {
  goc, chuanHoa, ipMayChu, danhSachDiaChi, gocTunnel, diaChiDienThoai, TEP_TUNNEL,
};

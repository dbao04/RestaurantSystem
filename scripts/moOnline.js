/**
 * Mo he thong ra Internet de dien thoai khach quet ma QR o BAT KY mang nao.
 *
 * VAN DE GOC: ma QR dan o ban chi chua duoc dia chi noi bo dang
 * http://192.168.100.12:3000. Dia chi do la dia chi router cap trong nha, chi
 * may nao cam chung mot router moi goi toi duoc. Khach ngoi trong quan nhung
 * dung 4G, hay thay co cham diem do an tu nha, se khong bao gio mo duoc trang -
 * go tay dung tung ky tu cung khong duoc, vi khong phai sai chinh ta ma la
 * khong co duong di toi.
 *
 * CACH LAM: mo mot "tunnel" bang cloudflared. No khong mo cong nao tren router
 * ca; nguoc lai, no tu may nay goi RA Cloudflare va giu ket noi do. Ai vao ten
 * mien https Cloudflare cap thi Cloudflare day yeu cau nguoc ve theo duong da
 * mo san toi cong 3000. Vi vay khong can IP tinh, khong can sua router, khong
 * can quyen quan tri, va tuong lua Windows cung khong chan (day la ket noi di
 * ra, khong phai ket noi di vao).
 *
 * Duoc them: ten mien Cloudflare cap co chung chi that, nen dien thoai khong
 * hien canh bao "Ket noi khong an toan" nhu dia chi https tu ky cua he thong.
 * Cham cong khuon mat vi the chay duoc qua duong nay.
 *
 * NOI SCRIPT NAY NOI CHUYEN VOI SERVER: no ghi dia chi vua nhan duoc vao tep
 * `.qr-tunnel` o thu muc goc du an. `utils/diaChiQR.js` doc tep do moi 2 giay,
 * nen khong can khoi dong lai server - mo len la ma QR doi sang dia chi
 * Internet, tat di la tu quay ve dia chi LAN.
 *
 * DIEU DUY NHAT CAN NHO: ten mien trycloudflare.com la ten mien tam, MOI LAN
 * chay lai se ra mot ten khac. To giay da in va dan len ban thi khong tu doi
 * theo duoc. Nen quy trinh dung la: mo tunnel truoc, roi moi vao trang quan tri
 * in ma QR. Muon mot dia chi co dinh in mot lan dung mai thi xem phan cuoi
 * HUONG_DAN_QUET_QR_TU_XA.md.
 *
 * Chay:  npm run qr:online     (hoac nhap dup _mo_qr_online.bat)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn, spawnSync } = require('child_process');

const CONG = process.env.PORT || 3000;
const GOC_DU_AN = path.join(__dirname, '..');
const TEP_TUNNEL = path.join(GOC_DU_AN, '.qr-tunnel');
const THU_MUC_BIN = path.join(GOC_DU_AN, 'bin');

const laWindows = process.platform === 'win32';
const TEN_EXE = laWindows ? 'cloudflared.exe' : 'cloudflared';
const DUONG_DAN_TAI = {
  win32: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  linux: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
  darwin: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
};

const inRa = (s) => console.log('  ' + s);

/* ------------------------------------------------------------------ */
/*  Tim hoac tai cloudflared                                          */
/* ------------------------------------------------------------------ */

/** cloudflared da cai san trong may chua (winget / choco / brew deu them vao PATH). */
function coTrongPath() {
  try {
    const r = spawnSync('cloudflared', ['--version'], { stdio: 'ignore', shell: laWindows });
    return r.status === 0;
  } catch {
    return false;
  }
}

/**
 * Tai cloudflared ve thu muc bin/ cua du an.
 *
 * Tep nang khoang 70 MB nen co in phan tram cho do sot ruot. Tai vao tep .tam
 * roi moi doi ten: neu mang dut giua chung se khong de lai mot tep exe cut
 * duoc coi nham la da tai xong o lan chay sau.
 */
function tai(url, dich, conLai = 5) {
  return new Promise((ok, loi) => {
    if (conLai <= 0) return loi(new Error('Chuyen huong qua nhieu lan'));
    https.get(url, { headers: { 'User-Agent': 'nhahang' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return tai(res.headers.location, dich, conLai - 1).then(ok, loi);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return loi(new Error(`May chu tra ve ma ${res.statusCode}`));
      }
      const tong = Number(res.headers['content-length']) || 0;
      let daTai = 0;
      let mocCuoi = -1;
      const tam = dich + '.tam';
      const ghi = fs.createWriteStream(tam);
      res.on('data', (m) => {
        daTai += m.length;
        if (!tong) return;
        const phanTram = Math.floor((daTai / tong) * 100 / 5) * 5;
        if (phanTram !== mocCuoi) {
          mocCuoi = phanTram;
          process.stdout.write(`\r     Dang tai cloudflared... ${phanTram}%`);
        }
      });
      res.pipe(ghi);
      ghi.on('finish', () => ghi.close(() => {
        process.stdout.write('\r     Dang tai cloudflared... xong    \n');
        try {
          fs.renameSync(tam, dich);
          if (!laWindows) fs.chmodSync(dich, 0o755);
          ok();
        } catch (e) { loi(e); }
      }));
      ghi.on('error', loi);
    }).on('error', loi);
  });
}

/** Duong dan toi cloudflared, tu tai ve neu may chua co. */
async function timCloudflared() {
  const rieng = path.join(THU_MUC_BIN, TEN_EXE);
  if (fs.existsSync(rieng)) return rieng;
  if (coTrongPath()) return 'cloudflared';

  const url = DUONG_DAN_TAI[process.platform];
  if (!url) throw new Error(`Chua ho tro tu tai tren ${process.platform}. Hay cai cloudflared bang tay.`);
  if (process.platform === 'darwin') {
    throw new Error('Tren macOS hay cai bang: brew install cloudflared');
  }

  inRa('May chua co cloudflared - dang tai ve (khoang 70 MB, chi mot lan duy nhat).');
  fs.mkdirSync(THU_MUC_BIN, { recursive: true });
  await tai(url, rieng);
  return rieng;
}

/* ------------------------------------------------------------------ */
/*  Chay tunnel                                                       */
/* ------------------------------------------------------------------ */

function ghiTepTunnel(url) {
  fs.writeFileSync(TEP_TUNNEL, JSON.stringify({ url, luc: new Date().toISOString() }, null, 2));
}

function xoaTepTunnel() {
  try { fs.unlinkSync(TEP_TUNNEL); } catch { /* chua tung ghi ra thi thoi */ }
}

function inBang(url) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Đã mở ra Internet — điện thoại mạng nào cũng vào được   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  inRa(`Địa chỉ: ${url}`);
  inRa(`Thực đơn: ${url}/qr-menu`);
  inRa(`Quản trị: ${url}/admin`);
  console.log('');
  // Cham cong bang dien thoai in rieng mot dong: day la duong DUY NHAT khong
  // can bam qua canh bao chung chi. Dia chi https tu ky trong mang LAN van chay
  // duoc nhung moi may phai chap nhan canh bao mot lan, con ten mien Cloudflare
  // co chung chi that nen dien thoai vao thang.
  inRa(`Chấm công (điện thoại): ${url}/cham-cong/`);
  inRa('Nhân viên vào địa chỉ này, đăng nhập rồi chấm công như ở máy.');
  console.log('');
  inRa('Mã QR trong trang quản trị đã tự đổi sang địa chỉ này — vào');
  inRa('trang mã QR để in lại, đừng dùng tờ giấy in từ trước.');
  console.log('');
  inRa('ĐỪNG ĐÓNG CỬA SỔ NÀY. Đóng là mất địa chỉ, và lần sau mở lại');
  inRa('sẽ ra một địa chỉ khác — mã QR đã in sẽ hỏng.');
  console.log('');
}

let tienTrinhTunnel = null;

/**
 * Bat mot lan chay cloudflared va cho no bao dia chi.
 *
 * cloudflared in nhat ky ra stderr chu khong phai stdout, ke ca dong chua dia
 * chi, nen phai doc ca hai. Neu tien trinh chet (mang dut, Cloudflare tu choi)
 * thi ham goi se bat len lai; moi lan bat lai la mot dia chi moi nen phai ghi
 * de tep .qr-tunnel chu khong giu dia chi cu.
 *
 * Tra ve `true` neu lan chay nay co bao duoc dia chi. Vong lap o `main()` dua
 * vao do de phan biet "tunnel song mot luc roi dut" voi "chay phat nao chet
 * phat do" - truong hop sau ma cu bat lai mai thi chi cuon man hinh chu khong
 * bao gio chay duoc.
 */
function chay(duongDanExe) {
  return new Promise((ketThuc) => {
    const tt = spawn(duongDanExe, ['tunnel', '--url', `http://localhost:${CONG}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    tienTrinhTunnel = tt;

    let daBao = false;
    const doc = (khoi) => {
      const chu = khoi.toString();
      const tim = chu.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (tim && !daBao) {
        daBao = true;
        ghiTepTunnel(tim[0]);
        inBang(tim[0]);
      }
      // Nhat ky cua cloudflared rat dai va khong ai doc - chi hien dong nao co
      // muc ERR/FTL. Phai bat theo dung muc chu khong bat chu "error": moi dong
      // canh bao WRN vo hai cua no cung co chuoi `error=` o cuoi, hien len chi
      // lam nhan vien tuong he thong hong.
      if (/\b(ERR|FTL)\b/.test(chu)) process.stderr.write(chu);
    };
    tt.stdout.on('data', doc);
    tt.stderr.on('data', doc);

    tt.on('error', (e) => {
      console.error(`  [LỖI] Không chạy được cloudflared: ${e.message}`);
      ketThuc(false);
    });
    tt.on('close', () => {
      tienTrinhTunnel = null;
      xoaTepTunnel();
      ketThuc(daBao);
    });
  });
}

// Dat mot lan o day chu khong dat trong `chay()`: `chay()` duoc goi lai moi lan
// tunnel dut, dang ky trong do se chong chat listener sau vai lan bat lai.
for (const tin of ['SIGINT', 'SIGTERM']) {
  process.on(tin, () => {
    try { if (tienTrinhTunnel) tienTrinhTunnel.kill(); } catch { /* da chet roi */ }
    xoaTepTunnel();
    process.exit(0);
  });
}

/** Server co dang chay khong - hoi truoc cho de hieu hon la de tunnel bao 502. */
function serverDangChay() {
  return new Promise((ok) => {
    const req = require('http').get(
      { host: '127.0.0.1', port: CONG, path: '/', timeout: 2000 },
      (res) => { res.resume(); ok(true); }
    );
    req.on('error', () => ok(false));
    req.on('timeout', () => { req.destroy(); ok(false); });
  });
}

async function main() {
  console.log('');
  inRa('Mở hệ thống ra Internet cho điện thoại khách quét mã QR...');
  console.log('');

  if (!(await serverDangChay())) {
    inRa(`[!] Chưa thấy server ở cổng ${CONG}.`);
    inRa('    Hãy chạy start_all.bat (hoặc npm start) trước, rồi chạy lại file này.');
    inRa('    Tunnel vẫn mở, nhưng khách vào sẽ gặp lỗi 502 tới khi server lên.');
    console.log('');
  }

  let exe;
  try {
    exe = await timCloudflared();
  } catch (e) {
    console.error(`  [LỖI] ${e.message}`);
    process.exit(1);
  }

  // Cloudflare thinh thoang cat ket noi tunnel tam. Bat lai ngay thay vi de
  // nhan vien phat hien ra khi khach da ngoi vao ban va quet khong len.
  let hong = 0;
  for (;;) {
    hong = (await chay(exe)) ? 0 : hong + 1;
    if (hong >= 3) {
      console.log('');
      inRa('[LỖI] Thử 3 lần đều không mở được tunnel. Kiểm tra máy có mạng không,');
      inRa('      hoặc mạng nơi này có chặn Cloudflare. Xem HUONG_DAN_QUET_QR_TU_XA.md');
      process.exit(1);
    }
    inRa('Tunnel bị đứt — đang mở lại sau 5 giây...');
    await new Promise((r) => setTimeout(r, 5000));
  }
}

process.on('exit', xoaTepTunnel);
main();

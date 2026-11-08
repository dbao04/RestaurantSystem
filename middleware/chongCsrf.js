/**
 * Chong CSRF (gia mao yeu cau tu trang khac) bang kiem tra nguon goc.
 *
 * Moi request GHI du lieu (POST/PUT/PATCH/DELETE) gui tu trinh duyet deu kem
 * header `Origin` (hoac it nhat `Referer`). Neu header do tro toi mot trang
 * KHAC voi chinh he thong nay thi day la trang la dang loi dung phien dang
 * nhap cua nguoi dung -> tu choi.
 *
 * Khong co ca Origin lan Referer: KHONG phai trinh duyet (webhook ngan hang,
 * script kiem thu, may cham cong...) - nhung loai nay khong mang cookie phien
 * cua nan nhan nen khong the dung de tan cong CSRF, cho qua.
 *
 * Bo sung them cookie phien `SameSite=Lax` (cau hinh o server.js) - hai lop
 * doc lap nhau.
 */
function hostCua(url) {
  try { return new URL(url).host.toLowerCase(); } catch (e) { return null; }
}

function laLoopback(ip) {
  const s = String(ip || '');
  return s === '::1' || s.startsWith('127.') || s.startsWith('::ffff:127.');
}

function chongCsrf({ boQua = [] } = {}) {
  const PHUONG_THUC_GHI = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  return (req, res, next) => {
    if (!PHUONG_THUC_GHI.has(req.method)) return next();
    if (boQua.some((duong) => req.path === duong || req.path.startsWith(duong + '/'))) return next();

    const origin = req.headers.origin;
    const nguon = origin && origin !== 'null' ? origin : req.headers.referer;
    if (!nguon) return next();

    const hostGui = hostCua(nguon);
    // Host cua chinh he thong: header Host, hoac host goc khi di qua proxy cuc
    // bo (cloudflared) - `trust proxy` = loopback nen chi tin khi tu may nay.
    const hopLe = new Set([String(req.headers.host || '').toLowerCase()]);
    const fwd = laLoopback(req.socket && req.socket.remoteAddress) ? req.headers['x-forwarded-host'] : null;
    if (fwd) hopLe.add(String(fwd).split(',')[0].trim().toLowerCase());

    if (hostGui && hopLe.has(hostGui)) return next();

    console.warn(`[csrf] chan ${req.method} ${req.originalUrl} tu nguon ${nguon} (host ${req.headers.host})`);
    const muonJson = req.xhr || /json/i.test(String(req.headers.accept || '')) || req.is('application/json');
    if (muonJson) return res.status(403).json({ loi: 'Yêu cầu bị từ chối: không đến từ trang của hệ thống.' });
    return res.status(403).send('Yêu cầu bị từ chối: không đến từ trang của hệ thống.');
  };
}

module.exports = chongCsrf;

/*
 * HOP THONG BAO CHUNG - thay cho hop xam cua trinh duyet (window.alert).
 *
 * Nap o chan trang khach / nhan vien / quan tri (va KDS, thanh toan QR). Ghi de
 * window.alert nen moi cho dang goi alert(...) tu dung hop nay, khong phai sua
 * tung trang.
 *
 * Khac alert goc: KHONG chan ma chay tiep. Nhieu cho goi alert(...) roi
 * location.reload() ngay -> truoc day trinh duyet dung lai cho bam OK; nay hop
 * duoc luu vao sessionStorage truoc khi roi trang va hien lai sau khi trang moi
 * tai xong, nen nguoi dung van doc duoc.
 *
 * Dung truc tiep: window.thongBao('Noi dung', { loai: 'loi' | 'ok' | 'tin' }).
 */
(function () {
  if (window.__thongBaoDep) return;
  window.__thongBaoDep = true;

  var KHOA = 'tb-dep-cho';
  var hang = [];      // cac thong bao dang cho hien
  var dangMo = null;  // thong bao dang hien

  // ---- Kieu (tu dong, khong phu thuoc CSS trang) ----
  var css = [
    '.tbd-nen{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;',
    'padding:24px 16px;overflow-y:auto;background:rgba(20,12,8,.42);backdrop-filter:blur(2px);opacity:0;transition:opacity .18s ease}',
    '.tbd-hop{margin:auto}',
    '.tbd-nen.is-mo{opacity:1}',
    '.tbd-hop{--tbd-mau:#b8892e;width:min(440px,100%);background:#fffdf8;color:#2b1a12;border-radius:16px;',
    'box-shadow:0 24px 60px rgba(0,0,0,.35),0 0 0 1px rgba(184,137,46,.25);overflow:hidden;transform:translateY(-8px) scale(.98);',
    'transition:transform .2s ease;font-family:"Be Vietnam Pro","Plus Jakarta Sans","Segoe UI",system-ui,sans-serif}',
    '.tbd-nen.is-mo .tbd-hop{transform:none}',
    '.tbd-hop[data-loai=loi]{--tbd-mau:#c0392b}.tbd-hop[data-loai=ok]{--tbd-mau:#1f8a5b}.tbd-hop[data-loai=tin]{--tbd-mau:#b8892e}',
    '.tbd-than{display:flex;gap:14px;padding:22px 22px 16px;border-top:4px solid var(--tbd-mau)}',
    '.tbd-icon{flex:0 0 40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
    'background:color-mix(in srgb,var(--tbd-mau) 14%,transparent);color:var(--tbd-mau);font-size:20px;font-weight:800}',
    '.tbd-chu{min-width:0}.tbd-tieu-de{font-weight:700;font-size:16px;margin:2px 0 6px}',
    '.tbd-noi-dung{font-size:14.5px;line-height:1.6;color:#4a3a2c;white-space:pre-line;overflow-wrap:anywhere}',
    '.tbd-chan{display:flex;justify-content:flex-end;gap:8px;padding:0 22px 18px}',
    '.tbd-nut{border:0;border-radius:999px;padding:9px 22px;font:600 14px inherit;font-family:inherit;cursor:pointer;',
    'background:var(--tbd-mau);color:#fff;min-width:96px}',
    '.tbd-nut--phu{background:transparent;color:inherit;box-shadow:inset 0 0 0 1.5px rgba(127,127,127,.45)}',
    '.tbd-nut:focus-visible{outline:3px solid color-mix(in srgb,var(--tbd-mau) 45%,transparent);outline-offset:2px}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .tbd-hop{background:#231710;color:#f3ebdd}',
    ':root:not([data-theme=light]) .tbd-noi-dung{color:#d9cbb6}}',
    ':root[data-theme=dark] .tbd-hop{background:#231710;color:#f3ebdd}:root[data-theme=dark] .tbd-noi-dung{color:#d9cbb6}',
    '@media (prefers-reduced-motion:reduce){.tbd-nen,.tbd-hop{transition:none}}'
  ].join('');
  function ganCss() {
    if (document.getElementById('tbd-css')) return;
    var s = document.createElement('style'); s.id = 'tbd-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // Doan kieu tu noi dung: loi / thanh cong / thong tin.
  function doanLoai(m) {
    var t = String(m).toLowerCase();
    if (/không (thể|được|đủ|tìm|hợp lệ|có quyền)|lỗi|thất bại|chưa |sai |vượt|bị chặn|từ chối|hết hạn|không thành công|error|fail/.test(t)) return 'loi';
    if (/thành công|đã (lưu|xử lý|gửi|cập nhật|tạo|xóa|sao chép|thanh toán|xác nhận|hủy|duyệt)|hoàn tất|xong/.test(t)) return 'ok';
    return 'tin';
  }
  var TIEU_DE = { loi: 'Chưa thực hiện được', ok: 'Đã xong', tin: 'Thông báo' };
  var ICON = { loi: '!', ok: '✓', tin: 'i' };

  function luu() {
    try {
      var con = (dangMo ? [dangMo] : []).concat(hang);
      if (con.length) sessionStorage.setItem(KHOA, JSON.stringify(con.slice(0, 5)));
      else sessionStorage.removeItem(KHOA);
    } catch (e) { /* bo qua */ }
  }

  function hienTiep() {
    if (dangMo || !hang.length || !document.body) return;
    dangMo = hang.shift();
    ganCss();
    var loai = dangMo.loai || doanLoai(dangMo.m);
    var nen = document.createElement('div');
    nen.className = 'tbd-nen';
    nen.innerHTML = '<div class="tbd-hop" role="alertdialog" aria-modal="true" aria-labelledby="tbd-td" aria-describedby="tbd-nd" data-loai="' + loai + '">'
      + '<div class="tbd-than"><div class="tbd-icon" aria-hidden="true">' + ICON[loai] + '</div>'
      + '<div class="tbd-chu"><div class="tbd-tieu-de" id="tbd-td"></div><div class="tbd-noi-dung" id="tbd-nd"></div></div></div>'
      + '<div class="tbd-chan"><button type="button" class="tbd-nut">Đã hiểu</button></div></div>';
    nen.querySelector('.tbd-tieu-de').textContent = dangMo.tieuDe || TIEU_DE[loai];
    nen.querySelector('.tbd-noi-dung').textContent = String(dangMo.m == null ? '' : dangMo.m);
    var truoc = document.activeElement;
    function dong() {
      document.removeEventListener('keydown', phim, true);
      nen.classList.remove('is-mo');
      setTimeout(function () { if (nen.parentNode) nen.parentNode.removeChild(nen); }, 180);
      dangMo = null; luu();
      if (truoc && truoc.focus) { try { truoc.focus(); } catch (e) { /* */ } }
      setTimeout(hienTiep, 60);
    }
    function phim(e) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); dong(); }
    }
    nen.querySelector('.tbd-nut').addEventListener('click', dong);
    nen.addEventListener('click', function (e) { if (e.target === nen) dong(); });
    document.addEventListener('keydown', phim, true);
    document.body.appendChild(nen);
    requestAnimationFrame(function () { nen.classList.add('is-mo'); nen.querySelector('.tbd-nut').focus(); });
    luu();
  }

  window.thongBao = function (m, tuyChon) {
    tuyChon = tuyChon || {};
    hang.push({ m: String(m == null ? '' : m), loai: tuyChon.loai || null, tieuDe: tuyChon.tieuDe || null });
    luu();
    if (document.body) hienTiep(); else document.addEventListener('DOMContentLoaded', hienTiep);
  };
  window.alert = function (m) { window.thongBao(m); };

  /* ---------------- HOP XAC NHAN (thay window.confirm) ----------------
     window.xacNhan(noiDung, { dongY, huy, nguyHiem }) -> Promise<boolean>.
     confirm() goc chan dung trang; hop nay khong chan nen ma JS phai `await`.
     Cac cho viet onclick / onsubmit="return confirm(...)" trong HTML duoc bat
     tu dong (xem chanConfirmTrongHtml) - khong can sua tung trang. */
  window.xacNhan = function (m, tc) {
    tc = tc || {};
    return new Promise(function (traVe) {
      ganCss();
      var nguyHiem = tc.nguyHiem != null ? tc.nguyHiem : /xóa|xoá|hủy|huỷ|tắt|khôi phục|ghi đè|toàn bộ|chốt/i.test(String(m));
      var nen = document.createElement('div');
      nen.className = 'tbd-nen';
      nen.innerHTML = '<div class="tbd-hop" role="alertdialog" aria-modal="true" aria-labelledby="tbd-td" aria-describedby="tbd-nd" data-loai="' + (nguyHiem ? 'loi' : 'tin') + '">'
        + '<div class="tbd-than"><div class="tbd-icon" aria-hidden="true">?</div>'
        + '<div class="tbd-chu"><div class="tbd-tieu-de" id="tbd-td"></div><div class="tbd-noi-dung" id="tbd-nd"></div></div></div>'
        + '<div class="tbd-chan"><button type="button" class="tbd-nut tbd-nut--phu">Hủy</button><button type="button" class="tbd-nut tbd-nut--chinh">Đồng ý</button></div></div>';
      nen.querySelector('.tbd-tieu-de').textContent = tc.tieuDe || 'Xác nhận thao tác';
      nen.querySelector('.tbd-noi-dung').textContent = String(m == null ? '' : m);
      if (tc.dongY) nen.querySelector('.tbd-nut--chinh').textContent = tc.dongY;
      if (tc.huy) nen.querySelector('.tbd-nut--phu').textContent = tc.huy;
      var truoc = document.activeElement, xong = false;
      function dong(kq) {
        if (xong) return; xong = true;
        document.removeEventListener('keydown', phim, true);
        nen.classList.remove('is-mo');
        setTimeout(function () { if (nen.parentNode) nen.parentNode.removeChild(nen); }, 180);
        if (truoc && truoc.focus) { try { truoc.focus(); } catch (e) { /* */ } }
        traVe(kq);
      }
      function phim(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dong(false); }
        else if (e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('tbd-nut--chinh')) { e.preventDefault(); e.stopPropagation(); dong(true); }
      }
      nen.querySelector('.tbd-nut--chinh').addEventListener('click', function () { dong(true); });
      nen.querySelector('.tbd-nut--phu').addEventListener('click', function () { dong(false); });
      nen.addEventListener('click', function (e) { if (e.target === nen) dong(false); });
      document.addEventListener('keydown', phim, true);
      document.body.appendChild(nen);
      requestAnimationFrame(function () { nen.classList.add('is-mo'); nen.querySelector(nguyHiem ? '.tbd-nut--phu' : '.tbd-nut--chinh').focus(); });
    });
  };

  // Bat onclick / onsubmit="... confirm(...) ..." viet trong HTML: chan su kien o pha
  // capture (truoc handler inline), lay noi dung cau hoi, hien hop moi; Dong y thi
  // phat lai su kien voi confirm tam tra ve true.
  var choPhep = false;
  function chanConfirmTrongHtml(e) {
    if (choPhep) return;
    var loai = e.type === 'submit' ? 'onsubmit' : 'onclick';
    var el = e.type === 'submit' ? e.target : (e.target.closest && e.target.closest('[onclick]'));
    if (!el || !el.getAttribute) return;
    var ma = el.getAttribute(loai);
    if (!ma || !/confirm\s*\(/.test(ma) || typeof el[loai] !== 'function') return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    var goc = window.confirm, cauHoi = null;
    window.confirm = function (m) { cauHoi = m; return false; };
    try { el[loai].call(el, e); } catch (x) { /* chi can lay cau hoi */ }
    window.confirm = goc;
    if (cauHoi == null) cauHoi = 'Bạn chắc chắn muốn thực hiện thao tác này?';
    var nutGui = e.submitter || null;
    window.xacNhan(cauHoi).then(function (ok) {
      if (!ok) return;
      choPhep = true; window.confirm = function () { return true; };
      try {
        if (e.type === 'submit') { if (el.requestSubmit) el.requestSubmit(nutGui && nutGui.form === el ? nutGui : undefined); else el.submit(); }
        else el.click();
      } finally { window.confirm = goc; choPhep = false; }
    });
  }
  document.addEventListener('submit', chanConfirmTrongHtml, true);
  document.addEventListener('click', chanConfirmTrongHtml, true);

  // Thong bao con dang do khi trang truoc tai lai / chuyen trang -> hien tiep.
  function napThongBaoCho() {
    try {
      var cho = JSON.parse(sessionStorage.getItem(KHOA) || '[]');
      sessionStorage.removeItem(KHOA);
      if (Array.isArray(cho) && cho.length) {
        hang = hang.concat(cho);
        if (document.body) hienTiep(); else document.addEventListener('DOMContentLoaded', hienTiep);
      }
    } catch (e) { /* bo qua */ }
  }
  napThongBaoCho();
  // Quay lai bang history.back() tu bo nho dem (bfcache): script khong chay lai -> nap o day.
  window.addEventListener('pageshow', function (e) { if (e.persisted) napThongBaoCho(); });
})();

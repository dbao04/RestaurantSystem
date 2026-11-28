/*
 * NUT CON MAT CHO MOI O MAT KHAU - bam de hien / an mat khau dang go.
 *
 * Nap o <head> cung thong-bao-dep.js (header khach / nhan vien / quan tri). Tu gan
 * cho moi input[type=password], ke ca o sinh ra sau (hop thoai, form mo them) nho
 * MutationObserver. Khong can sua tung trang.
 *
 * Boc o nhap trong mot the span (giu nguyen be ngang), dat nut o mep phai ben
 * trong o, them padding phai de chu khong chui duoi nut.
 */
(function () {
  if (window.__hienMatKhau) return;
  window.__hienMatKhau = true;

  var MAT = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  var MAT_GACH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10.4 10.4 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  function ganCss() {
    if (document.getElementById('hmk-css')) return;
    var s = document.createElement('style');
    s.id = 'hmk-css';
    s.textContent = [
      '.hmk-boc{position:relative;display:block;width:100%;min-width:0}',
      '.hmk-boc--dong{display:inline-block;width:auto;vertical-align:middle}',
      '.input-group>.hmk-boc{flex:1 1 auto;width:1%}',
      '.hmk-boc>input{padding-right:2.6rem !important}',
      '.hmk-nut{position:absolute;top:50%;right:.45rem;transform:translateY(-50%);z-index:3;display:inline-flex;align-items:center;justify-content:center;',
      'width:2rem;height:2rem;padding:0;margin:0;border:0;border-radius:50%;background:transparent;color:inherit;opacity:.55;cursor:pointer;line-height:0}',
      '.hmk-nut:hover{opacity:.95;background:rgba(127,127,127,.12)}',
      '.hmk-nut:focus-visible{outline:2px solid #c8a24b;outline-offset:1px;opacity:1}',
      '.hmk-nut[aria-pressed=true]{opacity:.9;color:#b8892e}',
      'input.hmk-o::-ms-reveal,input.hmk-o::-ms-clear{display:none}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function gan(o) {
    if (!o || o.dataset.hmk || o.type !== 'password') return;
    if (o.closest && o.closest('.hmk-boc')) return;
    o.dataset.hmk = '1';
    o.classList.add('hmk-o');
    ganCss();
    var cs = window.getComputedStyle(o);
    var boc = document.createElement('span');
    boc.className = 'hmk-boc';
    // O hien inline voi be ngang co dinh (khong gian ca hang) -> boc inline-block
    if (/^inline/.test(cs.display) && o.parentElement && o.offsetWidth && o.offsetWidth < o.parentElement.clientWidth * 0.9) {
      boc.className += ' hmk-boc--dong';
    }
    // Bieu tuong nam DE len o (vd o khoa ben trai, absolute theo khung cha): GIU NGUYEN cho
    // (kieu dang trang thuong viet theo cau truc "> i"), chi nang len tren lop boc
    // (position: relative, dung sau trong DOM) de khong bi ve de mat.
    var cha = o.parentNode;
    [].slice.call(cha.children).forEach(function (x) {
      if (x === o || x.tagName === 'LABEL' || x.tagName === 'INPUT') return;
      var csx = window.getComputedStyle(x);
      if (csx.position === 'absolute' && (csx.zIndex === 'auto' || Number(csx.zIndex) < 4)) { x.style.zIndex = '4'; x.style.pointerEvents = x.style.pointerEvents || 'none'; }
    });
    cha.insertBefore(boc, o);
    boc.appendChild(o);

    var nut = document.createElement('button');
    nut.type = 'button';
    nut.className = 'hmk-nut';
    nut.setAttribute('aria-label', 'Hiện mật khẩu');
    nut.setAttribute('aria-pressed', 'false');
    nut.title = 'Hiện mật khẩu';
    nut.innerHTML = MAT;
    nut.addEventListener('mousedown', function (e) { e.preventDefault(); }); // khong lam mat focus o nhap
    nut.addEventListener('click', function () {
      var hien = o.type === 'password';
      var dau = o.selectionStart, cuoi = o.selectionEnd;
      o.type = hien ? 'text' : 'password';
      nut.innerHTML = hien ? MAT_GACH : MAT;
      nut.setAttribute('aria-pressed', String(hien));
      nut.setAttribute('aria-label', hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      nut.title = hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
      try { o.focus(); if (dau != null) o.setSelectionRange(dau, cuoi); } catch (e) { /* mot so trinh duyet khong cho */ }
    });
    boc.appendChild(nut);
    // Gui form: tra ve type password de trinh duyet / trinh quan ly mat khau xu ly dung
    if (o.form && !o.form.dataset.hmk) {
      o.form.dataset.hmk = '1';
      o.form.addEventListener('submit', function () {
        o.form.querySelectorAll('input.hmk-o').forEach(function (x) { x.type = 'password'; });
      });
    }
  }

  function quet(goc) {
    (goc || document).querySelectorAll('input[type=password]').forEach(gan);
  }

  function batDau() {
    quet();
    try {
      new MutationObserver(function (ds) {
        for (var i = 0; i < ds.length; i++) {
          var them = ds[i].addedNodes;
          for (var j = 0; j < them.length; j++) {
            var n = them[j];
            if (n.nodeType !== 1) continue;
            if (n.matches && n.matches('input[type=password]')) gan(n); else if (n.querySelectorAll) quet(n);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* trinh duyet cu */ }
  }
  if (document.body) batDau(); else document.addEventListener('DOMContentLoaded', batDau);
})();

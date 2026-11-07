/**
 * BANG CUON NGANG TREN DIEN THOAI - dung chung cho khu nhan vien va quan tri.
 *
 * Phan lon trang quan ly co bang 5-9 cot. Tren man 390px trinh duyet bop cot
 * lai den muc chu xuong dong tung ky tu ("Da nh sa ch..."), hoac layout cat mat
 * cac cot ben phai. Boc moi bang vao mot khung `overflow-x: auto` de khach vuot
 * ngang xem het cot, con trang thi khong bi tran.
 *
 * Bo qua bang da nam trong vung cuon san co (.table-responsive, DataTables
 * scrollX). Chay lai khi DOM doi vi nhieu trang ve bang bang JavaScript sau khi
 * tai du lieu.
 */
(function () {
  var DA_CUON = '.qt-cuon-ngang, .table-responsive, .dataTables_scrollBody, .dataTables_scrollHead, .no-cuon';

  function boc() {
    var ds = document.querySelectorAll('table');
    for (var i = 0; i < ds.length; i++) {
      var t = ds[i];
      if (t.closest(DA_CUON)) continue;
      var khung = document.createElement('div');
      khung.className = 'qt-cuon-ngang';
      t.parentNode.insertBefore(khung, t);
      khung.appendChild(t);
    }
  }

  var hen = null;
  function henBoc() { clearTimeout(hen); hen = setTimeout(boc, 120); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boc);
  else boc();
  window.addEventListener('load', boc);
  if ('MutationObserver' in window) {
    new MutationObserver(function (ds) {
      for (var i = 0; i < ds.length; i++) {
        if (ds[i].addedNodes.length) { henBoc(); return; }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();

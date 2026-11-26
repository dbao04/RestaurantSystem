/*
  Danh sach goi y nguyen lieu (.kb-chon-nl__ds) nam trong bang co vung cuon
  (.table-responsive). Vung cuon cat mat moi thu tran ra ngoai, nen danh sach
  o dong cuoi bi che va de len nut "Them dong".

  Cach sua: khi danh sach hien, dat no position:fixed theo toa do cua o nhap,
  thoat han khoi vung cuon. Khong du cho phia duoi thi mo len tren.
  Khong can sua ma JS cua tung trang - chi theo doi thuoc tinh `hidden`.
*/
(function () {
  var KHOANG = 4;

  function datViTri(ds) {
    if (ds.hidden) return;
    var o = ds.parentElement && ds.parentElement.querySelector('.o-nl');
    if (!o) return;
    var r = o.getBoundingClientRect();
    var cao = Math.min(ds.scrollHeight || 260, 260);
    var duoi = window.innerHeight - r.bottom - KHOANG;
    var tren = r.top - KHOANG;
    ds.classList.add('is-noi');
    ds.style.left = r.left + 'px';
    ds.style.width = r.width + 'px';
    if (duoi < cao && tren > duoi) {
      ds.style.top = 'auto';
      ds.style.bottom = (window.innerHeight - r.top + KHOANG) + 'px';
      ds.style.maxHeight = Math.min(260, tren) + 'px';
    } else {
      ds.style.bottom = 'auto';
      ds.style.top = (r.bottom + KHOANG) + 'px';
      ds.style.maxHeight = Math.max(120, Math.min(260, duoi)) + 'px';
    }
  }

  function datTatCa() {
    document.querySelectorAll('.kb-chon-nl__ds:not([hidden])').forEach(datViTri);
  }

  new MutationObserver(function (ds) {
    ds.forEach(function (m) {
      var el = m.target;
      if (el.nodeType === 1 && el.classList.contains('kb-chon-nl__ds')) datViTri(el);
    });
  }).observe(document.documentElement, {
    subtree: true, attributes: true, attributeFilter: ['hidden'], childList: false,
  });

  // Noi dung danh sach doi (go them chu) -> chieu cao doi -> tinh lai.
  document.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('o-nl')) requestAnimationFrame(datTatCa);
  }, true);
  window.addEventListener('scroll', datTatCa, true);
  window.addEventListener('resize', datTatCa);
})();

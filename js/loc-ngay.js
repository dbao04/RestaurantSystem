/**
 * BO CHON NHANH THOI GIAN dung chung cho moi bo loc ngay trong he thong.
 *
 * Tu gan vao:
 *   - Moi cap o ngay "tu - den" (name/id: tu|tu_ngay ... den|den_ngay) trong cung
 *     form (hoac khung .nh-filter): Hom nay, Hom qua, Tuan nay, Tuan truoc,
 *     Thang nay, Thang truoc. Hai o ngay van giu de tu chon khoang bat ky.
 *   - O ngay don co data-loc-ngay="mot" (trang xem theo mot ngay): Hom nay, Hom qua.
 *   - Cap select thang/nam co data-loc-thang (trang bao cao theo thang): Thang nay, Thang truoc.
 * Bam nut: dien ngay roi gui form (GET) - hoac goi window.taiLai() voi trang loc bang JS.
 * Tuan tinh tu thu Hai den Chu nhat.
 */
(function () {
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  var chuoi = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var cong = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function khoang(ma) {
    var nay = new Date(); nay.setHours(0, 0, 0, 0);
    var thu = (nay.getDay() + 6) % 7; // 0 = thu Hai
    var dauTuan = cong(nay, -thu);
    switch (ma) {
      case 'hom_nay': return [nay, nay];
      case 'hom_qua': return [cong(nay, -1), cong(nay, -1)];
      case 'tuan_nay': return [dauTuan, nay];
      case 'tuan_truoc': return [cong(dauTuan, -7), cong(dauTuan, -1)];
      case 'thang_nay': return [new Date(nay.getFullYear(), nay.getMonth(), 1), nay];
      case 'thang_truoc': return [new Date(nay.getFullYear(), nay.getMonth() - 1, 1), new Date(nay.getFullYear(), nay.getMonth(), 0)];
    }
    return null;
  }
  var NUT_KHOANG = [['hom_nay', 'Hôm nay'], ['hom_qua', 'Hôm qua'], ['tuan_nay', 'Tuần này'], ['tuan_truoc', 'Tuần trước'], ['thang_nay', 'Tháng này'], ['thang_truoc', 'Tháng trước']];

  // CSS mot lan, dung mau ke thua de hop ca giao dien sang / toi cua tung trang.
  var css = document.createElement('style');
  css.textContent =
    '.loc-nhanh{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;flex-basis:100%;width:100%;margin:0 0 .5rem}' +
    '.loc-nhanh__nhan{font-size:.78rem;opacity:.75;margin-right:.15rem}' +
    '.loc-nhanh button{font:inherit;font-size:.8rem;line-height:1.2;padding:.32rem .7rem;border-radius:999px;border:1px solid rgba(200,162,75,.55);' +
    'background:transparent;color:inherit;cursor:pointer;white-space:nowrap}' +
    '.loc-nhanh button:hover{background:rgba(200,162,75,.14)}' +
    '.loc-nhanh button[aria-pressed="true"]{background:#c8a24b;border-color:#c8a24b;color:#1f1a17;font-weight:700}' +
    '.loc-nhanh button:focus-visible{outline:2px solid #c8a24b;outline-offset:2px}';
  document.head.appendChild(css);

  function apDung(o) {
    var form = o.closest('form');
    if (form && (form.method || 'get').toLowerCase() === 'get') {
      if (form.requestSubmit) form.requestSubmit(); else form.submit();
      return;
    }
    o.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof window.taiLai === 'function') window.taiLai();
  }
  function taoNhom(dsNut, khiBam, dangChon) {
    var g = document.createElement('div');
    g.className = 'loc-nhanh'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Chọn nhanh thời gian');
    g.innerHTML = '<span class="loc-nhanh__nhan">Chọn nhanh:</span>' + dsNut.map(function (n) {
      return '<button type="button" data-ma="' + n[0] + '" aria-pressed="' + (dangChon === n[0]) + '">' + n[1] + '</button>';
    }).join('');
    g.addEventListener('click', function (e) { var b = e.target.closest('button[data-ma]'); if (b) khiBam(b.getAttribute('data-ma')); });
    return g;
  }
  // Chen nhom nut truoc "o bao" cua o ngay dau tien (label / .form-group / .nh-field...).
  function viTriChen(o, khung) {
    var el = o;
    while (el.parentElement && el.parentElement !== khung && !/^(FORM)$/.test(el.parentElement.tagName)) el = el.parentElement;
    return el;
  }
  var ten = function (o) { return (o.name || o.id || '').toLowerCase(); };

  // 1. Cap tu - den
  var daGan = new Set();
  document.querySelectorAll('input[type="date"]').forEach(function (tu) {
    // data-loc-ngay="tat": trang da co hang nut nhanh rieng.
    if (daGan.has(tu) || tu.getAttribute('data-loc-ngay') === 'tat' || !/^(tu|tu_ngay|from|tungay)$/.test(ten(tu))) return;
    var khung = tu.closest('form') || tu.closest('.nh-filter') || tu.parentElement.parentElement;
    if (!khung) return;
    var den = Array.prototype.slice.call(khung.querySelectorAll('input[type="date"]')).filter(function (o) { return /^(den|den_ngay|to|denngay)$/.test(ten(o)); })[0];
    if (!den) return;
    daGan.add(tu); daGan.add(den);
    var hienTai = NUT_KHOANG.map(function (n) { return n[0]; }).filter(function (m) {
      var k = khoang(m); return tu.value === chuoi(k[0]) && den.value === chuoi(k[1]);
    })[0] || '';
    var nhom = taoNhom(NUT_KHOANG, function (ma) {
      var k = khoang(ma);
      tu.value = chuoi(k[0]); den.value = chuoi(k[1]);
      // O co max = hom nay: khoang khong vuot.
      nhom.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ma') === ma)); });
      apDung(den);
    }, hienTai);
    var dich = viTriChen(tu, khung);
    dich.parentElement.insertBefore(nhom, dich);
  });

  // 2. O ngay don (data-loc-ngay="mot")
  document.querySelectorAll('input[type="date"][data-loc-ngay="mot"]').forEach(function (o) {
    var dsNut = [['hom_nay', 'Hôm nay'], ['hom_qua', 'Hôm qua']];
    var hienTai = dsNut.map(function (n) { return n[0]; }).filter(function (m) { return o.value === chuoi(khoang(m)[0]); })[0] || '';
    var nhom = taoNhom(dsNut, function (ma) {
      o.value = chuoi(khoang(ma)[0]);
      nhom.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ma') === ma)); });
      apDung(o);
    }, hienTai);
    nhom.style.flexBasis = 'auto'; nhom.style.width = 'auto'; nhom.style.margin = '0 .5rem 0 0';
    o.parentElement.insertBefore(nhom, o);
  });

  // 3. Cap select thang / nam (data-loc-thang tren select thang)
  document.querySelectorAll('input[type="month"][data-loc-thang]').forEach(function (o) {
    var nay = new Date(), truoc = new Date(nay.getFullYear(), nay.getMonth() - 1, 1);
    var gt = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1); };
    var dsNut = [['thang_nay', 'Tháng này'], ['thang_truoc', 'Tháng trước']];
    var nhom = taoNhom(dsNut, function (ma) { o.value = gt(ma === 'thang_nay' ? nay : truoc); apDung(o); },
      o.value === gt(nay) ? 'thang_nay' : o.value === gt(truoc) ? 'thang_truoc' : '');
    nhom.style.flexBasis = 'auto'; nhom.style.width = 'auto'; nhom.style.margin = '0 .5rem 0 0';
    o.parentElement.insertBefore(nhom, o);
  });
  document.querySelectorAll('select[data-loc-thang]').forEach(function (selThang) {
    var khung = selThang.closest('form') || selThang.parentElement;
    var selNam = khung.querySelector('[data-loc-nam]');
    var nay = new Date();
    var truoc = new Date(nay.getFullYear(), nay.getMonth() - 1, 1);
    var dsNut = [['thang_nay', 'Tháng này'], ['thang_truoc', 'Tháng trước']];
    var laThang = function (d) { return Number(selThang.value) === d.getMonth() + 1 && (!selNam || Number(selNam.value) === d.getFullYear()); };
    var hienTai = laThang(nay) ? 'thang_nay' : laThang(truoc) ? 'thang_truoc' : '';
    var nhom = taoNhom(dsNut, function (ma) {
      var d = ma === 'thang_nay' ? nay : truoc;
      selThang.value = String(d.getMonth() + 1);
      if (selNam) {
        if (selNam.options && !Array.prototype.some.call(selNam.options, function (x) { return Number(x.value) === d.getFullYear(); })) selNam.add(new Option(String(d.getFullYear()), String(d.getFullYear())));
        selNam.value = String(d.getFullYear());
      }
      apDung(selThang);
    }, hienTai);
    nhom.style.flexBasis = 'auto'; nhom.style.width = 'auto'; nhom.style.margin = '0 .5rem 0 0';
    selThang.parentElement.insertBefore(nhom, selThang);
  });
})();

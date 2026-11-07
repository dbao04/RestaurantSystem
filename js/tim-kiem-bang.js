/**
 * O TIM KIEM DUNG CHUNG cho cac danh sach (bang, list-group, the).
 *
 * Cach dung - chi can danh dau HTML, khong viet JS rieng tung trang:
 *
 *   <input data-tim-kiem="#bangNVL" placeholder="Tìm...">
 *   <table id="bangNVL"> ... <tbody><tr>...</tr></tbody> </table>
 *
 *   - Muc tieu la <table>: loc cac <tr> trong <tbody>.
 *   - Muc tieu la phan tu khac: loc cac con co [data-tim-muc], neu khong co thi
 *     loc moi con truc tiep (list-group-item, the combo...).
 *   - data-tim-dem="#id": noi hien "12 / 135 kết quả".
 *   - Them data-tim-text="..." vao mot dong de tim theo noi dung an (ma, ten khac).
 *
 * Tim KHONG DAU va khong phan biet hoa thuong: go "ca hoi" ra "Cá hồi",
 * go "nuoc tuong" ra "Nước tương Nhật". Nhieu tu thi phai khop TAT CA.
 * Phim Esc xoa o tim. Phim "/" nhay vao o tim dau tien tren trang.
 */
(function () {
  function boDau(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  function cacMuc(dich) {
    if (dich.tagName === 'TABLE') {
      return Array.prototype.slice.call(dich.querySelectorAll('tbody > tr'))
        .filter(function (tr) { return !tr.hasAttribute('data-tim-bo-qua'); });
    }
    var co = dich.querySelectorAll('[data-tim-muc]');
    return Array.prototype.slice.call(co.length ? co : dich.children);
  }

  function ganO(o) {
    var chon = o.getAttribute('data-tim-kiem');
    var dich = document.querySelector(chon);
    if (!dich) return;
    var dem = o.getAttribute('data-tim-dem') ? document.querySelector(o.getAttribute('data-tim-dem')) : null;
    var rong = null;

    function loc() {
      var tu = boDau(o.value).trim().split(/\s+/).filter(Boolean);
      var ds = cacMuc(dich);
      var hien = 0;
      ds.forEach(function (el) {
        if (el.hasAttribute('data-tim-trong')) return;
        var noi = boDau((el.getAttribute('data-tim-text') || '') + ' ' + el.textContent);
        var khop = tu.every(function (t) { return noi.indexOf(t) >= 0; });
        el.hidden = !khop;
        if (khop) hien++;
      });
      if (dem) dem.textContent = tu.length ? hien + ' / ' + ds.length + ' kết quả' : ds.length + ' mục';
      // Dong "khong tim thay"
      if (!rong) {
        rong = document.createElement(dich.tagName === 'TABLE' ? 'tr' : 'div');
        rong.setAttribute('data-tim-trong', '');
        rong.setAttribute('data-tim-bo-qua', '');
        rong.className = 'tim-kiem-rong';
        if (dich.tagName === 'TABLE') {
          var td = document.createElement('td');
          td.colSpan = 50;
          td.className = 'text-center text-muted py-4';
          rong.appendChild(td);
          (dich.querySelector('tbody') || dich).appendChild(rong);
        } else {
          rong.style.cssText = 'padding:1.2rem;text-align:center;color:#8a7d70';
          dich.appendChild(rong);
        }
      }
      (rong.firstChild && rong.firstChild.nodeType === 1 ? rong.firstChild : rong).textContent =
        'Không tìm thấy kết quả cho "' + o.value.trim() + '"';
      rong.hidden = !(tu.length && hien === 0);
    }

    o.addEventListener('input', loc);
    o.addEventListener('keydown', function (e) { if (e.key === 'Escape') { o.value = ''; loc(); } });
    o._timLai = loc;
    loc();
  }

  function khoiTao() {
    document.querySelectorAll('[data-tim-kiem]').forEach(function (o) { if (!o._timLai) ganO(o); });
  }
  window.timKiemLaiBang = function () { document.querySelectorAll('[data-tim-kiem]').forEach(function (o) { if (o._timLai) o._timLai(); }); };

  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    var o = document.querySelector('[data-tim-kiem]');
    if (o) { e.preventDefault(); o.focus(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoiTao); else khoiTao();
})();

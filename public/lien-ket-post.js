/*
 * Bien cac lien ket co thuoc tinh `data-post` thanh mot lan gui form POST.
 *
 * Cac thao tac xoa/huy truoc day la link GET (<a href="/admin/catdel/5">). GET
 * khong duoc phep thay doi du lieu: trinh duyet tai truoc trang, mot the <img
 * src="..."> tren trang la, hay ai do gui link cho nhan vien bam la du xoa
 * mat du lieu. May chu nay chi nhan cac duong dan do bang POST.
 *
 * Giu nguyen the <a> va `onclick="return confirm(...)"` san co: neu nguoi
 * dung bam Huy thi confirm tra false -> su kien da bi chan (defaultPrevented)
 * va o day khong lam gi. Dung uy quyen su kien tren document nen ap dung ca
 * cho link sinh ra bang JavaScript sau khi trang tai xong.
 */
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-post]') : null;
    if (!a || e.defaultPrevented) return;
    e.preventDefault();

    var form = document.createElement('form');
    form.method = 'POST';
    form.action = a.getAttribute('href');
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
  });
})();

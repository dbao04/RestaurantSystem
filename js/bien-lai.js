/**
 * BIEN LAI THANH TOAN - hop noi kieu bien lai chuyen khoan cua ngan hang.
 *
 *   BienLai.mo({ ma, id?, nutTiep?: { chu, href } , khiDong? })
 *       -> lay /api/bien-lai?ma=... va hien giao dich moi nhat (hoac id).
 *   BienLai.tuDongMo({ ma, nutTiep? })
 *       -> chi mo neu co giao dich thanh cong trong 30 phut qua ma chua xem
 *          tren may nay (dung cho trang tai lai sau khi thanh toan).
 * Nut "Luu anh" chup bien lai thanh PNG (html2canvas nap khi bam), loi thi in.
 */
(function () {
  if (window.BienLai) return;
  var CSS =
    '.bl-nen{position:fixed;inset:0;z-index:99999;background:rgba(15,12,10,.62);display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow-y:auto;animation:blHien .2s ease}' +
    '@keyframes blHien{from{opacity:0}to{opacity:1}}@keyframes blTich{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}' +
    '.bl-hop{width:100%;max-width:400px;margin:auto 0;font-family:"Plus Jakarta Sans","Montserrat",system-ui,sans-serif;color:#1d2433}' +
    '.bl-giay{background:#fff;border-radius:18px 18px 0 0;padding:26px 22px 18px;position:relative;box-shadow:0 18px 50px rgba(0,0,0,.35)}' +
    '.bl-rang{height:10px;background:linear-gradient(135deg,#fff 50%,transparent 50%) 0 0/14px 10px repeat-x,linear-gradient(225deg,#fff 50%,transparent 50%) 0 0/14px 10px repeat-x;filter:drop-shadow(0 4px 4px rgba(0,0,0,.15))}' +
    '.bl-logo{display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a07d2c;margin-bottom:14px}' +
    '.bl-tich{width:64px;height:64px;border-radius:50%;margin:0 auto 10px;background:#12b76a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 0 0 8px rgba(18,183,106,.14);animation:blTich .45s ease .05s both}' +
    '.bl-tieu{text-align:center;font-size:1.02rem;font-weight:700;color:#12b76a;margin:0 0 4px}' +
    '.bl-tien{text-align:center;font-size:2rem;font-weight:800;letter-spacing:-.02em;margin:2px 0 2px;font-variant-numeric:tabular-nums;color:#101828}' +
    '.bl-tien small{font-size:.95rem;font-weight:700;color:#475467;margin-left:4px}' +
    '.bl-chu{text-align:center;font-size:.8rem;font-style:italic;color:#667085;margin:0 8px 4px}' +
    '.bl-luc{text-align:center;font-size:.82rem;color:#667085;margin-bottom:16px}' +
    '.bl-vach{border:0;border-top:1.5px dashed #d0d5dd;margin:4px -22px 10px;position:relative}' +
    '.bl-dong{display:flex;justify-content:space-between;gap:14px;padding:8px 0;font-size:.86rem;border-bottom:1px solid #f2f4f7}' +
    '.bl-dong:last-child{border-bottom:0}.bl-dong span{color:#667085;flex:0 0 auto}.bl-dong b{text-align:right;font-weight:600;color:#101828;word-break:break-word}' +
    '.bl-dong b em{display:block;font-style:normal;font-weight:500;font-size:.78rem;color:#667085}' +
    '.bl-chan{text-align:center;font-size:.74rem;color:#98a2b3;margin-top:12px;line-height:1.5}' +
    '.bl-nut{display:flex;gap:10px;margin-top:16px}.bl-nut button,.bl-nut a{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:46px;border-radius:12px;font:inherit;font-weight:700;font-size:.9rem;cursor:pointer;text-decoration:none;border:1.5px solid rgba(255,255,255,.55);background:transparent;color:#fff}' +
    '.bl-nut .bl-chinh{background:#c8a24b;border-color:#c8a24b;color:#1f1a17}.bl-nut button:focus-visible,.bl-nut a:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
    '.bl-nhieu{display:flex;gap:6px;justify-content:center;margin:0 0 12px;flex-wrap:wrap}.bl-nhieu button{border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;border-radius:999px;padding:4px 12px;font:inherit;font-size:.78rem;cursor:pointer}.bl-nhieu button[aria-pressed="true"]{background:#fff;color:#1d2433}' +
    '@media print{body>*:not(.bl-nen){display:none!important}.bl-nen{position:static;background:none;padding:0}.bl-nut,.bl-nhieu{display:none!important}.bl-giay{box-shadow:none}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var tien = function (n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); };
  var gio = function (s) {
    var d = new Date(s); if (isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' · ' + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  };
  function giay(b) {
    var nn = b.nguoi_nhan || {};
    var dong = [
      ['Loại giao dịch', esc(b.loai)],
      ['Mã đơn', esc(b.ma_don)],
      ['Nội dung', esc(b.noi_dung)],
      ['Người nhận', esc(nn.ten) + (nn.so_tai_khoan ? '<em>' + esc(nn.ngan_hang || '') + ' · ' + esc(nn.so_tai_khoan) + '</em>' : '')],
      ['Phương thức', esc(b.phuong_thuc)],
      ['Mã giao dịch', esc(b.ma_giao_dich)],
    ];
    if (b.giam_gia > 0) dong.push(['Đã giảm', tien(b.giam_gia) + ' đ']);
    if (b.tien_tip > 0) dong.push(['Tiền tip', tien(b.tien_tip) + ' đ']);
    return '<div class="bl-giay" id="blGiay">' +
      '<div class="bl-logo"><i class="fas fa-bell-concierge" aria-hidden="true"></i> Nhà hàng Bảo Đoàn</div>' +
      '<div class="bl-tich" aria-hidden="true"><i class="fas fa-check"></i></div>' +
      '<p class="bl-tieu">Giao dịch thành công</p>' +
      '<div class="bl-tien">' + tien(b.so_tien) + '<small>VND</small></div>' +
      '<div class="bl-chu">' + esc(b.bang_chu) + '</div>' +
      '<div class="bl-luc">' + gio(b.luc) + '</div>' +
      '<hr class="bl-vach">' +
      dong.map(function (d) { return '<div class="bl-dong"><span>' + d[0] + '</span><b>' + d[1] + '</b></div>'; }).join('') +
      '<div class="bl-chan">Biên lai điện tử do hệ thống nhà hàng phát hành.<br>Vui lòng giữ lại để đối chiếu khi cần.</div>' +
      '</div><div class="bl-rang"></div>';
  }
  function dong(nen, khiDong) { nen.remove(); document.body.style.overflow = ''; if (typeof khiDong === 'function') khiDong(); }
  function luuAnh(b) {
    var el = document.getElementById('blGiay');
    var chup = function () {
      window.html2canvas(el, { backgroundColor: '#ffffff', scale: 2 }).then(function (c) {
        var a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'bien-lai-' + (b.ma_don || 'thanh-toan') + '-' + b.id + '.png'; a.click();
      }).catch(function () { window.print(); });
    };
    if (window.html2canvas) return chup();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = chup; s.onerror = function () { window.print(); };
    document.head.appendChild(s);
  }
  function hien(ds, chiSo, o) {
    var cu = document.querySelector('.bl-nen'); if (cu) cu.remove();
    var b = ds[chiSo];
    var nen = document.createElement('div');
    nen.className = 'bl-nen'; nen.setAttribute('role', 'dialog'); nen.setAttribute('aria-modal', 'true'); nen.setAttribute('aria-label', 'Biên lai thanh toán');
    var chon = ds.length > 1 ? '<div class="bl-nhieu">' + ds.map(function (x, i) {
      return '<button type="button" data-i="' + i + '" aria-pressed="' + (i === chiSo) + '">' + esc(x.loai.split(' ')[0] + ' ' + x.loai.split(' ')[1]) + ' · ' + tien(x.so_tien) + 'đ</button>';
    }).join('') + '</div>' : '';
    var tiep = o.nutTiep && o.nutTiep.href ? '<a class="bl-chinh" href="' + esc(o.nutTiep.href) + '">' + esc(o.nutTiep.chu || 'Tiếp tục') + '</a>' : '<button type="button" class="bl-chinh" data-dong>Đóng</button>';
    nen.innerHTML = '<div class="bl-hop">' + chon + giay(b) +
      '<div class="bl-nut"><button type="button" data-luu><i class="fas fa-download" aria-hidden="true"></i> Lưu ảnh</button>' + tiep + '</div></div>';
    document.body.appendChild(nen); document.body.style.overflow = 'hidden';
    try { localStorage.setItem('bl_da_xem_' + b.id, '1'); } catch (e) { /* bo qua */ }
    nen.addEventListener('click', function (e) {
      if (e.target === nen || e.target.closest('[data-dong]')) return dong(nen, o.khiDong);
      if (e.target.closest('[data-luu]')) return luuAnh(b);
      var c = e.target.closest('[data-i]'); if (c) hien(ds, Number(c.getAttribute('data-i')), o);
    });
    document.addEventListener('keydown', function thoat(e) { if (e.key === 'Escape' && document.body.contains(nen)) { document.removeEventListener('keydown', thoat); dong(nen, o.khiDong); } });
    var f = nen.querySelector('.bl-chinh'); if (f) f.focus();
  }
  function lay(o) {
    return fetch('/api/bien-lai?ma=' + encodeURIComponent(o.ma) + (o.id ? '&id=' + encodeURIComponent(o.id) : ''), { cache: 'no-store' })
      .then(function (r) { return r.json(); }).then(function (j) { return (j && j.bien_lai) || []; });
  }
  window.BienLai = {
    /** Mo bien lai; tra Promise<boolean> (co bien lai hay khong). Thu lai vai lan vi webhook co the ghi tre. */
    mo: function (o) {
      o = o || {};
      var lan = 0;
      return (function thu() {
        return lay(o).then(function (ds) {
          if (ds.length) { hien(ds, 0, o); return true; }
          if (++lan < (o.thuLai == null ? 4 : o.thuLai)) return new Promise(function (r) { setTimeout(r, 1200); }).then(thu);
          if (o.nutTiep && o.nutTiep.href) location.href = o.nutTiep.href;
          return false;
        }).catch(function () { if (o.nutTiep && o.nutTiep.href) location.href = o.nutTiep.href; return false; });
      })();
    },
    tuDongMo: function (o) {
      o = o || {};
      return lay(o).then(function (ds) {
        var b = ds[0]; if (!b) return false;
        var moi = Date.now() - new Date(b.luc).getTime() < 30 * 60 * 1000, daXem = false;
        try { daXem = localStorage.getItem('bl_da_xem_' + b.id) === '1'; } catch (e) { /* bo qua */ }
        if (moi && !daXem) { hien(ds, 0, o); return true; }
        return false;
      }).catch(function () { return false; });
    },
  };
})();

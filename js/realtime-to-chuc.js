/**
 * Thu vien thoi gian thuc dung chung cho moi trang nhan vien.
 *
 * Nap mot lan trong views/staff/partials/header.ejs, sau do:
 *
 *   RT.khi('viec:moi', function (d) { ... })       dang ky nghe su kien
 *   RT.thongBao('Đã lưu', 'thanh-cong')            hien toast
 *   RT.dongBo('#bang', '/api/...', ve)             tu tai lai khi co su kien
 *
 * KHONG tu khai bao danh tinh. Server doc phien dang nhap tu cookie nen client
 * khong the gia mao la nguoi khac - khac voi cach cu la client tu gui role len.
 */
(function (global) {
  'use strict';

  if (typeof io === 'undefined') {
    console.warn('[RT] chưa nạp socket.io client, bỏ qua realtime');
    global.RT = {
      khi: function () {}, thongBao: function () {}, dongBo: function () {},
      dongBoTrang: function () { return function () {}; }, nhacTaiLai: function () {},
      san_sang: false,
    };
    return;
  }

  var socket = io({ transports: ['websocket', 'polling'] });
  var nghe = {};      // ten su kien -> [ham]
  var hoSo = null;

  // ------------------------------------------------------------------ Toast
  var boToast = null;
  function taoBoToast() {
    if (boToast) return boToast;
    boToast = document.createElement('div');
    boToast.id = 'rt-toast';
    boToast.style.cssText =
      'position:fixed;top:16px;right:16px;z-index:99999;display:flex;' +
      'flex-direction:column;gap:10px;max-width:380px;pointer-events:none';
    document.body.appendChild(boToast);
    return boToast;
  }

  var MAU = {
    'thanh-cong': ['#198754', 'fa-check-circle'],
    'loi':        ['#dc3545', 'fa-exclamation-circle'],
    'canh-bao':   ['#fd7e14', 'fa-exclamation-triangle'],
    'khan':       ['#dc3545', 'fa-bell'],
    'tin':        ['#0d6efd', 'fa-info-circle'],
  };

  function thongBao(noiDung, loai, tieuDe) {
    var cfg = MAU[loai] || MAU.tin;
    var el = document.createElement('div');
    el.style.cssText =
      'pointer-events:auto;background:#fff;border-left:4px solid ' + cfg[0] + ';' +
      'border-radius:8px;box-shadow:0 .4rem 1.4rem rgba(58,59,69,.22);padding:12px 14px;' +
      'font-size:13.5px;line-height:1.5;color:#3a3b45;opacity:0;transform:translateX(24px);' +
      'transition:opacity .22s,transform .22s';
    el.innerHTML =
      '<div style="display:flex;gap:10px;align-items:flex-start">' +
        '<i class="fas ' + cfg[1] + '" style="color:' + cfg[0] + ';margin-top:2px"></i>' +
        '<div style="flex:1">' +
          (tieuDe ? '<div style="font-weight:700;margin-bottom:2px">' + escapeHtml(tieuDe) + '</div>' : '') +
          '<div>' + escapeHtml(noiDung) + '</div>' +
        '</div>' +
        '<span style="cursor:pointer;color:#b7b9cc;font-weight:700">&times;</span>' +
      '</div>';

    taoBoToast().appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'none'; });

    var xoa = function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(24px)';
      setTimeout(function () { el.remove(); }, 240);
    };
    el.querySelector('span').onclick = xoa;
    setTimeout(xoa, loai === 'khan' ? 12000 : 5200);
    return el;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ------------------------------------------------------------------- Am thanh
  /** Chuong cho viec khan. Dung file san co trong /public/sounds neu co. */
  function keu() {
    try {
      var a = new Audio('/sounds/notification.mp3');
      a.volume = 0.5;
      a.play().catch(function () {});
    } catch (e) { /* trinh duyet chan tu dong phat - bo qua */ }
  }

  // ------------------------------------------------------------------- Dang ky
  function khi(ten, ham) {
    if (!nghe[ten]) {
      nghe[ten] = [];
      socket.on(ten, function (d) {
        (nghe[ten] || []).forEach(function (f) {
          try { f(d); } catch (e) { console.error('[RT] lỗi xử lý ' + ten, e); }
        });
      });
    }
    nghe[ten].push(ham);
  }

  /**
   * Tu tai lai du lieu moi khi co su kien lam no cu.
   *
   * Gom nhieu su kien den lien tiep trong 250ms thanh MOT lan tai - luc cao diem
   * bep co the ban vai chuc su kien mot giay, khong the goi API tung lan.
   */
  function dongBo(duongDan, ve, cacSuKien) {
    var hen = null;
    var dangTai = false;

    function tai() {
      if (dangTai) return;
      dangTai = true;
      fetch(duongDan, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.status)); })
        .then(function (d) { ve(d); })
        .catch(function (e) { console.warn('[RT] không tải được ' + duongDan, e.message); })
        .then(function () { dangTai = false; });
    }

    (cacSuKien || []).forEach(function (sk) {
      khi(sk, function () {
        clearTimeout(hen);
        hen = setTimeout(tai, 250);
      });
    });

    tai();
    return tai;
  }

  /**
   * Lam moi mot VUNG cua trang render san, khong tai lai ca trang.
   *
   * VI SAO CAN CAI NAY
   * ------------------
   * `dongBo()` o tren chi dung duoc voi trang tu ve bang JavaScript tu mot API
   * JSON. Nhung phan lon he thong - kho, thuc don, dat ban, luong, cham cong,
   * ca khu /admin - la trang EJS render san, khong co API JSON nao ca. Viet
   * them ba muoi API chi de moi cai bang tu cap nhat la khong dang.
   *
   * Cach o day: khi co su kien, goi lai CHINH URL dang xem, tach lay vung noi
   * dung trong HTML tra ve va trao vao. Server van la nguon su that duy nhat,
   * quyen van do chinh route do kiem tra - neu phien het han thi HTML tra ve la
   * trang dang nhap, khong tim thay vung noi dung, va ta bo qua thay vi trao
   * bua vao man hinh.
   *
   * KHONG GIAT TAY NGUOI DUNG
   * -------------------------
   * Trao noi dung ngay giua luc ai do dang go dang dang hay dang mo hop thoai
   * la mat du lieu ho vua nhap. Nen khi phat hien dang ban thi HOAN lai, hien
   * mot dai bao "co du lieu moi" va de ho tu chon luc cap nhat.
   *
   * @param {string} luaChon    bo chon vung noi dung, vd '#rt-noi-dung'
   * @param {string[]} cacSuKien
   * @param {object} [tuyChon]  { sau: fn(vung) goi lai sau moi lan trao }
   * @returns {function} goi tay de lam moi ngay
   */
  function dongBoTrang(luaChon, cacSuKien, tuyChon) {
    var o = tuyChon || {};
    var vung = document.querySelector(luaChon);
    if (!vung) {
      console.warn('[RT] không thấy vùng nội dung ' + luaChon + ', bỏ qua đồng bộ trang');
      return function () {};
    }

    var hen = null;
    var dangTai = false;
    var dai = null;

    /** Dang go, dang mo hop thoai, hay dang boi den mot doan van ban? */
    function dangBan() {
      var el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'hidden') return true;
      if (document.querySelector('.modal.show, .swal2-container, dialog[open]')) return true;
      var boi = global.getSelection && global.getSelection();
      if (boi && !boi.isCollapsed) return true;
      return false;
    }

    function hienDai() {
      if (dai) return;
      dai = document.createElement('div');
      dai.style.cssText =
        'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:99998;' +
        'background:#3a3b45;color:#fff;border-radius:999px;padding:9px 18px;cursor:pointer;' +
        'font-size:13.5px;box-shadow:0 .4rem 1.4rem rgba(0,0,0,.3)';
      dai.innerHTML = '<i class="fas fa-arrows-rotate"></i> Có dữ liệu mới — bấm để cập nhật';
      dai.onclick = function () { lam(true); };
      document.body.appendChild(dai);
    }

    function anDai() {
      if (!dai) return;
      dai.remove();
      dai = null;
    }

    function lam(epBuoc) {
      if (dangTai) return;
      if (!epBuoc && dangBan()) { hienDai(); return; }
      dangTai = true;

      fetch(location.href, {
        credentials: 'same-origin',
        headers: { 'X-Rt-Lam-Moi': '1' },
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (html) {
          var tai = new DOMParser().parseFromString(html, 'text/html');
          var moi = tai.querySelector(luaChon);
          // Khong thay vung noi dung = server tra ve trang khac (dang nhap,
          // trang loi). Giu nguyen man hinh hien tai, khong trao bua.
          if (!moi) throw new Error('nội dung trả về không phải trang này');

          var y = global.scrollY;
          vung.innerHTML = moi.innerHTML;
          global.scrollTo(0, y);
          anDai();

          if (typeof o.sau === 'function') o.sau(vung);
          document.dispatchEvent(new CustomEvent('rt:trang-da-moi', { detail: { vung: vung } }));
        })
        .catch(function (e) {
          console.warn('[RT] không làm mới được trang:', e.message);
        })
        .then(function () { dangTai = false; });
    }

    (cacSuKien || []).forEach(function (sk) {
      khi(sk, function () {
        // Gom cac su kien den lien tiep thanh mot lan tai. Sua mot phieu luong
        // co the phat vai su kien trong nua giay.
        clearTimeout(hen);
        hen = setTimeout(function () { lam(false); }, 400);
      });
    });

    // Nguoi dung go xong roi thi cap nhat luon, khong bat ho bam dai.
    document.addEventListener('focusout', function () {
      if (dai) setTimeout(function () { if (dai && !dangBan()) lam(true); }, 150);
    });

    return function () { lam(true); };
  }

  /**
   * Chi BAO co du lieu moi, khong tu trao noi dung.
   *
   * Dung cho trang co <script> rieng ben trong vung noi dung. `dongBoTrang()`
   * trao innerHTML, ma trao innerHTML thi KHONG chay lai <script> - moi ham va
   * moi listener cua trang do se bien mat, nut bam thanh nut chet. Vai trang co
   * the chay lai script an toan (IIFE thuan), nhung trang nhu bookings.ejs khai
   * bao `let` o cap ngoai cung se nem "Identifier has already been declared"
   * ngay lan chay thu hai.
   *
   * Nen o day chon cach chac chan: hien mot dai bao, nguoi dung bam thi tai lai
   * ca trang. Ho van biet ngay lap tuc co thay doi - dung y nghia thoi gian
   * thuc - ma khong bao gio mat thu dang lam do.
   */
  function nhacTaiLai(cacSuKien, tuyChon) {
    var o = tuyChon || {};
    var dai = null;

    function hien() {
      if (dai) return;
      dai = document.createElement('div');
      dai.style.cssText =
        'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:99998;' +
        'background:#3a3b45;color:#fff;border-radius:999px;padding:9px 18px;cursor:pointer;' +
        'font-size:13.5px;box-shadow:0 .4rem 1.4rem rgba(0,0,0,.3)';
      dai.innerHTML = '<i class="fas fa-arrows-rotate"></i> ' +
        escapeHtml(o.loi_nhan || 'Dữ liệu vừa thay đổi — bấm để xem bản mới');
      dai.onclick = function () { location.reload(); };
      document.body.appendChild(dai);
    }

    (cacSuKien || []).forEach(function (sk) { khi(sk, hien); });
  }

  // ------------------------------------------------------------- Su kien nen
  socket.on('realtime:san-sang', function (d) {
    hoSo = d;
    global.RT.san_sang = true;
    global.RT.hoSo = d;
    console.log('[RT] ' + d.ten + ' · ' + (d.chuc_danh || 'chưa có chức danh') +
                ' · ' + d.phong.length + ' phòng · ' + d.so_quyen + ' quyền');
    document.dispatchEvent(new CustomEvent('rt:san-sang', { detail: d }));

    // Bao server biet dang o trang nao, de bang dieu hanh hien duoc.
    socket.emit('hien-dien:trang', location.pathname);
  });

  socket.on('connect', function () {
    if (dauHieuKetNoi) capNhatDauHieu(true);
  });
  socket.on('disconnect', function () {
    global.RT.san_sang = false;
    capNhatDauHieu(false);
  });

  /** Thong bao chung do quan ly gui xuong. */
  khi('thong-bao:moi', function (d) {
    thongBao(d.noi_dung, d.muc_do === 'khan' ? 'khan' : 'tin', d.nguoi_gui);
    if (d.muc_do === 'khan') keu();
  });

  /** Viec moi duoc bao len - chi nguoi du cap moi nhan duoc su kien nay. */
  khi('viec:moi', function (d) {
    var nhan = { khan: 'khan', cao: 'canh-bao' }[d.muc_do] || 'tin';
    thongBao(
      d.tieu_de + (d.ten_nguoi_tao ? ' — ' + d.ten_nguoi_tao : ''),
      nhan, 'Việc cần xử lý'
    );
    if (d.muc_do === 'khan' || d.muc_do === 'cao') keu();
  });

  /**
   * Quyen cua minh vua doi. Khong tu tai lai trang vi nguoi dung co the dang
   * nhap do dang - chi bao va de ho chu dong.
   */
  khi('quyen:thay-doi', function (d) {
    var t = thongBao(d.ly_do + ' Bấm để tải lại trang.', 'canh-bao', 'Quyền đã thay đổi');
    t.style.cursor = 'pointer';
    t.onclick = function () { location.reload(); };
  });

  // ------------------------------------------------------- Dau hieu ket noi
  var dauHieuKetNoi = null;
  function capNhatDauHieu(online) {
    if (!dauHieuKetNoi) return;
    dauHieuKetNoi.style.background = online ? '#198754' : '#b7b9cc';
    dauHieuKetNoi.title = online ? 'Đang kết nối thời gian thực' : 'Mất kết nối — đang thử lại';
  }

  function ganDauHieu(el) {
    dauHieuKetNoi = el;
    capNhatDauHieu(socket.connected);
  }

  // Nhip tim moi 45 giay de server biet may con song.
  setInterval(function () {
    if (socket.connected) socket.emit('hien-dien:nhip');
  }, 45000);

  // Bao khi chuyen trang trong cac ung dung mot trang / dieu huong bang lich su.
  global.addEventListener('popstate', function () {
    if (socket.connected) socket.emit('hien-dien:trang', location.pathname);
  });

  global.RT = {
    socket: socket,
    khi: khi,
    dongBo: dongBo,
    dongBoTrang: dongBoTrang,
    nhacTaiLai: nhacTaiLai,
    thongBao: thongBao,
    keu: keu,
    ganDauHieu: ganDauHieu,
    escapeHtml: escapeHtml,
    san_sang: false,
    hoSo: null,
    /** Goi API POST kem xu ly loi thong nhat. */
    gui: function (duongDan, duLieu) {
      return fetch(duongDan, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(duLieu || {}),
      }).then(function (r) {
        return r.json().then(function (d) {
          // `thong_bao` trước `loi`: phần lớn API trong hệ thống trả câu tiếng
          // Việt đã viết cho người dùng ở `thong_bao`, còn `loi` là thông điệp
          // kỹ thuật. Bỏ sót `thong_bao` thì mọi lỗi 400 đều hiện ra thành
          // "Lỗi 400" - đúng nhưng vô dụng.
          if (!r.ok) throw new Error(d.thong_bao || d.loi || 'Lỗi ' + r.status);
          return d;
        });
      });
    },
  };
})(window);

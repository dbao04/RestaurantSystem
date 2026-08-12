/**
 * Tien ich dung chung cho bon trang cham cong bang khuon mat
 * (kiosk, ca nhan, lan dau, quan ly).
 *
 * Gop vao mot cho vi truoc day moi trang tu goi getUserMedia mot kieu, va cung
 * mot loi camera lai bao mot cau khac nhau - hoac khong bao gi ca. Ba viec de
 * sai nam o day:
 *
 *   1. `navigator.mediaDevices` KHONG ton tai khi trang mo qua origin khong bao
 *      mat (vi du http://192.168.1.5:3000 tu may khac trong mang LAN). Luc do
 *      `navigator.mediaDevices.getUserMedia(...)` nem TypeError NGAY LAP TUC,
 *      truoc khi tra ve Promise - nen `.catch()` gan sau do khong bao gio chay
 *      va nguoi dung chi thay man hinh den, khong co thong bao nao.
 *
 *   2. Chup ngay khi vua goi getUserMedia se ra ANH DEN: luc do video moi co
 *      srcObject chu chua giai ma xong khung dau tien (videoWidth van bang 0).
 *      Server nhan anh den thi bao "khong thay khuon mat" - rat kho doan.
 *
 *   3. Mo hai luong camera tren cung mot trang (trang ca nhan co hai the video)
 *      lam webcam bi chiem: luong thu hai loi NotReadableError. Mo MOT luong
 *      roi gan cho nhieu the video la du.
 */
(function (global) {
  'use strict';

  // ------------------------------------------------------------------ CAMERA

  /** Doi den khi video thuc su co khung hinh de ve (khong phai anh den). */
  function doiKhungDau(video, hetHanMs) {
    var hetHan = hetHanMs || 6000;
    return new Promise(function (giai, tuChoi) {
      var xong = false;
      function kiemTra() {
        if (xong) return;
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
          xong = true;
          giai(video);
        }
      }
      video.addEventListener('loadeddata', kiemTra);
      video.addEventListener('playing', kiemTra);
      var hen = setInterval(kiemTra, 120);
      setTimeout(function () {
        clearInterval(hen);
        if (!xong) { xong = true; tuChoi(new Error('Camera không trả về hình sau ' + (hetHan / 1000) + 's.')); }
      }, hetHan);
      kiemTra();
    });
  }

  /** Doi loi cua getUserMedia thanh cau tieng Viet noi ro phai lam gi. */
  function dienGiaiLoi(e) {
    var ten = e && (e.name || e.code) || '';
    if (ten === 'NotAllowedError' || ten === 'PermissionDeniedError') {
      return 'Trình duyệt đang chặn camera. Bấm vào biểu tượng khoá/camera trên thanh địa chỉ ' +
             'rồi chọn "Cho phép", sau đó tải lại trang.';
    }
    if (ten === 'NotFoundError' || ten === 'DevicesNotFoundError') {
      return 'Không tìm thấy camera nào trên máy này. Hãy cắm webcam rồi tải lại trang.';
    }
    if (ten === 'NotReadableError' || ten === 'TrackStartError') {
      return 'Camera đang bị ứng dụng khác chiếm (Zoom, Teams, Camera của Windows...). ' +
             'Hãy đóng ứng dụng đó rồi tải lại trang.';
    }
    if (ten === 'OverconstrainedError') {
      return 'Camera không hỗ trợ độ phân giải yêu cầu. Thử camera khác.';
    }
    return 'Không mở được camera: ' + (e && e.message ? e.message : ten || 'lỗi không rõ');
  }

  // Luong dang mo va cac the video dang dung no. Giu o day de `dongCamera` va
  // `doiCamera` khong can moi trang tu quan ly lay.
  var _luong = null;
  var _theVideo = [];
  var _huong = 'user';   // 'user' = camera truoc, 'environment' = camera sau

  /** Ngung moi track. Bat buoc tren dien thoai: khong ngung thi camera van sang
   *  sau khi roi trang - ton pin, va trinh duyet giu den bao hieu lam nguoi dung
   *  tuong ung dung dang quay len. Cung giai phong camera cho ung dung khac. */
  function dongCamera() {
    if (_luong) {
      _luong.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      _luong = null;
    }
    _theVideo.forEach(function (v) { try { v.srcObject = null; } catch (e) {} });
  }

  /** Vi sao khong mo duoc camera - kiem tra truoc khi goi getUserMedia. */
  function _vuongMac() {
    if (!global.navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Day la ly do PHO BIEN NHAT khi nhan vien mo bang dien thoai: trang chay
      // qua http trong mang LAN thi `navigator.mediaDevices` khong ton tai, va
      // khong co cach nao lach bang JavaScript. Chi cach duy nhat la HTTPS.
      if (location.protocol !== 'https:' &&
          !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
        return 'Trình duyệt chỉ cho dùng camera qua HTTPS. Trang này đang mở bằng ' +
               'http://' + location.host + '. Trên điện thoại hãy mở bằng địa chỉ ' +
               'https:// của máy chủ (xem mục HTTPS trong hướng dẫn cài đặt), ' +
               'hoặc dùng máy tính đặt tại nhà hàng.';
      }
      return 'Trình duyệt này không hỗ trợ camera. Hãy dùng Chrome, Edge, Safari hoặc Firefox bản mới.';
    }
    return null;
  }

  /**
   * Mo MOT luong camera va gan vao tat ca cac the video duoc truyen vao.
   *
   * @param {HTMLVideoElement|HTMLVideoElement[]} video
   * @param {object} [tuy] { huong: 'user' | 'environment' }
   * @returns Promise<MediaStream> - tu choi kem thong bao tieng Viet de hien thi
   */
  function moCamera(video, tuy) {
    tuy = tuy || {};
    var ds = Array.isArray(video) ? video.filter(Boolean) : [video].filter(Boolean);
    if (ds.length) _theVideo = ds; else ds = _theVideo;
    if (!ds.length) return Promise.reject(new Error('Không có thẻ video nào.'));

    // Kiem tra TRUOC khi goi, vi loi nay la TypeError dong bo chu khong phai
    // promise bi tu choi - bat o day moi hien duoc thong bao cho nguoi dung.
    var vuong = _vuongMac();
    if (vuong) return Promise.reject(new Error(vuong));

    if (tuy.huong) _huong = tuy.huong;
    dongCamera();   // dien thoai chi cho MOT luong; phai tra truoc khi xin lai

    // Xin 960x720 roi thu nho khi chup: phep thu nho lam giam nhieu cam bien,
    // khung hinh ra net hon la chup thang o 640x480. Tat ca deu la `ideal` chu
    // khong phai `exact` - may khong dap ung duoc thi trinh duyet tu ha xuong
    // muc gan nhat chu khong nem OverconstrainedError. Rieng dien thoai cam doc
    // thuong tra ve luong DOC bat ke ta xin gi; `chup()` xu ly duoc chuyen do.
    var rangBuoc = {
      width: { ideal: 960 }, height: { ideal: 720 },
      facingMode: { ideal: _huong },
    };
    return navigator.mediaDevices
      .getUserMedia({ video: rangBuoc, audio: false })
      .then(function (luong) {
        _luong = luong;
        ds.forEach(function (v) {
          v.srcObject = luong;
          // Camera sau khong phai anh trong guong - bo lat de chu viet phia sau
          // khong bi nguoc.
          v.style.transform = _huong === 'environment' ? 'none' : 'scaleX(-1)';
          // autoplay co the bi chan; goi play() cho chac, bo qua loi.
          var p = v.play && v.play();
          if (p && p.catch) p.catch(function () {});
        });
        return doiKhungDau(ds[0]).then(function () { return luong; });
      })
      .catch(function (e) { throw new Error(dienGiaiLoi(e)); });
  }

  /** Doi giua camera truoc va camera sau (chi co y nghia tren dien thoai). */
  function doiCamera() {
    return moCamera(_theVideo, { huong: _huong === 'user' ? 'environment' : 'user' })
      .then(function (l) { return { luong: l, huong: _huong }; });
  }

  /** May nay co tu hai camera tro len khong - de an/hien nut doi camera. */
  function coNhieuCamera() {
    if (!global.navigator || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve(false);
    }
    return navigator.mediaDevices.enumerateDevices()
      .then(function (ds) {
        return ds.filter(function (t) { return t.kind === 'videoinput'; }).length > 1;
      })
      .catch(function () { return false; });
  }

  /** Camera dang quay ve huong nao. */
  function huongCamera() { return _huong; }

  // Roi trang / chuyen sang tab khac tren dien thoai -> tra camera lai cho may.
  // `pagehide` chay ca khi Safari iOS dua trang vao bo nho dem, `unload` thi
  // khong - nen phai dung ca hai.
  if (global.addEventListener) {
    global.addEventListener('pagehide', dongCamera);
    global.addEventListener('unload', dongCamera);
  }

  /** Video da co khung hinh that chua. */
  function sanSang(video) {
    return !!(video && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2);
  }

  /**
   * Chup mot khung tu video ra dataURL JPEG.
   *
   * Nem loi neu video chua san sang - tot hon la gui len server mot anh den roi
   * nhan ve "khong thay khuon mat".
   *
   * DO PHAN GIAI QUAN TRONG HON VE NHIN. Python cat khuon mat roi can chinh ve
   * 112x112 truoc khi do do net va trich dac trung. Nguoi ngoi cach camera mot
   * sai tay chi chiem chung 1/4 chieu cao khung hinh; o 480x360 thi mat chi con
   * ~90 diem anh, PHONG TO len 112 nen anh nhoe - phuong sai Laplacian tut, va
   * kiem tra anh song bao truot. O 640x480 mat duoc ~120 diem anh, thu nho nhe
   * xuong 112 nen giu duoc net. Day la ly do mac dinh la 640x480 chu khong phai
   * 480x360.
   *
   * KHONG BAO GIO KEO GIAN ANH. Truoc day ham nay ep nguyen khung video vao mot
   * canvas 640x480 co dinh. Tren may tinh de ban thi vo hai vi webcam cung dua
   * ra 4:3, nhung DIEN THOAI CAM DOC tra ve luong DOC (720x960) - ep vao 640x480
   * la bop met mat 1.78 lan. Nguy hiem o cho the <video> dung `object-fit:cover`
   * nen ANH XEM TRUOC VAN DUNG TI LE: nguoi dung thay mat binh thuong trong khi
   * anh gui di da meo. Mat meo thi 5 diem moc sai vi tri, keo theo:
   *   - `_goc_tu_diem_moc` ben Python tinh sai ty so mui/mat -> thu thach quay
   *     dau bi cham diem sai,
   *   - anh can chinh 112x112 lech khoi phan bo ma mo hinh duoc huan luyen ->
   *     vector dac trung troi di -> bao "khong khop".
   *
   * Nay ta THU NHO CO TI LE, khong cat, khong gian: coi {rong, cao} la mot HOP
   * GIOI HAN va tu xoay hop theo huong cua nguon. Nguon 960x720 ra 640x480;
   * nguon doc 720x960 ra 480x640; nguon 16:9 1280x720 ra 640x360. Moi truong hop
   * deu giu nguyen ti le that cua khuon mat.
   *
   * @param {object} tuy { rong, cao, vuong: cat vuong giua khung }
   */
  function chup(video, canvas, tuy) {
    tuy = tuy || {};
    if (!sanSang(video)) throw new Error('Camera chưa sẵn sàng, hãy đợi hình hiện lên rồi thử lại.');

    var vw = video.videoWidth, vh = video.videoHeight;
    var hopRong = tuy.rong || 640, hopCao = tuy.cao || 480;
    var rong, cao, nx, ny, nRong, nCao;

    if (tuy.vuong) {
      // Trang dang ky muon anh mau vuong: cat o vuong giua khung. Nguon vuong ->
      // dich vuong nen van khong meo.
      var c = Math.min(vw, vh);
      nx = (vw - c) / 2; ny = (vh - c) / 2; nRong = c; nCao = c;
      rong = hopRong; cao = hopRong;
    } else {
      nx = 0; ny = 0; nRong = vw; nCao = vh;
      // Xoay hop gioi han theo huong cua nguon, neu khong thi nguon doc 720x960
      // bi chieu cao 480 bop xuong con 360x480 - mat di do phan giai vo co.
      var canhDai = Math.max(hopRong, hopCao), canhNgan = Math.min(hopRong, hopCao);
      var boxR = vw >= vh ? canhDai : canhNgan;
      var boxC = vw >= vh ? canhNgan : canhDai;
      // Chan tren la 1: phong to anh len khong them mot chi tiet nao, chi lam
      // nang goi tin gui qua mang di dong.
      var ty = Math.min(boxR / vw, boxC / vh, 1);
      rong = Math.max(1, Math.round(vw * ty));
      cao = Math.max(1, Math.round(vh * ty));
    }

    canvas.width = rong; canvas.height = cao;
    var ctx = canvas.getContext('2d');

    // Khung camera lon hon khung chup nen day la phep THU NHO; noi suy chat
    // luong cao giu duoc chi tiet, mac dinh cua trinh duyet ('low') lam mat net
    // dung cai ma kiem tra anh song dang do.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Video hien thi da lat guong (transform:scaleX(-1)) cho de soi; lat lai khi
    // chup de server nhan dung anh that.
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, nx, ny, nRong, nCao, -rong, 0, rong, cao);
    ctx.restore();
    // 0.90 chu khong phai 0.85: nhieu nen JPEG o muc thap tao ra dinh nang luong
    // tuan hoan trong pho Fourier, dung thu ma `_diem_ket_cau` ben Python coi la
    // dau hieu chup lai tu man hinh.
    return canvas.toDataURL('image/jpeg', tuy.chatLuong || 0.90);
  }

  // --------------------------------------------------------------------- GPS

  /**
   * Lay toa do hien tai.
   *
   * KHONG BAO GIO tu choi: tra ve { co: false, ly_do } khi khong lay duoc, de
   * luong cham cong van chay tiep va de SERVER quyet dinh co chan hay khong
   * (theo cau hinh khuon_mat_bat_gps). Chan o phia trinh duyet la vo nghia ve
   * mat an ninh vi nguoi dung sua duoc JavaScript.
   */
  function layViTri(tuy) {
    tuy = tuy || {};
    return new Promise(function (giai) {
      if (!global.navigator || !navigator.geolocation) {
        return giai({ co: false, ly_do: 'Trình duyệt không hỗ trợ định vị.' });
      }
      // Cung rang buoc origin bao mat nhu camera.
      if (location.protocol !== 'https:' &&
          !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
        return giai({ co: false, ly_do: 'Định vị chỉ chạy trên HTTPS hoặc localhost.' });
      }

      var xong = false;
      var hen = setTimeout(function () {
        if (!xong) { xong = true; giai({ co: false, ly_do: 'Lấy vị trí quá lâu, đã bỏ qua.' }); }
      }, (tuy.hetHanMs || 10000) + 500);

      navigator.geolocation.getCurrentPosition(
        function (vt) {
          if (xong) return;
          xong = true; clearTimeout(hen);
          giai({
            co: true,
            vi_do: vt.coords.latitude,
            kinh_do: vt.coords.longitude,
            do_chinh_xac_m: vt.coords.accuracy != null ? Math.round(vt.coords.accuracy) : null,
          });
        },
        function (e) {
          if (xong) return;
          xong = true; clearTimeout(hen);
          var ly = e && e.code === 1 ? 'Bạn đã từ chối chia sẻ vị trí. Hãy bấm biểu tượng vị trí ' +
                                       'trên thanh địa chỉ và chọn "Cho phép".'
                 : e && e.code === 2 ? 'Máy không xác định được vị trí (thiếu GPS/Wi-Fi).'
                 : e && e.code === 3 ? 'Lấy vị trí quá lâu.'
                 : 'Không lấy được vị trí.';
          giai({ co: false, ly_do: ly });
        },
        { enableHighAccuracy: true, timeout: tuy.hetHanMs || 10000, maximumAge: 30000 }
      );
    });
  }

  global.CamCC = {
    moCamera: moCamera,
    dongCamera: dongCamera,
    doiCamera: doiCamera,
    coNhieuCamera: coNhieuCamera,
    huongCamera: huongCamera,
    doiKhungDau: doiKhungDau,
    sanSang: sanSang,
    chup: chup,
    layViTri: layViTri,
    dienGiaiLoi: dienGiaiLoi,
  };
})(window);

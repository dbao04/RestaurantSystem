module.exports = {
  formatMoney: (number, fractional = false) => {
    if (fractional) {
      number = parseFloat(number).toFixed(2);
    }
    let s = String(number);
    let replaced = s.replace(/(-?\d+)(\d\d\d)/, '$1,$2');
    while (replaced !== s) {
      s = replaced;
      replaced = s.replace(/(-?\d+)(\d\d\d)/, '$1,$2');
    }
    return s;
  },
  formatDate: (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
  },
  formatTime: (date) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * Ngay dat ban -> 'dd/mm/yyyy' cho nguoi Viet doc.
   *
   * Cot `hopdong.dates` la TEXT luu nguyen chuoi khach gui len, nen trong CSDL
   * dang co lan hai dang: 'm/d/yyyy' cua bootstrap-datepicker cu va 'yyyy-mm-dd'
   * cua <input type="date"> dang dung. Ham nay doc duoc ca hai; gap dang la
   * thi tra ve nguyen van chu khong doan bua.
   */
  ngayVN: (raw) => {
    if (!raw) return '—';
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) return '—';
      return `${String(raw.getDate()).padStart(2, '0')}/${String(raw.getMonth() + 1).padStart(2, '0')}/${raw.getFullYear()}`;
    }
    const s = String(raw).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[1]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);   // M/D/YYYY - thang truoc
    if (m) return `${m[2].padStart(2, '0')}/${m[1].padStart(2, '0')}/${m[3]}`;
    return s;
  },

  /**
   * So luong ton kho -> chuoi doc duoc, theo dung ban chat don vi tinh.
   *
   * Truoc day bang kho in thang gia tri FLOAT ra man hinh nen thu kho doc duoc
   * nhung dong nhu "156.84" o cot ton kho cua Bia Tiger. Khong ai dem duoc 0,84
   * lon bia, va con so kieu do lam moi lan kiem ke deu bao lech.
   *
   * Quy tac:
   *   - don vi DEM DUOC (lon, chai, cai, bo, hop, goi) -> luon lam tron nguyen
   *   - kg, lit  -> toi da 2 chu so thap phan, bo so 0 thua (2.50 -> 2,5)
   *   - gram, ml -> so nguyen (le mili-lit khong co y nghia thuc te)
   *
   * Ham nay chi lo phan HIEN THI. Du lieu duoc chuan hoa boi migration 013.
   *
   * @param {number} soLuong
   * @param {string} [tenDvt] ten don vi, vi du 'lon'. Thieu thi coi la do luong.
   * @returns {string} vi du '157', '2,5', '0'
   */
  soLuongKho: (soLuong, tenDvt) => {
    const n = Number(soLuong);
    if (!Number.isFinite(n)) return '0';
    const soLe = module.exports.soLeCuaDonVi(tenDvt);
    // Dau PHAY thap phan kieu Viet ('4,22 kg') nhung KHONG ngan cach hang nghin.
    //
    // vi-VN ngan cach hang nghin bang dau CHAM ('1.163'), trong khi formatMoney
    // cua du an dung dau PHAY ('1,780,000'). Hai kieu do dung canh nhau tren
    // cung mot bang (trang lich su nhap kho co ca cot so luong lan cot tien) se
    // khien nguoi doc khong biet '1.163' la mot nghin hay la mot phay mot.
    // So luong kho hiem khi lon toi muc can ngan cach, nen bo han cho gon.
    return n.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: soLe,
      useGrouping: false,
    });
  },

  /**
   * So chu so thap phan hop le cua mot don vi tinh.
   *
   * Doc theo TEN don vi chu khong doc cot `don_vi_tinh.so_le` (do migration 013
   * them vao), de code van chay dung khi ai do keo repo ve ma chua chay
   * migration. CSDL van la nguon su that cho du lieu; ham nay chi lo quy tac.
   */
  soLeCuaDonVi: (tenDvt) => {
    const dv = String(tenDvt || '').trim().toLowerCase();
    const DEM_DUOC = ['lon', 'chai', 'cai', 'cái', 'bo', 'bó', 'hop', 'hộp', 'goi', 'gói', 'qua', 'quả'];
    const NGUYEN = ['gram', 'g', 'ml'];
    // 'lit'/'lít' va 'kg' roi vao nhanh mac dinh 2 so le, dung nhu mong doi.
    return (DEM_DUOC.includes(dv) || NGUYEN.includes(dv)) ? 0 : 2;
  },

  /** Lam tron mot so luong ve dung do chinh xac cua don vi tinh. */
  lamTronTheoDonVi: (soLuong, tenDvt) => {
    const n = Number(soLuong);
    if (!Number.isFinite(n)) return 0;
    const heSo = Math.pow(10, module.exports.soLeCuaDonVi(tenDvt));
    return Math.round(n * heSo) / heSo;
  },

  /** 'HH:MM:SS' hoac 'HH:MM' -> 'HH:MM'. */
  gioVN: (raw) => {
    if (!raw) return '—';
    const m = /^(\d{1,2}):(\d{2})/.exec(String(raw).trim());
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(raw);
  },
};

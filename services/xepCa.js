/**
 * Thuat toan xep ca.
 *
 * BAI TOAN
 *   Cho mot tuan, mot bang dinh muc ("thu Bay ca toi can 2 phuc vu"), va danh
 *   sach nhan vien. Xep nguoi vao ca sao cho du nguoi, khong ai bi vat kiet, va
 *   khong ai bi bo quen.
 *
 * VI SAO KHONG PHAI MOT VONG LAP DON GIAN
 *   Cach ngay tho la duyet tung ca roi lay dai nguoi dau danh sach. Lam vay thi
 *   nguoi dung dau bang (id nho nhat) lanh gan het ca con nguoi cuoi bang gan
 *   nhu khong bao gio duoc xep - chia viec khong deu la khieu nai nang nhat
 *   trong nha hang that. Nen o day moi ung vien duoc CHAM DIEM, va tieu chi
 *   nang nhat la "ai dang it ca nhat thi uu tien".
 *
 * RANG BUOC CUNG - vi pham la loai thang, khong danh doi
 *   1. Dung chuc vu. Bep khong dung thay phuc vu duoc.
 *   2. Dang nghi phep da duyet trong ngay do.
 *   3. Da co ca khac trong cung ngay (mac dinh moi nguoi mot ca mot ngay).
 *   4. Chua nghi du giua hai ca. Ca toi hom truoc ket thuc 21h, ca sang hom sau
 *      bat dau 7h - moi duoc 10 tieng ke ca di duong va ngu. Mac dinh doi it
 *      nhat 11 tieng, dung dung con so cua Chi thi thoi gian lam viec chau Au
 *      vi khong co chuan noi dia nao de vien.
 *   5. Khong qua so ngay lien tiep cho phep, va khong qua so ca toi da trong
 *      tuan.
 *
 * DIEM MEM - quyet dinh ai trong so nhung nguoi hop le
 *   +1000  nguoi nay DA TU DANG KY dung ca nay. Diem lon ap dao moi tieu chi
 *          khac: nhan vien da noi ho muon lam ca nay thi ton trong, xep ho vao
 *          cho khac vua vo ich vua gay ac cam.
 *   -100 * so ca da co. Day la truc chinh de chia deu.
 *    +50  chua he duoc xep ca nao trong tuan - keo nguoi dang bi bo quen len.
 *    -30  hom qua cung lam dung ca nay va da lam 2 ngay lien tiep tro len -
 *          tranh mot nguoi bi don ca toi ca tuan.
 *    +20  ca nay giong ca ho lam hom qua. Nguoc lai voi dong tren nhung nhe
 *          hon: xoay vong sang-chieu-toi lien tuc lam dao lon dong ho sinh hoc,
 *          giu mot nhip on dinh trong vai ngay thi de song hon.
 *
 * KHI KHONG DU NGUOI
 *   Khong tu ha dinh muc, khong bo qua rang buoc cung de lap cho trong. Tra ve
 *   danh sach `thieu` de man hinh bao ro "thu Bay ca toi thieu 1 phuc vu".
 *   Quan ly can biet dieu do de goi nguoi lam them hoac tuyen, chu khong phai
 *   nhan mot bang lich nhin thi day nhung thuc te khong ai dung ca.
 *
 * KHONG DUNG SO NGAU NHIEN
 *   Cung du lieu vao thi luon ra cung ket qua. Bam "Xep tu dong" hai lan ma ra
 *   hai bang khac nhau se khien nguoi dung mat long tin, va cung khong the kiem
 *   thu duoc. Cac truong hop diem bang nhau duoc pha bang id nhan vien.
 */

/** Doi 'HH:MM:SS' sang so phut ke tu 0h. */
function phut(gio) {
  const [h, m] = String(gio || '00:00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 'YYYY-MM-DD' cua mot doi tuong Date, theo gio dia phuong. */
function ngayISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lui mot ngay, tra ve chuoi 'YYYY-MM-DD'. */
function homTruoc(ngay) {
  const d = new Date(ngay + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return ngayISO(d);
}

const MAC_DINH = {
  gioNghiToiThieu: 11,      // gio, giua ket thuc ca truoc va bat dau ca sau
  soCaToiDaTuan: 6,
  soNgayLienTiepToiDa: 6,
  moiNgayMotCa: true,
};

/**
 * Xep ca cho mot khoang ngay.
 *
 * @param {object} dl
 *   dl.ngayList    ['2026-08-17', ...] cac ngay can xep, theo thu tu tang dan
 *   dl.caList      [{ma_ca, ten_ca, gio_bat_dau, gio_ket_thuc, thu_tu}]
 *   dl.dinhMuc     [{thu, ma_ca, chucvu, so_luong}]
 *   dl.nhanVien    [{id_nv, ten, chucvu}]
 *   dl.nghiPhep    [{id_nv, tu_ngay, den_ngay}]  da duyet
 *   dl.daDangKy    [{id_nv, ngay, ca}]           nhan vien tu dang ky truoc
 *   dl.caTruocKhoang [{id_nv, ngay, ca}]         lich da chot cua nhung ngay
 *                    lien ke TRUOC khoang xep - can de tinh nghi giua ca va
 *                    chuoi ngay lien tiep vat qua ranh gioi tuan
 * @param {object} [tuyChon] ghi de MAC_DINH
 * @returns {{phanCa: Array, thieu: Array, thongKe: object}}
 */
function xepCa(dl, tuyChon = {}) {
  const c = { ...MAC_DINH, ...tuyChon };

  const caTheoMa = new Map(dl.caList.map((x) => [x.ma_ca, x]));
  const nvTheoId = new Map(dl.nhanVien.map((x) => [x.id_nv, x]));

  // --- Nghi phep: trai phang thanh tap hop 'id|ngay' de tra cuu O(1) ------
  const nghi = new Set();
  for (const n of dl.nghiPhep || []) {
    const tu = new Date((n.tu_ngay || n.ngay_bat_dau) + 'T00:00:00');
    const den = new Date((n.den_ngay || n.ngay_ket_thuc || n.tu_ngay) + 'T00:00:00');
    for (let d = new Date(tu); d <= den; d.setDate(d.getDate() + 1)) {
      nghi.add(`${n.id_nv}|${ngayISO(d)}`);
    }
  }

  // --- Dang ky cua nhan vien: 'id|ngay|ca' -------------------------------
  const dangKy = new Set((dl.daDangKy || []).map((x) => `${x.id_nv}|${x.ngay}|${x.ca}`));

  /**
   * Trang thai tich luy trong khi xep. `theoNgay` gom ca lich da chot truoc
   * khoang lan lich vua xep, nen rang buoc nghi giua ca van dung o ngay dau
   * tien cua tuan moi.
   */
  const soCa = new Map();          // id_nv -> so ca da nhan trong khoang nay
  const theoNgay = new Map();      // 'id|ngay' -> [ma_ca, ...]
  for (const id of nvTheoId.keys()) soCa.set(id, 0);
  for (const x of dl.caTruocKhoang || []) {
    const k = `${x.id_nv}|${x.ngay}`;
    if (!theoNgay.has(k)) theoNgay.set(k, []);
    theoNgay.get(k).push(x.ca);
  }

  const caTrongNgay = (id, ngay) => theoNgay.get(`${id}|${ngay}`) || [];

  /** So ngay lam lien tiep tinh nguoc tu `ngay` tro ve truoc (khong ke `ngay`). */
  function chuoiLienTiep(id, ngay) {
    let n = 0;
    let d = homTruoc(ngay);
    while (caTrongNgay(id, d).length > 0) {
      n += 1;
      d = homTruoc(d);
      if (n > 30) break;   // chan vong lap vo han neu du lieu hong
    }
    return n;
  }

  /**
   * Nghi du giua ca truoc va ca dang xet chua.
   *
   * Chi cai nay moi thuc su can gio giac, nen phai lam viec voi phut chu khong
   * so sanh ten ca. Ca cua hom truoc ket thuc luc ket_thuc + 24h so voi moc 0h
   * cua hom nay.
   */
  function nghiDu(id, ngay, ca) {
    const batDau = phut(ca.gio_bat_dau);
    const nguong = c.gioNghiToiThieu * 60;

    for (const maCu of caTrongNgay(id, homTruoc(ngay))) {
      const cu = caTheoMa.get(maCu);
      if (!cu) continue;
      let ketThuc = phut(cu.gio_ket_thuc);
      if (ketThuc <= phut(cu.gio_bat_dau)) ketThuc += 24 * 60;  // ca qua nua dem
      if (batDau + 24 * 60 - ketThuc < nguong) return false;
    }

    for (const maCu of caTrongNgay(id, ngay)) {
      const cu = caTheoMa.get(maCu);
      if (!cu) continue;
      const ketThuc = phut(cu.gio_ket_thuc);
      const cach = batDau >= ketThuc ? batDau - ketThuc : phut(cu.gio_bat_dau) - phut(ca.gio_ket_thuc);
      if (cach < nguong) return false;
    }
    return true;
  }

  /** Rang buoc cung. Tra ve true neu duoc phep xep. */
  function hopLe(nv, ngay, ca, chucvu) {
    if (nv.chucvu !== chucvu) return false;
    if (nghi.has(`${nv.id_nv}|${ngay}`)) return false;
    if (c.moiNgayMotCa && caTrongNgay(nv.id_nv, ngay).length > 0) return false;
    if (caTrongNgay(nv.id_nv, ngay).includes(ca.ma_ca)) return false;
    if ((soCa.get(nv.id_nv) || 0) >= c.soCaToiDaTuan) return false;
    if (chuoiLienTiep(nv.id_nv, ngay) >= c.soNgayLienTiepToiDa) return false;
    if (!nghiDu(nv.id_nv, ngay, ca)) return false;
    return true;
  }

  /** Diem mem - cao hon thi duoc chon truoc. Xem bang diem o dau tep. */
  function diem(nv, ngay, ca) {
    let d = 0;
    if (dangKy.has(`${nv.id_nv}|${ngay}|${ca.ma_ca}`)) d += 1000;

    const daCo = soCa.get(nv.id_nv) || 0;
    d -= daCo * 100;
    if (daCo === 0) d += 50;

    const caHomQua = caTrongNgay(nv.id_nv, homTruoc(ngay));
    if (caHomQua.includes(ca.ma_ca)) {
      d += 20;
      if (chuoiLienTiep(nv.id_nv, ngay) >= 2) d -= 30;
    }
    return d;
  }

  // --- Xep -----------------------------------------------------------------
  const phanCa = [];
  const thieu = [];

  const dinhMucTheoNgay = (ngay) => {
    const thu = new Date(ngay + 'T00:00:00').getDay();
    return (dl.dinhMuc || []).filter((d) => Number(d.thu) === thu && Number(d.so_luong) > 0);
  };

  const thuTuCa = (ma) => (caTheoMa.get(ma) || {}).thu_tu || 0;

  for (const ngay of dl.ngayList) {
    const muc = dinhMucTheoNgay(ngay).sort((a, b) => thuTuCa(a.ma_ca) - thuTuCa(b.ma_ca));

    for (const m of muc) {
      const ca = caTheoMa.get(m.ma_ca);
      if (!ca) continue;

      let conThieu = Number(m.so_luong);
      // Duyet lai tung luot thay vi chon mot lan N nguoi: moi lan xep xong,
      // `soCa` cua nguoi vua chon tang len, nen luot sau da tinh theo trang
      // thai moi. Chon mot lan se lay ra N nguoi cung "dang it ca nhat".
      while (conThieu > 0) {
        let tot = null;
        let diemTot = -Infinity;

        for (const nv of dl.nhanVien) {
          if (!hopLe(nv, ngay, ca, m.chucvu)) continue;
          const d = diem(nv, ngay, ca);
          // Bang diem thi lay id nho hon - cot de ket qua lap lai duoc.
          if (d > diemTot || (d === diemTot && tot && nv.id_nv < tot.id_nv)) {
            diemTot = d;
            tot = nv;
          }
        }

        if (!tot) break;   // het nguoi hop le cho o nay

        phanCa.push({
          id_nv: tot.id_nv,
          ten: tot.ten,
          chucvu: tot.chucvu,
          ngay,
          ca: ca.ma_ca,
          gio_bat_dau: ca.gio_bat_dau,
          gio_ket_thuc: ca.gio_ket_thuc,
          tu_dang_ky: dangKy.has(`${tot.id_nv}|${ngay}|${ca.ma_ca}`),
        });

        soCa.set(tot.id_nv, (soCa.get(tot.id_nv) || 0) + 1);
        const k = `${tot.id_nv}|${ngay}`;
        if (!theoNgay.has(k)) theoNgay.set(k, []);
        theoNgay.get(k).push(ca.ma_ca);

        conThieu -= 1;
      }

      if (conThieu > 0) {
        thieu.push({
          ngay,
          ca: ca.ma_ca,
          ten_ca: ca.ten_ca,
          chucvu: m.chucvu,
          can: Number(m.so_luong),
          thieu: conThieu,
        });
      }
    }
  }

  // --- Thong ke de man hinh khoi phai tu tinh lai --------------------------
  const theoNguoi = dl.nhanVien
    .map((nv) => ({
      id_nv: nv.id_nv,
      ten: nv.ten,
      chucvu: nv.chucvu,
      so_ca: soCa.get(nv.id_nv) || 0,
    }))
    .sort((a, b) => b.so_ca - a.so_ca || a.id_nv - b.id_nv);

  const soCaCoNguoi = phanCa.length;
  const tongCan = dl.ngayList.reduce(
    (s, ngay) => s + dinhMucTheoNgay(ngay).reduce((x, m) => x + Number(m.so_luong), 0),
    0
  );

  return {
    phanCa,
    thieu,
    thongKe: {
      tong_can: tongCan,
      da_xep: soCaCoNguoi,
      thieu: tongCan - soCaCoNguoi,
      giu_dang_ky: phanCa.filter((p) => p.tu_dang_ky).length,
      theo_nguoi: theoNguoi,
    },
  };
}

/** Danh sach ngay tu `tu` den `den`, ca hai dau deu tinh. */
function dsNgay(tu, den) {
  const ds = [];
  const d = new Date(tu + 'T00:00:00');
  const cuoi = new Date(den + 'T00:00:00');
  while (d <= cuoi) {
    ds.push(ngayISO(d));
    d.setDate(d.getDate() + 1);
  }
  return ds;
}

/** Thu Hai cua tuan chua `ngay`. Tuan trong tieng Viet bat dau tu thu Hai. */
function thuHaiCuaTuan(ngay) {
  const d = new Date(ngay + 'T00:00:00');
  const thu = d.getDay();               // 0 = CN
  const lui = thu === 0 ? 6 : thu - 1;
  d.setDate(d.getDate() - lui);
  return ngayISO(d);
}

module.exports = { xepCa, dsNgay, thuHaiCuaTuan, ngayISO, MAC_DINH };

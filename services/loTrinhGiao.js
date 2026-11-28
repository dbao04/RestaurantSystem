/**
 * LO TRINH GIAO NHIEU DON TRONG MOT CHUYEN.
 *
 * Dung cho hai viec:
 *   1. Ghep don (phanCongGiaoService): don moi co "tien duong" voi cac don
 *      shipper dang cho lay o quan khong - do bang so km PHAI DI VONG THEM khi
 *      chen don moi vao lo trinh toi uu.
 *   2. App shipper: sap thu tu giao cac don dang cam, tinh km tung chang, gio
 *      den du kien, va dung mot duong dan Google Maps di qua tat ca cac diem.
 *
 * KHOANG CACH
 *   Duong chim bay (Haversine, cung ham voi phi ship) nhan HE_SO_DUONG = 1.3 de
 *   ra km duong pho uoc tinh. Khong goi dich vu chi duong ngoai (OSRM / Google
 *   Directions): them khoa API, them mot diem hong khi mat mang, ma mot chuyen
 *   chi 2-5 diem trong ban kinh 5km thi sai so khong doi thu tu giao.
 *
 * TOI UU THU TU
 *   Bai toan nguoi giao hang (duong mo: xuat phat o quan, KHONG quay ve).
 *   - <= 7 diem: thu het moi hoan vi (7! = 5040 cach) -> chac chan toi uu.
 *   - > 7 diem : lang gieng gan nhat roi sua bang 2-opt (dao doan) -> rat gan
 *     toi uu, chay tuc thi.
 *   Chi phi = km + PHAT_TRE x so phut tre so voi gio hen / gio du kien cua tung
 *   don. Nho vay don khach hen som (hoac da cho lau) duoc dua len truoc du
 *   khong nam tren duong ngan nhat.
 *
 *   Ket qua lap lai duoc: cung dau vao luon ra cung thu tu (khong ngau nhien).
 */
// Lay ham khi goi (khong destructure luc nap): vanChuyenService co the dang nap do
// vong require (vanChuyen -> phanCong -> loTrinh -> vanChuyen).
const khoangCachKm = (...a) => require('./vanChuyenService').khoangCachKm(...a);

const HE_SO_DUONG = 1.3;        // km duong pho ~ 1.3 x duong chim bay
const TOC_DO_KMH = 22;          // xe may trong pho gio cao diem
const PHUT_MOI_DIEM = 5;        // dung xe, goi khach, trao hang
const PHAT_TRE = 0.5;           // 1 phut tre = 0.5 km di them (tre 10 phut ~ chay them 5 km)
const VET_CAN_TOI_DA = 7;       // so diem toi da con thu het hoan vi
const DIEM_LINK_TOI_DA = 9;     // Google Maps URL nhan toi da 9 diem dung giua duong

const coToaDo = (p) => p && Number.isFinite(Number(p.vi_do)) && Number.isFinite(Number(p.kinh_do))
  && !(Number(p.vi_do) === 0 && Number(p.kinh_do) === 0);

/** Km duong pho uoc tinh giua hai diem. */
function kmDuong(a, b) {
  return khoangCachKm(Number(a.vi_do), Number(a.kinh_do), Number(b.vi_do), Number(b.kinh_do)) * HE_SO_DUONG;
}

/**
 * Di theo mot thu tu, tinh km tung chang, gio den va so phut tre.
 * @param goc     diem xuat phat {vi_do, kinh_do}
 * @param thuTu   mang diem {id, vi_do, kinh_do, han: ms|null}
 * @param batDau  ms - luc xuat phat
 */
function diTheo(goc, thuTu, batDau) {
  let truoc = goc;
  let km = 0;
  let gio = batDau;
  let tre = 0;
  const chang = [];
  for (const p of thuTu) {
    const k = kmDuong(truoc, p);
    km += k;
    gio += (k / TOC_DO_KMH) * 3600000;
    if (p.han && gio > p.han) tre += (gio - p.han) / 60000;
    chang.push({ id: p.id, km: k, den_luc: gio });
    gio += PHUT_MOI_DIEM * 60000;
    truoc = p;
  }
  return { km, tre, chiPhi: km + PHAT_TRE * tre, chang };
}

/** Moi hoan vi cua mang (sinh dan, khong tao het mot luc). */
function* hoanVi(a, k = 0) {
  if (k >= a.length - 1) { yield a; return; }
  for (let i = k; i < a.length; i++) {
    [a[k], a[i]] = [a[i], a[k]];
    yield* hoanVi(a, k + 1);
    [a[k], a[i]] = [a[i], a[k]];
  }
}

function langGiengGanNhat(goc, ds) {
  const con = ds.slice();
  const kq = [];
  let tai = goc;
  while (con.length) {
    let iTot = 0;
    for (let i = 1; i < con.length; i++) {
      if (kmDuong(tai, con[i]) < kmDuong(tai, con[iTot])) iTot = i;
    }
    tai = con.splice(iTot, 1)[0];
    kq.push(tai);
  }
  return kq;
}

/** 2-opt: dao nguoc tung doan, giu lai neu chi phi giam, lap toi khi het cai thien. */
function haiOpt(goc, thuTu, batDau) {
  let tot = thuTu.slice();
  let cpTot = diTheo(goc, tot, batDau).chiPhi;
  let caiThien = true;
  for (let vong = 0; caiThien && vong < 50; vong++) {
    caiThien = false;
    for (let i = 0; i < tot.length - 1; i++) {
      for (let j = i + 1; j < tot.length; j++) {
        const thu = tot.slice(0, i).concat(tot.slice(i, j + 1).reverse(), tot.slice(j + 1));
        const cp = diTheo(goc, thu, batDau).chiPhi;
        if (cp < cpTot - 1e-9) { tot = thu; cpTot = cp; caiThien = true; }
      }
    }
  }
  return tot;
}

/**
 * Thu tu giao tot nhat.
 * @param goc  {vi_do, kinh_do} - quan (con don chua lay) hoac vi tri shipper
 * @param ds   [{id, vi_do, kinh_do, han?}]  han = ms, gio hen / gio du kien
 * @returns {{thu_tu, km, tre_phut, chang, khong_toa_do}}
 *   Diem khong co toa do khong xep duoc -> de cuoi, trong `khong_toa_do`.
 */
function toiUu(goc, ds, { batDau = Date.now() } = {}) {
  const co = ds.filter(coToaDo).sort((a, b) => Number(a.id) - Number(b.id));
  const khong = ds.filter((p) => !coToaDo(p));
  if (!coToaDo(goc) || !co.length) {
    return { thu_tu: co.concat(khong).map((p) => p.id), km: 0, tre_phut: 0, chang: [], khong_toa_do: khong.map((p) => p.id) };
  }
  let tot;
  if (co.length <= VET_CAN_TOI_DA) {
    let cpTot = Infinity;
    for (const hv of hoanVi(co.slice())) {
      const cp = diTheo(goc, hv, batDau).chiPhi;
      if (cp < cpTot - 1e-9) { cpTot = cp; tot = hv.slice(); }
    }
  } else {
    tot = haiOpt(goc, langGiengGanNhat(goc, co), batDau);
  }
  const di = diTheo(goc, tot, batDau);
  return {
    thu_tu: tot.map((p) => p.id).concat(khong.map((p) => p.id)),
    km: di.km,
    tre_phut: di.tre,
    chang: di.chang,
    khong_toa_do: khong.map((p) => p.id),
  };
}

/**
 * Chen them mot don vao chuyen thi phai di vong them bao nhieu km.
 * Tra ve null neu thieu toa do (khong danh gia duoc -> khong ghep).
 */
function kmThemKhiGhep(goc, dsCu, moi, opts) {
  if (!coToaDo(goc) || !coToaDo(moi) || !dsCu.every(coToaDo)) return null;
  const truoc = toiUu(goc, dsCu, opts);
  const sau = toiUu(goc, dsCu.concat([moi]), opts);
  return { km_truoc: truoc.km, km_sau: sau.km, them_km: sau.km - truoc.km, tre_them: sau.tre_phut - truoc.tre_phut, thu_tu: sau.thu_tu };
}

/**
 * Duong dan Google Maps chi duong qua nhieu diem (khong can khoa API).
 * Bo trong `origin` -> Google lay vi tri hien tai cua dien thoai.
 * @param diem mang {vi_do, kinh_do, dia_chi} theo dung thu tu di
 */
function linkGoogleMaps(diem) {
  const ma = (p) => (coToaDo(p) ? `${Number(p.vi_do)},${Number(p.kinh_do)}` : String(p.dia_chi || ''));
  const ds = diem.filter((p) => coToaDo(p) || p.dia_chi).slice(0, DIEM_LINK_TOI_DA + 1);
  if (!ds.length) return null;
  const dich = ds[ds.length - 1];
  const giua = ds.slice(0, -1);
  let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(ma(dich));
  if (giua.length) url += '&waypoints=' + giua.map((p) => encodeURIComponent(ma(p))).join('%7C');
  return url;
}

module.exports = {
  HE_SO_DUONG, TOC_DO_KMH, PHUT_MOI_DIEM,
  coToaDo, kmDuong, toiUu, kmThemKhiGhep, linkGoogleMaps,
};

/**
 * Tri nho hoi thoai cua tro ly ao.
 *
 * Moi phien (session) giu mot doi tuong `nho`:
 *   lich_su    [{ vai: 'khach'|'bot', noi_dung, luc, mon? }]  - N luot gan nhat
 *   mon_truoc  [id...]          mon vua gioi thieu, DUNG THU TU hien tren khung chat
 *   xem_them   { kieu, cau|ma, da_xem: [id] }   de hieu "con mon nao khac", "them nua"
 *   cau_truoc  cau hoi gan nhat bot tra loi duoc (hieu "con thu 7 thi sao")
 *   so_thich   { an_chay, khong_cay, khong_hai_san, khong_bo, so_nguoi, ngan_sach }
 *   ten        ten khach tu xung ("minh ten Lan")
 *
 * Khong luu gi xuong CSDL ngoai nhat ky hoi thoai san co: het phien la quen,
 * dung nhu khach doi nhan vien tu van.
 */
const { chuanHoaCoBan } = require('./chatbotTriThuc');

const SO_CHU = { mot: 1, nhat: 1, dau: 1, 'dau tien': 1, hai: 2, nhi: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8 };

/** Them mot luot vao lich su, cat bot cho vua `toiDa`. */
function ghiLuot(nho, vai, noiDung, extra = {}, toiDa = 12) {
  const ls = Array.isArray(nho.lich_su) ? nho.lich_su.slice() : [];
  ls.push({ vai, noi_dung: String(noiDung || '').slice(0, 600), luc: Date.now(), ...extra });
  nho.lich_su = ls.slice(-toiDa * 2);
  return nho;
}

/** Lich su dang van ban cho AI / man hinh quan tri. */
function lichSuGanDay(nho, n = 12) {
  return (nho.lich_su || []).slice(-n * 2);
}

// --------------------------------------------------------------------------
// SO THICH KHACH TU NOI RA
// --------------------------------------------------------------------------
/**
 * Doc so thich trong cau. Tra ve { thay_doi: {...}, nhac_lai: 'cau xac nhan' } hoac null.
 * Chi bat cau KHANG DINH ve ban than ("minh an chay", "toi khong an duoc cay"),
 * khong bat cau hoi ("co mon chay khong?").
 */
function docSoThich(cau) {
  const x = chuanHoaCoBan(cau);
  if (!x) return null;
  const laHoi = /\?/.test(cau) || /\b(co .* khong|khong a|khong vay|khong nhi)\s*$/.test(x);
  const ve = {};
  const nhac = [];
  const toi = '(minh|toi|tui|tao|em|anh|chi|nha minh|ben minh|nhom minh|ca nha)';

  if (!laHoi && new RegExp(`\\b${toi}\\b.{0,12}\\b(an chay|an thuan chay|an man chay|kieng thit)\\b`).test(x)) {
    ve.an_chay = true; nhac.push('bạn ăn chay');
  }
  if (new RegExp(`\\b(khong an duoc cay|khong an cay|so cay|ki cay|kieng cay|khong biet an cay|an cay khong duoc)\\b`).test(x)) {
    ve.khong_cay = true; nhac.push('bạn không ăn cay');
  } else if (!laHoi && /\b(thich an cay|ghien cay|me cay|an cay gioi)\b/.test(x)) {
    ve.khong_cay = false; ve.thich_cay = true; nhac.push('bạn thích ăn cay');
  }
  if (/\b(di ung|khong an duoc|khong an|kieng|so)\b.{0,10}\b(hai san|tom|cua|muc|so|hau|ca song|ca)\b/.test(x)) {
    ve.khong_hai_san = true; nhac.push('bạn không ăn hải sản/cá');
  }
  if (/\b(khong an duoc|khong an|kieng|di ung)\b.{0,6}\b(thit bo|bo)\b/.test(x)) {
    ve.khong_bo = true; nhac.push('bạn không ăn bò');
  }
  const nguoi = x.match(/\b(\d{1,3}|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s*(nguoi|khach|dua|ban)\b/);
  if (nguoi && /\b(di|nhom|tui minh|bon minh|chung minh|ca nha|gia dinh|dat|co)\b/.test(x)) {
    const so = /^\d+$/.test(nguoi[1]) ? Number(nguoi[1]) : ({ mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 })[nguoi[1]];
    if (so && so <= 300) { ve.so_nguoi = so; nhac.push(`đi ${so} người`); }
  }
  const tien = x.match(/\b(tam|khoang|duoi|toi da|ngan sach|co)\s*(\d{2,4})\s*(k|nghin|ngan)\b/);
  if (tien && /\b(ngan sach|nguoi|moi nguoi|co|chi co|toi da)\b/.test(x)) {
    ve.ngan_sach = Number(tien[2]) * 1000; nhac.push(`ngân sách khoảng ${tien[2]}k`);
  }
  // Ten: "minh ten Lan", "ten minh la Lan", "toi la Minh" (chu dau viet hoa trong cau goc).
  const mTen = String(cau).match(/(?:(?:mình|tôi|em|tui|tớ)\s+tên(?:\s+là)?|tên\s+(?:mình|tôi|em|tui|tớ)\s+là|(?:mình|tôi|em)\s+là)\s+([A-ZÀ-Ỹ][\p{L}]{1,15}(?:\s+[A-ZÀ-Ỹ][\p{L}]{1,15}){0,2})/u);
  if (mTen) { ve.ten = mTen[1].trim(); nhac.push(`tên bạn là ${ve.ten}`); }

  if (!Object.keys(ve).length) return null;
  return { thay_doi: ve, nhac_lai: nhac };
}

function capNhatSoThich(nho, sv) {
  if (!sv) return nho;
  const { ten, ...con } = sv.thay_doi;
  nho.so_thich = { ...(nho.so_thich || {}), ...con };
  if (ten) nho.ten = ten;
  return nho;
}

// --------------------------------------------------------------------------
// LOC MON THEO SO THICH
// --------------------------------------------------------------------------
const RE_CAY = /(^|\s)(cay|kim chi|kimchi|ớt|sate|sa tế)(\s|$)|spicy|chili/;
const RE_HAI_SAN = /(^|\s)(cá|tôm|mực|cua|sò|hàu|lươn|ghẹ|bạch tuộc|sashimi|sushi|nigiri|gunkan|temaki|hải sản|trứng cá|ốc)(\s|$)|salmon|tuna|shrimp|squid|crab|eel|fish|seafood|octopus|oyster|ebi|unagi|ikura|tobiko|scallop/;
const RE_BO = /(^|\s)(bò|wagyu)(\s|$)|beef/;
const RE_CHAY = /(^|\s)(chay|rau|đậu hũ|đậu phụ|nấm|salad|rong biển|dưa leo|bơ|trái cây|kem|bánh|chè|mochi|khoai)(\s|$)|tofu|vegetable|vegan|salad|seaweed|mushroom|fruit|ice cream|matcha/;
const RE_DO_UONG = /DRINK|SAKE|BEER/;

function tenDeLoc(m) {
  return `${String(m.ten || '').toLowerCase()} ${String(m.en || '').toLowerCase()}`;
}

/**
 * Bo mon trai so thich. Tra { ds, bo: ['mon cay', ...] } - `bo` de bot noi
 * "minh da bo cac mon cay vi ban khong an cay".
 */
function locTheoSoThich(ds, st) {
  if (!st || !ds || !ds.length) return { ds: ds || [], bo: [] };
  let kq = ds;
  const bo = [];
  const loc = (dk, nhan) => {
    const moi = kq.filter((m) => !dk(m));
    if (moi.length && moi.length < kq.length) { kq = moi; bo.push(nhan); }
  };
  if (st.khong_cay) loc((m) => RE_CAY.test(tenDeLoc(m)), 'món cay');
  if (st.khong_hai_san) loc((m) => RE_HAI_SAN.test(tenDeLoc(m)) || /SASHIMI|SUSHI|NIGIRI|GUNKAN|TEMAKI|OYSTER/.test(m.loai_goc || ''), 'món hải sản');
  if (st.khong_bo) loc((m) => RE_BO.test(tenDeLoc(m)), 'món bò');
  if (st.an_chay) {
    const chay = kq.filter((m) => RE_CHAY.test(tenDeLoc(m)) && !RE_HAI_SAN.test(tenDeLoc(m)) && !/(thịt|bò|gà|heo|lợn|vịt|beef|chicken|pork)/.test(tenDeLoc(m)));
    if (chay.length && chay.length < kq.length) { kq = chay; bo.push('món mặn'); }
  }
  if (st.ngan_sach) loc((m) => m.gia > st.ngan_sach && !RE_DO_UONG.test(m.loai_goc || ''), `món trên ${Math.round(st.ngan_sach / 1000)}k`);
  return { ds: kq, bo };
}

function cauDaLoc(bo) {
  if (!bo || !bo.length) return '';
  return `\n_(Mình đã bỏ bớt ${bo.join(', ')} theo ý bạn dặn lúc nãy nha)_`;
}

// --------------------------------------------------------------------------
// CAU NOI TIEP
// --------------------------------------------------------------------------
/** "mon thu 2", "cai dau tien", "mon cuoi" -> vi tri (0-based) trong mon_truoc; -1 = cuoi. */
function viTriTheoThuTu(cau) {
  const x = chuanHoaCoBan(cau);
  const m = x.match(/\b(mon|cai|so|phan|dia|to|ly)?\s*thu\s*(\d|mot|nhat|hai|nhi|ba|bon|tu|nam|sau)\b/)
    || x.match(/\b(mon|cai)\s+(dau tien|dau)\b/)
    || x.match(/\b(mon|cai)\s+(\d)\b/);
  if (m) {
    const v = /^\d$/.test(m[2]) ? Number(m[2]) : SO_CHU[m[2]];
    if (v) return v - 1;
  }
  if (/\b(mon|cai)\s+(cuoi|cuoi cung|sau cung)\b/.test(x)) return -1;
  return null;
}

/** "con mon nao khac", "them mon khac", "mon khac di", "xem them" */
function laXemThem(cau) {
  const x = chuanHoaCoBan(cau);
  return /\b(mon khac|mon nao khac|con mon nao|con gi nua|con gi khac|xem them|them mon|mon nua|nua khong|goi y them|goi y khac|cai khac|loai khac|con nua khong)\b/.test(x)
    && x.split(' ').length <= 9;
}

/** "re hon", "dat hon", "co mon nao re hon khong" */
function soSanhGia(cau) {
  const x = chuanHoaCoBan(cau);
  if (/\b(re hon|mem hon|it tien hon|gia thap hon|binh dan hon)\b/.test(x)) return 're';
  if (/\b(dat hon|xin hon|sang hon|cao cap hon|gia cao hon|ngon hon)\b/.test(x)) return 'dat';
  return null;
}

/**
 * Cau ngan dua vao cau truoc: "con thu 7 thi sao", "the con chi nhanh quan 1",
 * "vay con giao hang?". Tra ve cau ghep de bot hieu lai, hoac null.
 */
function ghepCauNoiTiep(cau, nho, toiDaPhut = 15) {
  if (!nho || !nho.cau_truoc || !nho.cau_truoc_luc) return null;
  if (Date.now() - nho.cau_truoc_luc > toiDaPhut * 60000) return null;
  const x = chuanHoaCoBan(cau);
  const soTu = x.split(' ').filter(Boolean).length;
  if (!soTu || soTu > 8) return null;
  const noiTiep = /^(con|the con|vay con|the|vay|zay|z|con neu|neu|lo|nhung|ma)\b/.test(x)
    || /\b(thi sao|thi the nao|thi sao a|thi sao vay|duoc khong|thi co khong|nua khong|nua)\s*$/.test(x);
  if (!noiTiep && soTu > 3) return null;
  // Cau ke ve ban than ("minh ten Lan", "em o quan 7") khong phai cau hoi noi tiep.
  if (!noiTiep && /^(minh|toi|tui|em|anh|chi|to|tao)/.test(x)) return null;
  return `${nho.cau_truoc} ${cau}`;
}

module.exports = {
  ghiLuot, lichSuGanDay, docSoThich, capNhatSoThich, locTheoSoThich, cauDaLoc,
  viTriTheoThuTu, laXemThem, soSanhGia, ghepCauNoiTiep,
  RE_CAY, RE_HAI_SAN,
};

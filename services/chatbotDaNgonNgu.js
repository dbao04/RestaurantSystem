/*
 * Lớp đa ngôn ngữ cho chatbot.
 *
 * Mô hình ML hiện được huấn luyện bằng tiếng Việt. Thay vì đoán dịch tự do
 * (dễ làm sai giá tiền/trạng thái đơn), lớp này chỉ chuẩn hoá các câu hỏi
 * nghiệp vụ phổ biến về đúng câu tiếng Việt mà mô hình đã hiểu, sau đó thay
 * phần văn bản bao quanh dữ liệu bằng mẫu câu đã được duyệt. Dữ liệu thật
 * (tên món, giá, số lượng) vẫn đi nguyên vẹn từ CSDL.
 */

function maHopLe(ma) { return ['en', 'ja'].includes(ma) ? ma : 'vi'; }

function thuGon(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const CAU_HOI = {
  en: [
    [/recommend|popular dish|what.*good|menu/i, 'Quán có món gì ngon?'],
    [/promotion|discount|special offer/i, 'Có khuyến mãi nào không?'],
    [/opening hours|what time.*open|when.*open/i, 'Quán mở cửa mấy giờ?'],
    [/book.*table|table.*for\s*\d+|reservation/i, 'Đặt bàn cho 4 người'],
    [/deliver|delivery|takeaway/i, 'Nhà hàng có giao hàng không?'],
    [/payment|pay.*qr|vietqr|cash/i, 'Nhà hàng nhận thanh toán thế nào?'],
    [/drink|beverage/i, 'Quán có đồ uống gì?'],
    [/vegetarian|vegan/i, 'Quán có món chay không?'],
  ],
  ja: [
    [/おすすめ|人気.*料理|何.*料理|メニュー/i, 'Quán có món gì ngon?'],
    [/キャンペーン|割引|プロモーション/i, 'Có khuyến mãi nào không?'],
    [/営業時間|何時.*開|開店.*時間/i, 'Quán mở cửa mấy giờ?'],
    [/予約|テーブル.*名|\d+名.*テーブル/i, 'Đặt bàn cho 4 người'],
    [/デリバリー|配達|持ち帰り/i, 'Nhà hàng có giao hàng không?'],
    [/支払い|決済|現金|qr/i, 'Nhà hàng nhận thanh toán thế nào?'],
    [/飲み物|ドリンク/i, 'Quán có đồ uống gì?'],
    [/ベジタリアン|菜食/i, 'Quán có món chay không?'],
  ],
};

function chuanHoaCauHoi(cauHoi, ngonNgu) {
  const nn = maHopLe(ngonNgu);
  if (nn === 'vi') return String(cauHoi || '');
  // 1) Cau trong kho kien thuc (da co ban dich) -> hoi bang cau tieng Viet goc.
  const cauKho = timCauKho(cauHoi, nn);
  if (cauKho) return cauKho;
  // 2) Cau nghiep vu ML hieu.
  const cau = thuGon(cauHoi);
  const khop = (CAU_HOI[nn] || []).find(([mau]) => mau.test(cau));
  if (khop) return khop[1];
  // 3) Hoi mon: doi ten nguyen lieu EN/JA sang tieng Viet de tim trong thuc don.
  return dichTuMon(cauHoi, nn);
}

const CAU_TRA_LOI = {
  en: {
    khong_hieu: 'I cannot answer that question yet. I can help with the menu, prices, reservations, promotions and delivery. Please contact a staff member for further help.',
    chao_hoi: 'Hello! I am the restaurant’s virtual assistant. How can I help you?',
    tam_biet: 'Thank you for visiting our restaurant. See you again soon!',
    cam_on: 'You are very welcome. Please message me whenever you need help.',
    dat_ban: 'You can book a table on the website by choosing the date, time and number of guests.',
    hoi_khuyen_mai: 'The currently available promotions are listed below.',
    hoi_thuc_don: 'Here are the dishes currently available:',
    hoi_mon_ban_chay: 'These are some of our most popular dishes:',
    hoi_do_uong: 'Here are the drinks currently available:',
    hoi_mon_chay: 'Here are dishes suitable for vegetarian guests:',
    hoi_combo: 'Here are the combos currently available:',
    hoi_giao_hang: 'The restaurant offers takeaway and delivery. Please order from the menu and select delivery at checkout.',
    hoi_thanh_toan: 'We accept cash, bank transfer and VietQR payment.',
    hoi_gia_mon: 'Which dish would you like to know the price of? Please type the dish name as it appears on our menu.',
    hoi_gio_mo_cua: 'We are open **10:00–22:00** every day (last seating at 21:30).',
    hoi_dia_chi: 'The restaurant is at **12 Nguyễn Văn Bảo Street, Hạnh Thông, Ho Chi Minh City**. Free motorcycle and car parking is available for guests.',
    hoi_lien_he: 'Please contact us via **hotline 0388 062 048** or message us directly in the Chat section of this website.',
    hoi_dat_coc: 'Regular table reservations **do not require a deposit**. A deposit may be requested for VIP tables or large groups and is refunded in full when you dine with us.',
  },
  ja: {
    khong_hieu: 'このご質問にはまだお答えできません。メニュー、価格、予約、キャンペーン、デリバリーについてお手伝いできます。詳しくはスタッフへお問い合わせください。',
    chao_hoi: 'こんにちは。レストランのAIアシスタントです。どのようなお手伝いをいたしましょうか？',
    tam_biet: 'ご来店ありがとうございました。またのお越しをお待ちしております。',
    cam_on: 'どういたしまして。必要なことがありましたら、いつでもお知らせください。',
    dat_ban: 'ウェブサイトで日付、時間、人数を選択してテーブルをご予約いただけます。',
    hoi_khuyen_mai: '現在ご利用いただけるキャンペーンは以下のとおりです。',
    hoi_thuc_don: '現在ご提供している料理はこちらです。',
    hoi_mon_ban_chay: '人気の料理はこちらです。',
    hoi_do_uong: '現在ご提供しているドリンクはこちらです。',
    hoi_mon_chay: 'ベジタリアンのお客様向けの料理はこちらです。',
    hoi_combo: '現在ご利用いただけるセットメニューはこちらです。',
    hoi_giao_hang: 'テイクアウトとデリバリーをご利用いただけます。メニューからご注文後、お会計時にデリバリーを選択してください。',
    hoi_thanh_toan: '現金、銀行振込、VietQRでのお支払いをご利用いただけます。',
    hoi_gia_mon: 'どの料理の価格をお知りになりたいですか？メニューに記載されている料理名をご入力ください。',
    hoi_gio_mo_cua: '毎日 **10:00～22:00** に営業しています（最終入店は21:30です）。',
    hoi_dia_chi: '店舗は **ホーチミン市ハイン・トン、グエン・ヴァン・バオ通り12番地** にあります。バイクと車の無料駐車場をご利用いただけます。',
    hoi_lien_he: '**ホットライン 0388 062 048**、または本サイトのチャットからお問い合わせください。',
    hoi_dat_coc: '通常のテーブル予約は **デポジット不要** です。VIPテーブルまたは大人数のグループではデポジットをお願いする場合がありますが、ご来店・お食事時に全額返金いたします。',
  },
};

const NHAN_COT = {
  en: {
    name_mon: 'Dish', gia_mon: 'Price', so_luong: 'Orders', name_loai: 'Category',
    code: 'Code', uu_dai: 'Offer', min_order_value: 'Minimum order', valid_until: 'Valid until',
    ten_combo: 'Combo', gia_combo: 'Price', mo_ta: 'Includes',
  },
  ja: {
    name_mon: '料理', gia_mon: '価格', so_luong: '注文数', name_loai: 'カテゴリー',
    code: 'コード', uu_dai: '特典', min_order_value: '最低注文額', valid_until: '有効期限',
    ten_combo: 'セット', gia_combo: '価格', mo_ta: '内容',
  },
};

const GOI_Y = {
  'Quán có món gì ngon?': { en: 'What dishes do you recommend?', ja: 'おすすめの料理は何ですか？' },
  'Có khuyến mãi nào không?': { en: 'Are there any promotions?', ja: 'キャンペーンはありますか？' },
  'Đặt bàn cho 4 người': { en: 'Book a table for 4 people', ja: '4名でテーブルを予約したいです' },
  'Có nhận giao hàng không?': { en: 'Do you offer delivery?', ja: 'デリバリーはありますか？' },
  'Quán mở cửa mấy giờ?': { en: 'What are your opening hours?', ja: '営業時間を教えてください。' },
};

// Câu gợi ý hỏi giá mang tên một món CÓ THẬT, do phía Python lấy từ thực đơn
// đang bán (xem `ten_mon_vi_du` trong ml_service/chatbot/tra_loi.py). Vì tên
// món đổi theo thực đơn nên không tra bảng cố định được — dịch theo mẫu câu và
// giữ nguyên tên món.
const MAU_GOI_Y_GIA = /^Giá\s+(.+?)\s+bao nhiêu\?$/i;
const DICH_GOI_Y_GIA = {
  en: (mon) => `How much is ${mon}?`,
  ja: (mon) => `${mon}はいくらですか？`,
};

function dichGoiY(cau, nn) {
  const san = (GOI_Y[cau] || {})[nn];
  if (san) return san;
  const khop = String(cau || '').match(MAU_GOI_Y_GIA);
  if (khop && DICH_GOI_Y_GIA[nn]) return DICH_GOI_Y_GIA[nn](khop[1]);
  return cau;
}

// Câu trả lời giá món: dữ liệu (tên món, giá) phải đi nguyên vẹn, chỉ dịch phần
// chữ bao quanh. Mẫu câu bên Python đổi thì regex không khớp và ta giữ nguyên
// câu tiếng Việt — hiện tiếng Việt còn hơn hiện sai giá.
const MAU_TRA_LOI_GIA = /^\*\*(.+?)\*\*\s*\((.+?)\)\s*có giá\s*\*\*(.+?)\*\*([\s\S]*)$/;
const DICH_TRA_LOI_GIA = {
  en: (ten, loai, gia, con) => `**${ten}** (${loai}) costs **${gia}**${con}`,
  ja: (ten, loai, gia, con) => `**${ten}**（${loai}）は **${gia}** です${con}`,
};

/*
 * `hoi_gia_mon` co hai ket cuc khac han nhau: HOI LAI ten mon (khi khach chua
 * neu mon nao), hoac TRA VE gia that. Ban dich san chi hop voi ket cuc dau.
 * Truoc day no de len ca ket cuc sau, nen khach EN/JA bam vao goi y hoi gia se
 * nhan lai cau hoi nguoc thay vi con so. Bot bao dang cho tham so bang
 * `cho_tham_so`; khong co co do nghia la no da tra loi that.
 */
function dangTraSoLieu(kq) {
  return kq.y_dinh === 'hoi_gia_mon' && !kq.cho_tham_so;
}

function dichCauGiaMon(vanBan, nn) {
  const khop = String(vanBan || '').match(MAU_TRA_LOI_GIA);
  const mau = DICH_TRA_LOI_GIA[nn];
  if (!khop || !mau) return vanBan;
  return mau(khop[1], khop[2], khop[3], khop[4]);
}

function dichPhanHoi(phanHoi, ngonNgu) {
  const nn = maHopLe(ngonNgu);
  if (nn === 'vi' || !phanHoi) return phanHoi;
  const banDich = CAU_TRA_LOI[nn] || {};
  const kq = { ...phanHoi };
  if (banDich[kq.y_dinh] && !dangTraSoLieu(kq)) kq.van_ban = banDich[kq.y_dinh];
  else if (kq.y_dinh === 'hoi_gia_mon') kq.van_ban = dichCauGiaMon(kq.van_ban, nn);
  if (Array.isArray(kq.cot)) {
    kq.cot = kq.cot.map((cot) => ({ ...cot, nhan: (NHAN_COT[nn] || {})[cot.khoa] || cot.nhan }));
  }
  if (Array.isArray(kq.goi_y)) {
    kq.goi_y = kq.goi_y.map((cau) => ({ cau_hoi: cau, nhan: dichGoiY(cau, nn) }));
  }
  return kq;
}

// ==========================================================================
// KHO KIEN THUC + THUC DON bang EN/JA (ban dich san: config/chatbot-ban-dich.js)
// ==========================================================================
const BD = require('../config/chatbot-ban-dich');
const VT = { en: 0, ja: 1 };

// Cau hoi EN/JA -> cau hoi chinh tieng Viet trong kho. Nhieu mau cung khop thi
// lay mau khop doan dai nhat ("hi, can I book a table" -> dat ban, khong phai chao).
function timCauKho(cauHoi, nn) {
  const cau = nn === 'en' ? thuGon(cauHoi) : String(cauHoi || '').trim();
  let tot = null;
  let dai = 0;
  for (const [vi, b] of Object.entries(BD.kien_thuc)) {
    const m = b[nn] && cau.match(b[nn][0]);
    if (m && m[0].length > dai) { tot = vi; dai = m[0].length; }
  }
  return tot;
}

function dichTuMon(cauHoi, nn) {
  let s = nn === 'en' ? thuGon(cauHoi) : String(cauHoi || '').trim();
  const gia = nn === 'en'
    ? s.match(/^(?:what(?:'s| is) the price of|how much (?:is|are|does|for)|price of)\s+(?:the |a |an )?(.+?)(?:\s+cost)?\s*\??$/)
    : s.match(/^(.+?)(?:は|って|の)?(?:いくら|値段|価格|料金)/);
  // Tieng Nhat viet lien -> chen khoang trang quanh tu da dich de khong dinh chu.
  const doi = (x) => (BD.tu_mon[nn] || []).reduce((t, [mau, vi]) => t.replace(mau, ` ${vi} `), x).replace(/\s+/g, ' ').trim();
  if (gia) return `Giá ${doi(gia[1])} bao nhiêu?`;
  return doi(s);
}

function nhanDich(cau, nn) {
  const b = BD.nhan[String(cau || '').trim()];
  return b ? b[VT[nn]] : cau;
}

// Thay {ten_khach} theo ngon ngu roi giao cho apDung (bien, emoji) cua kho.
function apDungNN(vb, nn, apDung, tenKhach) {
  const ten = String(tenKhach || '').trim();
  const goi = nn === 'ja' ? (ten ? `${ten}様` : 'お客様') : (ten || 'there');
  return apDung(String(vb || '').replace(/\{ten_khach\}/g, goi));
}

function giaTien(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

// Cau dan cho danh sach mon / mot mon (bo may thuc don viet tieng Viet).
function dichCauMon(kq, nn) {
  const kieu = String(kq.y_dinh || '').replace(/^mon:/, '');
  const ds = kq.mon || [];
  const m = ds[0];
  const en = nn === 'en';
  if ((kieu === 'chinh_xac' || kieu === 'ngu_canh') && ds.length === 1 && m) {
    if (!m.con) return en ? `Sorry, **${m.ten}** is **currently sold out** 😢 Please try another dish in *${m.loai}*!`
      : `申し訳ございません、**${m.ten}** は**ただいま品切れ**です 😢 *${m.loai}* のほかの料理もご覧ください！`;
    const ten = `**${m.ten}**${m.ma ? ` (${m.ma})` : ''}${m.en && m.en !== m.ten ? ` – _${m.en}_` : ''}`;
    return en ? `${ten} costs **${giaTien(m.gia)}**/${m.don_vi} ${m.icon || '🍽️'}\nCategory: **${m.loai}**. Would you like me to add it to your cart?`
      : `${ten} は **${giaTien(m.gia)}**/${m.don_vi} です ${m.icon || '🍽️'}\nカテゴリー：**${m.loai}**。カートに追加しますか？`;
  }
  if (kieu === 'ban_chay') return en ? "These are our guests' favourite dishes 🔥 Tap a photo for details:" : 'お客様に人気の料理はこちらです 🔥 写真をタップすると詳細が見られます：';
  if (kieu === 'theo_gia') return en ? 'Here are some budget-friendly dishes 💰:' : 'お手頃な料理はこちらです 💰：';
  if (ds.length === 1) return en ? "Is this the dish you're looking for? 👇" : 'お探しの料理はこちらですか？👇';
  return en ? `I found ${ds.length} dishes for you 👇` : `${ds.length}品見つかりました 👇`;
}

const Y_DINH_HE_THONG = { tu_cam: 'tin_tu_cam', de_lai_sdt: 'tin_cam_on_sdt', ngoai_gio: 'tin_ngoai_gio' };

/**
 * Dich phan hoi cua kho kien thuc / thuc don / cau he thong sang EN/JA.
 * Phan hoi ML da dich o dichPhanHoi -> chi dich nhan nut con sot.
 * @param {object} o { cauKho: cau hoi chinh cua dong kho da khop, apDung: fn(vb), tenKhach, sdt }
 */
function dichKetQua(kq, ngonNgu, o = {}) {
  const nn = maHopLe(ngonNgu);
  if (nn === 'vi' || !kq) return kq;
  const r = { ...kq };
  const i = VT[nn];
  const ad = (vb) => apDungNN(vb, nn, o.apDung || ((x) => x), o.tenKhach);
  if (r.nguon !== 'ml') {
    const bdKho = o.cauKho && BD.kien_thuc[o.cauKho] && BD.kien_thuc[o.cauKho][nn];
    if (r.nguon === 'kien_thuc' && bdKho) r.van_ban = ad(bdKho[1]);
    else if (String(r.y_dinh || '').startsWith('mon:')) r.van_ban = dichCauMon(r, nn);
    else if (Y_DINH_HE_THONG[r.y_dinh]) r.van_ban = ad(BD.he_thong[Y_DINH_HE_THONG[r.y_dinh]][i]).replace('{sdt}', o.sdt || '');
    else if (r.y_dinh === 'goi_y_gan_dung') r.van_ban = ad(BD.he_thong.tin_goi_y_gan_dung[i]);
    else if (r.y_dinh === 'khong_hieu') r.van_ban = ad(BD.he_thong[r.chuyen_nhan_vien ? 'tin_chuyen_nv' : 'tin_khong_hieu'][i]);
  }
  if (Array.isArray(r.goi_y)) {
    r.goi_y = r.goi_y.map((g) => {
      const cau = g && typeof g === 'object' ? g.cau_hoi : g;
      const nhan = g && typeof g === 'object' ? g.nhan : g;
      return { cau_hoi: cau, nhan: nhanDich(nhan, nn) };
    });
  }
  if (Array.isArray(r.lien_ket)) {
    r.lien_ket = r.lien_ket.map((l) => {
      let nhan = nhanDich(l.nhan, nn);
      const tatCa = /^Xem tất cả món (.+)$/.exec(l.nhan || '');
      if (tatCa) nhan = nn === 'en' ? `See all ${tatCa[1]}` : `${tatCa[1]}をすべて見る`;
      return { ...l, nhan };
    });
  }
  return r;
}

// Loi chao + goi y nhanh luc mo khung chat.
function dichKhoiDong(loiChao, goiY, ngonNgu, o = {}) {
  const nn = maHopLe(ngonNgu);
  if (nn === 'vi') return { loi_chao: loiChao, goi_y: goiY };
  return {
    loi_chao: apDungNN(BD.he_thong.loi_chao[VT[nn]], nn, o.apDung || ((x) => x), o.tenKhach),
    goi_y: (goiY || []).map((c) => ({ cau_hoi: c, nhan: nhanDich(c, nn) })),
  };
}

function cauHeThong(khoa, ngonNgu) {
  const nn = maHopLe(ngonNgu);
  return nn === 'vi' ? null : (BD.he_thong[khoa] || [])[VT[nn]] || null;
}

module.exports = { chuanHoaCauHoi, dichPhanHoi, dichKetQua, dichKhoiDong, cauHeThong, timCauKho };


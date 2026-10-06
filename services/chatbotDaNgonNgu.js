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
  const cau = thuGon(cauHoi);
  const khop = (CAU_HOI[nn] || []).find(([mau]) => mau.test(cau));
  return khop ? khop[1] : String(cauHoi || '');
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

module.exports = { chuanHoaCauHoi, dichPhanHoi };

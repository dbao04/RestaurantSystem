/**
 * Da ngon ngu cho khu WEBSITE KHACH (vi / en / ja).
 *
 * PHAM VI - CO Y HEP
 * ------------------
 * Chi khu khach duoc dich. /admin, /staff va /shipper giu nguyen tieng Viet:
 * nguoi dung ba khu do la nhan vien nha hang, dich ra chi lam ho phai doc lai
 * mot he thong ho da thuoc, va nhan doi so chuoi phai bao tri ma khong ai doc.
 *
 * BA NGUON QUYET DINH NGON NGU, THEO THU TU UU TIEN
 * --------------------------------------------------
 *   1. `?lang=en` tren dia chi   nguoi dung vua bam nut doi ngon ngu
 *   2. cookie `ngon_ngu`          lua chon da luu tu lan truoc
 *   3. header Accept-Language     doan tu trinh duyet, lan dau vao
 *   4. tieng Viet                 mac dinh
 *
 * Vi sao dung COOKIE chu khong phai phien dang nhap: khach chua dang nhap van
 * phai giu duoc lua chon ngon ngu qua nhieu lan ghe tham, va kho phien mac dinh
 * cua express-session nam trong bo nho - khoi dong lai may chu la mat sach.
 *
 * KHONG BAO GIO DE TRONG MAN HINH VI THIEU BAN DICH
 * -------------------------------------------------
 * `t()` thieu khoa thi lui ve tieng Viet, thieu ca tieng Viet thi tra ve chinh
 * ten khoa. Mot nhan xau con hon mot o trong - va ten khoa hien ra man hinh la
 * dau hieu ro rang de nguoi phat trien biet cho nao con thieu.
 */
const vi = require('../locales/vi');
const en = require('../locales/en');
const ja = require('../locales/ja');

const TU_DIEN = { vi, en, ja };

/** Danh sach ngon ngu cho nut doi ngon ngu. `ten_goc` la ten trong chinh no. */
const DS_NGON_NGU = [
  { ma: 'vi', ten: 'Tiếng Việt', ten_goc: 'Tiếng Việt', co: '🇻🇳', ma_ngan: 'VI' },
  { ma: 'en', ten: 'Tiếng Anh',  ten_goc: 'English',    co: '🇬🇧', ma_ngan: 'EN' },
  { ma: 'ja', ten: 'Tiếng Nhật', ten_goc: '日本語',      co: '🇯🇵', ma_ngan: 'JA' },
];

const MAC_DINH = 'vi';
const HOP_LE = new Set(Object.keys(TU_DIEN));

function chuanHoa(ma) {
  const m = String(ma || '').trim().toLowerCase().slice(0, 5);
  if (HOP_LE.has(m)) return m;
  // 'en-US', 'ja-JP' -> lay hai ky tu dau
  const goc = m.split(/[-_]/)[0];
  return HOP_LE.has(goc) ? goc : null;
}

/**
 * Doan ngon ngu tu header `Accept-Language`.
 *
 * Header co dang 'ja,en-US;q=0.9,vi;q=0.8'. Doc theo dung thu tu uu tien (q)
 * va lay ngon ngu DAU TIEN ma he thong co ban dich - khong phai ngon ngu dau
 * tien trong danh sach. Trinh duyet dat o Han Quoc se co 'ko' dung dau; bo qua
 * no va lay 'en' phia sau moi la dung y nguoi dung.
 */
function doanTuTrinhDuyet(header) {
  if (!header) return null;
  const ds = String(header).split(',')
    .map((phan) => {
      const [ma, ...tuyChon] = phan.trim().split(';');
      const q = tuyChon.find((x) => x.trim().startsWith('q='));
      return { ma, q: q ? Number(q.split('=')[1]) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const x of ds) {
    const m = chuanHoa(x.ma);
    if (m) return m;
  }
  return null;
}

/**
 * Lay chuoi theo khoa.
 *
 * Khoa dung dau cham de phan nhom: 'dieu_huong.thuc_don'. Tra ve chinh ten khoa
 * neu khong tim thay o ca ngon ngu dang chon lan tieng Viet.
 *
 * `bien` de chen gia tri: t('gio_hang.co_n_mon', nn, { n: 3 }) voi chuoi
 * 'Giỏ hàng có {n} món'. Chen bang thay the chuoi don gian, khong phai mot
 * dong template - o day khong co gi phuc tap den muc can den the.
 */
function t(khoa, ngonNgu, bien) {
  const nn = chuanHoa(ngonNgu) || MAC_DINH;
  let chuoi = TU_DIEN[nn][khoa];
  if (chuoi === undefined) chuoi = TU_DIEN[MAC_DINH][khoa];
  if (chuoi === undefined) return khoa;
  if (bien) {
    for (const [k, v] of Object.entries(bien)) {
      chuoi = chuoi.split('{' + k + '}').join(String(v));
    }
  }
  return chuoi;
}

// ===========================================================================
// TEN MON THEO NGON NGU
// ===========================================================================

/**
 * Tach ten tieng Anh ra khoi cot `ghichu_mon`.
 *
 * Cot nay dang chua chuoi dang 'S12- SALMON SASHIMI · phần' - ma mon, ten tieng
 * Anh, va don vi tinh dinh vao nhau. Ca 258 mon deu co, nen day la nguon ban
 * dich tieng Anh SAN CO, khong phai thu ta tu dich ra.
 *
 * Bo phan ma mon o dau (chu + so + dau gach) va phan don vi sau dau '·'.
 */
function tenTiengAnh(ghiChu) {
  if (!ghiChu) return null;
  let s = String(ghiChu).trim();
  s = s.split('·')[0];                          // bo don vi tinh
  s = s.replace(/^[A-Z]{0,4}\s*\d*\s*[-–—]\s*/i, ''); // bo ma mon dau chuoi
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  // Viet hoa dau moi tu cho de doc; du lieu goc dang VIET HOA TOAN BO.
  return s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

/**
 * Bang thuat ngu Anh -> Nhat.
 *
 * KHONG PHAI MOT BO DICH MAY. Day la bang tra TUNG THUAT NGU, dung tren dung
 * 202 tu that su xuat hien trong thuc don nay (rut ra bang cach quet toan bo
 * cot `ghichu_mon`). Ly do lam the thay vi dich ca cau: dich ca cau la sinh ra
 * du lieu moi ma khong ai kiem chung duoc; con thay 'SASHIMI' bang 刺身 hay
 * 'SALMON' bang サーモン thi khong the sai.
 *
 * BAI HOC TU LAN DAU
 * ------------------
 * Ban dau bang chi co vai chuc tu va thay may moc tung tu. Ket qua la nhung
 * chuoi nhu 'STIR-揚げ うどん WITH U.S 牛肉' - nua Nhat nua Anh viet hoa, doc
 * con kho hon de nguyen tieng Anh. Ba thay doi sua viec do:
 *
 *   1. Bang phu HET tu vung cua thuc don, khong bo sot tu nao dang ke.
 *   2. Cum tu tra truoc tu don ('FLYING FISH ROE' -> とびこ, chu khong phai
 *      'bay' + 'ca' + 'trung').
 *   3. Con qua nhieu tu chua dich duoc thi TRA VE NULL - man hinh se hien
 *      tieng Anh. Mot ten tieng Anh dung con hon mot ten nua Nhat gia hieu.
 */

/** Tu noi - bo han khi ghep sang tieng Nhat, tieng Nhat khong can chung. */
const BO_QUA = new Set(['WITH', 'WTH', 'AND', 'FOR', 'THE', 'OF', 'IN', 'A']);

/**
 * Ky tu danh dau cho ban dich CUM TU.
 *
 * Sau khi thay mot cum ('SEA URCHIN' -> 'ウニ'), buoc tach tu ben duoi phai
 * biet do la MOT don vi da xong chu khong phai chu can tra tiep. Dung mot ky tu
 * khong bao gio xuat hien trong ten mon lam vien de danh dau.
 */
const DAU = '\u0001';

/** Cum tu - phai tra TRUOC tu don. Xem ghi chu tren. */
const CUM_NHAT = {
  'FLYING FISH ROE': 'とびこ', 'SALMON ROE': 'いくら', 'SEA URCHIN': 'ウニ',
  'SURF CLAM': 'ホッキ貝', 'SOFT-SHELL CRAB': 'ソフトシェルクラブ',
  'CRAB STICK': 'カニカマ', 'ICE CREAM': 'アイスクリーム', 'PANNA COTTA': 'パンナコッタ',
  'HOT POT': '鍋', 'GREEN TEA': '緑茶', 'OOLONG TEA': 'ウーロン茶',
  'ROASTED RICE TEA': '玄米茶', 'MATCHA LATTE': '抹茶ラテ', 'ALOE VERA': 'アロエ',
  'PASSION FRUIT': 'パッションフルーツ', 'BLACK PEPPER': '黒胡椒',
  'SOY SAUCE': '醤油', 'SESAME OIL': 'ごま油', 'PERILLA LEAF': '大葉',
  'SEASONED EGG': '味玉', 'ONSEN EGG': '温泉卵', 'SALMON SKIN': 'サーモン皮',
  'SALMON BELLY': 'サーモン腹身', 'SALMON BELLIES': 'サーモン腹身',
  'SALMON HEAD': 'サーモンかま', 'FISH HEAD': 'かま', 'JAPANESE AMBERJACK': 'ハマチ',
  'JAPANESE EEL': 'うなぎ', 'DRIED SEAWEED': '海苔', 'SEA GRAPES': '海ぶどう',
  'PICKLED HERRING': 'にしん酢漬け', 'STIR-FRIED': '炒め', 'PAN-SEARED': '炙り',
  'DEEP FRIED': '揚げ', 'U.S BEEF': '米国産牛肉', 'CREME BRULEE': 'クレームブリュレ',
  'CREME BRULEE': 'クレームブリュレ',
  'COCA COLA': 'コカ・コーラ', 'BOTTLED WATER': 'ミネラルウォーター',
  'EXTRA VEGETABLES': '野菜追加', 'GOLDEN LOTUS': '金蓮', 'PINK GUAVA': 'ピンクグアバ',

  /*
    Ba cum dat o day vi tra tung tu se ra ket qua SAI, khong phai chi vung:

      COCKLE CLAM   'COCKLE'=赤貝 + 'CLAM'=貝  ->  赤貝貝, thua mot chu
      AUKOBE BEEF   'AUKOBE' da gom ca chu bo   ->  和牛牛肉, thua mot chu
      BEEF TENDON   'TENDON' o day la GAN BO, khong phai mon com 天丼.
                    Tra tung tu cho ra 'sup com tempura bo' - sai han mon an.

    Truong hop thu ba la ly do bang cum tu phai co: mot tu tieng Anh co the la
    hai thu khac han nhau, va chi cum tu moi phan biet duoc.
  */
  'COCKLE CLAM': '赤貝', 'COCKLE CLAMS': '赤貝',
  'AUKOBE BEEF': 'オーストラリア和牛',
  'BEEF TENDON': '牛すじ',
};

/** Tu don. */
const NHAT = {
  // --- Kieu mon ---
  'SASHIMI': '刺身', 'NIGIRI': '握り', 'GUNKAN': '軍艦', 'TEMAKI': '手巻き',
  'MAKI': '巻き', 'TEMPURA': '天ぷら', 'TENDON': '天丼', 'RAMEN': 'ラーメン',
  'UDON': 'うどん', 'TEPPANYAKI': '鉄板焼き', 'SUMIYAKI': '炭焼き',
  'SUKIYAKI': 'すき焼き', 'KARAAGE': 'から揚げ', 'CHIRASHIDON': 'ちらし丼',
  'GYUDON': '牛丼', 'OMURICE': 'オムライス', 'NABE': '鍋', 'HOTPOT': '鍋',
  'SUSHI': '寿司', 'ROLL': 'ロール', 'ROLLS': 'ロール', 'SET': 'セット',
  'COMBO': 'コンボ', 'SOUP': 'スープ', 'SALAD': 'サラダ', 'PASTA': 'パスタ',
  'CARPACCIO': 'カルパッチョ', 'ARPACCIO': 'カルパッチョ', 'TARTARE': 'タルタル',
  'TATAKI': 'たたき', 'STEAK': 'ステーキ', 'PANCAKE': 'お好み焼き',
  'CHAWANMUSHI': '茶碗蒸し', 'DOBIN': '土瓶蒸し', 'FRIES': 'フライドポテト',
  'CAKE': 'ケーキ', 'TIRAMISU': 'ティラミス', 'JUICE': 'ジュース',
  'LEMONADE': 'レモネード', 'MOJITO': 'モヒート', 'TEA': 'お茶', 'CREAM': 'クリーム',
  // --- Hai san ---
  'SALMON': 'サーモン', 'TUNA': 'マグロ', 'AMBERJACK': 'ハマチ', 'GROUPER': 'ハタ',
  'MACKEREL': 'サバ', 'SABA': 'さば', 'SANMA': 'さんま', 'CAPELIN': 'ししゃも',
  'HERRING': 'にしん', 'EEL': 'うなぎ', 'OCTOPUS': 'タコ', 'SQUID': 'イカ',
  'SCALLOP': 'ホタテ', 'OYSTER': '牡蠣', 'OYSTERS': '牡蠣', 'ABALONE': 'アワビ',
  'CLAM': '貝', 'CLAMS': '貝', 'COCKLE': '赤貝', 'AKAGAI': '赤貝',
  'JELLYFISH': 'くらげ', 'CRAB': 'カニ', 'SHRIMP': 'エビ', 'SHIRMP': 'エビ',
  'SHRRIMP': 'エビ', 'PRAWN': 'エビ', 'FISH': '魚', 'SEAFOOD': '海鮮',
  'UNI': 'ウニ', 'TOBIKO': 'とびこ', 'ROE': '卵', 'KOMOCHI': '子持ち',
  'SEAWEED': '海藻', 'NORI': '海苔', 'BELLY': '腹身', 'BELLIES': '腹身',
  'SKIN': '皮', 'SHELL': '殻', 'HEAD': 'かま',
  // --- Thit ---
  'BEEF': '牛肉', 'WAGYU': '和牛', 'AUKOBE': 'オーストラリア和牛',
  'PORK': '豚肉', 'CHASIU': 'チャーシュー', 'CHICKEN': '鶏肉',
  // --- Rau, trai cay, khac ---
  'RICE': 'ご飯', 'EGG': '卵', 'EGGS': '卵', 'TOFU': '豆腐', 'EDAMAME': '枝豆',
  'AVOCADO': 'アボカド', 'CHEESE': 'チーズ', 'CHESSE': 'チーズ',
  'MAYONNAISE': 'マヨネーズ', 'MUSHROOM': 'きのこ', 'MUSHROOMS': 'きのこ',
  'MUSHROM': 'きのこ', 'ENOKITAKE': 'えのき', 'ASPARAGUS': 'アスパラ',
  'CUCUMBER': 'きゅうり', 'VEGETABLE': '野菜', 'VEGETABLES': '野菜',
  'MANGO': 'マンゴー', 'ORANGE': 'オレンジ', 'PINEAPPLE': 'パイナップル',
  'WATERMELON': 'スイカ', 'LYCHEE': 'ライチ', 'PEACH': '桃', 'LONGAN': '龍眼',
  'LOTUS': '蓮', 'GUAVA': 'グアバ', 'STRAWBERRY': 'いちご',
  'BLUEBERRY': 'ブルーベリー', 'CHOCOLATE': 'チョコレート', 'APPLE': 'りんご',
  'ROSE': 'ローズ', 'LEMONGRASS': 'レモングラス', 'CHRYSANTHEMUM': '菊花',
  'SESAME': 'ごま', 'PERILLA': '大葉', 'SHISO': '紫蘇', 'LEAF': '葉',
  'FRUIT': 'フルーツ', 'WATER': '水', 'ICE': '氷',
  // --- Gia vi, nuoc sot ---
  'MENTAIKO': '明太子', 'TERIYAKI': '照り焼き', 'PONZU': 'ポン酢', 'MISO': '味噌',
  'WASABI': 'わさび', 'YUZU': '柚子', 'MATCHA': '抹茶', 'KIMCHI': 'キムチ',
  'SAUCE': 'ソース', 'SOY': '醤油', 'VINEGAR': '酢', 'SALT': '塩',
  'PEPPER': '胡椒', 'ONSEN': '温泉',
  // --- Cach che bien, tinh tu ---
  'GRILLED': '焼き', 'FRIED': '揚げ', 'STEAMED': '蒸し', 'SEARED': '炙り',
  'ROASTED': '焙煎', 'DRIED': '干し', 'PICKLED': '酢漬け', 'SEASONED': '味付け',
  'WRAPPED': '巻き', 'ASSORTED': '盛り合わせ', 'MIXED': 'ミックス',
  'SPICY': '辛口', 'PREMIUM': 'プレミアム', 'RICH': '濃厚', 'CREAMY': 'クリーム',
  'HOT': '温', 'RED': '赤', 'BLACK': '黒', 'GREEN': '緑', 'GOLDEN': '金',
  'PINK': 'ピンク', 'SILVER': 'シルバー', 'RAINBOWN': 'レインボー',
  'RAINBOW': 'レインボー', 'DRAGON': 'ドラゴン', 'EXTRA': '追加',
  'JAPANESE': '和風', 'CALIFORNIA': 'カリフォルニア', 'HYOGO': '兵庫県産',
  'SEA': '海', 'POT': '鍋', 'STICK': 'スティック', 'BOMP': 'ボンプ',
  // --- Do uong co ten rieng ---
  'SAKE': '日本酒', 'JUNMAI': '純米', 'TARUSAKE': '樽酒', 'MASUMI': '真澄',
  'HOKKAN': '北関', 'OBAACHAN': 'おばあちゃん', 'OOLONG': 'ウーロン',
  'LATTE': 'ラテ', 'COLA': 'コーラ', 'SPRITE': 'スプライト', 'STING': 'スティング',
  'SAPPORO': 'サッポロ', 'TIGER': 'タイガー', 'HEIEKEN': 'ハイネケン',
  'ZERO': 'ゼロ', 'COCA': 'コカ',
};

const TU_CUM = Object.keys(CUM_NHAT).sort((a, b) => b.length - a.length);

/**
 * Doi ten tieng Anh sang tieng Nhat.
 *
 * Tra ve null khi khong du tin cay - khi do man hinh chi hien ten tieng Anh.
 * Nguong: qua MOT PHAN BA so tu con la Latin thi coi nhu that bai. Nguong nay
 * de mot ten rieng lot qua nhung chan duoc nhung chuoi nua noi nua kia.
 */
function tenTiengNhat(tenAnh) {
  if (!tenAnh) return null;
  /*
    Bo dau phu truoc khi tra bang.

    Thuc don co 'CRÈME BRULEE' voi dau huyen tren chu E. Khoa trong bang la
    'CREME BRULEE' khong dau, nen khong bo dau thi mon nay khong bao gio khop -
    va no la mon DUY NHAT truot khoi bang sau khi da phu het tu vung.
  */
  let s = tenAnh.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  // 1. Cum tu truoc, boc trong dau danh dau de buoc tach tu khong xe le no ra.
  for (const cum of TU_CUM) {
    const mau = new RegExp('(^|[\\s(/-])' + cum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[\\s)/-])', 'g');
    s = s.replace(mau, (_, a, b) => a + DAU + CUM_NHAT[cum] + DAU + b);
  }

  // 2. Tach thanh tu, thay tung tu.
  const phan = s.split(/[\s(),/]+/).filter(Boolean);
  const ra = [];
  let soLatinConLai = 0;
  let soCoNghia = 0;

  for (const w of phan) {
    // Da la ban dich cum tu - lay ra nguyen ven, khong tra tiep.
    if (w.includes(DAU)) {
      w.split(DAU).filter(Boolean).forEach((x) => { ra.push(x); soCoNghia += 1; });
      continue;
    }
    const sach = w.replace(/^[-.]+|[-.]+$/g, '');
    if (!sach) continue;
    if (BO_QUA.has(sach)) continue;
    soCoNghia += 1;
    if (NHAT[sach]) { ra.push(NHAT[sach]); continue; }
    // Khong tra duoc: giu lai nhung ve dang Hoa dau tu, khong VIET HOA HET.
    ra.push(sach.charAt(0) + sach.slice(1).toLowerCase());
    soLatinConLai += 1;
  }

  if (!ra.length || !soCoNghia) return null;
  if (soLatinConLai / soCoNghia > 1 / 3) return null;

  /*
    Ghep lai: tieng Nhat khong dung dau cach giua cac tu. Chi chen dau cach khi
    mot trong hai ben la chu Latin, neu khong ten mon se bi tach roi ra trong
    khi le ra phai lien mot mach.
  */
  const laLatin = (x) => /[A-Za-z0-9]/.test(x);
  let kq = ra[0];
  for (let i = 1; i < ra.length; i++) {
    if (laLatin(ra[i - 1].slice(-1)) || laLatin(ra[i].charAt(0))) kq += ' ';
    kq += ra[i];
  }
  return kq.trim();
}

/**
 * Ten mon theo ngon ngu, kem ten phu de doi chieu.
 *
 * Tra ve { chinh, phu }. `phu` co the null. Man hinh hien `chinh` co lon va
 * `phu` co nho ben duoi - dung cach thuc don song ngu that van in.
 */
function tenMon(mon, ngonNgu) {
  const nn = chuanHoa(ngonNgu) || MAC_DINH;
  const viTen = String((mon && mon.name_mon) || '').trim();
  const anh = tenTiengAnh(mon && mon.ghichu_mon);

  if (nn === 'vi') return { chinh: viTen, phu: anh };
  if (nn === 'en') return { chinh: anh || viTen, phu: anh ? viTen : null };

  const nhat = tenTiengNhat(anh);
  // Tieng Nhat: uu tien ban co thuat ngu Nhat, phu la tieng Anh de doi chieu.
  return { chinh: nhat || anh || viTen, phu: anh && nhat ? anh : (anh ? viTen : null) };
}

/**
 * Nhan cho "dip dat ban" va so khach.
 *
 * Gia tri LUU trong CSDL la tieng Viet ('Sinh nhật', 'Hẹn hò'...) va phai giu
 * nguyen the: nhan vien doc bang dat ban bang tieng Viet, va doi gia tri luu
 * se lam hong moi don cu. Chi doi NHAN luc hien cho khach.
 *
 * Khong tra duoc thi tra ve chinh chuoi goc - dip do la do nhan vien tu go, va
 * mot chuoi tieng Viet con hon mot o trong.
 */
function nhanDip(giaTri, ngonNgu) {
  const goc = String(giaTri || '').trim();
  if (!goc) return '';
  const khoa = 'dip.' + goc.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const dich = t(khoa, ngonNgu);
  return dich === khoa ? goc : dich;
}

/** '4' -> '4 người' / '4 guests' / '4名様'. Nhan lay tu khoa `chung.nguoi`. */
function nhanSoKhach(so, ngonNgu) {
  const s = String(so || '').trim();
  if (!s) return '';
  return s + ' ' + t('chung.nguoi', ngonNgu);
}

/**
 * Ten nhom mon. Du lieu goc da la tieng Anh ('05. SASHIMI') nen tieng Anh
 * khong phai lam gi; tieng Viet va tieng Nhat tra bang `locales`.
 */
function tenNhom(loai, ngonNgu) {
  const nn = chuanHoa(ngonNgu) || MAC_DINH;
  const goc = String((loai && loai.name_loai) || '').trim();
  // Bo so thu tu dau ('05. SASHIMI' -> 'SASHIMI') de lam khoa tra cuu.
  const nhan = goc.replace(/^\d+\s*[.)-]\s*/, '').trim();
  if (nn === 'en') return goc;
  const dich = t('nhom_mon.' + nhan.toLowerCase().replace(/[^a-z0-9]+/g, '_'), nn);
  return dich.startsWith('nhom_mon.') ? goc : goc.replace(nhan, dich);
}

module.exports = {
  DS_NGON_NGU, MAC_DINH, chuanHoa, doanTuTrinhDuyet, t,
  tenMon, tenNhom, tenTiengAnh, tenTiengNhat, nhanDip, nhanSoKhach,
};

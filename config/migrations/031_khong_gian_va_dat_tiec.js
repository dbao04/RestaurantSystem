/**
 * Migration 031 - KHONG GIAN NHA HANG + SANH GALA + DAT TIEC.
 *
 * Chay: node config/migrations/031_khong_gian_va_dat_tiec.js
 *       (hoac `npm run tiec:setup`)
 *
 * Idempotent: chay lai nhieu lan khong nhan doi du lieu. Phai chay SAU 030.
 *
 * 1. Them cot gioi thieu cho `vitri`: mo ta dai, thu vien anh, tien ich, suc
 *    chua khi to chuc tiec. Trang /khong-gian doc thang cac cot nay.
 * 2. Them khu "Sanh Gala" + 30 ban tron 10 khach (G01..G30). Sanh Gala KHONG
 *    nhan dat ban le (cho_dat_truoc = 0): no chi duoc dat qua luong /dat-tiec,
 *    de mot nhom 4 nguoi khong chiem mat mot ban giua sanh tiec cuoi.
 * 3. Tao bang thuc don tiec, dich vu tiec, don dat tiec va nap du lieu mau.
 */
const db = require('../db');

async function coBang(ten) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [ten]);
  return rows.length > 0;
}

async function coCot(bang, cot) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [bang, cot]);
  return rows.length > 0;
}

async function themCot(bang, cot, dinhNghia) {
  if (!(await coCot(bang, cot))) {
    await db.query(`ALTER TABLE \`${bang}\` ADD COLUMN \`${cot}\` ${dinhNghia}`);
  }
}

const anh = (...ds) => JSON.stringify(ds.map((t) => `/images/khong-gian/${t}.jpg`));

/** Noi dung gioi thieu tung khu. Khop theo ten de khong phu thuoc id. */
const GIOI_THIEU = [
  {
    mau: '%Sảnh chính%',
    mo_ta_dai: 'Không gian trung tâm của nhà hàng với trần cao, ánh đèn vàng ấm và quầy sushi mở – nơi thực khách có thể ngắm các đầu bếp Nhật chế biến sashimi ngay trước mắt. Phù hợp cho bữa trưa văn phòng, hẹn hò và nhóm bạn nhỏ.',
    thu_vien: anh('sanh-chinh-1', 'sanh-chinh-2', 'sanh-chinh-3'),
    tien_ich: ['Quầy sushi mở', 'Điều hòa trung tâm', 'Wi-Fi miễn phí', 'Lối đi xe lăn', 'Gần lối ra vào'],
    min: 0, max: 0,
  },
  {
    mau: '%vườn%',
    mo_ta_dai: 'Khu ngoài trời có mái che, bao quanh bởi cây xanh và đèn dây lung linh khi trời tối. Lý tưởng cho những buổi tối mát mẻ, tiệc nướng nhẹ nhàng hoặc khách muốn hút thuốc ở khu vực riêng.',
    thu_vien: anh('san-vuon-1', 'san-vuon-2', 'san-vuon-3'),
    tien_ich: ['Mái che di động', 'Cây xanh & đèn dây', 'Quạt phun sương', 'Khu hút thuốc riêng', 'Phù hợp chụp ảnh'],
    min: 0, max: 0,
  },
  {
    mau: '%Tầng 2%',
    mo_ta_dai: 'Tầng lầu yên tĩnh dành cho gia đình và nhóm đông, bàn rộng từ 4 đến 10 khách có thể ghép linh hoạt. Có thể bao trọn tầng cho tiệc sinh nhật, họp lớp hoặc liên hoan công ty quy mô vừa.',
    thu_vien: anh('tang-2-1', 'tang-2-2', 'tang-2-3'),
    tien_ich: ['Bàn ghép linh hoạt', 'Ghế em bé', 'Bao trọn tầng', 'Loa & micro', 'Thang máy'],
    min: 20, max: 60,
  },
  {
    mau: '%VIP%',
    mo_ta_dai: 'Sáu phòng riêng cách âm theo phong cách Nhật với cửa gỗ shoji và ánh sáng dịu, sức chứa 8–12 khách mỗi phòng. Có nhân viên phục vụ riêng – lựa chọn hàng đầu cho tiếp khách đối tác, kỷ niệm gia đình và tiệc thân mật.',
    thu_vien: anh('vip-1', 'vip-2', 'vip-3'),
    tien_ich: ['Phòng riêng cách âm', 'Phục vụ riêng', 'TV & Karaoke', 'Điều hòa riêng', 'Nút gọi nhân viên'],
    min: 8, max: 12,
  },
];

const GALA = {
  ten: 'Sảnh Gala',
  ghi_chu: 'Sảnh tiệc 50–300 khách, sân khấu & âm thanh ánh sáng',
  mo_ta_dai: 'Sảnh tiệc sang trọng rộng 600m² với đèn chùm pha lê, sân khấu cố định, hệ thống âm thanh – ánh sáng chuyên nghiệp và màn hình LED. Bố trí tối đa 30 bàn tròn 10 khách, phù hợp tiệc cưới, tiệc tất niên công ty, hội nghị khách hàng và sinh nhật quy mô lớn. Chỉ nhận đặt qua mục Đặt tiệc.',
  thu_vien: anh('gala-1', 'gala-2', 'gala-3', 'gala-4'),
  tien_ich: ['Sân khấu & đèn chùm', 'Âm thanh – ánh sáng', 'Màn hình LED', 'Phòng chờ cô dâu', 'Bãi đỗ xe 100 chỗ', 'Lối vào riêng'],
  min: 50, max: 300,
};

// ----------------------------------------------------------- thuc don tiec
// gia = gia MOT BAN 10 KHACH. mon = [{ nhom, ten }].
const m = (nhom, ...ten) => ten.map((t) => ({ nhom, ten: t }));
const THUC_DON = [
  // ---------------- TIEC CUOI
  { loai: 'CUOI', ma: 'CUOI_HANH_PHUC', ten: 'Thực đơn Hạnh Phúc', gia: 4990000, noi_bat: 0, anh: 'tiec-cuoi-1',
    mo_ta: 'Thực đơn cưới 8 món tinh gọn, đậm vị Nhật, phù hợp tiệc cưới ấm cúng.',
    bao_gom: ['Champagne khai tiệc cho bàn cô dâu chú rể', 'Trang trí hoa tươi trên bàn', 'Thiệp bàn in tên khách'],
    mon: [...m('Khai vị', 'Salad hải sản', 'Súp cua và nấm'), ...m('Sashimi & Sushi', 'Sashimi cá hồi & cá cam', 'Cuộn California & cuộn cá hồi phủ xoài'),
      ...m('Món chính', 'Tempura thập cẩm', 'Cá hồi sốt teriyaki', 'Lẩu nấm cá hồi'), ...m('Tráng miệng', 'Panna cotta dâu')] },
  { loai: 'CUOI', ma: 'CUOI_TRAM_NAM', ten: 'Thực đơn Trăm Năm', gia: 6890000, noi_bat: 1, anh: 'tiec-cuoi-2',
    mo_ta: 'Lựa chọn được yêu thích nhất: hải sản cao cấp, bò Aukobe và lẩu Nabe.',
    bao_gom: ['Bánh cưới 3 tầng', 'Champagne & tháp ly khai tiệc', 'Trang trí hoa tươi trên bàn', 'Nước ngọt không giới hạn'],
    mon: [...m('Khai vị', 'Salad cua lột', 'Súp sò điệp và nấm'), ...m('Sashimi & Sushi', 'Sashimi tổng hợp: cá hồi, cá cam, sò điệp, tôm sú', 'Cuộn cầu vồng & cuộn rồng nhân lươn'),
      ...m('Món chính', 'Hàu Hyogo nướng phô mai', 'Bò Aukobe áp chảo', 'Tôm nướng sốt mentaiko', 'Lẩu Nabe hải sản'), ...m('Tráng miệng', 'Kem matcha & panna cotta việt quất')] },
  { loai: 'CUOI', ma: 'CUOI_HOANG_GIA', ten: 'Thực đơn Hoàng Gia', gia: 9990000, noi_bat: 0, anh: 'tiec-cuoi-4',
    mo_ta: 'Thực đơn thượng hạng 11 món với bào ngư, nhum biển và Sashimi Premium.',
    bao_gom: ['Bánh cưới 5 tầng', 'Champagne & tháp ly khai tiệc', 'Sake chúc mừng mỗi bàn', 'Hoa tươi & nến trên bàn', 'Nước ngọt, bia không giới hạn'],
    mon: [...m('Khai vị', 'Trứng hấp trứng cá hồi', 'Salad bò Mỹ & trứng onsen', 'Súp kem cá hồi'),
      ...m('Sashimi & Sushi', 'Sashimi Set H Premium', 'Combo sushi Premium Tataki', 'Hàu Hyogo sashimi', 'Bào ngư hấp sốt nhum biển'),
      ...m('Món chính', 'Bò Aukobe steak', 'Mai cua nướng', 'Lẩu Sukiyaki bò'), ...m('Tráng miệng', 'Tiramisu & kem yuzu')] },

  // ---------------- SINH NHAT
  { loai: 'SINH_NHAT', ma: 'SN_VUI_VE', ten: 'Thực đơn Vui Vẻ', gia: 2990000, noi_bat: 0, anh: 'sinh-nhat-2',
    mo_ta: 'Các món dễ ăn, hợp cả người lớn và trẻ em – lý tưởng cho sinh nhật bé.',
    bao_gom: ['Bánh kem sinh nhật 20cm', 'Bóng bay trang trí bàn'],
    mon: [...m('Khai vị', 'Khoai tây lắc phô mai', 'Gà chiên Karaage'), ...m('Sushi', 'Maki cá hồi & cuộn California'),
      ...m('Món chính', 'Tempura tôm', 'Cơm chiên hải sản', 'Udon xào hải sản'), ...m('Tráng miệng', 'Kem socola')] },
  { loai: 'SINH_NHAT', ma: 'SN_RANG_RO', ten: 'Thực đơn Rạng Rỡ', gia: 3990000, noi_bat: 1, anh: 'sinh-nhat-1',
    mo_ta: 'Sinh nhật người lớn với sashimi tươi, món nướng và lẩu kim chi.',
    bao_gom: ['Bánh kem sinh nhật 24cm', 'Backdrop "Happy Birthday"', 'Bóng bay trang trí bàn', 'Nhạc chúc mừng & nến'],
    mon: [...m('Khai vị', 'Salad bơ', 'Gunkan cá hồi & trứng cá hồi'), ...m('Sashimi & Sushi', 'Sashimi cá hồi', 'Cuộn tôm chiên xù'),
      ...m('Món chính', 'Gà và phô mai đút lò', 'Tôm nướng sốt miso', 'Lẩu kim chi hải sản'), ...m('Tráng miệng', 'Panna cotta việt quất')] },
  { loai: 'SINH_NHAT', ma: 'SN_BE_YEU', ten: 'Thực đơn Thôi Nôi – Đầy Tháng', gia: 3490000, noi_bat: 0, anh: 'sinh-nhat-3',
    mo_ta: 'Thực đơn thanh đạm, ít cay, đủ chất cho tiệc thôi nôi, đầy tháng của bé.',
    bao_gom: ['Bánh kem thôi nôi', 'Mâm cúng & bàn bốc đồ chơi', 'Trang trí tông màu theo bé trai/bé gái'],
    mon: [...m('Khai vị', 'Trứng hấp', 'Súp trứng'), ...m('Sushi', 'Cuộn California', 'Cơm cá hồi và bơ'),
      ...m('Món chính', 'Cá hồi nướng muối', 'Tempura rau củ', 'Lẩu nấm cá cam'), ...m('Tráng miệng', 'Kem matcha')] },

  // ---------------- PARTY / CONG TY
  { loai: 'PARTY', ma: 'PARTY_YEAR_END', ten: 'Year End Party', gia: 4490000, noi_bat: 1, anh: 'party-1',
    mo_ta: 'Tiệc tất niên công ty: món nhậu kiểu Izakaya, lẩu hải sản và bia Nhật.',
    bao_gom: ['1 thùng bia Sapporo mỗi bàn', 'Backdrop sự kiện in logo công ty', 'Micro & loa cho phần phát biểu'],
    mon: [...m('Khai vị', 'Đậu nành lông', 'Salad hải sản'), ...m('Sashimi & Sushi', 'Sashimi cá hồi & cá trích ép trứng', 'Combo sushi Set 3'),
      ...m('Món chính', 'Mực chiên xù', 'Bò sizzling sốt tiêu đen', 'Lẩu Nabe hải sản'), ...m('Tráng miệng', 'Kem yuzu')] },
  { loai: 'PARTY', ma: 'PARTY_IZAKAYA', ten: 'Teambuilding Izakaya', gia: 3290000, noi_bat: 0, anh: 'party-3',
    mo_ta: 'Phong cách quán nhậu Nhật, món nướng ăn chơi – hợp liên hoan, họp lớp.',
    bao_gom: ['6 lon bia Tiger mỗi bàn', 'Trò chơi teambuilding do MC dẫn (từ 5 bàn)'],
    mon: [...m('Khai vị', 'Kim chi', 'Khoai tây lắc sốt miso', 'Gà chiên Karaage'), ...m('Món nướng', 'Cá saba nướng muối', 'Sò điệp nướng phô mai'),
      ...m('Món chính', 'Cuộn tôm phô mai', 'Udon xào bò Mỹ', 'Bánh xèo Nhật')] },
  { loai: 'PARTY', ma: 'PARTY_COCKTAIL', ten: 'Tiệc đứng Cocktail', gia: 3990000, noi_bat: 0, anh: 'party-4',
    mo_ta: 'Tiệc đứng finger food sang trọng cho khai trương, ra mắt sản phẩm, gặp mặt đối tác.',
    bao_gom: ['Quầy Mojito việt quất & Mojito chanh', 'Bàn cocktail đứng phủ khăn', 'Nhân viên phục vụ khay'],
    mon: [...m('Finger food', 'Nigiri tổng hợp', 'Gunkan cá hồi sò điệp mayo', 'Temaki tôm tempura', 'Hàu nướng phô mai', 'Sò điệp nướng sốt mentaiko', 'Tempura tôm'),
      ...m('Tráng miệng', 'Panna cotta mini 3 vị')] },

  // ---------------- HOP MAT GIA DINH
  { loai: 'GIA_DINH', ma: 'GD_SUM_VAY', ten: 'Thực đơn Sum Vầy', gia: 2790000, noi_bat: 0, anh: 'gia-dinh-1',
    mo_ta: 'Bữa cơm Nhật ấm cúng cho buổi họp mặt, giỗ chạp, tất niên gia đình.',
    bao_gom: ['Trà xanh Nhật không giới hạn', 'Phòng riêng (khi đặt Phòng VIP)'],
    mon: [...m('Khai vị', 'Rong biển trộn dầu mè', 'Súp miso'), ...m('Món chính', 'Cuộn cá hồi nướng', 'Cá hồi nướng muối', 'Trứng cuộn', 'Lẩu Sukiyaki', 'Cơm trắng'),
      ...m('Tráng miệng', 'Kem matcha')] },
  { loai: 'GIA_DINH', ma: 'GD_DOAN_VIEN', ten: 'Thực đơn Đoàn Viên', gia: 3790000, noi_bat: 1, anh: 'tang-2-3',
    mo_ta: 'Đủ đầy sashimi, món nướng và lẩu cá mú – món ngon cho cả ba thế hệ.',
    bao_gom: ['Trà xanh Nhật không giới hạn', 'Hoa tươi trên bàn', 'Ảnh gia đình in tặng'],
    mon: [...m('Khai vị', 'Salad cá trích ép trứng', 'Súp gân bò'), ...m('Sashimi & Sushi', 'Sashimi Set B', 'Cuộn cầu vồng'),
      ...m('Món chính', 'Đầu cá hồi nướng teriyaki', 'Bò cuộn nấm kim châm', 'Lẩu nấm cá mú'), ...m('Tráng miệng', 'Panna cotta chanh dây')] },
  { loai: 'GIA_DINH', ma: 'GD_KY_NIEM', ten: 'Thực đơn Kỷ Niệm Vàng', gia: 5490000, noi_bat: 0, anh: 'vip-2',
    mo_ta: 'Dành cho mừng thọ, kỷ niệm ngày cưới – hải sản Nhật cao cấp và bò Aukobe.',
    bao_gom: ['Bánh kem chúc mừng', 'Hoa & nến trên bàn', 'Sake chúc mừng', 'Phòng riêng (khi đặt Phòng VIP)'],
    mon: [...m('Khai vị', 'Hàu Hyogo nướng sốt mentaiko', 'Súp Dobin'), ...m('Sashimi & Sushi', 'Sashimi Set E', 'Combo sushi Set 4'),
      ...m('Món chính', 'Bò Aukobe áp chảo', 'Lươn Nhật nướng', 'Lẩu Nabe hải sản'), ...m('Tráng miệng', 'Bánh kem cháy & tiramisu')] },
];

// don_vi: GOI = tinh 1 lan / tiec; BAN = theo so ban; KHACH = theo so khach
const DICH_VU = [
  { ma: 'TRANG_TRI_CONG_HOA', ten: 'Cổng hoa & backdrop chủ đề', gia: 3500000, don_vi: 'GOI', icon: 'fa-spa', mo_ta: 'Cổng hoa tươi, backdrop in tên và bàn gallery ảnh.' },
  { ma: 'MC', ten: 'MC chuyên nghiệp', gia: 2500000, don_vi: 'GOI', icon: 'fa-microphone', mo_ta: 'MC dẫn chương trình suốt buổi tiệc, có kịch bản riêng.' },
  { ma: 'BAN_NHAC', ten: 'Ban nhạc acoustic', gia: 4000000, don_vi: 'GOI', icon: 'fa-guitar', mo_ta: 'Ca sĩ + guitar + violin biểu diễn 90 phút.' },
  { ma: 'AM_THANH', ten: 'Âm thanh & ánh sáng sân khấu', gia: 3000000, don_vi: 'GOI', icon: 'fa-lightbulb', mo_ta: 'Đèn moving head, khói lạnh, pháo kim tuyến khai tiệc.' },
  { ma: 'LED', ten: 'Màn hình LED / máy chiếu', gia: 2000000, don_vi: 'GOI', icon: 'fa-tv', mo_ta: 'Trình chiếu ảnh, video, slide chương trình.' },
  { ma: 'CHUP_ANH', ten: 'Chụp ảnh & quay phim', gia: 5000000, don_vi: 'GOI', icon: 'fa-camera', mo_ta: '2 thợ chụp + 1 quay, trả file trong 7 ngày.' },
  { ma: 'BANH_KEM', ten: 'Bánh kem thiết kế riêng', gia: 800000, don_vi: 'GOI', icon: 'fa-birthday-cake', mo_ta: 'Bánh kem 2 tầng theo mẫu khách chọn.' },
  { ma: 'BONG_BAY', ten: 'Trang trí bong bay chủ đề', gia: 1500000, don_vi: 'GOI', icon: 'fa-gift', mo_ta: 'Cổng bong bay, chùm bóng bàn và chữ tên.' },
  { ma: 'LE_TAN', ten: 'Lễ tân đón khách', gia: 1200000, don_vi: 'GOI', icon: 'fa-user-tie', mo_ta: '2 lễ tân mặc áo dài / kimono đón khách & nhận quà.' },
  { ma: 'SAKE', ten: 'Sake chúc mừng', gia: 450000, don_vi: 'BAN', icon: 'fa-wine-bottle', mo_ta: '1 chai Hokkan Sake 300ml mỗi bàn.' },
  { ma: 'DO_UONG', ten: 'Nước ngọt & bia không giới hạn', gia: 60000, don_vi: 'KHACH', icon: 'fa-beer', mo_ta: 'Coca, Sprite, bia Tiger/Sapporo phục vụ suốt tiệc.' },
];

async function main() {
  console.log('Migration 031 - không gian nhà hàng & đặt tiệc');

  // 1. Cot gioi thieu cho vitri
  console.log('  · thêm cột giới thiệu cho vitri');
  await themCot('vitri', 'mo_ta_dai', 'TEXT NULL');
  await themCot('vitri', 'thu_vien_anh', 'TEXT NULL');
  await themCot('vitri', 'tien_ich', 'TEXT NULL');
  await themCot('vitri', 'la_sanh_tiec', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('vitri', 'tiec_toi_thieu', 'INT NOT NULL DEFAULT 0');
  await themCot('vitri', 'tiec_toi_da', 'INT NOT NULL DEFAULT 0');

  for (const g of GIOI_THIEU) {
    await db.query(
      `UPDATE vitri SET mo_ta_dai = ?, thu_vien_anh = ?, tien_ich = ?, tiec_toi_thieu = ?, tiec_toi_da = ?
        WHERE Name_vitri LIKE ?`,
      [g.mo_ta_dai, g.thu_vien, JSON.stringify(g.tien_ich), g.min, g.max, g.mau]);
  }

  // 2. Sanh Gala + 30 ban tron
  console.log('  · tạo Sảnh Gala');
  let [[gala]] = await db.query('SELECT id_vitri FROM vitri WHERE Name_vitri = ?', [GALA.ten]);
  if (!gala) {
    const [[{ thuTu }]] = await db.query('SELECT COALESCE(MAX(thu_tu), 0) + 1 AS thuTu FROM vitri');
    const [kq] = await db.query(
      `INSERT INTO vitri (Name_vitri, thu_tu, Ghichu, image, cho_dat_truoc, la_vip, ngoai_troi, mau_sac)
       VALUES (?, ?, ?, ?, 0, 0, 0, '#9b2c3a')`,
      [GALA.ten, thuTu, GALA.ghi_chu, '/images/khong-gian/gala-1.jpg']);
    gala = { id_vitri: kq.insertId };
  }
  await db.query(
    `UPDATE vitri SET mo_ta_dai = ?, thu_vien_anh = ?, tien_ich = ?, la_sanh_tiec = 1, cho_dat_truoc = 0,
                      tiec_toi_thieu = ?, tiec_toi_da = ? WHERE id_vitri = ?`,
    [GALA.mo_ta_dai, GALA.thu_vien, JSON.stringify(GALA.tien_ich), GALA.min, GALA.max, gala.id_vitri]);

  const [[{ soBan }]] = await db.query('SELECT COUNT(*) AS soBan FROM ban WHERE id_vitri = ?', [gala.id_vitri]);
  if (Number(soBan) === 0) {
    const dong = [];
    for (let i = 0; i < 30; i++) {
      const cot = i % 6, hang = Math.floor(i / 6);
      dong.push([gala.id_vitri, 'G' + String(i + 1).padStart(2, '0'), 'Bàn tròn sảnh Gala', 0, 10,
        20 + cot * 165, 20 + hang * 128, 0, 0, `KV${gala.id_vitri}`]);
    }
    await db.query(
      `INSERT INTO ban (id_vitri, number_ban, ghichu, trangthai, so_cho, toa_do_x, toa_do_y, cho_dat_truoc, co_the_ghep, nhom_ghep)
       VALUES ?`, [dong]);
  }

  // 3. Bang dat tiec
  console.log('  · tạo bảng thực đơn / dịch vụ / đơn đặt tiệc');
  if (!(await coBang('thuc_don_tiec'))) {
    await db.query(`
      CREATE TABLE thuc_don_tiec (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma VARCHAR(40) NOT NULL UNIQUE,
        loai_tiec VARCHAR(20) NOT NULL,
        ten VARCHAR(120) NOT NULL,
        gia_ban DECIMAL(12,2) NOT NULL COMMENT 'Gia 1 ban 10 khach',
        mo_ta VARCHAR(400) NULL,
        mon LONGTEXT NOT NULL COMMENT 'JSON [{nhom, ten}]',
        bao_gom LONGTEXT NULL COMMENT 'JSON [chuoi] - uu dai kem goi',
        hinh_anh VARCHAR(255) NULL,
        noi_bat TINYINT(1) NOT NULL DEFAULT 0,
        thu_tu INT NOT NULL DEFAULT 0,
        trang_thai TINYINT(1) NOT NULL DEFAULT 1,
        KEY idx_loai (loai_tiec, trang_thai)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  if (!(await coBang('dich_vu_tiec'))) {
    await db.query(`
      CREATE TABLE dich_vu_tiec (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma VARCHAR(40) NOT NULL UNIQUE,
        ten VARCHAR(120) NOT NULL,
        gia DECIMAL(12,2) NOT NULL,
        don_vi ENUM('GOI','BAN','KHACH') NOT NULL DEFAULT 'GOI',
        icon VARCHAR(40) NULL,
        mo_ta VARCHAR(300) NULL,
        thu_tu INT NOT NULL DEFAULT 0,
        trang_thai TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  if (!(await coBang('dat_tiec'))) {
    await db.query(`
      CREATE TABLE dat_tiec (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma_tiec VARCHAR(20) NOT NULL UNIQUE,
        customer_id INT NULL,
        ho_ten VARCHAR(150) NOT NULL,
        so_dien_thoai VARCHAR(30) NOT NULL,
        email VARCHAR(190) NULL,
        loai_tiec VARCHAR(20) NOT NULL,
        ten_nhan_vat VARCHAR(150) NULL COMMENT 'Co dau chu re / nguoi duoc chuc mung / ten cong ty',
        ngay_to_chuc DATE NOT NULL,
        buoi ENUM('TRUA','TOI') NOT NULL,
        gio_bat_dau TIME NOT NULL,
        so_khach INT NOT NULL,
        so_ban INT NOT NULL,
        khu_vuc_id INT NOT NULL,
        thuc_don_id INT NOT NULL,
        dich_vu LONGTEXT NULL COMMENT 'JSON [{id, ten, don_gia, don_vi, so_luong, thanh_tien}]',
        tien_thuc_don DECIMAL(14,2) NOT NULL DEFAULT 0,
        tien_dich_vu DECIMAL(14,2) NOT NULL DEFAULT 0,
        tong_du_toan DECIMAL(14,2) NOT NULL DEFAULT 0,
        ghi_chu TEXT NULL,
        trang_thai ENUM('MOI','DA_LIEN_HE','DA_XAC_NHAN','DA_COC','HOAN_THANH','HUY') NOT NULL DEFAULT 'MOI',
        ghi_chu_noi_bo TEXT NULL,
        nhan_vien_xu_ly INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_lich (khu_vuc_id, ngay_to_chuc, buoi, trang_thai),
        KEY idx_trang_thai (trang_thai, ngay_to_chuc),
        KEY idx_phone (so_dien_thoai)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  // 4. Du lieu mau (upsert theo ma)
  console.log('  · nạp thực đơn tiệc & dịch vụ');
  let i = 0;
  for (const t of THUC_DON) {
    i++;
    await db.query(
      `INSERT INTO thuc_don_tiec (ma, loai_tiec, ten, gia_ban, mo_ta, mon, bao_gom, hinh_anh, noi_bat, thu_tu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE loai_tiec = VALUES(loai_tiec), ten = VALUES(ten), gia_ban = VALUES(gia_ban),
         mo_ta = VALUES(mo_ta), mon = VALUES(mon), bao_gom = VALUES(bao_gom), hinh_anh = VALUES(hinh_anh),
         noi_bat = VALUES(noi_bat), thu_tu = VALUES(thu_tu)`,
      [t.ma, t.loai, t.ten, t.gia, t.mo_ta, JSON.stringify(t.mon), JSON.stringify(t.bao_gom),
        `/images/khong-gian/${t.anh}.jpg`, t.noi_bat, i]);
  }
  i = 0;
  for (const d of DICH_VU) {
    i++;
    await db.query(
      `INSERT INTO dich_vu_tiec (ma, ten, gia, don_vi, icon, mo_ta, thu_tu) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE ten = VALUES(ten), gia = VALUES(gia), don_vi = VALUES(don_vi),
         icon = VALUES(icon), mo_ta = VALUES(mo_ta), thu_tu = VALUES(thu_tu)`,
      [d.ma, d.ten, d.gia, d.don_vi, d.icon, d.mo_ta, i]);
  }

  console.log('Migration 031 hoàn tất.');
  await db.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration 031 lỗi:', error.message);
    console.error(error.stack);
    process.exitCode = 1;
  });
}

module.exports = { main };

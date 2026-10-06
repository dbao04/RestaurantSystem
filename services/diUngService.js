/*
 * ĐỐI CHIẾU NGUYÊN LIỆU → NHÓM DỊ ỨNG
 *
 * Trang chi tiết món hiện danh sách nguyên liệu để khách tự đối chiếu với dị
 * ứng của mình. Nhưng đọc "Bột tempura, Xì dầu, Dầu mè" mà biết là có lúa mì,
 * đậu nành và mè thì phải là người rành bếp Nhật. Lớp này làm hộ việc đó: gom
 * nguyên liệu của món về các NHÓM DỊ ỨNG phổ biến để cảnh báo ngay trên đầu.
 *
 * VÌ SAO TRA THEO BẢNG TÊN CHỨ KHÔNG ĐOÁN THEO TỪ KHOÁ
 * -----------------------------------------------------
 * Đoán theo từ khoá rất dễ sai theo cả hai chiều, mà cả hai chiều đều tệ:
 *   - "Trứng cá hồi ikura" có chữ "trứng" nhưng KHÔNG phải trứng gia cầm.
 *     Gắn nhầm làm khách dị ứng trứng bỏ qua món họ ăn được.
 *   - "Xì dầu" không có chữ nào gợi ý lúa mì, nhưng nước tương Nhật ủ từ lúa
 *     mì. Bỏ sót kiểu này mới là nguy hiểm thật.
 * Nên bảng `THEO_NGUYEN_LIEU` liệt kê đích danh từng nguyên liệu — 135 nguyên
 * liệu là con số con người duyệt được, và duyệt được thì kiểm chứng được.
 * `TU_KHOA` chỉ là lưới đỡ cho nguyên liệu mới nhập sau này chưa kịp vào bảng.
 *
 * PHẠM VI CÓ CHỦ ĐÍCH
 * -------------------
 * Chỉ gắn nhóm cho nguyên liệu mà thành phần gây dị ứng nằm trong BẢN CHẤT của
 * nó. Những thứ tuỳ nhà cung cấp (kim chi có thể có mắm tôm, hạt nêm có thể có
 * đậu nành) thì không gắn: gắn bừa vài lần là khách hết tin bảng cảnh báo. Chỗ
 * trống đó do câu lưu ý "báo nhân viên nếu bạn có dị ứng" gánh, và câu đó luôn
 * hiện kể cả khi không phát hiện nhóm nào.
 *
 * Hệ quả phải nói thẳng: đây là công cụ THAM KHẢO, không phải bản công bố dị
 * ứng đạt chuẩn. Giao diện vì thế không bao giờ nói "món này không gây dị ứng".
 */

// Thứ tự này là thứ tự hiện ra cho khách: hải sản trước (đặc thù nhà hàng
// Nhật, cũng là nhóm dị ứng nặng nhất), rượu cuối vì không phải dị ứng.
const NHOM = [
  'giap_xac',    // tôm, cua
  'nhuyen_the',  // sò, mực, hàu... và hải sản thân mềm khác
  'ca',          // cá và trứng cá
  'trung',       // trứng gia cầm
  'sua',         // sữa và chế phẩm
  'lua_mi',      // lúa mì / gluten
  'kieu_mach',   // kiều mạch (soba) — nhóm dị ứng nặng ở Nhật
  'dau_nanh',    // đậu nành
  'me',          // mè
  'con',         // đồ uống có cồn (không phải dị ứng, nhưng khách cần biết)
];

const THEO_NGUYEN_LIEU = {
  // --- Giáp xác ---
  'Tôm sú': ['giap_xac'],
  'Tôm thẻ': ['giap_xac'],
  'Cua lột': ['giap_xac'],
  'Cua tuyết': ['giap_xac'],
  'Thịt cua': ['giap_xac'],
  // Surimi là chả cá xay, thường tạo hương cua và có bột mì làm chất kết dính.
  'Thanh cua surimi': ['ca', 'lua_mi'],

  // --- Nhuyễn thể & hải sản thân mềm ---
  'Mực lá': ['nhuyen_the'],
  'Bạch tuộc': ['nhuyen_the'],
  'Sò dương': ['nhuyen_the'],
  'Sò lông': ['nhuyen_the'],
  'Sò điệp': ['nhuyen_the'],
  'Sò đỏ': ['nhuyen_the'],
  'Nghêu': ['nhuyen_the'],
  'Hàu sữa': ['nhuyen_the'],
  'Bào ngư': ['nhuyen_the'],
  'Nhum biển': ['nhuyen_the'],
  'Sứa biển': ['nhuyen_the'],

  // --- Cá và trứng cá ---
  'Cá hồi phi lê': ['ca'],
  'Cá cam Hamachi': ['ca'],
  'Cá ngừ đại dương': ['ca'],
  'Cá saba': ['ca'],
  'Cá sanma': ['ca'],
  'Cá mú': ['ca'],
  'Cá trích ép trứng': ['ca'],
  'Lươn Nhật (unagi)': ['ca'],
  'Trứng cá hồi ikura': ['ca'],
  'Trứng cá tobiko': ['ca'],
  'Sốt mentaiko': ['ca'],
  'Bột dashi': ['ca'],       // dashi nấu từ cá ngừ bào (katsuobushi)
  'Nước mắm': ['ca'],

  // --- Trứng gia cầm ---
  'Trứng gà': ['trung'],
  'Sốt mayonnaise Nhật': ['trung'],

  // --- Sữa và chế phẩm ---
  'Phô mai lát': ['sua'],
  'Kem tươi': ['sua'],
  'Sữa đặc': ['sua'],
  'Bột panna cotta': ['sua'],
  'Bánh quy tiramisu': ['sua', 'trung', 'lua_mi'],

  // --- Lúa mì ---
  'Bột tempura': ['lua_mi'],
  'Bột chiên xù panko': ['lua_mi'],
  'Mì ramen tươi': ['lua_mi'],
  'Mì udon tươi': ['lua_mi'],
  // Soba bán sẵn hầu như luôn pha bột mì để sợi không gãy.
  'Mì soba': ['kieu_mach', 'lua_mi'],

  // --- Đậu nành (và lúa mì đi kèm trong đồ ủ tương) ---
  'Nước tương Nhật': ['dau_nanh', 'lua_mi'],
  'Xì dầu': ['dau_nanh', 'lua_mi'],
  'Tương miso': ['dau_nanh', 'lua_mi'],
  'Sốt teriyaki': ['dau_nanh', 'lua_mi'],
  'Đậu hủ': ['dau_nanh'],
  'Đậu nành lông': ['dau_nanh'],

  // --- Mè ---
  'Dầu mè': ['me'],

  // --- Cồn ---
  'Rượu sake chai': ['con'],
  'Rượu sake nấu ăn': ['con'],
  'Mirin': ['con'],
  'Bia Nhật lon': ['con', 'lua_mi'],
  'Bia Tiger': ['con', 'lua_mi'],
};

/*
 * Lưới đỡ cho nguyên liệu nhập sau này chưa kịp vào bảng trên.
 *
 * So khớp theo TỪ trọn vẹn chứ không phải chuỗi con: "cua" không được khớp vào
 * "củ cải", "me" không được khớp vào "mềm". Cặp nào dễ nhận nhầm thì thà bỏ
 * sót ở đây, vì bảng đích danh mới là nguồn chính.
 */
const TU_KHOA = [
  [['tom', 'cua', 'ghe'], ['giap_xac']],
  [['so', 'muc', 'hau', 'ngheu', 'oc', 'bach tuoc', 'bao ngu'], ['nhuyen_the']],
  [['ca hoi', 'ca ngu', 'ca saba', 'ca thu', 'ca trich', 'ca mu', 'ca com', 'luon', 'dashi'], ['ca']],
  [['trung ga', 'trung cut', 'mayonnaise'], ['trung']],
  [['sua', 'pho mai', 'bo lat', 'kem tuoi', 'yogurt', 'sua chua'], ['sua']],
  [['bot mi', 'mi tuoi', 'banh mi', 'panko', 'tempura', 'ramen', 'udon'], ['lua_mi']],
  [['soba', 'kieu mach'], ['kieu_mach']],
  [['dau nanh', 'nuoc tuong', 'xi dau', 'miso', 'tuong', 'dau hu', 'tofu'], ['dau_nanh']],
  [['me', 'vung'], ['me']],
  [['dau phong', 'hanh nhan', 'hat dieu', 'oc cho', 'hat de', 'macca'], ['dau_phong']],
  [['ruou', 'sake', 'bia', 'mirin', 'vang'], ['con']],
];

function chuanHoa(chuoi) {
  return String(chuoi || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Bảng tra đã chuẩn hoá sẵn, dựng một lần lúc nạp module.
const BANG = new Map(
  Object.entries(THEO_NGUYEN_LIEU).map(([ten, nhom]) => [chuanHoa(ten), nhom])
);

function coTu(cauDaChuanHoa, tu) {
  return ` ${cauDaChuanHoa} `.includes(` ${tu} `);
}

/** Các nhóm dị ứng của MỘT nguyên liệu. Không nhận ra thì trả về mảng rỗng. */
function nhomCua(tenNguyenLieu) {
  const khoa = chuanHoa(tenNguyenLieu);
  if (!khoa) return [];
  if (BANG.has(khoa)) return BANG.get(khoa);

  const ra = new Set();
  for (const [dsTu, dsNhom] of TU_KHOA) {
    if (dsTu.some((tu) => coTu(khoa, tu))) dsNhom.forEach((n) => ra.add(n));
  }
  return [...ra];
}

/**
 * Gom danh sách nguyên liệu của một món về các nhóm dị ứng.
 *
 * @param {string[]} dsNguyenLieu tên nguyên liệu như lưu trong CSDL
 * @returns {{nhom: {khoa: string, nguyen_lieu: string[]}[], co_canh_bao: boolean}}
 *          `nhom` đã sắp theo thứ tự hiển thị cố định, kèm chính những nguyên
 *          liệu đã đẩy món vào nhóm đó — để khách thấy vì sao bị cảnh báo.
 */
function phanTich(dsNguyenLieu) {
  const gom = new Map();
  for (const ten of dsNguyenLieu || []) {
    for (const khoa of nhomCua(ten)) {
      if (!gom.has(khoa)) gom.set(khoa, []);
      if (!gom.get(khoa).includes(ten)) gom.get(khoa).push(ten);
    }
  }

  // Nhóm lạ (từ khoá trả về nhãn chưa có trong NHOM, ví dụ dau_phong) vẫn phải
  // hiện — xếp sau các nhóm đã biết thứ tự.
  const thuTu = [...NHOM, ...[...gom.keys()].filter((k) => !NHOM.includes(k))];
  const nhom = thuTu
    .filter((khoa) => gom.has(khoa))
    .map((khoa) => ({ khoa, nguyen_lieu: gom.get(khoa) }));

  return { nhom, co_canh_bao: nhom.length > 0 };
}

module.exports = { NHOM, phanTich, nhomCua, chuanHoa };

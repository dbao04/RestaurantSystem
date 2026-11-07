/**
 * LUU Y CHI TIET KHI DUNG MON - bo sung cho services/diUngService.js.
 *
 * diUngService tra loi "mon co NHOM DI UNG nao". Lop nay tra loi tiep hai cau:
 *
 *   1. Moi nhom di ung do NGHIA LA GI voi khach (trieu chung, thanh phan an,
 *      co the nho bep bo khong) -> MO_TA_DI_UNG.
 *   2. Mon co dieu gi KHO AN / CAN CAN NHAC du khong phai di ung: do song, cay,
 *      con xuong, con vo, trung chua chin, rat nong, kho nhai, nhieu purin,
 *      caffeine, con -> luuY().
 *
 * Suy tu TEN MON + DANH MUC + NGUYEN LIEU (bang cong_thuc). Nguyen tac giong
 * diUngService: chi gan khi chac chan theo ban chat mon; cho nao khong chac
 * thi de cau "bao nhan vien" ganh. Day la thong tin tham khao, khong thay the
 * tu van y te.
 */
const { chuanHoa } = require('./diUngService');

const MO_TA_DI_UNG = {
  giap_xac: 'Tôm, cua là nhóm gây dị ứng thực phẩm phổ biến và có thể nặng: nổi mề đay, sưng môi, khó thở, thậm chí sốc phản vệ. Nấu chín KHÔNG làm mất chất gây dị ứng. Người dị ứng giáp xác thường cũng nhạy cảm với nhuyễn thể.',
  nhuyen_the: 'Sò, mực, bạch tuộc, hàu, bào ngư… có thể gây phản ứng dù chỉ ăn lượng nhỏ. Hàu, sò ăn sống còn có nguy cơ nhiễm khuẩn với người có bệnh gan hoặc sức đề kháng yếu.',
  ca: 'Có cá hoặc trứng cá (ikura, tobiko, mentaiko). Lưu ý nước dùng dashi nấu từ cá ngừ bào — thành phần cá có thể "ẩn" trong súp, nước sốt mà mắt thường không thấy.',
  trung: 'Có trứng gà trong món, bột áo hoặc sốt mayonnaise Nhật. Trứng cá (ikura, tobiko) KHÔNG thuộc nhóm này.',
  sua: 'Có phô mai, kem tươi hoặc sữa. Người không dung nạp lactose có thể bị đầy bụng; người dị ứng đạm sữa bò cần tránh hoàn toàn.',
  lua_mi: 'Có gluten từ bột chiên tempura/panko, mì udon/ramen hoặc nước tương, miso, sốt teriyaki (ủ từ lúa mì). Người bị celiac / ăn kiêng gluten có thể hỏi nhân viên về nước tương không gluten (tamari).',
  kieu_mach: 'Kiều mạch (soba) có thể gây dị ứng rất nặng ở người nhạy cảm, kể cả qua nước luộc mì dùng chung.',
  dau_nanh: 'Có đậu nành trong nước tương, miso, đậu hủ, đậu nành lông hoặc sốt teriyaki.',
  me: 'Có dầu mè hoặc mè rang. Mè rắc trang trí có thể nhờ bếp bỏ ra, nhưng dầu mè trong sốt thì không tách được.',
  dau_phong: 'Có đậu phộng hoặc hạt cây — dị ứng nhóm này có thể rất nặng, vui lòng báo nhân viên trước khi gọi.',
  con: 'Có rượu sake / mirin dùng để nấu. Phần lớn cồn bay hơi khi nấu nhưng vẫn có thể còn lượng nhỏ — lưu ý với trẻ em, phụ nữ mang thai, người lái xe hoặc kiêng rượu.',
};

const coNL = (dsNL, ...ten) => dsNL.some((x) => ten.some((t) => chuanHoa(x) === chuanHoa(t)));
const coTen = (ten, re) => re.test(ten);

/**
 * @param {{name_mon: string, name_loai?: string}} mon
 * @param {string[]} dsNL ten nguyen lieu
 * @param {{nhom: {khoa: string}[]}} diUng ket qua diUngService.phanTich
 * @returns {{khoa, icon, muc, tieu_de, noi_dung, doi_tuong: string[], dieu_chinh: string|null}[]}
 */
function luuY(mon, dsNL = [], diUng = { nhom: [] }) {
  const ten = String(mon.name_mon || '').toUpperCase();
  const loai = String(mon.name_loai || '').toUpperCase();
  const nhom = new Set((diUng.nhom || []).map((n) => n.khoa));
  const ra = [];
  const them = (x) => ra.push({ dieu_chinh: null, doi_tuong: [], muc: 'chu_y', ...x });

  // 1. HAI SAN SONG ---------------------------------------------------------
  const daNau = /NƯỚNG|CHIÊN|TEMPURA|LƯƠN|HẤP|ÁP CHẢO|TRỨNG CUỘN|XÀO|SÚP|LẨU|TERIYAKI|TEPPAN|CƠM CHIÊN/;
  const haiSanSong = coNL(dsNL, 'Cá hồi phi lê', 'Cá ngừ đại dương', 'Cá cam Hamachi', 'Cá mú', 'Sò điệp', 'Sò đỏ', 'Sò lông',
    'Sò dương', 'Hàu sữa', 'Nhum biển', 'Trứng cá hồi ikura', 'Trứng cá tobiko', 'Cá trích ép trứng', 'Bạch tuộc', 'Mực lá');
  const laSong = /SASHIMI/.test(loai) || coTen(ten, /SASHIMI|TARTARE|CARPACCIO|CHIRASHI/) ||
    (/GUNKAN|NIGIRI|TEMAKI|MAKI|ROLL|SUSHI/.test(loai) && haiSanSong && !daNau.test(ten));
  if (laSong) {
    them({
      khoa: 'song', icon: 'fa-fish', muc: 'quan_trong', tieu_de: 'Có hải sản ăn sống',
      noi_dung: 'Cá và hải sản dùng sống được nhập theo chuẩn sashimi, bảo quản lạnh liên tục. Nên dùng trong vòng 30 phút sau khi phục vụ — đặc biệt khi đặt giao tận nơi, không để ngoài nhiệt độ phòng.',
      doi_tuong: ['Phụ nữ mang thai', 'Trẻ dưới 5 tuổi', 'Người cao tuổi', 'Người bệnh gan / suy giảm miễn dịch'],
      dieu_chinh: 'Có thể yêu cầu khò lửa (aburi) để chín bề mặt.',
    });
  }

  // 2. CAY ---------------------------------------------------------------------
  const wasabi = coNL(dsNL, 'Wasabi') || /MÙ TẠT|WASABI/.test(ten);
  const ot = coNL(dsNL, 'Ớt tươi', 'Tương ớt', 'Kim chi') || /CAY|KIM CHI/.test(ten);
  const tieu = /TIÊU/.test(ten);
  if (wasabi || ot || tieu) {
    const loaiCay = [wasabi && 'wasabi (cay nồng xộc lên mũi)', ot && 'ớt / kim chi', tieu && 'tiêu đen'].filter(Boolean).join(', ');
    them({
      khoa: 'cay', icon: 'fa-pepper-hot', tieu_de: 'Có vị cay',
      noi_dung: `Món có ${loaiCay}. Người không quen ăn cay hoặc đang đau dạ dày nên dùng thử lượng nhỏ trước.`,
      doi_tuong: ['Trẻ em', 'Người đau dạ dày'],
      dieu_chinh: wasabi ? 'Có thể yêu cầu để wasabi riêng hoặc không wasabi.' : 'Có thể yêu cầu giảm cay.',
    });
  }

  // 3. CON XUONG ---------------------------------------------------------------
  if (/CÁ SABA NƯỚNG|CÁ SANMA|ĐẦU CÁ HỒI|LƯỜN CÁ HỒI/.test(ten)) {
    them({
      khoa: 'xuong', icon: 'fa-bone', muc: 'quan_trong', tieu_de: 'Còn xương cá',
      noi_dung: /ĐẦU CÁ/.test(ten)
        ? 'Đầu cá nướng nguyên miếng, nhiều xương nhỏ và sụn — cần gỡ kỹ khi ăn.'
        : 'Cá nướng nguyên miếng/nguyên con, còn xương dăm và xương sống — cần gỡ kỹ khi ăn.',
      doi_tuong: ['Trẻ nhỏ', 'Người cao tuổi'],
      dieu_chinh: 'Có thể nhờ nhân viên gỡ xương trước khi phục vụ.',
    });
  }

  // 4. CON VO ------------------------------------------------------------------
  if (/HÀU|MAI CUA|SÒ (ĐIỆP|DƯƠNG).*NƯỚNG|NGHÊU/.test(ten) && !/SÚP/.test(ten)) {
    them({
      khoa: 'vo', icon: 'fa-hand-paper', tieu_de: 'Phục vụ nguyên vỏ',
      noi_dung: 'Hải sản được phục vụ cùng vỏ, mép vỏ có thể sắc. Dùng dĩa nhỏ hoặc khăn để tách thịt.',
      doi_tuong: ['Trẻ nhỏ'],
      dieu_chinh: 'Có thể nhờ bếp tách sẵn khỏi vỏ.',
    });
  }

  // 5. TRUNG CHUA CHIN ----------------------------------------------------------
  if (/ONSEN|GYUDON|LÒNG ĐÀO/.test(ten)) {
    them({
      khoa: 'trung_song', icon: 'fa-egg', tieu_de: 'Trứng lòng đào chưa chín hoàn toàn',
      noi_dung: 'Trứng onsen được chần ở ~65°C nên lòng đỏ còn sệt.',
      doi_tuong: ['Phụ nữ mang thai', 'Trẻ nhỏ', 'Người suy giảm miễn dịch'],
      dieu_chinh: 'Có thể yêu cầu làm chín kỹ trứng.',
    });
  }

  // 6. RAT NONG -----------------------------------------------------------------
  if (/HOT POT|TEPPAN/.test(loai) || /SIZZ|LẨU|ĐÚT LÒ/.test(ten)) {
    them({
      khoa: 'nong', icon: 'fa-fire', tieu_de: 'Phục vụ rất nóng',
      noi_dung: /HOT POT|LẨU/.test(loai + ten)
        ? 'Lẩu được đặt trên bếp đang đun tại bàn — giữ trẻ nhỏ tránh xa nồi và bếp.'
        : 'Món được phục vụ trên đĩa gang / khay nóng, có thể bắn dầu khi vừa ra bàn. Không chạm vào đĩa.',
      doi_tuong: ['Gia đình có trẻ nhỏ'],
    });
  }

  // 7. KHO NHAI / KET CAU LA ----------------------------------------------------
  if (/BẠCH TUỘC|SỨA|GÂN BÒ|SÒ LÔNG|SÒ ĐỎ|MỰC/.test(ten) || (/SASHIMI/.test(loai) && coNL(dsNL, 'Bạch tuộc', 'Mực lá'))) {
    them({
      khoa: 'dai', icon: 'fa-teeth', tieu_de: 'Kết cấu dai, giòn',
      noi_dung: 'Bạch tuộc, mực, sứa, gân bò hoặc sò có độ dai/giòn đặc trưng, cần nhai kỹ.',
      doi_tuong: ['Người cao tuổi', 'Người răng yếu', 'Trẻ nhỏ'],
      dieu_chinh: 'Có thể nhờ bếp cắt lát mỏng hơn.',
    });
  }
  if (/NHUM|SABA NGÂM GIẤM|NGÂM GIẤM|KIM CHI|RONG NHO/.test(ten)) {
    them({
      khoa: 'la_vi', icon: 'fa-seedling', tieu_de: 'Hương vị đặc trưng',
      noi_dung: /NHUM/.test(ten) ? 'Nhum biển có vị béo, ngọt và mùi biển đậm — có thể lạ với người lần đầu ăn.'
        : /GIẤM/.test(ten) ? 'Cá ngâm giấm có vị chua và mùi cá đặc trưng kiểu Nhật.'
          : 'Món có hương vị lên men / mùi biển đặc trưng — có thể lạ với người lần đầu ăn.',
      doi_tuong: ['Người mới ăn đồ Nhật'],
    });
  }

  // 8. PURIN -------------------------------------------------------------------
  if (coNL(dsNL, 'Trứng cá hồi ikura', 'Trứng cá tobiko', 'Sốt mentaiko', 'Cá trích ép trứng', 'Hàu sữa', 'Nhum biển', 'Bào ngư', 'Sò điệp')
      || /TRỨNG CÁ|MENTAIKO|HÀU|NHUM/.test(ten)) {
    them({
      khoa: 'purin', icon: 'fa-heart-pulse', muc: 'thong_tin', tieu_de: 'Giàu purin',
      noi_dung: 'Trứng cá và hải sản có vỏ chứa nhiều purin, có thể làm tăng axit uric.',
      doi_tuong: ['Người bị gout', 'Người có axit uric cao'],
    });
  }

  // 9. CAFFEINE ----------------------------------------------------------------
  if (/DRINK/.test(loai) && /TRÀ|MATCHA|COCA|PEPSI|STING/.test(ten) && !/ZERO/.test(ten)) {
    them({
      khoa: 'caffeine', icon: 'fa-mug-hot', muc: 'thong_tin', tieu_de: 'Có caffeine',
      noi_dung: /STING/.test(ten) ? 'Nước tăng lực chứa caffeine và nhiều đường.' : 'Trà / matcha / nước ngọt có ga chứa caffeine.',
      doi_tuong: ['Trẻ em', 'Người khó ngủ', 'Phụ nữ mang thai'],
    });
  }

  // 10. CON ---------------------------------------------------------------------
  if (/SAKE|BEER/.test(loai)) {
    them({
      khoa: 'con', icon: 'fa-wine-glass', muc: 'quan_trong', tieu_de: 'Đồ uống có cồn',
      noi_dung: 'Chỉ phục vụ khách từ 18 tuổi. Đã uống rượu bia thì không lái xe.',
      doi_tuong: ['Dưới 18 tuổi', 'Phụ nữ mang thai', 'Người lái xe'],
    });
  }
  // Ruou NAU (mirin, sake nau an) da hien trong khoi di ung voi MO_TA_DI_UNG.con,
  // khong lap lai o day.
  void nhom;

  const thuTu = { quan_trong: 0, chu_y: 1, thong_tin: 2 };
  return ra.sort((a, b) => thuTu[a.muc] - thuTu[b.muc]);
}

module.exports = { MO_TA_DI_UNG, luuY };

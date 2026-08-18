/**
 * Migration 022 - Sinh cong thuc (dinh muc nguyen lieu) cho thuc don Nhat.
 *
 * VI SAO CAN
 * `kitchenService.markKitchenDone()` tru kho dua tren bang `cong_thuc`. Sau khi
 * thay toan bo thuc don, 258 mon moi khong co dong cong thuc nao, nen bep bam
 * "xong mon" ma kho khong nhuc nhich - ton kho, canh bao het hang, gia von va
 * bao cao loi nhuan theo mon deu dung yen.
 *
 * CACH SINH - VA GIOI HAN CUA NO
 * Khong ai ngoi go tay 258 cong thuc. Script ghep theo hai lop:
 *
 *   1. NEN THEO DANH MUC - thu gi mon nao trong nhom cung dung: com sushi va
 *      rong bien cho nigiri/maki, dashi cho sup va lau, bot tempura va dau an
 *      cho do chien...
 *   2. TU KHOA TRONG TEN MON - nguyen lieu chinh: "SASHIMI CA HOI" ra ca hoi,
 *      "CUON CA HOI PHU XOAI" ra ca hoi VA xoai.
 *
 * Duyet tu khoa theo DO DAI GIAM DAN va CAT BO doan da khop khoi ten:
 * neu khong, "CA CAM" se bi tu khoa "CAM" an mat va mon sashimi ca cam se
 * tinh ra cam tuoi. Day la cho de sai nhat trong ca script.
 *
 * DINH MUC LA CON SO HOP LY, KHONG PHAI CON SO DO BEP DUYET. Muc dich la de
 * ton kho nhuc nhich dung huong va bao cao gia von co so lieu that de tinh.
 * Bep xem lai va sua o /staff/kitchen/recipes khi can.
 *
 * Chay lai duoc nhieu lan: xoa cong thuc cu cua CHINH nhung mon dang co roi
 * sinh lai; khong dung toi cong thuc cua mon da bi go khoi thuc don.
 */
const db = require('../db');

/* Nen theo danh muc: [ten_nguyen_lieu, dinh_muc]. Khop theo phan chu HOA trong
   `name_loai` (vi du "05. SASHIMI" -> SASHIMI). */
const NEN_DANH_MUC = {
  'DRINK':            [['Đá viên', 0.15]],
  'APPERTIZER':       [['Nước tương Nhật', 8]],
  'SALAD':            [['Xà lách', 0.06], ['Dưa leo', 0.03], ['Sốt mayonnaise Nhật', 14]],
  'JAPANESE OYSTER':  [['Hàu sữa', 3]],
  'SASHIMI':          [['Củ cải trắng daikon', 0.04], ['Wasabi', 4], ['Gừng ngâm gari', 0.012]],
  'SASHIMI COMBO':    [['Củ cải trắng daikon', 0.09], ['Wasabi', 9], ['Gừng ngâm gari', 0.03],
                       ['Cá hồi phi lê', 0.12], ['Cá ngừ đại dương', 0.08], ['Cá cam Hamachi', 0.07]],
  'GUNKAN':           [['Gạo sushi Nhật', 0.05], ['Rong biển nori', 2], ['Wasabi', 2]],
  'NIGIRI':           [['Gạo sushi Nhật', 0.045], ['Wasabi', 2], ['Giấm gạo', 4]],
  'SUSHI COMBO':      [['Gạo sushi Nhật', 0.30], ['Rong biển nori', 6], ['Wasabi', 8],
                       ['Gừng ngâm gari', 0.03], ['Cá hồi phi lê', 0.10], ['Cá ngừ đại dương', 0.06]],
  'MAKI':             [['Gạo sushi Nhật', 0.09], ['Rong biển nori', 2], ['Giấm gạo', 6]],
  'TEMAKI':           [['Gạo sushi Nhật', 0.06], ['Rong biển nori', 1.5]],
  'RICE ROLL':        [['Gạo sushi Nhật', 0.11], ['Rong biển nori', 2],
                       ['Sốt mayonnaise Nhật', 15], ['Giấm gạo', 7]],
  'GRILLED':          [['Muối', 0.004], ['Nước tương Nhật', 10]],
  'TEPPAN YAKI':      [['Dầu mè', 8], ['Hành tây', 0.05]],
  'HOT DISH':         [['Dầu ăn', 0.02], ['Nước tương Nhật', 10]],
  'SOUP':             [['Bột dashi', 6], ['Hành lá', 0.01]],
  'NOODLE':           [['Bột dashi', 8], ['Hành lá', 0.015]],
  'HOT POT':          [['Bột dashi', 14], ['Cải thảo', 0.15], ['Nấm kim châm', 0.08], ['Đậu hủ', 0.1]],
  'RICE':             [['Gạo sushi Nhật', 0.15]],
  'TEMPURA':          [['Bột tempura', 0.08], ['Dầu ăn', 0.05]],
  'DESSERT':          [['Đường', 0.02]],
  'SAKE - BEER':      [],
};

/* Tu khoa -> [ten_nguyen_lieu, dinh_muc]. THU TU KHONG QUAN TRONG o day: script
   tu sap theo do dai chuoi giam dan truoc khi duyet. Nhung SU PHU NHAU thi co:
   'TRUNG CA HOI' phai an truoc 'CA HOI', 'CA CAM' truoc 'CAM'. Cach cat bo
   doan da khop lo o ham `tachNguyenLieu` xu ly viec do. */
const TU_KHOA = {
  // trung ca - phai dai hon va an truoc cac tu khoa ca
  'TRỨNG CÁ HỒI':    ['Trứng cá hồi ikura', 18],
  'TRỨNG CÁ CHUỒN':  ['Trứng cá tobiko', 16],
  'TRỨNG CÁ':        ['Trứng cá tobiko', 16],
  'TRỨNG TÔM':       ['Trứng cá tobiko', 16],
  'TOBIKO':          ['Trứng cá tobiko', 14],
  // ca
  'CÁ HỒI':          ['Cá hồi phi lê', 0.09],
  'CÁ NGỪ':          ['Cá ngừ đại dương', 0.08],
  'CÁ CAM':          ['Cá cam Hamachi', 0.08],
  'CÁ SABA':         ['Cá saba', 0.14],
  'CÁ SANMA':        ['Cá sanma', 0.15],
  'CÁ MÚ':           ['Cá mú', 0.10],
  'CÁ TRÍCH':        ['Cá trích ép trứng', 0.07],
  'CÁ TRỨNG':        ['Cá trích ép trứng', 0.08],
  'LƯƠN':            ['Lươn Nhật (unagi)', 0.08],
  // do bien khac
  'SÒ ĐIỆP':         ['Sò điệp', 0.08],
  'SÒ LÔNG':         ['Sò lông', 0.09],
  'SÒ DƯƠNG':        ['Sò dương', 0.09],
  'SÒ ĐỎ':           ['Sò đỏ', 0.08],
  'HÀU':             ['Hàu sữa', 2],
  'TÔM':             ['Tôm thẻ', 0.09],
  'BẠCH TUỘC':       ['Bạch tuộc', 0.08],
  'MỰC':             ['Mực lá', 0.10],
  'CUA LỘT':         ['Cua lột', 2],
  'THANH CUA':       ['Thanh cua surimi', 0.05],
  'MAI CUA':         ['Cua tuyết', 0.12],
  'CUA':             ['Cua tuyết', 0.07],
  'NHUM':            ['Nhum biển', 12],
  'BÀO NGƯ':         ['Bào ngư', 1],
  'NGHÊU':           ['Nghêu', 0.15],
  'SỨA':             ['Sứa biển', 0.07],
  // thit
  'WAGYU':           ['Bò Wagyu', 0.13],
  'AUKOBE':          ['Bò Mỹ', 0.15],
  'GÂN BÒ':          ['Gân bò', 0.09],
  'GYUDON':          ['Bò Mỹ', 0.12],
  'BÒ MỸ':           ['Bò Mỹ', 0.12],
  'BÒ':              ['Bò Mỹ', 0.11],
  'CHASIU':          ['Thịt heo', 0.11],
  'HEO':             ['Thịt heo', 0.11],
  'KARAAGE':         ['Thịt gà', 0.14],
  'GÀ':              ['Thịt gà', 0.13],
  'ĐẬU HỦ':          ['Đậu hủ', 0.12],
  // rau cu / trai cay
  'ĐẬU NÀNH LÔNG':   ['Đậu nành lông', 0.13],
  'MĂNG TÂY':        ['Măng tây', 0.08],
  'NẤM KIM CHÂM':    ['Nấm kim châm', 0.07],
  'NẤM':             ['Nấm shiitake', 0.05],
  'KHOAI TÂY':       ['Khoai tây', 0.16],
  'KIM CHI':         ['Kim chi', 0.09],
  'RONG NHO':        ['Rong nho', 0.05],
  'RONG BIỂN':       ['Rong biển wakame', 0.03],
  'TÍA TÔ':          ['Lá tía tô Nhật', 0.15],
  'DƯA LEO':         ['Dưa leo', 0.05],
  'XOÀI':            ['Xoài chín', 0.06],
  'BƠ':              ['Bơ trái', 0.5],
  'RAU LẨU':         ['Cải thảo', 0.25],
  // sot / gia vi
  'MENTAIKO':        ['Sốt mentaiko', 22],
  'TERIYAKI':        ['Sốt teriyaki', 20],
  'MISO':            ['Tương miso', 0.03],
  'PONZU':           ['Chanh yuzu', 0.02],
  'WASABI':          ['Wasabi', 5],
  'MÙ TẠT':          ['Wasabi', 5],
  'PHÔ MAI':         ['Phô mai lát', 2],
  'SỐT CAY':         ['Tương ớt', 12],
  'SỐT TIÊU':        ['Tiêu', 0.004],
  'TIÊU ĐEN':        ['Tiêu', 0.005],
  'SỐT TÁO':         ['Nước ép táo', 0.04],
  'SỐT NHUM':        ['Nhum biển', 10],
  'DẦU MÈ':          ['Dầu mè', 10],
  'NGÂM TƯƠNG':      ['Nước tương Nhật', 25],
  'NGÂM GIẤM':       ['Giấm gạo', 20],
  // tinh bot
  'TEMPURA':         ['Bột tempura', 0.06],
  'CHIÊN XÙ':        ['Bột chiên xù panko', 0.06],
  'UDON':            ['Mì udon tươi', 0.20],
  'SOBA':            ['Mì soba', 0.18],
  'RAMEN':           ['Mì ramen tươi', 0.20],
  'PASTA':           ['Mì udon tươi', 0.18],
  'MÌ CUA':          ['Mì udon tươi', 0.18],
  'CƠM':             ['Gạo sushi Nhật', 0.16],
  'BÁNH XÈO':        ['Bột tempura', 0.12],
  // trung
  'TRỨNG CUỘN':      ['Trứng gà', 3],
  'TRỨNG ONSEN':     ['Trứng gà', 1],
  'TRỨNG HẤP':       ['Trứng gà', 2],
  'TRỨNG':           ['Trứng gà', 1],
  // trang mieng
  'MATCHA':          ['Trà xanh matcha', 6],
  'SOCOLA':          ['Bột socola', 0.03],
  'TIRAMISU':        ['Bánh quy tiramisu', 0.05],
  'PANNA COTTA':     ['Bột panna cotta', 0.02],
  'BÁNH KEM':        ['Kem tươi', 0.08],
  'KEM':             ['Kem tươi', 0.09],
  'VIỆT QUẤT':       ['Việt quất', 0.03],
  'CHANH DÂY':       ['Chanh dây', 0.05],
  'DÂU':             ['Dâu tây', 0.05],
  'ĐẬU ĐỎ':          ['Đậu đỏ nấu sẵn', 0.05],
  // do uong
  'TRÀ XANH':        ['Trà xanh matcha', 4],
  'TRÀ GẠO':         ['Trà gạo rang', 0.012],
  'OOLONG':          ['Trà oolong', 0.01],
  'HOA CÚC':         ['Hoa cúc khô', 3],
  'HẠT CHIA':        ['Hạt chia', 0.01],
  'NHA ĐAM':         ['Nha đam', 0.05],
  'THANH YÊN':       ['Chanh yuzu', 0.02],
  'YUZU':            ['Chanh yuzu', 0.02],
  'MOJITO':          ['Lá bạc hà', 0.1],
  'ĐÀO':             ['Đào ngâm', 0.12],
  'VẢI':             ['Vải ngâm', 0.12],
  'NHÃN':            ['Nhãn ngâm', 0.12],
  'SEN':             ['Hạt sen', 0.03],
  'ỔI':              ['Ổi hồng', 0.12],
  'DƯA HẤU':         ['Dưa hấu', 0.35],
  'THƠM':            ['Thơm (dứa)', 0.5],
  'CAM':             ['Cam tươi', 0.3],
  'COCA ZERO':       ['Coca Zero', 1],
  'COCA':            ['Coca-Cola', 1],
  'SPRITE':          ['Sprite', 1],
  'STING':           ['Sting', 1],
  'NƯỚC SUỐI':       ['Nước suối', 1],
  'SAKE':            ['Rượu sake chai', 1],
  'SAPPORO':         ['Bia Nhật lon', 1],
  'HEIEKEN':         ['Bia Nhật lon', 1],
  'TIGER':           ['Bia Tiger', 1],
  'OBAACHAN':        ['Rượu sake chai', 1],

  /* Ten mon noi CHUNG CHUNG - khong chi ra mot nguyen lieu nao ca. Nhung mon
     nay tung chi ra duoc phan nen cua danh muc (com khong, bot tempura khong),
     nhin vao bang cong thuc thi biet ngay la thieu. Mot tu khoa o day duoc
     phep gan NHIEU nguyen lieu. */
  'HẢI SẢN':         [['Tôm thẻ', 0.06], ['Mực lá', 0.05], ['Sò điệp', 0.05]],
  'THẬP CẨM':        [['Tôm thẻ', 0.05], ['Mực lá', 0.04], ['Khoai tây', 0.05]],
  'RAU CỦ':          [['Cà rốt', 0.06], ['Khoai tây', 0.08], ['Hành tây', 0.05]],
  'CHIRASHI':        [['Cá hồi phi lê', 0.06], ['Cá ngừ đại dương', 0.05], ['Trứng cá tobiko', 10]],
  'SUKIYAKI':        [['Bò Mỹ', 0.15], ['Nấm shiitake', 0.05]],
  'NABE':            [['Tôm thẻ', 0.07], ['Mực lá', 0.05], ['Nghêu', 0.10]],
  'CALIFORNIA':      [['Thanh cua surimi', 0.05], ['Bơ trái', 0.5], ['Trứng cá tobiko', 10]],
  'CẦU VÒNG':        [['Cá hồi phi lê', 0.05], ['Cá ngừ đại dương', 0.04], ['Bơ trái', 0.3]],
  'DOBIN':           [['Nấm shiitake', 0.05], ['Tôm thẻ', 0.04]],
  'CƠM CHIÊN':       [['Trứng gà', 1], ['Hành lá', 0.01]],
  'LATTE':           [['Sữa đặc', 25]],
  'BOMP':            [['Cá hồi phi lê', 0.05], ['Trứng cá tobiko', 8]],
};

/**
 * He so khau phan theo danh muc, nhan vao nguyen lieu CHINH (phan rut tu ten
 * mon), khong nhan vao nen danh muc.
 *
 * Ly do: cung la "ca hoi" nhung mot mieng nigiri chi khoang 15g, mot dia
 * sashimi khoang 90g, mot phan nuong khoang 120g. Dung chung mot con so thi
 * nigiri luon-nhat ban 59.000d se co gia von 71.000d - lo ngay tren tung
 * mieng, va bao cao loi nhuan theo mon sai huong.
 */
const HE_SO_KHAU_PHAN = {
  'NIGIRI': 0.2,
  'GUNKAN': 0.2,
  'TEMAKI': 0.35,
  'MAKI': 0.5,
  'RICE ROLL': 0.5,
  'SASHIMI': 1.0,
  'SASHIMI COMBO': 1.5,
  'SUSHI COMBO': 1.5,
  'JAPANESE OYSTER': 1.0,
  'APPERTIZER': 0.7,
  'SALAD': 0.7,
  'SOUP': 0.7,
  'GRILLED': 1.2,
  'TEPPAN YAKI': 1.2,
  'HOT DISH': 1.0,
  'TEMPURA': 1.0,
  'NOODLE': 1.0,
  'HOT POT': 1.3,
  'RICE': 1.0,
  'DESSERT': 1.0,
  'DRINK': 1.0,
  'SAKE - BEER': 1.0,
};

/** Danh sach tu khoa da sap theo do dai GIAM DAN - tu khoa dai duoc thu truoc. */
const TU_KHOA_SAP = Object.keys(TU_KHOA).sort((a, b) => b.length - a.length);

/**
 * Rut nguyen lieu chinh tu ten mon.
 *
 * Sau moi lan khop, doan khop bi thay bang khoang trang trong chuoi lam viec.
 * Nho vay "SASHIMI CA CAM" khop 'CA CAM' roi chuoi con lai khong con chu "CAM"
 * de tu khoa 'CAM' (cam tuoi) khop nham nua.
 */
function tachNguyenLieu(tenMon) {
  let conLai = ' ' + tenMon.toUpperCase() + ' ';
  const ra = [];
  for (const tk of TU_KHOA_SAP) {
    if (conLai.includes(tk)) {
      // Mot tu khoa co the gan 1 nguyen lieu ['Ten', dm] hoac NHIEU nguyen lieu
      // [['Ten', dm], ['Ten2', dm2]]. Phan biet bang viec phan tu dau la mang.
      const v = TU_KHOA[tk];
      if (Array.isArray(v[0])) ra.push(...v);
      else ra.push(v);
      conLai = conLai.split(tk).join(' ');
    }
  }
  return ra;
}

/** Lay phan ten danh muc bo so thu tu: "05. SASHIMI" -> "SASHIMI". */
function tenNen(nameLoai) {
  return String(nameLoai).replace(/^\s*\d+\.\s*/, '').trim().toUpperCase();
}

async function sinhCongThuc() {
  const [nl] = await db.query('SELECT id_nl, ten_nl, gia_von FROM nguyen_lieu');
  const idTheoTen = new Map(nl.map((r) => [r.ten_nl, r.id_nl]));
  const nlTheoTen = new Map(nl.map((r) => [r.ten_nl, r]));
  const soMonBiHa = [];

  const [mon] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, l.name_loai
     FROM monan m JOIN loai_mon l ON l.id_loai = m.id_loai
     ORDER BY m.id_mon`
  );

  // Xoa cong thuc cu cua chinh nhung mon nay (chay lai lan hai khong bi nhan doi).
  const ids = mon.map((m) => m.id_mon);
  if (ids.length) {
    await db.query(`DELETE FROM cong_thuc WHERE id_mon IN (${ids.map(() => '?').join(',')})`, ids);
  }

  let soDong = 0;
  let monKhongCoNguyenLieuChinh = [];
  const thieuNguyenLieu = new Set();

  for (const m of mon) {
    const nen = NEN_DANH_MUC[tenNen(m.name_loai)] || [];
    const chinh = tachNguyenLieu(m.name_mon);

    if (!chinh.length && !nen.length) monKhongCoNguyenLieuChinh.push(m.name_mon);

    // Gop lai, cong don neu mot nguyen lieu xuat hien ca o nen lan tu khoa.
    // Mon "(them)" la phan goi them an kem, khong phai mot suat day du.
    const laGoiThem = /\(thêm\)/i.test(m.name_mon);
    const heSo = (HE_SO_KHAU_PHAN[tenNen(m.name_loai)] ?? 1) * (laGoiThem ? 0.5 : 1);

    const gop = new Map();
    // Mon goi them chi la mot phan nguyen lieu chinh - khong kem nuoc dung,
    // khong kem do trang tri cua ca suat, nen bo han nen danh muc.
    for (const [ten, dm] of (laGoiThem ? [] : nen)) {
      gop.set(ten, (gop.get(ten) || 0) + Number(dm));
    }
    for (const [ten, dm] of chinh) {
      gop.set(ten, (gop.get(ten) || 0) + Number(dm) * heSo);
    }

    /*
      Ruou sake: tinh theo DUNG TICH ghi trong ten mon, khong phai "mot chai".
      Menu ban theo ly - 90ml, 150ml, 300ml - trong khi nguyen lieu la chai
      720ml gia 320k. De nguyen "1 chai" thi ly sake 90ml ban 55k co gia von
      320k, lo 265k moi ly, va bao cao loi nhuan theo mon am hang tram trieu.
      Chai nao khong ghi dung tich thi suy tu gia ban: tren 500k coi la ca chai,
      duoi do la binh tokkuri ~300ml.
    */
    if (gop.has('Rượu sake chai')) {
      const ml = /(\d+)\s*ml/i.exec(m.name_mon);
      let phan;
      if (ml) phan = Number(ml[1]) / 720;
      else if (Number(m.gia_mon) >= 500000) phan = 1;
      else phan = 300 / 720;
      gop.set('Rượu sake chai', phan);
    }

    /*
      Chan tran gia von.

      Dinh muc o tren la uoc luong tu ten mon, nen van co mon rot ra gia von
      cao hon gia ban - mieng "SASHIMI HAU" 29.000d ma tinh 2 con hau 18.000d
      chang han. De nguyen thi bao cao loi nhuan theo mon ra so am va bieu do
      Pareto tren dashboard doc nguoc.

      Nganh F&B chay gia von khoang 30-40% gia ban. Neu vuot 55%, ha DEU cac
      nguyen lieu chinh cho ve 45% - giu nguyen ti le giua chung, chi doi quy
      mo. Day la mot rao chan, khong phai mot phep do: mon nao bi ha se ghi ra
      duoi de bep biet ma xem lai.
    */
    const giaBan = Number(m.gia_mon) || 0;
    if (giaBan > 0) {
      let von = 0;
      for (const [ten, dm] of gop) {
        const n = nlTheoTen.get(ten);
        if (n) von += dm * Number(n.gia_von);
      }
      if (von > giaBan * 0.55) {
        // Chi ha phan nguyen lieu chinh; nen danh muc (gia vi, com, rong bien)
        // la chi phi that cua mon, ha xuong khong con dung ban chat.
        let vonNen = 0;
        for (const [ten, dm] of nen) {
          const n = nlTheoTen.get(ten);
          if (n) vonNen += Number(dm) * Number(n.gia_von);
        }
        const vonChinhMuc = Math.max(giaBan * 0.45 - vonNen, giaBan * 0.05);
        const vonChinhHienTai = von - vonNen;
        if (vonChinhHienTai > 0) {
          const tyLe = vonChinhMuc / vonChinhHienTai;
          const tenNen_ = new Set(nen.map(([t]) => t));
          for (const [ten, dm] of gop) {
            if (!tenNen_.has(ten)) gop.set(ten, dm * tyLe);
          }
          soMonBiHa.push(m.name_mon);
        } else {
          // Cac mon combo ("COMBO SUSHI SET 1") khong ra tu khoa nao - toan bo
          // gia von nam o nen danh muc. Khong con gi de ha rieng, nen ha deu ca
          // nen; ti le giua cac nguyen lieu trong combo van giu nguyen.
          const tyLe = (giaBan * 0.45) / von;
          for (const [ten, dm] of gop) gop.set(ten, dm * tyLe);
          soMonBiHa.push(m.name_mon);
        }
      }
    }

    for (const [ten, dm] of gop) {
      const idNl = idTheoTen.get(ten);
      if (!idNl) { thieuNguyenLieu.add(ten); continue; }
      await db.query(
        'INSERT INTO cong_thuc (id_mon, id_nl, so_luong_tieu_hao) VALUES (?, ?, ?)',
        [m.id_mon, idNl, Number(dm.toFixed(4))]
      );
      soDong++;
    }
  }

  console.log(`  Cong thuc sinh ra        : ${soDong} dong cho ${mon.length} mon`);
  if (soMonBiHa.length) {
    console.log(`  Bi ha dinh muc ve tran gia von (${soMonBiHa.length} mon):`);
    soMonBiHa.slice(0, 10).forEach((t) => console.log(`      - ${t}`));
  }
  if (thieuNguyenLieu.size) {
    console.log(`  [CANH BAO] thieu nguyen lieu: ${[...thieuNguyenLieu].join(', ')}`);
  }
  if (monKhongCoNguyenLieuChinh.length) {
    console.log(`  [CANH BAO] ${monKhongCoNguyenLieuChinh.length} mon khong ra nguyen lieu nao:`);
    monKhongCoNguyenLieuChinh.slice(0, 10).forEach((t) => console.log(`      - ${t}`));
  }
}

async function kiemTra() {
  console.log('\n  Kiem tra:');
  const [[tong]] = await db.query('SELECT COUNT(*) AS n FROM cong_thuc');
  const [[phu]] = await db.query(
    `SELECT COUNT(*) AS n FROM monan m
     WHERE m.tinhtrang = 1 AND NOT EXISTS (SELECT 1 FROM cong_thuc c WHERE c.id_mon = m.id_mon)`
  );
  const [[moCoi]] = await db.query(
    `SELECT COUNT(*) AS n FROM cong_thuc c
     LEFT JOIN nguyen_lieu n ON n.id_nl = c.id_nl WHERE n.id_nl IS NULL`
  );
  const [[tb]] = await db.query(
    `SELECT ROUND(AVG(sl), 1) AS n FROM (
       SELECT COUNT(*) AS sl FROM cong_thuc GROUP BY id_mon) t`
  );
  console.log(`      tong dong cong thuc      : ${tong.n}`);
  console.log(`      trung binh moi mon       : ${tb.n} nguyen lieu`);
  console.log(`      mon dang ban CHUA co ct  : ${phu.n}`);
  console.log(`      cong thuc tro nguyen lieu khong ton tai: ${moCoi.n}`);
  /*
    Chot chan quan trong nhat: gia von cong thuc phai THAP HON gia ban.
    Mot dinh muc go nham don vi (1 chai sake thay vi 1 ly) khong bao gio lam
    script bao loi - no chi lang le lam bao cao loi nhuan theo mon am, va phai
    doc bang so lieu moi phat hien ra. Kiem ngay tai day.
  */
  const [amBien] = await db.query(
    `SELECT m.name_mon, m.gia_mon, ROUND(SUM(c.so_luong_tieu_hao * n.gia_von)) AS gia_von
     FROM cong_thuc c
     JOIN monan m      ON m.id_mon = c.id_mon
     JOIN nguyen_lieu n ON n.id_nl = c.id_nl
     GROUP BY m.id_mon, m.name_mon, m.gia_mon
     HAVING gia_von >= m.gia_mon
     ORDER BY (gia_von - m.gia_mon) DESC`
  );
  console.log(`      mon co gia von >= gia ban: ${amBien.length}`);
  amBien.slice(0, 8).forEach((r) =>
    console.log(`         ${String(r.name_mon).slice(0, 34).padEnd(36)} ban ${Number(r.gia_mon).toLocaleString('vi-VN')} / von ${Number(r.gia_von).toLocaleString('vi-VN')}`)
  );

  if (Number(phu.n) > 0) throw new Error('Con mon dang ban khong co cong thuc.');
  if (Number(moCoi.n) > 0) throw new Error('Co cong thuc tro toi nguyen lieu khong ton tai.');
}

async function main() {
  console.log('=== Migration 022: cong thuc cho thuc don Nhat ===');
  await sinhCongThuc();
  await kiemTra();
  console.log('\n=== Hoan tat migration 022 ===');
  console.log('Buoc tiep theo: chay 023 de sinh lai lich su ban hang theo thuc don moi.');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});

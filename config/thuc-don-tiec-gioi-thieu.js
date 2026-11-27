/**
 * Gioi thieu chi tiet tung thuc don tiec co san (theo `thuc_don_tiec.ma`).
 * Hien tren the thuc don (the "Hop voi") va khung chi tiet khi khach chon thuc don
 * o buoc 4 trang /dat-tiec. Thuc don khong co trong day van hien binh thuong.
 *
 *   hop_voi    : cac dip / doi tuong hop nhat (the ngan, hien tren the)
 *   quy_mo     : quy mo goi y
 *   huong_vi   : khau vi tong the
 *   diem_nhan  : vi sao nen chon / mon dang chu y
 *   luu_y      : dieu can biet truoc khi chon
 */
module.exports = {
  CUOI_HANH_PHUC: {
    hop_voi: ['Tiệc cưới ấm cúng', 'Lễ ăn hỏi', 'Ngân sách vừa phải'],
    quy_mo: 'Đẹp nhất từ 5 – 20 bàn (50 – 200 khách).',
    huong_vi: 'Thanh nhẹ, đậm vị Nhật nhưng dễ ăn: hải sản tươi, cá hồi sốt teriyaki ngọt nhẹ, lẩu nấm thanh.',
    diem_nhan: 'Đủ 4 phần khai vị – sashimi & sushi – món chính – tráng miệng chỉ với 8 món, khách lớn tuổi và trẻ nhỏ đều ăn được. Cô dâu chú rể có champagne khai tiệc, bàn có hoa tươi và thiệp tên khách.',
    luu_y: 'Chưa gồm bánh cưới và nước ngọt – thêm ở bước Dịch vụ nếu cần.',
  },
  CUOI_TRAM_NAM: {
    hop_voi: ['Tiệc cưới chính', 'Khách mời đông', 'Được chọn nhiều nhất'],
    quy_mo: 'Phù hợp 10 – 40 bàn, sảnh lớn.',
    huong_vi: 'Phong phú, nhiều hải sản: sashimi 4 loại, hàu nướng phô mai, tôm sốt mentaiko béo; bò Aukobe áp chảo làm món chủ lực.',
    diem_nhan: 'Cân bằng giữa sang trọng và chi phí. Trọn gói bánh cưới 3 tầng, tháp ly champagne khai tiệc và nước ngọt không giới hạn – gần như không phát sinh thêm.',
    luu_y: 'Có hải sản có vỏ (hàu, tôm, sò điệp) – báo trước nếu khách dị ứng để bếp đổi món.',
  },
  CUOI_HOANG_GIA: {
    hop_voi: ['Tiệc cưới cao cấp', 'Khách VIP, đối tác', 'Gia đình muốn làm thật sang'],
    quy_mo: 'Phù hợp mọi quy mô; ấn tượng nhất với tiệc 10 – 30 bàn.',
    huong_vi: 'Thượng hạng: bào ngư sốt nhum biển, hàu Hyogo sashimi, Sashimi Premium, bò Aukobe steak và lẩu Sukiyaki bò.',
    diem_nhan: '11 món – nhiều nhất trong các thực đơn. Trọn gói bánh cưới 5 tầng, sake chúc mừng mỗi bàn, bia và nước ngọt không giới hạn, hoa và nến trên bàn.',
    luu_y: 'Nhiều món sống (sashimi, hàu sống) – nên báo số khách mang thai / trẻ nhỏ để bếp chuẩn bị món chín thay thế.',
  },
  SN_VUI_VE: {
    hop_voi: ['Sinh nhật bé', 'Có nhiều trẻ em', 'Tiệc lớp, nhóm bạn nhỏ'],
    quy_mo: 'Gọn nhẹ, 2 – 8 bàn.',
    huong_vi: 'Món chín, chiên giòn, ít cay, không có đồ sống: gà Karaage, tempura tôm, cơm chiên, udon xào – trẻ em rất dễ ăn.',
    diem_nhan: 'Giá mềm nhất nhóm sinh nhật. Có sẵn bánh kem 20cm và bóng bay trang trí bàn, chỉ cần đến là tổ chức.',
    luu_y: 'Người lớn thích sashimi nên chọn "Rạng Rỡ" hoặc thêm món ở phần Tự chọn.',
  },
  SN_RANG_RO: {
    hop_voi: ['Sinh nhật người lớn', 'Sinh nhật bạn bè, đồng nghiệp', 'Có không khí tiệc tùng'],
    quy_mo: '2 – 10 bàn, hợp sảnh nhỏ hoặc phòng VIP.',
    huong_vi: 'Trẻ trung, nhiều vị: sashimi cá hồi tươi, gunkan trứng cá, gà phô mai đút lò béo ngậy và lẩu kim chi hải sản cay nhẹ.',
    diem_nhan: 'Trọn gói không khí sinh nhật: backdrop "Happy Birthday", bánh kem 24cm, nến và nhạc chúc mừng khi ra bánh.',
    luu_y: 'Lẩu kim chi có vị cay nhẹ – có thể yêu cầu giảm cay trong phần ghi chú.',
  },
  SN_BE_YEU: {
    hop_voi: ['Thôi nôi', 'Đầy tháng', 'Gia đình có người lớn tuổi'],
    quy_mo: '2 – 8 bàn, hợp phòng VIP hoặc sảnh nhỏ.',
    huong_vi: 'Thanh đạm, mềm, không cay: trứng hấp, súp trứng, cá hồi nướng muối, tempura rau củ và lẩu nấm cá cam ngọt nước.',
    diem_nhan: 'Có mâm cúng và bàn bốc đồ chơi cho bé, bánh kem thôi nôi, trang trí theo tông bé trai / bé gái – nhà hàng lo phần nghi lễ.',
    luu_y: 'Báo ngày sinh và giới tính của bé ở phần ghi chú để chuẩn bị mâm cúng và trang trí đúng.',
  },
  PARTY_YEAR_END: {
    hop_voi: ['Tất niên công ty', 'Tổng kết, vinh danh', 'Gala nội bộ'],
    quy_mo: 'Phù hợp 5 – 40 bàn, có phần phát biểu trên sân khấu.',
    huong_vi: 'Đậm đà, hợp vừa ăn vừa nâng ly: mực chiên xù, bò sizzling sốt tiêu đen, combo sushi và lẩu Nabe hải sản ăn chung.',
    diem_nhan: 'Mỗi bàn có 1 thùng bia Sapporo. Có backdrop in logo công ty, micro và loa cho phần phát biểu, trao giải.',
    luu_y: 'Gửi file logo cho nhà hàng ít nhất 3 ngày trước tiệc để kịp in backdrop.',
  },
  PARTY_IZAKAYA: {
    hop_voi: ['Liên hoan, teambuilding', 'Họp lớp', 'Nhóm bạn, câu lạc bộ'],
    quy_mo: '3 – 15 bàn; từ 5 bàn có MC dẫn trò chơi.',
    huong_vi: 'Món nhậu kiểu quán Izakaya: kim chi, gà Karaage, cá saba nướng muối, sò điệp nướng phô mai, bánh xèo Nhật.',
    diem_nhan: 'Không khí thoải mái, giá dễ chịu. Mỗi bàn có 6 lon bia Tiger; từ 5 bàn có MC dẫn trò chơi teambuilding.',
    luu_y: 'Thiên về món ăn chơi – nhóm cần ăn no nên thêm cơm hoặc mì ở phần Tự chọn.',
  },
  PARTY_COCKTAIL: {
    hop_voi: ['Khai trương', 'Ra mắt sản phẩm', 'Gặp mặt đối tác'],
    quy_mo: '30 – 200 khách, tiệc đứng (giá tính quy đổi theo bàn 10 khách).',
    huong_vi: 'Finger food một miếng, ăn bằng tay khi đứng giao lưu: nigiri, temaki tôm tempura, hàu và sò điệp nướng.',
    diem_nhan: 'Khách di chuyển và trò chuyện tự do. Có quầy Mojito, bàn cocktail đứng phủ khăn và nhân viên phục vụ khay đi mời.',
    luu_y: 'Không có món chính no bụng – hợp sự kiện 1,5 – 2 tiếng, không phải bữa ăn chính.',
  },
  GD_SUM_VAY: {
    hop_voi: ['Họp mặt gia đình', 'Giỗ chạp', 'Bữa cơm cuối tuần'],
    quy_mo: '1 – 5 bàn, đặt Phòng VIP để có phòng riêng.',
    huong_vi: 'Bữa cơm Nhật nhà làm, ấm bụng: súp miso, cá hồi nướng, trứng cuộn, lẩu Sukiyaki ăn với cơm trắng.',
    diem_nhan: 'Giá thấp nhất trong các thực đơn, món quen thuộc với mọi lứa tuổi. Trà xanh Nhật không giới hạn.',
    luu_y: 'Ít món sống – phù hợp gia đình có người lớn tuổi hoặc không quen ăn sashimi.',
  },
  GD_DOAN_VIEN: {
    hop_voi: ['Đoàn tụ ba thế hệ', 'Tất niên gia đình', 'Đón người thân về nước'],
    quy_mo: '2 – 8 bàn.',
    huong_vi: 'Đủ đầy hơn: Sashimi Set B, cuộn cầu vồng, đầu cá hồi nướng teriyaki, bò cuộn nấm kim châm và lẩu nấm cá mú.',
    diem_nhan: 'Vừa có món tươi cho người trẻ, vừa có món chín, lẩu cho ông bà. Có hoa tươi trên bàn và ảnh gia đình in tặng làm kỷ niệm.',
    luu_y: 'Muốn chụp ảnh gia đình đẹp, nên đặt khung giờ sớm để còn ánh sáng tự nhiên.',
  },
  GD_KY_NIEM: {
    hop_voi: ['Mừng thọ', 'Kỷ niệm ngày cưới', 'Dịp trang trọng trong gia đình'],
    quy_mo: '1 – 6 bàn, đẹp nhất trong Phòng VIP.',
    huong_vi: 'Hải sản Nhật cao cấp: hàu Hyogo nướng mentaiko, súp Dobin, lươn Nhật nướng, bò Aukobe áp chảo và lẩu Nabe.',
    diem_nhan: 'Có bánh kem chúc mừng, hoa và nến trên bàn, sake chúc mừng – trọn nghi thức chúc thọ, kỷ niệm.',
    luu_y: 'Báo tên người được chúc và lời chúc ở phần ghi chú để nhà hàng ghi lên bánh.',
  },
};

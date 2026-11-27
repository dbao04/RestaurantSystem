/**
 * Y DINH NGAM MAC DINH - khach khong hoi thang nhung loi noi cho thay nhu cau.
 *   "doi qua"        -> dang muon an      -> goi y mon ban chay + hoi den quan hay giao
 *   "troi lanh qua"  -> muon mon nong     -> goi y lau, sup
 *   "khat nuoc"      -> muon uong         -> goi y do uong
 *
 * Moi y dinh:
 *   ma        : khoa duy nhat
 *   ten       : nhan hien o trang quan tri
 *   tu_khoa   : tu / cum tu tin hieu. VIET CO DAU: khach go co dau thi so dung dau
 *               ("doi" khong nham "doi"/"doi"), go khong dau van khop.
 *   tra_loi   : nhieu cach cach nhau || ; bien {ten_khach} {hotline}... nhu kho kien thuc
 *   hanh_dong : chi_tra_loi | ban_chay | nhom | gia | mon_chin | ten
 *   tham_so   : nhom -> ten nhom tieng Anh trong thuc don, cach nhau | (vd "HOT POT|SOUP")
 *               gia  -> gia toi da (vd 100000)
 *               ten  -> chu co trong ten mon, cach nhau | (vd "cay|kim chi")
 *   uu_tien   : trung nhieu y dinh thi lay uu tien cao hon (y cu the > y chung chung)
 */
module.exports = [
  {
    ma: 'doi_bung', ten: 'Đói / muốn ăn', uu_tien: 1, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['đói meo', 'đói lả', 'đói run', 'sôi bụng', 'đói rã rời', 'ăn gì đây', 'đói muốn xỉu', 'bụng đói', 'cồn cào', 'đói', 'đói bụng', 'đói quá', 'thèm ăn', 'muốn ăn', 'chưa ăn', 'chưa ăn gì', 'ăn gì giờ', 'ăn gì bây giờ', 'bụng réo', 'xỉu vì đói', 'kiếm gì ăn', 'tìm đồ ăn'],
    tra_loi: 'Đói thì phải ăn liền thôi {ten_khach} ơi 😋 Mình gợi ý mấy món đang được khách gọi nhiều nhất nè. Bạn muốn **ghé quán** hay để mình **giao tận nơi** ạ?||Bụng đói là không chờ được đâu nha 😆 Đây là mấy món "cứu đói" ngon nhất quán. Bạn ăn tại quán hay đặt giao về ạ?',
    lien_ket: 'Đặt món giao tận nơi|/menu;Đặt bàn|/dat-ban', goi_y: 'Giao hàng có mất phí không?|Đặt bàn',
  },
  {
    ma: 'khat', ten: 'Khát / muốn uống', uu_tien: 2, hanh_dong: 'nhom', tham_so: 'DRINK',
    tu_khoa: ['khô họng', 'rát cổ', 'cần nước', 'uống gì đây', 'thèm nước mát', 'khát', 'khát nước', 'khô cổ', 'muốn uống', 'thèm uống', 'uống gì', 'giải khát', 'thèm trà sữa'],
    tra_loi: 'Khát thì làm ly gì mát mát nè 🥤 Đây là mấy món uống được gọi nhiều ở quán:||Để mình "giải cứu" cơn khát cho bạn nha 🧊 Bạn tham khảo mấy món này:',
    lien_ket: 'Xem đồ uống|/menu', goi_y: '',
  },
  {
    ma: 'troi_lanh', ten: 'Trời lạnh / mưa → món nóng', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'HOT POT|SOUP|HOT DISH|NOODLE',
    tu_khoa: ['lạnh run', 'gió lạnh', 'mưa gió', 'mưa bão', 'trời trở lạnh', 'lạnh buốt', 'mưa phùn', 'lạnh quá', 'trời lạnh', 'rét', 'trời mưa', 'mưa quá', 'mưa to', 'se lạnh', 'muốn ăn nóng', 'đồ nóng', 'ấm bụng', 'cảm lạnh'],
    tra_loi: 'Trời thế này mà có nồi lẩu nóng hổi thì hết ý luôn 🍲 Mình gợi ý mấy món nóng cho ấm bụng nè:||Lạnh lạnh làm tô nóng là chuẩn bài 😌 Bạn xem mấy món này nha. Ngại ra đường thì mình giao tận nơi luôn!',
    lien_ket: 'Đặt món giao tận nơi|/menu', goi_y: 'Giao trong bao lâu?',
  },
  {
    ma: 'troi_nong', ten: 'Trời nóng → món mát', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'DRINK|SALAD|SASHIMI|DESSERT',
    tu_khoa: ['nắng quá', 'nắng nóng', 'oi quá', 'nóng chảy mỡ', 'say nắng', 'nóng như lửa', 'nóng quá', 'trời nóng', 'oi bức', 'nóng nực', 'muốn ăn mát', 'đồ mát', 'giải nhiệt'],
    tra_loi: 'Nóng thế này ăn gì mát mát cho dễ chịu nha ☀️ Sashimi lạnh, salad hay ly nước mát là hợp nhất nè:||Giải nhiệt ngay với mấy món mát lạnh này nha bạn 🧊',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_cay', ten: 'Thèm cay', uu_tien: 4, hanh_dong: 'ten', tham_so: 'cay|kim chi|spicy',
    tu_khoa: ['cay xé lưỡi', 'thèm vị cay', 'kim chi', 'thèm cay', 'ăn cay', 'món cay', 'cay cay', 'thích cay', 'đồ cay'],
    tra_loi: 'Hảo cay hả bạn 🌶️ Mấy món này có vị cay nè, muốn cay hơn thì ghi chú cho bếp nha:||Team ăn cay đây rồi 🔥 Bạn thử mấy món này nha:',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_ngot', ten: 'Thèm ngọt / tráng miệng', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'DESSERT',
    tu_khoa: ['hảo ngọt', 'thèm socola', 'ăn gì ngọt ngọt', 'thèm ngọt', 'đồ ngọt', 'ăn ngọt', 'tráng miệng', 'thèm kem', 'thèm bánh', 'món ngọt'],
    tra_loi: 'Ăn xong mà thiếu món ngọt là chưa trọn vị nha 🍮 Đây là mấy món tráng miệng của quán:||Hảo ngọt thì thử mấy món này nè bạn 🍨',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'an_kieng', ten: 'Ăn kiêng / healthy', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'SALAD|SASHIMI',
    tu_khoa: ['ăn uống lành mạnh', 'ít calo', 'đang giảm mỡ', 'ăn kiêng', 'giảm cân', 'healthy', 'ít béo', 'eat clean', 'giữ dáng', 'đang diet', 'ăn nhẹ'],
    tra_loi: 'Giữ dáng mà vẫn ngon thì món Nhật là chân ái nè 🥗 Sashimi và salad nhiều đạm, ít béo, bạn tham khảo nha:||Mấy món này nhẹ bụng, tốt cho người đang ăn kiêng nè bạn 💪',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'het_tien', ten: 'Tiết kiệm / ít tiền', uu_tien: 4, hanh_dong: 'gia', tham_so: '100000',
    tu_khoa: ['cháy túi', 'viêm màng túi', 'eo hẹp', 'không có nhiều tiền', 'ngân sách ít', 'ví mỏng', 'chưa có lương', 'hết tiền', 'cuối tháng', 'tiết kiệm', 'ít tiền', 'rẻ rẻ', 'túi tiền', 'sinh viên', 'kẹt tiền', 'nghèo'],
    tra_loi: 'Cuối tháng vẫn phải ăn ngon nha 😆 Mình lọc mấy món dưới 100k vừa túi tiền nè:||Có món ngon mà không lo ví mỏng đây bạn ơi 💰',
    lien_ket: 'Xem combo tiết kiệm|/combos', goi_y: '',
  },
  {
    ma: 'khong_an_song', ten: 'Không ăn đồ sống → món chín', uu_tien: 5, hanh_dong: 'mon_chin', tham_so: '',
    tu_khoa: ['không thích đồ sống', 'không ăn gỏi', 'ăn chín', 'không ăn sống', 'không ăn được sống', 'sợ đồ sống', 'món chín', 'đồ chín', 'đang mang bầu', 'bà bầu', 'có bầu'],
    tra_loi: 'Không sao đâu ạ, quán có nhiều món **chín hoàn toàn** mà vẫn đậm vị Nhật nè 🔥:||Bạn yên tâm, mấy món này đều chín kỹ nha:',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'di_dong', ten: 'Đi đông người / nhóm', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'COMBO',
    tu_khoa: ['đám bạn', 'hội bạn', 'cả team', 'cả phòng', 'đồng nghiệp', 'rủ bạn', 'mời bạn bè', 'đi nhóm', 'đi đông', 'cả nhóm', 'nhóm bạn', 'cả nhà', 'gia đình', 'đi cùng công ty', 'họp lớp', 'liên hoan', 'tụ tập'],
    tra_loi: 'Đi đông thì gọi combo là vừa tiết kiệm vừa đủ món nè 🍱 Bạn nhớ **đặt bàn trước** để mình giữ chỗ rộng rãi nha:||Tụ tập đông vui thì tham khảo mấy set này nha. Từ khoảng 15 người bạn đặt tiệc để được báo giá trọn gói ạ 🎉',
    lien_ket: 'Đặt bàn|/dat-ban;Đặt tiệc|/dat-tiec', goi_y: 'Đặt bàn có cần cọc không?',
  },
  {
    ma: 'hen_ho', ten: 'Hẹn hò / kỷ niệm', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'SASHIMI COMBO|SUSHI COMBO',
    tu_khoa: ['đi date', 'hẹn hò lần đầu', 'crush', 'tỏ tình', 'làm hòa', 'dỗ người yêu', 'xin lỗi bạn gái', 'ngày cưới', 'hẹn hò', 'người yêu', 'bạn gái', 'bạn trai', 'kỷ niệm', 'valentine', 'cầu hôn', 'lãng mạn', 'đi với vợ', 'đi với chồng'],
    tra_loi: 'Hẹn hò thì phải có không gian xịn nè 💕 Bạn có thể đặt **phòng VIP riêng tư**, ghi chú để quán chuẩn bị bàn đẹp. Set này rất hợp đi hai người:||Buổi hẹn mà có sushi, sashimi tươi là điểm cộng lớn đó 😉 Bạn đặt bàn trước để mình giữ chỗ đẹp nha:',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: 'Có phòng VIP không?',
  },
  {
    ma: 'voi_gap', ten: 'Vội / cần nhanh', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'RICE|NOODLE',
    tu_khoa: ['sắp trễ giờ', 'tranh thủ ăn', 'ăn lẹ', 'đang vội', 'gấp quá', 'cần nhanh', 'ít thời gian', 'nghỉ trưa', 'ăn nhanh', 'không có thời gian'],
    tra_loi: 'Vội thì mình gợi ý món làm nhanh, ăn gọn nè ⏱️ Bạn đặt online rồi ghé lấy hoặc để mình giao luôn nha:||Mấy món cơm, mì này lên nhanh, ăn gọn, hợp lúc vội nè bạn:',
    lien_ket: 'Đặt món|/menu', goi_y: 'Giao trong bao lâu?',
  },
  {
    ma: 'buon_chan', ten: 'Buồn / chán / mệt', uu_tien: 2, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['chán đời', 'mệt mỏi quá', 'áp lực công việc', 'bị sếp mắng', 'khóc quá', 'tâm trạng tệ', 'buồn quá', 'buồn ghê', 'chán quá', 'chán ghê', 'mệt quá', 'mệt ghê', 'mệt mỏi', 'stress', 'áp lực', 'tâm trạng', 'xui quá', 'thất tình'],
    tra_loi: 'Ôm bạn một cái nè 🤗 Ăn ngon là cách chữa lành nhanh nhất đó. Mình gửi bạn mấy món "an ủi" được yêu thích nhất nha:||Ngày mệt thì tự thưởng một bữa ngon thôi bạn ơi 🍣 Mấy món này nè:',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'cho_be', ten: 'Đi cùng trẻ nhỏ', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'TEMPURA|RICE|DESSERT',
    tu_khoa: ['con mình', 'cho bé ăn', 'đưa con đi ăn', 'cho bé', 'cho con', 'con nít', 'trẻ con', 'em bé', 'bé nhà mình', 'bé ăn'],
    tra_loi: 'Các bé thường mê mấy món chín, giòn, không cay này nè 👶 Quán có ghế em bé, bạn ghi chú khi đặt bàn nha:||Món cho bé đây ạ, đều chín và không cay 😊',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'luoi_ra_ngoai', ten: 'Lười ra ngoài → giao hàng', uu_tien: 3, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['không ra ngoài được', 'đang bận', 'kẹt ở nhà', 'không muốn đi đâu', 'lười ra ngoài', 'lười đi', 'ở nhà', 'không muốn ra đường', 'ngại đi', 'nằm nhà', 'làm biếng'],
    tra_loi: 'Ở nhà vẫn ăn ngon được nha, để mình **giao tận nơi** cho bạn 🛵 Đơn từ 500k còn miễn phí giao luôn. Gợi ý bạn mấy món này:||Lười ra đường thì để quán mang tới tận cửa nè 😆',
    lien_ket: 'Đặt món giao tận nơi|/menu', goi_y: 'Phí giao hàng bao nhiêu?',
  },
  {
    ma: 'lan_dau', ten: 'Lần đầu đến / chưa biết gọi gì', uu_tien: 3, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['chưa từng ăn', 'mới biết quán', 'lần đầu tới', 'không rành đồ nhật', 'lần đầu', 'chưa ăn bao giờ', 'chưa biết gọi gì', 'không biết gọi gì', 'không biết ăn gì', 'mới ăn đồ nhật', 'tư vấn món'],
    tra_loi: 'Lần đầu thì cứ thử mấy món "quốc dân" này là không lo sai nha 😉 Sashimi cá hồi, nigiri, cơm cuộn và một món nóng là đủ trải nghiệm:||Để mình làm hướng dẫn viên ẩm thực cho bạn nè 🍣 Mấy món này khách mới hay gọi nhất:',
    lien_ket: 'Xem thực đơn|/menu', goi_y: 'Có món cho người không ăn được đồ sống?',
  },
  // ---------------------------------------------------- bo sung
  {
    ma: 'them_hai_san', ten: 'Thèm hải sản', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'SASHIMI|OYSTER',
    tu_khoa: ['thèm hải sản', 'ăn hải sản', 'đồ biển', 'hải sản tươi', 'thèm tôm', 'thèm cua', 'thèm sò', 'thèm hàu'],
    tra_loi: 'Thèm hải sản thì tới đúng chỗ rồi nè 🦐 Hải sản quán nhập tươi mỗi ngày, bạn xem mấy món này nha:||Hải sản tươi rói đây bạn ơi 🦪 Ăn sống kiểu sashimi hay nướng đều ngon:',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_sushi', ten: 'Thèm sushi', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'NIGIRI|MAKI|RICE ROLL|GUNKAN',
    tu_khoa: ['thèm sushi', 'ăn sushi', 'muốn ăn sushi', 'cơm cuộn', 'thèm nigiri'],
    tra_loi: 'Sushi đây bạn ơi 🍣 Nigiri, maki, cơm cuộn đều do đầu bếp cuốn tại chỗ nè:||Thèm sushi thì thử mấy món này nha, khách khen nhiều lắm 😋',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_sashimi', ten: 'Thèm sashimi / đồ sống', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'SASHIMI',
    tu_khoa: ['thèm sashimi', 'ăn sashimi', 'thèm đồ sống', 'ăn gỏi cá', 'cá sống'],
    tra_loi: 'Sashimi tươi lạnh, ngọt thịt là đặc sản của quán nè 🐟 Bạn xem nha:||Team đồ sống đây rồi 😆 Mấy món sashimi này đang được gọi nhiều:',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_bo', ten: 'Thèm thịt bò', uu_tien: 4, hanh_dong: 'ten', tham_so: 'bò|beef|wagyu|aukobe',
    tu_khoa: ['thèm thịt bò', 'thèm bò', 'ăn bò', 'thịt bò', 'bò mỹ', 'thèm steak', 'beefsteak', 'bò wagyu'],
    tra_loi: 'Bò thì quán có mấy món đậm đà lắm nè 🥩 Áp chảo teppanyaki hay ăn với cơm, udon đều ngon:||Thèm bò thì thử ngay mấy món này nha bạn 🔥',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_ca_hoi', ten: 'Thèm cá hồi', uu_tien: 4, hanh_dong: 'ten', tham_so: 'cá hồi|salmon',
    tu_khoa: ['thèm cá hồi', 'ăn cá hồi', 'mê cá hồi', 'fan cá hồi'],
    tra_loi: 'Cá hồi Na Uy béo ngậy đây bạn ơi 🍣 Quán có đủ kiểu: sashimi, nigiri, cơm chiên, nướng…||Fan cá hồi thì không thể bỏ qua mấy món này nè 😍',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_nuong', ten: 'Thèm đồ nướng', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'GRILLED|TEPPAN',
    tu_khoa: ['thèm đồ nướng', 'ăn nướng', 'thèm nướng', 'bbq', 'nướng than', 'thèm teppanyaki', 'áp chảo'],
    tra_loi: 'Đồ nướng thơm lừng đây 🔥 Cá nướng teriyaki, bò áp chảo teppanyaki… bạn xem nha:||Thèm nướng thì thử mấy món này nè, nóng hổi thơm phức 😋',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_chien', ten: 'Thèm đồ chiên giòn', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'TEMPURA',
    tu_khoa: ['thèm đồ chiên', 'ăn đồ chiên', 'chiên giòn', 'thèm tempura', 'đồ giòn giòn'],
    tra_loi: 'Tempura giòn rụm đây bạn ơi 🍤 Bột mỏng, chiên tới đâu ra tới đó nè:||Thèm giòn thì thử mấy món tempura này nha 😋',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_mi', ten: 'Thèm mì / ramen', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'NOODLE',
    tu_khoa: ['thèm mì', 'ăn mì', 'thèm ramen', 'thèm udon', 'húp nước', 'tô mì nóng', 'ăn sợi'],
    tra_loi: 'Tô mì nóng hổi đây 🍜 Ramen, udon nước dùng hầm kỹ nè bạn:||Thèm húp nước thì mấy món mì này là chân ái luôn 😌',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_com', ten: 'Muốn ăn cơm / ăn no', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'RICE',
    tu_khoa: ['thèm cơm', 'ăn cơm', 'muốn ăn no', 'ăn cho no', 'ăn chắc bụng', 'cơm phần'],
    tra_loi: 'Muốn ăn no chắc bụng thì cơm Nhật là chuẩn nè 🍚 Bạn xem mấy món cơm này nha:||Mấy phần cơm này đầy đặn, ăn no lâu nè bạn 😋',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_lau', ten: 'Thèm lẩu', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'HOT POT',
    tu_khoa: ['thèm lẩu', 'ăn lẩu', 'nồi lẩu', 'lẩu nóng', 'nhúng lẩu'],
    tra_loi: 'Lẩu đây bạn ơi 🍲 Nồi lẩu nóng, nước dùng ngọt thanh, ăn đông vui là hết sảy:||Thèm lẩu thì thử mấy nồi này nha, đi đông càng vui 😆',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'an_vat', ten: 'Ăn vặt / nhâm nhi', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'APPERTIZER|GUNKAN',
    tu_khoa: ['ăn vặt', 'ăn chơi', 'nhâm nhi', 'đồ nhắm', 'ăn lai rai', 'món nhỏ nhỏ', 'gọi vài món nhẹ'],
    tra_loi: 'Nhâm nhi thì gọi vài món khai vị nhỏ xinh này là vừa nè 🥢:||Mấy món nhỏ này ăn chơi vui miệng lắm bạn 😋',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'nhau', ten: 'Nhậu / lai rai bia rượu', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'SAKE|BEER|GRILLED',
    tu_khoa: ['đi nhậu', 'rủ nhậu', 'lai rai', 'làm vài lon', 'uống bia', 'uống rượu', 'làm vài chai', 'cụng ly', 'zô zô', 'trăm phần trăm'],
    tra_loi: 'Lai rai thì phải có sake, bia lạnh và vài món nướng nhắm nè 🍶 Bạn xem nha:||Cụng ly thôi 🍻 Quán có sake Nhật, bia lạnh và đồ nhắm nướng ngon lắm:',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'giai_ruou', ten: 'Giải rượu / sau nhậu', uu_tien: 5, hanh_dong: 'nhom', tham_so: 'SOUP|NOODLE',
    tu_khoa: ['giải rượu', 'nhức đầu sau nhậu', 'say quá', 'hôm qua nhậu', 'xỉn quá', 'ói quá', 'mệt sau nhậu'],
    tra_loi: 'Sau bữa nhậu thì một tô súp nóng hay mì nước là cứu tinh nè 🍲 Bạn uống thêm nhiều nước nha:||Tô nóng nhẹ bụng giúp tỉnh táo lại nè bạn 😌',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'om_benh', ten: 'Ốm / cảm / không khỏe', uu_tien: 5, hanh_dong: 'nhom', tham_so: 'SOUP|HOT DISH|NOODLE',
    tu_khoa: ['bị ốm', 'bị cảm', 'cảm cúm', 'không khỏe', 'bị bệnh', 'sổ mũi', 'đau họng', 'mới ốm dậy', 'bị sốt'],
    tra_loi: 'Mau khỏe nha bạn 🤒 Lúc này ăn gì nóng, nhẹ bụng là tốt nhất, mình gợi ý mấy món này. Ngại ra ngoài thì để quán giao tận nơi nha:||Ốm thì ăn món nóng, dễ ăn cho mau lại sức nè bạn 💛',
    lien_ket: 'Đặt món giao tận nơi|/menu', goi_y: '',
  },
  {
    ma: 'nguoi_gia', ten: 'Đi cùng người lớn tuổi', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'SOUP|NOODLE|HOT POT|RICE',
    tu_khoa: ['ông bà', 'bố mẹ', 'ba mẹ', 'người lớn tuổi', 'người già', 'cụ ông', 'cụ bà', 'răng yếu', 'mời ba mẹ'],
    tra_loi: 'Đi cùng ông bà, bố mẹ thì nên chọn món chín, mềm, dễ ăn nè 👵 Bạn tham khảo mấy món này, nhớ ghi chú khi đặt bàn để quán sắp chỗ thoải mái nha:||Mấy món này mềm, nóng, hợp người lớn tuổi lắm bạn 😊',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'an_sang', ten: 'Ăn sáng', uu_tien: 3, hanh_dong: 'chi_tra_loi', tham_so: '',
    tu_khoa: ['ăn sáng', 'bữa sáng', 'điểm tâm', 'sáng nay ăn gì', 'sáng sớm'],
    tra_loi: 'Quán mở cửa **{gio_mo_cua}** nên chưa phục vụ bữa sáng sớm bạn nha 🌤️ Bạn ghé bữa trưa hoặc đặt món giao từ giờ mở cửa nhé!||Buổi sáng sớm quán chưa mở ạ, quán phục vụ **{gio_mo_cua}**. Trưa nay ghé ăn sushi không bạn? 😋',
    lien_ket: 'Xem thực đơn|/menu', goi_y: '',
  },
  {
    ma: 'an_trua', ten: 'Ăn trưa', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'RICE|NOODLE|SUSHI COMBO',
    tu_khoa: ['ăn trưa', 'bữa trưa', 'cơm trưa', 'trưa nay ăn gì', 'trưa ăn gì', 'giờ nghỉ trưa'],
    tra_loi: 'Bữa trưa gọn mà ngon thì mấy phần cơm, mì, set sushi này là vừa nè 🍱:||Trưa nay ăn món Nhật cho đổi gió nha bạn, mình gợi ý nè 😋',
    lien_ket: 'Đặt món|/menu', goi_y: '',
  },
  {
    ma: 'an_toi', ten: 'Ăn tối', uu_tien: 2, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['ăn tối', 'bữa tối', 'tối nay ăn gì', 'cơm tối', 'tối ăn gì'],
    tra_loi: 'Tối nay ăn món Nhật nha {ten_khach} 🌙 Mấy món này đang được gọi nhiều nhất. Bạn ghé quán hay để mình giao tận nơi?||Bữa tối ấm cúng với sushi, sashimi thì tuyệt luôn 😋 Gợi ý cho bạn nè:',
    lien_ket: 'Đặt bàn|/dat-ban;Đặt món|/menu', goi_y: '',
  },
  {
    ma: 'an_khuya', ten: 'Ăn khuya', uu_tien: 4, hanh_dong: 'chi_tra_loi', tham_so: '',
    tu_khoa: ['ăn khuya', 'đói đêm', 'nửa đêm', 'khuya rồi', 'đêm khuya', 'thức khuya'],
    tra_loi: 'Quán phục vụ tới **{gio_mo_cua}** nên khuya quá thì chưa giao được bạn ơi 🌙 Nếu còn trong giờ, bạn đặt món sớm để kịp bếp chuẩn bị nha!||Khuya quá quán đóng cửa mất rồi 😢 Quán mở **{gio_mo_cua}**, mai bạn ghé hoặc đặt sớm hơn nha!',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'tiep_khach', ten: 'Tiếp khách / đối tác', uu_tien: 5, hanh_dong: 'nhom', tham_so: 'SASHIMI COMBO|SUSHI COMBO|OYSTER',
    tu_khoa: ['tiếp khách', 'đối tác', 'tiếp đối tác', 'khách hàng công ty', 'bàn chuyện làm ăn', 'ký hợp đồng', 'đi với sếp', 'mời sếp'],
    tra_loi: 'Tiếp khách thì nên đặt **phòng VIP riêng tư** để nói chuyện thoải mái nè 🤝 Set sashimi, hàu Nhật là lựa chọn sang trọng, dễ chiều khách:||Bàn chuyện làm ăn thì không gian riêng là quan trọng nhất. Mình gợi ý phòng VIP và mấy set cao cấp này nha 🍶',
    lien_ket: 'Đặt phòng VIP|/dat-ban', goi_y: 'Có phòng VIP không?',
  },
  {
    ma: 'sinh_nhat', ten: 'Sinh nhật', uu_tien: 5, hanh_dong: 'nhom', tham_so: 'DESSERT|SASHIMI COMBO',
    tu_khoa: ['sinh nhật mình', 'hôm nay sinh nhật', 'mai sinh nhật', 'sinh nhật vợ', 'sinh nhật chồng', 'sinh nhật mẹ', 'sinh nhật bạn', 'sinh nhật con', 'mừng tuổi mới'],
    tra_loi: 'Chúc mừng sinh nhật 🎂🎉 Bạn ghi chú "sinh nhật" khi đặt bàn để quán chuẩn bị nến và lời chúc nha. Được mang bánh kem vào miễn phí luôn! Thành viên còn có ưu đãi tháng sinh nhật đó:||Happy birthday 🥳 Muốn tổ chức linh đình thì đặt tiệc, còn đi ít người thì đặt bàn và ghi chú sinh nhật nha:',
    lien_ket: 'Đặt bàn|/dat-ban;Đặt tiệc|/dat-tiec', goi_y: 'Ưu đãi sinh nhật',
  },
  {
    ma: 'an_mung', ten: 'Ăn mừng / tự thưởng', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'SASHIMI COMBO|OYSTER|TEPPAN',
    tu_khoa: ['ăn mừng', 'mới nhận lương', 'có lương rồi', 'được thưởng', 'tự thưởng', 'thăng chức', 'đậu đại học', 'thi đậu', 'chúc mừng'],
    tra_loi: 'Chúc mừng bạn nha 🎉 Dịp vui thì tự thưởng bữa thật xịn: set sashimi, hàu Nhật, bò áp chảo nè:||Xứng đáng được thưởng một bữa ngon lắm luôn 🥂 Mình gợi ý mấy món sang chảnh này:',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'mot_minh', ten: 'Đi ăn một mình', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'NIGIRI|RICE|NOODLE',
    tu_khoa: ['một mình', 'ăn một mình', 'đi một mình', 'mình ên', 'solo', 'ế quá'],
    tra_loi: 'Đi một mình thì ngồi **quầy sushi** vừa ăn vừa ngắm đầu bếp làm món là vui lắm nè 🍣 Mấy phần này vừa sức một người:||Một mình vẫn ăn ngon nha bạn 😉 Gợi ý mấy phần vừa đủ cho một người:',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'hai_nguoi', ten: 'Đi hai người', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'SASHIMI COMBO|SUSHI COMBO',
    tu_khoa: ['hai người', 'đi hai người', 'cặp đôi', 'đi với bạn thân', 'hai đứa'],
    tra_loi: 'Đi hai người thì gọi một set sashimi hoặc sushi là vừa đẹp, thêm một món nóng là no nê nè 🍱:||Set đôi này vừa xinh vừa đủ cho hai người nha bạn 😊',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'no_roi', ten: 'No rồi / ăn nhẹ', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'DESSERT|DRINK',
    tu_khoa: ['no quá', 'no rồi', 'ăn no rồi', 'no căng', 'ăn ít thôi', 'ăn nhẹ thôi', 'không đói lắm'],
    tra_loi: 'No rồi thì tráng miệng nhẹ nhàng hoặc ly nước mát cho tiêu là vừa nè 🍮:||Ăn nhẹ thôi thì mấy món này nè bạn, không lo đầy bụng 😊',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'chan_an', ten: 'Chán ăn / ngán', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'SASHIMI|SALAD',
    tu_khoa: ['chán ăn', 'ngán ăn', 'ăn không ngon miệng', 'ngán cơm nhà', 'ngán đồ dầu mỡ', 'đổi gió', 'đổi món', 'món lạ'],
    tra_loi: 'Ngán rồi thì đổi gió sang món Nhật thanh mát nha 🥗 Sashimi lạnh, salad chua nhẹ ăn rất "tỉnh" miệng:||Đổi món cho lạ miệng nè bạn, mấy món này thanh mát dễ ăn lắm 😋',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'an_chay_nay', ten: 'Hôm nay ăn chay', uu_tien: 5, hanh_dong: 'nhom', tham_so: 'SALAD',
    tu_khoa: ['hôm nay ăn chay', 'mình ăn chay', 'đang ăn chay', 'ngày rằm', 'mùng một', 'người ăn chay', 'ăn thuần chay'],
    tra_loi: 'Thực đơn quán chủ yếu là hải sản, nhưng vẫn có vài món hợp người ăn chay như **salad rong biển, maki dưa leo, trứng cuộn, tempura rau củ** 🥗. Bạn báo nhân viên để bếp làm riêng nước sốt chay nha:||Bạn ăn chay thì thử mấy món salad này và nhớ dặn nhân viên làm sốt chay nha 🙏',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'tap_gym', ten: 'Tập gym / tăng cơ', uu_tien: 4, hanh_dong: 'ten', tham_so: 'cá hồi|bò|salmon|beef|gà',
    tu_khoa: ['tập gym', 'tập thể hình', 'tăng cơ', 'nhiều protein', 'nhiều đạm', 'mới tập xong'],
    tra_loi: 'Tập xong cần nạp đạm thì cá hồi, bò là chuẩn bài nè 💪 Bạn xem mấy món giàu protein này:||Nạp protein sau buổi tập nha bạn 🏋️ Mấy món này nhiều đạm lắm:',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'keto', ten: 'Keto / kiêng tinh bột', uu_tien: 5, hanh_dong: 'nhom', tham_so: 'SASHIMI|SALAD|GRILLED',
    tu_khoa: ['keto', 'low carb', 'kiêng tinh bột', 'không ăn cơm', 'hạn chế tinh bột', 'ăn kiêng tinh bột'],
    tra_loi: 'Kiêng tinh bột thì sashimi, salad và món nướng là lựa chọn tuyệt vời nè 🥗 Bạn có thể dặn bếp không dùng cơm nha:||Mấy món này gần như không có tinh bột, hợp keto lắm bạn 💪',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'khong_an_ca', ten: 'Không ăn được cá', uu_tien: 5, hanh_dong: 'ten', tham_so: 'bò|gà|heo|beef|chicken|pork|trứng',
    tu_khoa: ['không ăn cá', 'không ăn được cá', 'sợ mùi cá', 'không thích cá', 'dị ứng cá', 'không ăn hải sản'],
    tra_loi: 'Không ăn cá thì quán vẫn có món thịt bò, gà, trứng ngon lắm nè 🥩 Bạn xem mấy món này và dặn nhân viên để bếp chú ý nha:||Không sao ạ, mấy món này không có cá nè bạn 😊',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'ngoi_lam_viec', ten: 'Ngồi làm việc / học bài', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'DRINK|DESSERT',
    tu_khoa: ['ngồi làm việc', 'mang laptop', 'họp online', 'ngồi học', 'học bài', 'làm việc ở quán', 'chạy deadline'],
    tra_loi: 'Quán có **wifi miễn phí** (mật khẩu: {wifi}) và không gian yên tĩnh, ngồi làm việc thoải mái nè 💻 Gọi ly nước, món ngọt nhâm nhi nha:||Ngồi chạy deadline thì mấy món này giúp tỉnh táo nè bạn ☕',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'song_ao', ten: 'Chụp ảnh / sống ảo', uu_tien: 3, hanh_dong: 'chi_tra_loi', tham_so: '',
    tu_khoa: ['sống ảo', 'chụp hình đẹp', 'chụp ảnh đẹp', 'check in', 'checkin', 'góc chụp', 'quay tiktok', 'lên hình'],
    tra_loi: 'Quán có nhiều góc lên hình xinh lắm nè 📸: quầy sushi gỗ, phòng VIP kiểu Nhật, đèn vàng ấm cúng. Bạn xem trước không gian ở nút bên dưới nha! Món ăn trình bày cũng rất "ăn ảnh" luôn 😉||Sống ảo thì quán chiều hết cỡ 📷 Bạn xem không gian quán nè:',
    lien_ket: 'Xem không gian|/khong-gian', goi_y: '',
  },
  {
    ma: 'com_van_phong', ten: 'Đặt cơm văn phòng / công ty', uu_tien: 4, hanh_dong: 'nhom', tham_so: 'RICE|SUSHI COMBO|SASHIMI COMBO',
    tu_khoa: ['cơm văn phòng', 'ship lên công ty', 'đặt cho cả phòng', 'gọi cho cả công ty', 'đặt đồ ăn công ty', 'giao lên văn phòng', 'liên hoan văn phòng'],
    tra_loi: 'Đặt cho văn phòng thì quán giao tận nơi, đơn từ **500k miễn phí giao** nè 🛵 Cơm phần và combo dễ chia, mình gợi ý:||Cả phòng cùng ăn thì mấy set này tiện chia lắm. Đặt số lượng lớn bạn gọi **{hotline}** để quán chuẩn bị kịp nha 📞',
    lien_ket: 'Đặt món|/menu', goi_y: 'Phí giao hàng bao nhiêu?',
  },
  {
    ma: 'luoi_nau', ten: 'Lười nấu ăn', uu_tien: 3, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['lười nấu', 'không muốn nấu', 'không ai nấu', 'nấu ăn mệt', 'khỏi nấu', 'vợ không nấu', 'chồng không nấu', 'hết đồ ăn'],
    tra_loi: 'Hôm nay cho bếp nhà nghỉ một bữa nha 😆 Để quán nấu và **giao tận nơi** cho bạn, mấy món này được gọi nhiều nhất nè:||Khỏi nấu nướng, để quán lo hết 🛵 Gợi ý cho bạn nè:',
    lien_ket: 'Đặt món giao tận nơi|/menu', goi_y: '',
  },
  {
    ma: 'tan_lam', ten: 'Tan làm / thư giãn', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'SAKE|BEER|HOT POT|GRILLED',
    tu_khoa: ['tan làm', 'tan ca', 'đi làm về', 'sau giờ làm', 'cuối ngày', 'xả stress', 'thư giãn'],
    tra_loi: 'Tan làm rồi thì ghé quán thư giãn với chút sake, nồi lẩu nóng hay món nướng nha 🍶:||Một ngày dài rồi, tự thưởng bữa tối ngon nè bạn 😌',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'cuoi_tuan', ten: 'Cuối tuần / rảnh rỗi', uu_tien: 2, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['cuối tuần', 'được nghỉ', 'rảnh rỗi', 'đi chơi', 'ngày nghỉ', 'chủ nhật này', 'thứ bảy này'],
    tra_loi: 'Cuối tuần rảnh thì rủ cả nhà, hội bạn đi ăn món Nhật nha 🎉 Cuối tuần quán đông, bạn **đặt bàn trước** cho chắc chỗ nè:||Ngày nghỉ mà đi ăn sushi là hết ý 😋 Gợi ý mấy món được yêu thích nè:',
    lien_ket: 'Đặt bàn|/dat-ban', goi_y: '',
  },
  {
    ma: 'khach_nuoc_ngoai', ten: 'Khách nước ngoài / du lịch', uu_tien: 3, hanh_dong: 'ban_chay', tham_so: '',
    tu_khoa: ['khách nước ngoài', 'người nước ngoài', 'du lịch', 'khách du lịch', 'tourist', 'bạn tây', 'đi công tác'],
    tra_loi: 'Website có tiếng **English / 日本語** (nút ngôn ngữ trên đầu trang), nhân viên cũng hỗ trợ khách quốc tế nha 🌏 Mấy món "đinh" này giới thiệu cho khách rất hợp:||Dẫn bạn nước ngoài đi ăn thì gọi mấy món đặc trưng này là ghi điểm nè 🇯🇵',
    lien_ket: 'Xem thực đơn|/menu', goi_y: '',
  },
  {
    ma: 'buon_ngu', ten: 'Buồn ngủ / cần tỉnh táo', uu_tien: 3, hanh_dong: 'nhom', tham_so: 'DRINK',
    tu_khoa: ['buồn ngủ', 'cần tỉnh táo', 'ngáp quá', 'thiếu ngủ', 'mắt díp'],
    tra_loi: 'Buồn ngủ thì làm ly trà xanh, matcha cho tỉnh táo nè ☕:||Uống chút gì cho tỉnh nha bạn 😴 Mấy món uống này nè:',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'them_tra', ten: 'Thèm trà / matcha', uu_tien: 4, hanh_dong: 'ten', tham_so: 'trà|matcha|tea',
    tu_khoa: ['thèm trà', 'uống trà', 'thèm matcha', 'trà xanh', 'trà đào', 'trà sữa'],
    tra_loi: 'Trà và matcha đây bạn ơi 🍵 Thanh mát, đúng vị Nhật nè:||Mấy món trà này được khách gọi nhiều lắm nè 😋',
    lien_ket: '', goi_y: '',
  },
  {
    ma: 'dan_nguoi_yeu_ve_ra_mat', ten: 'Ra mắt gia đình', uu_tien: 5, hanh_dong: 'nhom', tham_so: 'SASHIMI COMBO|HOT POT',
    tu_khoa: ['ra mắt', 'ra mắt gia đình', 'gặp bố mẹ người yêu', 'gặp gia đình bạn gái', 'hai bên gia đình', 'dạm ngõ'],
    tra_loi: 'Buổi ra mắt quan trọng thì nên đặt **phòng VIP riêng tư** để hai bên trò chuyện thoải mái nha 💐 Lẩu và set sashimi ăn chung rất gắn kết:||Chúc buổi ra mắt suôn sẻ nha bạn 🥰 Mình gợi ý phòng riêng và mấy món dùng chung này:',
    lien_ket: 'Đặt phòng VIP|/dat-ban', goi_y: 'Có phòng VIP không?',
  },
];

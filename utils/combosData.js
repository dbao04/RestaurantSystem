const DANH_SACH_COMBOS = [
    // ---------------------- 1 - 2 KHÁCH ----------------------
    {
      id: 'combo_2k_henho',
      tenKey: 'dat_ban_moi.combo_2k_henho_ten',
      nguoiKey: 'dat_ban_moi.combo_2k_henho_nguoi',
      moTaKey: 'dat_ban_moi.combo_2k_henho_mota',
      tenVi: 'Combo Hẹn Hò Lãng Mạn (2 người)',
      nguoiVi: 'Dành cho 1 - 2 người',
      moTaVi: '1 Salad bơ + 1 Sashimi Set A (259k) + 1 Combo Sushi Set 1 (139k) + 2 Trà xanh Nhật.',
      minKhach: 1,
      maxKhach: 2,
      monList: [
        { id_mon: 126, name_mon: 'SA07-SALAD BƠ', gia_mon: 99000, soluong: 1 },
        { id_mon: 161, name_mon: 'SETA-SASHIMI SET A', gia_mon: 259000, soluong: 1 },
        { id_mon: 205, name_mon: 'SET1-COMBO SUSHI SET 1', gia_mon: 139000, soluong: 1 },
        { id_mon: 85, name_mon: '05-TRÀ XANH NHẬT', gia_mon: 18000, soluong: 2 }
      ]
    },
    {
      id: 'combo_2k_sashimi',
      tenKey: 'dat_ban_moi.combo_2k_sashimi_ten',
      nguoiKey: 'dat_ban_moi.combo_2k_sashimi_nguoi',
      moTaKey: 'dat_ban_moi.combo_2k_sashimi_mota',
      tenVi: 'Combo Tinh Hoa Sashimi (2 người)',
      nguoiVi: 'Dành cho 1 - 2 người',
      moTaVi: '1 Salad rong nho + 1 Sashimi Set B (249k) + 1 Cuộn cá hồi nướng + 1 Lẩu Nấm Cá Hồi.',
      minKhach: 1,
      maxKhach: 2,
      monList: [
        { id_mon: 109, name_mon: 'A06-RONG NHO', gia_mon: 32000, soluong: 1 },
        { id_mon: 162, name_mon: 'SETB-SASHIMI SET B', gia_mon: 249000, soluong: 1 },
        { id_mon: 229, name_mon: 'R09-CUỘN CÁ HỒI NƯỚNG', gia_mon: 139000, soluong: 1 },
        { id_mon: 293, name_mon: 'H01-LẨU NẤM CÁ HỒI', gia_mon: 245000, soluong: 1 }
      ]
    },
    {
      id: 'combo_2k_bbq',
      tenKey: 'dat_ban_moi.combo_2k_bbq_ten',
      nguoiKey: 'dat_ban_moi.combo_2k_bbq_nguoi',
      moTaKey: 'dat_ban_moi.combo_2k_bbq_mota',
      tenVi: 'Combo Nướng & Teppan Nhật Bản (2 người)',
      nguoiVi: 'Dành cho 1 - 2 người',
      moTaVi: '1 Salad Rong Nho + 1 Bò Aukobe Steak + 1 Gà Karaage + 1 Cơm Lươn Nhật + 2 Panna Cotta dâu.',
      minKhach: 1,
      maxKhach: 2,
      monList: [
        { id_mon: 109, name_mon: 'A06-RONG NHO', gia_mon: 32000, soluong: 1 },
        { id_mon: 267, name_mon: 'E05-BÒ AUKOBE STEAK', gia_mon: 159000, soluong: 1 },
        { id_mon: 321, name_mon: 'T09-GÀ CHIÊN KARAAGE', gia_mon: 95000, soluong: 1 },
        { id_mon: 304, name_mon: 'K03-CƠM LƯƠN NHẬT', gia_mon: 169000, soluong: 1 },
        { id_mon: 326, name_mon: 'DE05-PANNA COTTA DÂU', gia_mon: 25000, soluong: 2 }
      ]
    },
    {
      id: 'combo_2k_sushi_udon',
      tenKey: 'dat_ban_moi.combo_2k_sushi_udon_ten',
      nguoiKey: 'dat_ban_moi.combo_2k_sushi_udon_nguoi',
      moTaKey: 'dat_ban_moi.combo_2k_sushi_udon_mota',
      tenVi: 'Combo Sushi & Mì Udon Truyền Thống (2 người)',
      nguoiVi: 'Dành cho 1 - 2 người',
      moTaVi: '1 Salad Bơ + 1 Combo Sushi Set 2 + 1 Udon Bò Mỹ + 1 Trứng Cuộn Mentaiko + 2 Kem Matcha.',
      minKhach: 1,
      maxKhach: 2,
      monList: [
        { id_mon: 126, name_mon: 'SA07-SALAD BƠ', gia_mon: 99000, soluong: 1 },
        { id_mon: 206, name_mon: 'SET2-COMBO SUSHI SET 2', gia_mon: 199000, soluong: 1 },
        { id_mon: 289, name_mon: 'U02-UDON BÒ MỸ', gia_mon: 129000, soluong: 1 },
        { id_mon: 271, name_mon: 'D02-TRỨNG CUỘN MENTAIKO', gia_mon: 49000, soluong: 1 },
        { id_mon: 322, name_mon: 'DE01-KEM MATCHA', gia_mon: 45000, soluong: 2 }
      ]
    },

    // ---------------------- 3 - 4 KHÁCH ----------------------
    {
      id: 'combo_4k_giadinh',
      tenKey: 'dat_ban_moi.combo_4k_giadinh_ten',
      nguoiKey: 'dat_ban_moi.combo_4k_giadinh_nguoi',
      moTaKey: 'dat_ban_moi.combo_4k_giadinh_mota',
      tenVi: 'Combo Sum Họp Gia Đình (3 - 4 người)',
      nguoiVi: 'Dành cho 3 - 4 người',
      moTaVi: '1 Salad hải sản + 1 Sashimi Set D (489k) + 1 Combo Sushi Set 2 (199k) + 1 Lẩu Sukiyaki (259k).',
      minKhach: 3,
      maxKhach: 4,
      monList: [
        { id_mon: 124, name_mon: 'SA05-SALAD HẢI SẢN', gia_mon: 159000, soluong: 1 },
        { id_mon: 164, name_mon: 'SETD-SASHIMI SET D', gia_mon: 489000, soluong: 1 },
        { id_mon: 206, name_mon: 'SET2-COMBO SUSHI SET 2', gia_mon: 199000, soluong: 1 },
        { id_mon: 297, name_mon: 'H05-LẨU SUKIYAKI', gia_mon: 259000, soluong: 1 }
      ]
    },
    {
      id: 'combo_4k_bbq',
      tenKey: 'dat_ban_moi.combo_4k_bbq_ten',
      nguoiKey: 'dat_ban_moi.combo_4k_bbq_nguoi',
      moTaKey: 'dat_ban_moi.combo_4k_bbq_mota',
      tenVi: 'Combo Thưởng Thức Nướng & Sushi (3 - 4 người)',
      nguoiVi: 'Dành cho 3 - 4 người',
      moTaVi: '1 Bò Aukobe Steak + 1 Combo Hàu Hyogo + 1 Combo Sushi Set 3 + 1 Lẩu Nabe Hải Sản.',
      minKhach: 3,
      maxKhach: 4,
      monList: [
        { id_mon: 267, name_mon: 'E05-BÒ AUKOBE STEAK', gia_mon: 159000, soluong: 1 },
        { id_mon: 127, name_mon: 'SH01-COMBO HÀU HYOGO', gia_mon: 199000, soluong: 1 },
        { id_mon: 207, name_mon: 'SET3-COMBO SUSHI SET 3', gia_mon: 299000, soluong: 1 },
        { id_mon: 298, name_mon: 'H06-LẨU NABE HẢI SẢN', gia_mon: 249000, soluong: 1 }
      ]
    },
    {
      id: 'combo_4k_lau_sashimi',
      tenKey: 'dat_ban_moi.combo_4k_lau_sashimi_ten',
      nguoiKey: 'dat_ban_moi.combo_4k_lau_sashimi_nguoi',
      moTaKey: 'dat_ban_moi.combo_4k_lau_sashimi_mota',
      tenVi: 'Combo Lẩu Nấm & Sashimi Tươi (3 - 4 người)',
      nguoiVi: 'Dành cho 3 - 4 người',
      moTaVi: '1 Salad Cua Lột + 1 Sashimi Set C + 1 Lẩu Nấm Cá Mú + 1 Tempura Tôm + 1 Bò cuộn nấm kim châm.',
      minKhach: 3,
      maxKhach: 4,
      monList: [
        { id_mon: 120, name_mon: 'SA01-SALAD CUA LỘT', gia_mon: 189000, soluong: 1 },
        { id_mon: 163, name_mon: 'SETC-SASHIMI SET C', gia_mon: 249000, soluong: 1 },
        { id_mon: 295, name_mon: 'H03-LẨU NẤM CÁ MÚ', gia_mon: 279000, soluong: 1 },
        { id_mon: 315, name_mon: 'T01-TEMPURA TÔM', gia_mon: 109000, soluong: 1 },
        { id_mon: 272, name_mon: 'D03-BÒ CUỘN NẤM KIM CHÂM', gia_mon: 79000, soluong: 1 }
      ]
    },
    {
      id: 'combo_4k_gourmet',
      tenKey: 'dat_ban_moi.combo_4k_gourmet_ten',
      nguoiKey: 'dat_ban_moi.combo_4k_gourmet_nguoi',
      moTaKey: 'dat_ban_moi.combo_4k_gourmet_mota',
      tenVi: 'Combo Hải Sản & Yakiniku Cao Cấp (3 - 4 người)',
      nguoiVi: 'Dành cho 3 - 4 người',
      moTaVi: '1 Sashimi Sò Điệp + 1 Bò Aukobe Áp Chảo + 1 Cá Hồi sốt Teriyaki + 1 Cơm chiên cua + 1 Lẩu Kim Chi Hải Sản.',
      minKhach: 3,
      maxKhach: 4,
      monList: [
        { id_mon: 159, name_mon: 'S28-SASHIMI SÒ ĐIỆP', gia_mon: 299000, soluong: 1 },
        { id_mon: 263, name_mon: 'E01-BÒ AUKOBE ÁP CHẢO', gia_mon: 159000, soluong: 1 },
        { id_mon: 264, name_mon: 'E02-CÁ HỒI SỐT TERIYAKI', gia_mon: 159000, soluong: 1 },
        { id_mon: 305, name_mon: 'K04-CƠM CHIÊN CUA', gia_mon: 145000, soluong: 1 },
        { id_mon: 296, name_mon: 'H04-LẨU KIM CHI HẢI SẢN', gia_mon: 199000, soluong: 1 }
      ]
    },

    // ---------------------- 5 - 6 KHÁCH ----------------------
    {
      id: 'combo_6k_tiec',
      tenKey: 'dat_ban_moi.combo_6k_tiec_ten',
      nguoiKey: 'dat_ban_moi.combo_6k_tiec_nguoi',
      moTaKey: 'dat_ban_moi.combo_6k_tiec_mota',
      tenVi: 'Combo Tiệc Bạn Bè & Đồng Nghiệp (5 - 6 người)',
      nguoiVi: 'Dành cho 5 - 6 người',
      moTaVi: '1 Salad bò Mỹ + 1 Sashimi Set G Đại Tiệc (799k) + 1 Combo Sushi Set 4 (399k) + 1 Lẩu Kim Chi Hải Sản + 1 Bò Áp Chảo.',
      minKhach: 5,
      maxKhach: 6,
      monList: [
        { id_mon: 125, name_mon: 'SA06-SALAD BÒ MỸ XÀO VÀ TRỨNG ONSEN', gia_mon: 119000, soluong: 1 },
        { id_mon: 167, name_mon: 'SETG-SASHIMI SET G', gia_mon: 799000, soluong: 1 },
        { id_mon: 208, name_mon: 'SET4-COMBO SUSHI SET 4', gia_mon: 399000, soluong: 1 },
        { id_mon: 296, name_mon: 'H04-LẨU KIM CHI HẢI SẢN', gia_mon: 199000, soluong: 1 },
        { id_mon: 263, name_mon: 'E01-BÒ AUKOBE ÁP CHẢO', gia_mon: 159000, soluong: 1 }
      ]
    },
    {
      id: 'combo_6k_haisan',
      tenKey: 'dat_ban_moi.combo_6k_haisan_ten',
      nguoiKey: 'dat_ban_moi.combo_6k_haisan_nguoi',
      moTaKey: 'dat_ban_moi.combo_6k_haisan_mota',
      tenVi: 'Combo Đại Dương Hải Sản Tươi Sống (5 - 6 người)',
      nguoiVi: 'Dành cho 5 - 6 người',
      moTaVi: '1 Salad Cua Lột + 1 Sashimi Set F (459k) + 1 Combo Hàu Hyogo + 1 Lẩu Nấm Cá Cam (299k) + 1 Sò điệp Mentaiko + 1 Cơm chiên hải sản.',
      minKhach: 5,
      maxKhach: 6,
      monList: [
        { id_mon: 120, name_mon: 'SA01-SALAD CUA LỘT', gia_mon: 189000, soluong: 1 },
        { id_mon: 166, name_mon: 'SETF-SASHIMI SET F', gia_mon: 459000, soluong: 1 },
        { id_mon: 127, name_mon: 'SH01-COMBO HÀU HYOGO', gia_mon: 199000, soluong: 1 },
        { id_mon: 294, name_mon: 'H02-LẨU NẤM CÁ CAM', gia_mon: 299000, soluong: 1 },
        { id_mon: 256, name_mon: 'B18-SÒ ĐIỆP NƯỚNG SỐT MENTAIKO', gia_mon: 129000, soluong: 1 },
        { id_mon: 307, name_mon: 'K06-CƠM CHIÊN HẢI SẢN', gia_mon: 119000, soluong: 1 }
      ]
    },
    {
      id: 'combo_6k_amthuc',
      tenKey: 'dat_ban_moi.combo_6k_amthuc_ten',
      nguoiKey: 'dat_ban_moi.combo_6k_amthuc_nguoi',
      moTaKey: 'dat_ban_moi.combo_6k_amthuc_mota',
      tenVi: 'Combo Tinh Hoa Ẩm Thực Tokyo (5 - 6 người)',
      nguoiVi: 'Dành cho 5 - 6 người',
      moTaVi: '1 Sashimi Set E + 1 Combo Sushi Set 3 + 2 Bò Aukobe Steak + 1 Lẩu Sukiyaki + 1 Tempura Thập Cẩm + 1 Gà Karaage.',
      minKhach: 5,
      maxKhach: 6,
      monList: [
        { id_mon: 165, name_mon: 'SETE-SASHIMI SET E', gia_mon: 429000, soluong: 1 },
        { id_mon: 207, name_mon: 'SET3-COMBO SUSHI SET 3', gia_mon: 299000, soluong: 1 },
        { id_mon: 267, name_mon: 'E05-BÒ AUKOBE STEAK', gia_mon: 159000, soluong: 2 },
        { id_mon: 297, name_mon: 'H05-LẨU SUKIYAKI', gia_mon: 259000, soluong: 1 },
        { id_mon: 316, name_mon: 'T02-TEMPURA THẬP CẨM', gia_mon: 99000, soluong: 1 },
        { id_mon: 321, name_mon: 'T09-GÀ CHIÊN KARAAGE', gia_mon: 95000, soluong: 1 }
      ]
    },

    // ---------------------- 7 - 9 KHÁCH ----------------------
    {
      id: 'combo_8k_hoangia',
      tenKey: 'dat_ban_moi.combo_8k_hoangia_ten',
      nguoiKey: 'dat_ban_moi.combo_8k_hoangia_nguoi',
      moTaKey: 'dat_ban_moi.combo_8k_hoangia_mota',
      tenVi: 'Combo Đại Tiệc Hoàng Gia (7 - 9 người)',
      nguoiVi: 'Dành cho 7 - 9 người',
      moTaVi: '1 Sashimi Set H Premium (899k) + 2 Combo Sushi Set 3 + 1 Lẩu Nấm Cá Hồi + 1 Lẩu Sukiyaki + 2 Bò Aukobe Steak + Khai vị.',
      minKhach: 7,
      maxKhach: 9,
      monList: [
        { id_mon: 168, name_mon: 'SETH-SASHIMI SET H PREMIUM', gia_mon: 899000, soluong: 1 },
        { id_mon: 207, name_mon: 'SET3-COMBO SUSHI SET 3', gia_mon: 299000, soluong: 2 },
        { id_mon: 293, name_mon: 'H01-LẨU NẤM CÁ HỒI', gia_mon: 245000, soluong: 1 },
        { id_mon: 297, name_mon: 'H05-LẨU SUKIYAKI', gia_mon: 259000, soluong: 1 },
        { id_mon: 267, name_mon: 'E05-BÒ AUKOBE STEAK', gia_mon: 159000, soluong: 2 },
        { id_mon: 120, name_mon: 'SA01-SALAD CUA LỘT', gia_mon: 189000, soluong: 1 }
      ]
    },
    {
      id: 'combo_8k_samurai',
      tenKey: 'dat_ban_moi.combo_8k_samurai_ten',
      nguoiKey: 'dat_ban_moi.combo_8k_samurai_nguoi',
      moTaKey: 'dat_ban_moi.combo_8k_samurai_mota',
      tenVi: 'Combo Yến Tiệc Samurai Thượng Hạng (7 - 9 người)',
      nguoiVi: 'Dành cho 7 - 9 người',
      moTaVi: '1 Sashimi Set G (799k) + 2 Combo Sushi Set 4 + 2 Lẩu Nabe Hải Sản + 2 Mực Teriyaki + 2 Hàu nướng Phô Mai + 2 Cơm chiên cua.',
      minKhach: 7,
      maxKhach: 9,
      monList: [
        { id_mon: 167, name_mon: 'SETG-SASHIMI SET G', gia_mon: 799000, soluong: 1 },
        { id_mon: 208, name_mon: 'SET4-COMBO SUSHI SET 4', gia_mon: 399000, soluong: 2 },
        { id_mon: 298, name_mon: 'H06-LẨU NABE HẢI SẢN', gia_mon: 249000, soluong: 2 },
        { id_mon: 266, name_mon: 'E04-MỰC SỐT TERIYAKI', gia_mon: 199000, soluong: 2 },
        { id_mon: 253, name_mon: 'B15-HÀU NƯỚNG PHÔ MAI', gia_mon: 159000, soluong: 2 },
        { id_mon: 305, name_mon: 'K04-CƠM CHIÊN CUA', gia_mon: 145000, soluong: 2 }
      ]
    },
    {
      id: 'combo_8k_lau_nuong',
      tenKey: 'dat_ban_moi.combo_8k_lau_nuong_ten',
      nguoiKey: 'dat_ban_moi.combo_8k_lau_nuong_nguoi',
      moTaKey: 'dat_ban_moi.combo_8k_lau_nuong_mota',
      tenVi: 'Combo Đại Tiệc Lẩu Nướng Tổng Hợp (7 - 9 người)',
      nguoiVi: 'Dành cho 7 - 9 người',
      moTaVi: '2 Salad Hải Sản + 1 Sashimi Set F + 3 Bò Aukobe Steak + 2 Lẩu Nấm Cá Mú + 2 Cuộn bơ phủ lươn + 1 Tempura Tôm.',
      minKhach: 7,
      maxKhach: 9,
      monList: [
        { id_mon: 124, name_mon: 'SA05-SALAD HẢI SẢN', gia_mon: 159000, soluong: 2 },
        { id_mon: 166, name_mon: 'SETF-SASHIMI SET F', gia_mon: 459000, soluong: 1 },
        { id_mon: 267, name_mon: 'E05-BÒ AUKOBE STEAK', gia_mon: 159000, soluong: 3 },
        { id_mon: 295, name_mon: 'H03-LẨU NẤM CÁ MÚ', gia_mon: 279000, soluong: 2 },
        { id_mon: 224, name_mon: 'R03-CUỘN BƠ PHỦ LƯƠN NHẬT', gia_mon: 199000, soluong: 2 },
        { id_mon: 315, name_mon: 'T01-TEMPURA TÔM', gia_mon: 109000, soluong: 1 }
      ]
    },

    // ---------------------- 10 - 15+ KHÁCH ----------------------
    {
      id: 'combo_10k_daichieu',
      tenKey: 'dat_ban_moi.combo_10k_daichieu_ten',
      nguoiKey: 'dat_ban_moi.combo_10k_daichieu_nguoi',
      moTaKey: 'dat_ban_moi.combo_10k_daichieu_mota',
      tenVi: 'Combo Đại Tiệc Thịnh Soạn (10 - 15+ người)',
      nguoiVi: 'Dành cho 10 - 15+ người',
      moTaVi: '1 Sashimi Set H Premium (899k) + 2 Combo Sushi Set 4 (399k) + 2 Lẩu Nấm Cá Cam + 2 Bò Aukobe Steak + 2 Salad Cua Lột + 2 Combo Hàu Hyogo.',
      minKhach: 10,
      maxKhach: 99,
      monList: [
        { id_mon: 168, name_mon: 'SETH-SASHIMI SET H PREMIUM', gia_mon: 899000, soluong: 1 },
        { id_mon: 208, name_mon: 'SET4-COMBO SUSHI SET 4', gia_mon: 399000, soluong: 2 },
        { id_mon: 294, name_mon: 'H02-LẨU NẤM CÁ CAM', gia_mon: 299000, soluong: 2 },
        { id_mon: 267, name_mon: 'E05-BÒ AUKOBE STEAK', gia_mon: 159000, soluong: 2 },
        { id_mon: 120, name_mon: 'SA01-SALAD CUA LỘT', gia_mon: 189000, soluong: 2 },
        { id_mon: 127, name_mon: 'SH01-COMBO HÀU HYOGO', gia_mon: 199000, soluong: 2 }
      ]
    },
    {
      id: 'combo_10k_tonghop',
      tenKey: 'dat_ban_moi.combo_10k_tonghop_ten',
      nguoiKey: 'dat_ban_moi.combo_10k_tonghop_nguoi',
      moTaKey: 'dat_ban_moi.combo_10k_tonghop_mota',
      tenVi: 'Combo Yến Tiệc Đỉnh Cao Nhật Bản (10 - 15+ người)',
      nguoiVi: 'Dành cho 10 - 15+ người',
      moTaVi: '2 Sashimi Set G + 3 Combo Sushi Set 3 + 2 Lẩu Sukiyaki + 2 Lẩu Nấm Cá Mú + 3 Bò Aukobe Áp Chảo + 3 Cơm chiên hải sản + 2 Salad Bò Mỹ.',
      minKhach: 10,
      maxKhach: 99,
      monList: [
        { id_mon: 167, name_mon: 'SETG-SASHIMI SET G', gia_mon: 799000, soluong: 2 },
        { id_mon: 207, name_mon: 'SET3-COMBO SUSHI SET 3', gia_mon: 299000, soluong: 3 },
        { id_mon: 297, name_mon: 'H05-LẨU SUKIYAKI', gia_mon: 259000, soluong: 2 },
        { id_mon: 295, name_mon: 'H03-LẨU NẤM CÁ MÚ', gia_mon: 279000, soluong: 2 },
        { id_mon: 263, name_mon: 'E01-BÒ AUKOBE ÁP CHẢO', gia_mon: 159000, soluong: 3 },
        { id_mon: 307, name_mon: 'K06-CƠM CHIÊN HẢI SẢN', gia_mon: 119000, soluong: 3 },
        { id_mon: 125, name_mon: 'SA06-SALAD BÒ MỸ XÀO VÀ TRỨNG ONSEN', gia_mon: 119000, soluong: 2 }
      ]
    },
    {
      id: 'combo_10k_haisan_vip',
      tenKey: 'dat_ban_moi.combo_10k_haisan_vip_ten',
      nguoiKey: 'dat_ban_moi.combo_10k_haisan_vip_nguoi',
      moTaKey: 'dat_ban_moi.combo_10k_haisan_vip_mota',
      tenVi: 'Combo Siêu Tiệc Hải Sản Hoàng Gia (10 - 15+ người)',
      nguoiVi: 'Dành cho 10 - 15+ người',
      moTaVi: '2 Sashimi Set H Premium + 2 Combo Sushi Tataki + 3 Lẩu Nabe Hải Sản + 3 Combo Hàu Hyogo + 3 Cá hồi sốt Táo Steak + 3 Salad Hải Sản.',
      minKhach: 10,
      maxKhach: 99,
      monList: [
        { id_mon: 168, name_mon: 'SETH-SASHIMI SET H PREMIUM', gia_mon: 899000, soluong: 2 },
        { id_mon: 204, name_mon: 'COMBO SUSHI PREMIUM TATAKI', gia_mon: 229000, soluong: 2 },
        { id_mon: 298, name_mon: 'H06-LẨU NABE HẢI SẢN', gia_mon: 249000, soluong: 3 },
        { id_mon: 127, name_mon: 'SH01-COMBO HÀU HYOGO', gia_mon: 199000, soluong: 3 },
        { id_mon: 265, name_mon: 'E03-CÁ HỒI SỐT TÁO STEAK', gia_mon: 159000, soluong: 3 },
        { id_mon: 124, name_mon: 'SA05-SALAD HẢI SẢN', gia_mon: 159000, soluong: 3 }
      ]
    }
  ];

module.exports = DANH_SACH_COMBOS;

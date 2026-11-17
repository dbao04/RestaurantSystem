// Script generate file manual-testing-checklist.html siêu chi tiết cho người mới
const fs = require('fs');
const path = require('path');

const testCases = [
  // ==========================================
  // LUỒNG LIÊN HOÀN END-TO-END (CHO NGƯỜI MỚI)
  // ==========================================
  {
    id: "E2E-01",
    sec: "E2E",
    secName: "Luồng Liên Hoàn",
    role: "Lễ tân -> Phục vụ -> Bếp -> Thu ngân",
    url: "/staff/login",
    name: "Luồng Ăn tại chỗ: Mở bàn -> Gọi món -> Bếp nấu -> Thu ngân thanh toán",
    steps: `<b>1. Đăng nhập Phục vụ:</b> Mở tab 1 vào <code>http://localhost:3000/staff/login</code>, nhập user <code>phucvu</code>, pass <code>123456</code>.<br>
<b>2. Mở bàn & Gọi món:</b> Vào menu <b>Sơ đồ bàn & Gọi món</b> (<code>/so-do-ban</code>). Bấm vào <b>Bàn 1 (Sảnh chính)</b> (đang màu xanh trống). Chọn 2 khách -> Bấm <b>Mở bàn & Gọi món ngay</b>. Tìm và chọn món <code>BÒ WAGYU NƯỚNG ĐÁ</code> (SL: 1) và <code>NƯỚC ÉP CAM</code> (SL: 2) -> Bấm nút xanh <b>GỬI BẾP CHẾ BIẾN</b>.<br>
<b>3. Bếp nhận đơn & chế biến:</b> Mở tab 2 vào <code>http://localhost:3000/staff/login</code> đăng nhập <code>beptruong</code> / <code>123456</code> -> Vào <b>Màn hình Bếp (KDS)</b> (<code>/kds</code>). Thấy thẻ Bàn 1 xuất hiện món vừa gọi -> Bấm <b>Bắt đầu nấu</b> (thẻ chuyển sang màu vàng) -> Sau đó bấm <b>Đã xong</b> (chuyển sang màu xanh lá).<br>
<b>4. Thu ngân xuất hóa đơn:</b> Mở tab 3 đăng nhập <code>thungan</code> / <code>123456</code> -> Vào <b>Thu ngân POS</b> (<code>/staff/thanh-toan</code>). Thấy Bàn 1 có tiền tạm tính -> Bấm vào Bàn 1 -> Chọn hình thức <b>Tiền mặt</b> -> Nhập khách đưa <code>500000</code> -> Bấm <b>Xác nhận thanh toán & In hóa đơn</b>.<br>
<b>5. Kiểm tra hoàn tất:</b> Quay lại tab Phục vụ ở <code>/so-do-ban</code>, thấy Bàn 1 đã trở lại màu xanh trống sẵn sàng đón khách mới.`,
    data: "Tài khoản: phucvu, beptruong, thungan (pass: 123456). Bàn chọn: Bàn 1. Món: Bò Wagyu (1), Nước ép cam (2).",
    expected: "Toàn bộ luồng xuyên suốt từ lúc khách ngồi đến khi thanh toán diễn ra mượt mà, realtime không cần F5 tải lại trang. Bàn tự động đóng và giải phóng trạng thái.",
    status: "PENDING",
    note: ""
  },
  {
    id: "E2E-02",
    sec: "E2E",
    secName: "Luồng Liên Hoàn",
    role: "Khách hàng -> Lễ tân",
    url: "/dat-ban",
    name: "Luồng Đặt bàn trước Online: Khách book -> Lễ tân duyệt & Gán bàn",
    steps: `<b>1. Khách đặt bàn trên Website:</b> Mở trình duyệt ẩn danh vào <code>http://localhost:3000/dat-ban</code>.<br>
- Bước 1: Chọn ngày (chọn ngày mai), giờ (chọn 19:00), số khách (chọn 4 người).<br>
- Bước 2: Chọn khu vực (Sảnh chính), bấm chọn 1 bàn còn trống.<br>
- Bước 3: Điền thông tin: Tên <code>Nguyễn Văn Test</code>, SĐT <code>0912345678</code>, Ghi chú <code>Ngồi gần cửa sổ</code>.<br>
- Bước 4: Bấm <b>Xác nhận đặt bàn</b>. Hệ thống sinh mã đặt bàn dạng <code>RSV-xxxxxx</code>.<br>
<b>2. Khách tra cứu đơn:</b> Vào <code>/dat-ban/tra-cuu</code>, nhập SĐT <code>0912345678</code> -> Thấy đơn vừa đặt hiển thị đúng thông tin.<br>
<b>3. Lễ tân kiểm tra & tiếp đón:</b> Mở tab khác đăng nhập <code>letan</code> / <code>123456</code> vào <code>/staff/bookings</code>. Thấy đơn của khách Nguyễn Văn Test ở dòng đầu tiên -> Bấm nút <b>Gán bàn / Khách đến</b> để kích hoạt bàn phục vụ.`,
    data: "Tên: Nguyễn Văn Test | SĐT: 0912345678 | Giờ: 19:00 | Khách: 4 người.",
    expected: "Khách đặt bàn thành công có mã tra cứu. Lễ tân thấy đơn tức thì trên danh sách /staff/bookings và thực hiện gán bàn đón khách chuẩn xác.",
    status: "PENDING",
    note: ""
  },
  {
    id: "E2E-03",
    sec: "E2E",
    secName: "Luồng Liên Hoàn",
    role: "Khách -> Điều phối -> Shipper",
    url: "/menu",
    name: "Luồng Đặt món giao tận nơi: Khách đặt -> Điều phối gán Shipper -> Giao hàng",
    steps: `<b>1. Khách chọn món giao tận nơi:</b> Mở <code>http://localhost:3000/menu</code>, bấm <b>Thêm vào giỏ</b> 2 món bất kỳ.<br>
- Mở Giỏ hàng (<code>/cart</code>) -> Bấm <b>Đặt giao hàng tận nơi</b> (<code>/giao-hang</code>).<br>
- Nhập thông tin: Họ tên <code>Khách Nhận Ship</code>, SĐT <code>0988776655</code>, Địa chỉ <code>123 Nguyễn Huệ, Quận 1, TP.HCM</code>.<br>
- Bấm <b>Xác nhận đặt đơn</b> -> Hệ thống chuyển sang trang theo dõi đơn (<code>/theo-doi/...</code>).<br>
<b>2. Điều phối giao việc:</b> Mở tab mới đăng nhập <code>dieuphoi</code> / <code>123456</code> vào <code>/staff/giao-hang</code>.<br>
- Tìm đơn hàng vừa tạo, chọn Shipper <code>shipper1</code> từ danh sách dropdown và bấm <b>Bàn giao đơn</b>.<br>
<b>3. Shipper thực hiện giao:</b> Mở tab khác đăng nhập <code>shipper1</code> / <code>123456</code> vào <code>/shipper/</code>.<br>
- Thấy đơn hàng được giao -> Lần lượt bấm: <b>Đã nhận món</b> -> <b>Đang đi giao</b> -> <b>Đã giao thành công</b>.<br>
<b>4. Kiểm tra khách hàng:</b> Quay lại trang theo dõi của khách, thấy tiến trình tự cập nhật sang 'Giao hàng thành công'.`,
    data: "Tên: Khách Nhận Ship | SĐT: 0988776655 | Địa chỉ: 123 Nguyễn Huệ, Q1. Shipper phụ trách: shipper1.",
    expected: "Đơn giao hàng luân chuyển nhịp nhàng giữa Khách hàng, Bộ phận Điều phối và Ứng dụng Shipper PWA.",
    status: "PENDING",
    note: ""
  },
  {
    id: "E2E-04",
    sec: "E2E",
    secName: "Luồng Liên Hoàn",
    role: "Nhân viên -> Thu ngân -> Quản lý",
    url: "/cham-cong-khuon-mat",
    name: "Luồng Vận hành: Điểm danh ca -> Phục vụ báo cáo -> Thu ngân chốt két",
    steps: `<b>1. Điểm danh đầu ca:</b> Mở màn hình Kiosk chấm công <code>http://localhost:3000/cham-cong-khuon-mat</code> hoặc mở <code>/cham-cong/</code> trên điện thoại. Kiểm tra camera nhận diện hoặc định vị GPS hợp lệ.<br>
<b>2. Phục vụ kết ca làm báo cáo:</b> Đăng nhập <code>phucvu</code> / <code>123456</code>, vào mục <b>Báo cáo ca phục vụ</b> (<code>/staff/phuc-vu/bao-cao</code>). Kiểm tra hệ thống tự thống kê số bàn đã phục vụ trong ngày, nhập phản hồi của khách -> Bấm <b>Gửi báo cáo ca</b>.<br>
<b>3. Thu ngân đếm két chốt ca:</b> Đăng nhập <code>thungan</code> / <code>123456</code>, vào <b>Chốt ca thu ngân</b> (<code>/staff/chot-ca</code>). Nhập số lượng các tờ tiền mặt thực tế trong két (ví dụ 10 tờ 500k, 10 tờ 200k...) -> Bấm <b>Lưu biên bản chốt ca</b>.<br>
<b>4. Quản lý kiểm tra & ký duyệt:</b> Đăng nhập <code>quanly</code> / <code>123456</code>, vào <code>/staff/dieu-hanh</code> và <code>/staff/chot-ca/lich-su</code> để xem biên bản chốt két và đối soát số liệu.`,
    data: "User test: phucvu, thungan, quanly (pass: 123456). Số tiền đếm két: 7.000.000đ.",
    expected: "Quy trình kết ca khép kín, minh bạch số liệu tài chính giữa người làm ca và người quản lý.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 1: KHÁCH HÀNG (CUSTOMER PORTAL)
  // ==========================================
  {
    id: "TC-CUST-01",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách vãng lai",
    url: "/",
    name: "Kiểm tra Trang chủ & Giao diện thương hiệu",
    steps: `1. Mở trình duyệt truy cập <code>http://localhost:3000/</code>.<br>
2. Kiểm tra logo 'Nhà Hàng Bảo Đoàn', banner giới thiệu món đặc sắc, hotline và chân trang (footer).<br>
3. Cuộn trang kiểm tra tốc độ tải hình ảnh các món ăn.`,
    data: "URL: http://localhost:3000/",
    expected: "Trang hiển thị đẹp mắt, không lỗi vỡ khung, font chữ sang trọng chuẩn phong cách nhà hàng cao cấp.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-02",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách vãng lai",
    url: "/",
    name: "Chuyển đổi Đa ngôn ngữ (Tiếng Việt / Anh / Nhật)",
    steps: `1. Trên thanh Header góc phải, bấm vào nút chọn ngôn ngữ (biểu tượng quả địa cầu hoặc lá cờ).<br>
2. Lần lượt chọn <b>English (EN)</b> -> Kiểm tra tiêu đề menu chuyển sang 'Home', 'Menu', 'Reservation'.<br>
3. Chọn tiếp <b>日本語 (JA)</b> -> Kiểm tra các nút bấm chuyển sang tiếng Nhật.<br>
4. Chọn lại <b>Tiếng Việt (VI)</b>.`,
    data: "Ngôn ngữ test: VI, EN, JA.",
    expected: "Toàn bộ giao diện chính, tên món ăn dịch chuẩn xác, không bị giật trang hay lỗi ký tự font.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-03",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách vãng lai",
    url: "/menu",
    name: "Xem Thực đơn & Lọc theo danh mục món",
    steps: `1. Bấm vào mục <b>Món ăn</b> trên menu chính (<code>/menu</code>).<br>
2. Lần lượt bấm vào các tab danh mục: <i>Món Khai Vị, Món Nướng, Hải Sản, Tráng Miệng, Thức Uống</i>.<br>
3. Quan sát danh sách món hiển thị bên dưới.`,
    data: "Tab danh mục: Khai vị, Món chính, Đồ uống.",
    expected: "Chỉ hiển thị các món thuộc đúng danh mục vừa bấm, có hình ảnh, giá niêm yết bằng VNĐ rõ ràng.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-04",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách vãng lai",
    url: "/menu",
    name: "Tìm kiếm món ăn theo từ khóa",
    steps: `1. Tại trang thực đơn <code>/menu</code>, tìm ô tìm kiếm có icon kính lúp.<br>
2. Gõ từ khóa <code>bò</code> và nhấn Enter.<br>
3. Kiểm tra danh sách kết quả trả về.<br>
4. Thử gõ một từ không có như <code>xyz999</code>.`,
    data: "Từ khóa: 'bò', 'lẩu', 'xyz999'.",
    expected: "Tìm 'bò' trả về các món Bò Wagyu, Bò Nướng... Tìm 'xyz999' báo 'Không tìm thấy món ăn phù hợp'.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-05",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách vãng lai",
    url: "/detail?monid=85",
    name: "Chi tiết món ăn & Bảng cảnh báo dị ứng",
    steps: `1. Bấm vào ảnh hoặc tên của một món ăn bất kỳ để vào trang chi tiết (ví dụ món ID 85).<br>
2. Đọc mô tả thành phần nguyên liệu, mức giá, thời gian chế biến dự kiến.<br>
3. Kiểm tra mục <b>Cảnh báo dị ứng</b> (hải sản, đậu phộng, gluten...).`,
    data: "Món test: ID 85 hoặc bất kỳ món nào trên thực đơn.",
    expected: "Hiển thị đầy đủ thông số món, hình ảnh phóng to rõ nét và nhãn cảnh báo an toàn thực phẩm.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-06",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách vãng lai",
    url: "/combos",
    name: "Thực đơn Combo tiệc ưu đãi",
    steps: `1. Trên thanh menu bấm vào <b>Combo Thực Đơn</b> (<code>/combos</code>).<br>
2. Xem danh sách các gói combo: Combo Cặp Đôi, Combo Gia Đình, Combo Tiệc Công Ty.<br>
3. Xem danh sách chi tiết các món cấu thành và số tiền tiết kiệm được so với gọi lẻ.`,
    data: "URL: /combos",
    expected: "Hiển thị giá gốc gạch ngang, giá combo ưu đãi và nút 'Chọn Combo này'.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-07",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách mới",
    url: "/register",
    name: "Đăng ký tài khoản thành viên mới",
    steps: `1. Mở trang Đăng ký (<code>/register</code>).<br>
2. Nhập các trường: Họ tên: <code>Trần Kiểm Thử</code>, Số điện thoại: <code>0901${Math.floor(100000 + Math.random() * 900000)}</code>, Mật khẩu: <code>123456</code>.<br>
3. Bấm nút <b>Đăng ký tài khoản</b>.`,
    data: "SĐT ngẫu nhiên 10 số, pass: 123456.",
    expected: "Hệ thống thông báo đăng ký thành công và tự động chuyển về trang Đăng nhập.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-08",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách hàng",
    url: "/login",
    name: "Đăng nhập tài khoản khách hàng",
    steps: `1. Mở trang Đăng nhập <code>/login</code>.<br>
2. Nhập SĐT <code>0388062048</code>, mật khẩu <code>123456</code> (hoặc tài khoản vừa đăng ký ở TC-CUST-07).<br>
3. Bấm <b>Đăng nhập</b>.<br>
4. Quan sát thanh Header góc phải sau khi đăng nhập.`,
    data: "SĐT: 0388062048 | Pass: 123456",
    expected: "Đăng nhập thành công, góc phải hiển thị Tên khách hàng kèm số điểm tích lũy thành viên.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-09",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách hàng",
    url: "/cart",
    name: "Quản lý Giỏ hàng (Tăng/giảm số lượng, Xóa món)",
    steps: `1. Vào <code>/menu</code> bấm <b>Thêm vào giỏ</b> 2 món khác nhau.<br>
2. Bấm vào icon Giỏ hàng trên thanh Header để vào <code>/cart</code>.<br>
3. Bấm nút <b>+</b> để tăng số lượng món lên 3, bấm nút <b>-</b> để giảm.<br>
4. Bấm icon thùng rác để xóa thử 1 món khỏi giỏ hàng.`,
    data: "Giỏ hàng: Món A (SL 2), Món B (SL 1).",
    expected: "Tổng tiền tạm tính tự động tính lại ngay lập tức khi thay đổi số lượng. Xóa món thành công.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-10",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách hàng",
    url: "/dat-ban",
    name: "Quy trình Đặt bàn 4 bước trực quan trên Web",
    steps: `1. Vào <code>/dat-ban</code>.<br>
2. Bước 1: Chọn ngày dùng bữa, khung giờ (ví dụ 18:30), số lượng khách (2 người).<br>
3. Bước 2: Xem sơ đồ khu vực bàn, bấm chọn 1 bàn còn trống.<br>
4. Bước 3: Điền tên, số điện thoại, ghi chú.<br>
5. Bước 4: Bấm <b>Hoàn tất đặt bàn</b> -> Nhận mã đặt bàn.`,
    data: "Ngày: hôm nay/ngày mai | Giờ: 18:30 | Khách: 2.",
    expected: "Quy trình 4 bước mượt mà, trực quan, có bản đồ vị trí bàn và sinh mã đặt bàn chuẩn xác.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-11",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách hàng",
    url: "/dat-ban/tra-cuu",
    name: "Tra cứu & Hủy lịch đặt bàn tự phục vụ",
    steps: `1. Mở trang Tra cứu (<code>/dat-ban/tra-cuu</code>).<br>
2. Nhập số điện thoại đã đặt bàn và mã đặt bàn.<br>
3. Bấm <b>Tra cứu thông tin</b>.<br>
4. Thử bấm nút <b>Hủy đặt bàn</b> nếu khách bận không đến được.`,
    data: "Nhập SĐT và mã RSV đã tạo ở TC-CUST-10.",
    expected: "Hiển thị đầy đủ thông tin đặt bàn. Khi bấm Hủy bàn thì trạng thái chuyển sang 'Đã hủy'.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-12",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách hàng",
    url: "/thanh-toan/dat-ban/",
    name: "Thanh toán tiền cọc giữ bàn bằng VietQR",
    steps: `1. Mở trang thanh toán cọc đơn đặt bàn (<code>/thanh-toan/dat-ban/:ma_dat</code>).<br>
2. Kiểm tra mã QR ngân hàng hiển thị trên màn hình.<br>
3. Kiểm tra số tiền cọc (ví dụ 100.000đ) và cú pháp nội dung chuyển khoản tự động điền sẵn.<br>
4. (Môi trường test) Bấm nút <b>Xác nhận giả lập đã chuyển khoản</b> để kiểm tra luồng tự duyệt.`,
    data: "Tiền cọc: 100.000đ | Cổng: VietQR động.",
    expected: "Mã VietQR quét được bằng app ngân hàng thật. Hệ thống ghi nhận tiền cọc và đổi trạng thái đơn sang 'Đã cọc'.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-13",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách hàng",
    url: "/my-orders",
    name: "Xem Lịch sử đơn hàng cá nhân",
    steps: `1. Đăng nhập tài khoản khách hàng, bấm vào tên tài khoản trên header chọn <b>Đơn của tôi</b> (<code>/my-orders</code>).<br>
2. Xem 2 tab: <b>Lịch sử Đặt bàn</b> và <b>Lịch sử Giao hàng</b>.<br>
3. Bấm vào một đơn để xem lại chi tiết các món đã gọi.`,
    data: "Tài khoản khách hàng đã có lịch sử đơn.",
    expected: "Liệt kê rõ ràng ngày giờ, mã đơn, danh sách món, tổng tiền và trạng thái (Đã thanh toán / Đang xử lý).",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-14",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách vãng lai",
    url: "/",
    name: "Hỏi đáp tự động với Trợ lý ảo Chatbot AI",
    steps: `1. Bấm vào biểu tượng bong bóng Chatbot AI tròn ở góc dưới bên phải màn hình.<br>
2. Cửa sổ chat mở ra, gõ câu hỏi: <code>Nhà hàng mở cửa mấy giờ?</code> rồi bấm nút Gửi.<br>
3. Gõ tiếp: <code>Quán có món nướng nào ngon không?</code>.<br>
4. Bấm vào các câu hỏi gợi ý nhanh có sẵn trên khung chat.`,
    data: "Câu hỏi: Giờ mở cửa, món ngon, cách đặt bàn.",
    expected: "Chatbot AI phản hồi tức thì thông minh, gợi ý chính xác món ăn và hướng dẫn đặt bàn.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-CUST-15",
    sec: "CUST",
    secName: "Khách hàng",
    role: "Khách hàng",
    url: "/rate",
    name: "Gửi Đánh giá chất lượng dịch vụ (Feedback)",
    steps: `1. Truy cập trang Đánh giá (<code>/rate</code>).<br>
2. Chọn số sao đánh giá (ví dụ 5 sao ⭐⭐⭐⭐⭐).<br>
3. Nhập họ tên, email/SĐT và nội dung nhận xét: <code>Món bò nướng rất ngon, phục vụ nhanh chu đáo!</code>.<br>
4. Bấm <b>Gửi đánh giá</b>.`,
    data: "Đánh giá: 5 sao, nội dung khen ngợi dịch vụ.",
    expected: "Hệ thống hiển thị popup cảm ơn và lưu đánh giá vào cơ sở dữ liệu quản trị.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 2: LỄ TÂN & PHỤC VỤ (FOH & SERVICE)
  // ==========================================
  {
    id: "TC-FOH-01",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Lễ tân (letan)",
    url: "/staff/login",
    name: "Đăng nhập Cổng Nhân viên Phục vụ / Lễ tân",
    steps: `1. Mở trang <code>http://localhost:3000/staff/login</code>.<br>
2. Nhập tên đăng nhập <code>letan</code> (hoặc <code>phucvu</code>), mật khẩu <code>123456</code>.<br>
3. Bấm nút <b>Đăng nhập</b>.<br>
4. Kiểm tra thanh menu bên trái hiển thị đúng các chức năng của Lễ tân / Phục vụ.`,
    data: "User: letan hoặc phucvu | Pass: 123456.",
    expected: "Đăng nhập thành công, hiển thị đúng vai trò 'Nhân viên lễ tân' hoặc 'Nhân viên phục vụ'.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-02",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/so-do-ban",
    name: "Sơ đồ 40 bàn ăn trực quan theo 4 khu vực",
    steps: `1. Bấm vào menu <b>Sơ đồ bàn & Gọi món</b> (<code>/so-do-ban</code>).<br>
2. Kiểm tra sơ đồ chia thành 4 khu vực: <b>Sảnh chính, Tầng lửng, Sân vườn, Phòng VIP</b>.<br>
3. Quan sát màu sắc các bàn: Bàn xanh lá (Trống), Bàn đỏ/cam (Đang có khách), Bàn vàng (Đã đặt trước).`,
    data: "URL: /so-do-ban",
    expected: "Hiển thị đủ 40 bàn, bố cục rõ ràng, trực quan, có số bàn và số ghế cụ thể.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-03",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/so-do-ban",
    name: "Thao tác Mở bàn & Đón khách tại chỗ",
    steps: `1. Tại trang <code>/so-do-ban</code>, tìm một bàn đang màu Xanh (ví dụ Bàn S02).<br>
2. Bấm chuột vào bàn đó -> Popup thông tin bàn mở ra.<br>
3. Chọn số lượng khách vào ngồi (ví dụ 3 khách) -> Bấm <b>Mở bàn</b>.`,
    data: "Chọn bàn trống bất kỳ (S02, S03...).",
    expected: "Bàn lập tức chuyển từ màu Xanh sang màu Đỏ (Đang có khách), thời gian ngồi bắt đầu được tính.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-04",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/so-do-ban",
    name: "Phục vụ Order gọi món trực tiếp vào bàn",
    steps: `1. Tại <code>/so-do-ban</code>, bấm vào một bàn đang có khách (màu đỏ).<br>
2. Bấm nút <b>Gọi thêm món cho bàn</b>.<br>
3. Modal thực đơn mở ra: Có thể gõ tìm tên món hoặc lọc theo loại.<br>
4. Bấm dấu <b>+</b> để chọn số lượng món (ví dụ 2 phần Lẩu Thái).<br>
5. Bấm nút xanh <b>GỬI BẾP CHẾ BIẾN</b>.`,
    data: "Món: 2 Lẩu Thái (hoặc bất kỳ món nào).",
    expected: "Món ăn được lưu vào bàn thành công, danh sách món của bàn cập nhật, KDS của bếp nhận tín hiệu realtime.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-05",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/staff/bookings",
    name: "Quản lý Đơn gọi món tại bàn & Đổi bàn",
    steps: `1. Vào menu <b>Đơn gọi món tại bàn</b> (<code>/staff/bookings</code>).<br>
2. Xem bảng danh sách các đơn: Các đơn mới tạo nằm trên cùng.<br>
3. Bấm vào nút <b>Gọi món</b> màu xanh để gọi thêm món nhanh cho khách.<br>
4. Bấm nút 3 chấm <b>⋮</b> chọn <b>Đổi bàn / Gán bàn</b> để chuyển khách sang bàn khác nếu khách yêu cầu.`,
    data: "URL: /staff/bookings",
    expected: "Bảng hiển thị logic, rõ ràng, sắp xếp mới nhất lên đầu, có đủ tính năng gọi món và chuyển bàn.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-06",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Lễ tân (letan)",
    url: "/staff/bookings/create",
    name: "Lễ tân Tạo đơn đặt bàn nhanh qua điện thoại",
    steps: `1. Vào <code>/staff/bookings</code>, bấm nút <b>Tạo đơn bàn mới</b> (<code>/staff/bookings/create</code>).<br>
2. Nhập: Tên khách <code>Anh Hoàng</code>, SĐT <code>0933112233</code>, Ngày đến (hôm nay), Giờ (19:00), Số khách <code>6</code>.<br>
3. Ghi chú: <code>Khách quen, bàn VIP</code>.<br>
4. Bấm <b>Lưu đặt bàn</b>.`,
    data: "Khách: Anh Hoàng | SĐT: 0933112233 | Số khách: 6.",
    expected: "Tạo đơn thành công, xuất hiện ngay lập tức trong bảng danh sách đơn đặt bàn.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-07",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Lễ tân (letan)",
    url: "/staff/dat-ban",
    name: "Trung tâm Đặt bàn Timeline & Kéo thả xếp bàn",
    steps: `1. Vào menu <b>Quản lý Đặt bàn</b> (<code>/staff/dat-ban</code>).<br>
2. Quan sát trục thời gian (Timeline) theo các khung giờ trưa/tối.<br>
3. Xem các bàn có khách đã đặt trước hiển thị dải màu trên dòng thời gian.<br>
4. Thử bấm vào một ô thời gian trống để gán khách vào bàn.`,
    data: "URL: /staff/dat-ban",
    expected: "Giao diện timeline hiện đại, trực quan, không bị trùng lịch giữa 2 lượt khách khác nhau.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-08",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Lễ tân (letan)",
    url: "/qr/table/1",
    name: "Mô phỏng Khách tự quét mã QR tại bàn để gọi món",
    steps: `1. Mở một tab mới truy cập <code>http://localhost:3000/qr/table/1</code> (giả lập khách ngồi Bàn 1 quét QR).<br>
2. Giao diện thực đơn thông minh trên điện thoại mở ra.<br>
3. Khách bấm chọn 1 món ăn và bấm <b>Gửi gọi món</b>.<br>
4. Quay lại màn hình nhân viên kiểm tra bàn 1 đã nhận món khách vừa tự gọi chưa.`,
    data: "Link test: /qr/table/1 hoặc /qr/table/2.",
    expected: "Khách tự gọi món tiện lợi không cần gọi phục vụ, đơn tự động đồng bộ vào Bàn 1 trong hệ thống.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-09",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Lễ tân (letan)",
    url: "/staff/qr-codes",
    name: "Quản lý & In bộ mã QR dán bàn",
    steps: `1. Vào mục <b>Mã QR bàn</b> (<code>/staff/qr-codes</code>).<br>
2. Kiểm tra danh sách 40 bàn kèm mã QR tương ứng.<br>
3. Bấm vào nút <b>In mã QR</b> hoặc <b>Tải ảnh QR</b> của một bàn.<br>
4. Dùng camera điện thoại quét thử mã QR trên màn hình xem có mở đúng link bàn không.`,
    data: "URL: /staff/qr-codes",
    expected: "Mã QR sắc nét, link quét chuẩn xác dẫn thẳng vào trang gọi món của đúng bàn đó.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-FOH-10",
    sec: "FOH",
    secName: "Lễ tân & Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/staff/bookings/print/69xust0j88qo9jbrh",
    name: "In Phiếu Tạm Tính cho khách kiểm tra trước",
    steps: `1. Tại trang <code>/staff/bookings</code>, tìm bàn đang dùng món.<br>
2. Bấm vào icon máy in 🖨️ ở cột Hành động.<br>
3. Cửa sổ in phiếu tạm tính mở ra. Kiểm tra: Tên nhà hàng, số bàn, danh sách món, đơn giá, tổng tiền.`,
    data: "Bấm nút máy in tại bất kỳ đơn nào.",
    expected: "Mở pop-up phiếu tạm tính chuẩn khổ giấy in bill nhiệt (K80), bố cục ngay ngắn, số tiền chính xác.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 3: BẾP & BAR (KITCHEN & KDS)
  // ==========================================
  {
    id: "TC-KIT-01",
    sec: "KITCHEN",
    secName: "Bếp & KDS",
    role: "Bếp trưởng (beptruong)",
    url: "/staff/login",
    name: "Đăng nhập Tài khoản Bếp trưởng / Đầu bếp",
    steps: `1. Vào <code>/staff/login</code>, nhập user <code>beptruong</code>, pass <code>123456</code>.<br>
2. Bấm Đăng nhập.<br>
3. Kiểm tra thanh menu bên trái chỉ hiển thị các mục liên quan đến Bếp: KDS, Công thức, Tồn kho, Chốt ca bếp.`,
    data: "User: beptruong | Pass: 123456.",
    expected: "Đăng nhập thành công, phân quyền nghiêm ngặt không hiển thị các chức năng thu ngân/lương của phòng khác.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-KIT-02",
    sec: "KITCHEN",
    secName: "Bếp & KDS",
    role: "Bếp trưởng (beptruong)",
    url: "/kds",
    name: "Màn hình KDS Bếp Realtime (Nhận đơn tức thì)",
    steps: `1. Bấm vào menu <b>Màn hình Bếp (KDS)</b> (<code>/kds</code>).<br>
2. Quan sát giao diện tối ưu cho màn hình cảm ứng bếp (nền tối, chữ lớn rõ nét).<br>
3. Nhờ người khác hoặc mở tab khác bấm gọi 1 món từ <code>/so-do-ban</code> -> Quan sát màn hình KDS có tự động nhảy thẻ món mới không cần F5 không.`,
    data: "URL: /kds",
    expected: "Món mới tự động xuất hiện trên màn hình KDS kèm chuông âm thanh thông báo qua kết nối Socket.io.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-KIT-03",
    sec: "KITCHEN",
    secName: "Bếp & KDS",
    role: "Bếp trưởng (beptruong)",
    url: "/kds",
    name: "Chuyển trạng thái: Chờ làm -> Đang nấu -> Hoàn tất món",
    steps: `1. Trên màn hình KDS, tìm thẻ món đang ở trạng thái <b>Chờ chế biến</b> (màu xám/xanh dương).<br>
2. Bấm nút <b>Bắt đầu nấu</b> -> Thẻ chuyển sang màu Vàng (Đang nấu), đồng hồ đếm thời gian bắt đầu chạy.<br>
3. Sau khi nấu xong, bấm nút <b>Đã hoàn tất / Xong</b> -> Thẻ chuyển sang màu Xanh lá.<br>
4. Phục vụ nhận thông báo món đã ra để đến bưng cho khách.`,
    data: "Thao tác trực tiếp trên các nút bấm thẻ KDS.",
    expected: "Trạng thái đổi màu mượt mà, thời gian nấu được ghi nhận chuẩn xác vào lịch sử chế biến.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-KIT-04",
    sec: "KITCHEN",
    secName: "Bếp & KDS",
    role: "Bếp trưởng (beptruong)",
    url: "/staff/kitchen/recipes",
    name: "Tra cứu Công thức & Định mức nguyên liệu món ăn",
    steps: `1. Bấm vào menu <b>Công thức món ăn</b> (<code>/staff/kitchen/recipes</code>).<br>
2. Tìm một món ăn (ví dụ Súp Bò Gân, Lẩu Nấm...).<br>
3. Bấm xem chi tiết: Kiểm tra định mức từng nguyên liệu cấu thành (gram thịt, ml sốt, gia vị...).`,
    data: "URL: /staff/kitchen/recipes",
    expected: "Hiển thị công thức chuẩn hóa, giúp đầu bếp nấu đúng vị và hệ thống tự động trừ kho nguyên liệu tương ứng.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-KIT-05",
    sec: "KITCHEN",
    secName: "Bếp & KDS",
    role: "Bếp trưởng (beptruong)",
    url: "/staff/kitchen/inventory",
    name: "Quản lý Tồn kho nguyên liệu bếp theo chuẩn FIFO",
    steps: `1. Vào menu <b>Tồn kho nguyên liệu</b> (<code>/staff/kitchen/inventory</code>).<br>
2. Xem danh sách các nguyên liệu: Thịt bò, tôm sú, nấm, dầu ăn...<br>
3. Kiểm tra các cột: Tồn kho hiện tại, Hạn sử dụng, Cảnh báo sắp hết (màu đỏ).<br>
4. Thử bấm nút <b>Nhập thêm nguyên liệu</b> hoặc điều chỉnh số lượng.`,
    data: "URL: /staff/kitchen/inventory",
    expected: "Hiển thị chính xác lượng tồn kho, tự động cảnh báo nguyên liệu sắp hết hạn theo quy tắc Nhập trước - Xuất trước (FIFO).",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-KIT-06",
    sec: "KITCHEN",
    secName: "Bếp & KDS",
    role: "Bếp trưởng (beptruong)",
    url: "/staff/kitchen/shift",
    name: "Biên bản Chốt ca trực Bếp & Bàn giao nguyên liệu",
    steps: `1. Cuối ca làm việc, vào menu <b>Chốt ca Bếp</b> (<code>/staff/kitchen/shift</code>).<br>
2. Kiểm tra số lượng món đã nấu trong ca được hệ thống tự đếm.<br>
3. Nhập số lượng thực phẩm tươi sống còn tồn thực tế trong tủ đông.<br>
4. Nhập ghi chú bàn giao cho ca sau -> Bấm <b>Lưu chốt ca Bếp</b>.`,
    data: "Ca test: Ca sáng hoặc Ca tối. Tồn kho thực tế.",
    expected: "Lưu biên bản bàn giao thành công, giúp bếp trưởng kiểm soát chặt chẽ hao hụt thực phẩm.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 4: THU NGÂN & POS (CASHIER & BILLING)
  // ==========================================
  {
    id: "TC-POS-01",
    sec: "POS",
    secName: "Thu ngân & POS",
    role: "Thu ngân (thungan)",
    url: "/staff/login",
    name: "Đăng nhập Cổng Thu ngân quầy POS",
    steps: `1. Mở trang <code>/staff/login</code>, nhập user <code>thungan</code>, pass <code>123456</code>.<br>
2. Bấm Đăng nhập.<br>
3. Kiểm tra thanh menu chỉ hiển thị nhóm chức năng: <b>Thu ngân POS</b> và <b>Chốt ca thu ngân</b>.`,
    data: "User: thungan | Pass: 123456.",
    expected: "Đăng nhập thành công vào đúng quyền hạn Thu ngân.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-POS-02",
    sec: "POS",
    secName: "Thu ngân & POS",
    role: "Thu ngân (thungan)",
    url: "/staff/thanh-toan",
    name: "Màn hình Thu ngân POS & Danh sách bàn chờ thanh toán",
    steps: `1. Bấm vào menu <b>Thu ngân POS</b> (<code>/staff/thanh-toan</code>).<br>
2. Xem danh sách các bàn đang mở có phát sinh tiền món.<br>
3. Bấm vào một bàn để mở giao diện tính tiền chi tiết.`,
    data: "URL: /staff/thanh-toan",
    expected: "Hiển thị chi tiết bảng bill: từng món ăn, số lượng, thành tiền, thuế VAT và tổng cộng.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-POS-03",
    sec: "POS",
    secName: "Thu ngân & POS",
    role: "Thu ngân (thungan)",
    url: "/staff/thanh-toan",
    name: "Áp dụng Mã giảm giá / Voucher khuyến mãi trên Bill",
    steps: `1. Tại màn hình tính tiền của bàn, tìm ô <b>Mã giảm giá (Voucher)</b>.<br>
2. Nhập mã khuyến mãi thử nghiệm (ví dụ <code>GIAM10</code> hoặc <code>VIP50K</code>) -> Bấm <b>Áp dụng</b>.<br>
3. Quan sát số tiền giảm giá và tổng tiền phải thu sau giảm.`,
    data: "Mã voucher hợp lệ.",
    expected: "Hệ thống tự động trừ tiền chiết khấu chính xác theo chính sách voucher.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-POS-04",
    sec: "POS",
    secName: "Thu ngân & POS",
    role: "Thu ngân (thungan)",
    url: "/staff/thanh-toan",
    name: "Thanh toán bằng Tiền mặt (Tự tính tiền thừa trả khách)",
    steps: `1. Chọn phương thức thanh toán: <b>Tiền mặt</b>.<br>
2. Giả sử tổng hóa đơn là <code>380.000đ</code>. Nhập ô 'Khách đưa': <code>500.000đ</code>.<br>
3. Kiểm tra ô 'Tiền thừa thối lại' có tự nhảy số <code>120.000đ</code> không.<br>
4. Bấm nút xanh <b>XÁC NHẬN THANH TOÁN</b>.`,
    data: "Tổng bill: 380k | Khách đưa: 500k | Tiền thừa: 120k.",
    expected: "Hệ thống tính tiền thừa chuẩn xác từng đồng, đóng bàn và cập nhật trạng thái đơn thành 'Đã thanh toán'.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-POS-05",
    sec: "POS",
    secName: "Thu ngân & POS",
    role: "Thu ngân (thungan)",
    url: "/staff/thanh-toan",
    name: "Thanh toán không dùng tiền mặt qua VietQR động",
    steps: `1. Tại hóa đơn thanh toán, chọn hình thức <b>VietQR / Chuyển khoản</b>.<br>
2. Kiểm tra mã QR động hiện lên màn hình.<br>
3. Kiểm tra số tiền trên QR có khớp 100% với số tiền bill không.<br>
4. Bấm xác nhận thanh toán thành công.`,
    data: "Phương thức: Chuyển khoản ngân hàng VietQR.",
    expected: "Sinh mã QR chuẩn Napas247, tự điền đúng số tiền và mã hóa đơn vào nội dung chuyển khoản.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-POS-06",
    sec: "POS",
    secName: "Thu ngân & POS",
    role: "Thu ngân (thungan)",
    url: "/staff/chot-ca",
    name: "Quy trình Kiểm két & Chốt ca thu ngân cuối ngày",
    steps: `1. Khi hết ca làm việc, bấm vào menu <b>Chốt ca thu ngân</b> (<code>/staff/chot-ca</code>).<br>
2. Màn hình đếm két mở ra: Nhập số tờ tiền các mệnh giá thực tế đang có trong ngăn kéo (tờ 500k, 200k, 100k, 50k...).<br>
3. Hệ thống tự cộng tổng tiền thực tế và đối chiếu với số tiền phần mềm đã ghi nhận.<br>
4. Kiểm tra phần chênh lệch (Thừa/Thiếu) -> Nhập lý do nếu có chênh lệch -> Bấm <b>Xác nhận nộp két & Chốt ca</b>.`,
    data: "Nhập số lượng các mệnh giá tiền mặt trong két.",
    expected: "Tạo biên bản chốt ca đầy đủ, lưu vết thời gian và chữ ký số của thu ngân chịu trách nhiệm.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 5: ĐIỀU PHỐI & SHIPPER (DELIVERY)
  // ==========================================
  {
    id: "TC-DEL-01",
    sec: "DELIVERY",
    secName: "Giao hàng",
    role: "Điều phối (dieuphoi)",
    url: "/staff/login",
    name: "Đăng nhập Bảng điều phối đơn giao hàng",
    steps: `1. Đăng nhập <code>/staff/login</code> tài khoản <code>dieuphoi</code>, pass <code>123456</code>.<br>
2. Vào menu <b>Điều phối giao hàng</b> (<code>/staff/giao-hang</code>).<br>
3. Xem danh sách các đơn giao tận nơi đang chờ xử lý.`,
    data: "User: dieuphoi | Pass: 123456.",
    expected: "Vào đúng cổng điều phối, hiển thị danh sách đơn khách đặt giao.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-DEL-02",
    sec: "DELIVERY",
    secName: "Giao hàng",
    role: "Điều phối (dieuphoi)",
    url: "/staff/giao-hang",
    name: "Bàn giao đơn hàng cho Shipper phụ trách",
    steps: `1. Trên một đơn hàng mới, bấm vào ô chọn Shipper.<br>
2. Chọn shipper đang rảnh (ví dụ <code>shipper1</code>).<br>
3. Bấm nút <b>Giao đơn cho Shipper</b>.`,
    data: "Chọn đơn mới -> Gán cho shipper1.",
    expected: "Đơn đổi trạng thái sang 'Đã bàn giao cho Shipper', app của Shipper nhận được thông báo đơn mới.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-DEL-03",
    sec: "DELIVERY",
    secName: "Giao hàng",
    role: "Điều phối (dieuphoi)",
    url: "/staff/giao-hang/ban-do",
    name: "Bản đồ số GPS theo dõi vị trí các Shipper",
    steps: `1. Vào mục <b>Bản đồ Shipper</b> (<code>/staff/giao-hang/ban-do</code>).<br>
2. Kiểm tra bản đồ Leaflet/OpenStreetMap hiển thị vị trí các shipper đang di chuyển.<br>
3. Bấm vào icon shipper trên bản đồ để xem tên và số điện thoại liên hệ.`,
    data: "URL: /staff/giao-hang/ban-do",
    expected: "Bản đồ số trực quan, định vị chính xác vị trí shipper trong khu vực hoạt động.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-DEL-04",
    sec: "DELIVERY",
    secName: "Giao hàng",
    role: "Shipper (shipper1)",
    url: "/shipper/",
    name: "Ứng dụng di động PWA cho Shipper giao hàng",
    steps: `1. Dùng điện thoại hoặc tab mới mở <code>http://localhost:3000/shipper/</code>.<br>
2. Đăng nhập <code>shipper1</code> / <code>123456</code>.<br>
3. Mở tab 'Đơn nhận': Thấy đơn hàng vừa được điều phối gán cho mình.<br>
4. Bấm <b>Đã nhận món từ bếp</b> -> Bấm <b>Đang đi giao</b> -> Bấm <b>Giao thành công</b> khi đã đưa đồ ăn cho khách.`,
    data: "User: shipper1 | Pass: 123456 | App PWA.",
    expected: "Giao diện PWA vuốt chạm cực nhẹ, cập nhật trạng thái đơn tức thì về tổng đài.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 6: QUẢN LÝ NHÂN SỰ & CHẤM CÔNG (HR)
  // ==========================================
  {
    id: "TC-HR-01",
    sec: "HR",
    secName: "Nhân sự & Chấm công",
    role: "Quản lý (quanly)",
    url: "/staff/login",
    name: "Đăng nhập Bảng điều hành Quản lý",
    steps: `1. Đăng nhập <code>/staff/login</code> tài khoản <code>quanly</code>, pass <code>123456</code>.<br>
2. Mở menu <b>Bảng điều hành</b> (<code>/staff/dieu-hanh</code>).<br>
3. Xem các chỉ số tổng quan hôm nay: Doanh thu thực tế, Số bàn đang có khách, Số đơn đang nấu.`,
    data: "User: quanly | Pass: 123456.",
    expected: "Dashboard quản trị trung tâm cập nhật dữ liệu liên tục theo thời gian thực.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-HR-02",
    sec: "HR",
    secName: "Nhân sự & Chấm công",
    role: "Quản lý (quanly)",
    url: "/to-chuc/quan-ly",
    name: "Sơ đồ cơ cấu tổ chức & Cây phân cấp nhân sự",
    steps: `1. Vào menu <b>Cơ cấu tổ chức</b> (<code>/to-chuc/quan-ly</code>).<br>
2. Quan sát sơ đồ cây 6 cấp bậc phân cấp toàn bộ 75 nhân sự theo từng khối phòng ban.<br>
3. Bấm vào một nhân viên để xem hồ sơ chức danh và cấp quản lý trực tiếp.`,
    data: "URL: /to-chuc/quan-ly",
    expected: "Sơ đồ cơ cấu hiển thị mạch lạc, chuẩn mô hình vận hành chuỗi F&B chuyên nghiệp.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-HR-03",
    sec: "HR",
    secName: "Nhân sự & Chấm công",
    role: "Nhân viên bất kỳ",
    url: "/cham-cong-khuon-mat",
    name: "Máy Kiosk Chấm công nhận diện Khuôn mặt AI",
    steps: `1. Mở màn hình Kiosk chấm công tại <code>http://localhost:3000/cham-cong-khuon-mat</code>.<br>
2. Cho phép trình duyệt truy cập Camera máy tính/Kiosk.<br>
3. Đứng trước camera: Thuật toán AI tự động phát hiện khuôn mặt và so sánh với vector mẫu.<br>
4. Kiểm tra thông báo: 'Điểm danh thành công: [Tên nhân viên] - Giờ vào ca: [hh:mm]'.`,
    data: "URL: /cham-cong-khuon-mat",
    expected: "Nhận diện khuôn mặt chuẩn xác dưới 1 giây, độ tin cậy AI cao, ghi nhận công tức thì.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-HR-04",
    sec: "HR",
    secName: "Nhân sự & Chấm công",
    role: "Nhân viên di động",
    url: "/cham-cong/",
    name: "Chấm công qua điện thoại bằng GPS Định vị vị trí",
    steps: `1. Mở <code>http://localhost:3000/cham-cong/</code> trên điện thoại.<br>
2. Cho phép ứng dụng lấy tọa độ GPS hiện tại.<br>
3. Nếu đứng trong bán kính cho phép của nhà hàng (ví dụ 50m) -> Bấm nút <b>Chấm công vào ca</b>.<br>
4. Nếu đứng xa nhà hàng -> Kiểm tra hệ thống có cảnh báo 'Bạn đang ở ngoài khu vực làm việc' không.`,
    data: "Tọa độ GPS nhà hàng, bán kính 50m.",
    expected: "Ngăn chặn gian lận chấm công hộ từ xa bằng hàng rào địa lý GPS Geo-fencing.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-HR-05",
    sec: "HR",
    secName: "Nhân sự & Chấm công",
    role: "Quản lý (quanly)",
    url: "/staff/cham-cong",
    name: "Xem Bảng điểm danh chấm công hàng ngày",
    steps: `1. Đăng nhập <code>quanly</code>, vào menu <b>Chấm công khuôn mặt</b> (<code>/staff/cham-cong</code>).<br>
2. Xem danh sách nhân viên đã điểm danh hôm nay: Giờ vào, giờ ra, số giờ làm thực tế.<br>
3. Kiểm tra danh sách những ai đi muộn hoặc vắng mặt chưa chấm công.`,
    data: "URL: /staff/cham-cong",
    expected: "Bảng điểm danh chi tiết, minh bạch, có bằng chứng ảnh chụp lúc nhận diện.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-HR-06",
    sec: "HR",
    secName: "Nhân sự & Chấm công",
    role: "Quản lý (quanly)",
    url: "/staff/leave",
    name: "Quy trình Phê duyệt đơn xin nghỉ phép của nhân viên",
    steps: `1. Đăng nhập <code>quanly</code>, vào menu <b>Xin nghỉ phép</b> (<code>/staff/leave</code>).<br>
2. Xem danh sách các đơn xin nghỉ phép gửi lên từ nhân viên kèm lý do.<br>
3. Bấm nút xanh <b>Phê duyệt</b> hoặc nút đỏ <b>Từ chối</b> kèm lý do phản hồi.`,
    data: "Duyệt đơn nghỉ phép.",
    expected: "Trạng thái đơn nghỉ phép được cập nhật, hệ thống tự động trừ/cộng ngày phép năm của nhân viên.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 7: BÁO CÁO CA PHỤC VỤ (SHIFT REPORT)
  // ==========================================
  {
    id: "TC-RPT-01",
    sec: "REPORT",
    secName: "Báo cáo Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/staff/phuc-vu/bao-cao",
    name: "Mở Form Báo cáo kết thúc ca phục vụ",
    steps: `1. Đăng nhập <code>phucvu</code> / <code>123456</code>.<br>
2. Trên thanh menu bên trái, bấm vào <b>Báo cáo ca phục vụ</b> (<code>/staff/phuc-vu/bao-cao</code>).<br>
3. Kiểm tra thông tin ca làm việc hiển thị tự động: Tên nhân viên, Ngày, Ca sáng/tối.`,
    data: "User: phucvu | Pass: 123456.",
    expected: "Trang mở nhanh chóng, nhận diện đúng nhân sự đăng nhập và phiên ca làm việc hiện tại.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-RPT-02",
    sec: "REPORT",
    secName: "Báo cáo Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/staff/phuc-vu/bao-cao",
    name: "Kiểm tra Tính năng Tự động gợi ý số liệu phục vụ",
    steps: `1. Tại form báo cáo, kiểm tra các ô số liệu thống kê tự động:<br>
- <i>Tổng số bàn đã phục vụ</i>.<br>
- <i>Tổng số món đã order cho khách</i>.<br>
- <i>Tổng số tiền khách thanh toán qua ca của mình</i>.<br>
2. Xác nhận nhân viên không cần phải cộng sổ tay thủ công.`,
    data: "Số liệu tự động thống kê từ DB.",
    expected: "Số liệu khớp 100% với lịch sử các lượt phục vụ bàn trong ca của nhân viên.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-RPT-03",
    sec: "REPORT",
    secName: "Báo cáo Phục vụ",
    role: "Phục vụ (phucvu)",
    url: "/staff/phuc-vu/bao-cao",
    name: "Điền nhận xét & Gửi báo cáo ca trực",
    steps: `1. Nhập ô phản hồi của khách: <code>Khách bàn 5 khen món bò nướng rất ngon, khách bàn 2 góp ý điều hòa hơi lạnh</code>.<br>
2. Nhập vấn đề tồn đọng cần bàn giao: <code>Bàn S06 cần bổ sung thêm menu giấy</code>.<br>
3. Bấm nút <b>GỬI BÁO CÁO CA TRỰC</b>.`,
    data: "Nội dung nhận xét và tồn đọng ca trực.",
    expected: "Báo cáo được lưu thành công vào CSDL với trạng thái 'Chờ Quản lý duyệt'.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-RPT-04",
    sec: "REPORT",
    secName: "Báo cáo Phục vụ",
    role: "Quản lý (quanly)",
    url: "/staff/phuc-vu/bao-cao/quan-ly",
    name: "Quản lý Xem xét & Ký duyệt Báo cáo ca phục vụ",
    steps: `1. Đăng nhập tài khoản <code>quanly</code> / <code>123456</code>.<br>
2. Mở danh sách các báo cáo ca phục vụ do nhân viên nộp.<br>
3. Bấm vào xem chi tiết báo cáo của nhân viên vừa nộp.<br>
4. Nhập nhận xét của quản lý: <code>Ca làm việc tốt, đã tiếp thu ý kiến điều hòa</code> -> Bấm <b>KÝ DUYỆT BÁO CÁO</b>.`,
    data: "Duyệt báo cáo ca của nhân viên phucvu.",
    expected: "Trạng thái báo cáo chuyển sang 'Đã duyệt', ghi nhận thành tích phục vụ vào hồ sơ thi đua.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 8: KẾ TOÁN & TÀI CHÍNH (ACCOUNTING)
  // ==========================================
  {
    id: "TC-ACC-01",
    sec: "ACCOUNT",
    secName: "Kế toán & Lương",
    role: "Kế toán trưởng (ketoantruong)",
    url: "/staff/login",
    name: "Đăng nhập Cổng Kế toán & Tài chính",
    steps: `1. Đăng nhập <code>/staff/login</code> tài khoản <code>ketoantruong</code>, pass <code>123456</code>.<br>
2. Bấm Đăng nhập.<br>
3. Kiểm tra thanh menu chỉ hiển thị nhóm: <b>Bảng lương</b>, <b>Báo cáo Thu chi</b>, <b>Đối soát chốt ca</b>.`,
    data: "User: ketoantruong | Pass: 123456.",
    expected: "Đăng nhập thành công vào phòng Tài chính - Kế toán.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ACC-02",
    sec: "ACCOUNT",
    secName: "Kế toán & Lương",
    role: "Kế toán (ketoantruong)",
    url: "/staff/accountant/salary",
    name: "Bảng tính lương tự động từ dữ liệu Chấm công AI",
    steps: `1. Vào menu <b>Bảng lương</b> (<code>/staff/accountant/salary</code>).<br>
2. Chọn tháng cần tính lương (tháng hiện tại).<br>
3. Xem bảng lương của 75 nhân viên: Lương cơ bản, Số giờ công thực tế, Tiền phụ cấp, Thưởng, Khấu trừ và Thực lĩnh.<br>
4. Thử bấm nút <b>Xuất bảng lương ra Excel</b>.`,
    data: "Tháng tính lương: Tháng gần nhất.",
    expected: "Lương được tự động tính toán chính xác theo công thức không sai lệch, xuất file Excel chuẩn định dạng.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ACC-03",
    sec: "ACCOUNT",
    secName: "Kế toán & Lương",
    role: "Kế toán (ketoantruong)",
    url: "/staff/thanh-toan/doi-soat",
    name: "Đối soát Dòng tiền Chốt ca của Thu ngân",
    steps: `1. Vào menu <b>Đối soát chốt ca</b> (<code>/staff/thanh-toan/doi-soat</code>).<br>
2. Kiểm tra danh sách các biên bản nộp két của các ca thu ngân trong ngày.<br>
3. Đối chiếu số tiền mặt thu ngân nộp vào tài khoản quỹ với doanh thu phần mềm ghi nhận.`,
    data: "URL: /staff/thanh-toan/doi-soat",
    expected: "Kiểm soát dòng tiền chặt chẽ, phát hiện ngay nếu có bất kỳ khoản chênh lệch nào chưa nộp két.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ACC-04",
    sec: "ACCOUNT",
    secName: "Kế toán & Lương",
    role: "Kế toán (ketoantruong)",
    url: "/staff/accountant/reports",
    name: "Báo cáo Tài chính Lợi nhuận P&L (Doanh thu - Chi phí)",
    steps: `1. Vào menu <b>Báo cáo Thu chi</b> (<code>/staff/accountant/reports</code>).<br>
2. Chọn khoảng thời gian: Tuần này hoặc Tháng này.<br>
3. Xem biểu đồ: Tổng Doanh thu bán hàng, Giá vốn hàng bán (COGS), Chi phí lương nhân sự, Lợi nhuận ròng.`,
    data: "Báo cáo P&L theo tháng.",
    expected: "Biểu đồ trực quan, số liệu tài chính rõ ràng hỗ trợ đắc lực cho chủ nhà hàng ra quyết định kinh doanh.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 9: QUẢN TRỊ ADMIN (ADMIN PORTAL)
  // ==========================================
  {
    id: "TC-ADM-01",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/login",
    name: "Đăng nhập Cổng Quản trị Tối cao (Admin Portal)",
    steps: `1. Mở trình duyệt vào <code>http://localhost:3000/admin/login</code>.<br>
2. Nhập tài khoản <code>admin</code>, mật khẩu <code>123456</code>.<br>
3. Bấm <b>Đăng nhập</b>.<br>
4. Kiểm tra giao diện Dashboard Quản trị mở ra tại <code>/admin/</code>.`,
    data: "User: admin | Pass: 123456.",
    expected: "Đăng nhập thành công vào trang quản trị trung tâm, hiển thị menu cấu hình toàn hệ thống.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ADM-02",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/catlist",
    name: "Quản lý Loại món (Thêm, Sửa, Xóa danh mục)",
    steps: `1. Vào mục <b>Loại món</b> (<code>/admin/catlist</code>).<br>
2. Thêm loại món mới: Nhập tên <code>Món Đặc Sản Tây Bắc</code> -> Bấm Lưu.<br>
3. Sửa tên loại món vừa tạo -> Bấm Cập nhật.<br>
4. Xóa loại món thử nghiệm vừa tạo.`,
    data: "Tên loại món: Món Đặc Sản Tây Bắc.",
    expected: "Thao tác Thêm, Sửa, Xóa loại món diễn ra trơn tru, đồng bộ ngay ra ngoài thực đơn khách.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ADM-03",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/productlist",
    name: "Quản lý Danh mục Món ăn (Thêm món mới & Upload ảnh)",
    steps: `1. Vào <b>Danh mục món ăn</b> (<code>/admin/productlist</code>). Xem danh sách hơn 250 món.<br>
2. Bấm <b>Thêm món ăn mới</b> (<code>/admin/productadd</code>).<br>
3. Điền: Tên món <code>Bò Fuji Nướng Muối Ớt</code>, Giá <code>250000</code>, chọn loại món, upload 1 file ảnh.<br>
4. Bấm <b>Thêm món</b> -> Ra ngoài <code>/menu</code> kiểm tra món mới đã xuất hiện chưa.`,
    data: "Món: Bò Fuji Nướng Muối Ớt | Giá: 250.000đ.",
    expected: "Món mới được lưu thành công, ảnh tải lên rõ nét và hiển thị chuẩn xác trên website thực đơn.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ADM-04",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/stafflist",
    name: "Quản lý Danh sách 75 Nhân viên & Phân quyền chức vụ",
    steps: `1. Vào mục <b>Tài khoản nhân sự</b> (<code>/admin/stafflist</code>).<br>
2. Xem bảng danh sách 75 nhân sự toàn nhà hàng.<br>
3. Thử tìm kiếm theo tên hoặc lọc theo bộ phận (Bếp, Phục vụ, Thu ngân, Kế toán).<br>
4. Bấm vào một nhân viên để kiểm tra quyền hạn tài khoản.`,
    data: "URL: /admin/stafflist",
    expected: "Hiển thị đầy đủ thông tin mã NV, họ tên, số điện thoại, chức vụ và trạng thái hoạt động.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ADM-05",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/thanh-toan",
    name: "Cấu hình Cổng thanh toán & Tài khoản Ngân hàng VietQR",
    steps: `1. Vào mục <b>Cấu hình thanh toán</b> (<code>/admin/thanh-toan</code>).<br>
2. Kiểm tra thông tin: Tên ngân hàng nhận tiền, Số tài khoản, Tên chủ tài khoản thụ hưởng.<br>
3. Kiểm tra mã khóa Webhook đồng bộ biến động số dư tự động.`,
    data: "URL: /admin/thanh-toan",
    expected: "Thông tin tài khoản ngân hàng chính xác, dùng để sinh mã VietQR động thanh toán cho khách.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ADM-06",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/dat-ban",
    name: "Cấu hình Chính sách Đặt bàn & Tiền cọc",
    steps: `1. Vào mục <b>Chính sách đặt bàn</b> (<code>/admin/dat-ban</code>).<br>
2. Xem và thử điều chỉnh: Thời gian giữ bàn tối đa khi khách đến muộn (ví dụ 15 phút), Mức tiền cọc tối thiểu theo số người.<br>
3. Bấm <b>Lưu cấu hình</b>.`,
    data: "Thời gian giữ chỗ: 15 phút | Cọc: 100k.",
    expected: "Cấu hình mới có hiệu lực ngay lập tức cho các lượt đặt bàn tiếp theo trên website.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ADM-07",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/khuyen-mai",
    name: "Tạo Mã giảm giá (Voucher) Khuyến mãi mới",
    steps: `1. Vào mục <b>Chương trình khuyến mãi</b> (<code>/admin/khuyen-mai</code>).<br>
2. Bấm nút <b>Tạo voucher mới</b>.<br>
3. Nhập: Mã <code>TEST10K</code>, Giảm giá: <code>10000</code> VNĐ, Ngày hết hạn: cuối tháng này.<br>
4. Bấm <b>Lưu chương trình</b> -> Thử dùng mã này khi thanh toán để kiểm tra.`,
    data: "Mã: TEST10K | Giảm: 10.000đ.",
    expected: "Tạo voucher thành công, áp dụng được đúng số tiền khi thanh toán.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-ADM-08",
    sec: "ADMIN",
    secName: "Quản trị Admin",
    role: "Quản trị viên (admin)",
    url: "/admin/du-bao",
    name: "Trung tâm Dự báo AI Machine Learning",
    steps: `1. Vào mục <b>Dự báo AI (ML)</b> (<code>/admin/du-bao</code>).<br>
2. Bấm nút <b>Chạy mô hình dự báo AI</b>.<br>
3. Xem biểu đồ kết quả: Dự báo lượng khách đến ăn trong 7 ngày tới và gợi ý số lượng nguyên liệu cần nhập kho.`,
    data: "URL: /admin/du-bao",
    expected: "Mô hình AI xử lý trơn tru, hiển thị đồ thị dự báo khoa học giúp tối ưu chi phí nguyên liệu.",
    status: "PENDING",
    note: ""
  },

  // ==========================================
  // PHÂN HỆ 10: BẢO MẬT & PHÂN QUYỀN (SECURITY)
  // ==========================================
  {
    id: "TC-SEC-01",
    sec: "SEC",
    secName: "Bảo mật & RBAC",
    role: "Người lạ chưa đăng nhập",
    url: "/admin/",
    name: "Chặn truy cập trái phép vào trang Quản trị (Admin Firewall)",
    steps: `1. Mở cửa sổ trình duyệt Ẩn danh (Ctrl + Shift + N).<br>
2. Không đăng nhập bất kỳ tài khoản nào.<br>
3. Gõ trực tiếp link quản trị vào thanh địa chỉ: <code>http://localhost:3000/admin/catlist</code> và Enter.`,
    data: "Truy cập ẩn danh không có session.",
    expected: "Hệ thống chặn truy cập ngay lập tức và tự động đẩy về trang đăng nhập <code>/admin/login</code>.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-SEC-02",
    sec: "SEC",
    secName: "Bảo mật & RBAC",
    role: "Người lạ chưa đăng nhập",
    url: "/staff/so-do-ban",
    name: "Chặn truy cập trái phép vào trang Nhân viên",
    steps: `1. Mở cửa sổ Ẩn danh mới.<br>
2. Gõ trực tiếp link nội bộ nhân viên: <code>http://localhost:3000/staff/so-do-ban</code> và Enter.`,
    data: "Truy cập ẩn danh vào portal nhân sự.",
    expected: "Bị chặn truy cập lập tức và chuyển hướng về <code>/staff/login</code>.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-SEC-03",
    sec: "SEC",
    secName: "Bảo mật & RBAC",
    role: "Phục vụ (phucvu)",
    url: "/staff/accountant/salary",
    name: "Kiểm tra Phân quyền Chéo (Phục vụ không xem được Lương Kế toán)",
    steps: `1. Đăng nhập tài khoản phục vụ <code>phucvu</code> / <code>123456</code>.<br>
2. Sau khi vào được hệ thống, cố tình gõ link bảng lương trên URL: <code>http://localhost:3000/staff/accountant/salary</code>.`,
    data: "User: phucvu truy cập tài nguyên Kế toán.",
    expected: "Hệ thống từ chối truy cập (Báo lỗi 403 Forbidden hoặc chặn quyền), bảo mật thông tin lương.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-SEC-04",
    sec: "SEC",
    secName: "Bảo mật & RBAC",
    role: "Khách / Hacker",
    url: "/staff/login",
    name: "Chống Đăng nhập sai Mật khẩu / Brute Force",
    steps: `1. Tại trang đăng nhập <code>/staff/login</code> hoặc <code>/admin/login</code>.<br>
2. Nhập user <code>admin</code> và mật khẩu sai <code>matkhausai999</code>.<br>
3. Bấm Đăng nhập.`,
    data: "Pass sai: matkhausai999.",
    expected: "Thông báo lỗi 'Tên đăng nhập hoặc mật khẩu không chính xác', tuyệt đối không cho vào hệ thống.",
    status: "PENDING",
    note: ""
  },
  {
    id: "TC-SEC-05",
    sec: "SEC",
    secName: "Bảo mật & RBAC",
    role: "Khách vãng lai",
    url: "/duong-dan-khong-ton-tai-404",
    name: "Trang thông báo Lỗi 404 Not Found thân thiện",
    steps: `1. Gõ một đường link bất kỳ không có thật trong hệ thống, ví dụ: <code>http://localhost:3000/link-nay-khong-he-ton-tai</code>.<br>
2. Quan sát trang hiển thị.`,
    data: "URL: /link-nay-khong-he-ton-tai",
    expected: "Hiển thị trang báo lỗi 404 đẹp mắt kèm nút 'Quay về trang chủ', không lộ mã nguồn hay lỗi server.",
    status: "PENDING",
    note: ""
  }
];

// Hàm tạo HTML hoàn chỉnh
function buildHTML() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bảng Kiểm Thử Thủ Công Chi Tiết (Manual Testing Checklist) - Nhà Hàng Bảo Đoàn</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    :root {
      --primary: #c8a24b;
      --primary-dark: #a8822f;
      --secondary: #241a14;
      --accent: #b3352c;
      --success: #16a34a;
      --danger: #dc2626;
      --warning: #d97706;
      --info: #0284c7;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--font-family); }
    body { background-color: #f4efe6; color: var(--text-main); padding: 24px 16px 80px; }
    .container { max-width: 1560px; margin: 0 auto; }

    /* Header */
    header {
      background: linear-gradient(135deg, #241a14 0%, #3d2b21 50%, #5d4037 100%);
      color: white;
      padding: 32px 36px;
      border-radius: 20px;
      margin-bottom: 24px;
      box-shadow: 0 12px 30px rgba(36, 26, 20, 0.25);
      border: 1px solid rgba(200, 162, 75, 0.3);
      position: relative;
    }
    header h1 { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
    header h1 i { color: var(--primary); }
    header p { opacity: 0.9; font-size: 15px; max-width: 950px; line-height: 1.6; color: #f3ede2; }
    
    .header-badges { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; align-items: center; }
    .save-indicator {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(200, 162, 75, 0.2); border: 1px solid var(--primary);
      padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; color: #fbf7f0;
    }
    .badge-auto { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 9999px; font-size: 13px; color: #fff; }

    /* Cheat Sheet Cards (Cho người mới) */
    .guide-box {
      background: #ffffff;
      border: 1px solid #e7ded0;
      border-radius: 16px;
      padding: 22px 26px;
      margin-bottom: 24px;
      box-shadow: 0 4px 16px rgba(36, 26, 20, 0.05);
    }
    .guide-box h2 {
      font-size: 18px; font-weight: 700; color: #241a14; margin-bottom: 14px;
      display: flex; align-items: center; gap: 8px;
    }
    .guide-box h2 i { color: var(--primary); }

    .cheat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .cheat-card {
      background: #faf7f2; border: 1px solid #e7ded0; border-radius: 12px; padding: 14px 16px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .cheat-role { font-weight: 700; font-size: 14px; color: #241a14; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .cheat-acc { font-family: monospace; background: #fff; border: 1px solid #ddd; padding: 4px 8px; border-radius: 6px; font-size: 13px; display: inline-flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .cheat-btn-copy { background: transparent; border: none; cursor: pointer; color: #888; font-size: 12px; padding: 2px 4px; }
    .cheat-btn-copy:hover { color: var(--primary); }
    .cheat-url { font-size: 12px; color: #6b5f54; word-break: break-all; }
    .cheat-url a { color: var(--info); text-decoration: none; font-weight: 600; }
    .cheat-url a:hover { text-decoration: underline; }

    /* Flow Diagrams */
    .flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 14px; }
    .flow-card {
      background: #fff; border: 1px solid #e7ded0; border-radius: 12px; padding: 16px 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    }
    .flow-title { font-weight: 700; font-size: 15px; color: #241a14; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .flow-steps { font-size: 13px; line-height: 1.6; color: #444; }
    .flow-badge { display: inline-block; background: #241a14; color: #c8a24b; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; margin-right: 4px; }

    /* KPI Summary Cards */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card {
      background: var(--card-bg); padding: 20px; border-radius: 14px; border: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(36,26,20,0.04); display: flex; flex-direction: column; justify-content: space-between;
    }
    .kpi-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
    .kpi-value { font-size: 32px; font-weight: 800; line-height: 1; }
    .val-total { color: #0284c7; }
    .val-pass { color: var(--success); }
    .val-fail { color: var(--danger); }
    .val-progress { color: #c8a24b; }

    /* Progress bar */
    .progress-wrapper {
      background: var(--card-bg); padding: 20px 24px; border-radius: 16px; border: 1px solid var(--border);
      margin-bottom: 24px; box-shadow: 0 4px 12px rgba(36,26,20,0.04);
    }
    .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-weight: 700; font-size: 15px; }
    .progress-bar-bg { width: 100%; height: 16px; background-color: #e2e8f0; border-radius: 9999px; overflow: hidden; }
    .progress-bar-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      transition: width 0.3s ease; border-radius: 9999px;
    }

    /* Controls & Toolbar */
    .toolbar {
      background: var(--card-bg); padding: 18px 20px; border-radius: 14px; border: 1px solid var(--border);
      margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
      justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .filter-group { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .search-input {
      padding: 10px 16px; border-radius: 10px; border: 1px solid var(--border);
      font-size: 14px; width: 300px; outline: none; transition: border 0.2s;
    }
    .search-input:focus { border-color: var(--primary); }
    .select-filter {
      padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border);
      font-size: 14px; background: white; cursor: pointer; outline: none;
    }
    .btn {
      padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
      border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
    }
    .btn-primary { background: #241a14; color: #c8a24b; border: 1px solid #241a14; }
    .btn-primary:hover { background: #3d2b21; color: #fbf7f0; }
    .btn-outline { background: white; border: 1px solid var(--border); color: var(--text-main); }
    .btn-outline:hover { background: #f1f5f9; }
    .btn-danger { background: #fee2e2; color: #b91c1c; }
    .btn-danger:hover { background: #fecaca; }

    /* Table */
    .table-container {
      background: var(--card-bg); border-radius: 16px; border: 1px solid var(--border);
      overflow-x: auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);
    }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
      background: #faf6ef; padding: 14px 16px; font-size: 12px; text-transform: uppercase;
      font-weight: 700; color: #4a3c31; letter-spacing: 0.5px; border-bottom: 2px solid #e7ded0;
      white-space: nowrap;
    }
    td {
      padding: 14px 16px; font-size: 13.5px; border-bottom: 1px solid #f0eae1;
      vertical-align: top; line-height: 1.5;
    }
    tr:hover { background-color: #fcfbfa; }
    tr.checked-row { background-color: #f0fdf4; }

    /* Checkbox & Badges */
    .test-check { width: 22px; height: 22px; cursor: pointer; accent-color: var(--success); }
    .badge {
      display: inline-block; padding: 4px 10px; border-radius: 9999px;
      font-size: 11px; font-weight: 700; white-space: nowrap;
    }
    .badge-code { background: #f5eedf; color: #633f00; font-family: monospace; }
    .badge-section { background: #ede9fe; color: #6d28d9; }
    .badge-role { background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2px 6px; }
    
    .badge-status { cursor: pointer; transition: transform 0.1s; }
    .badge-status:active { transform: scale(0.95); }
    .status-pass { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .status-fail { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .status-pending { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }

    .step-box { line-height: 1.6; color: #2d3748; }
    .step-box code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #0f172a; font-family: monospace; }
    .step-box b { color: #1a202c; }
    
    .data-box {
      margin-top: 8px; padding: 8px 10px; background: #fffdfa; border: 1px dashed #e2d7c7;
      border-radius: 6px; font-size: 12px; color: #705537;
    }
    .expected-text { font-size: 13px; color: #059669; font-weight: 500; line-height: 1.5; }
    
    .note-input {
      width: 100%; padding: 6px 10px; border: 1px solid var(--border);
      border-radius: 6px; font-size: 13px; outline: none; transition: border 0.2s;
    }
    .note-input:focus { border-color: var(--primary); }

    /* Quick Link Button in cell */
    .link-direct {
      display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--info);
      text-decoration: none; font-weight: 600; margin-top: 4px;
    }
    .link-direct:hover { text-decoration: underline; color: #0369a1; }

    /* Toast */
    .toast {
      position: fixed; bottom: 24px; right: 24px; background: #241a14; color: #fff;
      padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600;
      box-shadow: 0 10px 20px rgba(0,0,0,0.25); border: 1px solid var(--primary);
      transform: translateY(100px); opacity: 0; transition: all 0.3s ease; z-index: 9999;
    }
    .toast.show { transform: translateY(0); opacity: 1; }

    @media print {
      body { padding: 0; background: white; }
      header { background: #241a14 !important; color: white !important; }
      .toolbar, .btn, .search-input, .select-filter, .guide-box { display: none !important; }
      .table-container { border: none; box-shadow: none; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><i class="fas fa-clipboard-check"></i> BẢNG KIỂM THỬ THỦ CÔNG TOÀN DIỆN (MANUAL TESTING CHECKLIST)</h1>
      <p><b>Hệ thống Nhà Hàng Bảo Đoàn</b> &bull; Hướng dẫn kiểm thử chi tiết "cầm tay chỉ việc" cho người mới, không cần biết trước nghiệp vụ vẫn có thể test thông suốt từ đầu đến cuối toàn bộ hệ thống.</p>
      
      <div class="header-badges">
        <div class="save-indicator">
          <i class="fas fa-floppy-disk"></i> <span id="saveStatus">Đã lưu tự động</span>
        </div>
        <div class="badge-auto">
          <i class="fas fa-server"></i> Server URL: <code>http://localhost:3000</code>
        </div>
        <div class="badge-auto">
          <i class="fas fa-database"></i> Mật khẩu mặc định tất cả tài khoản: <code>123456</code>
        </div>
      </div>
    </header>

    <!-- HƯỚNG DẪN DÀNH CHO NGƯỜI MỚI (BEGINNER CHEAT SHEET) -->
    <div class="guide-box">
      <h2><i class="fas fa-id-card-clip"></i> 1. Danh sách Tài khoản Kiểm thử Sẵn Có (Test Accounts Cheat Sheet)</h2>
      <p style="font-size: 13.5px; color: #64748b; margin-bottom: 14px;">Mở trang đăng nhập tương ứng, copy tài khoản & mật khẩu <code>123456</code> để đăng nhập kiểm thử từng vai trò:</p>
      <div class="cheat-grid">
        <div class="cheat-card">
          <div class="cheat-role">
            <span>👑 Quản trị viên (Admin)</span>
            <span class="badge badge-role">Toàn quyền</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>admin</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('admin', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/admin/login" target="_blank">/admin/login</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>📋 Lễ tân / Tiếp đón (FOH)</span>
            <span class="badge badge-role">Bàn & Khách</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>letan</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('letan', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/staff/login" target="_blank">/staff/login</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>🍽️ Nhân viên Phục vụ</span>
            <span class="badge badge-role">Order món</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>phucvu</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('phucvu', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/staff/login" target="_blank">/staff/login</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>👨‍🍳 Bếp trưởng / Bar</span>
            <span class="badge badge-role">Màn hình KDS</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>beptruong</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('beptruong', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/staff/login" target="_blank">/staff/login</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>💵 Thu ngân quầy (Cashier)</span>
            <span class="badge badge-role">POS & VietQR</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>thungan</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('thungan', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/staff/login" target="_blank">/staff/login</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>🚚 Điều phối & Shipper</span>
            <span class="badge badge-role">Giao hàng</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>dieuphoi</b> / <b>shipper1</b></span>
            <button class="cheat-btn-copy" onclick="copyText('dieuphoi', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/staff/login" target="_blank">/staff/login</a> &bull; App: <a href="http://localhost:3000/shipper/" target="_blank">/shipper/</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>📊 Quản lý điều hành</span>
            <span class="badge badge-role">Điều hành</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>quanly</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('quanly', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/staff/login" target="_blank">/staff/login</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>💰 Kế toán & Tài chính</span>
            <span class="badge badge-role">Lương & Thu chi</span>
          </div>
          <div class="cheat-acc">
            <span>User: <b>ketoantruong</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('ketoantruong', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/staff/login" target="_blank">/staff/login</a></div>
        </div>

        <div class="cheat-card">
          <div class="cheat-role">
            <span>👤 Khách hàng mẫu</span>
            <span class="badge badge-role">Khách mua</span>
          </div>
          <div class="cheat-acc">
            <span>SĐT: <b>0388062048</b> | Pass: <b>123456</b></span>
            <button class="cheat-btn-copy" onclick="copyText('0388062048', '123456')" title="Copy tài khoản"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div class="cheat-url">Cổng: <a href="http://localhost:3000/login" target="_blank">/login</a></div>
        </div>
      </div>

      <!-- SƠ ĐỒ 4 LUỒNG NGHIỆP VỤ -->
      <h2 style="margin-top: 24px;"><i class="fas fa-diagram-project"></i> 2. Hiểu Nhanh 4 Luồng Nghiệp Vụ Chính Trong Nhà Hàng</h2>
      <div class="flow-grid">
        <div class="flow-card">
          <div class="flow-title"><span class="flow-badge">LUỒNG 1</span> Ăn tại chỗ (Dine-in Order)</div>
          <div class="flow-steps">
            1. Khách vào quán -> Phục vụ mở bàn trên <code>/so-do-ban</code>.<br>
            2. Phục vụ chọn món hoặc Khách quét QR bàn (<code>/qr/table/1</code>).<br>
            3. Đơn tự động bay sang màn hình Bếp KDS (<code>/kds</code>).<br>
            4. Bếp bấm <b>Nấu</b> -> <b>Xong</b> -> Phục vụ mang món ra bàn.<br>
            5. Thu ngân mở POS (<code>/staff/thanh-toan</code>) in bill & thu tiền -> Bàn đổi về màu xanh (Trống).
          </div>
        </div>

        <div class="flow-card">
          <div class="flow-title"><span class="flow-badge">LUỒNG 2</span> Đặt bàn trước (Reservation)</div>
          <div class="flow-steps">
            1. Khách vào <code>/dat-ban</code> chọn ngày, giờ, số người, chọn bàn.<br>
            2. Khách quét mã VietQR đặt cọc giữ chỗ.<br>
            3. Lễ tân thấy đơn trên <code>/staff/bookings</code> -> Xác nhận đặt bàn.<br>
            4. Khi khách đến, Lễ tân bấm <b>Gán bàn / Khách đến</b> để phục vụ.
          </div>
        </div>

        <div class="flow-card">
          <div class="flow-title"><span class="flow-badge">LUỒNG 3</span> Đặt giao tận nơi (Delivery)</div>
          <div class="flow-steps">
            1. Khách chọn món vào Giỏ hàng -> Chọn Giao hàng (<code>/giao-hang</code>).<br>
            2. Điều phối viên (<code>/staff/giao-hang</code>) gán đơn cho Shipper.<br>
            3. Bếp nấu món xong bàn giao cho Shipper.<br>
            4. Shipper dùng App PWA (<code>/shipper/</code>) đi giao & bấm hoàn thành.<br>
            5. Khách theo dõi hành trình GPS trên link <code>/theo-doi/...</code>.
          </div>
        </div>

        <div class="flow-card">
          <div class="flow-title"><span class="flow-badge">LUỒNG 4</span> Vận hành ca & Chốt sổ</div>
          <div class="flow-steps">
            1. Đầu ca: Nhân viên chấm công khuôn mặt AI (<code>/cham-cong-khuon-mat</code>).<br>
            2. Cuối ca: Phục vụ gửi Báo cáo ca trực (<code>/staff/phuc-vu/bao-cao</code>).<br>
            3. Thu ngân đếm két tiền mặt & Chốt ca (<code>/staff/chot-ca</code>).<br>
            4. Kế toán đối soát sao kê ngân hàng & tính lương tự động.
          </div>
        </div>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Tổng số kịch bản</div>
        <div class="kpi-value val-total" id="kpiTotal">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Đã kiểm thử Đạt (PASS)</div>
        <div class="kpi-value val-pass" id="kpiPass">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Chưa Đạt / Có Lỗi (FAIL)</div>
        <div class="kpi-value val-fail" id="kpiFail">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Tiến độ hoàn thành</div>
        <div class="kpi-value val-progress" id="kpiProgress">0%</div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-wrapper">
      <div class="progress-header">
        <span>Tiến trình hoàn tất kiểm thử:</span>
        <span id="progressText">0 / 0 kịch bản</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="progressBar"></div>
      </div>
    </div>

    <!-- Toolbar Controls -->
    <div class="toolbar">
      <div class="filter-group">
        <input type="text" id="searchInput" class="search-input" placeholder="🔍 Tìm kiếm kịch bản, URL, chức năng..." oninput="filterTable()">
        <select id="sectionFilter" class="select-filter" onchange="filterTable()">
          <option value="ALL">📁 Tất cả phân hệ & Luồng liên hoàn</option>
          <option value="E2E">⭐ Luồng liên hoàn End-to-End (Cho người mới)</option>
          <option value="CUST">Khách hàng & Thực đơn & Đặt bàn</option>
          <option value="FOH">Lễ tân & Sơ đồ bàn & QR</option>
          <option value="KITCHEN">Bếp trưởng & Màn hình KDS</option>
          <option value="POS">Thu ngân & POS & VietQR</option>
          <option value="DELIVERY">Điều phối & Shipper Giao hàng</option>
          <option value="HR">Quản lý nhân sự & Xếp ca & Chấm công</option>
          <option value="REPORT">Báo cáo cuối ngày phục vụ</option>
          <option value="ACCOUNT">Kế toán & Bảng lương & Thu chi</option>
          <option value="ADMIN">Quản trị viên hệ thống (Admin)</option>
          <option value="SEC">Bảo mật & Phân quyền RBAC</option>
        </select>
        <select id="statusFilter" class="select-filter" onchange="filterTable()">
          <option value="ALL">🎯 Tất cả trạng thái</option>
          <option value="PASS">✅ Đã Đạt (PASS)</option>
          <option value="FAIL">❌ Bị Lỗi (FAIL)</option>
          <option value="PENDING">⏳ Chưa kiểm thử</option>
        </select>
      </div>

      <div class="filter-group">
        <button class="btn btn-outline" onclick="checkAll(true)"><i class="fas fa-check-double"></i> Tick tất cả</button>
        <button class="btn btn-outline" onclick="checkAll(false)"><i class="fas fa-xmark"></i> Bỏ tick</button>
        <button class="btn btn-primary" onclick="exportReport()"><i class="fas fa-file-arrow-down"></i> Xuất JSON</button>
        <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> In / Xuất PDF</button>
        <button class="btn btn-danger" onclick="resetAll()"><i class="fas fa-arrow-rotate-left"></i> Đặt lại</button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table id="testTable">
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">Tick</th>
            <th style="width: 100px;">Mã TC</th>
            <th style="width: 140px;">Phân hệ</th>
            <th style="width: 180px;">Chức năng</th>
            <th style="width: 180px;">Vai trò & Đường dẫn</th>
            <th>Các bước thực hiện chi tiết (Step-by-step)</th>
            <th style="width: 240px;">Kết quả mong đợi</th>
            <th style="width: 110px; text-align: center;">Trạng thái</th>
            <th style="width: 200px;">Ghi chú của bạn</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          <!-- Rendered dynamically via JavaScript -->
        </tbody>
      </table>
    </div>
  </div>

  <div class="toast" id="toast">Đã lưu tiến độ kiểm thử!</div>

  <script>
    const testCasesData = ${JSON.stringify(testCases, null, 2)};

    const STORAGE_KEY = 'gs_restaurant_comprehensive_checklist_v2';
    let appState = {};

    function loadState() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          appState = JSON.parse(saved);
        }
      } catch (e) {
        console.error('Lỗi nạp state:', e);
      }
    }

    function saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        const statusEl = document.getElementById('saveStatus');
        statusEl.innerText = 'Đã lưu lúc ' + new Date().toLocaleTimeString();
        showToast('Đã lưu tiến độ kiểm thử thành công!');
      } catch (e) {
        console.error('Lỗi lưu state:', e);
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function copyText(user, pass) {
      navigator.clipboard.writeText(user);
      showToast('Đã copy: ' + user + ' (Pass: ' + pass + ')');
    }

    function renderTable() {
      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = '';

      testCasesData.forEach((tc) => {
        const saved = appState[tc.id] || {};
        const isChecked = saved.checked || false;
        const currentStatus = saved.status || tc.status || 'PENDING';
        const currentNote = saved.note !== undefined ? saved.note : tc.note;

        const tr = document.createElement('tr');
        tr.id = 'row-' + tc.id;
        tr.dataset.id = tc.id;
        tr.dataset.sec = tc.sec;
        tr.dataset.status = currentStatus;
        if (isChecked) tr.classList.add('checked-row');

        tr.innerHTML = \`
          <td style="text-align: center;">
            <input type="checkbox" class="test-check" id="check-\${tc.id}" \${isChecked ? 'checked' : ''} onchange="toggleCheck('\${tc.id}')">
          </td>
          <td><span class="badge badge-code">\${tc.id}</span></td>
          <td><span class="badge badge-section">\${tc.secName}</span></td>
          <td style="font-weight: 700; color: #241a14;">\${tc.name}</td>
          <td>
            <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 4px;">\${tc.role}</div>
            <a href="http://localhost:3000\${tc.url}" target="_blank" class="link-direct" title="Mở trang kiểm thử trong tab mới">
              <i class="fas fa-arrow-up-right-from-square"></i> <code>\${tc.url}</code>
            </a>
          </td>
          <td>
            <div class="step-box">\${tc.steps}</div>
            \${tc.data ? '<div class="data-box"><i class="fas fa-database"></i> <b>Dữ liệu mẫu:</b> ' + tc.data + '</div>' : ''}
          </td>
          <td>
            <div class="expected-text"><i class="fas fa-circle-check text-success"></i> \${tc.expected}</div>
          </td>
          <td style="text-align: center;">
            <span class="badge badge-status \${getStatusClass(currentStatus)}" id="status-badge-\${tc.id}" onclick="cycleStatus('\${tc.id}')" title="Bấm vào để đổi trạng thái">
              \${getStatusText(currentStatus)}
            </span>
          </td>
          <td>
            <input type="text" class="note-input" id="note-\${tc.id}" value="\${escapeHtml(currentNote)}" placeholder="Ghi chú kết quả..." onchange="updateNote('\${tc.id}', this.value)">
          </td>
        \`;

        tbody.appendChild(tr);
      });

      updateKPIs();
    }

    function getStatusClass(status) {
      if (status === 'PASS') return 'status-pass';
      if (status === 'FAIL') return 'status-fail';
      return 'status-pending';
    }

    function getStatusText(status) {
      if (status === 'PASS') return '✓ ĐẠT';
      if (status === 'FAIL') return '✗ HỎNG';
      return '⏳ CHỜ TEST';
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text).replace(/"/g, '&quot;');
    }

    function toggleCheck(id) {
      if (!appState[id]) appState[id] = {};
      const chk = document.getElementById('check-' + id);
      appState[id].checked = chk.checked;
      
      if (chk.checked && (!appState[id].status || appState[id].status === 'PENDING')) {
        appState[id].status = 'PASS';
        const badge = document.getElementById('status-badge-' + id);
        badge.className = 'badge badge-status status-pass';
        badge.innerText = '✓ ĐẠT';
      }

      const row = document.getElementById('row-' + id);
      if (chk.checked) {
        row.classList.add('checked-row');
      } else {
        row.classList.remove('checked-row');
      }

      saveState();
      updateKPIs();
    }

    function cycleStatus(id) {
      if (!appState[id]) appState[id] = {};
      const current = appState[id].status || 'PENDING';
      let next = 'PASS';
      if (current === 'PENDING') next = 'PASS';
      else if (current === 'PASS') next = 'FAIL';
      else if (current === 'FAIL') next = 'PENDING';

      appState[id].status = next;
      const badge = document.getElementById('status-badge-' + id);
      badge.className = 'badge badge-status ' + getStatusClass(next);
      badge.innerText = getStatusText(next);

      const chk = document.getElementById('check-' + id);
      if (next === 'PASS') {
        chk.checked = true;
        appState[id].checked = true;
        document.getElementById('row-' + id).classList.add('checked-row');
      } else if (next === 'PENDING') {
        chk.checked = false;
        appState[id].checked = false;
        document.getElementById('row-' + id).classList.remove('checked-row');
      }

      saveState();
      updateKPIs();
    }

    function updateNote(id, noteValue) {
      if (!appState[id]) appState[id] = {};
      appState[id].note = noteValue;
      saveState();
    }

    function updateKPIs() {
      const total = testCasesData.length;
      let passed = 0;
      let failed = 0;

      testCasesData.forEach(tc => {
        const s = appState[tc.id] || {};
        if (s.status === 'PASS' || s.checked) passed++;
        else if (s.status === 'FAIL') failed++;
      });

      const percent = total > 0 ? Math.round((passed / total) * 100) : 0;

      document.getElementById('kpiTotal').innerText = total;
      document.getElementById('kpiPass').innerText = passed;
      document.getElementById('kpiFail').innerText = failed;
      document.getElementById('kpiProgress').innerText = percent + '%';

      document.getElementById('progressText').innerText = passed + ' / ' + total + ' kịch bản hoàn tất (' + percent + '%)';
      document.getElementById('progressBar').style.width = percent + '%';
    }

    function filterTable() {
      const search = document.getElementById('searchInput').value.toLowerCase().trim();
      const sec = document.getElementById('sectionFilter').value;
      const status = document.getElementById('statusFilter').value;

      const rows = document.querySelectorAll('#tableBody tr');
      rows.forEach(row => {
        const id = row.dataset.id;
        const rowSec = row.dataset.sec;
        const s = appState[id] || {};
        const rowStatus = s.status || 'PENDING';
        const rowText = row.innerText.toLowerCase();

        const matchSearch = !search || rowText.includes(search);
        const matchSec = sec === 'ALL' || rowSec === sec;
        const matchStatus = status === 'ALL' || rowStatus === status;

        if (matchSearch && matchSec && matchStatus) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    function checkAll(val) {
      testCasesData.forEach(tc => {
        if (!appState[tc.id]) appState[tc.id] = {};
        appState[tc.id].checked = val;
        appState[tc.id].status = val ? 'PASS' : 'PENDING';
      });
      saveState();
      renderTable();
    }

    function resetAll() {
      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dấu tick và ghi chú để kiểm thử lại từ đầu?')) {
        appState = {};
        localStorage.removeItem(STORAGE_KEY);
        renderTable();
        showToast('Đã đặt lại bảng kiểm thử!');
      }
    }

    function exportReport() {
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalTests: testCasesData.length,
        results: testCasesData.map(tc => {
          const s = appState[tc.id] || {};
          return {
            id: tc.id,
            section: tc.secName,
            role: tc.role,
            url: tc.url,
            name: tc.name,
            checked: !!s.checked,
            status: s.status || 'PENDING',
            note: s.note || ''
          };
        })
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manual-testing-results-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    window.onload = function() {
      loadState();
      renderTable();
    };
  </script>
</body>
</html>`;
}

// Ghi ra 3 vị trí để dùng thuận tiện nhất:
// 1. reports/manual-testing-checklist.html
// 2. public/manual-testing-checklist.html (truy cập qua http://localhost:3000/manual-testing-checklist.html)
// 3. manual-testing-checklist.html (ở thư mục gốc)

const html = buildHTML();

const targetPaths = [
  path.join(__dirname, '..', 'reports', 'manual-testing-checklist.html'),
  path.join(__dirname, '..', 'public', 'manual-testing-checklist.html'),
  path.join(__dirname, '..', 'manual-testing-checklist.html')
];

targetPaths.forEach(p => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html, 'utf-8');
  console.log('✅ Đã tạo file thành công tại:', p);
});

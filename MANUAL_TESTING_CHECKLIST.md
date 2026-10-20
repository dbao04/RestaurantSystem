# 📋 BẢNG KIỂM THỬ THỦ CÔNG TOÀN DIỆN (MANUAL TESTING CHECKLIST)

> **GS Restaurant — Hệ Thống Quản Lý Nhà Hàng Đa Phân Hệ**  
> *Checklist kiểm thử thủ công từng bước dành cho Tester / QA / Nhà phát triển.*  
> *Đánh dấu `[x]` vào từng mục khi bạn đã kiểm tra hoàn tất.*

---

## 🌐 Công cụ Checklist Trực Quan (Interactive Web App)
Bạn có thể mở trực tiếp bảng kiểm thử tương tác trên trình duyệt tại:  
👉 **[manual-testing-checklist.html](file:///H:/NhaHang/NhaHang/RestaurantSystem/reports/manual-testing-checklist.html)**  
*(Có thanh tiến độ %, tự động lưu trạng thái tick vào máy, có bộ lọc và xuất file báo cáo)*

Hoặc chạy lệnh:
```bash
npm run test:manual
```

---

## 1. Phân Hệ Khách Hàng (Customer Web Portal & Delivery & Booking & Combo)

- [ ] **TC-CUST-01**: **Trang chủ & Giao diện**
  - *Các bước:* Mở `http://localhost:3000/`. Quan sát banner, danh mục món nổi bật và thanh menu chính.
  - *Kết quả mong đợi:* Trang tải nhanh, không bị vỡ bố cục, đầy đủ hình ảnh đại diện.
- [ ] **TC-CUST-02**: **Đa ngôn ngữ (i18n)**
  - *Các bước:* Bấm vào nút chuyển ngôn ngữ trên header: Tiếng Anh (EN), Tiếng Nhật (JA), Tiếng Việt (VI).
  - *Kết quả mong đợi:* Toàn bộ menu, tiêu đề, nút bấm tự động chuyển ngữ chuẩn xác.
- [ ] **TC-CUST-03**: **Thực đơn món ăn**
  - *Các bước:* Bấm vào menu **Món ăn** (`/menu`), chọn thử các danh mục: Khai vị, Món chính, Đồ uống.
  - *Kết quả mong đợi:* Hiển thị đúng các món ăn theo danh mục đã lọc kèm giá tiền.
- [ ] **TC-CUST-04**: **Tìm kiếm món ăn**
  - *Các bước:* Nhập từ khóa `lẩu` vào ô tìm kiếm trên trang menu rồi nhấn Enter.
  - *Kết quả mong đợi:* Trả về đúng danh sách các món có tên chứa từ khóa `lẩu`.
- [ ] **TC-CUST-05**: **Chi tiết món & Dị ứng**
  - *Các bước:* Bấm vào một món ăn bất kỳ để xem chi tiết (ví dụ: `/detail?monid=85`).
  - *Kết quả mong đợi:* Hiển thị mô tả món, công thức nguyên liệu và bảng cảnh báo dị ứng.
- [ ] **TC-CUST-06**: **Thực đơn Combo mới**
  - *Các bước:* Bấm vào mục **Thực đơn** mới (`/combos` hoặc `/thuc-don`).
  - *Kết quả mong đợi:* Hiển thị đầy đủ các gói Combo (Gia đình, Hẹn hò, Tiệc), danh sách món thành phần và giá ưu đãi.
- [ ] **TC-CUST-07**: **Đăng ký tài khoản khách**
  - *Các bước:* Vào `/register`, điền Họ tên, Số điện thoại mới, Mật khẩu và bấm Đăng ký.
  - *Kết quả mong đợi:* Hệ thống thông báo tạo tài khoản thành công và chuyển sang trang Đăng nhập.
- [ ] **TC-CUST-08**: **Đăng nhập khách hàng**
  - *Các bước:* Vào `/login`, nhập Số điện thoại và Mật khẩu vừa đăng ký.
  - *Kết quả mong đợi:* Đăng nhập thành công, trên thanh menu hiển thị tên khách và điểm tích lũy.
- [ ] **TC-CUST-09**: **Hồ sơ & Địa chỉ giao hàng**
  - *Các bước:* Vào trang cá nhân `/profile`, cập nhật địa chỉ giao hàng và bấm Lưu.
  - *Kết quả mong đợi:* Thông tin được lưu thành công vào cơ sở dữ liệu.
- [ ] **TC-CUST-10**: **Thêm món lẻ vào giỏ**
  - *Các bước:* Tại trang thực đơn, bấm nút **Thêm vào giỏ** ở 1-2 món ăn.
  - *Kết quả mong đợi:* Icon giỏ hàng trên header nhảy số lượng tương ứng.
- [ ] **TC-CUST-11**: **Thêm Combo mới vào giỏ**
  - *Các bước:* Vào `/combos`, bấm nút **Chọn Combo này** ở gói Combo Gia Đình.
  - *Kết quả mong đợi:* Toàn bộ các món thành phần trong Combo được thêm vào giỏ và tự động chuyển đến `/cart`.
- [ ] **TC-CUST-12**: **Quản lý giỏ hàng**
  - *Các bước:* Tại trang `/cart`, tăng/giảm số lượng món, thử xóa 1 món khỏi giỏ.
  - *Kết quả mong đợi:* Tổng tiền thanh toán tự động cập nhật lại chính xác.
- [ ] **TC-CUST-13**: **Quy trình Đặt bàn trực tuyến**
  - *Các bước:* Vào `/dat-ban`, chọn ngày (ngày mai), giờ (19:00), số khách (4 người), chọn bàn và bấm Đặt bàn.
  - *Kết quả mong đợi:* Hệ thống thông báo thành công và sinh mã đặt chỗ `RSV-...`.
- [ ] **TC-CUST-14**: **Tra cứu đặt bàn**
  - *Các bước:* Vào `/dat-ban/tra-cuu`, nhập Số điện thoại và Mã đặt bàn vừa tạo.
  - *Kết quả mong đợi:* Hiển thị đầy đủ thông tin: ngày giờ, số khách, bàn đã gán và trạng thái.
- [ ] **TC-CUST-15**: **Thanh toán cọc VietQR**
  - *Các bước:* Bấm vào link thanh toán cọc (`/thanh-toan/dat-ban/:ma_dat`).
  - *Kết quả mong đợi:* Hiển thị mã QR ngân hàng chuẩn VietQR kèm số tiền cọc và cú pháp chuyển khoản.
- [ ] **TC-CUST-16**: **Đặt món giao tận nơi**
  - *Các bước:* Từ giỏ hàng bấm **Giao hàng tận nơi** (`/giao-hang`), nhập địa chỉ nhận hàng.
  - *Kết quả mong đợi:* Hệ thống tự động tính cước phí ship theo khoảng cách GPS.
- [ ] **TC-CUST-17**: **Theo dõi shipper giao hàng**
  - *Các bước:* Sau khi chốt đơn giao hàng, mở link theo dõi (`/theo-doi/:ma_don`).
  - *Kết quả mong đợi:* Hiển thị tiến trình: Chờ xác nhận -> Đang nấu -> Shipper đang giao -> Giao thành công.
- [ ] **TC-CUST-18**: **Lịch sử đơn hàng của tôi**
  - *Các bước:* Bấm vào menu cá nhân chọn **Đơn hàng của tôi** (`/my-orders`).
  - *Kết quả mong đợi:* Hiển thị toàn bộ lịch sử các lượt đặt bàn và đơn giao hàng đã đặt.
- [ ] **TC-CUST-19**: **Trợ lý ảo AI Chatbot**
  - *Các bước:* Bấm vào bong bóng Chatbot ở góc phải màn hình, chọn câu hỏi 'Quán có món gì ngon?'.
  - *Kết quả mong đợi:* Chatbot AI phân tích ý định và phản hồi danh sách món gợi ý tức thì.
- [ ] **TC-CUST-20**: **Đánh giá dịch vụ**
  - *Các bước:* Vào mục Đánh giá (`/rate`), chọn 5 sao, viết nhận xét trải nghiệm và bấm Gửi.
  - *Kết quả mong đợi:* Hệ thống ghi nhận đánh giá thành công.

---

## 2. Phân Hệ Lễ Tân & Phục Vụ (Service & Floor Plan)

- [ ] **TC-FOH-01**: **Đăng nhập tài khoản Lễ tân**
  - *Tài khoản:* `letan` / Mật khẩu: `123456` tại `/staff/login`.
  - *Kết quả mong đợi:* Đăng nhập thành công vào phân hệ Lễ tân.
- [ ] **TC-FOH-02**: **Sơ đồ 40 bàn thời gian thực**
  - *Các bước:* Mở `/staff/so-do-ban` (hoặc `/so-do-ban`).
  - *Kết quả mong đợi:* Hiển thị 40 bàn chia theo 4 khu vực (Sảnh, Tầng lửng, Sân vườn, VIP).
- [ ] **TC-FOH-03**: **Mở bàn đón khách**
  - *Các bước:* Bấm vào một bàn Trống (màu xám), chọn số lượng khách và bấm Mở bàn.
  - *Kết quả mong đợi:* Bàn chuyển sang màu cam (Đang phục vụ), bắt đầu tính giờ sử dụng bàn.
- [ ] **TC-FOH-04**: **Gọi món trực tiếp vào bàn**
  - *Các bước:* Bấm vào bàn đang phục vụ, chọn các món từ danh mục và bấm **Gửi đơn bếp**.
  - *Kết quả mong đợi:* Món ăn lưu vào bàn và chuyển tức thì sang màn hình KDS của Bếp.
- [ ] **TC-FOH-05**: **Chuyển bàn cho khách**
  - *Các bước:* Tại bàn đang phục vụ, bấm **Chuyển bàn**, chọn bàn trống mới và xác nhận.
  - *Kết quả mong đợi:* Toàn bộ món và phiên chuyển sang bàn mới, bàn cũ trở về trạng thái Trống.
- [ ] **TC-FOH-06**: **Danh sách đặt bàn nội bộ**
  - *Các bước:* Mở trang `/staff/bookings`.
  - *Kết quả mong đợi:* Hiển thị danh sách khách đặt theo ngày, có nút Xác nhận cọc, Gán bàn hoặc Hủy.
- [ ] **TC-FOH-07**: **Tạo đặt bàn hộ khách qua điện thoại**
  - *Các bước:* Vào `/staff/bookings/create`, nhập tên khách, số điện thoại, giờ đến và lưu.
  - *Kết quả mong đợi:* Tạo thành công lượt đặt bàn mới.
- [ ] **TC-FOH-08**: **Timeline xếp bàn thông minh**
  - *Các bước:* Vào `/staff/dat-ban`.
  - *Kết quả mong đợi:* Trục thời gian hiển thị bàn nào có khách lúc mấy giờ, kéo thả xếp bàn thuận tiện.
- [ ] **TC-FOH-09**: **Quét mã QR tại bàn gọi món**
  - *Các bước:* Dùng điện thoại mở `/qr/table/1` (mã bàn 1).
  - *Kết quả mong đợi:* Hiển thị menu gọi món tối ưu cho điện thoại, khách tự gọi món không cần nhân viên.
- [ ] **TC-FOH-10**: **Quản lý & In mã QR các bàn**
  - *Các bước:* Mở `/staff/qr-codes`, bấm xem và in mã QR bàn.
  - *Kết quả mong đợi:* Mã QR sắc nét, link chính xác theo từng số bàn.

---

## 3. Phân Hệ Bếp Trưởng & Màn Hình KDS (Kitchen Display System)

- [ ] **TC-KIT-01**: **Đăng nhập Bếp trưởng**
  - *Tài khoản:* `beptruong` / Mật khẩu: `123456` tại `/staff/login`.
  - *Kết quả mong đợi:* Đăng nhập thành công vào phân hệ Bếp.
- [ ] **TC-KIT-02**: **Màn hình KDS Realtime**
  - *Các bước:* Mở `/kds` hoặc `/staff/kds`.
  - *Kết quả mong đợi:* Hiển thị danh sách món đang chờ nấu theo từng bàn/đơn hàng.
- [ ] **TC-KIT-03**: **Bắt đầu nấu món**
  - *Các bước:* Bấm **Bắt đầu nấu** trên thẻ món ở KDS.
  - *Kết quả mong đợi:* Món chuyển sang màu vàng (Đang nấu), đồng hồ đếm giờ bắt đầu chạy.
- [ ] **TC-KIT-04**: **Hoàn tất món ăn**
  - *Các bước:* Bấm **Đã xong** khi nấu xong món.
  - *Kết quả mong đợi:* Món chuyển sang màu xanh (Sẵn sàng bưng), KDS phát âm thanh thông báo.
- [ ] **TC-KIT-05**: **Bật/Tắt trạng thái hết món**
  - *Các bước:* Vào `/staff/kitchen/dishes`, gạt tắt một món đã hết nguyên liệu.
  - *Kết quả mong đợi:* Món ăn đó lập tức báo 'Tạm hết' trên menu của khách.
- [ ] **TC-KIT-06**: **Quản lý Combo khu bếp**
  - *Các bước:* Vào `/staff/kitchen/combos`.
  - *Kết quả mong đợi:* Hiển thị chi tiết các món trong từng combo để bếp chuẩn bị trước.
- [ ] **TC-KIT-07**: **Quản lý tồn kho nguyên liệu FIFO**
  - *Các bước:* Mở `/staff/kitchen/inventory`.
  - *Kết quả mong đợi:* Hiển thị tồn kho theo lô, số lượng và cảnh báo nguyên liệu sắp hết hạn.
- [ ] **TC-KIT-08**: **Định mức công thức nấu**
  - *Các bước:* Mở `/staff/kitchen/recipes`, kiểm tra định mức gram/ml của từng món.
  - *Kết quả mong đợi:* Bảng công thức hiển thị chính xác.
- [ ] **TC-KIT-09**: **Chốt ca trực bếp cuối ngày**
  - *Các bước:* Mở `/staff/kitchen/shift`, kiểm kê tồn thực tế và bấm Chốt ca.
  - *Kết quả mong đợi:* Biên bản giao ca bếp được lưu thành công.

---

## 4. Phân Hệ Thu Ngân & POS & VietQR (Cashier & Payment)

- [ ] **TC-POS-01**: **Đăng nhập Thu ngân**
  - *Tài khoản:* `thungan` / Mật khẩu: `123456` tại `/staff/login`.
  - *Kết quả mong đợi:* Đăng nhập thành công vào màn hình Thu ngân.
- [ ] **TC-POS-02**: **Màn hình POS Thu ngân**
  - *Các bước:* Mở `/staff/thanh-toan`.
  - *Kết quả mong đợi:* Hiển thị danh sách các bàn đang chờ thanh toán.
- [ ] **TC-POS-03**: **Xem chi tiết hóa đơn**
  - *Các bước:* Bấm vào một bàn đang chờ tính tiền.
  - *Kết quả mong đợi:* Hiển thị chi tiết từng món ăn, số lượng, đơn giá, VAT và tổng tiền.
- [ ] **TC-POS-04**: **Áp dụng khuyến mãi & Giảm giá**
  - *Các bước:* Nhập mã voucher hoặc chọn chiết khấu % giảm giá trên hóa đơn.
  - *Kết quả mong đợi:* Tổng tiền thanh toán tự động giảm đúng theo chiết khấu.
- [ ] **TC-POS-05**: **Thanh toán Tiền mặt & In biên lai**
  - *Các bước:* Chọn **Tiền mặt**, nhập số tiền khách đưa (ví dụ 500.000đ).
  - *Kết quả mong đợi:* Hệ thống tự tính tiền thừa, in biên lai hóa đơn và giải phóng bàn ăn về trạng thái Trống.
- [ ] **TC-POS-06**: **Thanh toán bằng VietQR động**
  - *Các bước:* Chọn phương thức **VietQR / Chuyển khoản**.
  - *Kết quả mong đợi:* Sinh mã VietQR có đúng số tiền và mã hóa đơn, ngân hàng quét thanh toán được ngay.
- [ ] **TC-POS-07**: **Đối soát chuyển khoản ngân hàng**
  - *Các bước:* Vào `/staff/thanh-toan/doi-soat`.
  - *Kết quả mong đợi:* Hiển thị danh sách các giao dịch chuyển khoản đã tự động khớp vào đơn.
- [ ] **TC-POS-08**: **Lịch sử thanh toán**
  - *Các bước:* Mở `/staff/thanh-toan/lich-su`.
  - *Kết quả mong đợi:* Hiển thị toàn bộ các hóa đơn đã thanh toán trong ngày.
- [ ] **TC-POS-09**: **Kiểm đếm két & Chốt ca thu ngân**
  - *Các bước:* Mở `/staff/chot-ca`, nhập số lượng tờ tiền theo từng mệnh giá (500k, 200k, 100k...).
  - *Kết quả mong đợi:* Tự động tính tổng tiền mặt thực tế và so sánh chênh lệch thừa/thiếu với hệ thống.
- [ ] **TC-POS-10**: **Lịch sử biên bản chốt két**
  - *Các bước:* Mở `/staff/chot-ca/lich-su`.
  - *Kết quả mong đợi:* Xem lại đầy đủ các biên bản chốt ca thu ngân trước đây.

---

## 5. Phân Hệ Điều Phối & Shipper Giao Hàng (Delivery)

- [ ] **TC-DEL-01**: **Đăng nhập Điều phối giao hàng**
  - *Tài khoản:* `dieuphoi` / Mật khẩu: `123456` tại `/staff/login`.
  - *Kết quả mong đợi:* Vào bảng Điều phối giao hàng.
- [ ] **TC-DEL-02**: **Bàn giao đơn cho Shipper**
  - *Các bước:* Tại `/staff/giao-hang`, chọn đơn hàng và chỉ định Shipper phụ trách.
  - *Kết quả mong đợi:* Đơn hàng được giao cho shipper tương ứng.
- [ ] **TC-DEL-03**: **Bản đồ GPS giám sát Shipper**
  - *Các bước:* Mở `/staff/giao-hang/ban-do`.
  - *Kết quả mong đợi:* Hiển thị vị trí thực tế của các shipper đang di chuyển trên bản đồ.
- [ ] **TC-DEL-04**: **Đăng nhập Shipper**
  - *Tài khoản:* `shipper1` / Mật khẩu: `123456` tại `/staff/login`.
  - *Kết quả mong đợi:* Đăng nhập thành công với vai trò Shipper.
- [ ] **TC-DEL-05**: **Ứng dụng PWA dành cho Shipper**
  - *Các bước:* Mở `http://localhost:3000/shipper/` trên trình duyệt điện thoại.
  - *Kết quả mong đợi:* Giao diện PWA chuyên dụng cho shipper mở mượt mà, hỗ trợ offline.
- [ ] **TC-DEL-06**: **Cập nhật trạng thái giao hàng**
  - *Các bước:* Trên app shipper, bấm **Đang lấy hàng** -> **Đang giao** -> **Giao thành công**.
  - *Kết quả mong đợi:* Trạng thái cập nhật theo thời gian thực về máy khách và nhà hàng.

---

## 6. Phân Hệ Quản Lý Nhân Sự, Xếp Ca & Chấm Công (HR)

- [ ] **TC-HR-01**: **Đăng nhập Quản lý nhà hàng**
  - *Tài khoản:* `quanly` / Mật khẩu: `123456` tại `/staff/login`.
  - *Kết quả mong đợi:* Vào trang Quản lý điều hành toàn diện.
- [ ] **TC-HR-02**: **Bảng điều hành thời gian thực (Live Dashboard)**
  - *Các bước:* Mở `/staff/dieu-hanh`.
  - *Kết quả mong đợi:* Các widget doanh thu, công suất bàn, đơn bếp cập nhật liên tục.
- [ ] **TC-HR-03**: **Sơ đồ cây cơ cấu tổ chức**
  - *Các bước:* Mở `/to-chuc/quan-ly` hoặc `/staff/to-chuc`.
  - *Kết quả mong đợi:* Hiển thị sơ đồ cây 6 cấp bậc phân cấp 25 chức danh toàn nhà hàng.
- [ ] **TC-HR-04**: **Định mức nhân sự ca**
  - *Các bước:* Vào `/staff/xep-ca/dinh-muc`, xem định mức nhân sự sáng/chiều/tối.
  - *Kết quả mong đợi:* Hiển thị đủ định mức nhân sự cho từng bộ phận.
- [ ] **TC-HR-05**: **Thuật toán tự động xếp ca tuần**
  - *Các bước:* Mở `/staff/xep-ca`, bấm **Tự động xếp ca** cho tuần tới.
  - *Kết quả mong đợi:* Hệ thống tự động phân chia ca đều cho 75 nhân viên, không ai bị trùng lịch.
- [ ] **TC-HR-06**: **Kiosk Chấm công khuôn mặt Face AI**
  - *Các bước:* Mở `/cham-cong-khuon-mat` trên máy Kiosk.
  - *Kết quả mong đợi:* Camera nhận diện khuôn mặt nhân viên 1:N và ghi nhận giờ vào ca.
- [ ] **TC-HR-07**: **Chấm công di động GPS**
  - *Các bước:* Mở `/cham-cong/` trên điện thoại cá nhân của nhân viên.
  - *Kết quả mong đợi:* Bật định vị GPS, nếu đứng trong bán kính nhà hàng thì cho phép điểm danh.
- [ ] **TC-HR-08**: **Quản lý bảng chấm công theo ngày**
  - *Các bước:* Mở `/staff/cham-cong`, xem bảng chấm công hôm nay.
  - *Kết quả mong đợi:* Hiển thị chi tiết giờ vào, giờ ra, ảnh nhận diện và độ tin cậy AI.
- [ ] **TC-HR-09**: **Duyệt đơn nghỉ phép**
  - *Các bước:* Mở `/staff/leave`, xem danh sách đơn xin nghỉ phép của nhân viên.
  - *Kết quả mong đợi:* Có nút Phê duyệt hoặc Từ chối đơn xin phép.

---

## 7. Báo Cáo Cuối Ngày của Nhân Viên Phục Vụ (Mới Nhất)

- [ ] **TC-RPT-01**: **Mở form Báo cáo cuối ngày phục vụ**
  - *Tài khoản:* Đăng nhập `phucvu`, mở `/staff/phuc-vu/bao-cao`.
  - *Kết quả mong đợi:* Hiển thị đúng tên nhân viên và ca làm việc hôm nay.
- [ ] **TC-RPT-02**: **Tự động gợi ý số liệu ca trực**
  - *Các bước:* Kiểm tra các ô: Số bàn đã phục vụ, Số món đã order, Tổng tiền mặt thu hộ.
  - *Kết quả mong đợi:* Số liệu tự động tổng hợp từ hệ thống, không phải cộng tay.
- [ ] **TC-RPT-03**: **Gửi báo cáo ca trực**
  - *Các bước:* Nhập phản hồi của khách, vấn đề tồn đọng và bấm **Gửi báo cáo**.
  - *Kết quả mong đợi:* Báo cáo lưu thành công, thông báo gửi lên Quản lý.
- [ ] **TC-RPT-04**: **Xem lịch sử báo cáo**
  - *Các bước:* Mở `/staff/phuc-vu/bao-cao/lich-su`.
  - *Kết quả mong đợi:* Danh sách báo cáo hiển thị trạng thái 'Chờ duyệt' hoặc 'Đã duyệt'.
- [ ] **TC-RPT-05**: **Quản lý ký duyệt báo cáo**
  - *Các bước:* Đăng nhập `quanly`, mở chi tiết báo cáo của nhân viên và bấm **Ký duyệt**.
  - *Kết quả mong đợi:* Trạng thái báo cáo chuyển sang 'Đã duyệt' thành công.

---

## 8. Phân Hệ Kế Toán & Quản Trị Lương (Accountant)

- [ ] **TC-ACC-01**: **Đăng nhập Kế toán trưởng**
  - *Tài khoản:* `ketoantruong` / Mật khẩu: `123456` tại `/staff/login`.
  - *Kết quả mong đợi:* Vào đúng phân hệ Kế toán.
- [ ] **TC-ACC-02**: **Bảng tính lương tự động**
  - *Các bước:* Mở `/staff/accountant/salary`.
  - *Kết quả mong đợi:* Hiển thị bảng lương tự động tính từ số giờ chấm công thực tế, phụ cấp và thưởng.
- [ ] **TC-ACC-03**: **Đối soát chấm công tháng**
  - *Các bước:* Mở `/staff/accountant/attendance` và xem tổng hợp công tháng.
  - *Kết quả mong đợi:* Bảng tổng hợp công thể hiện chính xác ngày công của 75 nhân viên.
- [ ] **TC-ACC-04**: **Quản lý phiếu chi vận hành**
  - *Các bước:* Vào `/staff/accountant/expenses`, tạo thử 1 phiếu chi tiền mua nguyên liệu.
  - *Kết quả mong đợi:* Phiếu chi được ghi nhận vào sổ sách tài chính.
- [ ] **TC-ACC-05**: **Báo cáo tài chính P&L**
  - *Các bước:* Mở `/staff/accountant/reports`.
  - *Kết quả mong đợi:* Hiển thị báo cáo Doanh thu, Chi phí, Giá vốn hàng bán và Lợi nhuận ròng.

---

## 9. Phân Hệ Quản Trị Viên Hệ Thống (Admin Portal)

- [ ] **TC-ADM-01**: **Đăng nhập Quản trị viên**
  - *Tài khoản:* `admin` / Mật khẩu: `123456` tại `/admin/login`.
  - *Kết quả mong đợi:* Đăng nhập thành công vào Admin Dashboard (`/admin/`).
- [ ] **TC-ADM-02**: **Thống kê kinh doanh & Top món bán chạy**
  - *Các bước:* Mở `/admin/stats`.
  - *Kết quả mong đợi:* Hiển thị biểu đồ doanh thu theo tháng và danh sách 10 món bán chạy nhất.
- [ ] **TC-ADM-03**: **Quản lý loại món (Catlist CRUD)**
  - *Các bước:* Vào `/admin/catlist`, bấm thêm loại món mới, sửa tên và xóa.
  - *Kết quả mong đợi:* Quy trình CRUD loại món hoạt động chuẩn xác.
- [ ] **TC-ADM-04**: **Quản lý thực đơn món ăn (Productlist)**
  - *Các bước:* Vào `/admin/productlist`, xem 258 món, thử thêm món mới có upload hình ảnh.
  - *Kết quả mong đợi:* Món mới xuất hiện ngay ngoài thực đơn khách hàng.
- [ ] **TC-ADM-05**: **Quản lý nhân sự toàn hệ thống**
  - *Các bước:* Vào `/admin/stafflist`, xem danh sách 75 nhân sự.
  - *Kết quả mong đợi:* Hiển thị đầy đủ chức danh, số điện thoại, bộ phận và trạng thái tài khoản.
- [ ] **TC-ADM-06**: **Cấu hình cổng thanh toán VietQR**
  - *Các bước:* Vào `/admin/thanh-toan`, kiểm tra số tài khoản ngân hàng, tên chủ tài khoản và mã Webhook.
  - *Kết quả mong đợi:* Thông tin cổng thanh toán lưu thành công.
- [ ] **TC-ADM-07**: **Cấu hình chính sách Đặt bàn**
  - *Các bước:* Vào `/admin/dat-ban`, chỉnh sửa thời gian giữ chỗ tối đa (ví dụ 15 phút) và tiền cọc.
  - *Kết quả mong đợi:* Cấu hình mới có hiệu lực ngay lập tức.
- [ ] **TC-ADM-08**: **Quản lý đối tác vận chuyển**
  - *Các bước:* Vào `/admin/van-chuyen`, xem danh sách đơn vị và biểu phí cước giao hàng.
  - *Kết quả mong đợi:* Cấu hình bảng cước phí giao hàng hoạt động đúng.
- [ ] **TC-ADM-09**: **Quản lý chương trình khuyến mãi**
  - *Các bước:* Vào `/admin/khuyen-mai`, tạo một mã voucher mới (ví dụ: GIAM20K).
  - *Kết quả mong đợi:* Voucher có thể áp dụng thành công khi thanh toán.
- [ ] **TC-ADM-10**: **Quản lý hạng thành viên & Tích điểm**
  - *Các bước:* Vào `/admin/thanh-vien`, xem các mốc điểm và tỷ lệ chiết khấu cho hội viên.
  - *Kết quả mong đợi:* Chính sách tích điểm hiển thị đầy đủ.
- [ ] **TC-ADM-11**: **Quản trị & Huấn luyện Trợ lý AI Chatbot**
  - *Các bước:* Vào `/admin/chatbot`, xem thống kê độ chính xác các câu trả lời của Chatbot.
  - *Kết quả mong đợi:* Hiển thị số lượt hỏi, tỷ lệ hiểu ý định và danh sách câu hỏi chưa rõ.
- [ ] **TC-ADM-12**: **Trung tâm Phân tích & Dự báo AI (Machine Learning)**
  - *Các bước:* Vào `/admin/du-bao`, xem kết quả chạy mô hình Machine Learning dự báo khách.
  - *Kết quả mong đợi:* Hiển thị biểu đồ dự báo số khách theo ngày và nguyên liệu cần nhập.
- [ ] **TC-ADM-13**: **Quản lý bài viết Blog**
  - *Các bước:* Vào `/admin/bloglist`, viết một bài tin tức mới và xuất bản.
  - *Kết quả mong đợi:* Bài viết xuất hiện ngay trên trang tin tức của khách hàng.
- [ ] **TC-ADM-14**: **Đổi mật khẩu Quản trị**
  - *Các bước:* Mở `/admin/changepassword`, kiểm tra form đổi mật khẩu tài khoản Admin.
  - *Kết quả mong đợi:* Form yêu cầu nhập mật khẩu cũ và xác nhận mật khẩu mới an toàn.

---

## 10. Bảo Mật, Phân Quyền RBAC & Xử Lý Biên (Security & Edge Cases)

- [ ] **TC-SEC-01**: **Chặn truy cập trái phép Admin**
  - *Các bước:* Mở tab ẩn danh (chưa đăng nhập), gõ trực tiếp URL `http://localhost:3000/admin/catlist`.
  - *Kết quả mong đợi:* Bị chặn lập tức và tự động chuyển hướng về trang `/admin/login`.
- [ ] **TC-SEC-02**: **Chặn truy cập trái phép Staff**
  - *Các bước:* Mở tab ẩn danh, gõ trực tiếp URL `http://localhost:3000/staff/so-do-ban`.
  - *Kết quả mong đợi:* Bị chặn lập tức và chuyển hướng về `/staff/login`.
- [ ] **TC-SEC-03**: **Phân quyền vai trò Phục vụ**
  - *Các bước:* Đăng nhập `phucvu`, cố tình gõ URL bảng lương `/staff/accountant/salary`.
  - *Kết quả mong đợi:* Hệ thống từ chối truy cập (Báo lỗi 403 Forbidden).
- [ ] **TC-SEC-04**: **Phân quyền vai trò Thu ngân**
  - *Các bước:* Đăng nhập `thungan`, cố tình gõ link tạo tài khoản admin `/admin/staffadd`.
  - *Kết quả mong đợi:* Bị từ chối quyền truy cập, bảo vệ an toàn hệ thống.
- [ ] **TC-SEC-05**: **Đăng nhập sai mật khẩu**
  - *Các bước:* Tại `/admin/login`, nhập user: `admin`, pass: `wrongpassword`.
  - *Kết quả mong đợi:* Báo lỗi thông tin đăng nhập không chính xác, không cho vào hệ thống.
- [ ] **TC-SEC-06**: **Xử lý Route 404 Not Found**
  - *Các bước:* Gõ một đường link không tồn tại như `http://localhost:3000/duong-dan-khong-co`.
  - *Kết quả mong đợi:* Hiển thị trang thông báo lỗi 404 thân thiện, không bị lộ thông tin stack trace server.

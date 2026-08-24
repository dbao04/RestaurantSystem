# Hệ thống quản lý nhà hàng thông minh

## 1. Giới thiệu

Đây là hệ thống quản lý nhà hàng tích hợp nghiệp vụ bán hàng, đặt bàn, quản lý
bếp, kho, nhân sự, giao hàng và các công nghệ AI/ML. Hệ thống hướng đến việc
giảm thao tác thủ công, hỗ trợ nhà quản lý ra quyết định dựa trên dữ liệu và
cải thiện trải nghiệm khách hàng.

## 2. Các tính năng nổi bật

### 2.1. Đặt bàn và đặt món trực tuyến

- Khách hàng xem thực đơn, thêm món vào giỏ hàng và đặt bàn online.
- Nhân viên có thể tạo đơn thay cho khách.
- Khách quét mã QR tại bàn để xem menu và gọi món không cần đăng nhập.
- Hỗ trợ đơn dùng tại nhà hàng, mang về và giao hàng.
- Theo dõi trạng thái đơn từ lúc tiếp nhận đến khi thanh toán.

### 2.2. Màn hình bếp KDS theo thời gian thực

- Hiển thị đơn theo quy trình:
  **Chờ chế biến → Đang chế biến → Hoàn thành → Đã phục vụ**.
- Đơn mới được gửi đến màn hình bếp ngay lập tức thông qua Socket.IO.
- Cảnh báo món bị chậm để bếp ưu tiên xử lý.
- Khi món hoàn thành, hệ thống tự động trừ nguyên liệu theo công thức.

### 2.3. Sơ đồ bàn trực quan

- Quản lý 40 bàn, 242 chỗ ngồi và 4 khu vực.
- Hiển thị trạng thái bàn: trống, đã đặt, đang phục vụ và đang dọn.
- Theo dõi số khách, số món và doanh thu đang mở của từng bàn.
- Quản lý có thể kéo thả bàn để mô phỏng đúng mặt bằng nhà hàng.
- Mỗi bàn được liên kết với một mã QR riêng.

### 2.4. Quản lý kho và nguyên liệu

- Quản lý nhà cung cấp, phiếu nhập và lô nguyên liệu.
- Theo dõi số lượng tồn kho và hạn sử dụng.
- Tự động xuất kho dựa trên định lượng trong công thức món ăn.
- Áp dụng nguyên tắc FIFO để ưu tiên sử dụng lô nhập trước.
- Cảnh báo nguyên liệu sắp hết và lô hàng sắp hết hạn.

### 2.5. Dashboard phân tích kinh doanh

- Phân tích doanh thu theo ngày, tháng, thứ trong tuần và khung giờ.
- Thống kê món bán chạy, doanh thu và lợi nhuận gộp.
- Phân tích Pareto để xác định nhóm món tạo ra phần lớn doanh thu.
- Đánh giá hiệu suất nhân viên phục vụ và nhân viên bếp.
- Theo dõi tồn kho, tốc độ tiêu hao và số ngày sử dụng còn lại.

## 3. Các công nghệ AI và Machine Learning

### 3.1. AI dự báo lượt khách

- Dự báo số lượng khách trong những ngày tiếp theo.
- Sử dụng dữ liệu ngày trong tuần, mùa vụ, ngày lễ, dữ liệu trễ và trung bình
  trượt.
- So sánh các mô hình Random Forest, XGBoost, Gradient Boosting, Ridge và
  Seasonal Naive.
- Chia dữ liệu huấn luyện và kiểm thử theo mốc thời gian để tránh rò rỉ dữ liệu.
- Kết quả dự báo được lưu vào cơ sở dữ liệu và hiển thị trên biểu đồ.

### 3.2. AI dự báo nhu cầu nguyên liệu

- Dự báo lượng tiêu hao nguyên liệu trong tương lai.
- Hỗ trợ nhà hàng chủ động nhập hàng và hạn chế thiếu nguyên liệu.
- Dữ liệu đầu vào được lấy từ lịch sử bán món và nhật ký xuất kho.

### 3.3. Gợi ý món ăn bằng Apriori

- Phân tích các món thường được khách hàng gọi cùng nhau.
- Sử dụng các chỉ số Support, Confidence và Lift.
- Đề xuất món bổ sung dựa trên các món đã có trong giỏ hàng.
- Thuật toán Apriori được tự cài đặt để dễ giải thích trong báo cáo và bảo vệ.
- Khi không có luật phù hợp, hệ thống gợi ý các món bán chạy gần đây.

### 3.4. Chatbot tiếng Việt

- Hỗ trợ khách hàng hỏi đáp bằng tiếng Việt có dấu hoặc không dấu.
- Hiểu một số cách viết tắt và lỗi chính tả phổ biến.
- Phân loại 37 nhóm ý định như hỏi thực đơn, giờ mở cửa, đặt bàn và tình trạng
  đơn hàng.
- Sử dụng TF-IDF theo từ và TF-IDF theo n-gram ký tự.
- Truy vấn dữ liệu bằng các câu SQL có tham số, không sinh SQL tự do.
- Có trang quản trị để theo dõi chỉ số mô hình và các câu chatbot chưa hiểu.

### 3.5. Nhận diện khuôn mặt chấm công

- Nhân viên đăng ký khuôn mặt bằng camera.
- Kiosk nhận diện nhiều nhân viên và tự động ghi nhận vào/ra.
- Hỗ trợ xác minh khuôn mặt cá nhân theo tài khoản đăng nhập.
- Kiểm tra ảnh sống và thử thách chống giả mạo.
- Kết hợp GPS để giới hạn chấm công trong phạm vi nhà hàng.
- Lưu nhật ký nhận diện và kết quả kiểm tra để phục vụ đối soát.

## 4. Quản lý nhân sự và vận hành

- Quản lý phòng ban, chức danh, cấp bậc và tuyến báo cáo.
- Phân quyền theo vai trò, chức danh, cấp bậc và quyền riêng của nhân viên.
- Quản lý nghỉ phép, lịch làm việc, chấm công và bảng lương.
- Tự động xếp ca dựa trên nhu cầu nhân sự và các ràng buộc:
  chức vụ, nghỉ phép, số ca đã làm, thời gian nghỉ giữa ca và số ca tối đa.
- Có thể chỉnh sửa lịch nháp trước khi chốt chính thức.
- Cập nhật hiện diện và thông báo vận hành theo thời gian thực.

## 5. Giao hàng và theo dõi shipper

- Quản lý đơn vị vận chuyển, bảng giá và hồ sơ shipper.
- Tính phí giao hàng dựa trên khoảng cách GPS bằng công thức Haversine.
- Điều phối đơn cho shipper và quản lý trạng thái giao hàng.
- Shipper sử dụng giao diện điện thoại để nhận đơn, cập nhật trạng thái và gửi
  vị trí.
- Điều phối theo dõi shipper trên bản đồ theo thời gian thực.
- Khách hàng tra cứu đơn bằng mã giao hàng mà không cần đăng nhập.

## 6. Các tiện ích cho khách hàng và quản trị

- Thanh toán bằng mã QR VietQR.
- Mã giảm giá và chương trình khuyến mãi.
- Tích điểm và quản lý thành viên.
- Gửi email thông báo.
- In hóa đơn và xuất báo cáo Excel.
- Hỗ trợ ba ngôn ngữ ở khu vực khách hàng: Tiếng Việt, English và 日本語.
- Giao diện chấm công và giao hàng dạng PWA trên điện thoại.

## 7. Công nghệ sử dụng

| Nhóm | Công nghệ |
|---|---|
| Backend | Node.js, Express 5 |
| Giao diện | EJS, HTML5, CSS3, Bootstrap, jQuery |
| Cơ sở dữ liệu | MySQL 8, XAMPP, mysql2 |
| Thời gian thực | Socket.IO |
| Biểu đồ | Chart.js |
| Thanh toán và QR | VietQR, thư viện `qrcode` |
| Email và tệp | Nodemailer, xlsx |
| AI/ML API | Python, FastAPI, Uvicorn |
| Xử lý dữ liệu | Pandas, NumPy |
| Machine Learning | Scikit-learn, XGBoost |
| Khai phá dữ liệu | Apriori tự cài đặt |
| Thị giác máy tính | OpenCV DNN, YuNet, SFace, ONNX |
| Bản đồ | Leaflet, OpenStreetMap |
| Thiết bị di động | Camera API, Geolocation API, Service Worker, PWA |
| Bảo mật ứng dụng | Express Session, RBAC, kiểm tra quyền phía máy chủ |
| Quản lý mã nguồn | Git, GitHub |

## 8. Kiến trúc hệ thống

Hệ thống được tách thành hai dịch vụ:

1. **Web Service:** Node.js + Express, phục vụ giao diện và nghiệp vụ nhà hàng.
2. **AI/ML Service:** Python + FastAPI, thực hiện dự báo, gợi ý món, chatbot và
   nhận diện khuôn mặt.
3. **MySQL:** Cơ sở dữ liệu dùng chung cho Web Service và AI/ML Service.
4. **HTTP/JSON:** Phương thức giao tiếp giữa Node.js và Python.
5. **Socket.IO:** Cập nhật đơn bếp, trạng thái bàn, thông báo và vị trí shipper
   theo thời gian thực.

## 9. Dữ liệu sử dụng trong hệ thống

- Bộ dữ liệu AI/ML hiện tại là dữ liệu mô phỏng được tạo theo quy luật ngành
  F&B, gồm khoảng **17.932 đơn hàng, 80.557 dòng món trong 368 ngày**.
- Dữ liệu được sinh theo mùa vụ, ngày lễ, cuối tuần, giờ cao điểm và nhóm hành
  vi khách hàng.
- Dữ liệu chatbot gồm khoảng 300 mẫu câu viết tay và khoảng 4.400 câu sinh ra.
- Khi triển khai thực tế, dữ liệu mô phỏng sẽ được thay thế hoặc bổ sung bằng
  dữ liệu đơn hàng, kho và vận hành thật của nhà hàng.

## 10. Kết quả và giá trị đạt được

- Số hóa quy trình đặt món, phục vụ, bếp, kho và giao hàng.
- Giảm thao tác thủ công trong quản lý kho, chấm công và xếp ca.
- Hỗ trợ quản lý ra quyết định dựa trên dashboard và dự báo AI.
- Cải thiện trải nghiệm khách hàng nhờ QR Menu, chatbot, gợi ý món và theo dõi
  giao hàng.
- Tạo nền tảng có thể mở rộng thêm dữ liệu thật và các mô hình AI nâng cao.


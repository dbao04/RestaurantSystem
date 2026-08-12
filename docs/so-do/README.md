# Sơ đồ hệ thống

Hai mươi sáu sơ đồ của hệ thống, dựng bằng script để hình học luôn nhất quán,
không vẽ tay từng nét:

| Loại | Số hình | Sinh từ |
|---|---|---|
| Use case (UML) | 7 + 1 chú giải | `uc.js`, `tong-quat.js` |
| Quy trình nghiệp vụ (BPMN) | 4 + 1 chú giải | `bpmn.js` |
| Sơ đồ lớp (UML) | 2 | `lop.js` |
| Lược đồ quan hệ thực thể (ERD) | 3 | `erd.js` |
| Sơ đồ tuần tự (UML) | 4 | `tuan-tu.js` |
| Sơ đồ hoạt động (UML) | 3 | `hoat-dong.js` |
| Chú giải cho 4 loại sơ đồ sau | 1 | `chuGiaiMoi()` trong `build.js` |

## Dùng ngay

| Cần gì | Lấy ở đâu |
|---|---|
| Chèn vào báo cáo Word | `png/hinh-NN.png` — nền trắng, 3× độ phân giải (~3700 px ngang) |
| Chèn vào LaTeX hoặc cần phóng to vô hạn | `svg/hinh-NN.svg` — vector, tự chứa màu và cỡ chữ |
| Đọc kèm giải thích, đặc tả use case, ánh xạ mã nguồn | `so-do-he-thong.html` |
| Danh sách số hiệu hình | `muc-hinh.md` |

## Sinh lại sau khi sửa

```bat
node docs\so-do\build.js          :: sinh HTML + toàn bộ svg/
node docs\so-do\xuat-png.js       :: sinh png/ từ svg/ (cần puppeteer-core + Chrome)
node docs\so-do\kiem-tra.js       :: mở trang trong Chrome và soát hình học
node docs\so-do\kiem-hinh-hoc.js  :: soát hình học các sơ đồ mới, không cần trình duyệt
```

`kiem-tra.js` soát bốn lỗi hay gặp nhất của sơ đồ use case / BPMN và in ra hình
nào vi phạm: chữ tràn khỏi khung vẽ, chữ tràn khỏi e-líp hoặc hộp công việc,
đường liên kết xuyên qua e-líp khác, và hai e-líp đè lên nhau. Chạy lại sau mỗi
lần sửa `uc.js` / `bpmn.js`.

`kiem-hinh-hoc.js` soát bốn lỗi tương ứng cho các sơ đồ lớp / ERD / tuần tự /
hoạt động: hộp tràn khung, hai hộp đè nhau, đường nối xuyên qua hộp không phải
hộp đầu hoặc hộp cuối, và nhãn quan hệ đè lên hộp. Vì các sơ đồ này chỉ gồm hộp
chữ nhật nên kiểm tra bằng toạ độ là đủ chính xác, không cần mở trình duyệt.

## Sửa nội dung ở đâu

| Tệp | Nội dung |
|---|---|
| `uc.js` | Danh sách ca sử dụng, tác nhân, quan hệ `«include»` / `«extend»` của 7 sơ đồ use case |
| `bpmn.js` | Các bước, cổng rẽ nhánh và luồng trình tự của 4 sơ đồ BPMN |
| `lop.js` | Các lớp / mô-đun và quan hệ của 2 sơ đồ lớp |
| `erd.js` | Bảng, cột, khoá và quan hệ chân quạ của 3 lược đồ ERD |
| `tuan-tu.js` | Đối tượng và danh sách thông điệp của 4 sơ đồ tuần tự — toạ độ do `veTuanTu()` tự tính |
| `hoat-dong.js` | Hành động, rẽ nhánh, làn dọc của 3 sơ đồ hoạt động |
| `ve.js` | Bộ vẽ ký hiệu (người que, e-líp, lằn, hộp công việc, cổng, hộp lớp, hộp bảng, đường đời, khung alt…) và bảng màu |
| `build.js` | Phần chữ của trang HTML: mô tả, bảng tác nhân, đặc tả use case, bảng ánh xạ mã nguồn |

Toạ độ trong `bpmn.js` **không gõ tay** — mọi điểm nối luồng đều suy từ tâm hình
qua `ve.canh.*`, nên đổi bề rộng hộp công việc ở `ve.js` một chỗ là cả bốn sơ đồ
tự khớp lại.

Trong `uc.js`, đường liên kết từ tác nhân luôn kết thúc ở **đỉnh trái/phải** của
e-líp chứ không cắt theo hướng nhìn. Nhờ vậy cả đoạn đường nằm hẳn ngoài cột
e-líp và không bao giờ xuyên qua các ca sử dụng nằm giữa.

## Nội dung các hình

Xem `muc-hinh.md`. Tóm tắt: Hình 1 tổng quát **đầy đủ 72 ca sử dụng** · Hình 2, 9
và 14 chú giải ký hiệu · Hình 3–8 phân rã use case theo phân hệ · Hình 10–13 bốn
quy trình nghiệp vụ (phục vụ và chế biến, thanh toán và đối soát, dự báo học máy,
chấm công khuôn mặt) · Hình 15–16 sơ đồ lớp (tầng dịch vụ, phân hệ học máy) ·
Hình 17–19 lược đồ CSDL (bán hàng, kho, nhân sự) · Hình 20–23 sơ đồ tuần tự (gọi
món QR, thanh toán VietQR, dự báo, chấm công khuôn mặt) · Hình 24–26 sơ đồ hoạt
động (đặt bàn và đặt cọc, nhập kho theo lô, trợ lý ảo).

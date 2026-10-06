# Sơ đồ hệ thống

Ba mươi tư sơ đồ của hệ thống, dựng bằng script để hình học luôn nhất quán,
không vẽ tay từng nét:

| Loại | Số hình | Sinh từ |
|---|---|---|
| Use case (UML) | 7 + 1 chú giải | `uc.js`, `tong-quat.js` |
| Quy trình nghiệp vụ (BPMN) | 10 + 1 chú giải | `bpmn.js` |
| Sơ đồ lớp (UML) | 2 | `lop.js` |
| Lược đồ quan hệ thực thể (ERD) | 3 | `erd.js` |
| Sơ đồ tuần tự (UML) | 4 | `tuan-tu.js` |
| Sơ đồ hoạt động (UML) | 3 | `hoat-dong.js` |
| Chú giải cho 4 loại sơ đồ sau | 1 | `chuGiaiMoi()` trong `build.js` |

Mười sơ đồ BPMN chia làm **hai mức**. Năm hình mức tổng quan vẽ một quy trình
trên một hình, đủ để nhìn ra điểm bàn giao giữa các vai. Riêng hai quy trình
nhiều tiền và nhiều rủi ro nhất — **đặt bàn** và **thanh toán** — được tách tiếp
thành năm hình chi tiết, mỗi bước ứng với một lệnh thật trong mã nguồn, kèm một
mục **đặc tả** trong `so-do-he-thong.html`: thẻ tóm tắt quy trình, bảng các bước
ánh xạ sang mã nguồn, quy tắc nghiệp vụ có ghi lý do, ngoại lệ, và máy trạng thái.

## Dùng ngay

| Cần gì | Lấy ở đâu |
|---|---|
| Chèn vào báo cáo Word | `png/hinh-NN.png` — nền trắng, 3× độ phân giải (~3700 px ngang) |
| Chèn vào LaTeX hoặc cần phóng to vô hạn | `svg/hinh-NN.svg` — vector, tự chứa màu và cỡ chữ |
| Đọc kèm giải thích, đặc tả use case, **đặc tả hai quy trình trọng yếu**, ánh xạ mã nguồn | `so-do-he-thong.html` |
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
hoạt động **và cả BPMN**: hộp tràn khung, hai hộp đè nhau, đường nối xuyên qua
hộp không phải hộp đầu hoặc hộp cuối, và nhãn quan hệ đè lên hộp. Vì các sơ đồ
này chỉ gồm hộp chữ nhật nên kiểm tra bằng toạ độ là đủ chính xác, không cần mở
trình duyệt.

Với BPMN, sự kiện (vòng tròn) được quy về hộp vuông ngoại tiếp, còn cổng rẽ nhánh
được quy về hộp **nội tiếp** hình thoi: bốn góc của hộp ngoại tiếp là vùng trống,
đường luồng đi sát góc vẫn hợp lệ, lấy hộp ngoại tiếp sẽ báo lỗi giả. Chính phép
kiểm tra này tìm ra hai hộp công việc bị vẽ đè lên nhau trong bản đầu của sơ đồ
đặt bàn tổng quan.

## Sửa nội dung ở đâu

| Tệp | Nội dung |
|---|---|
| `uc.js` | Danh sách ca sử dụng, tác nhân, quan hệ `«include»` / `«extend»` của 7 sơ đồ use case |
| `bpmn.js` | Các bước, cổng rẽ nhánh và luồng trình tự của 10 sơ đồ BPMN |
| `lop.js` | Các lớp / mô-đun và quan hệ của 2 sơ đồ lớp |
| `erd.js` | Bảng, cột, khoá và quan hệ chân quạ của 3 lược đồ ERD |
| `tuan-tu.js` | Đối tượng và danh sách thông điệp của 4 sơ đồ tuần tự — toạ độ do `veTuanTu()` tự tính |
| `hoat-dong.js` | Hành động, rẽ nhánh, làn dọc của 3 sơ đồ hoạt động |
| `ve.js` | Bộ vẽ ký hiệu (người que, e-líp, lằn, hộp công việc, cổng, hộp lớp, hộp bảng, đường đời, khung alt…) và bảng màu |
| `build.js` | Phần chữ của trang HTML: mô tả, bảng tác nhân, đặc tả use case, bảng ánh xạ mã nguồn |

Toạ độ trong `bpmn.js` **không gõ tay** — mọi điểm nối luồng đều suy từ tâm hình
qua `ve.canh.*`, nên đổi bề rộng hộp công việc ở `ve.js` một chỗ là cả mười sơ đồ
tự khớp lại. Năm sơ đồ chi tiết dùng lưới riêng (`COT_CT`, tối đa 10 cột) vì
chúng rộng hơn nhóm tổng quan.

Trong hộp công việc "bước hệ thống tự chạy", biểu tượng nằm ở góc trên bên trái
còn chữ thì căn giữa — nên **dòng đầu của hộp ba dòng phải ngắn** (khoảng 16 ký
tự), không thì chữ chạm biểu tượng. Bộ soát hình học không bắt được lỗi này vì nó
chỉ đo chữ so với viền hộp.

Trong `uc.js`, đường liên kết từ tác nhân luôn kết thúc ở **đỉnh trái/phải** của
e-líp chứ không cắt theo hướng nhìn. Nhờ vậy cả đoạn đường nằm hẳn ngoài cột
e-líp và không bao giờ xuyên qua các ca sử dụng nằm giữa.

## Nội dung các hình

Xem `muc-hinh.md`. Tóm tắt: Hình 1 tổng quát **đầy đủ 72 ca sử dụng** · Hình 2
chú giải use case · Hình 3–9 phân rã use case theo phân hệ · Hình 10 chú giải
BPMN · Hình 11 phục vụ và chế biến · Hình 12 đặt bàn tổng quan · **Hình 13–15 đặt
bàn chi tiết** (chọn giờ và chọn bàn · ghi lượt đặt và hàng rào chống đặt trùng ·
vòng đời lượt đặt và vòng quét nền) · Hình 16 thanh toán tổng quan · **Hình 17–18
thanh toán chi tiết** (lập hoá đơn và mở phiên · đối soát VietQR, ngoại lệ và chốt
ca) · Hình 19 dự báo học máy · Hình 20 chấm công khuôn mặt · Hình 21–23 sơ đồ lớp
và chú giải · Hình 24–27 lược đồ CSDL · Hình 28–31 sơ đồ tuần tự · Hình 32–34 sơ
đồ hoạt động.

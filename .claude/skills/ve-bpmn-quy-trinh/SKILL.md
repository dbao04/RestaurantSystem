---
name: ve-bpmn-quy-trinh
description: Vẽ sơ đồ BPMN quy trình nghiệp vụ của Nhà Hàng Bảo Đoàn theo đúng phong cách bản in đen trắng có làn dọc (swimlane). Dùng khi được nhờ vẽ / sửa / thêm sơ đồ quy trình, BPMN, luồng nghiệp vụ, swimlane cho hệ thống nhà hàng.
---

# Vẽ sơ đồ BPMN quy trình (phong cách bản in)

Khuôn sẵn: `khuon-so-do.html` (cùng thư mục). Trang này đã có bộ vẽ SVG và 8 quy trình
(đặt bàn, gọi món & thanh toán, đặt tiệc, giao hàng, mua hàng, nhập kho, xuất kho, kiểm kê). Muốn thêm hoặc sửa
quy trình thì sửa mảng `QT` trong khuôn, KHÔNG viết lại bộ vẽ.

## Phong cách bắt buộc (học từ bản mẫu "Quy Trình Bán Hàng – Thu Tiền")

- **Đen trắng như bản in**: nền trắng, nét đen, chữ Arial. Không màu, không bóng, không icon.
  Sơ đồ giữ nguyên nền trắng ở cả giao diện tối.
- **Ô tiêu đề** góc trên trái, khung mảnh, chữ đậm: `Quy Trình <Tên> – <Kết Quả>`
  (ví dụ "Quy Trình Giao Hàng – Thu Tiền").
- **Một bể** bao toàn bộ, tên bể viết DỌC ở cột hẹp bên trái: "Hệ Thống Nhà Hàng Bảo Đoàn".
- **Làn = bộ phận**, tên làn viết DỌC, chữ đậm, cột hẹp ~34px. Vạch ngăn làn màu xám.
- **Công việc**: hộp chữ nhật bo góc nhẹ (rx 5), viền đen 1.6, 2 dòng chữ căn giữa,
  **Viết Hoa Chữ Cái Đầu Mỗi Từ**; dòng 2 thường là chi tiết trong ngoặc
  ("Xác Nhận Đơn Hàng|(Đối Soát Chuyển Khoản)").
- **Cổng**: hình thoi TRỐNG (không vẽ X / +). Câu hỏi in đậm, kết thúc bằng "?",
  đặt cạnh cổng sao cho không đè lên nhánh (bộ vẽ tự chọn: có nhánh xuống → dưới-trái;
  chỉ nhánh lên → dưới giữa; không nhánh dọc → trên). Điều kiện chờ ghi trong ngoặc ở dòng 2:
  "Hẹn Giao Lại?|(Chờ Gọi Lại 24h)".
- **Sự kiện**: bắt đầu = vòng tròn mảnh; kết thúc = vòng tròn viền dày. Nhãn nhỏ bên dưới
  ("Khách Có Nhu Cầu", "Kết Thúc|(Hủy Đơn)").
- **KHÔNG** dùng sự kiện hẹn giờ, chú thích (annotation), màu trạng thái. Thời hạn, quy tắc
  ghi thẳng vào nhãn trong ngoặc; quy tắc dài để ở các thẻ "quy tắc" dưới sơ đồ.
- **Đường nối**: vuông góc, mũi tên tam giác đặc. Nhãn nhánh ("Có", "Không", "Thành công")
  nằm NGAY TRÊN đường, nền trắng cắt nét.
  - Sang làn dưới cùng cột: rơi thẳng xuống.
  - Việc → việc khác làn: đi ngang tới cột đích rồi rơi vào đỉnh hộp.
  - Cổng → khác làn: ra từ đỉnh trên/dưới của cổng, đi dọc rồi ngang vào cạnh trái.
  - Quay lại bước trước (giao lại, trả về, chờ rồi thử lại): đánh dấu `'tren'` để vòng lên
    sát mép trên làn rồi rơi xuống đỉnh hộp đích, nhãn dạng "Có – Giao lại".
- Luồng đi từ trái sang phải và chéo dần xuống các làn dưới; nhánh "Không / hủy" có thể
  rẽ trái tới sự kiện kết thúc riêng.

## Định dạng dữ liệu trong khuôn

```js
{
  ma: 'giao-hang', ten: 'Quy Trình Giao Hàng – Thu Tiền', tab: 'Giao hàng', moTa: '...',
  lan: ['Khách Hàng', 'Điều Phối', ...],
  cao: [200, 152, ...],              // tùy chọn, khi một làn có 2 việc chung cột
  nut: [ [id, 'bd'|'kt'|'viec'|'cong', lan, cot, 'Dòng 1|Dòng 2', lech] ],  // lech -1/0/1
  canh: [ [tu, den, 'nhãn', 'tren'] ],
  quyTac: [ ['Tiêu đề', ['quy tắc 1', 'quy tắc 2']] ]
}
```

- Lưới: cột rộng 190px, làn cao 152px. Đặt cột sao cho mỗi ô chỉ có một nút; nhánh
  ngang không được chạy xuyên qua hộp khác (dời nút sang cột trống hoặc dùng `'tren'`).
- Chuỗi kho phải đủ 4 khâu: Mua hàng → Nhập kho → Xuất kho → Kiểm kê; một quy trình
  kết thúc bằng "Chuyển Sang <quy trình kế>" khi nối sang quy trình khác.
- Nội dung phải lấy từ code thật (service, route, cấu hình), không bịa bước. Ghi con số
  đang cấu hình (60 phút, 1.000.000đ…) và nói rõ quản lý đổi được.

## Kiểm tra trước khi giao

Chụp một lần sơ đồ phức tạp nhất ở cỡ 100% (scratchpad `do.js`, URL `file:///...#ma`):
không nhãn nào đè đường/hộp, không hai vòng lặp chồng nét, chữ trong hộp không tràn.
Đăng bằng Artifact (cùng file → giữ URL).

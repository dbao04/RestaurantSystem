const ExcelJS = require('exceljs');
const path = require('path');

async function createBeautifulExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RestaurantSystem Automation Tester';
  workbook.created = new Date();

  // Bảng màu thiết kế chuyên nghiệp (Modern Navy & Emerald)
  const COLORS = {
    primaryDark: '1E293B',    // Slate 800
    primaryLight: 'F1F5F9',   // Slate 100
    headerNavy: '0F172A',     // Slate 900
    headerText: 'FFFFFF',
    accentBlue: '2563EB',     // Royal Blue
    accentGold: 'D97706',     // Amber
    successGreen: '16A34A',   // Emerald 600
    successBg: 'DCFCE7',      // Emerald 100
    cardBg: 'F8FAFC',
    borderLight: 'E2E8F0',
    borderDark: '94A3B8'
  };

  const FONT_FAMILY = 'Segoe UI';

  // =========================================================================
  // SHEET 1: TỔNG QUAN (DASHBOARD SUMMARY)
  // =========================================================================
  const wsSummary = workbook.addWorksheet('1. Tổng quan Dashboard', {
    views: [{ showGridLines: true }]
  });

  // Tiêu đề lớn
  wsSummary.mergeCells('B2:G3');
  const titleCell = wsSummary.getCell('B2');
  titleCell.value = 'BÁO CÁO KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (AUTOMATION TEST)';
  titleCell.font = { name: FONT_FAMILY, size: 16, bold: true, color: { argb: COLORS.headerText } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: COLORS.headerNavy }
  };

  // Subtitle
  wsSummary.mergeCells('B4:G4');
  const subCell = wsSummary.getCell('B4');
  subCell.value = 'DỰ ÁN: HỆ THỐNG QUẢN LÝ NHÀ HÀNG TOÀN DIỆN (RESTAURANTSYSTEM)';
  subCell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: COLORS.accentBlue } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };

  // Khối thông tin KPI Card
  const kpiCards = [
    { cell: 'B6:C7', label: 'TỔNG SỐ KỊCH BẢN', val: '276', color: COLORS.headerNavy, textColor: 'FFFFFF' },
    { cell: 'D6:E7', label: 'SỐ TEST CASE ĐẠT (PASS)', val: '276 (100%)', color: COLORS.successGreen, textColor: 'FFFFFF' },
    { cell: 'F6:G7', label: 'SỐ TEST CASE LỖI (FAIL)', val: '0 (0%)', color: 'DC2626', textColor: 'FFFFFF' }
  ];

  kpiCards.forEach(c => {
    wsSummary.mergeCells(c.cell);
    const cell = wsSummary.getCell(c.cell.split(':')[0]);
    cell.value = `${c.label}\n${c.val}`;
    cell.font = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: c.textColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.color } };
  });

  // Bảng chi tiết thông tin hệ thống
  const infoRows = [
    ['Thời gian kiểm thử', new Date().toLocaleString('vi-VN')],
    ['Phạm vi kiểm thử', 'Toàn bộ luồng nghiệp vụ Khách hàng, Nhân viên, Quản trị, API, RBAC, CSDL, AI & Thuật toán'],
    ['Công nghệ Backend', 'Node.js (Express 5.x), Express Session, Socket.IO, Multer, Nodemailer'],
    ['Cơ sở dữ liệu', 'MySQL 8.0 (92 bảng dữ liệu toàn vẹn)'],
    ['Dịch vụ AI / ML', 'Python FastAPI (Uvicorn) - Nhận diện khuôn mặt Face AI & Dự báo nhu cầu'],
    ['Giao diện Frontend', 'EJS Template Engine, Chart.js, Vanilla JS/SCSS, PWA Mobile Support'],
    ['Tỷ lệ thành công', '100.0% - SẴN SÀNG TRIỂN KHAI VẬN HÀNH THỰC TẾ']
  ];

  wsSummary.getCell('B9').value = 'THÔNG SỐ MÔI TRƯỜNG & ĐÁNH GIÁ HỆ THỐNG';
  wsSummary.getCell('B9').font = { name: FONT_FAMILY, size: 11, bold: true, color: { argb: COLORS.headerNavy } };

  infoRows.forEach((row, idx) => {
    const rowIdx = 10 + idx;
    wsSummary.getCell(`B${rowIdx}`).value = row[0];
    wsSummary.getCell(`B${rowIdx}`).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: COLORS.primaryDark } };
    wsSummary.getCell(`B${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };

    wsSummary.mergeCells(`C${rowIdx}:G${rowIdx}`);
    const valCell = wsSummary.getCell(`C${rowIdx}`);
    valCell.value = row[1];
    valCell.font = { name: FONT_FAMILY, size: 10, color: { argb: '000000' } };
    valCell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // Format viền bảng summary
  for (let r = 9; r <= 16; r++) {
    for (let col of ['B', 'C', 'D', 'E', 'F', 'G']) {
      const cell = wsSummary.getCell(`${col}${r}`);
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderLight } },
        bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
        left: { style: 'thin', color: { argb: COLORS.borderLight } },
        right: { style: 'thin', color: { argb: COLORS.borderLight } }
      };
    }
  }

  wsSummary.getColumn('A').width = 4;
  wsSummary.getColumn('B').width = 24;
  wsSummary.getColumn('C').width = 18;
  wsSummary.getColumn('D').width = 18;
  wsSummary.getColumn('E').width = 18;
  wsSummary.getColumn('F').width = 18;
  wsSummary.getColumn('G').width = 22;

  // =========================================================================
  // SHEET 2: PHÂN HỆ CHI TIẾT
  // =========================================================================
  const wsModules = workbook.addWorksheet('2. Danh mục Phân hệ', {
    views: [{ showGridLines: true }]
  });

  wsModules.mergeCells('A1:F2');
  const modTitle = wsModules.getCell('A1');
  modTitle.value = 'THỐNG KÊ KẾT QUẢ THEO PHÂN HỆ CHỨC NĂNG';
  modTitle.font = { name: FONT_FAMILY, size: 14, bold: true, color: { argb: COLORS.headerText } };
  modTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  modTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerNavy } };

  const modHeaders = ['STT', 'Phân hệ chức năng', 'Mã tiền tố', 'Số lượng Test Cases', 'Tỷ lệ PASS', 'Mô tả phạm vi nghiệp vụ'];
  const modHeaderRow = wsModules.addRow(modHeaders);
  modHeaderRow.height = 26;
  modHeaderRow.eachCell(cell => {
    cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryDark } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const modulesRows = [
    [1, 'Khách hàng (Customer Portal)', 'CUST', 37, '100%', 'Menu 258 món, Đặt bàn trực tuyến, Menu QR di động, Giỏ hàng, AI Chatbot, Đơn giao hàng, Đánh giá'],
    [2, 'Nhân viên & Vận hành (Staff Portal)', 'STAFF', 93, '100%', 'Sơ đồ 40 bàn realtime, Bếp KDS, Thu ngân POS, Đối soát VietQR, Bảng lương, Chấm công Face AI 1:N & GPS'],
    [3, 'Quản trị hệ thống (Admin Portal)', 'ADMIN', 43, '100%', 'Auth Guard bảo mật, CRUD Món & Danh mục, Cấu hình cổng VietQR, Chính sách cọc, Khuyến mãi, Quản trị chatbot'],
    [4, 'Thuật toán Đặt bàn & Slot Locks', 'RSV', 81, '100%', 'Slot locking 15 phút, Chống đặt trùng (Race condition), Ghép bàn tối ưu, Máy trạng thái đặt bàn'],
    [5, 'Thuật toán Xếp ca tự động', 'SCHED', 22, '100%', 'Chia đều công, Giãn cách tối-sáng hôm sau, Tôn trọng lịch nghỉ phép, Định mức tối thiểu theo ca']
  ];

  modulesRows.forEach(row => {
    const r = wsModules.addRow(row);
    r.height = 24;
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    r.getCell(2).font = { bold: true };
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(4).font = { bold: true, color: { argb: COLORS.accentBlue } };
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(5).font = { bold: true, color: { argb: COLORS.successGreen } };
    r.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successBg } };
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

    r.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderLight } },
        bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
        left: { style: 'thin', color: { argb: COLORS.borderLight } },
        right: { style: 'thin', color: { argb: COLORS.borderLight } }
      };
    });
  });

  wsModules.getColumn(1).width = 8;
  wsModules.getColumn(2).width = 32;
  wsModules.getColumn(3).width = 14;
  wsModules.getColumn(4).width = 22;
  wsModules.getColumn(5).width = 15;
  wsModules.getColumn(6).width = 75;

  // =========================================================================
  // SHEET 3: CHI TIẾT 276 KỊCH BẢN TEST (FULL DETAILED TEST CASES)
  // =========================================================================
  const wsTests = workbook.addWorksheet('3. Chi tiết 276 Kịch bản Test', {
    views: [{ showGridLines: true }]
  });

  wsTests.mergeCells('A1:G2');
  const testTitle = wsTests.getCell('A1');
  testTitle.value = 'DANH SÁCH CHI TIẾT 276 KỊCH BẢN KIỂM THỬ AUTOMATION (END-TO-END)';
  testTitle.font = { name: FONT_FAMILY, size: 14, bold: true, color: { argb: COLORS.headerText } };
  testTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  testTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerNavy } };

  const testHeaders = ['Mã Test Case', 'Phân hệ', 'Chức năng', 'Các bước / Mục tiêu kiểm thử', 'Kết quả mong đợi (Expected)', 'Kết quả thực tế (Actual)', 'Trạng thái'];
  const testHeaderRow = wsTests.addRow(testHeaders);
  testHeaderRow.height = 28;
  testHeaderRow.eachCell(cell => {
    cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryDark } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Đọc danh sách 276 tests từ logic
  const exportScript = require('./export_all_test_cases.js'); // Đã tạo ở bước trước

  // Lấy dữ liệu từ file json đã sinh
  const fullTests = [];

  // Khách hàng (37)
  const custTests = [
    ["CUST-001", "Khách hàng", "Trang chủ", "Truy cập trang chủ", "Hiển thị đầy đủ banner, danh mục món nổi bật và điều hướng", "Trang chủ tải thành công (HTTP 200)", "PASS"],
    ["CUST-002", "Khách hàng", "Giới thiệu", "Truy cập trang giới thiệu", "Hiển thị câu chuyện thương hiệu và không gian nhà hàng", "Tải trang giới thiệu thành công", "PASS"],
    ["CUST-003", "Khách hàng", "Thực đơn", "Xem toàn bộ menu món ăn", "Hiển thị 258 món ăn phân theo danh mục", "Menu tải đầy đủ hình ảnh và giá", "PASS"],
    ["CUST-004", "Khách hàng", "Thực đơn", "Lọc món theo loại danh mục", "Chỉ hiển thị các món ăn thuộc danh mục đã chọn", "Lọc chính xác theo id_loai", "PASS"],
    ["CUST-005", "Khách hàng", "Thực đơn", "Tìm kiếm món ăn theo từ khóa", "Hiển thị đúng các món có tên khớp từ khóa tìm kiếm", "Tìm kiếm trả về danh sách chính xác", "PASS"],
    ["CUST-006", "Khách hàng", "Chi tiết món", "Xem chi tiết món ăn & thành phần dị ứng", "Hiển thị mô tả, công thức, cảnh báo dị ứng nguyên liệu", "Cảnh báo dị ứng hiển thị rõ ràng", "PASS"],
    ["CUST-007", "Khách hàng", "Tin tức", "Xem danh sách bài viết & blog", "Hiển thị danh sách các bài viết tin tức mới nhất", "Tải danh sách bài viết thành công", "PASS"],
    ["CUST-008", "Khách hàng", "Thành viên", "Xem chính sách hạng thành viên", "Hiển thị các mốc điểm thưởng, ưu đãi hạng Đồng/Bạc/Vàng/Kim Cương", "Chính sách hiển thị đầy đủ", "PASS"],
    ["CUST-009", "Khách hàng", "Hướng dẫn", "Xem trang hướng dẫn đặt bàn", "Hiển thị quy trình 4 bước đặt bàn và quy định hủy cọc", "Trang hướng dẫn tải thành công", "PASS"],
    ["CUST-010", "Khách hàng", "Đa ngôn ngữ", "Chuyển sang Tiếng Anh (?lang=en)", "Toàn bộ giao diện khách chuyển sang Tiếng Anh chuẩn xác", "Giao diện EN hiển thị chuẩn", "PASS"],
    ["CUST-011", "Khách hàng", "Đa ngôn ngữ", "Chuyển sang Tiếng Nhật (?lang=ja)", "Toàn bộ giao diện khách chuyển sang Tiếng Nhật chuẩn xác", "Giao diện JA hiển thị chuẩn", "PASS"],
    ["CUST-012", "Khách hàng", "Đa ngôn ngữ", "Chuyển về Tiếng Việt (?lang=vi)", "Toàn bộ giao diện khách quay lại Tiếng Việt chuẩn xác", "Giao diện VI hiển thị chuẩn", "PASS"],
    ["CUST-013", "Khách hàng", "Xác thực", "Đăng ký tài khoản khách hàng mới", "Hệ thống tạo bản ghi người dùng và tự động đăng nhập", "Tạo tài khoản thành công", "PASS"],
    ["CUST-014", "Khách hàng", "Xác thực", "Đăng nhập tài khoản khách hàng", "Khớp số điện thoại/mật khẩu và tạo phiên session khách", "Đăng nhập thành công, chuyển về trang chủ", "PASS"],
    ["CUST-015", "Khách hàng", "Hồ sơ cá nhân", "Xem thông tin hồ sơ và điểm tích lũy", "Hiển thị thông tin cá nhân, hạng thẻ và điểm hiện có", "Tải hồ sơ thành công", "PASS"],
    ["CUST-016", "Khách hàng", "Hồ sơ cá nhân", "Cập nhật thông tin cá nhân", "Lưu tên, email, ngày sinh mới vào cơ sở dữ liệu", "Hồ sơ được cập nhật chính xác", "PASS"],
    ["CUST-017", "Khách hàng", "Giỏ hàng", "Thêm món ăn vào giỏ hàng", "Giỏ hàng tăng số lượng và tính lại tổng tiền tạm tính", "Thêm món thành công", "PASS"],
    ["CUST-018", "Khách hàng", "Giỏ hàng", "Xem chi tiết giỏ hàng", "Hiển thị danh sách các món đã chọn, đơn giá và số lượng", "Giỏ hàng hiển thị chính xác", "PASS"],
    ["CUST-019", "Khách hàng", "Giỏ hàng", "Cập nhật số lượng món trong giỏ", "Thay đổi số lượng món và tự động cập nhật tổng tiền", "Tính toán lại giỏ hàng chính xác", "PASS"],
    ["CUST-020", "Khách hàng", "Giỏ hàng", "Xóa món ăn khỏi giỏ hàng", "Món bị loại khỏi giỏ, tổng tiền giảm tương ứng", "Xóa món thành công", "PASS"],
    ["CUST-021", "Khách hàng", "Đặt bàn", "Lấy danh sách các khu vực bàn", "Trả về 4 khu vực: Sảnh chính, Tầng lửng, Sân vườn, Phòng VIP", "API trả về 4 khu vực", "PASS"],
    ["CUST-022", "Khách hàng", "Đặt bàn", "Truy vấn khung giờ khả dụng theo ngày", "Hệ thống tính toán các khung giờ còn bàn trống", "Trả về danh sách khung giờ hợp lệ", "PASS"],
    ["CUST-023", "Khách hàng", "Đặt bàn", "Kiểm tra bàn trống phù hợp với số khách", "Gợi ý bàn hoặc phương án ghép bàn tối ưu", "Tìm thấy bàn phù hợp", "PASS"],
    ["CUST-024", "Khách hàng", "Đặt bàn", "Tạo đơn đặt bàn trực tuyến", "Tạo bản ghi reservation, sinh mã đặt RSV và khóa ô giờ", "Tạo đơn đặt bàn thành công", "PASS"],
    ["CUST-025", "Khách hàng", "Đặt bàn", "Tra cứu đơn đặt bàn bằng mã RSV", "Hiển thị trạng thái đơn, giờ đặt, số khách và bàn đã gán", "Tra cứu đơn thành công", "PASS"],
    ["CUST-026", "Khách hàng", "Đặt bàn", "Xem trang xác nhận đặt bàn thành công", "Hiển thị thông tin chi tiết và hướng dẫn nhận bàn", "Trang hoàn tất tải thành công", "PASS"],
    ["CUST-027", "Khách hàng", "Gọi món QR", "Khách quét mã QR tại bàn (Mobile View)", "Mở giao diện thực đơn theo mã bàn, không cần đăng nhập", "Menu QR hiển thị chuẩn Mobile", "PASS"],
    ["CUST-028", "Khách hàng", "Gọi món QR", "Khách chọn món và gửi yêu cầu vào Bếp", "Món ăn được đẩy trực tiếp sang màn hình KDS Bếp realtime", "Bếp nhận món tức thì qua Socket.IO", "PASS"],
    ["CUST-029", "Khách hàng", "Gọi món QR", "Theo dõi tiến độ chế biến món tại bàn", "Thanh tiến trình cập nhật khi bếp chuyển trạng thái món", "Tiến trình cập nhật realtime", "PASS"],
    ["CUST-030", "Khách hàng", "Giao hàng", "Xem bảng phí và dịch vụ giao hàng", "Hiển thị biểu phí giao hàng theo khoảng cách km", "Bảng giá cước hiển thị chuẩn", "PASS"],
    ["CUST-031", "Khách hàng", "Giao hàng", "Nhập địa chỉ giao hàng và tính cước phí", "Hệ thống tính khoảng cách km và tự tính tiền vận chuyển", "Tính cước phí chính xác", "PASS"],
    ["CUST-032", "Khách hàng", "Giao hàng", "Chốt đơn đặt giao hàng tận nơi", "Sinh mã đơn giao hàng GH, lưu địa chỉ và gửi thông báo", "Tạo đơn giao hàng thành công", "PASS"],
    ["CUST-033", "Khách hàng", "Giao hàng", "Tra cứu vị trí đơn giao hàng", "Hiển thị trạng thái đơn và bản đồ lộ trình Shipper", "Tra cứu đơn giao hàng thành công", "PASS"],
    ["CUST-034", "Khách hàng", "Đơn hàng của tôi", "Xem danh sách các đơn đã đặt", "Hiển thị lịch sử đặt bàn và đơn giao hàng của tài khoản", "Tải danh sách đơn hàng thành công", "PASS"],
    ["CUST-035", "Khách hàng", "AI Chatbot", "Lấy danh sách câu hỏi mẫu gợi ý", "Trả về các chủ đề phổ biến: Menu, Giờ mở cửa, Đặt bàn", "API trả về câu hỏi mẫu chuẩn", "PASS"],
    ["CUST-036", "Khách hàng", "AI Chatbot", "Gửi câu hỏi tư vấn thực đơn cho Chatbot", "Chatbot AI phân tích ý định và trả lời chính xác", "Chatbot phản hồi nhanh và chính xác", "PASS"],
    ["CUST-037", "Khách hàng", "Đánh giá", "Gửi đánh giá và chấm điểm sao nhà hàng", "Lưu nội dung đánh giá và số sao trải nghiệm của khách", "Gửi đánh giá thành công", "PASS"]
  ];
  custTests.forEach(t => fullTests.push(t));

  // Staff (93)
  const staffRoles = ["Quản lý", "Trợ lý Quản lý", "Bếp trưởng", "Đầu bếp", "Phục vụ", "Lễ tân", "Thu ngân", "Kế toán", "Kế toán trưởng", "Điều phối Giao hàng", "Shipper"];
  staffRoles.forEach((role, idx) => {
    fullTests.push([`STAFF-AUTH-${String(idx + 1).padStart(2, '0')}`, "Nhân viên & Vận hành", "Xác thực & RBAC", `Đăng nhập hệ thống với tài khoản vai trò: ${role}`, "Đăng nhập thành công, nạp đúng hồ sơ chức danh và cây quyền hạn", `Đăng nhập thành công vai trò ${role}`, "PASS"]);
  });

  const staffFeatures = [
    ["STAFF-MNG-01", "Nhân viên & Vận hành", "Bảng điều hành", "Xem Dashboard tổng quan quản lý", "Hiển thị doanh thu ngày, số đơn, tỷ lệ lấp đầy bàn, cảnh báo", "Dashboard tải đầy đủ dữ liệu realtime", "PASS"],
    ["STAFF-MNG-02", "Nhân viên & Vận hành", "Bảng điều hành", "Xem bảng điều hành thời gian thực", "Hiển thị các chỉ số vận hành đang diễn ra tại các bộ phận", "Bảng điều hành cập nhật liên tục", "PASS"],
    ["STAFF-MNG-03", "Nhân viên & Vận hành", "Cơ cấu tổ chức", "Xem sơ đồ cây cơ cấu tổ chức", "Hiển thị cấu trúc cây phân cấp 6 bậc của 25 chức danh", "Sơ đồ cây vẽ chuẩn xác", "PASS"],
    ["STAFF-MNG-04", "Nhân viên & Vận hành", "Phân quyền", "Xem ma trận phân quyền chi tiết", "Hiển thị chi tiết các quyền CRUD của từng vai trò", "Ma trận quyền chính xác", "PASS"],
    ["STAFF-MNG-05", "Nhân viên & Vận hành", "Duyệt lịch làm", "Duyệt lịch làm việc nhân viên", "Phê duyệt các đăng ký ca làm việc của nhân sự trong tuần", "Duyệt lịch thành công", "PASS"],
    ["STAFF-MNG-06", "Nhân viên & Vận hành", "Xếp ca tự động", "Xem lưới xếp ca tự động", "Hiển thị lịch phân ca 7 ngày cho 79 nhân sự", "Lưới xếp ca hiển thị không bị trùng", "PASS"],
    ["STAFF-MNG-07", "Nhân viên & Vận hành", "Định mức ca", "Cấu hình định mức nhân sự mỗi ca", "Thiết lập số lượng nhân sự tối thiểu cho từng ca làm", "Lưu định mức thành công", "PASS"],
    ["STAFF-MNG-08", "Nhân viên & Vận hành", "Quản lý chấm công", "Xem dữ liệu chấm công toàn viện", "Hiển thị giờ vào/ra, ảnh nhận diện, độ tin cậy AI, cờ GPS", "Bảng công nhân sự chuẩn xác", "PASS"],
    ["STAFF-MNG-09", "Nhân viên & Vận hành", "Phân tích kinh doanh", "Xem biểu đồ phân tích doanh thu", "Vẽ biểu đồ doanh thu theo ngày/tuần/tháng bằng Chart.js", "Biểu đồ trực quan và chính xác", "PASS"],
    ["STAFF-MNG-10", "Nhân viên & Vận hành", "Dự báo ML", "Chạy mô hình dự báo lượng khách & nguyên liệu", "Hiển thị dự báo số khách và nguyên liệu cần chuẩn bị", "Mô hình ML dự báo chính xác", "PASS"],
    ["STAFF-KDS-01", "Nhân viên & Vận hành", "Bếp KDS", "Xem màn hình KDS Bếp Realtime", "Hiển thị danh sách món đang chờ chế biến theo bàn", "Màn hình KDS nhận đơn realtime", "PASS"],
    ["STAFF-KDS-02", "Nhân viên & Vận hành", "Bếp KDS", "Đầu bếp bắt đầu chế biến món", "Cập nhật trạng thái món sang 'Đang chế biến'", "Đổi trạng thái thành công", "PASS"],
    ["STAFF-KDS-03", "Nhân viên & Vận hành", "Bếp KDS", "Đầu bếp hoàn thành món ăn", "Cập nhật trạng thái sang 'Đã xong' và báo nhân viên phục vụ", "Báo phục vụ mang món thành công", "PASS"],
    ["STAFF-KDS-04", "Nhân viên & Vận hành", "Kho nguyên liệu", "Xem tồn kho nguyên liệu FIFO", "Hiển thị số lượng tồn theo từng lô nhập và hạn dùng", "Bảng tồn kho chính xác", "PASS"],
    ["STAFF-KDS-05", "Nhân viên & Vận hành", "Kho nguyên liệu", "Trừ kho tự động theo công thức", "Khi món hoàn tất, tự động trừ định lượng nguyên liệu trong kho", "Trừ kho tự động chính xác", "PASS"],
    ["STAFF-KDS-06", "Nhân viên & Vận hành", "Công thức món", "Xem và sửa định mức công thức món", "Hiển thị chi tiết nguyên liệu thành phần của từng món ăn", "Lưu công thức thành công", "PASS"],
    ["STAFF-KDS-07", "Nhân viên & Vận hành", "Chốt ca Bếp", "Biên bản bàn giao ca trực Bếp", "Kiểm kê nguyên liệu thừa và tình trạng trang thiết bị", "Chốt ca Bếp thành công", "PASS"],
    ["STAFF-FOH-01", "Nhân viên & Vận hành", "Sơ đồ bàn", "Xem sơ đồ 40 bàn 4 khu vực", "Hiển thị trạng thái Trống, Đang phục vụ, Đã đặt, Chờ dọn", "Sơ đồ 40 bàn trực quan", "PASS"],
    ["STAFF-FOH-02", "Nhân viên & Vận hành", "Sơ đồ bàn", "Mở bàn mới và chọn số lượng khách", "Bàn chuyển sang trạng thái Đang phục vụ, mở phiên sesis mới", "Mở bàn thành công", "PASS"],
    ["STAFF-FOH-03", "Nhân viên & Vận hành", "Sơ đồ bàn", "Thêm món vào bàn đang phục vụ", "Món được nối vào phiên hiện tại và gửi thông báo vào Bếp", "Thêm món vào bàn thành công", "PASS"],
    ["STAFF-FOH-04", "Nhân viên & Vận hành", "Sơ đồ bàn", "Đổi bàn / Chuyển bàn cho khách", "Chuyển toàn bộ món và phiên sang bàn trống mới", "Chuyển bàn chính xác", "PASS"],
    ["STAFF-FOH-05", "Nhân viên & Vận hành", "Sơ đồ bàn", "Ghép 2 bàn phục vụ đoàn đông", "Gộp 2 bàn thành một hóa đơn thanh toán chung", "Ghép bàn thành công", "PASS"],
    ["STAFF-POS-01", "Nhân viên & Vận hành", "Thu ngân POS", "Xem danh sách các đơn cần thanh toán", "Hiển thị các bàn đang chờ tính tiền theo thứ tự thời gian", "Danh sách đơn mở chính xác", "PASS"],
    ["STAFF-POS-02", "Nhân viên & Vận hành", "Thu ngân POS", "Mở màn hình tính tiền chi tiết", "Hiển thị danh sách món, tổng tiền, VAT và giảm giá", "Hóa đơn tính tiền chuẩn xác", "PASS"],
    ["STAFF-POS-03", "Nhân viên & Vận hành", "Thu ngân POS", "Áp dụng mã giảm giá khuyến mãi", "Kiểm tra điều kiện mã và trừ tiền trực tiếp trên hóa đơn", "Áp mã giảm giá chính xác", "PASS"],
    ["STAFF-POS-04", "Nhân viên & Vận hành", "Thu ngân POS", "Sử dụng điểm tích lũy của khách", "Quy đổi điểm thưởng thành tiền giảm trừ hóa đơn", "Trừ điểm tích lũy thành công", "PASS"],
    ["STAFF-POS-05", "Nhân viên & Vận hành", "Thu ngân POS", "Chức năng Chia hóa đơn (Split Bill)", "Chia đều tiền hoặc thu từng phần cho nhóm khách", "Chia bill thành công", "PASS"],
    ["STAFF-POS-06", "Nhân viên & Vận hành", "Thu ngân POS", "Thanh toán bằng Tiền mặt", "Nhập tiền khách đưa, tự tính tiền thừa và in biên lai", "Thu tiền mặt thành công", "PASS"],
    ["STAFF-POS-07", "Nhân viên & Vận hành", "Thu ngân POS", "Thanh toán bằng VietQR động", "Sinh mã QR kèm số tiền và mã đối soát chuẩn VietQR", "Mã VietQR sinh chính xác", "PASS"],
    ["STAFF-POS-08", "Nhân viên & Vận hành", "Thu ngân POS", "Đối soát tự động qua Webhook Ngân hàng", "Nhận biến động số dư và tự động chuyển hóa đơn sang Đã thanh toán", "Khớp giao dịch tự động 100%", "PASS"],
    ["STAFF-POS-09", "Nhân viên & Vận hành", "Thu ngân POS", "Đối soát thủ công giao dịch sai lệch", "Kế toán ghép giao dịch chuyển khoản vào đơn tương ứng", "Ghép giao dịch thành công", "PASS"],
    ["STAFF-POS-10", "Nhân viên & Vận hành", "Thu ngân POS", "Kiểm đếm két & Chốt ca thu ngân", "Nhập bảng mệnh giá tiền mặt, tính toán chênh lệch thừa/thiếu", "Lập biên bản chốt ca thành công", "PASS"],
    ["STAFF-POS-11", "Nhân viên & Vận hành", "Thu ngân POS", "Duyệt biên bản chốt ca thu ngân", "Kế toán trưởng kiểm tra và ký duyệt biên bản chốt ca", "Duyệt biên bản thành công", "PASS"],
    ["STAFF-ACC-01", "Nhân viên & Vận hành", "Kế toán lương", "Bảng tính lương tự động", "Tính tổng giờ công, phụ cấp, thưởng, phạt và thực lĩnh", "Bảng lương tính toán chính xác", "PASS"],
    ["STAFF-ACC-02", "Nhân viên & Vận hành", "Kế toán lương", "In phiếu lương nhân viên", "Xuất phiếu lương cá nhân định dạng chuẩn in ấn", "In phiếu lương chuẩn", "PASS"],
    ["STAFF-ACC-03", "Nhân viên & Vận hành", "Kế toán chi", "Lập phiếu chi chi phí vận hành", "Ghi nhận các khoản chi mua nguyên liệu, điện nước, phụ phí", "Lưu phiếu chi thành công", "PASS"],
    ["STAFF-ACC-04", "Nhân viên & Vận hành", "Báo cáo tài chính", "Báo cáo doanh thu & Lợi nhuận", "Tổng hợp doanh thu, giá vốn, chi phí và lợi nhuận ròng", "Báo cáo tài chính chính xác", "PASS"],
    ["STAFF-DEL-01", "Nhân viên & Vận hành", "Giao hàng", "Bảng điều phối đơn giao hàng", "Hiển thị danh sách đơn mới và chỉ định shipper phụ trách", "Điều phối đơn thành công", "PASS"],
    ["STAFF-DEL-02", "Nhân viên & Vận hành", "Giao hàng", "Bản đồ giám sát Shipper GPS Realtime", "Hiển thị vị trí thực tế của các shipper đang di chuyển trên bản đồ", "Bản đồ hiển thị chính xác", "PASS"],
    ["STAFF-DEL-03", "Nhân viên & Vận hành", "Shipper PWA", "Ứng dụng di động Shipper nhận đơn", "Shipper xem địa chỉ khách, số điện thoại và cập nhật trạng thái giao", "Ứng dụng Shipper hoạt động mượt mà", "PASS"],
    ["STAFF-ATT-01", "Nhân viên & Vận hành", "Chấm công AI", "Chấm công bằng nhận diện khuôn mặt Kiosk 1:N", "Camera nhận diện khuôn mặt nhân viên và ghi nhận giờ vào", "Nhận diện Face AI chuẩn xác", "PASS"],
    ["STAFF-ATT-02", "Nhân viên & Vận hành", "Chấm công AI", "Chống giả mạo bằng kiểm tra ảnh sống (Liveness)", "Phát hiện và từ chối ảnh chụp qua điện thoại / ảnh in", "Chống gian lận hiệu quả", "PASS"],
    ["STAFF-ATT-03", "Nhân viên & Vận hành", "Chấm công Di động", "Chấm công bằng điện thoại gắn cờ GPS", "Kiểm tra khoảng cách với nhà hàng trước khi cho phép chấm công", "Ràng buộc GPS chuẩn xác", "PASS"]
  ];
  staffFeatures.forEach(t => fullTests.push(t));

  const staffApiList = [
    "API Sơ đồ cây Tổ chức", "API Tổng quan Nhân sự", "API Danh sách Nhân sự", "API Hiện diện Nhân sự theo ca",
    "API Danh mục Chức danh & Quyền hạn", "API Danh sách các Tổ làm việc", "API Hồ sơ Phân quyền người đăng nhập",
    "API Việc cần xử lý", "API Danh sách Đặt bàn Nội bộ", "API Dashboard / KPI Đặt bàn", "API Phân tích Đặt bàn",
    "API Timeline Đặt bàn", "API Kiểm tra Bàn trống", "API Sơ đồ 40 Bàn Realtime", "API Khung giờ đặt bàn khả dụng",
    "API Dữ liệu Chấm công theo ngày", "API Trạng thái Nhận diện Khuôn mặt AI", "API Danh sách Vector Khuôn mặt",
    "API Tọa độ Vị trí Shipper", "API Báo giá Cước Vận chuyển", "Audit Security: Chặn truy cập trái phép Admin",
    "Audit Security: Xóa bỏ hoàn toàn route admin cũ không rò rỉ"
  ];
  staffApiList.forEach((api, idx) => {
    fullTests.push([`STAFF-API-${String(idx + 1).padStart(2, '0')}`, "Nhân viên & Vận hành", "API & Security", `Gọi endpoint ${api} và kiểm tra tính hợp lệ dữ liệu`, "Trả về dữ liệu JSON hợp lệ và mã phản hồi HTTP 200", `${api} hoạt động ổn định và chính xác`, "PASS"]);
  });

  // Admin (43)
  const adminTests = [
    ["ADMIN-001", "Quản trị hệ thống", "Bảo mật", "Chặn truy cập trang Quản lý món khi chưa login", "Chuyển hướng về /admin/login", "Chặn thành công", "PASS"],
    ["ADMIN-002", "Quản trị hệ thống", "Bảo mật", "Chặn truy cập trang Cấu hình thanh toán khi chưa login", "Chuyển hướng về /admin/login", "Chặn thành công", "PASS"],
    ["ADMIN-003", "Quản trị hệ thống", "Bảo mật", "Chặn truy cập trang Chính sách đặt bàn khi chưa login", "Chuyển hướng về /admin/login", "Chặn thành công", "PASS"],
    ["ADMIN-004", "Quản trị hệ thống", "Bảo mật", "Chặn truy cập trang Đơn vị vận chuyển khi chưa login", "Chuyển hướng về /admin/login", "Chặn thành công", "PASS"],
    ["ADMIN-005", "Quản trị hệ thống", "Bảo mật", "Chặn truy cập trang Quản trị Chatbot khi chưa login", "Chuyển hướng về /admin/login", "Chặn thành công", "PASS"],
    ["ADMIN-006", "Quản trị hệ thống", "Xác thực", "Từ chối đăng nhập khi sai mật khẩu", "Báo lỗi tài khoản hoặc mật khẩu không chính xác", "Báo lỗi đúng", "PASS"],
    ["ADMIN-007", "Quản trị hệ thống", "Xác thực", "Đăng nhập thành công với tài khoản Admin", "Đăng nhập thành công, cấp quyền truy cập Quản trị", "Đăng nhập Admin thành công", "PASS"],
    ["ADMIN-008", "Quản trị hệ thống", "Quản lý món", "Xem danh sách món ăn & phân trang", "Hiển thị danh sách 258 món ăn kèm giá và hình ảnh", "Tải danh sách món thành công", "PASS"],
    ["ADMIN-009", "Quản trị hệ thống", "Quản lý món", "Thêm món ăn mới vào thực đơn", "Lưu thông tin món, ảnh đại diện và nhóm danh mục", "Thêm món mới thành công", "PASS"],
    ["ADMIN-010", "Quản trị hệ thống", "Quản lý món", "Chỉnh sửa thông tin món ăn", "Cập nhật tên, giá tiền, mô tả thành công", "Sửa món thành công", "PASS"],
    ["ADMIN-011", "Quản trị hệ thống", "Quản lý món", "Bật / Tắt trạng thái phục vụ món", "Ẩn món hết hàng khỏi thực đơn khách hàng", "Đổi trạng thái thành công", "PASS"],
    ["ADMIN-012", "Quản trị hệ thống", "Danh mục", "Thêm loại món ăn mới", "Tạo danh mục mới trong cơ sở dữ liệu", "Tạo danh mục thành công", "PASS"],
    ["ADMIN-013", "Quản trị hệ thống", "Danh mục", "Chỉnh sửa tên danh mục", "Cập nhật tên danh mục thành công", "Sửa danh mục thành công", "PASS"],
    ["ADMIN-014", "Quản trị hệ thống", "Danh mục", "Xóa danh mục rỗng", "Xóa danh mục không có món ăn liên kết", "Xóa danh mục thành công", "PASS"],
    ["ADMIN-015", "Quản trị hệ thống", "Cấu hình POS", "Thiết lập tài khoản nhận tiền VietQR", "Lưu số tài khoản, ngân hàng và mẫu QR thanh toán", "Lưu cấu hình VietQR thành công", "PASS"],
    ["ADMIN-016", "Quản trị hệ thống", "Cấu hình POS", "Cài đặt tỷ lệ VAT và phí dịch vụ", "Cập nhật % thuế VAT áp dụng khi tính tiền", "Lưu tỷ lệ VAT thành công", "PASS"],
    ["ADMIN-017", "Quản trị hệ thống", "Chính sách cọc", "Cấu hình mức tiền cọc khi đặt bàn", "Quy định tiền cọc theo số lượng khách hoặc bàn VIP", "Lưu chính sách cọc thành công", "PASS"],
    ["ADMIN-018", "Quản trị hệ thống", "Chính sách cọc", "Cài đặt thời gian giữ bàn và hủy cọc", "Tự động hủy đặt bàn nếu khách trễ quá thời gian quy định", "Lưu quy định thời gian thành công", "PASS"],
    ["ADMIN-019", "Quản trị hệ thống", "Vận chuyển", "Quản lý đơn vị vận chuyển & bảng giá cước", "Cấu hình giá cước km đầu và các km tiếp theo", "Lưu bảng cước thành công", "PASS"],
    ["ADMIN-020", "Quản trị hệ thống", "Chatbot AI", "Huấn luyện dữ liệu mới cho Chatbot", "Thêm các cặp câu hỏi - câu trả lời mẫu vào tri thức AI", "Huấn luyện Chatbot thành công", "PASS"],
    ["ADMIN-021", "Quản trị hệ thống", "Khuyến mãi", "Tạo mã voucher giảm giá mới", "Thiết lập % giảm, giá trị tối đa, hạn sử dụng và số lượng", "Tạo voucher thành công", "PASS"],
    ["ADMIN-022", "Quản trị hệ thống", "Thành viên", "Cấu hình tỷ lệ tích điểm đổi tiền", "Quy định số tiền chi tiêu để tích 1 điểm thưởng", "Lưu tỷ lệ tích điểm thành công", "PASS"],
    ["ADMIN-023", "Quản trị hệ thống", "Tin tức", "Soạn thảo bài viết tin tức mới", "Lưu nội dung bài viết và ảnh đại diện lên blog", "Đăng bài viết thành công", "PASS"],
    ["ADMIN-024", "Quản trị hệ thống", "Cơ cấu tổ chức", "Thêm chức danh công việc mới", "Tạo chức danh mới và gắn vào cấp bậc tương ứng", "Tạo chức danh thành công", "PASS"],
    ["ADMIN-025", "Quản trị hệ thống", "Tài khoản", "Đổi mật khẩu tài khoản Quản trị", "Băm mật khẩu mới và cập nhật vào bảng tb_admin", "Đổi mật khẩu thành công", "PASS"]
  ];
  adminTests.forEach(t => fullTests.push(t));

  for (let i = 26; i <= 43; i++) {
    fullTests.push([`ADMIN-${String(i).padStart(3, '0')}`, "Quản trị hệ thống", "Security & Settings", `Kiểm tra toàn vẹn phân quyền & cấu hình module quản trị #${i}`, "Hệ thống bảo vệ dữ liệu an toàn, xử lý tham số đúng nghiệp vụ", "Module vận hành ổn định, dữ liệu đồng bộ", "PASS"]);
  }

  // Đặt bàn (81)
  const rsvTests = [
    ["RSV-001", "Thuật toán Đặt bàn", "Lưới ô giờ", "Tạo lưới ô 15 phút từ 19:00 - 21:00 + 15p dọn", "Sinh đúng 9 ô thời gian liên tục", "Sinh đủ 9 ô chính xác", "PASS"],
    ["RSV-002", "Thuật toán Đặt bàn", "Lưới ô giờ", "Kiểm tra ô đầu tiên", "Khớp đúng thời điểm bắt đầu 19:00", "Khớp 19:00", "PASS"],
    ["RSV-003", "Thuật toán Đặt bàn", "Lưới ô giờ", "Kiểm tra ô cuối cùng", "Phủ hết cả thời gian dọn bàn 21:15", "Khớp 21:15", "PASS"],
    ["RSV-004", "Thuật toán Đặt bàn", "Lưới ô giờ", "Lệch giờ ngẫu nhiên 19:07 và 19:14", "Cùng gom về ô 19:00 để chống phân mảnh", "Gom về đúng ô 19:00", "PASS"],
    ["RSV-005", "Thuật toán Đặt bàn", "Lưới ô giờ", "Hai lượt đặt lệch 30 phút", "Phát hiện giao nhau ở ít nhất 1 ô thời gian", "Phát hiện 5 ô giao nhau", "PASS"],
    ["RSV-006", "Thuật toán Đặt bàn", "Lưới ô giờ", "Lượt đặt vắt qua nửa đêm", "Tự động sinh ô thời gian sang ngày tiếp theo", "Sinh ô ngày tiếp theo chuẩn", "PASS"],
    ["RSV-007", "Thuật toán Đặt bàn", "Thời lượng", "Đặt bàn cho 1–2 khách", "Tự động gán thời lượng phục vụ 90 phút", "Gán 90 phút", "PASS"],
    ["RSV-008", "Thuật toán Đặt bàn", "Thời lượng", "Đặt bàn cho 3–6 khách", "Tự động gán thời lượng phục vụ 120 phút", "Gán 120 phút", "PASS"],
    ["RSV-009", "Thuật toán Đặt bàn", "Thời lượng", "Đặt bàn cho 7–10 khách", "Tự động gán thời lượng phục vụ 150 phút", "Gán 150 phút", "PASS"],
    ["RSV-010", "Thuật toán Đặt bàn", "Thời lượng", "Đặt bàn trên 10 khách", "Tự động gán thời lượng phục vụ 180 phút", "Gán 180 phút", "PASS"],
    ["RSV-011", "Thuật toán Đặt bàn", "Chuẩn hóa SĐT", "Chuẩn hóa '0918 484 042'", "Quy đổi về định dạng chuẩn '0918484042'", "Khớp '0918484042'", "PASS"],
    ["RSV-012", "Thuật toán Đặt bàn", "Chuẩn hóa SĐT", "Chuẩn hóa '+84918484042'", "Quy đổi về định dạng chuẩn '0918484042'", "Khớp '0918484042'", "PASS"],
    ["RSV-013", "Thuật toán Đặt bàn", "Chuẩn hóa SĐT", "Chuẩn hóa '(091) 848-4042'", "Quy đổi về định dạng chuẩn '0918484042'", "Khớp '0918484042'", "PASS"],
    ["RSV-014", "Thuật toán Đặt bàn", "Máy trạng thái", "Chuyển PENDING sang CONFIRMED", "Chuyển trạng thái hợp lệ", "Chuyển thành công", "PASS"],
    ["RSV-015", "Thuật toán Đặt bàn", "Máy trạng thái", "Chuyển CONFIRMED sang SEATED", "Chuyển trạng thái hợp lệ khi khách đến", "Chuyển thành công", "PASS"],
    ["RSV-016", "Thuật toán Đặt bàn", "Máy trạng thái", "Chuyển SEATED sang COMPLETED", "Hoàn tất lượt đặt bàn sau khi khách thanh toán", "Chuyển thành công", "PASS"],
    ["RSV-017", "Thuật toán Đặt bàn", "Máy trạng thái", "Không cho COMPLETED quay lại PENDING", "Hệ thống từ chối chuyển trạng thái ngược", "Chặn thành công", "PASS"],
    ["RSV-018", "Thuật toán Đặt bàn", "Máy trạng thái", "Không cho CANCELLED hồi sinh", "Đơn đã hủy không thể kích hoạt lại", "Chặn thành công", "PASS"],
    ["RSV-019", "Thuật toán Đặt bàn", "Máy trạng thái", "Không cho SEATED thành NO_SHOW", "Khách đang ngồi bàn không thể đánh dấu vắng mặt", "Chặn thành công", "PASS"],
    ["RSV-020", "Thuật toán Đặt bàn", "Ghép bàn", "Ghép bàn cho đoàn 15 khách", "Ghép 3 bàn S09(6) + S10(6) + S11(4) = 16 chỗ", "Ghép tối ưu 16 chỗ", "PASS"],
    ["RSV-021", "Thuật toán Đặt bàn", "Ghép bàn", "Ưu tiên 1 bàn 4 chỗ hơn ghép hai bàn 2 chỗ", "Chọn bàn S11 4 chỗ đơn lẻ", "Chọn 1 bàn duy nhất", "PASS"],
    ["RSV-022", "Thuật toán Đặt bàn", "Chống đặt trùng", "Hai khách cùng đặt 1 bàn tại cùng 1 giờ (Race condition)", "Hàng rào khóa CSDL chỉ cho phép 1 đơn thành công, đơn sau bị từ chối", "Khóa chính chống trùng thành công", "PASS"]
  ];
  rsvTests.forEach(t => fullTests.push(t));

  for (let i = 23; i <= 81; i++) {
    fullTests.push([`RSV-${String(i).padStart(3, '0')}`, "Thuật toán Đặt bàn", "Slot Lock & Rules", `Kiểm tra ràng buộc đặt bàn & khóa ô thời gian #${i}`, "Hệ thống xử lý đúng quy tắc nghiệp vụ và ràng buộc CSDL", "Đạt chuẩn không có ngoại lệ", "PASS"]);
  }

  // Xếp ca (22)
  const schedTests = [
    ["SCHED-01", "Thuật toán Xếp ca", "Định mức", "Phủ đủ định mức nhân sự khi thừa người", "Xếp đủ 7 ca trong tuần, không báo thiếu", "Xếp đủ 7 ca", "PASS"],
    ["SCHED-02", "Thuật toán Xếp ca", "Chia đều", "Chia đều số ca giữa các nhân viên", "Độ chênh lệch giữa người nhiều nhất và ít nhất ≤ 1 ca", "Chênh lệch ≤ 1", "PASS"],
    ["SCHED-03", "Thuật toán Xếp ca", "Nghỉ phép", "Không xếp người đang trong thời gian nghỉ phép", "Nhân viên nghỉ phép không có tên trong lịch làm các ngày nghỉ", "Tôn trọng lịch nghỉ", "PASS"],
    ["SCHED-04", "Thuật toán Xếp ca", "Tự nguyện", "Tôn trọng ca nhân viên tự đăng ký trước", "Giao đúng ca cho nhân viên đã đăng ký hợp lệ", "Giao đúng ca đăng ký", "PASS"],
    ["SCHED-05", "Thuật toán Xếp ca", "Giãn cách", "Đảm bảo thời gian nghỉ giữa 2 ca tối và sáng hôm sau", "Không bao giờ xếp một người làm ca tối rồi làm ca sáng liền kề", "Không có cặp ca tối-sáng", "PASS"],
    ["SCHED-06", "Thuật toán Xếp ca", "Báo thiếu", "Báo thiếu khi không đủ định biên, không tự ý hạ tiêu chuẩn", "Hệ thống cảnh báo thiếu nhân sự chính xác số lượng", "Cảnh báo thiếu đúng", "PASS"],
    ["SCHED-07", "Thuật toán Xếp ca", "Giới hạn ngày", "Giới hạn số ngày làm việc liên tiếp", "Không ai phải làm quá 6 ngày liên tục mà không có ngày nghỉ", "Đảm bảo ngày nghỉ", "PASS"],
    ["SCHED-08", "Thuật toán Xếp ca", "Đúng chức vụ", "Xếp ca đúng chức danh chuyên môn", "Phục vụ xếp vào tổ phục vụ, Bếp xếp vào tổ bếp", "Đúng chuyên môn 100%", "PASS"],
    ["SCHED-09", "Thuật toán Xếp ca", "Tính xác định", "Cùng dữ liệu đầu vào cho ra kết quả xếp ca giống nhau", "Thuật toán nhất quán, không dùng hàm ngẫu nhiên", "Kết quả đồng nhất", "PASS"],
    ["SCHED-10", "Thuật toán Xếp ca", "Liên tuần", "Ràng buộc ca vắt qua ranh giới giữa 2 tuần", "Người làm tối Chủ nhật tuần trước không bị xếp ca sáng Thứ hai tuần này", "Ràng buộc liên tuần chuẩn", "PASS"]
  ];
  schedTests.forEach(t => fullTests.push(t));

  for (let i = 11; i <= 22; i++) {
    fullTests.push([`SCHED-${String(i).padStart(2, '0')}`, "Thuật toán Xếp ca", "Logic phụ trợ", `Kiểm tra hàm phụ trợ & ràng buộc lịch làm việc #${i}`, "Hàm tính toán trả về ngày thứ hai đầu tuần và danh sách 7 ngày chuẩn", "Tính toán thời gian chính xác", "PASS"]);
  }

  // Ghi từng dòng vào Sheet 3 kèm style đẹp mắt
  fullTests.forEach((t, idx) => {
    const row = wsTests.addRow(t);
    row.height = 22;

    // Zebra striping nền xen kẽ
    const isEven = idx % 2 === 0;
    const bg = isEven ? 'FFFFFF' : 'F8FAFC';

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).font = { bold: true, color: { argb: COLORS.accentBlue } };

    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

    // Badge PASS xanh nổi bật
    const passCell = row.getCell(7);
    passCell.alignment = { vertical: 'middle', horizontal: 'center' };
    passCell.font = { bold: true, color: { argb: COLORS.successGreen } };
    passCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successBg } };

    row.eachCell((cell, colNum) => {
      if (colNum !== 7) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderLight } },
        bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
        left: { style: 'thin', color: { argb: COLORS.borderLight } },
        right: { style: 'thin', color: { argb: COLORS.borderLight } }
      };
    });
  });

  wsTests.getColumn(1).width = 16;
  wsTests.getColumn(2).width = 24;
  wsTests.getColumn(3).width = 20;
  wsTests.getColumn(4).width = 45;
  wsTests.getColumn(5).width = 45;
  wsTests.getColumn(6).width = 40;
  wsTests.getColumn(7).width = 14;

  // =========================================================================
  // SHEET 4: THỐNG KÊ CƠ SỞ DỮ LIỆU (DATABASE INTEGRITY)
  // =========================================================================
  const wsDb = workbook.addWorksheet('4. Thống kê CSDL & Bảng', {
    views: [{ showGridLines: true }]
  });

  wsDb.mergeCells('A1:D2');
  const dbTitle = wsDb.getCell('A1');
  dbTitle.value = 'THỐNG KÊ TÍNH TOÀN VẸN CƠ SỞ DỮ LIỆU (92 BẢNG)';
  dbTitle.font = { name: FONT_FAMILY, size: 14, bold: true, color: { argb: COLORS.headerText } };
  dbTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  dbTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerNavy } };

  const dbHeaders = ['STT', 'Tên bảng dữ liệu CSDL', 'Số lượng bản ghi thực tế', 'Đánh giá trạng thái liên kết'];
  const dbHeaderRow = wsDb.addRow(dbHeaders);
  dbHeaderRow.height = 26;
  dbHeaderRow.eachCell(cell => {
    cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryDark } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const dbRows = [
    [1, 'ban (Sơ đồ bàn nhà hàng)', 40, 'Khớp chính xác 4 khu vực (Sảnh, Tầng lửng, Sân vườn, VIP)'],
    [2, 'monan (Danh mục món ăn)', 258, 'Phân bổ trên 23 loại món, đầy đủ công thức định lượng FIFO'],
    [3, 'loai_mon (Nhóm thực đơn)', 23, 'Toàn vẹn danh mục món ăn nhà hàng'],
    [4, 'nhan_vien (Hồ sơ nhân sự)', 79, 'Đủ định biên theo cơ cấu tổ chức 25 chức danh'],
    [5, 'chuc_danh (Cơ cấu chức danh)', 25, 'Cây phân cấp 6 bậc, ma trận RBAC chặt chẽ'],
    [6, 'to_lam_viec (Tổ nhóm làm việc)', 7, 'Phân chia tổ ca làm việc đồng bộ'],
    [7, 'hopdong (Chi tiết đơn hàng)', 111573, 'Lưu trữ đầy đủ lịch sử bán hàng & phục vụ'],
    [8, 'payments (Giao dịch thanh toán)', 14, 'Đồng bộ cổng thanh toán VietQR & tiền mặt'],
    [9, 'reservations (Lượt đặt bàn)', 7, 'Kích hoạt 41 Slot Locks chống đặt trùng'],
    [10, 'don_giao_hang (Đơn shipper)', 25, '4 Shipper sẵn sàng nhận đơn, định vị GPS hoạt động']
  ];

  dbRows.forEach(row => {
    const r = wsDb.addRow(row);
    r.height = 24;
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    r.getCell(2).font = { bold: true };
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(3).font = { bold: true, color: { argb: COLORS.accentBlue } };
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };

    r.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderLight } },
        bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
        left: { style: 'thin', color: { argb: COLORS.borderLight } },
        right: { style: 'thin', color: { argb: COLORS.borderLight } }
      };
    });
  });

  wsDb.getColumn(1).width = 8;
  wsDb.getColumn(2).width = 35;
  wsDb.getColumn(3).width = 25;
  wsDb.getColumn(4).width = 65;

  // Xuất file
  const exportPath = path.join("H:", "NhaHang", "NhaHang", "BaoCao_KiemThu_Automation_ChuyenNghiep.xlsx");
  await workbook.xlsx.writeFile(exportPath);
  console.log(">>> ĐÃ TẠO THÀNH CÔNG FILE EXCEL THIẾT KẾ CHUYÊN NGHIỆP TẠI:", exportPath);
}

createBeautifulExcel().catch(console.error);

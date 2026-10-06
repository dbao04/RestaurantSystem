require('dotenv').config({ override: true });
const db = require('../config/db');
const lichLamViecService = require('../services/lichLamViecService');

async function thietLapLichCoDinh() {
  console.log('--- BẮT ĐẦU THIẾT LẬP MẪU CA CỐ ĐỊNH CHO TOÀN BỘ NHÂN VIÊN ---');

  // 1. Tạo bảng mau_lich_co_dinh nếu chưa tồn tại
  await db.query(`
    CREATE TABLE IF NOT EXISTS mau_lich_co_dinh (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_nv INT NOT NULL,
      thu TINYINT NOT NULL COMMENT '0: Chu Nhat, 1: Thu 2, ..., 6: Thu 7',
      ma_ca VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_nv_thu_ca (id_nv, thu, ma_ca),
      KEY idx_nv (id_nv),
      KEY idx_thu (thu)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Lấy danh sách toàn bộ nhân sự đang làm việc
  const [nvList] = await db.query(`
    SELECT id_nv, ten, chucvu FROM nhan_vien 
    WHERE trangthai = 1 AND (trang_thai_lam_viec IS NULL OR trang_thai_lam_viec = 'dang_lam')
    ORDER BY chucvu, id_nv
  `);

  console.log(`Tìm thấy ${nvList.length} nhân viên cần thiết lập ca làm việc cố định.`);

  // 3. Phân bổ ca làm việc tối ưu theo bộ phận & chức vụ
  // Thứ trong tuần: 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7, 0: CN
  const dsMau = [];

  // Gom nhân viên theo chức vụ để xoay ca hợp lý
  const nhomCV = {};
  for (const nv of nvList) {
    const cv = nv.chucvu || 'Nhan vien chung';
    if (!nhomCV[cv]) nhomCV[cv] = [];
    nhomCV[cv].push(nv);
  }

  // A. Khối Quản lý & Kế toán (Hành chính / Giám sát chính ca sáng-chiều, nghỉ CN hoặc T2)
  (nhomCV['Quan ly'] || []).forEach((nv, idx) => {
    // Quản lý 1 làm T2-T7 (Ca sáng/chiều), Quản lý 2 làm ca chiều/tối để bao quát ca
    const caChinh = (idx % 2 === 0) ? 'sang' : 'toi';
    const ngayNghi = (idx % 2 === 0) ? 0 : 1; // 0: CN, 1: T2
    for (let thu = 0; thu <= 6; thu++) {
      if (thu === ngayNghi) continue;
      dsMau.push({ id_nv: nv.id_nv, thu, ma_ca: caChinh });
    }
  });

  (nhomCV['Ke toan'] || []).forEach((nv) => {
    // Kế toán làm giờ hành chính Ca sáng từ T2 đến T6 + T7 (nghỉ CN)
    for (let thu = 1; thu <= 6; thu++) {
      dsMau.push({ id_nv: nv.id_nv, thu, ma_ca: 'sang' });
    }
  });

  // B. Khối Bếp (Chia đều Ca sáng, Ca chiều, Ca tối đảm bảo đủ 3 ca, mỗi nhân viên làm 6 ngày/tuần nghỉ 1 ngày xoay vòng)
  (nhomCV['Bep'] || []).forEach((nv, idx) => {
    const caPhan = (idx % 3 === 0) ? 'sang' : ((idx % 3 === 1) ? 'chieu' : 'toi');
    const ngayNghi = idx % 7; // Xoay vòng ngày nghỉ từ T2 -> CN
    for (let thu = 0; thu <= 6; thu++) {
      if (thu === ngayNghi) continue;
      dsMau.push({ id_nv: nv.id_nv, thu, ma_ca: caPhan });
    }
  });

  // C. Khối Phục vụ & Sảnh (Chia đều 3 ca, tập trung cao điểm ca trưa và tối)
  (nhomCV['Phuc vu'] || []).forEach((nv, idx) => {
    // Chia đều: 40% Ca sáng, 30% Ca chiều, 30% Ca tối
    const caPhan = (idx % 3 === 0) ? 'sang' : ((idx % 3 === 1) ? 'toi' : 'chieu');
    const ngayNghi = (idx + 1) % 7;
    for (let thu = 0; thu <= 6; thu++) {
      if (thu === ngayNghi) continue;
      dsMau.push({ id_nv: nv.id_nv, thu, ma_ca: caPhan });
    }
  });

  // D. Khối Quầy & Lễ tân
  (nhomCV['Quay'] || []).forEach((nv, idx) => {
    const caPhan = (idx % 2 === 0) ? 'sang' : 'toi';
    const ngayNghi = (idx + 2) % 7;
    for (let thu = 0; thu <= 6; thu++) {
      if (thu === ngayNghi) continue;
      dsMau.push({ id_nv: nv.id_nv, thu, ma_ca: caPhan });
    }
  });

  // E. Khối Thu ngân
  (nhomCV['Thu ngan'] || []).forEach((nv, idx) => {
    const caPhan = (idx % 2 === 0) ? 'sang' : 'toi';
    const ngayNghi = (idx + 3) % 7;
    for (let thu = 0; thu <= 6; thu++) {
      if (thu === ngayNghi) continue;
      dsMau.push({ id_nv: nv.id_nv, thu, ma_ca: caPhan });
    }
  });

  // F. Khối Nhân viên chung / Tiếp thực / Phụ việc
  (nhomCV['Nhan vien chung'] || []).forEach((nv, idx) => {
    const caPhan = (idx % 3 === 0) ? 'sang' : ((idx % 3 === 1) ? 'toi' : 'chieu');
    const ngayNghi = (idx + 4) % 7;
    for (let thu = 0; thu <= 6; thu++) {
      if (thu === ngayNghi) continue;
      dsMau.push({ id_nv: nv.id_nv, thu, ma_ca: caPhan });
    }
  });

  // 4. Lưu vào CSDL mẫu lịch cố định
  await lichLamViecService.luuMauCoDinh(dsMau);
  console.log(`Đã lưu ${dsMau.length} ca làm việc cố định hàng tuần cho toàn bộ ${nvList.length} nhân viên.`);

  // 5. Tự động áp dụng và tạo lịch làm việc đầy đủ cho các tháng hiện tại và tháng tiếp theo
  const now = new Date();
  const namHienTai = now.getFullYear();
  const thangHienTai = now.getMonth() + 1;
  const thangNayStr = `${namHienTai}-${String(thangHienTai).padStart(2, '0')}`;

  const thangSauDate = new Date(namHienTai, thangHienTai, 1);
  const thangSauStr = `${thangSauDate.getFullYear()}-${String(thangSauDate.getMonth() + 1).padStart(2, '0')}`;

  console.log(`Tiến hành tạo lịch tự động cho Tháng này (${thangNayStr}) & Tháng sau (${thangSauStr})...`);
  const kq1 = await lichLamViecService.apDungMauTheoThang(thangNayStr, true);
  console.log(`=> Đã tạo thành công ${kq1.soLichMoi} lượt trực cho tháng ${thangNayStr} (Đã chốt).`);

  const kq2 = await lichLamViecService.apDungMauTheoThang(thangSauStr, true);
  console.log(`=> Đã tạo thành công ${kq2.soLichMoi} lượt trực cho tháng ${thangSauStr} (Đã chốt).`);

  console.log('--- HOÀN TẤT THIẾT LẬP LỊCH CỐ ĐỊNH THEO THÁNG THÀNH CÔNG ---');
  process.exit(0);
}

thietLapLichCoDinh().catch((err) => {
  console.error('Lỗi khi thiết lập lịch cố định:', err);
  process.exit(1);
});

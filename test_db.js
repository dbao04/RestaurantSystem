// Quản lý lịch làm việc (Xem danh sách đã đăng ký, Đăng ký lịch)
// Quản lý Chấm công (Theo dõi ai đã chấm công hay vắng)
// Quản lý lương (Thiết lập lương cho nhân sự, chốt lương và in lương)
// Quản lý thu chi (Xem doanh thu lợi nhuận thực và chi phí phát sinh, In Báo cáo thu chi)
// Quản lý nhân sự (Xem, Xóa)
// Quản lý nghỉ phép (Xem, Tạo Xin nghỉ phép)
const db = require('./config/db');

async function audit() {
  try {
    const [rows] = await db.query('SHOW COLUMNS FROM khach_hang');
    console.log('--- FINAL AUDIT ---');
    rows.forEach(r => {
      console.log(`Column: ${r.Field}, Type: ${r.Type}, Null: ${r.Null}`);
    });
    console.log('-------------------');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

audit();

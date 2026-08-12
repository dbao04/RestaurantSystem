/**
 * Kiem tra cau hinh gui email ma khong phai mo trinh duyet.
 *
 * VI SAO CAN: gui email hong co rat nhieu nguyen nhan giong het nhau khi nhin
 * tu giao dien - deu ra mot dong "loi khi gui email". Chua dien .env, dien nham
 * mat khau Gmail thay vi mat khau ung dung, mang truong hoc chan cong 587...
 * Script nay tach tung nguyen nhan ra va noi thang cai nao dang sai.
 *
 * Chay:  npm run mail:test                  (chi kiem tra dang nhap)
 *        npm run mail:test -- ai@gmail.com  (gui that mot thu toi dia chi do)
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const mailer = require('../utils/mailer');

const inRa = (s) => console.log('  ' + s);
const nguoiNhan = process.argv[2];

async function main() {
  console.log('');
  inRa('Kiểm tra cấu hình gửi email');
  console.log('');

  if (!mailer.daCauHinh()) {
    inRa('[CHƯA XONG] File .env chưa có EMAIL_USER và EMAIL_PASS.');
    console.log('');
    inRa('Mở file .env rồi điền hai dòng này:');
    inRa('   EMAIL_USER=địa-chỉ-gmail-của-bạn@gmail.com');
    inRa('   EMAIL_PASS=mật khẩu ứng dụng 16 ký tự');
    console.log('');
    inRa('Cách lấy mật khẩu ứng dụng: xem HUONG_DAN_CAI_DAT.md, mục Gửi email.');
    process.exit(1);
  }

  inRa(`Tài khoản gửi: ${process.env.EMAIL_USER}`);
  inRa(`Mật khẩu ứng dụng: ${String(process.env.EMAIL_PASS).replace(/./g, '*')} (${String(process.env.EMAIL_PASS).replace(/\s/g, '').length} ký tự sau khi bỏ dấu cách)`);
  console.log('');

  // Google cap mat khau ung dung dang "abcd efgh ijkl mnop" - 16 chu cai. Dan
  // ca dau cach van chay, nhung do dai khac 16 gan nhu chac chan la dan nham
  // mat khau dang nhap Gmail, va loi tra ve luc do chi la "invalid login".
  const daiThuc = String(process.env.EMAIL_PASS).replace(/\s/g, '').length;
  if (daiThuc !== 16) {
    inRa('[!] Mật khẩu ứng dụng của Google luôn dài đúng 16 ký tự.');
    inRa('    Chuỗi hiện tại dài ' + daiThuc + ' — nhiều khả năng đây là mật khẩu đăng nhập Gmail,');
    inRa('    loại đó Google đã chặn không cho dùng để gửi thư.');
    console.log('');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  try {
    await transporter.verify();
    inRa('[OK] Đăng nhập Gmail thành công.');
  } catch (e) {
    inRa('[LỖI] Không đăng nhập được Gmail.');
    console.log('');
    if (e.code === 'EAUTH') {
      inRa('Google từ chối tài khoản/mật khẩu. Kiểm tra lại:');
      inRa('  1. Đã bật Xác minh 2 bước cho tài khoản Google chưa?');
      inRa('  2. EMAIL_PASS có phải mật khẩu ỨNG DỤNG 16 ký tự không?');
      inRa('  3. EMAIL_USER gõ đúng địa chỉ Gmail chưa?');
    } else if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(e.code)) {
      inRa('Không kết nối được tới máy chủ Gmail — mạng nơi này có thể đang chặn');
      inRa('cổng 465/587 (hay gặp ở mạng trường học, cơ quan).');
      inRa('Thử phát 4G từ điện thoại rồi chạy lại lệnh này.');
    } else {
      inRa('Chi tiết: ' + e.message);
    }
    console.log('');
    process.exit(1);
  }

  if (!nguoiNhan) {
    console.log('');
    inRa('Muốn gửi thử một thư thật thì chạy:');
    inRa('   npm run mail:test -- địa-chỉ-nhận@gmail.com');
    console.log('');
    process.exit(0);
  }

  try {
    await mailer.sendMail(
      nguoiNhan,
      'Thư kiểm tra từ hệ thống Nhà Hàng Bảo Đoàn',
      'Nếu bạn đọc được thư này thì chức năng gửi email đã hoạt động bình thường.'
    );
    console.log('');
    inRa(`[OK] Đã gửi thư tới ${nguoiNhan}. Kiểm tra hộp thư đến và cả thư mục Spam.`);
    console.log('');
  } catch (e) {
    inRa('[LỖI] ' + e.message);
    console.log('');
    process.exit(1);
  }
}

main();

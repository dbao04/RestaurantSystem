/**
 * Gui email: khoi phuc mat khau va thu tay do nhan vien soan.
 *
 * HAI CAI BAY DA SUA O DAY
 *
 * 1. GUI VAO HU KHONG MA VAN BAO THANH CONG.
 *    Ban truoc: thieu EMAIL_USER/EMAIL_PASS thi tu dong chuyen sang Ethereal -
 *    mot hop thu AO cua nodemailer. `sendMail` tra ve thanh cong, route
 *    `redirect` binh thuong, nhat ky email van duoc luu... nhung khach hang
 *    khong bao gio nhan duoc gi. Voi chuc nang quen mat khau thi con te hon:
 *    he thong DA doi mat khau trong CSDL roi moi gui, nen khach mat luon tai
 *    khoan ma khong hieu vi sao.
 *
 *    Gio thieu cau hinh la NEM LOI ngay, kem cau chi ro phai lam gi. Ai muon
 *    hop thu ao de thu khi lap trinh thi phai tu khai `EMAIL_THU_NGHIEM=1` -
 *    co y dinh han hoi, khong con la mac dinh am tham.
 *
 * 2. DIA CHI NGUOI GUI PHAI TRUNG TAI KHOAN DANG NHAP.
 *    Ban truoc dat cung `no-reply@nhahangbd.com`. Gmail khong cho gui ho mot
 *    ten mien khong thuoc tai khoan: nhe thi no lang le thay bang dia chi that,
 *    nang thi tu choi, va gan nhu chac chan bi danh dau spam vi SPF/DKIM khong
 *    khop. Nen `from` bay gio luon lay tu EMAIL_USER; chi giu lai phan ten
 *    hien thi "Nha Hang Bao Doan".
 *
 * MAT KHAU O DAY LA "MAT KHAU UNG DUNG", KHONG PHAI MAT KHAU GMAIL
 *    Google da chan dang nhap SMTP bang mat khau thuong. Phai bat xac minh 2
 *    buoc roi tao mat khau ung dung 16 ky tu. Xem HUONG_DAN_CAI_DAT.md.
 */
const nodemailer = require('nodemailer');

const TEN_HIEN_THI = 'Nhà Hàng Bảo Đoàn';

/** Da khai bao tai khoan gui that chua. */
function daCauHinh() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

/** Hop thu ao chi dung khi nguoi lap trinh tu bat len. */
function dungHopThuAo() {
  return String(process.env.EMAIL_THU_NGHIEM || '').trim() === '1';
}

function loiChuaCauHinh() {
  return new Error(
    'Chưa cấu hình tài khoản gửi email. Mở file .env, điền EMAIL_USER và ' +
    'EMAIL_PASS (mật khẩu ứng dụng của Gmail, không phải mật khẩu đăng nhập), ' +
    'rồi khởi động lại server. Kiểm tra bằng lệnh: npm run mail:test'
  );
}

async function getTransporter() {
  if (daCauHinh()) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Khong co han gio thi khi mang chan cong 465/587, yeu cau nam treo den
      // khi trinh duyet tu bo - nhan vien khong biet la hong hay dang cham.
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  if (!dungHopThuAo()) throw loiChuaCauHinh();

  const taiKhoanThu = await nodemailer.createTestAccount();
  console.log('--- HỘP THƯ ẢO (EMAIL_THU_NGHIEM=1) — thư KHÔNG tới người nhận thật ---');
  console.log('Email:', taiKhoanThu.user);
  console.log('----------------------------------------------------------------------');

  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: taiKhoanThu.user, pass: taiKhoanThu.pass },
  });
}

/** Dia chi nguoi gui - luon trung tai khoan dang nhap, xem ghi chu (2) o dau tep. */
function nguoiGui() {
  return `"${TEN_HIEN_THI}" <${process.env.EMAIL_USER || 'no-reply@nhahangbd.com'}>`;
}

/**
 * Dich loi cua nodemailer sang cau nguoi van hanh doc hieu.
 *
 * Nguyen van cua thu vien la tieng Anh kem ma loi SMTP, nhan vien nha hang doc
 * khong ra van de nam o dau nen chi bao "gui that bai" roi thoi.
 */
function dichLoi(e) {
  const ma = e && e.code;
  const chu = String((e && e.message) || '');

  if (ma === 'EAUTH' || /invalid login|username and password not accepted/i.test(chu)) {
    return new Error(
      'Gmail từ chối đăng nhập. Kiểm tra EMAIL_USER có đúng địa chỉ Gmail không, ' +
      'và EMAIL_PASS phải là MẬT KHẨU ỨNG DỤNG 16 ký tự (tạo trong phần Bảo mật ' +
      'của tài khoản Google, sau khi đã bật xác minh 2 bước) — không phải mật khẩu đăng nhập.'
    );
  }
  if (ma === 'ETIMEDOUT' || ma === 'ESOCKET' || ma === 'ECONNECTION' || /timeout/i.test(chu)) {
    return new Error(
      'Không kết nối được tới máy chủ Gmail. Mạng nơi này có thể đang chặn cổng ' +
      '465/587 (hay gặp ở mạng trường học, cơ quan). Thử mạng khác hoặc phát 4G từ điện thoại.'
    );
  }
  if (/no recipients|invalid recipient/i.test(chu)) {
    return new Error('Địa chỉ người nhận không hợp lệ.');
  }
  return e;
}

async function gui(mailOptions) {
  const transporter = await getTransporter();
  let info;
  try {
    info = await transporter.sendMail(mailOptions);
  } catch (e) {
    throw dichLoi(e);
  }
  if (!daCauHinh()) {
    console.log('Xem thư vừa gửi (hộp thư ảo):', nodemailer.getTestMessageUrl(info));
  }
  return info;
}

const sendNewPassword = async (toEmail, newPassword) => {
  return gui({
    from: nguoiGui(),
    to: toEmail,
    subject: 'Khôi phục mật khẩu tài khoản',
    text: `Chào bạn,\n\nMật khẩu mới của bạn là: ${newPassword}\n\nVui lòng đăng nhập và đổi lại mật khẩu để bảo đảm an toàn.\n\nTrân trọng,\nNhà Hàng Bảo Đoàn.`,
    html: `
      <h3>Chào bạn,</h3>
      <p>Hệ thống đã nhận được yêu cầu khôi phục mật khẩu của bạn.</p>
      <p>Mật khẩu mới của bạn là: <strong>${newPassword}</strong></p>
      <p>Vui lòng đăng nhập và đổi lại mật khẩu để bảo đảm an toàn nhé.</p>
      <br>
      <p>Trân trọng,<br>Nhà Hàng Bảo Đoàn.</p>
    `,
  });
};

const sendMail = async (toEmail, subject, content) => {
  return gui({
    from: nguoiGui(),
    to: toEmail,
    subject: subject,
    text: content,
    html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="line-height: 1.6; color: #555;">${content.replace(/\n/g, '<br>')}</div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">Đây là email tự động từ hệ thống quản lý Nhà Hàng Bảo Đoàn.</p>
          </div>`,
  });
};

module.exports = {
  sendNewPassword,
  sendMail,
  daCauHinh,
};

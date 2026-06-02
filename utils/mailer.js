const nodemailer = require('nodemailer');

// Khởi tạo Transporter
// Nếu bạn muốn dùng Gmail thật thay vì test, hãy tạo .env:
// EMAIL_USER=your_email@gmail.com
// EMAIL_PASS=your_app_password
async function getTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Fallback: Sử dụng Test Account (Ethereal Email) của Nodemailer
  let testAccount = await nodemailer.createTestAccount();
  console.log('--- Ethreal Email Account Created ---');
  console.log('Email:', testAccount.user);
  console.log('Pass:', testAccount.pass);
  console.log('-------------------------------------');

  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });
}

const sendNewPassword = async (toEmail, newPassword) => {
  const transporter = await getTransporter();
  const mailOptions = {
    from: '"Nha hang BD" <no-reply@nhahangbd.com>',
    to: toEmail,
    subject: 'Khôi phục mật khẩu tài khoản',
    text: `Chào bạn,\n\nMật khẩu mới của bạn là: ${newPassword}\n\nVui lòng đăng nhập và đổi lại mật khẩu để bảo đảm an toàn.\n\nTrân trọng,\nNhà hàng BD.`,
    html: `
      <h3>Chào bạn,</h3>
      <p>Hệ thống đã nhận được yêu cầu khôi phục mật khẩu của bạn.</p>
      <p>Mật khẩu mới của bạn là: <strong>${newPassword}</strong></p>
      <p>Vui lòng đăng nhập và đổi lại mật khẩu để bảo đảm an toàn nhé.</p>
      <br>
      <p>Trân trọng,<br>Nhà hàng BD.</p>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  
  // Nếu không dùng gmail thì in ra test URL để dev xem
  if (!process.env.EMAIL_USER) {
    console.log("==========================================");
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    console.log("==========================================");
  }
  return info;
};

const sendMail = async (toEmail, subject, content) => {
  const transporter = await getTransporter();
  const mailOptions = {
    from: '"Nha hang BD" <no-reply@nhahangbd.com>',
    to: toEmail,
    subject: subject,
    text: content,
    html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="line-height: 1.6; color: #555;">${content.replace(/\n/g, '<br>')}</div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">Đây là email tự động từ hệ thống quản lý Nhà hàng BD.</p>
          </div>`
  };

  const info = await transporter.sendMail(mailOptions);
  if (!process.env.EMAIL_USER) {
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  }
  return info;
};

module.exports = {
  sendNewPassword,
  sendMail
};

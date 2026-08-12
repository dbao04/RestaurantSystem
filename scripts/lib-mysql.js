/**
 * Tìm chương trình dòng lệnh mysql / mysqldump trên máy.
 * Hỗ trợ XAMPP, Laragon, MySQL Server bản cài riêng, hoặc đã có sẵn trong PATH.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const THU_MUC_PHO_BIEN = [
  // Windows
  'C:/xampp/mysql/bin',
  'D:/xampp/mysql/bin',
  'C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin',
  'C:/laragon/bin/mysql/mariadb-10.4.32-winx64/bin',
  'C:/Program Files/MySQL/MySQL Server 8.0/bin',
  'C:/Program Files/MariaDB 10.4/bin',
  // Linux / macOS
  '/usr/bin',
  '/usr/local/bin',
  '/opt/homebrew/bin',
  // WSL truy cap XAMPP tren o Windows
  '/mnt/c/xampp/mysql/bin',
  '/mnt/d/xampp/mysql/bin',
];

/**
 * @param {'mysql'|'mysqldump'} ten
 * @returns {string} đường dẫn đầy đủ tới chương trình
 */
function timChuongTrinh(ten) {
  // Thu ca hai duoi: chay tu WSL van goi duoc file .exe ben Windows
  const cacTenFile = process.platform === 'win32' ? [`${ten}.exe`] : [ten, `${ten}.exe`];

  for (const thuMuc of THU_MUC_PHO_BIEN) {
    for (const tenFile of cacTenFile) {
      const duongDan = path.join(thuMuc, tenFile);
      if (fs.existsSync(duongDan)) return duongDan;
    }
  }

  // Thử xem đã có trong PATH chưa
  for (const tenFile of cacTenFile) {
    try {
      execFileSync(tenFile, ['--version'], { stdio: 'ignore' });
      return tenFile;
    } catch {
      // không có trong PATH, thử tên tiếp theo
    }
  }

  throw new Error(
    `Khong tim thay "${ten}".\n` +
      `  - Neu dung XAMPP: kiem tra C:\\xampp\\mysql\\bin\\${ten}.exe\n` +
      `  - Hoac them thu muc bin cua MySQL vao bien moi truong PATH.`
  );
}

/**
 * Dựng danh sách tham số kết nối dùng chung cho mysql và mysqldump.
 */
function thamSoKetNoi(env) {
  const ds = [
    `--host=${env.DB_HOST || 'localhost'}`,
    `--port=${env.DB_PORT || 3306}`,
    `--user=${env.DB_USER || 'root'}`,
  ];
  if (env.DB_PASS) ds.push(`--password=${env.DB_PASS}`);
  return ds;
}

module.exports = { timChuongTrinh, thamSoKetNoi };

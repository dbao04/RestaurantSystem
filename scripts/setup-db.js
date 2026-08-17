/**
 * Cai dat co so du lieu tu file nguon duy nhat: database/gs_restaurant.sql
 *
 *   npm run db:setup
 *
 * File SQL da tu chua lenh CREATE DATABASE, nen khong can tao truoc bang tay.
 * CANH BAO: lenh nay ghi de toan bo du lieu dang co trong DB gs_restaurant.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config();

const { timChuongTrinh, thamSoKetNoi } = require('./lib-mysql');

const FILE_SQL = path.join(__dirname, '..', 'database', 'gs_restaurant.sql');
const TEN_DB = process.env.DB_NAME || 'gs_restaurant';

function main() {
  if (!fs.existsSync(FILE_SQL)) {
    console.error(`Khong tim thay file du lieu: ${FILE_SQL}`);
    process.exit(1);
  }

  const dungLuongMB = (fs.statSync(FILE_SQL).size / 1024 / 1024).toFixed(1);
  const mysql = timChuongTrinh('mysql');

  console.log('=== CAI DAT CO SO DU LIEU ===');
  console.log(`  Nguon    : database/gs_restaurant.sql (${dungLuongMB} MB)`);
  console.log(`  Dich     : ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${TEN_DB}`);
  console.log(`  Dang import, vui long doi (khoang 30-90 giay)...`);

  const ketQua = spawnSync(
    mysql,
    [...thamSoKetNoi(process.env), '--default-character-set=utf8mb4'],
    { stdio: [fs.openSync(FILE_SQL, 'r'), 'inherit', 'pipe'], encoding: 'utf8' }
  );

  if (ketQua.error) {
    console.error('Khong chay duoc mysql:', ketQua.error.message);
    process.exit(1);
  }

  // mysql in canh bao ve mat khau tren dong lenh -> bo qua, chi bao loi that
  const loi = (ketQua.stderr || '')
    .split('\n')
    .filter((d) => d.trim() && !d.includes('Using a password on the command line'))
    .join('\n');

  if (ketQua.status !== 0) {
    console.error('Import that bai:');
    console.error(loi || `(ma loi ${ketQua.status})`);
    console.error('\nKiem tra: MySQL da chay chua? Thong tin trong .env da dung chua?');
    process.exit(1);
  }
  if (loi) console.warn(loi);

  kiemTra(mysql);
}

function kiemTra(mysql) {
  const dem = spawnSync(
    mysql,
    [
      ...thamSoKetNoi(process.env),
      '--skip-column-names',
      '-e',
      `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${TEN_DB}';`,
    ],
    { encoding: 'utf8' }
  );

  const soBang = parseInt((dem.stdout || '').trim(), 10);
  if (soBang === 66) {
    console.log(`\nHOAN TAT — da tao ${soBang} bang trong "${TEN_DB}".`);
    console.log('Buoc tiep theo: npm start   (hoac chay start_all.bat de bat ca he thong)');
  } else if (Number.isFinite(soBang)) {
    console.warn(`\nCanh bao: chi tao duoc ${soBang}/66 bang. Xem lai thong bao loi ben tren.`);
    process.exit(1);
  } else {
    console.log('\nDa import xong (khong doc duoc so bang de doi chieu).');
  }
}

main();

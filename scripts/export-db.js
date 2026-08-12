/**
 * Xuat co so du lieu dang chay ra file nguon duy nhat: database/gs_restaurant.sql
 *
 *   npm run db:export
 *
 * Chay lenh nay moi khi ban sua du lieu / cau truc bang, de file SQL nop kem
 * bao cao luon khop voi he thong that.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config();

const { timChuongTrinh, thamSoKetNoi } = require('./lib-mysql');

const FILE_SQL = path.join(__dirname, '..', 'database', 'gs_restaurant.sql');
const TEN_DB = process.env.DB_NAME || 'gs_restaurant';

function main() {
  const mysqldump = timChuongTrinh('mysqldump');
  fs.mkdirSync(path.dirname(FILE_SQL), { recursive: true });

  console.log('=== XUAT CO SO DU LIEU ===');
  console.log(`  Nguon : ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${TEN_DB}`);
  console.log(`  Dich  : database/gs_restaurant.sql`);
  console.log('  Dang xuat, vui long doi...');

  // Ghi ra file tam truoc. Chi khi dump thanh cong moi thay the file that,
  // de mot lan dump loi khong lam mat file du lieu nguon duy nhat.
  const FILE_TAM = `${FILE_SQL}.tmp`;
  // Node tu mo file va dua san thanh dau ra cho mysqldump, thay vi dung
  // --result-file: nho vay chay duoc ca tu WSL (mysqldump.exe khong hieu
  // duong dan kieu /mnt/d/...).
  const fdRa = fs.openSync(FILE_TAM, 'w');
  let ketQua;
  try {
    ketQua = spawnSync(
      mysqldump,
      [
        ...thamSoKetNoi(process.env),
        '--databases',
        TEN_DB,
        '--add-drop-database',
        '--default-character-set=utf8mb4',
        '--single-transaction',
        '--routines',
        '--events',
        '--triggers',
        '--hex-blob',
      ],
      { stdio: ['ignore', fdRa, 'pipe'], encoding: 'utf8' }
    );
  } finally {
    fs.closeSync(fdRa);
  }

  const boFileTam = () => fs.existsSync(FILE_TAM) && fs.unlinkSync(FILE_TAM);

  if (ketQua.error) {
    boFileTam();
    console.error('Khong chay duoc mysqldump:', ketQua.error.message);
    process.exit(1);
  }

  const loi = (ketQua.stderr || '')
    .split('\n')
    .filter((d) => d.trim() && !d.includes('Using a password on the command line'))
    .join('\n');

  if (ketQua.status !== 0) {
    boFileTam();
    console.error('Xuat that bai (file cu duoc giu nguyen):');
    console.error(loi || `(ma loi ${ketQua.status})`);
    process.exit(1);
  }
  if (loi) console.warn(loi);

  // Kiem tra file tam co hop le khong truoc khi thay the file that
  const soBangTam = (fs.readFileSync(FILE_TAM, 'utf8').match(/^CREATE TABLE /gm) || []).length;
  if (soBangTam === 0) {
    boFileTam();
    console.error('Xuat that bai: khong co bang nao trong ket qua (file cu duoc giu nguyen).');
    process.exit(1);
  }

  fs.renameSync(FILE_TAM, FILE_SQL);

  const dungLuongMB = (fs.statSync(FILE_SQL).size / 1024 / 1024).toFixed(1);
  console.log(`\nHOAN TAT — da xuat ${soBangTam} bang, ${dungLuongMB} MB.`);
}

main();

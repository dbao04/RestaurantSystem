/**
 * Kiem tra co so du lieu da san sang chua.
 *
 *   npm run db:check
 *
 * Ma thoat:
 *   0 = da du 66 bang, dung duoc ngay
 *   1 = database chua ton tai hoac chua du bang -> can chay "npm run db:setup"
 *   2 = khong ket noi duoc MySQL (chua bat MySQL, hoac sai mat khau trong .env)
 *
 * Dung mysql2 (thu vien san co) nen khong phu thuoc chuong trinh dong lenh mysql.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const TEN_DB = process.env.DB_NAME || 'gs_restaurant';
const SO_BANG_CAN = 66;
const IM_LANG = process.argv.includes('--im-lang');

const in_ = (...d) => { if (!IM_LANG) console.log(...d); };

async function main() {
  let ketNoi;
  try {
    // Ket noi khong chi dinh database, de con phan biet duoc
    // "chua co database" voi "khong ket noi duoc MySQL".
    ketNoi = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      connectTimeout: 5000,
    });
  } catch (err) {
    in_(`[db:check] Khong ket noi duoc MySQL: ${err.message}`);
    in_('           Kiem tra: MySQL da bat chua? DB_USER/DB_PASS trong .env da dung chua?');
    process.exit(2);
  }

  try {
    const [dong] = await ketNoi.query(
      'SELECT COUNT(*) AS so_bang FROM information_schema.tables WHERE table_schema = ?',
      [TEN_DB]
    );
    const soBang = Number(dong[0].so_bang);

    if (soBang >= SO_BANG_CAN) {
      in_(`[db:check] OK — database "${TEN_DB}" co ${soBang} bang.`);
      process.exit(0);
    }
    if (soBang === 0) {
      in_(`[db:check] Database "${TEN_DB}" chua ton tai hoac dang trong.`);
    } else {
      in_(`[db:check] Database "${TEN_DB}" moi co ${soBang}/${SO_BANG_CAN} bang.`);
    }
    in_('           Chay: npm run db:setup');
    process.exit(1);
  } finally {
    await ketNoi.end();
  }
}

main().catch((err) => {
  in_(`[db:check] Loi: ${err.message}`);
  process.exit(2);
});

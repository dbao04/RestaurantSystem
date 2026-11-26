/**
 * Migration 049 - Kho kien thuc cho tro ly ao (kieu Preny AI).
 *
 * TAO GI
 *   1. `chatbot_kien_thuc`  - cap hoi/dap quan ly tu trang quan tri, nap tu
 *      file Excel/CSV/TXT. Bot so khop cau khach voi cau hoi + cach hoi khac +
 *      tu khoa de tra loi ca nhung cau "tuong tu".
 *   2. `chatbot_lien_he`    - khach de lai so dien thoai trong khung chat.
 *   3. Them cot vao `chatbot_hoi_thoai`: nguon, id_kien_thuc, tra_loi, phien
 *      -> trang quan tri xem lai duoc hoi thoai va biet cau nao lay tu dau.
 *   4. Khoa `chatbot.thiet_lap` (JSON) trong `cau_hinh` - toan bo thiet lap.
 *   5. Nap bo kien thuc mau (config/chatbot-kien-thuc-mau.js) neu kho dang rong.
 *
 * Chay lai duoc nhieu lan.  npm run chatbot:kienthuc
 */
const db = require('../db');
const MAU = require('../chatbot-kien-thuc-mau');

async function coCot(bang, cot) {
  const [r] = await db.query(`SHOW COLUMNS FROM \`${bang}\` LIKE ?`, [cot]);
  return r.length > 0;
}

async function main() {
  console.log('=== Migration 049: kho kien thuc tro ly ao ===');

  await db.query(`CREATE TABLE IF NOT EXISTS chatbot_kien_thuc (
    id            INT NOT NULL AUTO_INCREMENT,
    nhom          VARCHAR(60)  NOT NULL DEFAULT 'khac',
    cau_hoi       VARCHAR(500) NOT NULL,
    cau_hoi_khac  TEXT NULL COMMENT 'Moi dong mot cach hoi khac',
    tu_khoa       VARCHAR(500) NULL COMMENT 'Cach nhau dau phay',
    tra_loi       TEXT NOT NULL COMMENT 'Nhieu cach tra loi cach nhau ||',
    goi_y         VARCHAR(500) NULL COMMENT 'Cau goi y tiep, cach nhau |',
    lien_ket      VARCHAR(500) NULL COMMENT 'Nhan|url;Nhan|url',
    anh           VARCHAR(300) NULL,
    uu_tien       INT NOT NULL DEFAULT 0,
    bat           TINYINT(1) NOT NULL DEFAULT 1,
    nguon         VARCHAR(20) NOT NULL DEFAULT 'tay' COMMENT 'mau|tay|file|hoc',
    so_lan_dung   INT NOT NULL DEFAULT 0,
    tao_luc       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cap_nhat_luc  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_nhom (nhom),
    KEY idx_bat (bat)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('  + chatbot_kien_thuc');

  await db.query(`CREATE TABLE IF NOT EXISTS chatbot_lien_he (
    id          INT NOT NULL AUTO_INCREMENT,
    sdt         VARCHAR(20) NOT NULL,
    ten         VARCHAR(120) NULL,
    noi_dung    VARCHAR(1000) NULL,
    id_kh       INT NULL,
    phien       VARCHAR(64) NULL,
    da_xu_ly    TINYINT(1) NOT NULL DEFAULT 0,
    tao_luc     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_xu_ly (da_xu_ly)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('  + chatbot_lien_he');

  const cotMoi = [
    ['nguon', "VARCHAR(20) NULL COMMENT 'kien_thuc|mon|ml|du_phong|...'"],
    ['id_kien_thuc', 'INT NULL'],
    ['tra_loi', 'VARCHAR(1500) NULL'],
    ['phien', 'VARCHAR(64) NULL'],
    ['da_hoc', "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 chua, 1 da hoc, 2 bo qua'"],
    ['hoc_vao', 'INT NULL'],
  ];
  for (const [cot, kieu] of cotMoi) {
    if (!(await coCot('chatbot_hoi_thoai', cot))) {
      await db.query(`ALTER TABLE chatbot_hoi_thoai ADD COLUMN ${cot} ${kieu}`);
      console.log(`  + chatbot_hoi_thoai.${cot}`);
    }
  }

  await db.query(
    "INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES ('chatbot.thiet_lap', '{}', 'Thiet lap tro ly ao (JSON) - sua o /admin/chatbot')"
  );

  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM chatbot_kien_thuc');
  if (n === 0) {
    const nap = require('../../services/chatbotTriThuc');
    const kq = await nap.napBoMau();
    console.log(`  + nap bo kien thuc mau: ${kq.them} cap hoi dap`);
    await nap.dongKetNoi();
  } else {
    console.log(`  = kho da co ${n} cap hoi dap, giu nguyen`);
  }

  console.log('=== Hoan tat migration 049 ===');
  await db.end();
}

main().catch((e) => { console.error('Migration that bai:', e); process.exit(1); });

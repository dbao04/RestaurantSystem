/**
 * Migration 031 - Tạo thêm nhiều bàn 2 người cho nhà hàng
 *
 * Bổ sung 25 bàn 2 người (bàn đôi) phân bố trên cả 4 khu vực:
 *   - Sảnh chính (Tầng trệt): S15..S21 (7 bàn 2 người)
 *   - Sân vườn (Ngoài trời lãng mạn): V11..V18 (8 bàn 2 người)
 *   - Tầng 2 (View đẹp cạnh cửa sổ): T11..T18 (8 bàn 2 người)
 *   - Phòng VIP (VIP đôi riêng tư): P07..P08 (2 bàn 2 người)
 *
 * Kết hợp cùng 2 bàn 2 người sẵn có (S01, S02), nhà hàng sẽ có tổng cộng 27 BÀN 2 NGƯỜI,
 * đáp ứng tối đa nhu cầu của các cặp đôi, khách đi 2 người hoặc hẹn hò lãng mạn.
 */

const db = require('../db');

const URL_GOC = process.env.APP_URL || 'http://localhost:3000';
const ANH = ['bg_1.jpg', 'bg_2.jpg', 'bg_3.jpg', 'bg_4.jpg', 'bg_5.jpg'];

const DANH_SACH_BAN_2_NGUOI = [
  // --- SẢNH CHÍNH (id_vitri: 2) ---
  {
    ma_khu: 'S',
    id_vitri: 2,
    number_ban: 'S15',
    so_cho: 2,
    toa_do_x: 20,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người - Sảnh chính tầng trệt',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV2', gan_cua_so: 0, yen_tinh: 0, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'S',
    id_vitri: 2,
    number_ban: 'S16',
    so_cho: 2,
    toa_do_x: 185,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người - Sảnh chính tầng trệt',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV2', gan_cua_so: 0, yen_tinh: 0, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'S',
    id_vitri: 2,
    number_ban: 'S17',
    so_cho: 2,
    toa_do_x: 350,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người - Sảnh chính tầng trệt',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV2', gan_cua_so: 0, yen_tinh: 0, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'S',
    id_vitri: 2,
    number_ban: 'S18',
    so_cho: 2,
    toa_do_x: 515,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người - Sảnh chính tầng trệt',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV2', gan_cua_so: 0, yen_tinh: 0, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'S',
    id_vitri: 2,
    number_ban: 'S19',
    so_cho: 2,
    toa_do_x: 680,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người - Sảnh chính tầng trệt',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV2', gan_cua_so: 0, yen_tinh: 0, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'S',
    id_vitri: 2,
    number_ban: 'S20',
    so_cho: 2,
    toa_do_x: 845,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người - Sảnh chính tầng trệt',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV2', gan_cua_so: 0, yen_tinh: 0, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'S',
    id_vitri: 2,
    number_ban: 'S21',
    so_cho: 2,
    toa_do_x: 1010,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người - Sảnh chính tầng trệt',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV2', gan_cua_so: 0, yen_tinh: 0, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },

  // --- SÂN VƯỜN (id_vitri: 3) ---
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V11',
    so_cho: 2,
    toa_do_x: 70,
    toa_do_y: 341,
    ghichu: 'Bàn đôi sân vườn ngoài trời thoáng mát',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V12',
    so_cho: 2,
    toa_do_x: 1225,
    toa_do_y: 341,
    ghichu: 'Bàn đôi sân vườn ngoài trời thoáng mát',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V13',
    so_cho: 2,
    toa_do_x: 70,
    toa_do_y: 485,
    ghichu: 'Bàn đôi sân vườn cạnh tiểu cảnh hoa',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V14',
    so_cho: 2,
    toa_do_x: 350,
    toa_do_y: 485,
    ghichu: 'Bàn đôi sân vườn cạnh tiểu cảnh hoa',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V15',
    so_cho: 2,
    toa_do_x: 650,
    toa_do_y: 485,
    ghichu: 'Bàn đôi sân vườn lãng mạn cho cặp đôi',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V16',
    so_cho: 2,
    toa_do_x: 950,
    toa_do_y: 485,
    ghichu: 'Bàn đôi sân vườn lãng mạn cho cặp đôi',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V17',
    so_cho: 2,
    toa_do_x: 1225,
    toa_do_y: 485,
    ghichu: 'Bàn đôi sân vườn góc yên tĩnh',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'V',
    id_vitri: 3,
    number_ban: 'V18',
    so_cho: 2,
    toa_do_x: 200,
    toa_do_y: 341,
    ghichu: 'Bàn đôi sân vườn góc yên tĩnh',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV3', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },

  // --- TẦNG 2 (id_vitri: 4) ---
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T11',
    so_cho: 2,
    toa_do_x: 515,
    toa_do_y: 148,
    ghichu: 'Bàn 2 người tầng 2 cạnh cửa sổ view đẹp',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T12',
    so_cho: 2,
    toa_do_x: 680,
    toa_do_y: 148,
    ghichu: 'Bàn 2 người tầng 2 cạnh cửa sổ view đẹp',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T13',
    so_cho: 2,
    toa_do_x: 845,
    toa_do_y: 148,
    ghichu: 'Bàn 2 người tầng 2 cạnh cửa sổ view đẹp',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T14',
    so_cho: 2,
    toa_do_x: 1010,
    toa_do_y: 148,
    ghichu: 'Bàn 2 người tầng 2 cạnh cửa sổ view đẹp',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T15',
    so_cho: 2,
    toa_do_x: 20,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người tầng 2 ban công thoáng đãng',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T16',
    so_cho: 2,
    toa_do_x: 185,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người tầng 2 ban công thoáng đãng',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T17',
    so_cho: 2,
    toa_do_x: 350,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người tầng 2 không gian ấm cúng',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },
  {
    ma_khu: 'T',
    id_vitri: 4,
    number_ban: 'T18',
    so_cho: 2,
    toa_do_x: 515,
    toa_do_y: 276,
    ghichu: 'Bàn 2 người tầng 2 không gian ấm cúng',
    cho_dat_truoc: 1, co_the_ghep: 1, nhom_ghep: 'KV4', gan_cua_so: 1, yen_tinh: 1, phong_rieng: 0, xe_lan: 1, uu_tien_vip: 0
  },

  // --- PHÒNG VIP ĐÔI (id_vitri: 1) ---
  {
    ma_khu: 'P',
    id_vitri: 1,
    number_ban: 'P07',
    so_cho: 2,
    toa_do_x: 370,
    toa_do_y: 25,
    ghichu: 'Phòng VIP đôi - Hẹn hò / Kỷ niệm riêng tư',
    cho_dat_truoc: 1, co_the_ghep: 0, nhom_ghep: 'KV1', gan_cua_so: 0, yen_tinh: 1, phong_rieng: 1, xe_lan: 1, uu_tien_vip: 1
  },
  {
    ma_khu: 'P',
    id_vitri: 1,
    number_ban: 'P08',
    so_cho: 2,
    toa_do_x: 370,
    toa_do_y: 315,
    ghichu: 'Phòng VIP đôi - Hẹn hò / Kỷ niệm riêng tư',
    cho_dat_truoc: 1, co_the_ghep: 0, nhom_ghep: 'KV1', gan_cua_so: 0, yen_tinh: 1, phong_rieng: 1, xe_lan: 1, uu_tien_vip: 1
  },
];

async function main() {
  console.log('=== Migration 031: Thêm nhiều bàn 2 người cho nhà hàng ===\n');

  let themMoi = 0;
  let capNhat = 0;
  let qrTaoMoi = 0;

  for (let i = 0; i < DANH_SACH_BAN_2_NGUOI.length; i++) {
    const b = DANH_SACH_BAN_2_NGUOI[i];
    const image = ANH[i % ANH.length];

    // 1. Kiểm tra bàn đã tồn tại chưa
    const [coBan] = await db.query('SELECT Id_ban, so_cho FROM ban WHERE number_ban = ?', [b.number_ban]);

    if (coBan.length > 0) {
      await db.query(
        `UPDATE ban
            SET id_vitri = ?, so_cho = 2, ghichu = ?,
                cho_dat_truoc = ?, co_the_ghep = ?, nhom_ghep = ?,
                gan_cua_so = ?, yen_tinh = ?, phong_rieng = ?,
                xe_lan = ?, uu_tien_vip = ?
          WHERE Id_ban = ?`,
        [
          b.id_vitri, b.ghichu,
          b.cho_dat_truoc, b.co_the_ghep, b.nhom_ghep,
          b.gan_cua_so, b.yen_tinh, b.phong_rieng,
          b.xe_lan, b.uu_tien_vip,
          coBan[0].Id_ban
        ]
      );
      capNhat++;
      console.log(`  ~ Cập nhật bàn ${b.number_ban} (id: ${coBan[0].Id_ban}, số chỗ: 2)`);
    } else {
      const [kq] = await db.query(
        `INSERT INTO ban (
          id_vitri, number_ban, ghichu, image, trangthai, so_cho,
          toa_do_x, toa_do_y, cho_dat_truoc, co_the_ghep, nhom_ghep,
          gan_cua_so, yen_tinh, phong_rieng, xe_lan, uu_tien_vip
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.id_vitri, b.number_ban, b.ghichu, image, b.so_cho,
          b.toa_do_x, b.toa_do_y, b.cho_dat_truoc, b.co_the_ghep, b.nhom_ghep,
          b.gan_cua_so, b.yen_tinh, b.phong_rieng, b.xe_lan, b.uu_tien_vip
        ]
      );
      themMoi++;
      console.log(`  + Thêm mới bàn ${b.number_ban} (id: ${kq.insertId}, số chỗ: 2, toạ độ: ${b.toa_do_x}, ${b.toa_do_y})`);
    }

    // 2. Đồng bộ mã QR trong qr_tables
    const [coQR] = await db.query('SELECT id FROM qr_tables WHERE TRIM(table_name) = ? LIMIT 1', [b.number_ban]);
    if (!coQR.length) {
      const tableId = 'TBL' + b.number_ban.toUpperCase();
      const url = `${URL_GOC}/qr/table/${tableId}?name=${encodeURIComponent(b.number_ban)}`;
      await db.query(
        'INSERT INTO qr_tables (table_id, table_name, note, url) VALUES (?, ?, ?, ?)',
        [tableId, b.number_ban, b.ghichu, url]
      );
      qrTaoMoi++;
      console.log(`    └ QR code tạo mới: ${tableId}`);
    }
  }

  // Thống kê sau khi thêm
  console.log('\n--- Thống kê bàn sau khi thực hiện ---');
  const [thongKe] = await db.query(
    `SELECT so_cho, COUNT(*) as so_luong
       FROM ban
      GROUP BY so_cho
      ORDER BY so_cho`
  );
  console.table(thongKe);

  const [tong] = await db.query(
    `SELECT COUNT(*) AS tong_so_ban,
            SUM(so_cho) AS tong_cho,
            SUM(CASE WHEN so_cho = 2 THEN 1 ELSE 0 END) AS so_ban_2_nguoi
       FROM ban`
  );
  console.log(`Tổng số bàn hiện tại: ${tong[0].tong_so_ban} bàn · ${tong[0].tong_cho} chỗ ngồi`);
  console.log(`Trong đó có: ${tong[0].so_ban_2_nguoi} BÀN 2 NGƯỜI (BÀN ĐÔI).`);
  console.log(`Đã tạo thêm mới: ${themMoi} bàn, cập nhật: ${capNhat} bàn, tạo mới: ${qrTaoMoi} mã QR.`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Lỗi migration 031:', err);
      process.exit(1);
    });
}

module.exports = { main, DANH_SACH_BAN_2_NGUOI };

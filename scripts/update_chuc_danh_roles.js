const db = require('../config/db');

async function run() {
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Quay,Nhan vien chung' WHERE ma_cd = 'TRUONGLT'");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Phuc vu,Quan ly,Nhan vien chung' WHERE ma_cd = 'GSPV'");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Phuc vu,Nhan vien chung' WHERE ma_cd = 'PHUBAN'");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Bep,Quan ly,Nhan vien chung' WHERE ma_cd = 'QLBEP'");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Bep,Nhan vien chung' WHERE ma_cd IN ('PHUBEP', 'TAPVUBEP', 'TRUONGBAR')");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Thu ngan,Quan ly,Nhan vien chung' WHERE ma_cd = 'GSTN'");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Thu ngan,Nhan vien chung' WHERE ma_cd = 'NVTN'");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Ke toan,Quan ly,Nhan vien chung' WHERE ma_cd = 'KTTRUONG'");
  await db.query("UPDATE chuc_danh SET vai_tro_tuong_duong = 'Nhan vien chung' WHERE ma_cd IN ('THUKHO', 'DPGH')");

  const [rows] = await db.query('SELECT ma_cd, ten_cd, vai_tro_tuong_duong FROM chuc_danh ORDER BY id_cd');
  console.table(rows);
  console.log('Update successful!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

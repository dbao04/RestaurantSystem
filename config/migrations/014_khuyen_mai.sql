-- =====================================================================
-- Migration 014 - KHUYEN MAI dieu chinh duoc (ban SQL)
--
-- Ban nay tuong duong 014_khuyen_mai.js, danh cho ai muon chay thang trong
-- phpMyAdmin / MySQL Workbench thay vi qua Node.
--
-- Chay lai nhieu lan duoc: moi cot deu kiem tra INFORMATION_SCHEMA truoc,
-- nen khong dinh loi 1060 "Duplicate column name".
--
-- Cach dung trong phpMyAdmin: chon CSDL gs_restaurant -> tab SQL -> dan toan
-- bo tep nay -> Go.
-- =====================================================================

-- Bang goc phai ton tai (phong truong hop chua chay migrate.js).
CREATE TABLE IF NOT EXISTS discount_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type ENUM('percentage', 'fixed_amount') DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) NOT NULL,
  max_usage INT,
  current_usage INT DEFAULT 0,
  valid_from DATETIME NOT NULL,
  valid_until DATETIME NOT NULL,
  min_order_value DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  INDEX idx_code (code),
  INDEX idx_active (is_active),
  INDEX idx_valid (valid_from, valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Nhat ky tung luot dung ma.
-- Khoa duy nhat tren payment_id la chot chong dem trung: webhook ngan hang va
-- thu ngan bam xac nhan thu cong deu chay qua mot ham hau ky.
CREATE TABLE IF NOT EXISTS discount_usages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  discount_id INT NOT NULL,
  code VARCHAR(50) NOT NULL,
  id_kh INT NULL,
  sesis VARCHAR(50) NULL,
  payment_id INT NULL,
  so_tien_giam DECIMAL(12, 2) NOT NULL DEFAULT 0,
  gia_tri_don DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment (payment_id),
  INDEX idx_ma_khach (discount_id, id_kh),
  INDEX idx_code (code),
  INDEX idx_sesis (sesis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Thu tuc phu: them cot neu chua co.
DROP PROCEDURE IF EXISTS km_them_cot;
DELIMITER $$
CREATE PROCEDURE km_them_cot(IN p_cot VARCHAR(64), IN p_dinh_nghia TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'discount_codes'
      AND COLUMN_NAME = p_cot
  ) THEN
    SET @sql = CONCAT('ALTER TABLE discount_codes ADD COLUMN `', p_cot, '` ', p_dinh_nghia);
    PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END$$
DELIMITER ;

CALL km_them_cot('ten',                "VARCHAR(150) NULL COMMENT 'Ten chuong trinh hien cho khach'");
CALL km_them_cot('pham_vi',            "ENUM('tat_ca','loai_mon','mon') NOT NULL DEFAULT 'tat_ca'");
CALL km_them_cot('pham_vi_ids',        "VARCHAR(500) NULL COMMENT 'CSV id_loai hoac id_mon'");
CALL km_them_cot('ap_dung_thu',        "VARCHAR(20) NULL COMMENT 'CSV 1..7 theo DAYOFWEEK, rong = moi ngay'");
CALL km_them_cot('gio_bat_dau',        'TIME NULL');
CALL km_them_cot('gio_ket_thuc',       'TIME NULL');
CALL km_them_cot('gioi_han_moi_khach', "INT NULL COMMENT 'So luot toi da moi khach hang'");
CALL km_them_cot('hang_toi_thieu',     "VARCHAR(20) NULL COMMENT 'bronze|silver|gold|platinum'");
CALL km_them_cot('kenh',               "ENUM('tat_ca','quay','khach_qr') NOT NULL DEFAULT 'tat_ca'");
CALL km_them_cot('do_uu_tien',         "INT NOT NULL DEFAULT 0 COMMENT 'Cao hon duoc goi y truoc'");
CALL km_them_cot('hien_thi_khach',     "TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Co goi y cho thu ngan/khach khong'");

DROP PROCEDURE IF EXISTS km_them_cot;

-- Dat ten mac dinh cho cac ma tao truoc migration nay.
UPDATE discount_codes
SET ten = LEFT(COALESCE(NULLIF(TRIM(description), ''), code), 150)
WHERE ten IS NULL OR ten = '';

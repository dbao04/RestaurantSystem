-- Script bổ sung các bảng mới cho hệ thống nhà hàng
USE gs_restaurant;

CREATE TABLE IF NOT EXISTS `nhan_vien` (
  `id_nv` int(11) NOT NULL AUTO_INCREMENT,
  `ten` varchar(255) NOT NULL,
  `sodienthoai` varchar(15) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `diachi` varchar(300) DEFAULT NULL,
  `chucvu` varchar(100) NOT NULL DEFAULT 'Nhan vien',
  `username` varchar(100) NOT NULL,
  `passwords` varchar(255) NOT NULL,
  `ngayvaolam` date DEFAULT NULL,
  `trangthai` int(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_nv`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT IGNORE INTO `nhan_vien` (`ten`, `sodienthoai`, `email`, `chucvu`, `username`, `passwords`, `ngayvaolam`) VALUES
('Nguyen Van An', '0901234567', 'an@restaurant.com', 'Phuc vu', 'nv001', 'e10adc3949ba59abbe56e057f20f883e', '2024-01-01'),
('Tran Thi Binh', '0912345678', 'binh@restaurant.com', 'Thu ngan', 'nv002', 'e10adc3949ba59abbe56e057f20f883e', '2024-01-01');

CREATE TABLE IF NOT EXISTS `lich_lam_viec` (
  `id_lich` int(11) NOT NULL AUTO_INCREMENT,
  `id_nv` int(11) NOT NULL,
  `ngay` date NOT NULL,
  `ca` varchar(50) NOT NULL,
  `gio_bat_dau` time DEFAULT NULL,
  `gio_ket_thuc` time DEFAULT NULL,
  `trangthai` int(1) NOT NULL DEFAULT 0,
  `ghi_chu` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_lich`),
  KEY `id_nv` (`id_nv`),
  KEY `ngay` (`ngay`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `cham_cong` (
  `id_cc` int(11) NOT NULL AUTO_INCREMENT,
  `id_nv` int(11) NOT NULL,
  `ngay` date NOT NULL,
  `gio_vao` datetime DEFAULT NULL,
  `gio_ra` datetime DEFAULT NULL,
  `tong_gio` decimal(5,2) DEFAULT NULL,
  `ghi_chu` text DEFAULT NULL,
  PRIMARY KEY (`id_cc`),
  KEY `id_nv` (`id_nv`),
  KEY `ngay` (`ngay`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `thong_bao` (
  `id_tb` int(11) NOT NULL AUTO_INCREMENT,
  `id_nv` int(11) DEFAULT NULL,
  `tieu_de` varchar(300) NOT NULL,
  `noi_dung` text NOT NULL,
  `da_doc` int(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_tb`),
  KEY `id_nv` (`id_nv`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT IGNORE INTO `thong_bao` (`id_nv`, `tieu_de`, `noi_dung`) VALUES
(NULL, 'Chao mung den he thong!', 'Chao mung ban den voi he thong quan ly nha hang BD.'),
(NULL, 'Lich hop nhan vien', 'Cuoc hop toan the nhan vien vao 09:00 ngay 03/04/2026.');

CREATE TABLE IF NOT EXISTS `chat` (
  `id_chat` int(11) NOT NULL AUTO_INCREMENT,
  `id_kh` int(11) NOT NULL,
  `id_nv` int(11) DEFAULT NULL,
  `noi_dung` text NOT NULL,
  `nguoi_gui` varchar(20) NOT NULL,
  `da_doc` int(1) NOT NULL DEFAULT 0,
  `thoigian` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_chat`),
  KEY `id_kh` (`id_kh`),
  KEY `id_nv` (`id_nv`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `danh_gia` (
  `id_dg` int(11) NOT NULL AUTO_INCREMENT,
  `id_kh` int(11) NOT NULL,
  `sao` int(1) NOT NULL DEFAULT 5,
  `noi_dung` text DEFAULT NULL,
  `thoigian` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_dg`),
  KEY `id_kh` (`id_kh`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

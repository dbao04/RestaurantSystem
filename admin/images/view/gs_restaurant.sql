-- phpMyAdmin SQL Dump
-- version 5.0.2
-- https://www.phpmyadmin.net/
--
-- Máy chủ: 127.0.0.1:3306
-- Thời gian đã tạo: Th10 16, 2020 lúc 01:26 PM
-- Phiên bản máy phục vụ: 5.7.31
-- Phiên bản PHP: 7.3.21

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `gs_restaurant`
--

-- --------------------------------------------------------
DROP TABLE IF EXISTS `vitri`;
CREATE TABLE IF NOT EXISTS `vitri` (
  `id_vitri` int(11) NOT NULL AUTO_INCREMENT,
  `Name_vitri` varchar(5) NOT NULL,
  `Ghichu` text,
  `image` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_vitri`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
--
-- Cấu trúc bảng cho bảng `ban`
--

DROP TABLE IF EXISTS `ban`;
CREATE TABLE IF NOT EXISTS `ban` (
  `Id_ban` int(11) NOT NULL AUTO_INCREMENT,
  `id_vitri` int(11) NOT NULL,
  `number_ban` varchar(5) NOT NULL,
  `ghichu` text,
  `image` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`Id_ban`),
  CONSTRAINT fk_vitri_ban
   FOREIGN KEY (id_vitri)
   REFERENCES vitri (id_vitri)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `dichvu`
--

DROP TABLE IF EXISTS `dichvu`;
CREATE TABLE IF NOT EXISTS `dichvu` (
  `id_dichvu` int(11) NOT NULL AUTO_INCREMENT,
  `Name_dichvu` varchar(50) NOT NULL,
  `Gia_dichvu` double NOT NULL,
  `ghichu` text,
  PRIMARY KEY (`id_dichvu`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--


-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `khach_hang`
--

DROP TABLE IF EXISTS `khach_hang`;
CREATE TABLE IF NOT EXISTS `khach_hang` (
  `sodienthoai` double NOT NULL,
  `Name_khachhang` varchar(255) NOT NULL,
  `gioitinh` int(1) NOT NULL,
  `solandat` int(11) DEFAULT NULL,
  `ghichu` text,
  PRIMARY KEY (`sodienthoai`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `khuyenmai`
--

DROP TABLE IF EXISTS `khuyenmai`;
CREATE TABLE IF NOT EXISTS `khuyenmai` (
  `id_khuyenmai` int(11) NOT NULL AUTO_INCREMENT,
  `Name_khuyenmai` varchar(255) NOT NULL,
  `time_star` date DEFAULT NULL,
  `time_end` date DEFAULT NULL,
  `discout` double DEFAULT NULL,
  `ghichu` text,
  `image` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_khuyenmai`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `loai_mon`
--

DROP TABLE IF EXISTS `loai_mon`;
CREATE TABLE IF NOT EXISTS `loai_mon` (
  `id_loai` int(11) NOT NULL AUTO_INCREMENT,
  `name_loai` varchar(255) NOT NULL,
  `ghichu` text,
  PRIMARY KEY (`id_loai`)
  CONSTRAINT fk_loaimon_mon
   FOREIGN KEY (id_loai)
   REFERENCES vitri (id_loai)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `monan`
--

DROP TABLE IF EXISTS `monan`;
CREATE TABLE IF NOT EXISTS `monan` (
  `id_mon` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_loai` int(11) NOT NULL,
  `Name_mon` varchar(300) NOT NULL,
  `Gia_mon` double NOT NULL,
  `Ghichu_mon` text,
  `image` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_mon`),
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- -- Cấu trúc bảng cho bảng `hopdong`
--

DROP TABLE IF EXISTS `hopdong`;
CREATE TABLE IF NOT EXISTS `hopdong` (
  `ID_hopdong` int(11) NOT NULL AUTO_INCREMENT,
  `Sodienthoai` double NOT NULL,
  `date` date NOT NULL,
  `time_star` time NOT NULL,
  `time_end` time NOT NULL,
  `id_ban` int(11) NOT NULL,
  `id_dichvu` int(11) NOT NULL,
  `Id_khuyenmai` int(11) NOT NULL,
  `Id_monan` int(11) NOT NULL,
  PRIMARY KEY (`ID_hopdong`)
   CONSTRAINT fk_hopdong_KH
   FOREIGN KEY (sodienthoai)
   REFERENCES khachhang (sodienthoai),
   CONSTRAINT fk_hopdong_ban
   FOREIGN KEY (id_ban)
   REFERENCES ban (id_ban),
   CONSTRAINT fk_hopdong_dichvu
   FOREIGN KEY (id_dichvu)
   REFERENCES dichvu (id_dichvu),
   CONSTRAINT fk_hopdong_KM
   FOREIGN KEY (id_khuyenmai)
   REFERENCES khuyenmai (id_khuyenmai),
   CONSTRAINT fk_hopdong_mon
   FOREIGN KEY (id_monan)
   REFERENCES monan (id_monan)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
--


COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

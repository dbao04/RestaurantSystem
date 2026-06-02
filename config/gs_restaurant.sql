-- phpMyAdmin SQL Dump
-- version 5.0.2
-- https://www.phpmyadmin.net/
--
-- Máy chủ: 127.0.0.1:3306
-- Thời gian đã tạo: Th12 07, 2020 lúc 07:23 PM
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
  KEY `id_vitri` (`id_vitri`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `ban`
--

INSERT INTO `ban` (`Id_ban`, `id_vitri`, `number_ban`, `ghichu`, `image`) VALUES
(1, 2, '01', NULL, 'silde2.jpg'),
(2, 2, '02', NULL, 'slide0.jpg'),
(3, 2, '03', NULL, 'slide1.jpg'),
(4, 2, '04', NULL, 'slide3.jpg'),
(5, 2, '05', NULL, 'restaurant-691397.jpg'),
(6, 1, 'Vip1', NULL, 'Vip1.JPG'),
(7, 1, 'Vip2', NULL, 'Vip2.JPG'),
(8, 1, 'Vip3', NULL, 'Vip3.JPG'),
(9, 1, 'Vip5', NULL, 'Vip5.JPG');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `cart`
--

DROP TABLE IF EXISTS `cart`;
CREATE TABLE IF NOT EXISTS `cart` (
  `cart_id` int(11) NOT NULL AUTO_INCREMENT,
  `id_mon` bigint(20) NOT NULL,
  `sesid` varchar(255) NOT NULL,
  `name_mon` varchar(300) NOT NULL,
  `gia_mon` double NOT NULL,
  `soluong` int(11) NOT NULL,
  `images` varchar(200) NOT NULL,
  PRIMARY KEY (`cart_id`)
) ENGINE=MyISAM AUTO_INCREMENT=41 DEFAULT CHARSET=utf8;

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `dichvu`
--

INSERT INTO `dichvu` (`id_dichvu`, `Name_dichvu`, `Gia_dichvu`, `ghichu`) VALUES
(1, 'Trang trí ', 0, NULL),
(2, 'Karaoke', 500000, NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `hopdong`
--

DROP TABLE IF EXISTS `hopdong`;
CREATE TABLE IF NOT EXISTS `hopdong` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sesis` varchar(255) NOT NULL,
  `id_mon` int(11) NOT NULL,
  `name_mon` varchar(255) NOT NULL,
  `id_user` int(11) NOT NULL,
  `dates` text NOT NULL,
  `tg` text NOT NULL,
  `soluong` int(11) NOT NULL,
  `noidung` varchar(255) NOT NULL,
  `so_user` text NOT NULL,
  `gia` double NOT NULL,
  `images` varchar(255) NOT NULL,
  `tinhtrang` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `hopdong`
--

INSERT INTO `hopdong` (`id`, `sesis`, `id_mon`, `name_mon`, `id_user`, `dates`, `tg`, `soluong`, `noidung`, `so_user`, `gia`, `images`, `tinhtrang`) VALUES
(38, 'bn659jgr0h0h9ev4g8hgbeualt', 72, 'Khai vá»‹ 3 mÃ³n', 10, '12/23/2020', '1:00am', 3, 'Sinh nháº­t', '4', 200000, '7fbb074b00.jpg', 0),
(39, 'bn659jgr0h0h9ev4g8hgbeualt', 71, 'Gá»i bÃ² ', 10, '12/23/2020', '1:00am', 1, 'Sinh nháº­t', '4', 200000, 'ff05be5866.jpg', 0);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `khach_hang`
--

DROP TABLE IF EXISTS `khach_hang`;
CREATE TABLE IF NOT EXISTS `khach_hang` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ten` varchar(255) NOT NULL,
  `sodienthoai` varchar(15) NOT NULL,
  `gioitinh` int(1) NOT NULL,
  `solandat` int(11) DEFAULT NULL,
  `ghichu` text,
  `passwords` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `khach_hang`
--

INSERT INTO `khach_hang` (`id`, `ten`, `sodienthoai`, `gioitinh`, `solandat`, `ghichu`, `passwords`) VALUES
(7, 'Thanh NgÃ¢n', '01885003265', 1, NULL, NULL, 'e10adc3949ba59abbe56e057f20f883e'),
(10, 'Thanh NgÃ¢n', '0332004469', 1, NULL, NULL, 'e10adc3949ba59abbe56e057f20f883e');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `khuyenmai`
--

DROP TABLE IF EXISTS `khuyenmai`;
CREATE TABLE IF NOT EXISTS `khuyenmai` (
  `id_km` int(11) NOT NULL AUTO_INCREMENT,
  `name_km` varchar(300) CHARACTER SET utf8mb4 NOT NULL,
  `time_star` date DEFAULT NULL,
  `time_end` date DEFAULT NULL,
  `discout` double DEFAULT NULL,
  `ghichu` text,
  `images` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_km`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `khuyenmai`
--

INSERT INTO `khuyenmai` (`id_km`, `name_km`, `time_star`, `time_end`, `discout`, `ghichu`, `images`) VALUES
(4, 'Tri Ã¢n khÃ¡ch hÃ ng ', '2020-11-12', '2020-11-20', 50, ' ', '8a5ae5a5bd.jpg');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `loai_mon`
--

DROP TABLE IF EXISTS `loai_mon`;
CREATE TABLE IF NOT EXISTS `loai_mon` (
  `id_loai` int(11) NOT NULL AUTO_INCREMENT,
  `name_loai` varchar(255) NOT NULL,
  `ghichu` text NOT NULL,
  PRIMARY KEY (`id_loai`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `loai_mon`
--

INSERT INTO `loai_mon` (`id_loai`, `name_loai`, `ghichu`) VALUES
(10, 'Khai vá»‹', ''),
(11, 'Heo', ''),
(12, 'BÃ²', ''),
(13, 'GÃ ', ''),
(14, 'cÆ¡m/bÃºn /mÃ¬', ''),
(16, 'TrÃ¡ng miá»‡ng', '');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `monan`
--

DROP TABLE IF EXISTS `monan`;
CREATE TABLE IF NOT EXISTS `monan` (
  `id_mon` bigint(20) NOT NULL AUTO_INCREMENT,
  `name_mon` varchar(300) NOT NULL,
  `id_loai` int(11) NOT NULL,
  `gia_mon` double NOT NULL,
  `ghichu_mon` text,
  `images` varchar(300) DEFAULT NULL,
  `tinhtrang` int(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_mon`),
  KEY `id_loai` (`id_loai`)
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `monan`
--

INSERT INTO `monan` (`id_mon`, `name_mon`, `id_loai`, `gia_mon`, `ghichu_mon`, `images`, `tinhtrang`) VALUES
(48, 'Thá»‹t heo nÆ°á»›ng ', 11, 1000, '', 'f5bf17632c.jpg', 1),
(49, 'há»§ tiáº¿u Ã¡p cháº£o ', 14, 1000, '', '14b5d07e78.jpg', 0),
(50, 'CÆ¡m chiÃªn Lá»™c PhÃ¡t', 14, 140000, '', '23901ccf32.jpg', 1),
(51, 'Miáº¿n xÃ o cua', 14, 200000, '', '4ce1fb365a.jpg', 1),
(52, 'CÆ¡m xÃ¡ xÃ­u', 14, 100000, '', 'e8ead109db.jpg', 1),
(54, 'BÃ² xÃ o Ä‘áº­u', 12, 200000, '', 'ef171620d1.jpg', 1),
(55, 'BÃ² nÆ°á»›ng Y', 12, 210000, '', '2b6c56a51d.jpg', 1),
(56, 'BÃ² nÆ°á»›ng Ä‘Ã¡', 12, 300000, '', '48f4ea300c.jpg', 1),
(57, 'BÃ² háº§m', 12, 200000, '', '9b10800509.jpg', 1),
(58, 'Heo lÃªn máº¹t', 11, 200000, '', 'c50872ded9.jpg', 1),
(59, 'GÃ  háº§m', 13, 200000, '', '0d3a986b70.jpg', 1),
(60, 'GÃ  nÆ°á»›ng ', 13, 200000, '', 'b5c1c9fe66.jpg', 1),
(61, 'TrÃ¡i cÃ¢y 1', 16, 50000, '', '9720364c45.jpg', 1),
(62, 'TrÃ¡i cÃ¢y 2', 16, 50000, '', 'e8962224b8.jpg', 1),
(63, 'Rau cÃ¢u 1', 16, 50000, '', 'c16eef151d.jpg', 1),
(64, 'Rau cÃ¢u 2', 16, 50000, '', '94b370ea47.jpg', 1),
(67, 'Gá»i ngÃ³ sen', 10, 120000, '', '212b6fe40e.jpg', 1),
(68, 'Gá»i bÃ²', 12, 120000, '', 'a9b1758ff7.jpg', 1),
(69, 'Äáº­u há»§ chiÃªn giÃ²n ', 10, 80000, '', '56f31f13dc.jpg', 1),
(70, 'Äáº­u há»§ Tá»© XuyÃªn ', 10, 140000, '', 'c8217c6bc8.jpg', 1),
(71, 'Gá»i bÃ² ', 10, 200000, '', 'ff05be5866.jpg', 1),
(72, 'Khai vá»‹ 3 mÃ³n', 10, 200000, '', '7fbb074b00.jpg', 1),
(73, 'Cháº£ giÃ²', 10, 200000, '', '01c15124a7.jpg', 1),
(74, 'SÆ°á»n heo ngon', 11, 200000, '', 'f73f6b9bdc.jpg', 1),
(75, 'Lá»£n quay', 11, 200000, '', '6fe0bf3207.jpg', 1);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `tb_admin`
--

DROP TABLE IF EXISTS `tb_admin`;
CREATE TABLE IF NOT EXISTS `tb_admin` (
  `id_admin` int(11) NOT NULL AUTO_INCREMENT,
  `Name_admin` varchar(255) NOT NULL,
  `adminuser` varchar(155) NOT NULL,
  `adminpass` varchar(255) NOT NULL,
  `level` int(11) NOT NULL,
  PRIMARY KEY (`id_admin`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `tb_admin`
--

INSERT INTO `tb_admin` (`id_admin`, `Name_admin`, `adminuser`, `adminpass`, `level`) VALUES
(1, 'Ngan', 'Ngan', 'e10adc3949ba59abbe56e057f20f883e', 0);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `vitri`
--

DROP TABLE IF EXISTS `vitri`;
CREATE TABLE IF NOT EXISTS `vitri` (
  `id_vitri` int(11) NOT NULL AUTO_INCREMENT,
  `Name_vitri` varchar(5) NOT NULL,
  `Ghichu` text,
  `image` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id_vitri`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;

--
-- Đang đổ dữ liệu cho bảng `vitri`
--

INSERT INTO `vitri` (`id_vitri`, `Name_vitri`, `Ghichu`, `image`) VALUES
(1, 'Vip', NULL, 'Vip3.JPG'),
(2, 'Sảnh ', NULL, 'silde2.jpg');

--
-- Các ràng buộc cho các bảng đã đổ
--

--
-- Các ràng buộc cho bảng `ban`
--
ALTER TABLE `ban`
  ADD CONSTRAINT `ban_ibfk_1` FOREIGN KEY (`id_vitri`) REFERENCES `vitri` (`id_vitri`);

--
-- Các ràng buộc cho bảng `monan`
--
ALTER TABLE `monan`
  ADD CONSTRAINT `monan_ibfk_1` FOREIGN KEY (`id_loai`) REFERENCES `loai_mon` (`id_loai`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

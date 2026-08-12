@echo off
REM ===================================================================
REM  Mo he thong ra Internet de dien thoai khach quet ma QR
REM  tu BAT KY mang nao (4G, wifi nha, wifi quan khac...).
REM
REM  Thu tu dung:
REM    1. Chay start_all.bat truoc (server phai dang chay).
REM    2. Nhap dup file nay - no se hien ra mot dia chi https.
REM    3. Vao trang quan tri IN LAI ma QR, roi dan len ban.
REM    4. Giu cua so nay mo suot buoi. Dong la mat dia chi.
REM ===================================================================
title NHA HANG BAO DOAN - Mo QR ra Internet
cd /d "%~dp0"
node scripts/moOnline.js
echo.
echo  Tunnel da dong. Ma QR quay ve dia chi trong mang LAN.
pause

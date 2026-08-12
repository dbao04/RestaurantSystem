@echo off
REM ===================================================================
REM  Khoi dong toan bo he thong nha hang thong minh
REM  Nhap dup file nay la du - tu kiem tra va cai dat moi thu con thieu
REM ===================================================================
title NHA HANG BAO DOAN - Khoi dong he thong
cd /d "%~dp0"

set "MYSQL_BIN=C:\xampp\mysql\bin"
if not exist "%MYSQL_BIN%\mysql.exe" set "MYSQL_BIN=D:\xampp\mysql\bin"

echo.
echo  [1/5] Kiem tra MySQL...
netstat -ano | findstr :3306 >nul
if errorlevel 1 (
    echo        MySQL chua chay - dang khoi dong XAMPP MySQL...
    if exist "%MYSQL_BIN%\mysqld.exe" (
        start "MySQL" /min "%MYSQL_BIN%\mysqld.exe" --defaults-file="%MYSQL_BIN%\my.ini" --standalone
        timeout /t 8 /nobreak >nul
    ) else (
        echo        [LOI] Khong tim thay XAMPP MySQL.
        echo        Hay bat MySQL bang tay roi chay lai file nay.
        pause
        exit /b 1
    )
) else (
    echo        MySQL dang chay.
)

echo  [2/5] Kiem tra file cau hinh .env...
if not exist ".env" (
    echo        Chua co .env - dang tao tu .env.example...
    copy /y ".env.example" ".env" >nul
    echo        Da tao .env voi cau hinh mac dinh.
    echo        Neu MySQL cua ban co MAT KHAU, hay mo .env va sua DB_PASS.
) else (
    echo        Da co .env.
)

echo  [3/5] Kiem tra thu vien Node.js...
if not exist "node_modules" (
    echo        Chua cai thu vien - dang chay npm install ^(mat vai phut^)...
    call npm install
    if errorlevel 1 (
        echo        [LOI] npm install that bai. Kiem tra da cai Node.js chua.
        pause
        exit /b 1
    )
) else (
    echo        Da co thu vien.
)

echo  [4/5] Kiem tra co so du lieu...
call npm run --silent db:check >nul 2>&1
if errorlevel 2 (
    echo        [LOI] Khong ket noi duoc MySQL.
    echo        Kiem tra MySQL da bat chua, va DB_USER/DB_PASS trong file .env.
    echo        Chi tiet:
    call npm run --silent db:check
    pause
    exit /b 1
)
if errorlevel 1 (
    echo        Chua co du lieu - dang nap tu database\gs_restaurant.sql...
    call npm run db:setup
    if errorlevel 1 (
        echo        [LOI] Nap co so du lieu that bai.
        pause
        exit /b 1
    )
) else (
    echo        Co so du lieu day du ^(62 bang^).
)

echo  [5/5] Khoi dong cac dich vu...
echo        - ML service ^(Python/FastAPI - cong 8000^)
start "ML Service" cmd /k "cd /d "%~dp0" && npm run ml"
timeout /t 6 /nobreak >nul
echo        - Web server ^(Node/Express - cong 3000^)
start "Web Server" cmd /k "cd /d "%~dp0" && npm start"
timeout /t 4 /nobreak >nul

echo.
echo  ===================================================================
echo   HE THONG DA SAN SANG
echo  ===================================================================
echo   Trang khach hang    : http://localhost:3000
echo   Dang nhap quan tri  : http://localhost:3000/admin
echo   Dashboard phan tich : http://localhost:3000/analytics
echo   Du bao AI / ML      : http://localhost:3000/du-bao
echo   Tro ly ao ^(chatbot^) : http://localhost:3000/admin/chatbot
echo   Man hinh bep (KDS)  : http://localhost:3000/kds
echo   So do ban           : http://localhost:3000/so-do-ban
echo   Tai lieu API ML     : http://127.0.0.1:8000/docs
echo  ===================================================================
echo.
echo   Tat he thong: dong hai cua so "Web Server" va "ML Service".
echo.
echo  -------------------------------------------------------------------
echo   Khach quet ma QR bang 4G, hoac may o mang khac can vao he thong?
echo   Nhap dup _mo_qr_online.bat de mo ra Internet (dia chi https that).
echo   Chi tiet: HUONG_DAN_QUET_QR_TU_XA.md
echo  -------------------------------------------------------------------
echo.
pause

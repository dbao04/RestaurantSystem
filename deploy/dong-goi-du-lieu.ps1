# =============================================================================
#  DONG GOI DU LIEU THAT de chuyen len VPS (chay tren may Windows dang co XAMPP)
#
#     powershell -ExecutionPolicy Bypass -File deploy\dong-goi-du-lieu.ps1
#
#  Tao file deploy\goi\deploy-goi.zip gom:
#    - gs_restaurant.sql      : toan bo CSDL (tru bang phien dang nhap)
#    - du_lieu_khuon_mat\     : anh cham cong khuon mat da cat
#    - mo_hinh_khuon_mat\     : mo hinh nhan dien (.onnx, khong co tren GitHub)
#    - uploads\               : anh khach/nhan vien tai len
#    - env-giu-lai.txt        : email gui thu + tai khoan ngan hang VietQR
#
#  KHONG BAO GIO dua file nay len GitHub: kho dang de CONG KHAI va goi chua so
#  dien thoai khach, mat khau (da bam) nhan vien, anh khuon mat.
# =============================================================================
$ErrorActionPreference = 'Stop'
$goc = Split-Path $PSScriptRoot -Parent
$ra = Join-Path $PSScriptRoot 'goi'
$tam = Join-Path $ra 'tam'
$mysqldump = 'C:\xampp\mysql\bin\mysqldump.exe'

if (Test-Path $tam) { Remove-Item $tam -Recurse -Force }
New-Item -ItemType Directory -Force $tam | Out-Null

# Doc cau hinh CSDL tu .env
$env_ = @{}
Get-Content (Join-Path $goc '.env') | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=(.*)$' } | ForEach-Object { $env_[$Matches[1]] = $Matches[2].Trim() }

Write-Host '1/4 Xuat CSDL...'
$tsDb = @("--host=$($env_['DB_HOST'])", "--port=$($env_['DB_PORT'])", "-u$($env_['DB_USER'])")
if ($env_['DB_PASS']) { $tsDb += "-p$($env_['DB_PASS'])" }
$tsDb += @('--single-transaction', '--routines', '--triggers', '--default-character-set=utf8mb4',
  "--ignore-table=$($env_['DB_NAME']).phien_dang_nhap",
  "--result-file=$(Join-Path $tam 'gs_restaurant.sql')", $env_['DB_NAME'])
& $mysqldump @tsDb
if ($LASTEXITCODE -ne 0) { throw 'mysqldump that bai - MySQL trong XAMPP da bat chua?' }

Write-Host '2/4 Chep du lieu khuon mat, mo hinh AI, anh tai len...'
foreach ($cap in @(
    @('du_lieu_khuon_mat', 'du_lieu_khuon_mat'),
    @('ml_service\mo_hinh_khuon_mat', 'mo_hinh_khuon_mat'),
    @('public\uploads', 'uploads'))) {
  $nguon = Join-Path $goc $cap[0]
  if (Test-Path $nguon) { Copy-Item $nguon (Join-Path $tam $cap[1]) -Recurse }
}

Write-Host '3/4 Giu lai cau hinh email / ngan hang...'
$giu = 'EMAIL_USER', 'EMAIL_PASS', 'VIETQR_BANK', 'VIETQR_ACCOUNT', 'VIETQR_NAME'
($giu | Where-Object { $env_[$_] } | ForEach-Object { "$_=$($env_[$_])" }) -join "`n" |
  Set-Content (Join-Path $tam 'env-giu-lai.txt') -NoNewline -Encoding ascii

Write-Host '4/4 Nen zip...'
$zip = Join-Path $ra 'deploy-goi.zip'
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $tam '*') -DestinationPath $zip
Remove-Item $tam -Recurse -Force
'Xong: {0} ({1:N1} MB)' -f $zip, ((Get-Item $zip).Length / 1MB)

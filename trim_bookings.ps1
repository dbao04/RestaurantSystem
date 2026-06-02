$filePath = 'c:\xampp\htdocs\restaurant\views\staff\bookings.ejs'
$lines = Get-Content $filePath
$cutLines = $lines | Select-Object -First 368
$tmpPath = $filePath + '.tmp'
$cutLines | Out-File -FilePath $tmpPath -Encoding utf8 -Force
Copy-Item -Path $tmpPath -Destination $filePath -Force
Remove-Item -Path $tmpPath
Write-Host "Done: kept first 368 lines"

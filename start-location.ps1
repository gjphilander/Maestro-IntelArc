Set-Location 'D:\Maestro.git\app'
$env:MAESTRO_DEVICE = 'xpu'
$env:ONEAPI_DEVICE_SELECTOR = 'level_zero:gpu'
.\env-xpu\Scripts\python.exe .\scripts\xpu_preflight.py
if ($LASTEXITCODE -eq 0) {
    .\env-xpu\Scripts\python.exe .\launch.py
}
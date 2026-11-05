@echo off
setlocal
title Maestro Standalone

set "MAESTRO_ROOT=%~dp0"
set "APP_DIR=%MAESTRO_ROOT%app"

if not exist "%APP_DIR%\launch.py" goto missing_app
pushd "%APP_DIR%" >nul
if errorlevel 1 goto app_folder_error

if /I "%MAESTRO_DEVICE%"=="xpu" goto detect_device
if /I "%MAESTRO_DEVICE%"=="cuda" goto use_cuda
if /I "%MAESTRO_DEVICE%"=="nvidia" (
  set "MAESTRO_DEVICE=cuda"
  goto use_cuda
)
if /I "%MAESTRO_DEVICE%"=="auto" set "MAESTRO_DEVICE="
if defined MAESTRO_DEVICE goto invalid_device
goto detect_device

:detect_device
where nvidia-smi.exe >nul 2>&1
if not errorlevel 1 (
  nvidia-smi.exe -L >nul 2>&1
  if not errorlevel 1 (
    set "MAESTRO_DEVICE="
    goto use_cuda
  )
)
set "NVIDIA_SMI=%ProgramFiles%\NVIDIA Corporation\NVSMI\nvidia-smi.exe"
if exist "%NVIDIA_SMI%" (
  "%NVIDIA_SMI%" -L >nul 2>&1
  if not errorlevel 1 (
    set "MAESTRO_DEVICE="
    goto use_cuda
  )
)
if /I "%MAESTRO_DEVICE%"=="xpu" goto use_xpu
rem XPU: Prefer the installed Intel runtime when no working NVIDIA driver is found.
if exist "env-xpu\Scripts\activate.bat" goto use_xpu
goto use_cuda

:use_xpu
rem XPU: Use Maestro's dedicated PyTorch XPU environment and device selector.
set "MAESTRO_DEVICE=xpu"
set "MAESTRO_ENV=env-xpu"
goto runtime_selected

:use_cuda
set "MAESTRO_ENV=env"
if exist "env-sol\.maestro_sol_runtime_v1.installed" set "MAESTRO_ENV=env-sol"
if exist "env-rtx50\.maestro_torch_rtx50_v2.installed" set "MAESTRO_ENV=env-rtx50"
goto runtime_selected

:runtime_selected
if not exist "%MAESTRO_ENV%\Scripts\activate.bat" goto missing_runtime
call "%MAESTRO_ENV%\Scripts\activate.bat"
if errorlevel 1 goto activation_failed

rem Keep FFmpeg discoverable without relying on Pinokio's shell activation.
set "FFMPEG_BIN="
if exist "%APP_DIR%\ffmpeg_bins\ffmpeg.exe" set "FFMPEG_BIN=%APP_DIR%\ffmpeg_bins"
if not defined FFMPEG_BIN if defined CONDA_PREFIX if exist "%CONDA_PREFIX%\Library\bin\ffmpeg.exe" set "FFMPEG_BIN=%CONDA_PREFIX%\Library\bin"
if not defined FFMPEG_BIN if exist "%MAESTRO_ENV%\Library\bin\ffmpeg.exe" set "FFMPEG_BIN=%MAESTRO_ENV%\Library\bin"
for %%I in ("%MAESTRO_ROOT%..\..\bin\miniconda\Library\bin") do set "PINOKIO_FFMPEG_BIN=%%~fI"
if not defined FFMPEG_BIN if exist "%PINOKIO_FFMPEG_BIN%\ffmpeg.exe" set "FFMPEG_BIN=%PINOKIO_FFMPEG_BIN%"
if defined FFMPEG_BIN (
  set "PATH=%FFMPEG_BIN%;%PATH%"
  if not defined FFMPEG_BINARY if exist "%FFMPEG_BIN%\ffmpeg.exe" set "FFMPEG_BINARY=%FFMPEG_BIN%\ffmpeg.exe"
  if not defined FFPROBE_BINARY if exist "%FFMPEG_BIN%\ffprobe.exe" set "FFPROBE_BINARY=%FFMPEG_BIN%\ffprobe.exe"
  echo Using FFmpeg from %FFMPEG_BIN%
)

if not exist "%MAESTRO_ROOT%ui\dist\index.html" goto missing_ui
if not defined SERVER_PORT set "SERVER_PORT=7860"
if not defined SERVER_NAME set "SERVER_NAME=127.0.0.1"
if not defined PINOKIO_SHARE_LOCAL set "PINOKIO_SHARE_LOCAL=false"

echo Starting Maestro with %MAESTRO_ENV%...
if /I "%MAESTRO_DEVICE%"=="xpu" goto xpu_preflight
goto launch_maestro

:xpu_preflight
rem XPU: Keep the Intel runtime defaults overridable and validate it before launch.
if not defined ONEAPI_DEVICE_SELECTOR set "ONEAPI_DEVICE_SELECTOR=level_zero:gpu"
if not defined SYCL_CACHE_PERSISTENT set "SYCL_CACHE_PERSISTENT=1"
if not defined PYTORCH_ENABLE_XPU_FALLBACK set "PYTORCH_ENABLE_XPU_FALLBACK=1"
if not exist "scripts\xpu_preflight.py" goto missing_preflight
python scripts\xpu_preflight.py
if errorlevel 1 goto preflight_failed

:launch_maestro
echo Maestro will print the WebUI address below. Press Ctrl+C to stop it gracefully.
python launch.py
set "MAESTRO_EXIT_CODE=%ERRORLEVEL%"
popd
if not "%MAESTRO_EXIT_CODE%"=="0" (
  echo Maestro exited with code %MAESTRO_EXIT_CODE%.
  pause
)
exit /b %MAESTRO_EXIT_CODE%

:missing_app
echo [ERROR] Could not find "%APP_DIR%\launch.py".
echo Run this file from the Maestro project folder.
pause
exit /b 1

:app_folder_error
echo [ERROR] Could not open the Maestro app folder: "%APP_DIR%".
pause
exit /b 1

:invalid_device
echo [ERROR] Unsupported MAESTRO_DEVICE="%MAESTRO_DEVICE%".
echo Use xpu, cuda, nvidia, or auto.
popd
pause
exit /b 1

:missing_runtime
echo [ERROR] The Python environment "%MAESTRO_ENV%" is not installed.
echo Install Maestro dependencies first, then run this file again.
popd
pause
exit /b 1

:activation_failed
echo [ERROR] Could not activate "%MAESTRO_ENV%".
popd
pause
exit /b 1

:missing_ui
echo [ERROR] The WebUI build is missing at "%MAESTRO_ROOT%ui\dist\index.html".
echo Build the UI before starting Maestro.
popd
pause
exit /b 1

:missing_preflight
echo [ERROR] The Intel XPU preflight script is missing.
popd
pause
exit /b 1

:preflight_failed
echo [ERROR] Intel XPU preflight failed. Check the messages above, driver, and Level Zero runtime.
popd
pause
exit /b 1

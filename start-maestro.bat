@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "APP=%~dp0app"
set "RUNTIME=%APP%\env-xpu"
set "STAGE=%APP%\env-xpu.maestro-copy"
set "SOURCE=%~dp0\Maestro-IntelArc\app\env-xpu"
if not exist "%APP%\launch.py" goto wrong_folder
if exist "%RUNTIME%\Scripts\python.exe" goto launch
if exist "%RUNTIME%\" goto partial
if not exist "%SOURCE%\Scripts\python.exe" goto missing
echo Preparing the local Intel runtime. This first launch copies the installed packages.
robocopy "%SOURCE%" "%STAGE%" /E /XJ /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NP
if errorlevel 8 goto copy_failed
if not exist "%STAGE%\Scripts\python.exe" goto copy_failed
if not exist "%STAGE%\Lib\site-packages\torch\lib\c10_xpu.dll" goto copy_failed
ren "%STAGE%" "env-xpu"
if errorlevel 1 goto copy_failed
:launch
set "MAESTRO_DEVICE=xpu"
set "VIRTUAL_ENV=%RUNTIME%"
set "PYTHONHOME="
set "PYTHONPATH="
set "PYTHONNOUSERSITE=1"
set "PATH=%RUNTIME%\Scripts;%RUNTIME%\Library\bin;%APP%\ffmpeg_bins;%PATH%"
if not defined ONEAPI_DEVICE_SELECTOR set "ONEAPI_DEVICE_SELECTOR=level_zero:gpu"
if not defined PYTORCH_ENABLE_XPU_FALLBACK set "PYTORCH_ENABLE_XPU_FALLBACK=1"
if not defined SERVER_PORT set "SERVER_PORT=7861"
set "SERVER_NAME=127.0.0.1"
set "MAESTRO_OPEN_BROWSER=1"
pushd "%APP%" || goto wrong_folder
echo Using "%RUNTIME%\Scripts\python.exe"
"%RUNTIME%\Scripts\python.exe" -B scripts\xpu_preflight.py
if errorlevel 1 goto gpu_failed
"%RUNTIME%\Scripts\python.exe" launch.py
set "rc=%errorlevel%"
popd
if not "%rc%"=="0" pause
exit /b %rc%
:gpu_failed
popd
echo The local Intel GPU check failed. Review the error above.
goto failed
:wrong_folder
echo Place this launcher beside VERSION in the Maestro 4.1.1 folder.
goto failed
:partial
echo A local env-xpu folder exists without Scripts\python.exe. Inspect it before retrying.
goto failed
:missing
echo The one-time setup requires the original Maestro-IntelArc\app\env-xpu folder.
goto failed
:copy_failed
echo Runtime copy did not finish. Check free space and the copy output, then run this file again.
:failed
pause
exit /b 1

@echo off

git switch intel-arc-xpu || goto :error
git config user.name "gjphilander" || goto :error
git config user.email "gjphilander@gmail.com" || goto :error

git add -A || goto :error
git status --short
git diff --cached --stat
git diff --cached --check || goto :error

git diff --cached --quiet
if errorlevel 1 goto :commit
goto :push

:commit
echo.
echo Review the staged files above. Press any key to commit and push.
pause
git commit -m "Add Intel Arc XPU support" || goto :error

:push
git remote get-url fork >nul 2>&1
if errorlevel 1 (
    git remote add fork https://github.com/gjphilander/Maestro-IntelArc.git || goto :error
) else (
    git remote set-url fork https://github.com/gjphilander/Maestro-IntelArc.git || goto :error
)

git push -u fork intel-arc-xpu:main || goto :error

echo.
echo Changes pushed successfully.
pause
exit /b 0

:error
echo.
echo A command failed. Review the message above; later steps were not run.
pause
exit /b 1

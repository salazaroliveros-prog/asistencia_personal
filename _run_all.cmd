@echo off
cd /d c:\Users\wilso\Documents\APPS\control_asistencia_app
set HEADLESS=1
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul
start /B "" cmd /c "npx vite --host 127.0.0.1 --port 3801 2>nul"
timeout /t 8 /nobreak >nul
echo ===server started===
npx playwright test --config=playwright.qr-camera.config.ts puesto-personalizado --reporter=list --output=__e2e__/output/qr-camera-fix
set EXITCODE=%ERRORLEVEL%
taskkill /f /im node.exe 2>nul
echo ===EXITCODE: %EXITCODE%===
exit /b %EXITCODE%

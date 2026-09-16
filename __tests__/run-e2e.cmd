@echo off
set PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers
cd /d "%~dp0.."
npx playwright test __e2e__/verify-fixes.spec.ts --reporter=list --workers=1 > "__e2e__\out.txt" 2>&1
echo EXIT=%ERRORLEVEL% >> "__e2e__\out.txt"
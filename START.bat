@echo off
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║          Veda — Pharmacy Intelligence                ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  [1] Start dev server                                ║
echo  ║  [2] Seed demo data                                  ║
echo  ║  [3] Deploy Firestore rules                          ║
echo  ║  [4] Install / update packages                       ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

set /p choice="Enter choice (1, 2, 3 or 4): "

if "%choice%"=="4" (
  echo.
  echo  Installing packages...
  npm install
  echo.
  echo  Done.
  pause
  goto :eof
)

if "%choice%"=="3" (
  echo.
  echo  Deploying Firestore security rules...
  npm run deploy:rules
  pause
  goto :eof
)

if "%choice%"=="2" (
  echo.
  echo  Seeding demo data...
  npm run seed
  pause
  goto :eof
)

echo.
echo  Starting Veda frontend...
echo.
npm run dev

@echo off
REM Dashboard Refactoring Application Script (Windows)
REM This script applies the professional refactoring to your crowd monitoring dashboard

echo ==========================================
echo  FestNet Dashboard Refactoring Script
echo ==========================================
echo.

cd "%~dp0src\features\crowd_monitoring"

echo Creating backups of original files...
echo.

REM Create backup directory with timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set BACKUP_DIR=.backups\%mydate%_%mytime%

if not exist ".backups" mkdir ".backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Backup original files
if exist "pages\CrowdMonitoringPage.tsx" (
  copy "pages\CrowdMonitoringPage.tsx" "%BACKUP_DIR%\CrowdMonitoringPage.original.tsx" >nul
  echo [OK] Backed up CrowdMonitoringPage.tsx
)

if exist "components\SurgeAlertBanner.tsx" (
  copy "components\SurgeAlertBanner.tsx" "%BACKUP_DIR%\SurgeAlertBanner.original.tsx" >nul
  echo [OK] Backed up SurgeAlertBanner.tsx
)

if exist "components\ZoneDrawerModal.tsx" (
  copy "components\ZoneDrawerModal.tsx" "%BACKUP_DIR%\ZoneDrawerModal.original.tsx" >nul
  echo [OK] Backed up ZoneDrawerModal.tsx
)

echo.
echo Applying refactored versions...
echo.

REM Apply refactored files
if exist "pages\CrowdMonitoringPage.refactored.tsx" (
  move /y "pages\CrowdMonitoringPage.refactored.tsx" "pages\CrowdMonitoringPage.tsx" >nul
  echo [OK] Applied CrowdMonitoringPage refactoring
)

if exist "components\SurgeAlertBanner.refactored.tsx" (
  move /y "components\SurgeAlertBanner.refactored.tsx" "components\SurgeAlertBanner.tsx" >nul
  echo [OK] Applied SurgeAlertBanner refactoring
)

if exist "components\ZoneDrawerModal.refactored.tsx" (
  move /y "components\ZoneDrawerModal.refactored.tsx" "components\ZoneDrawerModal.tsx" >nul
  echo [OK] Applied ZoneDrawerModal refactoring
)

echo.
echo ========================================
echo Refactoring complete!
echo ========================================
echo.
echo What changed:
echo   [+] Removed all inline styles -^> CSS modules
echo   [+] Removed emojis -^> Professional icon components
echo   [+] Extracted magic numbers -^> Named constants
echo   [+] Added loading and error states
echo   [+] Created reusable components
echo.
echo Backups saved to: %BACKUP_DIR%
echo.
echo Next steps:
echo   1. Run: npm run dev
echo   2. Test all functionality
echo   3. Check responsive design
echo   4. Review browser console for errors
echo.
echo To rollback (if needed):
echo   copy %BACKUP_DIR%\*.tsx pages\
echo   copy %BACKUP_DIR%\*.tsx components\
echo.
echo ==========================================

pause

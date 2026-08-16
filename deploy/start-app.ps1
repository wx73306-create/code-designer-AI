# ============================================================================
# Code Designer AI - App Restart Script (Windows Server 2022)
# Usage: .\start-app.ps1
# ============================================================================

$AppDir = "C:\deploy\app"

Write-Host ""
Write-Host "Code Designer AI - Restart App" -ForegroundColor Cyan
Write-Host ""

Set-Location $AppDir

pm2 restart code-designer

Start-Sleep -Seconds 3

pm2 status

Write-Host ""
Write-Host "Last 20 log lines:" -ForegroundColor Yellow
pm2 logs code-designer --lines 20 --nostream

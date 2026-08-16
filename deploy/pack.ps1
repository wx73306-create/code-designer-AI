# ============================================================================
# Code Designer AI - Local Pack Script (Windows PowerShell)
# Build production version + package as deploy.zip
# Usage: Run from project root: .\deploy\pack.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Code Designer AI - Production Pack" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build
Write-Host "[1/4] Building production version..." -ForegroundColor Yellow
Set-Location $ProjectRoot
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Check errors above." -ForegroundColor Red
    exit 1
}
Write-Host "Build complete!" -ForegroundColor Green

# Step 2: Prepare pack directory
Write-Host "[2/4] Preparing deployment package..." -ForegroundColor Yellow
$PackDir = Join-Path $ProjectRoot "deploy\dist"
if (Test-Path $PackDir) { Remove-Item $PackDir -Recurse -Force }
New-Item -ItemType Directory -Path $PackDir -Force | Out-Null

# Step 3: Copy standalone + static + public
Write-Host "[3/4] Copying files..." -ForegroundColor Yellow

# standalone (server + minimal deps)
$StandaloneSrc = Join-Path $ProjectRoot ".next\standalone"
$StandaloneDst = Join-Path $PackDir "app"
Copy-Item $StandaloneSrc $StandaloneDst -Recurse

# static (CSS/JS chunks) -> app/.next/static
$StaticSrc = Join-Path $ProjectRoot ".next\static"
$StaticDst = Join-Path $PackDir "app\.next\static"
Copy-Item $StaticSrc $StaticDst -Recurse

# public (static assets) -> app/public
$PublicSrc = Join-Path $ProjectRoot "public"
$PublicDst = Join-Path $PackDir "app\public"
Copy-Item $PublicSrc $PublicDst -Recurse

# prisma schema (needed for db push)
$PrismaSrc = Join-Path $ProjectRoot "prisma"
$PrismaDst = Join-Path $PackDir "prisma"
Copy-Item $PrismaSrc $PrismaDst -Recurse

# .env.production -> app/.env
# 注意：standalone 的 server.js 从应用目录（app/）读取 .env，必须放到 app/ 下，
# 放在包根（dist/.env）会导致读不到数据库/API Key，应用启动失败。
Copy-Item (Join-Path $ProjectRoot ".env.production") (Join-Path $PackDir "app\.env")

# Server scripts
Copy-Item (Join-Path $PSScriptRoot "setup-server.ps1") (Join-Path $PackDir "setup-server.ps1")
Copy-Item (Join-Path $PSScriptRoot "start-app.ps1") (Join-Path $PackDir "start-app.ps1")

# Step 4: Create ZIP
Write-Host "[4/4] Compressing..." -ForegroundColor Yellow
$ZipPath = Join-Path $ProjectRoot "deploy\deploy.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path "$PackDir\*" -DestinationPath $ZipPath -CompressionLevel Optimal

# Clean up temp directory
Remove-Item $PackDir -Recurse -Force

# Output result
$ZipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Pack Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host ("File: deploy\deploy.zip ({0} MB)" -f $ZipSize) -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env.production with real secrets" -ForegroundColor White
Write-Host "  2. Re-run this script" -ForegroundColor White
Write-Host "  3. Upload deploy.zip to server C:\deploy\" -ForegroundColor White
Write-Host "  4. Run setup-server.ps1 on the server" -ForegroundColor White
Write-Host ""

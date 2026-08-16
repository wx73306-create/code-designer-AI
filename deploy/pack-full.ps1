# ============================================================================
# Code Designer AI - Full-source Pack (MANUAL deploy fallback)
# Use this instead of pack.ps1 when the standalone auto-deploy (setup-server.ps1)
# has trouble on your specific server (e.g. Prisma engine download blocked).
# This zips the ENTIRE project source (minus node_modules/.next/.git) so the
# server can run the classic flow the old tutorial uses:
#   npm install --legacy-peer-deps
#   npx prisma generate
#   npx prisma db push
#   npm run build
#   pm2 start npm --name "code-designer" -- start
# Usage: Run from project root: .\deploy\pack-full.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Code Designer AI - Full Pack" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$PackDir = Join-Path $ProjectRoot "deploy\full"
if (Test-Path $PackDir) { Remove-Item $PackDir -Recurse -Force }
New-Item -ItemType Directory -Path $PackDir -Force | Out-Null

# Copy whole project, excluding heavy / generated dirs
Write-Host "Copying project source (excluding node_modules/.next/.git)..." -ForegroundColor Yellow
robocopy $ProjectRoot $PackDir /E /XD node_modules .next .git deploy /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null

# Make sure production env goes in as .env at the project root (server reads it there)
Copy-Item (Join-Path $ProjectRoot ".env.production") (Join-Path $PackDir ".env") -Force

# Zip
$ZipPath = Join-Path $ProjectRoot "deploy\deploy-full.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path "$PackDir\*" -DestinationPath $ZipPath -CompressionLevel Optimal
Remove-Item $PackDir -Recurse -Force

$ZipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Full Pack Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host ("File: deploy\deploy-full.zip ({0} MB)" -f $ZipSize) -ForegroundColor White
Write-Host ""
Write-Host "Manual deploy on server (after extracting to C:\code-designer-ai):" -ForegroundColor Cyan
Write-Host "  cd C:\code-designer-ai" -ForegroundColor White
Write-Host "  npm install --legacy-peer-deps" -ForegroundColor White
Write-Host "  npx prisma generate" -ForegroundColor White
Write-Host "  npx prisma db push" -ForegroundColor White
Write-Host "  npm run build" -ForegroundColor White
Write-Host "  npm install -g pm2" -ForegroundColor White
Write-Host "  pm2 start npm --name `"code-designer`" -- start" -ForegroundColor White
Write-Host "  pm2 save" -ForegroundColor White
Write-Host ""

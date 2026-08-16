# ============================================================================
# Code Designer AI - Server Setup Script (Windows Server)
# Install Node.js + PM2 + Redis, extract app, push DB, start service
# Usage: Run as Administrator: .\setup-server.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$DeployDir = "C:\deploy"
$AppDir = "$DeployDir\app"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Code Designer AI - Server Setup" -ForegroundColor Cyan
Write-Host "  Windows Server (Tencent Cloud)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- Step 1: Install Node.js ----------
Write-Host "[1/8] Checking Node.js..." -ForegroundColor Yellow
$NodeExists = Get-Command node -ErrorAction SilentlyContinue
if ($NodeExists) {
    $NodeVer = node --version
    Write-Host "Node.js installed: $NodeVer" -ForegroundColor Green
} else {
    Write-Host "Downloading Node.js 22 LTS..." -ForegroundColor Yellow
    $NodeUrl = "https://nodejs.org/dist/v22.17.0/node-v22.17.0-x64.msi"
    $NodeInstaller = "$env:TEMP\node-install.msi"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeInstaller -UseBasicParsing
    Write-Host "Installing Node.js (silent)..." -ForegroundColor Yellow
    Start-Process msiexec.exe -ArgumentList "/i `"$NodeInstaller`" /qn /norestart" -Wait -NoNewWindow
    Remove-Item $NodeInstaller -Force -ErrorAction SilentlyContinue
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $NewVer = node --version
    Write-Host "Node.js installed: $NewVer" -ForegroundColor Green
}

# ---------- Step 2: Install PM2 ----------
Write-Host "[2/8] Checking PM2..." -ForegroundColor Yellow
$PM2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if ($PM2Exists) {
    Write-Host "PM2 installed: $(pm2 --version)" -ForegroundColor Green
} else {
    Write-Host "Installing PM2..." -ForegroundColor Yellow
    npm install -g pm2
    Write-Host "PM2 installed" -ForegroundColor Green
}

# ---------- Step 3: Redis ----------
# 应用依赖 Redis（BullMQ 队列 / 限流缓存）。
# 若 .env 中 REDIS_URL 指向外部实例（腾讯云 Redis 托管等），则跳过本地安装；
# 否则在本机安装 Redis for Windows 并注册为服务。
Write-Host "[3/8] Checking Redis..." -ForegroundColor Yellow
$EnvFile = "$AppDir\.env"
$RedisUrl = $null
if (Test-Path $EnvFile) {
    $RedisUrl = (Get-Content $EnvFile | Where-Object { $_ -match '^REDIS_URL=' } | Select-Object -First 1) -replace '^REDIS_URL=' , '' -replace '"', ''
}
$LocalRedis = $true
if ($RedisUrl -and $RedisUrl -notmatch 'localhost|127\.0\.0\.1') { $LocalRedis = $false }

if ($LocalRedis) {
    $RedisCli = Get-Command redis-cli -ErrorAction SilentlyContinue
    if (-not $RedisCli) {
        try {
            Write-Host "Installing Redis for Windows (tporadowski)..." -ForegroundColor Yellow
            $RedisMsi = "$env:TEMP\redis.msi"
            Invoke-WebRequest -Uri "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.msi" -OutFile $RedisMsi -UseBasicParsing
            Start-Process msiexec.exe -ArgumentList "/i `"$RedisMsi`" /qn ADD_FIREWALL_RULE=1" -Wait -NoNewWindow
            Remove-Item $RedisMsi -Force -ErrorAction SilentlyContinue
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        } catch {
            Write-Host "Redis 自动安装失败（可能无外网）。请手动安装 Redis 后重试。" -ForegroundColor Red
            Write-Host "下载地址: https://github.com/tporadowski/redis/releases" -ForegroundColor Yellow
        }
    }
    # 确保 Redis 服务已启动
    try {
        $svc = Get-Service Redis -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -ne 'Running') { Start-Service Redis }
        $ping = redis-cli ping 2>$null
        if ($ping -eq 'PONG') {
            Write-Host "Redis ready (local)" -ForegroundColor Green
        } else {
            Write-Host "Redis 已安装但未能连接，应用将以降级模式运行（缓存/队列失效）。" -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "Redis 未运行，应用将以降级模式运行。可稍后手动启动 Redis 服务。" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "Using external Redis: $RedisUrl (skip local install)" -ForegroundColor Green
}

# ---------- Step 4: Browser (Chrome) for screenshots ----------
# screenshot.ts 用 puppeteer-core（不自带浏览器），必须服务器有 Chrome/Edge，
# 否则截图功能抛 "No Chrome or Edge browser found"。全新 Windows Server 默认无浏览器。
Write-Host "[4/8] Checking browser (Chrome/Edge)..." -ForegroundColor Yellow
$ChromeFound = $false
$ChromeCandidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)
foreach ($c in $ChromeCandidates) { if (Test-Path $c) { $ChromeFound = $true; Write-Host "Browser found: $c" -ForegroundColor Green; break } }
if (-not $ChromeFound) {
  try {
    Write-Host "Installing Google Chrome (standalone enterprise)..." -ForegroundColor Yellow
    $ChromeMsi = "$env:TEMP\chrome.msi"
    Invoke-WebRequest -Uri "https://dl.google.com/dl/chrome/install/googlechromestandaloneenterprise64.msi" -OutFile $ChromeMsi -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$ChromeMsi`" /qn /norestart" -Wait -NoNewWindow
    Remove-Item $ChromeMsi -Force -ErrorAction SilentlyContinue
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe') {
      Write-Host "Chrome installed" -ForegroundColor Green
    } else {
      Write-Host "Chrome 可能未安装成功；截图功能在装好浏览器前会报错。" -ForegroundColor DarkYellow
    }
  } catch {
    Write-Host "Chrome 自动安装失败（可能无外网）。截图需要浏览器，请手动安装 Chrome/Edge 并在 .env 设 CHROME_PATH。" -ForegroundColor Red
  }
}

# ---------- Step 5: Extract app ----------
Write-Host "[5/8] Extracting deployment package..." -ForegroundColor Yellow
$ZipPath = "$DeployDir\deploy.zip"
if (-not (Test-Path $ZipPath)) {
    Write-Host "ERROR: $ZipPath not found" -ForegroundColor Red
    Write-Host "Please upload deploy.zip to C:\deploy\ first" -ForegroundColor Yellow
    exit 1
}

# Backup old version
if (Test-Path $AppDir) {
    $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $BackupDir = "$DeployDir\backup_$Timestamp"
    Write-Host "Backing up old version to $BackupDir ..." -ForegroundColor Yellow
    Move-Item $AppDir $BackupDir
}

# Extract
Expand-Archive -Path $ZipPath -DestinationPath $DeployDir -Force
Write-Host "Extraction complete" -ForegroundColor Green

# ---------- Step 5: Prisma (generate client + sync DB) ----------
# 重要：next.config 把 @prisma/client/prisma 标为 serverExternalPackages（external），
# standalone 包里不包含「已生成的 Prisma Client」和「查询引擎二进制」。
# 必须在服务器上重新安装并 prisma generate，否则 server.js 运行时 require('@prisma/client') 会失败。
Write-Host "[6/8] Setting up Prisma (generate client + sync DB)..." -ForegroundColor Yellow
Set-Location $AppDir
if (Test-Path "$DeployDir\prisma\schema.prisma") {
    Write-Host "Installing prisma deps into app..." -ForegroundColor Yellow
    npm install @prisma/client prisma --legacy-peer-deps --no-audit --no-fund 2>$null
    Write-Host "Generating Prisma Client (downloads query engine)..." -ForegroundColor Yellow
    npx prisma generate --schema "$DeployDir\prisma\schema.prisma"
    Write-Host "Pushing schema to database..." -ForegroundColor Yellow
    npx prisma db push --schema "$DeployDir\prisma\schema.prisma" --accept-data-loss
    Write-Host "Database synced" -ForegroundColor Green
} else {
    Write-Host "No prisma schema found, skipping DB init" -ForegroundColor DarkYellow
}

# ---------- Step 6: Firewall ----------
Write-Host "[7/8] Configuring firewall..." -ForegroundColor Yellow
function Ensure-FirewallRule($RuleName, $Port) {
    $Existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    if ($Existing) {
        Write-Host "Firewall rule already exists: $RuleName" -ForegroundColor Green
    } else {
        New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Port $Port -Protocol TCP -Action Allow | Out-Null
        Write-Host "Port $Port opened" -ForegroundColor Green
    }
}
Ensure-FirewallRule -RuleName "CodeDesignerAI-Port3000" -Port 3000
Ensure-FirewallRule -RuleName "CodeDesignerAI-Port80"   -Port 80
Ensure-FirewallRule -RuleName "CodeDesignerAI-Port443"  -Port 443

# ---------- Step 7: Start app ----------
Write-Host "[8/8] Starting application..." -ForegroundColor Yellow
Set-Location $AppDir

# Stop old process
pm2 delete code-designer 2>$null

# Start with 1GB memory limit
pm2 start server.js --name "code-designer" --max-memory-restart 1G

# Auto-start on boot
pm2 save
pm2 startup 2>$null

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "URL: http://150.158.27.120:3000" -ForegroundColor White
Write-Host ""
Write-Host "Commands:" -ForegroundColor Cyan
Write-Host "  pm2 status          Check status" -ForegroundColor White
Write-Host "  pm2 logs            View logs" -ForegroundColor White
Write-Host "  pm2 restart all     Restart app" -ForegroundColor White
Write-Host "  pm2 stop all        Stop app" -ForegroundColor White
Write-Host ""
Write-Host "Reminders:" -ForegroundColor Yellow
Write-Host "  1. 在腾讯云控制台安全组放行 3000 / 80 / 443 入站" -ForegroundColor White
Write-Host "  2. 确认 C:\deploy\app\.env 中的密钥正确（数据库/API Key/管理员密码）" -ForegroundColor White
Write-Host "  3. 若绑定域名并启用 HTTPS，请把 nginx.conf 放入 Nginx 并配置 SSL 证书" -ForegroundColor White
Write-Host ""

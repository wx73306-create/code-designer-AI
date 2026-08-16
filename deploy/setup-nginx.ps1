# ============================================================================
# Code Designer AI - Nginx + HTTPS Setup (Windows Server 2022)
# Run AFTER ICP filing is approved and domain DNS is pointing to server
# Usage: Run as Administrator: .\setup-nginx.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$Domain = "codedesignerai.cn"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Nginx + HTTPS Setup" -ForegroundColor Cyan
Write-Host "  $Domain" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- Step 1: Install Nginx ----------
Write-Host "[1/5] Checking Nginx..." -ForegroundColor Yellow
$NginxDir = "C:\deploy\nginx"
$NginxExe = "$NginxDir\nginx.exe"

if (Test-Path $NginxExe) {
    Write-Host "Nginx already installed" -ForegroundColor Green
} else {
    Write-Host "Downloading Nginx for Windows..." -ForegroundColor Yellow
    $NginxUrl = "https://nginx.org/download/nginx-1.26.3.zip"
    $ZipFile = "$env:TEMP\nginx.zip"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $NginxUrl -OutFile $ZipFile -UseBasicParsing
    Expand-Archive -Path $ZipFile -DestinationPath "C:\deploy" -Force
    Rename-Item "C:\deploy\nginx-1.26.3" "C:\deploy\nginx"
    Remove-Item $ZipFile -Force -ErrorAction SilentlyContinue
    Write-Host "Nginx installed to C:\deploy\nginx" -ForegroundColor Green
}

# ---------- Step 2: Apply config ----------
Write-Host "[2/5] Applying Nginx config..." -ForegroundColor Yellow
$DeployDir = "C:\deploy"
$NginxConf = "$DeployDir\nginx.conf"

if (Test-Path $NginxConf) {
    Copy-Item $NginxConf "$NginxDir\conf\nginx.conf" -Force
    Write-Host "Config applied" -ForegroundColor Green
} else {
    Write-Host "ERROR: $NginxConf not found" -ForegroundColor Red
    exit 1
}

# ---------- Step 3: Install Certbot for SSL ----------
Write-Host "[3/5] Setting up SSL certificate..." -ForegroundColor Yellow
$CertbotExists = Get-Command certbot -ErrorAction SilentlyContinue

if ($CertbotExists) {
    Write-Host "Certbot already installed" -ForegroundColor Green
} else {
    Write-Host "Downloading Certbot..." -ForegroundColor Yellow
    $CertbotUrl = "https://dl.eff.org/certbot-beta-installer-win_amd64_signed.exe"
    $CertbotInstaller = "$env:TEMP\certbot-installer.exe"
    Invoke-WebRequest -Uri $CertbotUrl -OutFile $CertbotInstaller -UseBasicParsing
    Start-Process $CertbotInstaller -ArgumentList "/S" -Wait -NoNewWindow
    Remove-Item $CertbotInstaller -Force -ErrorAction SilentlyContinue
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "Certbot installed" -ForegroundColor Green
}

# ---------- Step 4: Get SSL certificate ----------
Write-Host "[4/5] Requesting SSL certificate..." -ForegroundColor Yellow
$SSLCertDir = "C:\deploy\ssl"
if (-not (Test-Path $SSLCertDir)) { New-Item -ItemType Directory -Path $SSLCertDir -Force | Out-Null }

# Stop Nginx temporarily for standalone cert
Set-Location $NginxDir
.\nginx.exe -s stop 2>$null
Start-Sleep -Seconds 2

# Request certificate
certbot certonly --standalone -d $Domain -d "www.$Domain" --non-interactive --agree-tos --email "admin@$Domain"

# Copy certs to our ssl directory
$CertPath = "C:\Certbot\live\$Domain"
if (Test-Path $CertPath) {
    Copy-Item "$CertPath\fullchain.pem" "$SSLCertDir\fullchain.pem" -Force
    Copy-Item "$CertPath\privkey.pem" "$SSLCertDir\privkey.pem" -Force
    Write-Host "SSL certificate installed" -ForegroundColor Green
} else {
    Write-Host "WARNING: Certificate files not found at $CertPath" -ForegroundColor Yellow
    Write-Host "You may need to run certbot manually" -ForegroundColor Yellow
}

# ---------- Step 5: Start Nginx ----------
Write-Host "[5/5] Starting Nginx..." -ForegroundColor Yellow
Set-Location $NginxDir
.\nginx.exe

# Firewall rules for HTTP and HTTPS
$HttpRule = "CodeDesignerAI-Port80"
$HttpsRule = "CodeDesignerAI-Port443"

if (-not (Get-NetFirewallRule -DisplayName $HttpRule -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $HttpRule -Direction Inbound -Port 80 -Protocol TCP -Action Allow | Out-Null
}
if (-not (Get-NetFirewallRule -DisplayName $HttpsRule -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $HttpsRule -Direction Inbound -Port 443 -Protocol TCP -Action Allow | Out-Null
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Nginx + HTTPS Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "https://$Domain is now live!" -ForegroundColor White
Write-Host ""
Write-Host "Reminders:" -ForegroundColor Yellow
Write-Host "  1. DNS: $Domain -> 121.43.102.93 (A record)" -ForegroundColor White
Write-Host "  2. Alibaba Cloud security group: open ports 80 + 443" -ForegroundColor White
Write-Host "  3. Rebuild app with new AUTH_URL and redeploy" -ForegroundColor White
Write-Host "  4. Auto-renew SSL: certbot renew --dry-run" -ForegroundColor White
Write-Host ""

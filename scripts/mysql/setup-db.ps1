$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$MysqlBin = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
$DataDir = Join-Path $ProjectRoot ".mysql-data"
$IniFile = Join-Path $PSScriptRoot "my.ini"
$MysqlExe = Join-Path $MysqlBin "mysql.exe"
$MysqldExe = Join-Path $MysqlBin "mysqld.exe"
$RootPassword = "password"
$DbName = "railsafety_db"

if (-not (Test-Path $MysqldExe)) {
  throw "MySQL not found at $MysqldExe. Run: winget install -e --id Oracle.MySQL"
}

if (-not (Test-Path $DataDir)) {
  New-Item -ItemType Directory -Path $DataDir | Out-Null
  & $MysqldExe --defaults-file=$IniFile --initialize-insecure
  if ($LASTEXITCODE -ne 0) { throw "mysqld --initialize-insecure failed" }
  # MySQL 8.4 on Windows: undo files from init block first start; recreate on boot.
  Remove-Item (Join-Path $DataDir "undo_*") -Force -ErrorAction SilentlyContinue
}

function Test-Port3306 {
  return (Test-NetConnection -ComputerName 127.0.0.1 -Port 3306 -WarningAction SilentlyContinue).TcpTestSucceeded
}

if (-not (Test-Port3306)) {
  # MySQL 8.4 on Windows: stale undo files from a prior init block startup.
  Remove-Item (Join-Path $DataDir "undo_*") -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $MysqldExe -ArgumentList "`"--defaults-file=$IniFile`"" -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port3306) { break }
    Start-Sleep -Seconds 1
  }
  if (-not (Test-Port3306)) { throw "MySQL did not start on port 3306" }
}

$sql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$RootPassword';
CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
FLUSH PRIVILEGES;
"@

& $MysqlExe --defaults-file=$IniFile -u root --connect-expired-password -e $sql 2>$null
if ($LASTEXITCODE -ne 0) {
  & $MysqlExe --defaults-file=$IniFile -u root -e $sql
  if ($LASTEXITCODE -ne 0) { throw "Failed to configure root user and database" }
}

Set-Location $ProjectRoot
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed" }

npm run prisma:seed
if ($LASTEXITCODE -ne 0) { throw "prisma seed failed" }

Write-Host "MySQL ready: $DbName on localhost:3306 (root / $RootPassword)"

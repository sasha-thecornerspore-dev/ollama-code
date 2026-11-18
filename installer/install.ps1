<#
.SYNOPSIS
  Installs Ollama Code on Windows: checks the system, installs anything missing
  (Node.js, Ollama, a coding model), and creates shortcuts.

.DESCRIPTION
  One-line install (PowerShell):
    irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1 | iex

  With options:
    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1))) -Yes -Model qwen2.5-coder:7b

  No administrator rights are needed. Everything installs for the current user.

.PARAMETER InstallDir   Where to install. Default: %LOCALAPPDATA%\Programs\OllamaCode
.PARAMETER Model        Model to download instead of the recommended one.
.PARAMETER SkipModel    Don't download a model.
.PARAMETER SkipOllama   Don't install Ollama (for example if it runs on another machine).
.PARAMETER Source       Install the app from this local folder instead of downloading it.
.PARAMETER Version      Release tag to install (default: latest release).
.PARAMETER Yes          Answer yes to every question (unattended install).
.PARAMETER NoShortcuts  Don't create Desktop / Start Menu shortcuts.
.PARAMETER NoLaunch     Don't start the app when finished.
.PARAMETER Managed      Used by the .exe setup: app files are already in place.
.PARAMETER CheckOnly    Only report what is installed and what is missing; change nothing.
#>
[CmdletBinding()]
param(
  [string]$InstallDir = $(if ($env:OC_INSTALL_DIR) { $env:OC_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\OllamaCode' }),
  [string]$Model = $env:OC_MODEL,
  [switch]$SkipModel,
  [switch]$SkipOllama,
  [string]$Source,
  [string]$Version = $(if ($env:OC_VERSION) { $env:OC_VERSION } else { 'latest' }),
  [switch]$Yes,
  [switch]$NoShortcuts,
  [switch]$NoLaunch,
  [switch]$Managed,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Repo = if ($env:OC_REPO) { $env:OC_REPO } else { 'sasha-thecornerspore-dev/ollama-code' }
$MinNode = 20
if ($env:OC_YES -eq '1') { $Yes = $true }
if ($env:OC_SKIP_MODEL -eq '1') { $SkipModel = $true }

$LogFile = Join-Path $env:TEMP 'ollama-code-install.log'
try { Start-Transcript -Path $LogFile -Force | Out-Null } catch {}

# ---------- output helpers ----------
function Step($msg) { Write-Host ''; Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  [ok]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [warn] $msg" -ForegroundColor Yellow }
function Bad($msg) { Write-Host "  [miss] $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "         $msg" -ForegroundColor Gray }
function Die($msg) {
  Write-Host ''
  Write-Host "Installation failed: $msg" -ForegroundColor Red
  Write-Host "Log file: $LogFile" -ForegroundColor Gray
  Write-Host "Help: https://github.com/$Repo/blob/main/docs/TROUBLESHOOTING.md" -ForegroundColor Gray
  try { Stop-Transcript | Out-Null } catch {}
  throw $msg
}
function Ask($question, [bool]$default = $true) {
  if ($Yes) { return $true }
  $hint = if ($default) { '[Y/n]' } else { '[y/N]' }
  try { $a = Read-Host "  $question $hint" } catch { return $default }
  if ([string]::IsNullOrWhiteSpace($a)) { return $default }
  return $a -match '^(y|yes)$'
}
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Download($url, $dest) {
  Info "Downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

Write-Host ''
Write-Host '  Ollama Code installer' -ForegroundColor White
Write-Host '  A local coding agent powered by Ollama models' -ForegroundColor Gray

# ---------- 1. system check ----------
Step 'Checking this computer'
$os = Get-CimInstance Win32_OperatingSystem
$build = [int]$os.BuildNumber
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
if ($build -lt 17763) { Die "Windows 10 version 1809 (build 17763) or newer is required. This is build $build." }
Ok "$($os.Caption) (build $build, $arch)"

$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGB -ge 16) { Ok "$ramGB GB RAM" } elseif ($ramGB -ge 8) { Warn "$ramGB GB RAM (small models only)" } else { Warn "$ramGB GB RAM: below the recommended 8 GB" }

$gpuText = $null
try {
  $nv = & nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null
  if ($LASTEXITCODE -eq 0 -and $nv) { $gpuText = ($nv | ForEach-Object { $p = $_.Split(','); "$($p[0].Trim()) ($([math]::Round([double]$p[1] / 1024, 1)) GB)" }) -join ', ' }
} catch {}
if ($gpuText) { Ok "GPU: $gpuText" }
else {
  $vc = (Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Basic Display|Remote|Virtual' } | Select-Object -ExpandProperty Name) -join ', '
  if ($vc) { Warn "GPU: $vc (no NVIDIA driver found; models may run on the CPU, which is slower)" } else { Warn 'No GPU detected: models will run on the CPU (slower)' }
}

$drive = (Split-Path -Qualifier $InstallDir)
$freeGB = [math]::Round((Get-PSDrive ($drive.TrimEnd(':'))).Free / 1GB, 1)
if ($freeGB -ge 15) { Ok "$freeGB GB free on $drive" } else { Warn "Only $freeGB GB free on $drive (models need 2-20 GB)" }

# Node.js
function Get-NodeExe {
  $portable = Join-Path $InstallDir 'runtime\node\node.exe'
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) {
    try {
      $v = & $cmd.Source --version
      if ([int]($v.TrimStart('v').Split('.')[0]) -ge $MinNode) { return @{ Path = $cmd.Source; Version = $v; Kind = 'system' } }
    } catch {}
  }
  if (Test-Path $portable) { return @{ Path = $portable; Version = (& $portable --version); Kind = 'portable' } }
  return $null
}
$node = Get-NodeExe
if ($node) { Ok "Node.js $($node.Version) ($($node.Kind))" } else { Bad "Node.js $MinNode+ not found (will install a private copy for Ollama Code)" }

# Ollama
function Get-OllamaExe {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @((Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'), 'C:\Program Files\Ollama\ollama.exe')) { if (Test-Path $p) { return $p } }
  return $null
}
function Test-OllamaUp {
  try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}
$ollama = Get-OllamaExe
if ($ollama) { Ok "Ollama: $ollama" } elseif ($SkipOllama) { Warn 'Ollama not found (skipped by request)' } else { Bad 'Ollama not found (will install)' }

$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) { Ok "Git: $((& git --version) -replace 'git version ', '')" } else { Warn 'Git not found (optional; get it from https://git-scm.com)' }

if (Test-Path (Join-Path $InstallDir 'app\server.js')) { Info "An existing install was found in $InstallDir; it will be updated. Your sessions are kept." }

if ($CheckOnly) {
  Write-Host ''
  Write-Host 'Check only: nothing was changed.' -ForegroundColor White
  try { Stop-Transcript | Out-Null } catch {}
  return
}

if (-not $Yes) {
  Write-Host ''
  Write-Host "  Ollama Code will be installed to $InstallDir" -ForegroundColor White
  if (-not (Ask 'Continue?')) { Write-Host 'Cancelled.'; try { Stop-Transcript | Out-Null } catch {}; return }
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# ---------- 2. Node.js ----------
if (-not $node) {
  Step 'Installing Node.js (private copy, no admin needed)'
  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
  $rel = $index | Where-Object { $_.lts -and $_.files -contains "win-$arch-zip" -and [int]($_.version.TrimStart('v').Split('.')[0]) -ge $MinNode } | Select-Object -First 1
  if (-not $rel) { Die 'Could not find a Node.js LTS download for this system.' }
  $name = "node-$($rel.version)-win-$arch"
  $tmp = Join-Path $env:TEMP "$name.zip"
  Download "https://nodejs.org/dist/$($rel.version)/$name.zip" $tmp
  $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$($rel.version)/SHASUMS256.txt" -UseBasicParsing).Content
  $expected = ($sums -split "`n" | Where-Object { $_ -match "  $name\.zip$" }) -replace '\s+.*$', ''
  $actual = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
  if (-not $expected) { Die "Could not find a checksum for $name.zip, so the download can't be verified." }
  if ($expected.Trim() -ne $actual) { Die "Node.js download checksum mismatch ($actual)." }
  Ok 'Checksum verified'
  $runtime = Join-Path $InstallDir 'runtime'
  if (Test-Path (Join-Path $runtime 'node')) { Remove-Item -Recurse -Force (Join-Path $runtime 'node') }
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  Expand-Archive -Path $tmp -DestinationPath $runtime -Force
  Rename-Item -Path (Join-Path $runtime $name) -NewName 'node'
  Remove-Item $tmp -Force
  $node = Get-NodeExe
  if (-not $node) { Die 'Node.js was downloaded but could not be started.' }
  Ok "Node.js $($node.Version) installed"
}

# ---------- 3. Ollama ----------
if (-not $ollama -and -not $SkipOllama) {
  Step 'Installing Ollama'
  $installed = $false
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Info 'Using winget…'
    & winget install --id Ollama.Ollama -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    Refresh-Path
    $ollama = Get-OllamaExe
    $installed = [bool]$ollama
  }
  if (-not $installed) {
    $setup = Join-Path $env:TEMP 'OllamaSetup.exe'
    Download 'https://ollama.com/download/OllamaSetup.exe' $setup
    Info 'Running the Ollama setup (this takes a minute)…'
    Start-Process -FilePath $setup -ArgumentList '/VERYSILENT', '/NORESTART', '/SUPPRESSMSGBOXES' -Wait
    Remove-Item $setup -Force -ErrorAction SilentlyContinue
    Refresh-Path
    $ollama = Get-OllamaExe
  }
  if (-not $ollama) { Die 'Ollama could not be installed automatically. Install it from https://ollama.com/download and run this installer again.' }
  Ok "Ollama installed: $ollama"
}

if ($ollama -and -not (Test-OllamaUp)) {
  Info 'Starting the Ollama server…'
  Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden
  for ($i = 0; $i -lt 30 -and -not (Test-OllamaUp); $i++) { Start-Sleep -Milliseconds 700 }
}
if ($ollama) { if (Test-OllamaUp) { Ok 'Ollama server is running' } else { Warn 'Ollama did not start yet; Ollama Code will retry when it launches.' } }

# ---------- 4. App files ----------
$AppDir = Join-Path $InstallDir 'app'
if (-not $Managed) {
  Step 'Installing Ollama Code'
  if (-not $Source -and $PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot '..\server.js'))) { $Source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
  $tmpDir = $null
  if (-not $Source) {
    $tmpDir = Join-Path $env:TEMP ('ollama-code-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    $zip = Join-Path $tmpDir 'app.zip'
    $url = if ($Version -eq 'latest') { "https://github.com/$Repo/releases/latest/download/ollama-code.zip" } else { "https://github.com/$Repo/releases/download/$Version/ollama-code.zip" }
    try { Download $url $zip }
    catch {
      Warn 'No release package found; using the latest source from the main branch.'
      Download "https://github.com/$Repo/archive/refs/heads/main.zip" $zip
    }
    Expand-Archive -Path $zip -DestinationPath $tmpDir -Force
    $found = Get-ChildItem -Path $tmpDir -Recurse -Filter 'server.js' -Depth 2 | Select-Object -First 1
    if (-not $found) { Die 'The downloaded package does not contain Ollama Code.' }
    $Source = $found.DirectoryName
  }
  if ((Resolve-Path $Source).Path -ne $AppDir) {
    if (Test-Path $AppDir) { Remove-Item -Recurse -Force $AppDir }
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Get-ChildItem -Path $Source -Force | Where-Object { $_.Name -notin @('.git', 'node_modules', 'dist', '.github') } |
      ForEach-Object { Copy-Item -Path $_.FullName -Destination $AppDir -Recurse -Force }
  }
  if ($tmpDir) { Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue }
  Ok "App files in $AppDir"
}
if (-not (Test-Path (Join-Path $AppDir 'bin\ollama-code.js'))) { Die "App files are missing from $AppDir." }
$AppVersion = (Get-Content (Join-Path $AppDir 'package.json') -Raw | ConvertFrom-Json).version

# Launcher used by shortcuts and the command line.
$launcher = Join-Path $InstallDir 'ollama-code.cmd'
@'
@echo off
setlocal
set "OC_DIR=%~dp0"
set "OC_NODE=node"
if exist "%OC_DIR%runtime\node\node.exe" set "OC_NODE=%OC_DIR%runtime\node\node.exe"
if /I "%~1"=="start" title Ollama Code - close this window to stop
"%OC_NODE%" "%OC_DIR%app\bin\ollama-code.js" %*
'@ | Set-Content -Path $launcher -Encoding ASCII
Copy-Item -Path (Join-Path $AppDir 'installer\uninstall.ps1') -Destination (Join-Path $InstallDir 'uninstall.ps1') -Force

# Add the install folder to the user PATH so "ollama-code" works in any terminal.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
if (($userPath.Split(';') | ForEach-Object { $_.TrimEnd('\') }) -notcontains $InstallDir.TrimEnd('\')) {
  [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $InstallDir).TrimStart(';'), 'User')
  Refresh-Path
  Ok 'Added "ollama-code" to your PATH (open a new terminal to use it)'
}

if (-not $Managed) {
  $icon = Join-Path $AppDir 'public\icon.ico'
  if (-not $NoShortcuts) {
    $shell = New-Object -ComObject WScript.Shell
    $targets = @(
      (Join-Path ([Environment]::GetFolderPath('Programs')) 'Ollama Code.lnk'),
      (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ollama Code.lnk')
    )
    foreach ($t in $targets) {
      $s = $shell.CreateShortcut($t)
      $s.TargetPath = $launcher
      $s.Arguments = 'start'
      $s.WorkingDirectory = $InstallDir
      $s.IconLocation = "$icon,0"
      $s.WindowStyle = 7
      $s.Description = 'Ollama Code: local coding agent'
      $s.Save()
    }
    Ok 'Created Start Menu and Desktop shortcuts'
  }

  # Register in Settings > Apps so it can be uninstalled normally.
  $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\OllamaCode'
  New-Item -Path $key -Force | Out-Null
  $sizeKB = [int]((Get-ChildItem -Path $InstallDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1KB)
  $props = @{
    DisplayName = 'Ollama Code'; DisplayVersion = $AppVersion; Publisher = 'Ollama Code contributors'
    DisplayIcon = $icon; InstallLocation = $InstallDir; URLInfoAbout = "https://github.com/$Repo"
    UninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\uninstall.ps1`""
    QuietUninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\uninstall.ps1`" -Quiet"
  }
  foreach ($k in $props.Keys) { Set-ItemProperty -Path $key -Name $k -Value $props[$k] }
  Set-ItemProperty -Path $key -Name NoModify -Value 1 -Type DWord
  Set-ItemProperty -Path $key -Name NoRepair -Value 1 -Type DWord
  Set-ItemProperty -Path $key -Name EstimatedSize -Value $sizeKB -Type DWord
  Ok 'Registered in Settings > Apps'
}

# ---------- 5. Model ----------
$cli = Join-Path $AppDir 'bin\ollama-code.js'
$report = $null
try { $report = (& $node.Path $cli doctor --json 2>$null | Out-String) | ConvertFrom-Json } catch {}
if ($ollama -and -not $SkipModel -and $report -and $report.ollama.reachable) {
  Step 'Choosing a model'
  $rec = $report.recommendation
  $modelsCheck = $report.checks | Where-Object { $_.id -eq 'models' }
  $target = if ($Model) { $Model } else { $rec.model }
  Info "Recommended for this computer: $($rec.model) (~$($rec.downloadGB) GB), based on $($rec.basis)."
  $have = @($report.ollama.models)
  if ($have -contains $target) { Ok "$target is already installed" }
  elseif ($Model -or $modelsCheck.status -ne 'ok') {
    if (Ask "Download $target now?") {
      & $ollama pull $target
      if ($LASTEXITCODE -eq 0) { Ok "$target is ready" } else { Warn "Download failed. Try later with: ollama pull $target" }
    }
  } else {
    Ok "You already have a coding model ($($have -join ', '))"
    Info "For better results on this computer you can also run: ollama pull $($rec.model)"
  }
}

# ---------- 6. Final check ----------
Step 'Final check'
& $node.Path $cli doctor
Write-Host ''
Write-Host "  Ollama Code $AppVersion is installed." -ForegroundColor Green
Write-Host '  Start it from the Start Menu or Desktop shortcut, or run "ollama-code" in a new terminal.' -ForegroundColor White
Write-Host "  Manual: https://github.com/$Repo/blob/main/docs/MANUAL.md" -ForegroundColor Gray
Write-Host "  Install log: $LogFile" -ForegroundColor Gray
try { Stop-Transcript | Out-Null } catch {}

if (-not $NoLaunch -and -not $Managed) {
  Start-Process -FilePath $launcher -ArgumentList 'start' -WorkingDirectory $InstallDir -WindowStyle Minimized
}

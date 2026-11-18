<#
.SYNOPSIS
  Removes Ollama Code. Ollama itself and your downloaded models are left alone.

.PARAMETER RemoveData  Also delete sessions and settings in %USERPROFILE%\.ollama-code
.PARAMETER Quiet       Don't ask questions.
.PARAMETER Managed     Called by the .exe uninstaller (it removes the files itself).
#>
param([switch]$RemoveData, [switch]$Quiet, [switch]$Managed, [string]$InstallDir)

$ErrorActionPreference = 'Continue'
if (-not $InstallDir) {
  foreach ($c in @($PSScriptRoot, (Join-Path $PSScriptRoot '..\..'), (Join-Path $env:LOCALAPPDATA 'Programs\OllamaCode'))) {
    if ($c -and (Test-Path (Join-Path $c 'ollama-code.cmd'))) { $InstallDir = (Resolve-Path $c).Path; break }
  }
  if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\OllamaCode' }
}
$DataDir = if ($env:OLLAMA_CODE_HOME) { $env:OLLAMA_CODE_HOME } else { Join-Path $env:USERPROFILE '.ollama-code' }

if (-not $Quiet) {
  Write-Host "This removes Ollama Code from $InstallDir."
  Write-Host 'Ollama and your models are not touched.'
  $a = Read-Host 'Continue? [y/N]'
  if ($a -notmatch '^(y|yes)$') { Write-Host 'Cancelled.'; return }
  if (-not $RemoveData) {
    $d = Read-Host "Also delete your sessions and settings in $DataDir? [y/N]"
    $RemoveData = $d -match '^(y|yes)$'
  }
}

# Stop a running instance.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*ollama-code*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# PATH entry
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath) {
  $parts = $userPath.Split(';') | Where-Object { $_ -and ($_.TrimEnd('\') -ne $InstallDir.TrimEnd('\')) }
  [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
}

if (-not $Managed) {
  foreach ($lnk in @(
      (Join-Path ([Environment]::GetFolderPath('Programs')) 'Ollama Code.lnk'),
      (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ollama Code.lnk'))) {
    Remove-Item $lnk -Force -ErrorAction SilentlyContinue
  }
  Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\OllamaCode' -Recurse -Force -ErrorAction SilentlyContinue
  # The script lives inside the folder it deletes, so remove it from a temp copy of cmd.
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "timeout /t 2 /nobreak >nul & rmdir /s /q `"$InstallDir`"" -WindowStyle Hidden
}

if ($RemoveData -and (Test-Path $DataDir)) {
  Remove-Item -Recurse -Force $DataDir
  Write-Host "Deleted $DataDir"
}
Write-Host 'Ollama Code has been uninstalled.'
Write-Host 'To remove Ollama too, uninstall it from Settings > Apps. Models live in %USERPROFILE%\.ollama\models.'

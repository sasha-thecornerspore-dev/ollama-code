; Inno Setup script for OllamaCodeSetup.exe
; Build:  iscc /DAppVersion=1.0.0 installer\windows\OllamaCode.iss
; The setup copies the app, then runs install.ps1 -Managed, which checks the
; system and installs Node.js, Ollama and a model as needed.

#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#define Root "..\.."

[Setup]
AppId={{8F3C2A51-6B1E-4C7D-9A0B-3E5F2D1C4B7A}
AppName=Ollama Code
AppVersion={#AppVersion}
AppVerName=Ollama Code {#AppVersion}
AppPublisher=Ollama Code contributors
AppPublisherURL=https://github.com/sasha-thecornerspore-dev/ollama-code
AppSupportURL=https://github.com/sasha-thecornerspore-dev/ollama-code/issues
AppUpdatesURL=https://github.com/sasha-thecornerspore-dev/ollama-code/releases
DefaultDirName={localappdata}\Programs\OllamaCode
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
OutputDir={#Root}\dist
OutputBaseFilename=OllamaCodeSetup
SetupIconFile={#Root}\public\icon.ico
UninstallDisplayIcon={app}\app\public\icon.ico
UninstallDisplayName=Ollama Code
LicenseFile={#Root}\LICENSE
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible or arm64
ArchitecturesInstallIn64BitMode=x64compatible or arm64
MinVersion=10.0.17763
ChangesEnvironment=yes
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"
Name: "model"; Description: "Download a coding model chosen for this computer's hardware (2-20 GB)"; GroupDescription: "Setup:"

[Files]
Source: "{#Root}\bin\*"; DestDir: "{app}\app\bin"; Flags: ignoreversion recursesubdirs
Source: "{#Root}\src\*"; DestDir: "{app}\app\src"; Flags: ignoreversion recursesubdirs
Source: "{#Root}\public\*"; DestDir: "{app}\app\public"; Flags: ignoreversion recursesubdirs
Source: "{#Root}\installer\*"; DestDir: "{app}\app\installer"; Flags: ignoreversion recursesubdirs
Source: "{#Root}\docs\*"; DestDir: "{app}\app\docs"; Flags: ignoreversion recursesubdirs
Source: "{#Root}\server.js"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "{#Root}\package.json"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "{#Root}\LICENSE"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "{#Root}\README.md"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "{#Root}\CHANGELOG.md"; DestDir: "{app}\app"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Ollama Code"; Filename: "{app}\ollama-code.cmd"; Parameters: "start"; WorkingDir: "{app}"; IconFilename: "{app}\app\public\icon.ico"; Comment: "Local coding agent"; Flags: runminimized
Name: "{autoprograms}\Ollama Code Manual"; Filename: "https://github.com/sasha-thecornerspore-dev/ollama-code/blob/main/docs/MANUAL.md"
Name: "{autodesktop}\Ollama Code"; Filename: "{app}\ollama-code.cmd"; Parameters: "start"; WorkingDir: "{app}"; IconFilename: "{app}\app\public\icon.ico"; Comment: "Local coding agent"; Flags: runminimized; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\app\installer\install.ps1"" -Managed -Yes -NoLaunch -InstallDir ""{app}"" {code:ModelArg}"; StatusMsg: "Checking your system and installing Node.js, Ollama and a model (see the console window)..."; Flags: waituntilterminated
Filename: "{app}\ollama-code.cmd"; Parameters: "start"; WorkingDir: "{app}"; Description: "Launch Ollama Code"; Flags: postinstall nowait skipifsilent runminimized

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\app\installer\uninstall.ps1"" -Managed -Quiet -InstallDir ""{app}"""; Flags: runhidden; RunOnceId: "OllamaCodeCleanup"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\runtime"
Type: files; Name: "{app}\ollama-code.cmd"
Type: files; Name: "{app}\uninstall.ps1"

[Code]
function ModelArg(Param: String): String;
begin
  if WizardIsTaskSelected('model') then
    Result := ''
  else
    Result := '-SkipModel';
end;

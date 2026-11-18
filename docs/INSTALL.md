# Installing Ollama Code

This page explains how to install, update and remove Ollama Code on Windows, macOS and Linux. If something goes wrong, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md). Once it is installed, the [user manual](MANUAL.md) shows how to use it.

- [What you need](#what-you-need)
- [Windows](#windows)
- [macOS and Linux](#macos-and-linux)
- [What the installer does, step by step](#what-the-installer-does-step-by-step)
- [Installer options](#installer-options)
- [Where things are installed](#where-things-are-installed)
- [Install from source (no installer)](#install-from-source-no-installer)
- [Install from a local copy of the code](#install-from-a-local-copy-of-the-code)
- [Updating](#updating)
- [Uninstalling](#uninstalling)
- [Offline or air-gapped computers](#offline-or-air-gapped-computers)
- [Using Ollama on another computer](#using-ollama-on-another-computer)
- [Checking downloads](#checking-downloads)

## What you need

Ollama Code is a small Node.js program with a browser-based window. The heavy lifting is done by [Ollama](https://ollama.com), which runs the language model on your computer. The installer sets up everything that is missing.

### Supported systems

| System | Versions | CPU |
|---|---|---|
| Windows | Windows 10 version 1809 (build 17763) or newer, Windows 11 | x64 or arm64 |
| macOS | macOS 12 Monterey or newer | Intel or Apple Silicon |
| Linux | Any distribution that uses glibc (Ubuntu, Debian, Fedora, Arch, and so on) | x64 or arm64 |

Notes:

- On Windows the installer refuses to run on builds older than 17763.
- On macOS older than 12 the installer only warns, but Ollama itself may not run.
- Alpine Linux and other musl-based systems are not supported by the downloaded Node.js and Ollama binaries. The installer warns if it detects Alpine. You can still try by installing Node.js 20+ with `apk` first.
- A browser is needed for the app window. On Windows, Microsoft Edge (built in) or Google Chrome is used. On macOS and Linux, Google Chrome or Chromium is used if present, otherwise your default browser.

### Memory, GPU and disk

The model is what needs resources. Ollama Code itself needs very little.

| | Minimum | Recommended |
|---|---|---|
| RAM | 8 GB | 16 GB or more |
| GPU | None (runs on the CPU, slower) | NVIDIA with 4 GB+ VRAM, AMD with ROCm on Linux, or any Apple Silicon Mac |
| Free disk | About 3 GB for the smallest model | 15 GB or more (models are 1 to 20 GB each) |

The installer looks at your memory and GPU and recommends a model that fits. See [Choosing a model](MANUAL.md#choosing-a-model) for the full table. Roughly:

- Apple Silicon Mac with 16 GB: `qwen2.5-coder:7b`; with 32 GB: `qwen2.5-coder:14b`; with 36 GB or more: `qwen2.5-coder:32b`.
- NVIDIA GPU with 8 GB VRAM: `qwen2.5-coder:7b`; 12 to 16 GB: `qwen2.5-coder:14b`; 24 GB: `qwen2.5-coder:32b`.
- No GPU: `qwen2.5-coder:7b` at most (it will be noticeably slower).

Other software:

- **Node.js 20 or newer.** If you don't have it, the installer downloads a private copy just for Ollama Code. It does not change your system Node.js.
- **Ollama.** Installed automatically if missing.
- **Git** is optional, but the agent works better in folders that use git.

## Windows

Pick one of the three methods. None of them needs administrator rights; everything is installed for your user account only.

### Option 1: Setup program (easiest)

1. Open the [latest release](https://github.com/sasha-thecornerspore-dev/ollama-code/releases/latest) and download `OllamaCodeSetup.exe`.
2. Run it.
3. **Windows SmartScreen:** the setup program is not code-signed, so Windows may show "Windows protected your PC". Click **More info**, then **Run anyway**. Your browser may also warn that the file is not commonly downloaded; choose **Keep**. If you prefer to check the file first, see [Checking downloads](#checking-downloads).
4. Accept the license and, if asked, choose the install folder.
5. On the "Select Additional Tasks" page you can choose:
   - **Create a desktop shortcut** (on by default)
   - **Download a coding model chosen for this computer's hardware (2-20 GB)** (on by default). Untick this if you want to choose a model yourself later.
6. Click **Install**. A console window opens and shows each step: system check, Node.js, Ollama, and the model download. A large model download can take a while; leave the window open.
7. On the last page, leave **Launch Ollama Code** ticked and click **Finish**.

The setup program adds Start Menu entries for **Ollama Code** and **Ollama Code Manual**.

### Option 2: PowerShell one-liner

Open **PowerShell** (not Command Prompt) and run:

```powershell
irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1 | iex
```

The installer shows what it found, asks "Continue?", and later asks before downloading a model. Press Enter to accept the default (yes).

This method does not need any change to the PowerShell execution policy, because the script runs in memory.

### Option 3: PowerShell with options

To pass options, use this form instead (the options are listed in [Windows installer options](#windows-installer-options-installps1)):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1))) -Yes -Model qwen2.5-coder:7b
```

Some useful combinations:

```powershell
# Fully unattended, recommended model
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1))) -Yes

# Just show what is installed and what is missing; change nothing
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1))) -CheckOnly

# Install a specific release, no model, no shortcuts
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1))) -Version v1.0.0 -SkipModel -NoShortcuts
```

You can also set environment variables before the plain one-liner, for example:

```powershell
$env:OC_YES = '1'; $env:OC_MODEL = 'qwen2.5-coder:14b'
irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1 | iex
```

Each release also includes `install.ps1` as a download. If you save it to a file and run it from there, use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Yes
```

## macOS and Linux

Open a terminal and run:

```bash
curl -fsSL https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.sh | bash
```

To answer yes to every question (unattended install):

```bash
curl -fsSL https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.sh | bash -s -- --yes
```

Anything after `bash -s --` is passed to the installer, for example:

```bash
curl -fsSL https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.sh | bash -s -- --yes --model qwen2.5-coder:14b
curl -fsSL https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.sh | bash -s -- --check
```

Notes:

- The installer needs `curl` (or `wget`) and `tar`. Both are present on macOS and on almost every Linux system.
- **Linux:** if Ollama is not installed yet, the installer runs Ollama's official install script. That script installs Ollama system-wide and sets up a background service, so it **may ask for your password** (`sudo`). See [Linux: password prompt while installing Ollama](TROUBLESHOOTING.md#linux-password-prompt-while-installing-ollama) if you can't or don't want to use `sudo`.
- **macOS:** Ollama is installed as `Ollama.app` in `/Applications` (or `~/Applications` if `/Applications` is not writable).
- Questions are read from your terminal even when the script is piped into `bash`. If there is no terminal at all (for example in a script or CI job), every question is answered with the default, which is yes.

## What the installer does, step by step

The Windows installer (`install.ps1`, also used by `OllamaCodeSetup.exe`) and the macOS/Linux installer (`install.sh`) follow the same steps. Every step prints `[ok]`, `[warn]` or `[miss]` so you can see what happened. Everything is also written to a log file (see [Where things are installed](#where-things-are-installed)).

### 1. System check

The installer looks at:

- **Operating system and CPU type.** Windows builds older than 17763 stop the install. Unsupported operating systems or CPU types on macOS/Linux stop the install.
- **RAM.** 16 GB or more is "ok"; 8 to 16 GB gives a warning ("small models only"); under 8 GB gives a stronger warning. None of these stop the install.
- **GPU.** NVIDIA GPUs are detected with `nvidia-smi`. Apple Silicon is detected on Macs. AMD is detected with `rocm-smi` on Linux. Without a supported GPU you get a warning that models will run on the CPU.
- **Free disk space** on the drive you install to. Under 15 GB gives a warning.
- **Node.js 20+**: first on your PATH, then the private copy from an earlier install.
- **Ollama**: on your PATH and in its usual install locations.
- **Git** (optional).
- **An existing Ollama Code install** in the same folder. If there is one, it will be updated and your sessions are kept.

With `-CheckOnly` (Windows) or `--check` (macOS/Linux), the installer stops here and changes nothing.

Otherwise it shows the install folder and asks "Continue?".

### 2. Node.js (only if missing)

If no Node.js 20+ is found, the installer downloads a private copy from nodejs.org into the install folder (`runtime\node` or `runtime/node`). It does not touch any other Node.js on your computer and does not need admin rights.

- **Windows:** the newest Node.js LTS release that has a zip for your CPU (x64 or arm64).
- **macOS/Linux:** the newest Node.js 24 release, or Node.js 22 if 24 is not available for your system.

The download is checked against the official `SHASUMS256.txt` file published by nodejs.org. If the checksum does not match, the install stops.

### 3. Ollama (only if missing, and not skipped)

- **Windows:** first tries `winget install --id Ollama.Ollama`. If winget is not available or that fails, it downloads `OllamaSetup.exe` from ollama.com and runs it silently.
- **macOS:** downloads `Ollama-darwin.zip` from ollama.com, unpacks it and moves `Ollama.app` to `/Applications` (or `~/Applications`). If the `ollama` command is not on your PATH, it adds a link to it in `~/.local/bin`.
- **Linux:** runs the official script, `curl -fsSL https://ollama.com/install.sh | sh`. This may ask for your password.

After that, if the Ollama server is not running, the installer starts it (on macOS by opening Ollama.app; on Linux through the `ollama` system service if possible, otherwise `ollama serve` in the background) and waits up to about 20 seconds for it to answer. If it does not start in time you get a warning; Ollama Code tries again each time it starts.

Use `-SkipOllama` / `--skip-ollama` if Ollama runs on another computer (see [Using Ollama on another computer](#using-ollama-on-another-computer)).

### 4. App files, launcher and shortcuts

1. **App files.** The installer downloads `ollama-code.zip` (Windows) or `ollama-code.tar.gz` (macOS/Linux) from the GitHub release, unpacks it, and copies it into the `app` folder inside the install folder, replacing any older version. If no release package can be found, it falls back to the latest source code from the `main` branch and prints a warning. With `-Source` / `--source`, it copies from a folder on your computer instead (see [Install from a local copy of the code](#install-from-a-local-copy-of-the-code)). The setup program already contains the app files, so it skips the download.
2. **Launcher.** A small `ollama-code` command is created:
   - Windows: `ollama-code.cmd` in the install folder.
   - macOS/Linux: `~/.local/bin/ollama-code`.

   The launcher uses the private Node.js copy if there is one, otherwise the `node` on your PATH.
3. **PATH.** So that `ollama-code` works in any terminal:
   - Windows: the install folder is added to your user PATH.
   - macOS/Linux: if `~/.local/bin` is not already on your PATH, a line ending in `# added by ollama-code` is added to `~/.zshrc` and `~/.bashrc` (if they exist) and to `~/.profile`.

   Terminals that were already open don't see the change. Open a new one.
4. **Shortcuts** (unless `-NoShortcuts` / `--no-shortcuts`):
   - Windows: **Ollama Code** in the Start Menu and on the Desktop.
   - Linux: an **Ollama Code** entry in your applications menu (`ollama-code.desktop`), with a right-click action **Stop Ollama Code**.
   - macOS: an app called **Ollama Code** in `~/Applications`, which you can open from Launchpad or Spotlight.
5. **Settings > Apps entry (Windows).** The PowerShell installer registers Ollama Code under *Settings > Apps > Installed apps* so you can uninstall it there. (The setup program registers its own entry.)
6. An uninstall script is copied into the install folder.

### 5. Model (unless skipped)

If Ollama is installed locally and running, the installer runs `ollama-code doctor` to get a model recommendation for your hardware, then:

- If you asked for a specific model (`-Model` / `--model`) or you don't have any coding model yet, it asks "Download *model* now?" and runs `ollama pull`.
- If the model is already installed, it says so.
- If you already have some other coding model, it does not download anything and just tells you which model it would recommend.

Use `-SkipModel` / `--skip-model` to skip this step. You can always download a model later from the app (*System check & models*) or with `ollama-code pull <model>`.

### 6. Final check and launch

The installer runs `ollama-code doctor` one more time and prints the result, then starts Ollama Code (unless `-NoLaunch` / `--no-launch`). The app opens in its own window.

## Installer options

### Windows installer options (install.ps1)

| Option | What it does | Default |
|---|---|---|
| `-InstallDir <path>` | Where to install | `%LOCALAPPDATA%\Programs\OllamaCode` |
| `-Model <name>` | Download this model instead of the recommended one | the recommended model |
| `-SkipModel` | Don't download a model | off |
| `-SkipOllama` | Don't install Ollama (for example, if it runs on another computer) | off |
| `-Source <path>` | Copy the app from this local folder instead of downloading it | download |
| `-Version <tag>` | Release to install, for example `v1.0.0` | `latest` |
| `-Yes` | Answer yes to every question | off |
| `-NoShortcuts` | Don't create Start Menu and Desktop shortcuts | off |
| `-NoLaunch` | Don't start the app at the end | off |
| `-CheckOnly` | Only report what is installed and what is missing; change nothing | off |
| `-Managed` | Used internally by `OllamaCodeSetup.exe`. Don't use it yourself. | off |

Environment variables (useful with the `irm ... | iex` one-liner, which cannot take options):

| Variable | Same as |
|---|---|
| `OC_INSTALL_DIR` | `-InstallDir` |
| `OC_MODEL` | `-Model` |
| `OC_VERSION` | `-Version` |
| `OC_YES=1` | `-Yes` |
| `OC_SKIP_MODEL=1` | `-SkipModel` |
| `OC_REPO` | Download from a different GitHub repository (`owner/name`), for example a fork. Default `sasha-thecornerspore-dev/ollama-code`. |

### macOS and Linux installer options (install.sh)

| Option | What it does | Default |
|---|---|---|
| `--yes`, `-y` | Answer yes to every question | off |
| `--model NAME` | Download this model instead of the recommended one | the recommended model |
| `--skip-model` | Don't download a model | off |
| `--skip-ollama` | Don't install Ollama | off |
| `--dir PATH` | Install location | macOS: `~/Library/Application Support/OllamaCode`; Linux: `~/.local/share/ollama-code` |
| `--source PATH` | Copy the app from this local folder instead of downloading it | download |
| `--version TAG` | Release to install, for example `v1.0.0` | `latest` |
| `--no-shortcuts` | Don't create the applications menu entry (Linux) or app bundle (macOS) | off |
| `--no-launch` | Don't start the app at the end | off |
| `--check` | Only report what is installed and missing; change nothing | off |
| `--help` | Show the options | |

Environment variables:

| Variable | Same as |
|---|---|
| `OC_INSTALL_DIR` | `--dir` |
| `OC_BIN_DIR` | Where to put the `ollama-code` command. Default `~/.local/bin`. |
| `OC_MODEL` | `--model` |
| `OC_VERSION` | `--version` |
| `OC_YES=1` | `--yes` |
| `OC_SKIP_MODEL=1` | `--skip-model` |
| `OC_REPO` | Download from a different GitHub repository (`owner/name`). Default `sasha-thecornerspore-dev/ollama-code`. |

On Linux, if `XDG_DATA_HOME` is set, the default install location is `$XDG_DATA_HOME/ollama-code` and the menu entry goes in `$XDG_DATA_HOME/applications`.

If you install to a custom `--dir`, run the `uninstall.sh` inside that folder and it finds its own location. If you used a custom `OC_BIN_DIR`, set the same `OC_BIN_DIR` when you uninstall (see [Uninstalling](#uninstalling)).

## Where things are installed

### The app

| | Windows | macOS | Linux |
|---|---|---|---|
| Install folder | `%LOCALAPPDATA%\Programs\OllamaCode` | `~/Library/Application Support/OllamaCode` | `~/.local/share/ollama-code` |
| App files | `<install folder>\app` | `<install folder>/app` | `<install folder>/app` |
| Private Node.js (if installed) | `<install folder>\runtime\node` | `<install folder>/runtime/node` | `<install folder>/runtime/node` |
| `ollama-code` command | `<install folder>\ollama-code.cmd` (folder added to user PATH) | `~/.local/bin/ollama-code` | `~/.local/bin/ollama-code` |
| Uninstall script | `<install folder>\uninstall.ps1` | `<install folder>/uninstall.sh` | `<install folder>/uninstall.sh` |
| Shortcuts | Start Menu and Desktop: `Ollama Code.lnk` | `~/Applications/Ollama Code.app` | `~/.local/share/applications/ollama-code.desktop` |
| Uninstall entry | *Settings > Apps* (registry key `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\OllamaCode` for the PowerShell install) | none | none |
| Install log | `%TEMP%\ollama-code-install.log` | `$TMPDIR/ollama-code-install.log` | `$TMPDIR/ollama-code-install.log`, or `/tmp/ollama-code-install.log` if `TMPDIR` is not set |

### Your data

Your sessions and settings are stored separately from the app, so updating or reinstalling does not touch them:

| | Windows | macOS and Linux |
|---|---|---|
| Data folder | `%USERPROFILE%\.ollama-code` | `~/.ollama-code` |
| Settings | `<data folder>\config.json` (optional, you create it) | `<data folder>/config.json` |
| Sessions | `<data folder>\sessions\*.json` | `<data folder>/sessions/*.json` |
| Personal instructions | `<data folder>\MEMORY.md` (optional) | `<data folder>/MEMORY.md` |

You can move the data folder by setting the `OLLAMA_CODE_HOME` environment variable. See [Configuration](MANUAL.md#configuration).

### Ollama and models

Ollama is a separate program with its own install location. Models are stored by Ollama, not by Ollama Code:

- Windows: `%USERPROFILE%\.ollama\models`
- macOS: `~/.ollama/models`
- Linux (installed with the official script, running as a service): usually `/usr/share/ollama/.ollama/models`

## Install from source (no installer)

If you already have Node.js 20+ and Ollama, you can run Ollama Code straight from a copy of the code. There are no npm packages to install.

```bash
git clone https://github.com/sasha-thecornerspore-dev/ollama-code.git
cd ollama-code
ollama pull qwen2.5-coder:7b     # or another model, see the manual
npm start
```

`npm start` starts the server and opens the app window. You can also run the command-line tool directly, for example `node bin/ollama-code.js doctor`. On Windows you can double-click `start.cmd` in the folder.

This does not add the `ollama-code` command to your PATH or create shortcuts. To get those, use the next section.

## Install from a local copy of the code

The installers can install from a folder on your computer instead of downloading. This is useful for testing changes or for installing a version you have downloaded by hand.

If you run the installer from inside a copy of the code, it notices this and uses that copy automatically:

```powershell
# Windows, from the repository folder
powershell -NoProfile -ExecutionPolicy Bypass -File installer\install.ps1
```

```bash
# macOS / Linux, from the repository folder
bash installer/install.sh
```

Or point it at a folder explicitly. The folder must contain `server.js` (for example an unpacked `ollama-code.zip` or `ollama-code.tar.gz` from a release):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Source C:\Downloads\ollama-code
```

```bash
bash install.sh --source ~/Downloads/ollama-code
```

The folders `.git`, `node_modules`, `dist` and `.github` are not copied.

## Updating

To update, run the installer again, the same way you installed:

- **Setup program:** download and run the newer `OllamaCodeSetup.exe`.
- **PowerShell or curl one-liner:** run the same command again.

The installer replaces the app files and keeps your sessions and settings (they live in the separate data folder). Node.js, Ollama and models are only downloaded if they are missing.

It is best to close Ollama Code first. Run `ollama-code stop`, or close its console window on Windows.

To install a specific older or newer release, use `-Version v1.2.3` / `--version v1.2.3`.

Updating Ollama itself is separate: use Ollama's own updater, or download it again from [ollama.com/download](https://ollama.com/download).

## Uninstalling

Uninstalling removes the app, its launcher, shortcuts and PATH entry. **Ollama and your downloaded models are always kept.** You are asked whether to also delete your sessions and settings.

### Windows

- **Installed with the setup program or PowerShell:** open *Settings > Apps > Installed apps*, find **Ollama Code**, and choose **Uninstall**.
- **From a terminal (PowerShell install):**

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Programs\OllamaCode\uninstall.ps1"
  ```

  Options: `-RemoveData` also deletes `%USERPROFILE%\.ollama-code` (sessions and settings); `-Quiet` doesn't ask any questions.

The setup program's uninstaller never deletes your sessions and settings. Delete `%USERPROFILE%\.ollama-code` yourself if you want them gone.

To remove Ollama as well, uninstall **Ollama** from *Settings > Apps*. Models are in `%USERPROFILE%\.ollama\models`.

### macOS and Linux

Run the uninstall script in the install folder:

```bash
# macOS
"$HOME/Library/Application Support/OllamaCode/uninstall.sh"

# Linux
~/.local/share/ollama-code/uninstall.sh
```

Options: `--remove-data` also deletes `~/.ollama-code`; `--yes` (or `-y`) doesn't ask any questions.

If you installed with `--dir` or `OC_BIN_DIR`, set the same locations for the uninstaller, for example:

```bash
OC_INSTALL_DIR=/opt/tools/ollama-code "/opt/tools/ollama-code/uninstall.sh"
```

The script removes the `ollama-code` command, the applications menu entry or app bundle, the `# added by ollama-code` lines in your shell startup files, and the install folder.

To remove Ollama as well: on macOS, quit Ollama and delete `Ollama.app`; on Linux, follow [Ollama's Linux uninstall instructions](https://github.com/ollama/ollama/blob/main/docs/linux.md#uninstall).

## Offline or air-gapped computers

When it is running, Ollama Code only talks to the Ollama server. It does not contact the internet. The installers, however, download Node.js, Ollama, the app and a model. To install on a computer without internet access:

1. On a computer with internet access, download from the [release page](https://github.com/sasha-thecornerspore-dev/ollama-code/releases/latest): `ollama-code.zip` (Windows) or `ollama-code.tar.gz` (macOS/Linux), the matching `install.ps1` or `install.sh`, and `SHA256SUMS.txt`.
2. Also download the Node.js 20+ installer for the target system from [nodejs.org](https://nodejs.org) and the Ollama installer from [ollama.com/download](https://ollama.com/download).
3. On the offline computer, install Node.js and Ollama first. The Ollama Code installer then finds them and does not try to download them.
4. Copy a model across. Models are just files in Ollama's models folder (see [Ollama and models](#ollama-and-models)). The simplest way is to `ollama pull` the model on a connected computer and copy the whole models folder to the same place on the offline computer.
5. Unpack the app archive and run the installer with `-Source` / `--source` and `-SkipModel` / `--skip-model`:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Source C:\Media\ollama-code -SkipModel
   ```

   ```bash
   bash install.sh --source /media/usb/ollama-code --skip-model
   ```

The `OllamaCodeSetup.exe` program also contains the app files, but it still downloads Node.js (if missing), Ollama (if missing) and, unless you untick it, a model.

## Using Ollama on another computer

Ollama Code can use an Ollama server on another computer, for example a desktop with a big GPU.

1. On the computer that runs Ollama, make it listen on the network. By default Ollama only accepts connections from its own computer; see Ollama's documentation for setting `OLLAMA_HOST=0.0.0.0` on the server. Download your models on that computer.
2. Install Ollama Code without Ollama:

   ```powershell
   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1))) -SkipOllama
   ```

   ```bash
   curl -fsSL https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.sh | bash -s -- --skip-ollama
   ```

   The model step is skipped automatically when Ollama is not installed locally.
3. Tell Ollama Code where the server is, either with the `OLLAMA_HOST` environment variable (for example `OLLAMA_HOST=http://192.168.1.50:11434`) or with `ollamaUrl` in `~/.ollama-code/config.json`:

   ```json
   { "ollamaUrl": "http://192.168.1.50:11434" }
   ```

   The environment variable wins if both are set. If you leave out `http://`, it is added. The address `0.0.0.0` is treated as `127.0.0.1` (this computer).
4. Run `ollama-code doctor` to check that the server is reachable.

Be careful: Ollama has no password protection. Anyone who can reach that port on your network can use the server. Only do this on a network you trust.

## Checking downloads

Each release includes `SHA256SUMS.txt` with a checksum for every file. To check a download:

```powershell
# Windows (PowerShell)
Get-FileHash .\OllamaCodeSetup.exe -Algorithm SHA256
# compare the result with the line for OllamaCodeSetup.exe in SHA256SUMS.txt (case does not matter)
```

```bash
# Linux, in the folder with the downloads: checks every file you downloaded
sha256sum -c SHA256SUMS.txt --ignore-missing

# macOS: print the checksum and compare it with the line in SHA256SUMS.txt
shasum -a 256 ollama-code.tar.gz
```

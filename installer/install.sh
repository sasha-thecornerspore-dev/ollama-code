#!/usr/bin/env bash
# Ollama Code installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --yes --model qwen2.5-coder:7b
#
# Checks the system, installs anything missing (Node.js, Ollama, a coding model),
# installs the app for the current user, and adds a launcher. Run with --help for options.
set -euo pipefail

REPO="${OC_REPO:-sasha-thecornerspore-dev/ollama-code}"
VERSION="${OC_VERSION:-latest}"
MIN_NODE=20
YES="${OC_YES:-0}"
SKIP_MODEL="${OC_SKIP_MODEL:-0}"
MODEL="${OC_MODEL:-}"
SKIP_OLLAMA=0
SOURCE=""
CHECK_ONLY=0
NO_LAUNCH=0
NO_SHORTCUTS=0
INSTALL_DIR="${OC_INSTALL_DIR:-}"
BIN_DIR="${OC_BIN_DIR:-$HOME/.local/bin}"
LOG_FILE="${TMPDIR:-/tmp}/ollama-code-install.log"

usage() {
  cat <<EOF
Ollama Code installer (macOS / Linux)

Options:
  --yes, -y          Answer yes to every question (unattended)
  --model NAME       Download this model instead of the recommended one
  --skip-model       Don't download a model
  --skip-ollama      Don't install Ollama
  --dir PATH         Install location
  --source PATH      Install the app from a local folder instead of downloading it
  --version TAG      Release tag to install (default: latest)
  --no-shortcuts     Don't create a menu entry / app bundle
  --no-launch        Don't start the app when finished
  --check            Only report what is installed and missing; change nothing
  --help             Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) YES=1 ;;
    --model) MODEL="$2"; shift ;;
    --skip-model) SKIP_MODEL=1 ;;
    --skip-ollama) SKIP_OLLAMA=1 ;;
    --dir) INSTALL_DIR="$2"; shift ;;
    --source) SOURCE="$2"; shift ;;
    --version) VERSION="$2"; shift ;;
    --no-shortcuts) NO_SHORTCUTS=1 ;;
    --no-launch) NO_LAUNCH=1 ;;
    --check) CHECK_ONLY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
  shift
done

# ---------- output helpers ----------
if [ -t 1 ]; then C_B=$'\033[1m'; C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_C=$'\033[36m'; C_D=$'\033[2m'; C_0=$'\033[0m'
else C_B=""; C_G=""; C_Y=""; C_R=""; C_C=""; C_D=""; C_0=""; fi
step() { printf '\n%s==> %s%s\n' "$C_C" "$1" "$C_0"; }
ok()   { printf '  %s[ok]%s   %s\n' "$C_G" "$C_0" "$1"; }
warn() { printf '  %s[warn]%s %s\n' "$C_Y" "$C_0" "$1"; }
miss() { printf '  %s[miss]%s %s\n' "$C_R" "$C_0" "$1"; }
info() { printf '         %s%s%s\n' "$C_D" "$1" "$C_0"; }
die() {
  printf '\n%sInstallation failed: %s%s\n' "$C_R" "$1" "$C_0"
  printf 'Log: %s\nHelp: https://github.com/%s/blob/main/docs/TROUBLESHOOTING.md\n' "$LOG_FILE" "$REPO"
  exit 1
}
ask() { # ask "question" -> 0 for yes
  [ "$YES" = "1" ] && return 0
  local ans=""
  if [ -r /dev/tty ]; then printf '  %s [Y/n] ' "$1"; read -r ans </dev/tty || ans=""; fi
  case "$ans" in ""|y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}
have() { command -v "$1" >/dev/null 2>&1; }
download() { # download URL DEST
  info "Downloading $1"
  if have curl; then curl -fsSL --retry 3 -o "$2" "$1"
  elif have wget; then wget -q -O "$2" "$1"
  else die "curl or wget is required"; fi
}
fetch() { if have curl; then curl -fsSL --retry 3 "$1"; else wget -q -O - "$1"; fi; }
sha256() { if have sha256sum; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi; }

exec > >(tee "$LOG_FILE") 2>&1

printf '\n  %sOllama Code installer%s\n  %sA local coding agent powered by Ollama models%s\n' "$C_B" "$C_0" "$C_D" "$C_0"

# ---------- 1. system check ----------
step "Checking this computer"
OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLATFORM=darwin ;;
  Linux) PLATFORM=linux ;;
  *) die "Unsupported OS: $OS. On Windows, use install.ps1." ;;
esac
case "$ARCH" in
  x86_64|amd64) NARCH=x64 ;;
  arm64|aarch64) NARCH=arm64 ;;
  *) die "Unsupported CPU architecture: $ARCH" ;;
esac
if [ -z "$INSTALL_DIR" ]; then
  if [ "$PLATFORM" = darwin ]; then INSTALL_DIR="$HOME/Library/Application Support/OllamaCode"
  else INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/ollama-code"; fi
fi

if [ "$PLATFORM" = darwin ]; then
  ok "macOS $(sw_vers -productVersion) ($NARCH)"
  MAJOR="$(sw_vers -productVersion | cut -d. -f1)"
  [ "$MAJOR" -ge 12 ] || warn "macOS 12 Monterey or newer is recommended for Ollama"
  RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
else
  DISTRO="$( (. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-Linux}") || echo Linux)"
  ok "$DISTRO ($NARCH)"
  RAM_GB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1048576 ))
  [ -f /etc/alpine-release ] && warn "Alpine (musl) detected: the Node.js and Ollama binaries need glibc. Install nodejs with apk first."
fi
if [ "$RAM_GB" -ge 16 ]; then ok "${RAM_GB} GB RAM"; elif [ "$RAM_GB" -ge 8 ]; then warn "${RAM_GB} GB RAM (small models only)"; else warn "${RAM_GB} GB RAM: below the recommended 8 GB"; fi

if have nvidia-smi && GPU="$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null)" && [ -n "$GPU" ]; then ok "GPU: $GPU"
elif [ "$PLATFORM" = darwin ] && [ "$NARCH" = arm64 ]; then ok "GPU: Apple Silicon (unified memory)"
elif have rocm-smi; then ok "GPU: AMD (ROCm)"
else warn "No supported GPU detected: models will run on the CPU (slower)"; fi

PARENT="$INSTALL_DIR"; while [ ! -d "$PARENT" ]; do PARENT="$(dirname "$PARENT")"; done
FREE_GB=$(( $(df -Pk "$PARENT" | awk 'NR==2 {print $4}') / 1048576 ))
if [ "$FREE_GB" -ge 15 ]; then ok "${FREE_GB} GB free disk space"; else warn "Only ${FREE_GB} GB free (models need 2-20 GB)"; fi

have curl || have wget || die "curl or wget is required"
have tar || die "tar is required"

NODE=""
node_ok() { [ -x "$1" ] || have "$1" || return 1; local v; v="$("$1" --version 2>/dev/null | sed 's/^v//' | cut -d. -f1)"; [ -n "$v" ] && [ "$v" -ge "$MIN_NODE" ]; }
if have node && node_ok node; then NODE="$(command -v node)"; ok "Node.js $(node --version) (system)"
elif node_ok "$INSTALL_DIR/runtime/node/bin/node"; then NODE="$INSTALL_DIR/runtime/node/bin/node"; ok "Node.js $("$NODE" --version) (private copy)"
else miss "Node.js $MIN_NODE+ not found (will install a private copy for Ollama Code)"; fi

find_ollama() {
  if have ollama; then command -v ollama; return; fi
  for p in "/Applications/Ollama.app/Contents/Resources/ollama" "$HOME/Applications/Ollama.app/Contents/Resources/ollama" /usr/local/bin/ollama /usr/bin/ollama; do
    [ -x "$p" ] && { echo "$p"; return; }
  done
  return 1
}
ollama_up() { fetch "http://127.0.0.1:11434/api/version" >/dev/null 2>&1; }
OLLAMA="$(find_ollama || true)"
if [ -n "$OLLAMA" ]; then ok "Ollama: $OLLAMA"; elif [ "$SKIP_OLLAMA" = 1 ]; then warn "Ollama not found (skipped by request)"; else miss "Ollama not found (will install)"; fi
if have git; then ok "Git: $(git --version | sed 's/git version //')"; else warn "Git not found (optional)"; fi
[ -f "$INSTALL_DIR/app/server.js" ] && info "Existing install found in $INSTALL_DIR; it will be updated. Your sessions are kept."

if [ "$CHECK_ONLY" = 1 ]; then printf '\nCheck only: nothing was changed.\n'; exit 0; fi

printf '\n  Ollama Code will be installed to %s\n' "$INSTALL_DIR"
ask "Continue?" || { echo "Cancelled."; exit 0; }
mkdir -p "$INSTALL_DIR" "$BIN_DIR"

# ---------- 2. Node.js ----------
if [ -z "$NODE" ]; then
  step "Installing Node.js (private copy, no admin needed)"
  FILE=""; BASE=""
  for line in latest-v24.x latest-v22.x; do
    SUMS="$(fetch "https://nodejs.org/dist/$line/SHASUMS256.txt" || true)"
    FILE="$(printf '%s\n' "$SUMS" | awk '{print $2}' | grep -E "^node-v[0-9.]+-$PLATFORM-$NARCH\.tar\.gz$" | head -n1 || true)"
    if [ -n "$FILE" ]; then BASE="https://nodejs.org/dist/$line"; break; fi
  done
  [ -n "$FILE" ] || die "Could not find a Node.js download for $PLATFORM-$NARCH"
  TMP="$(mktemp -d)"
  download "$BASE/$FILE" "$TMP/$FILE"
  EXPECTED="$(printf '%s\n' "$SUMS" | awk -v f="$FILE" '$2 == f {print $1}')"
  [ "$(sha256 "$TMP/$FILE")" = "$EXPECTED" ] || die "Node.js checksum mismatch"
  ok "Checksum verified"
  rm -rf "$INSTALL_DIR/runtime/node"; mkdir -p "$INSTALL_DIR/runtime/node"
  tar -xzf "$TMP/$FILE" -C "$INSTALL_DIR/runtime/node" --strip-components=1
  rm -rf "$TMP"
  NODE="$INSTALL_DIR/runtime/node/bin/node"
  node_ok "$NODE" || die "Node.js was downloaded but does not run on this system"
  ok "Node.js $("$NODE" --version) installed"
fi

# ---------- 3. Ollama ----------
if [ -z "$OLLAMA" ] && [ "$SKIP_OLLAMA" != 1 ]; then
  step "Installing Ollama"
  if [ "$PLATFORM" = linux ]; then
    info "Using the official Ollama install script (it may ask for your password to install a system service)."
    fetch https://ollama.com/install.sh | sh || die "The Ollama install script failed"
  else
    TMP="$(mktemp -d)"
    download "https://ollama.com/download/Ollama-darwin.zip" "$TMP/Ollama.zip"
    (cd "$TMP" && unzip -q Ollama.zip)
    DEST="/Applications"; [ -w "$DEST" ] || { DEST="$HOME/Applications"; mkdir -p "$DEST"; }
    rm -rf "$DEST/Ollama.app"; mv "$TMP/Ollama.app" "$DEST/"
    rm -rf "$TMP"
    ok "Ollama.app installed in $DEST"
    if ! have ollama; then ln -sf "$DEST/Ollama.app/Contents/Resources/ollama" "$BIN_DIR/ollama"; fi
  fi
  OLLAMA="$(find_ollama || true)"
  [ -n "$OLLAMA" ] || die "Ollama could not be installed automatically. Install it from https://ollama.com/download and run this again."
  ok "Ollama installed: $OLLAMA"
fi

if [ -n "$OLLAMA" ] && ! ollama_up; then
  info "Starting the Ollama server…"
  if [ "$PLATFORM" = darwin ] && { [ -d "/Applications/Ollama.app" ] || [ -d "$HOME/Applications/Ollama.app" ]; }; then open -a Ollama || true
  elif have systemctl && systemctl list-unit-files ollama.service >/dev/null 2>&1; then sudo -n systemctl start ollama 2>/dev/null || nohup "$OLLAMA" serve >/dev/null 2>&1 &
  else nohup "$OLLAMA" serve >/dev/null 2>&1 & fi
  for _ in $(seq 1 30); do ollama_up && break; sleep 0.7; done
fi
if [ -n "$OLLAMA" ]; then if ollama_up; then ok "Ollama server is running"; else warn "Ollama did not start yet; Ollama Code will retry when it launches."; fi; fi

# ---------- 4. App files ----------
step "Installing Ollama Code"
APP_DIR="$INSTALL_DIR/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -z "$SOURCE" ] && [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/../server.js" ]; then SOURCE="$(cd "$SCRIPT_DIR/.." && pwd)"; fi
TMP_APP=""
if [ -z "$SOURCE" ]; then
  TMP_APP="$(mktemp -d)"
  if [ "$VERSION" = latest ]; then URL="https://github.com/$REPO/releases/latest/download/ollama-code.tar.gz"
  else URL="https://github.com/$REPO/releases/download/$VERSION/ollama-code.tar.gz"; fi
  if ! download "$URL" "$TMP_APP/app.tar.gz" 2>/dev/null; then
    warn "No release package found; using the latest source from the main branch."
    download "https://github.com/$REPO/archive/refs/heads/main.tar.gz" "$TMP_APP/app.tar.gz"
  fi
  tar -xzf "$TMP_APP/app.tar.gz" -C "$TMP_APP"
  SOURCE="$(dirname "$(find "$TMP_APP" -maxdepth 3 -name server.js | head -n1)")"
  [ -f "$SOURCE/server.js" ] || die "The downloaded package does not contain Ollama Code"
fi
if [ "$(cd "$SOURCE" && pwd)" != "$(mkdir -p "$APP_DIR" && cd "$APP_DIR" && pwd)" ]; then
  rm -rf "$APP_DIR"; mkdir -p "$APP_DIR"
  (cd "$SOURCE" && tar --exclude=.git --exclude=node_modules --exclude=dist --exclude=.github -cf - .) | (cd "$APP_DIR" && tar -xf -)
fi
[ -n "$TMP_APP" ] && rm -rf "$TMP_APP"
[ -f "$APP_DIR/bin/ollama-code.js" ] || die "App files are missing from $APP_DIR"
APP_VERSION="$("$NODE" -p "require('$APP_DIR/package.json').version" 2>/dev/null || echo unknown)"
ok "App files in $APP_DIR"

# Launcher on PATH
LAUNCHER="$BIN_DIR/ollama-code"
cat > "$LAUNCHER" <<EOF
#!/bin/sh
# Ollama Code launcher (generated by the installer)
NODE="$INSTALL_DIR/runtime/node/bin/node"
[ -x "\$NODE" ] || NODE="node"
exec "\$NODE" "$APP_DIR/bin/ollama-code.js" "\$@"
EOF
chmod +x "$LAUNCHER"
cp "$APP_DIR/installer/uninstall.sh" "$INSTALL_DIR/uninstall.sh"; chmod +x "$INSTALL_DIR/uninstall.sh"
ok "Command installed: $LAUNCHER"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
      if [ -f "$rc" ] || [ "$rc" = "$HOME/.profile" ]; then
        grep -q '# added by ollama-code' "$rc" 2>/dev/null || printf '\nexport PATH="%s:$PATH"  # added by ollama-code\n' "$BIN_DIR" >> "$rc"
      fi
    done
    export PATH="$BIN_DIR:$PATH"
    ok "Added $BIN_DIR to your PATH (open a new terminal to use \"ollama-code\")"
    ;;
esac

if [ "$NO_SHORTCUTS" != 1 ]; then
  if [ "$PLATFORM" = linux ]; then
    APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"; mkdir -p "$APPS"
    cat > "$APPS/ollama-code.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Ollama Code
Comment=Local coding agent powered by Ollama
Exec="$LAUNCHER" start
Icon=$APP_DIR/public/icon-256.png
Terminal=false
Categories=Development;IDE;
Actions=stop;

[Desktop Action stop]
Name=Stop Ollama Code
Exec="$LAUNCHER" stop
EOF
    have update-desktop-database && update-desktop-database "$APPS" >/dev/null 2>&1 || true
    ok "Added Ollama Code to the applications menu"
  else
    BUNDLE="$HOME/Applications/Ollama Code.app"
    rm -rf "$BUNDLE"; mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"
    cat > "$BUNDLE/Contents/MacOS/OllamaCode" <<EOF
#!/bin/sh
exec "$LAUNCHER" start
EOF
    chmod +x "$BUNDLE/Contents/MacOS/OllamaCode"
    cat > "$BUNDLE/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Ollama Code</string>
  <key>CFBundleIdentifier</key><string>io.github.ollama-code</string>
  <key>CFBundleExecutable</key><string>OllamaCode</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundleShortVersionString</key><string>$APP_VERSION</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict></plist>
EOF
    if have sips && have iconutil; then
      ICONSET="$(mktemp -d)/icon.iconset"; mkdir -p "$ICONSET"
      for s in 16 32 128 256 512; do
        sips -z $s $s "$APP_DIR/public/icon-512.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
        d=$((s * 2)); [ $d -le 512 ] && sips -z $d $d "$APP_DIR/public/icon-512.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
      done
      iconutil -c icns "$ICONSET" -o "$BUNDLE/Contents/Resources/icon.icns" 2>/dev/null || true
    fi
    ok "Created $BUNDLE (find it in Launchpad / Spotlight)"
  fi
fi

# ---------- 5. Model ----------
CLI="$APP_DIR/bin/ollama-code.js"
if [ -n "$OLLAMA" ] && [ "$SKIP_MODEL" != 1 ] && ollama_up; then
  step "Choosing a model"
  REPORT="$("$NODE" "$CLI" doctor --json 2>/dev/null || true)"
  read_json() { printf '%s' "$REPORT" | "$NODE" -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log($1)})" 2>/dev/null || true; }
  REC="$(read_json 'r.recommendation.model')"
  REC_GB="$(read_json 'r.recommendation.downloadGB')"
  BASIS="$(read_json 'r.recommendation.basis')"
  MODELS_OK="$(read_json "r.checks.find(c=>c.id==='models').status")"
  HAVE="$(read_json "r.ollama.models.join(' ')")"
  TARGET="${MODEL:-$REC}"
  info "Recommended for this computer: $REC (~$REC_GB GB), based on $BASIS."
  if [ -n "$TARGET" ] && printf ' %s ' "$HAVE" | grep -q " $TARGET "; then ok "$TARGET is already installed"
  elif [ -n "$MODEL" ] || [ "$MODELS_OK" != ok ]; then
    if ask "Download $TARGET now?"; then
      if "$OLLAMA" pull "$TARGET"; then ok "$TARGET is ready"; else warn "Download failed. Try later: ollama pull $TARGET"; fi
    fi
  else
    ok "You already have a coding model ($HAVE)"
    info "For better results on this computer you can also run: ollama pull $REC"
  fi
fi

# ---------- 6. Final check ----------
step "Final check"
"$NODE" "$CLI" doctor || true
printf '\n  %sOllama Code %s is installed.%s\n' "$C_G" "$APP_VERSION" "$C_0"
if [ "$PLATFORM" = darwin ]; then echo "  Open \"Ollama Code\" from Launchpad or Spotlight, or run: ollama-code"
else echo "  Open \"Ollama Code\" from your applications menu, or run: ollama-code"; fi
echo "  Manual: https://github.com/$REPO/blob/main/docs/MANUAL.md"
echo "  Uninstall: \"$INSTALL_DIR/uninstall.sh\""

if [ "$NO_LAUNCH" != 1 ]; then
  nohup "$LAUNCHER" start >/dev/null 2>&1 &
fi

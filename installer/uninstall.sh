#!/usr/bin/env bash
# Removes Ollama Code. Ollama and your models are left alone.
#   --remove-data   also delete sessions and settings (~/.ollama-code)
#   --yes           don't ask
set -euo pipefail

REMOVE_DATA=0; YES=0
for a in "$@"; do
  case "$a" in
    --remove-data) REMOVE_DATA=1 ;;
    -y|--yes) YES=1 ;;
  esac
done

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "${OC_INSTALL_DIR:-}" ]; then INSTALL_DIR="$OC_INSTALL_DIR"
elif [ -f "$SELF_DIR/app/server.js" ]; then INSTALL_DIR="$SELF_DIR"   # the copy placed in the install folder
elif [ "$(uname -s)" = Darwin ]; then INSTALL_DIR="$HOME/Library/Application Support/OllamaCode"
else INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/ollama-code"; fi
BIN_DIR="${OC_BIN_DIR:-$HOME/.local/bin}"
DATA_DIR="${OLLAMA_CODE_HOME:-$HOME/.ollama-code}"

confirm() {
  [ "$YES" = 1 ] && return 0
  printf '%s [y/N] ' "$1"; read -r ans </dev/tty || ans=""
  case "$ans" in y|Y|yes) return 0 ;; *) return 1 ;; esac
}

echo "This removes Ollama Code from $INSTALL_DIR. Ollama and your models are not touched."
confirm "Continue?" || { echo "Cancelled."; exit 0; }
if [ "$REMOVE_DATA" = 0 ] && [ "$YES" = 0 ] && confirm "Also delete your sessions and settings in $DATA_DIR?"; then REMOVE_DATA=1; fi

"$BIN_DIR/ollama-code" stop >/dev/null 2>&1 || true
rm -f "$BIN_DIR/ollama-code"
rm -f "${XDG_DATA_HOME:-$HOME/.local/share}/applications/ollama-code.desktop"
rm -rf "$HOME/Applications/Ollama Code.app"
for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
  [ -f "$rc" ] && grep -q '# added by ollama-code' "$rc" && sed -i.bak '/# added by ollama-code/d' "$rc" && rm -f "$rc.bak"
done
rm -rf "$INSTALL_DIR"
[ "$REMOVE_DATA" = 1 ] && rm -rf "$DATA_DIR" && echo "Deleted $DATA_DIR"
echo "Ollama Code has been uninstalled."
echo "To remove Ollama too: on macOS delete Ollama.app; on Linux see https://github.com/ollama/ollama/blob/main/docs/linux.md#uninstall"

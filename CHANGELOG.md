# Changelog

All notable changes to Ollama Code are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-18

First public release.

### Added

- Local coding agent that works with any Ollama model: it reads, searches and edits files and runs commands in a project folder you choose.
- Browser-based app window (Edge or Chrome app mode, or the default browser) served from `127.0.0.1:4317`.
- Sessions per project folder, saved automatically to `~/.ollama-code/sessions/` and listed in a sidebar. Work continues in the background when the window is closed.
- Eight tools: `read_file`, `write_file`, `edit_file`, `list_dir`, `glob`, `grep`, `bash` (Windows PowerShell on Windows, bash elsewhere) and `todo_write`.
- Permission prompts with diffs before edits and commands, three permission modes (*Ask*, *Auto-accept edits*, *Bypass permissions*), per-session "Always allow", and Enter to approve.
- Streaming replies, collapsible "Thinking" sections, tool cards, a pinned task list, and a context meter with tokens per second.
- Stop button and Esc key; **Clear** button and `/clear` command.
- Per-session model and context window (8k to 128k) selection, limited to the model's trained context.
- Automatic context management: older tool output is shortened, then the oldest messages are dropped.
- Protection against small-model loops: a third identical tool call in a turn is blocked, three blocked calls in a row end the turn, an unchanged task list is rejected, and repeated actions are collapsed from the history the model sees.
- Helpful errors for local models: "not found" on Windows suggests the same path on other drives or under `\Users\`, bash syntax run in PowerShell gets a hint, and a notice appears when generation is very slow because the model and context don't fit in GPU memory.
- Native tool calling where the model supports it, recovery of tool calls written as text, and a text-based tool protocol for models without tool support.
- Project instruction files: `OLLAMA.md`, `CLAUDE.md` and `AGENTS.md` in the project folder, and `~/.ollama-code/MEMORY.md` for all projects.
- System check (`ollama-code doctor` and in the app) covering Node.js, memory, GPU, disk, Ollama and models, with a hardware-based model recommendation (`qwen2.5-coder` 1.5b to 32b) and in-app model download with progress.
- Command-line tool: `start`, `stop`, `doctor` (`--json`, `--fix`), `pull`, `version`, `help`.
- Configuration through `~/.ollama-code/config.json` and the `OLLAMA_HOST`, `PORT`, `OLLAMA_CODE_MODEL` and `OLLAMA_CODE_HOME` environment variables.
- Windows setup program (`OllamaCodeSetup.exe`) and PowerShell installer; macOS and Linux shell installer. The installers check the system, install a private Node.js (checksum-verified), Ollama and a recommended model when missing, add the `ollama-code` command, and create shortcuts. No administrator rights are needed (except that Ollama's Linux installer may use `sudo`).
- Uninstallers that keep Ollama and models, and optionally keep sessions and settings.
- Local-only security: binds to `127.0.0.1` and rejects requests with an unexpected `Host` or `Origin`.
- User documentation: install guide, user manual and troubleshooting guide.

[Unreleased]: https://github.com/sasha-thecornerspore-dev/ollama-code/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sasha-thecornerspore-dev/ollama-code/releases/tag/v1.0.0

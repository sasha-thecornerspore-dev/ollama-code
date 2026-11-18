# Troubleshooting

Find your problem in the list below. Most problems can be diagnosed with the built-in system check:

```
ollama-code doctor
```

It checks Node.js, memory, GPU, disk space, Ollama and your models, and prints a suggested fix (after `→`) for anything that is wrong. In the app, the same check is under **System check & models** in the sidebar.

`ollama-code doctor --fix` starts Ollama if it is installed but not running, and downloads the recommended model if you have no coding model.

- [Installing](#installing)
  - [Windows: "Windows protected your PC" (SmartScreen)](#windows-windows-protected-your-pc-smartscreen)
  - [Windows: "running scripts is disabled on this system"](#windows-running-scripts-is-disabled-on-this-system)
  - [Windows: the one-liner fails to download](#windows-the-one-liner-fails-to-download)
  - ["ollama-code" is not recognized / command not found](#ollama-code-is-not-recognized--command-not-found)
  - [Linux: password prompt while installing Ollama](#linux-password-prompt-while-installing-ollama)
  - [macOS: Apple Silicon](#macos-apple-silicon)
  - [Installer log files](#installer-log-files)
- [Starting](#starting)
  - [Ollama unreachable](#ollama-unreachable)
  - [No models](#no-models)
  - [Port 4317 is in use](#port-4317-is-in-use)
  - [The window doesn't open](#the-window-doesnt-open)
  - [The doctor says something is missing](#the-doctor-says-something-is-missing)
- [Using](#using)
  - [The model doesn't use tools, or writes JSON in the chat](#the-model-doesnt-use-tools-or-writes-json-in-the-chat)
  - [Slow responses, CPU only, or out of memory](#slow-responses-cpu-only-or-out-of-memory)
  - [edit_file says "old_string was not found"](#edit_file-says-old_string-was-not-found)
  - [The agent forgets earlier parts of the conversation](#the-agent-forgets-earlier-parts-of-the-conversation)
  - [A command times out or hangs](#a-command-times-out-or-hangs)
  - ["This session is already working"](#this-session-is-already-working)
  - [Settings in config.json have no effect](#settings-in-configjson-have-no-effect)
- [Reporting a bug](#reporting-a-bug)

## Installing

### Windows: "Windows protected your PC" (SmartScreen)

`OllamaCodeSetup.exe` is not code-signed, so Windows SmartScreen warns about it. Click **More info**, then **Run anyway**.

If your browser blocks the download ("not commonly downloaded"), open the browser's download list and choose **Keep**.

If you'd rather check the file first, compare its checksum with `SHA256SUMS.txt` from the same release (see [Checking downloads](INSTALL.md#checking-downloads)), or use the [PowerShell installer](INSTALL.md#option-2-powershell-one-liner) instead.

On computers managed by an organization, SmartScreen or other policies may not let you run it at all. Ask your IT department.

### Windows: "running scripts is disabled on this system"

This is PowerShell's execution policy. It applies when you run a downloaded `.ps1` file, not to the `irm ... | iex` one-liner. Either use the one-liner, or start the script like this, which allows it for this one run only and does not change your settings:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The same applies to the uninstaller (`uninstall.ps1`).

### Windows: the one-liner fails to download

If `irm` fails with an error about a secure channel (SSL/TLS), enable TLS 1.2 first and try again:

```powershell
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
irm https://raw.githubusercontent.com/sasha-thecornerspore-dev/ollama-code/main/installer/install.ps1 | iex
```

If you are behind a company proxy or firewall, downloads from `github.com`, `raw.githubusercontent.com`, `nodejs.org` and `ollama.com` must be allowed. Otherwise use the [offline install](INSTALL.md#offline-or-air-gapped-computers).

### "ollama-code" is not recognized / command not found

The installer adds `ollama-code` to your PATH, but terminals that were already open don't see the change. **Close the terminal and open a new one.**

If it still isn't found:

- **Windows:** check that `%LOCALAPPDATA%\Programs\OllamaCode` is in your user PATH (*Settings > System > About > Advanced system settings > Environment Variables*). You can always run it with the full path: `"%LOCALAPPDATA%\Programs\OllamaCode\ollama-code.cmd"`. Signing out and back in also refreshes PATH everywhere.
- **macOS/Linux:** check that `~/.local/bin` is on your PATH: `echo $PATH`. The installer adds it to `~/.zshrc`, `~/.bashrc` and `~/.profile`. If you use another shell (for example fish), add `~/.local/bin` to its PATH yourself. You can always run `~/.local/bin/ollama-code`.

You can also start Ollama Code from the Start Menu, Launchpad or applications menu without using a terminal.

### Linux: password prompt while installing Ollama

If Ollama is missing, the installer runs Ollama's official install script, which installs Ollama for the whole system and creates a background service. That needs administrator rights, so `sudo` asks for your password. This is expected; type your password and press Enter.

If you can't use `sudo` (or don't want to):

1. Press Ctrl+C to stop the installer.
2. Install Ollama yourself without root, following the manual install section of [Ollama's Linux instructions](https://github.com/ollama/ollama/blob/main/docs/linux.md), and make sure the `ollama` command is on your PATH.
3. Start it with `ollama serve` (leave it running in its own terminal, or set it up to start with your session).
4. Run the Ollama Code installer again. It finds Ollama and skips that step.

Alternatively, install with `--skip-ollama` and use Ollama on another computer (see [Using Ollama on another computer](INSTALL.md#using-ollama-on-another-computer)).

If Ollama was installed as a service but isn't running, start it with `sudo systemctl start ollama`. The installer only tries this without a password prompt; otherwise it falls back to starting `ollama serve` in the background.

### macOS: Apple Silicon

Apple Silicon Macs (M1 and later) work well: Ollama uses the GPU automatically, and memory is shared between the CPU and GPU. Things to check:

- **Don't run the installer in a Rosetta (Intel) terminal.** Run `uname -m` in your terminal. It should print `arm64`. If it prints `x86_64`, your terminal is running under Rosetta: the installer would download an Intel Node.js, and the system check would not recognize the Apple GPU (so it would recommend a smaller model and say "no supported GPU"). Open a normal terminal and run the installer again. To replace an Intel Node.js private copy, delete `~/Library/Application Support/OllamaCode/runtime` first.
- **Memory is shared.** About two-thirds of total memory is counted as available for the model. Close large apps if a model is slow or fails to load.
- **Ollama.app** runs in the menu bar. If Ollama isn't reachable, open Ollama from Applications (or `~/Applications`) and check that its icon appears.
- The **Ollama Code** app in `~/Applications` has no Dock icon; it starts the server in the background and opens the window. Use `ollama-code stop` to stop it.

### Installer log files

Everything the installer prints is also saved to a log file:

| System | Log file |
|---|---|
| Windows (setup program and PowerShell) | `%TEMP%\ollama-code-install.log` |
| macOS | `$TMPDIR/ollama-code-install.log` |
| Linux | `$TMPDIR/ollama-code-install.log`, or `/tmp/ollama-code-install.log` if `TMPDIR` is not set |

To open it on Windows, press Win+R and type `%TEMP%\ollama-code-install.log`. On macOS, run `open "$TMPDIR/ollama-code-install.log"`.

The log is overwritten each time the installer runs, so copy it before trying again if you want to report a problem.

To see what the installer would do without changing anything, run it with `-CheckOnly` (Windows) or `--check` (macOS/Linux).

## Starting

### Ollama unreachable

The sidebar shows **Ollama unreachable**, the start screen shows "Can't reach Ollama at http://127.0.0.1:11434 ...", or a session shows "Can't reach Ollama at ... Is it running?".

1. **Start Ollama.** Open **System check & models** and click **Start Ollama**, or run `ollama-code doctor --fix`. You can also start it yourself: open the Ollama app (Windows Start Menu, macOS Applications), or run `ollama serve` in a terminal. On Linux with the service: `sudo systemctl start ollama`.
2. **Check it answers.** Open `http://127.0.0.1:11434` in a browser. It should say "Ollama is running".
3. **Is Ollama installed?** If the System check says "Ollama installed: not found", install it from [ollama.com/download](https://ollama.com/download) or run the Ollama Code installer again.
4. **Check the address.** Ollama Code uses `OLLAMA_HOST` if it is set, then `ollamaUrl` in `config.json`, then `http://127.0.0.1:11434`. The address in use is shown in the error, in the sidebar tooltip and by `ollama-code doctor`. A leftover `OLLAMA_HOST` pointing at another computer is a common cause.
5. **Remote Ollama:** if Ollama runs on another computer, make sure it is listening on the network and that no firewall blocks port 11434 (see [Using Ollama on another computer](INSTALL.md#using-ollama-on-another-computer)).

After fixing it, click **Re-check** in the System check dialog. The sidebar updates within 15 seconds.

### No models

The System check says "no models installed", or the New session dialog says "No models installed".

- Open **System check & models** and click **Download** next to the recommended model, or type a model name under **Download a model**.
- Or in a terminal: `ollama-code pull qwen2.5-coder:7b` (or `ollama pull qwen2.5-coder:7b`).
- Downloads are several gigabytes. If one fails part-way, run it again; Ollama continues where it stopped.
- If the download fails with "file does not exist" or similar, check the model name on [ollama.com/library](https://ollama.com/library).

If the System check says "None of these are coding models", you have models, but none whose name looks like a code model. They may still work; the warning is a hint that a coding model (such as `qwen2.5-coder`) will probably do better.

### Port 4317 is in use

Ollama Code uses port 4317. When you start it:

- If **Ollama Code** is already running on that port, it just opens a new window ("Ollama Code is already running at http://localhost:4317"). This is normal.
- If **another program** uses the port, it stops with "Port 4317 is in use by another program."

To use a different port, add it to `~/.ollama-code/config.json` (`%USERPROFILE%\.ollama-code\config.json` on Windows):

```json
{ "port": 4318 }
```

or set the `PORT` environment variable. Then open `http://localhost:4318`.

Also check whether you have a `PORT` environment variable set for some other software (`echo $PORT`, or `echo $env:PORT` in PowerShell). Ollama Code uses it if it is set.

To find which program uses the port:

- Windows: `netstat -ano | findstr :4317`, then look up the process ID in Task Manager (Details tab).
- macOS/Linux: `lsof -i :4317`.

### The window doesn't open

Ollama Code tries to open an app window with Microsoft Edge or Google Chrome (Chromium on Linux) and falls back to your default browser. If nothing appears:

- Open `http://localhost:4317` in any browser yourself.
- Use `ollama-code start --no-open` if you never want it to open a window automatically.
- If the page shows `{"error":"Host not allowed"}`, you used an address other than `localhost` or `127.0.0.1` (for example your computer's network name or IP address). Use `http://localhost:4317`.
- If the page doesn't load at all, the server isn't running. On Windows, check for the minimized "Ollama Code" console window on the taskbar and look at its messages. Otherwise run `ollama-code` in a terminal to see the error.

### The doctor says something is missing

`ollama-code doctor` ends with "Some required pieces are missing" if any check is marked ✖. Look at the line with ✖ and its `→` fix. Notes:

- **Memory !** (under 8 GB RAM) is a warning, not a failure, and does not stop Ollama Code from working. Use a small model (`qwen2.5-coder:1.5b` or `:3b`) and a small context (8k).
- **Ollama server ✖**: see [Ollama unreachable](#ollama-unreachable).
- **Models ✖**: see [No models](#no-models).
- **Ollama server !** with "Update Ollama": your Ollama is older than 0.4.0, which has weak tool calling. Update it from [ollama.com/download](https://ollama.com/download).
- **GPU acceleration !**: no supported GPU was found, so models run on the CPU. On Windows with an NVIDIA GPU, install or update the NVIDIA driver (the check uses `nvidia-smi`, which comes with the driver).

## Using

### The model doesn't use tools, or writes JSON in the chat

Signs: the agent describes what it would do instead of doing it, asks you to run commands, invents file contents, or replies with JSON such as `{"name": "read_file", ...}` that is not turned into a tool card.

Most often this is the model, not the app. Try these in order:

1. **Use a model with native tool calling.** When you pick a model in the New session dialog, the note underneath says "Native tool calling supported" or warns that it has none. Models without it get the [text protocol fallback](MANUAL.md#native-tool-calling-and-the-fallback), which is much less reliable, especially for small models. If a session shows "*model* has no native tool calling...", switch to a model that has it.
2. **Use a bigger model.** 1.5b and 3b models often lose track of the tool format. 7b is the practical minimum for agent work; 14b and up is much better.
3. **Update Ollama.** Older versions (before 0.4.0) have weak tool-calling support. `ollama-code doctor` warns about this.
4. **Clear the conversation.** A long conversation full of failed attempts makes the model more likely to keep failing. Click **Clear** and ask again, simply.
5. **Ask directly**: "Use the read_file tool to open src/app.js." This often gets a hesitant model going.
6. **Lower the context size or shorten instruction files** if they are very long; small models follow the instructions less well when they are buried in a lot of text.

Ollama Code already tries to rescue tool calls written as text: JSON in ` ```tool ` or ` ```json ` blocks, `<tool_call>` tags, or a reply that is only JSON, as long as the tool name is one of the eight tools. If the JSON is malformed or uses a different tool name, it can't be recognized.

### Slow responses, CPU only, or out of memory

Signs: the context meter shows a low speed (for example under 5 tok/s), replies take minutes, the computer becomes sluggish, or you see an error about memory or the model failing to load.

1. **Check where the model runs.** In a terminal, run `ollama ps` while the agent is working. The PROCESSOR column shows whether the model is on the GPU, the CPU, or split between them. Anything other than "100% GPU" is slower.
2. **Use a smaller model.** Go one size down in the [recommendation table](MANUAL.md#recommended-models-by-memory), for example from `qwen2.5-coder:14b` to `qwen2.5-coder:7b`. Switch the model in the session header.
3. **Use a smaller context.** The context window takes extra memory on top of the model itself. Going from 64k to 16k (or 16k to 8k) can be the difference between fitting on the GPU and not. Change it in the session header.
4. **Close other programs**, especially ones that use the GPU (games, video editing) or a lot of memory (browsers with many tabs). On Apple Silicon Macs, memory is shared with the GPU.
5. **Run one session at a time.** Several working sessions share the same Ollama server.
6. **Check the GPU driver.** On Windows and Linux with NVIDIA, `nvidia-smi` should work in a terminal. If it doesn't, install the NVIDIA driver. See Ollama's documentation for supported GPUs.
7. **The first reply is always slower**, because Ollama loads the model into memory. Later replies should be faster. Ollama unloads models after a few minutes without use.

Without a supported GPU, everything runs on the CPU. That works, but expect a 7b model to be slow and anything bigger to be very slow.

### edit_file says "old_string was not found"

The edit tool replaces an exact piece of text. This error means the text the model wanted to replace is not in the file exactly as it wrote it. Usual causes: the model guessed at the code without reading it, got the indentation wrong (tabs vs spaces), or the file changed since it was read.

The model is told to read the file again and copy the text exactly, and good models recover on their own. If it keeps failing:

- Ask it to "read the file again, then make the edit".
- Ask it to make a smaller edit (just the lines that change, with a little context).
- If the file is small, let it rewrite the whole file with `write_file`.
- Use a bigger model; small models struggle to copy text exactly.

A related message, "old_string appears N times", means the text is not unique. The model needs to include more surrounding lines. Windows (CRLF) line endings are handled automatically and are not the cause.

### The agent forgets earlier parts of the conversation

When the conversation gets bigger than the context window, older tool output is shortened and then the oldest messages are dropped (see [What happens when it gets full](MANUAL.md#what-happens-when-it-gets-full)). Watch the context meter. Options: use **Clear** and give a short summary of where you are, pick a larger context in the header (if you have the memory), or put lasting facts in an [`OLLAMA.md`](MANUAL.md#project-instruction-files) file, which is included on every step.

### A command times out or hangs

Commands are stopped after 2 minutes unless the model asks for more (up to 10 minutes). The card then shows "timed out after ... ms". Commands cannot read keyboard input, so anything that waits for an answer (a "Continue? [y/n]" prompt, a password, an editor) sits there until it times out. And programs that run forever, like a development server or a file watcher, always time out.

- Tell the agent to use non-interactive options (for example `--yes`, `-y`, `CI=1`).
- Start servers and watchers yourself in a separate terminal.
- Press **Stop** (Esc) to end a command early; anything it started is stopped too.

On Windows, commands run in Windows PowerShell 5.1, not Command Prompt or PowerShell 7. Some commands written for bash (like `ls -la`, `rm -rf` or `export`) don't work there. Most models adapt when they see the error; you can also remind it in `OLLAMA.md` ("The shell is Windows PowerShell").

### "This session is already working"

You can't send a new message while the agent is working on the previous one. Wait for it to finish, or press **Stop** (Esc) and send your message. If a permission request is waiting, answer it first.

### Settings in config.json have no effect

- Restart Ollama Code after changing settings: `ollama-code stop`, then start it again.
- Check that the file is valid JSON (no trailing commas, double quotes around names). If it isn't, it is silently ignored.
- Check the file location with `ollama-code help` (it prints the settings path). If `OLLAMA_CODE_HOME` is set, the file is in that folder.
- Environment variables (`OLLAMA_HOST`, `PORT`, `OLLAMA_CODE_MODEL`) override the file.
- `defaultModel` only pre-selects a model for new sessions when the browser doesn't remember a model you used before. `numCtx` only applies to new sessions; existing sessions keep their own setting.

## Reporting a bug

Please [open an issue](https://github.com/sasha-thecornerspore-dev/ollama-code/issues/new/choose) and include:

1. **What you did, what you expected, and what happened.** Exact error messages help a lot. A screenshot of the conversation is often useful.
2. **The Ollama Code version:** `ollama-code version` (also shown at the bottom of the sidebar).
3. **The system check:** the output of `ollama-code doctor`. For more detail, `ollama-code doctor --json`.
4. **How you installed it:** setup program, PowerShell, curl, or from source.
5. **The model** you used, and the context size and permission mode of the session.
6. **For install problems:** the [installer log](#installer-log-files).
7. **For problems with Ollama itself** (models not loading, GPU not used): your Ollama version (`ollama --version`) and, if you can, Ollama's own log. See Ollama's troubleshooting documentation for where to find it.

Before you post logs or session content, check them for anything private: file paths, code, user names, or secrets. Session files in `~/.ollama-code/sessions` contain your conversation and the files the agent read; don't attach them unless you are happy to share that.

For security problems, don't open a public issue. See [SECURITY.md](../SECURITY.md).

# Ollama Code user manual

Ollama Code is a coding assistant that runs on your own computer. You pick a project folder and a language model, then describe what you want in plain English. The assistant (the "agent") reads your files, searches the code, makes edits and runs commands to get the job done. Before it changes a file or runs a command, it asks you.

The models run in [Ollama](https://ollama.com) on your machine, so your code is not sent to any online service.

If you haven't installed it yet, start with [INSTALL.md](INSTALL.md). If something isn't working, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Contents

- [Getting started](#getting-started)
- [A tour of the window](#a-tour-of-the-window)
- [Sessions](#sessions)
- [Permissions](#permissions)
- [The tools](#the-tools)
- [The task list](#the-task-list)
- [The context window](#the-context-window)
- [Clearing the conversation](#clearing-the-conversation)
- [Choosing a model](#choosing-a-model)
- [Project instruction files](#project-instruction-files)
- [Command-line reference](#command-line-reference)
- [Configuration](#configuration)
- [Where your data is stored](#where-your-data-is-stored)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Getting good results from local models](#getting-good-results-from-local-models)
- [Security](#security)
- [FAQ](#faq)

## Getting started

1. **Open Ollama Code.** Use the Start Menu or Desktop shortcut (Windows), Launchpad or Spotlight (macOS), your applications menu (Linux), or run `ollama-code` in a terminal. The app opens in its own browser window at `http://localhost:4317`. If Ollama is installed but not running, Ollama Code starts it for you.
2. **Check your setup.** If Ollama can't be reached or you have no models yet, the **System check** dialog opens by itself. It shows what your computer has and recommends a model. Click **Download** next to the recommended model and wait for it to finish, then click **Done**. You can open this dialog again at any time with **System check & models** at the bottom of the sidebar.
3. **Start a session.** Click **Start a session** (or **+ New session** in the sidebar).
   - **Project folder:** type the full path of your project, click one of the recent folders under the box, or click **Browse...** to pick it. In the folder browser, click a folder to open it, **↑ ..** to go up, and **Use this folder** to choose the folder you are in.
   - **Model:** pick one of your Ollama models. A note underneath tells you whether the model supports native tool calling (best) and how much context it was trained with.
   - **Permissions:** leave this on **Ask before edits & commands** while you are getting to know the app.
   - Click **Start**.
4. **Ask for something.** Type in the box at the bottom and press **Enter**. Some good first requests:
   - "Give me an overview of this project: what it does and how it is organized."
   - "Find where the configuration is loaded and explain it."
   - "Add a `--verbose` flag to the CLI in `src/cli.js` and update the help text."
5. **Watch it work.** Each tool the agent uses appears as a card in the conversation (Read, Grep, Edit, Bash, and so on). When it wants to change a file or run a command, the card shows exactly what it will do, with **Allow**, **Always allow ... (session)** and **Deny** buttons.
6. **Stop at any time** with the **Stop** button or the **Esc** key.

When the agent is done, it writes a short summary of what it changed.

## A tour of the window

### Sidebar (left)

- **+ New session** opens the New session dialog.
- **Sessions** lists all your sessions, most recently used first. Each entry shows the session title (taken from your first message), the project folder name and the model. A dot marks the session that is working. Click a session to open it. Click **✕** to delete it (you are asked to confirm, and its history is removed permanently).
- At the bottom:
  - **Ollama status.** "Ollama · 3 models" in green when Ollama is reachable, or "Ollama unreachable" in red. Hover over it to see the Ollama address or the error. It is refreshed every 15 seconds.
  - **System check & models** opens the System check dialog.
  - The app version.

### Session header (top)

- The session title and the full path of the project folder.
- **Model** selector: switch the model for this session. The change applies from the agent's next step.
- **Context** selector (`8k ctx` to `128k ctx`): the size of the model's context window for this session. See [The context window](#the-context-window).
- **Clear**: forget the conversation so far and start fresh in the same session. See [Clearing the conversation](#clearing-the-conversation).

### Conversation (middle)

- **Your messages** appear on the right.
- **Agent replies** are formatted text (Markdown, with code blocks).
- **Thinking**: models that "think out loud" before answering show a collapsible **Thinking** section. It is open while the model is thinking and collapsed afterwards. Click it to read it.
- **Tool cards** show each action:
  - The header shows the action (Read, Write, Edit, List, Glob, Grep, Bash, Update tasks), what it was applied to, and a short result such as "120 lines", "3 results", "exit code 0", "failed", "denied" or "not run".
  - Click the header to open or close the card. Edits show a before/after view (removed lines in red, added lines in green). Writes show the new file content. Commands show the command and its output.
  - Cards for edits and writes are open by default. Other cards open automatically if the tool fails (except commands, whose result is shown as the exit code in the header).
- **Notices** in grey (for example "Stopped by user." or "— context cleared —") and **errors** marked with a warning sign.
- **Working...** with a spinner while the agent is busy.

### Bottom area

- **Task list**: appears above the message box when the agent makes a plan. See [The task list](#the-task-list).
- **Message box**: type here. **Enter** sends; **Shift+Enter** adds a new line.
- **Permission mode** selector. See [Permissions](#permissions).
- **Context meter**, for example `context 6.2k / 16.4k · 23.5 tok/s`. See [The context window](#the-context-window).
- **Send** button, which turns into a red **Stop** button while the agent is working.

### System check dialog

Opened with **System check & models** or **System check** on the start screen. It shows the same checks as `ollama-code doctor`:

| Check | What it means |
|---|---|
| Node.js | Version 20 or newer is required |
| Operating system | Windows, macOS and Linux are supported |
| Memory | 16 GB or more is ideal; 8 to 16 GB works with smaller models; under 8 GB gets a stronger warning |
| GPU acceleration | Whether a GPU that Ollama can use was found (NVIDIA or AMD with 4 GB+, or Apple Silicon). Without one, models run on the CPU, which is slower. |
| Disk space | Enough free space for the recommended model plus 2 GB |
| Ollama installed | Whether the `ollama` program was found |
| Ollama server | Whether Ollama answers at its address, and its version (0.4.0 or newer is recommended for reliable tool calling) |
| Models | Which models you have, and whether any of them look like coding models |
| Git | Optional, but useful |

Below the checks:

- If Ollama is installed but not running, a **Start Ollama** button.
- If Ollama is not installed, a link to download it.
- Otherwise, the **recommended model** for this computer with a **Download** button (or "installed").
- **Download a model**: type any model name from the [Ollama library](https://ollama.com/library), for example `qwen2.5-coder:14b`, and click **Download**. A progress bar shows the download.
- **Re-check** runs the checks again. **Done** closes the dialog.

## Sessions

A session is one conversation about one project folder, with one model and one permission mode. You can have as many sessions as you like, including several for the same folder.

- **Saved automatically.** Everything in a session (your messages, the agent's replies, tool cards, the task list) is saved to disk as it happens. Close the window or restart your computer and the session is still there.
- **The window is just a view.** The agent runs inside the Ollama Code server, not in the window. If you close the window while the agent is working, it keeps going, and you can reopen the window to see where it got to. If it is waiting for your permission, it waits until you come back and answer.
- **Several sessions can work at once**, but they all share the same Ollama server and computer, so they slow each other down.
- **The title** is set from the first message you send.
- **The address** of an open session is `http://localhost:4317/#/s/<session id>`. Reloading the page brings you back to the same session.
- **Deleting** a session (the **✕** in the sidebar) removes its file. It does not undo any changes the agent made to your project.
- The New session dialog remembers the model and permission mode you used last time.

If Ollama Code itself is stopped or restarted while the agent is working, that piece of work is lost (the session and everything up to that point is kept). Send a message to continue.

## Permissions

The agent can only change things by using tools. Tools that only look at things never ask for permission. Tools that change files or run commands ask first, depending on the **permission mode**.

| Tool | Ask before edits & commands | Auto-accept edits | Bypass permissions |
|---|---|---|---|
| `read_file`, `list_dir`, `glob`, `grep`, `todo_write` | never asks | never asks | never asks |
| `write_file`, `edit_file` | asks | runs without asking | runs without asking |
| `bash` (run a command) | asks | asks | runs without asking |

You choose the mode when you create a session, and you can change it at any time with the selector next to the message box. The new mode applies from the next tool call.

When the agent wants to use a tool that needs approval, its card opens and shows:

- **Allow** (or press **Enter** while the message box is empty): run this one call.
- **Always allow commands / edits / writes (session)**: run this call, and don't ask again for this kind of tool in this session. This is remembered for the session even after a restart, and also after **Clear**. It applies to the tool as a whole: "Always allow commands" means every future command in this session runs without asking, whatever it is. To get asked again, start a new session.
- **Deny**: don't run it. The agent is told you said no and the current turn ends with the notice "Tool call denied. Tell the model what to do instead." Type what you would like it to do instead.

If you press **Stop** while a request is waiting, it counts as Deny.

**Use Bypass permissions with care.** In this mode the model can run any command your user account can run, without asking, including commands that delete files. Small local models make mistakes. Only use it in a folder you can restore (for example, one under git with everything committed) and keep an eye on it.

Note that the tools are not locked to the project folder. Paths are relative to the project folder, but the model can give a full path to any file your user account can read or write. In Ask mode you see and approve every write and command, wherever it points.

## The tools

The agent has eight tools. You don't call them yourself; the model decides when to use them. Knowing what they do helps you understand the tool cards and write better requests.

All paths can be relative to the project folder or absolute.

### read_file

Reads a text file and shows it with line numbers.

- Reads up to 2000 lines at a time (the model can ask for a different starting line and number of lines to read further).
- Very long lines are cut at 2000 characters.
- Files over 10 MB are refused. Binary files are reported as "(binary file, N bytes)" instead of being shown.

### write_file

Creates a new file, or replaces an existing file completely. Missing folders are created. Needs approval in *Ask* mode. The card shows the full new content.

### edit_file

Changes part of a file by replacing an exact piece of text (`old_string`) with new text (`new_string`). Needs approval in *Ask* mode. The card shows the old text in red and the new text in green.

- The old text must match the file exactly, including spaces and indentation. If it isn't found, the edit fails and the model is told to read the file again. See [edit_file says "old_string was not found"](TROUBLESHOOTING.md#edit_file-says-old_string-was-not-found).
- The old text must appear only once, unless the model asks to replace every occurrence.
- If the old text is empty, the new text is added to the end of the file.
- Windows line endings (CRLF) are handled: a file that uses them keeps them.

### list_dir

Lists the files and folders in a folder (folders first, up to 500 entries).

### glob

Finds files by name pattern, for example `**/*.ts` or `src/**/test_*.py`.

- A pattern without a `/` matches file names in any folder, so `*.md` finds every Markdown file.
- `{a,b}` matches either, for example `*.{js,ts}`.
- Results are sorted with the most recently changed files first; up to 300 are shown.
- On Windows, matching ignores upper and lower case.

### grep

Searches inside files with a regular expression (JavaScript syntax) and shows matching lines as `path:line: text`.

- Can be limited to files matching a pattern (for example `*.py`) and can ignore case.
- Skips binary files and files over 2 MB. Stops after 300 matches.

`glob` and `grep` skip these folders: `node_modules`, `.git`, `.hg`, `.svn`, `dist`, `build`, `out`, `.next`, `.nuxt`, `__pycache__`, `.venv`, `venv`, `.cache`, `coverage`, `target`, `.idea`, `.vs`, `.gradle`.

### bash

Runs a command in the project folder. Needs approval in *Ask* and *Auto-accept edits* modes.

- On Windows the command runs in **Windows PowerShell** (`powershell.exe`, without your PowerShell profile). On macOS and Linux it runs in **bash** as a login shell, so your usual `PATH` from `~/.profile` or `~/.bash_profile` is available.
- The command cannot read keyboard input, so interactive programs won't work.
- The default time limit is 2 minutes; the model can ask for up to 10 minutes. When the limit is reached, or you press **Stop**, the command and anything it started are ended.
- The output (normal and error output together) is passed to the model, shortened to about 30,000 characters by keeping the beginning and the end. The card shows the exit code.
- Commands that never finish on their own (like a development server) will hit the time limit. Ask the agent to run tests or builds instead, and start servers yourself.

### todo_write

Creates or updates the task list. See the next section.

What you see in a tool card is limited to the first 8000 characters of the output. The model sees more, as described above.

## The task list

For bigger jobs the agent writes a plan as a task list. The list appears above the message box:

- ○ not started
- ◐ in progress
- ✓ done

The agent updates the list as it works. When every task is done and the agent has finished, the list disappears after a few seconds. **Clear** also removes it. The task list is saved with the session.

The system prompt asks the model to make a task list for any job with three or more steps. Small models don't always do this; you can ask for it ("Make a plan with todo_write first").

## The context window

A model can only "see" a limited amount of text at once: its **context window**, measured in tokens (a token is roughly three or four characters of code or English). Everything has to fit: the instructions Ollama Code gives the model, any project instruction files, your messages, the agent's replies, and the output of every tool call.

### Choosing a size

Use the context selector in the session header: **8k**, **16k** (the default), **32k**, **64k** or **128k**.

- **Bigger** lets the agent keep more of the conversation and more file contents in view. It also uses much more memory (on the GPU, or in RAM) and makes each step slower. If the model no longer fits on your GPU, Ollama runs part of it on the CPU, which is a lot slower.
- **Smaller** is faster and lighter but the agent forgets earlier details sooner.
- 16k is a good start. Try 32k for bigger tasks if you have the memory.
- The size can never be larger than what the model was trained with. If you pick 128k for a model trained with 32k, 32k is used. The New session dialog shows each model's trained context.

The default for new sessions can be changed with `numCtx` in the [configuration](#configuration).

### The context meter

After each step, the meter next to the message box shows, for example:

```
context 9.8k / 16.4k · 21.3 tok/s
```

- **9.8k** is how many tokens the last step used (the text sent to the model plus its reply).
- **16.4k** is the context size actually in use (16k = 16,384 tokens).
- **21.3 tok/s** is how fast the model wrote its reply, in tokens per second. Under about 5 tok/s usually means the model is running on the CPU.

### What happens when it gets full

Ollama Code keeps the conversation inside the window automatically:

1. First, the output of **older** tool calls is shortened to a short preview, marked "[older tool output removed to save context]". The most recent messages are always kept in full.
2. If that is not enough, the **oldest** messages are dropped, starting from the beginning of the conversation.

Nothing is removed from what you see on screen; only what is sent to the model. But it means that on a long session the model may forget things from early on. When the meter stays close to full, or the agent seems confused about earlier steps, use **Clear** and give it a fresh summary, or pick a larger context.

## Clearing the conversation

**Clear** (in the header), or typing `/clear` in the message box and pressing Enter, makes the model forget the conversation so far:

- The model's memory of the conversation is emptied, and the task list is removed.
- The old messages stay visible on screen above a "— context cleared —" line, so you can still scroll back.
- The session keeps its folder, model, context size, permission mode and any "Always allow" choices.
- Project instruction files are still read (they are read again on every step).
- It does not undo any changes to your files.

Clear is not available while the agent is working; stop it first.

Clearing between unrelated tasks is one of the best ways to get good results from small models.

## Choosing a model

Any model you have in Ollama can be used, but agent work needs a model that is good at code and at **tool calling** (asking for tools in the structured way Ollama understands).

### Recommended models by memory

The System check, `ollama-code doctor` and the installers recommend one of these, based on how much memory the model can use on your computer:

| Usable memory | Recommended model | Download size (approx.) |
|---|---|---|
| 22 GB or more | `qwen2.5-coder:32b` | 20 GB |
| 11 GB or more | `qwen2.5-coder:14b` | 9 GB |
| 6 GB or more | `qwen2.5-coder:7b` | 4.7 GB |
| 3.5 GB or more | `qwen2.5-coder:3b` | 1.9 GB |
| less than 3.5 GB | `qwen2.5-coder:1.5b` | 1 GB |

"Usable memory" is worked out like this:

- **Apple Silicon Mac:** 65% of total memory (the GPU shares it). For example, 16 GB gives 10.4 GB, so `qwen2.5-coder:7b`.
- **Computer with an NVIDIA GPU** (or AMD with ROCm on Linux) with at least 3.5 GB: the GPU's memory.
- **Anything else:** half your RAM, but never more than 10 GB, because running on the CPU is slow. So without a supported GPU the recommendation is at most `qwen2.5-coder:7b`.

On Windows, AMD and Intel GPU memory cannot be measured reliably, so those computers are treated as having no GPU for the recommendation. Ollama may still use the GPU.

These are starting points. Bigger models are much better at multi-step work but slower. If a model is too slow, go one size down; if it makes too many mistakes and you have the memory, go one size up.

Other models that are known to do agent work well, if your hardware allows: `qwen3-coder`, `devstral`, `gpt-oss`. Browse the [Ollama library](https://ollama.com/library) for more, and look for models tagged "tools".

To download a model: use the System check dialog, `ollama-code pull <model>`, or `ollama pull <model>`.

### Native tool calling, and the fallback

- **Models with native tool calling** (the Ollama library marks them "tools") get the tool list directly from Ollama. This is the most reliable way, and what you should use when you can.
- **Models without native tool calling** still work, with a fallback: Ollama Code describes the tools in the instructions and asks the model to write each tool call as a small block of JSON in a ` ```tool ` fenced block. Ollama Code reads those blocks and runs them. When this happens you see the notice "*model* has no native tool calling, so tools are described in the prompt instead. Results may be less reliable." The New session dialog also warns you when you pick such a model.
- Some models have native tool calling but sometimes write the tool call as text anyway. Ollama Code also recognizes JSON tool calls written in ` ```json ` or ` ```tool ` code blocks, inside `<tool_call>...</tool_call>` tags, or as a reply that is nothing but the JSON, and runs them. Permissions still apply.

If a model keeps writing JSON in the chat instead of acting, or never uses tools, see [The model doesn't use tools](TROUBLESHOOTING.md#the-model-doesnt-use-tools-or-writes-json-in-the-chat).

## Project instruction files

You can give the agent standing instructions, such as how to build and test the project or which style to follow. Ollama Code adds the contents of these files to the model's instructions on every step:

| File | Applies to |
|---|---|
| `MEMORY.md` in your data folder (`~/.ollama-code/MEMORY.md`, or `%USERPROFILE%\.ollama-code\MEMORY.md` on Windows) | every session, every project |
| `OLLAMA.md` in the project folder | sessions in that folder |
| `CLAUDE.md` in the project folder | sessions in that folder |
| `AGENTS.md` in the project folder | sessions in that folder |

Details:

- All files that exist are used, in the order above. If a project has both `CLAUDE.md` and `AGENTS.md`, both are included.
- Only files directly in the project folder are read, not files in subfolders or parent folders.
- Each file is limited to its first 12,000 characters.
- They are read again on every step, so changes take effect straight away, without starting a new session.
- They count towards the context window. Keep them short and to the point, especially with small models and small context sizes.
- The model is told that these instructions come from you and take priority over its default behaviour.

An example `OLLAMA.md`:

```markdown
# Project notes
- This is a Python 3.12 project. Use the virtual environment in .venv.
- Run the tests with: .venv/bin/python -m pytest -q
- Code style: black, 100-character lines. Type hints on all public functions.
- Never edit files under migrations/ by hand.
```

## Command-line reference

The installer adds an `ollama-code` command. In a copy of the source code, use `node bin/ollama-code.js` instead.

```
ollama-code [start] [--no-open]
ollama-code stop
ollama-code doctor [--json] [--fix]
ollama-code pull <model>
ollama-code version
ollama-code help
```

| Command | What it does |
|---|---|
| `ollama-code` or `ollama-code start` | Starts the server and opens the app window. If Ollama is installed but not running, starts it too. If Ollama Code is already running, it just opens another window. The server keeps running until you stop it (Ctrl+C in that terminal, `ollama-code stop`, or closing its console window on Windows). |
| `ollama-code start --no-open` | Starts the server without opening a window. Open `http://localhost:4317` yourself. |
| `ollama-code stop` | Stops a running Ollama Code server, and any work in progress. Prints "Ollama Code is not running." if there is nothing to stop. |
| `ollama-code doctor` | Runs the system check and prints the results and the recommended model. Exits with code 0 if nothing is marked as a failure, or 2 if something is. |
| `ollama-code doctor --json` | Prints the full check results as JSON (useful for scripts and bug reports). |
| `ollama-code doctor --fix` | Starts Ollama if it is installed but not running, and downloads the recommended model if you don't have any coding model yet. Then runs the checks. |
| `ollama-code pull <model>` | Downloads a model with Ollama, showing Ollama's progress, for example `ollama-code pull qwen2.5-coder:14b`. Starts Ollama first if needed. |
| `ollama-code version` | Prints the version number. |
| `ollama-code help` | Shows the commands and the locations of the settings file and data folder. |

How the window is opened: on Windows, as an app window in Microsoft Edge, or Google Chrome, or your default browser. On macOS, as an app window in Google Chrome, or your default browser. On Linux, as an app window in Google Chrome or Chromium, or with your default browser.

Closing the app window does not stop the server. On Windows, the shortcuts start the server in a minimized console window titled "Ollama Code - close this window to stop". On macOS and Linux, the app shortcut runs it in the background: use `ollama-code stop` (or, on Linux, right-click the menu entry and choose **Stop Ollama Code**).

## Configuration

Ollama Code works without any configuration. To change the defaults, create a file called `config.json` in the data folder:

- Windows: `%USERPROFILE%\.ollama-code\config.json`
- macOS and Linux: `~/.ollama-code/config.json`

`ollama-code help` prints the exact path. All keys are optional:

```json
{
  "ollamaUrl": "http://127.0.0.1:11434",
  "port": 4317,
  "defaultModel": "qwen2.5-coder:14b",
  "numCtx": 16384,
  "maxIterations": 60,
  "temperature": 0.2
}
```

| Key | Default | What it does |
|---|---|---|
| `ollamaUrl` | `http://127.0.0.1:11434` | Address of the Ollama server. `http://` is added if missing; a trailing `/` is removed; `0.0.0.0` is treated as `127.0.0.1`. |
| `port` | `4317` | Port for the Ollama Code window and server (`http://localhost:<port>`). |
| `defaultModel` | none | Model selected in the New session dialog. The model you used last time (remembered by the browser) takes priority. |
| `numCtx` | `16384` | Context window for new sessions, in tokens. Each session can be changed in its header. |
| `maxIterations` | `60` | Maximum number of model steps for one message. When reached, the agent stops with "Stopped after 60 steps. Send a message to continue." |
| `temperature` | `0.2` | How random the model's answers are. Low values (0 to 0.3) are best for code. |

Environment variables override the file:

| Variable | Overrides | Notes |
|---|---|---|
| `OLLAMA_HOST` | `ollamaUrl` | The same variable the `ollama` command uses, so both talk to the same server. |
| `PORT` | `port` | Note: if you have `PORT` set for other software, Ollama Code uses it too. |
| `OLLAMA_CODE_MODEL` | `defaultModel` | |
| `OLLAMA_CODE_HOME` | (data folder location) | Moves the whole data folder, including `config.json`, sessions and `MEMORY.md`. |

Settings are read when Ollama Code starts. After changing them, run `ollama-code stop` and start it again.

If `config.json` contains a mistake (for example a missing comma), it is ignored completely and the defaults are used. Check it with a JSON validator if your settings seem to have no effect.

## Where your data is stored

| What | Where |
|---|---|
| Settings | `<data folder>/config.json` |
| Sessions (one file per session: conversation, tool calls and results, task list, permission choices) | `<data folder>/sessions/<session id>.json` |
| Personal instructions | `<data folder>/MEMORY.md` |
| Last-used model and permission mode for new sessions | the app window's browser storage |
| Models | Ollama's models folder (see [INSTALL.md](INSTALL.md#ollama-and-models)) |

The data folder is `~/.ollama-code` (`%USERPROFILE%\.ollama-code` on Windows) unless `OLLAMA_CODE_HOME` is set. Session files are plain JSON text and include the contents of files the agent read and the output of commands it ran. Treat them like your source code.

To back up your sessions, copy the data folder. To start completely fresh, stop Ollama Code and delete the folder.

## Keyboard shortcuts

| Key | Where | What it does |
|---|---|---|
| Enter | message box | Send the message |
| Shift+Enter | message box | New line |
| Enter | message box, when it is empty and a permission request is waiting | Allow the most recent request |
| Esc | anywhere, while the agent is working | Stop the agent |
| `/clear` then Enter | message box | Clear the conversation (same as the **Clear** button) |

## Getting good results from local models

Local models are much smaller than the big online assistants. They can do real work, but they need more help. These habits make a big difference:

- **Use the biggest model your computer runs at a comfortable speed.** A 14b or 32b model is far more reliable at multi-step work than a 3b or 7b one.
- **Prefer models with native tool calling.** The New session dialog tells you.
- **Give small, clear tasks.** "Add input validation to `parse_date` in `utils/dates.py` and a test for it" works much better than "improve the date handling".
- **Name files and functions** when you know them. It saves the model from searching and from guessing.
- **Write an `OLLAMA.md`** with how to build and run the tests, and any rules. Then you can say "run the tests and fix any failures".
- **Ask it to check its work**: "run the tests afterwards", "run the script to make sure it works".
- **Clear between tasks.** A fresh, short conversation keeps the model focused and fast.
- **Keep an eye on the context meter.** If it is near full, clear and summarize what matters, or increase the context size if you have the memory.
- **Use Ask mode while learning** what a model does well. Denying a bad edit and saying why ("don't rewrite the whole file, just change the loop") is quicker than undoing it.
- **Use git.** Commit before a big change so you can review the result with `git diff` and undo it easily.
- **Stop it early** if it goes in circles (repeating the same failing edit or command). Press Esc, explain what is wrong, and suggest the next step.
- **Smaller context is faster.** If 16k is enough for the task, don't use 64k.

## Security

Ollama Code can read and change files and run commands on your computer, so it is worth knowing how it protects you and where the limits are.

What it does:

- **Only reachable from your own computer.** The server listens on `127.0.0.1` (this computer) only. Other computers on your network cannot connect to it.
- **Blocks requests from websites.** Every request must be addressed to `localhost:<port>` or `127.0.0.1:<port>`, and requests that change something are refused if they come from any web page other than Ollama Code's own. This stops a web page you visit from sending commands to Ollama Code, including through DNS rebinding tricks.
- **Asks before changing anything** (in the default *Ask* mode). Reading and searching never ask; edits, new files and commands do, and you see exactly what will happen first.
- **No online services.** Your code and conversations are sent only to the Ollama server you configured, which is your own computer unless you changed it. The app window loads nothing from the internet.

What it does not do:

- **It has no password.** Any program running on your computer under any user account can talk to it on its port, just as it could run commands itself. Don't run Ollama Code on a shared computer where you don't trust the other users.
- **It does not sandbox the agent.** Commands run with your user account's permissions, and tools can reach files outside the project folder. Approvals are the safety net.
- **Models can be misled.** If the agent reads a file or command output that contains instructions (for example, a README in a downloaded project saying "run this script"), a model may follow them. This is one more reason to read commands before you allow them, particularly in projects you didn't write.
- **"Always allow commands" and Bypass mode remove the safety net.** Use them only in folders you can restore, and preferably with projects you trust.

To report a security problem, see [SECURITY.md](../SECURITY.md).

## FAQ

**Is Ollama Code made by Ollama or Anthropic?**
No. Ollama Code is an independent open-source project. It is not affiliated with, endorsed by or sponsored by Ollama or Anthropic. It uses Ollama to run models, and its design is inspired by Anthropic's Claude Code. "Ollama" and "Claude" are trademarks of their owners.

**Does my code leave my computer?**
No, unless you point Ollama Code at an Ollama server on another computer. Ollama Code talks only to the Ollama server.

**Do I need an internet connection?**
Only to install it and to download models. After that it works offline. See [Offline or air-gapped computers](INSTALL.md#offline-or-air-gapped-computers).

**Does it cost anything?**
No. It is free and open source, and local models have no usage fees.

**Can I use a model that isn't in the recommendation table?**
Yes, any model you have in Ollama. Models with native tool calling work best.

**Why is it slow?**
Most likely the model is running on the CPU, or is too big for your GPU, or the context is large. See [Slow responses](TROUBLESHOOTING.md#slow-responses-cpu-only-or-out-of-memory).

**Can the agent undo its changes?**
No, there is no undo button. Use git (or another backup) so you can review and undo changes yourself. Deleting a session does not undo its changes either.

**Why didn't it ask before reading my files?**
Reading, listing and searching never need approval in any mode. Only edits, writes and commands do.

**Why does the agent stop after a while with "Stopped after 60 steps"?**
That is a safety limit for one message. Send another message (for example "continue") to keep going, or raise `maxIterations` in the [configuration](#configuration).

**Can I use it from another computer, or my phone?**
Not directly; it only accepts connections from the computer it runs on. You can do the opposite: run Ollama Code on your laptop and Ollama on a more powerful computer. See [Using Ollama on another computer](INSTALL.md#using-ollama-on-another-computer).

**Can I change the port?**
Yes: `port` in `config.json` or the `PORT` environment variable. Then open `http://localhost:<new port>`.

**How do I rename a session?**
The title comes from your first message and can't currently be changed in the window.

**Does it read `CLAUDE.md` files written for Claude Code?**
Yes, `CLAUDE.md` and `AGENTS.md` in the project folder are read, as well as `OLLAMA.md`. See [Project instruction files](#project-instruction-files).

**Where are the logs?**
Ollama Code prints a few lines when it starts (in the terminal, or in the minimized console window on Windows). Errors during a session appear in the conversation. Installer logs are described in [TROUBLESHOOTING.md](TROUBLESHOOTING.md#installer-log-files).

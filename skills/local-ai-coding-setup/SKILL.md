---
name: local-ai-coding-setup
description: Set up a free, private AI coding model that runs on the user's own computer with Ollama. Checks the hardware (GPU memory, RAM, disk), picks the largest coding model that will actually run fast on it, installs Ollama, downloads and tests the model, and tunes the context size so it doesn't slow to a crawl. Use when the user wants to run an LLM locally, asks which model fits their GPU or Mac, wants to stop paying for AI coding tools, or their local model is very slow.
license: MIT
metadata:
  version: 1.0.0
  homepage: https://github.com/sasha-thecornerspore-dev/ollama-code
---

# Local AI coding setup

Get the user from "I want to run AI locally" to a working, fast, local coding model. Work through the steps in order. Show the user what you found at each step in plain language.

## Ground rules

- **Ask before installing anything or starting a large download.** Say what will be installed, roughly how big it is, and where it comes from.
- **Never run `sudo` or an admin prompt without the user's OK.** On Linux, the official Ollama installer asks for a password; tell the user before running it.
- Only download from the official sources named here (ollama.com, the official Ollama GitHub). Don't use third-party mirrors.
- If a command fails, show the error and adapt. Don't repeat the same failing command.

## Step 1: Check the hardware

Find the operating system first, then run the matching commands. If a GPU command isn't found, that just means no GPU of that kind; it isn't an error.

**Windows (PowerShell):**
```powershell
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB)
Get-PSDrive C | Select-Object @{n='FreeGB';e={[math]::Round($_.Free/1GB)}}
```
Without `nvidia-smi`, list the GPUs with `Get-CimInstance Win32_VideoController | Select-Object Name`. Don't trust that command's memory figure: it stops at 4 GB.

**macOS:**
```bash
uname -m                                   # arm64 = Apple Silicon
echo $(( $(sysctl -n hw.memsize) / 1073741824 )) GB RAM
df -h ~ | tail -1
```

**Linux:**
```bash
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo "no NVIDIA GPU"
rocm-smi --showmeminfo vram 2>/dev/null | head -5   # AMD
free -g | awk '/Mem:/ {print $2 " GB RAM"}'
df -h ~ | tail -1
```

## Step 2: Pick the model

Work out the **memory budget**:

- **NVIDIA GPU (or AMD with ROCm on Linux) with 4 GB or more:** the budget is the GPU memory (VRAM).
- **Apple Silicon Mac:** the budget is about 65% of total RAM, because GPU and CPU share memory.
- **No usable GPU:** the budget is half of RAM, at most 10 GB. Warn the user that it will run on the CPU and be noticeably slower.

Then pick from this table using the budget:

| Memory budget | Model | Download |
|---|---|---|
| 22 GB or more | `qwen2.5-coder:32b` | ~20 GB |
| 11 to 22 GB | `qwen2.5-coder:14b` | ~9 GB |
| 6 to 11 GB | `qwen2.5-coder:7b` | ~4.7 GB |
| 3.5 to 6 GB | `qwen2.5-coder:3b` | ~1.9 GB |
| under 3.5 GB | `qwen2.5-coder:1.5b` | ~1 GB |

Make sure there is enough free disk space for the download plus 2 GB. These models support native tool calling, which coding agents need. If the user asks for another model, check that its page on ollama.com lists "tools" before recommending it for agent work.

**Pick the context size too.** Picking the context size is the most common mistake. A long context needs extra memory on top of the model. If the total doesn't fit on the GPU, Ollama quietly moves part of the work to the CPU and speed falls off a cliff. Base the size on the **headroom**: the memory budget minus the model's download size.

| Headroom | Context (`num_ctx`) |
|---|---|
| 8 GB or more | 32768 |
| 5 to 8 GB | 16384 |
| 2.5 to 5 GB | 8192 |
| under 2.5 GB | 4096, or use one model size down |

Measured example: `qwen2.5-coder:14b` (9 GB) on a 12 GB NVIDIA card has 3 GB of headroom.

| Context | Where it runs | Speed |
|---|---|---|
| 8k | 100% on the GPU | 74 tokens/sec |
| 12k | 10% spills to the CPU | 36 tokens/sec |
| 16k | 16% spills to the CPU | 25 tokens/sec |
| 32k | 34% spills to the CPU | 13 tokens/sec |

The table is a starting point. Step 4 checks the real placement.

Tell the user your pick and why, in one or two sentences, before going on.

## Step 3: Install Ollama

Check whether it's already there with `ollama --version`. If it is, skip ahead to "Make sure the server is running" below. If it isn't, ask first, then:

- **Windows:** `winget install --id Ollama.Ollama -e`. Without winget, download `https://ollama.com/download/OllamaSetup.exe` and run it. This installs for the current user; no admin rights are needed.
- **macOS:** download `https://ollama.com/download/Ollama-darwin.zip`, unzip it, move `Ollama.app` to Applications and open it once. Homebrew users can run `brew install ollama` instead.
- **Linux:** `curl -fsSL https://ollama.com/install.sh | sh` (uses sudo, so tell the user first).

**Make sure the server is running:** `curl http://127.0.0.1:11434/api/version` should return a version. If it doesn't, start it with `ollama serve` (in the background), or on macOS by opening the Ollama app. Do this before Step 4: `ollama run` and `ollama pull` can hang without an error when the server isn't running.

## Step 4: Download and test the model

1. Tell the user the download size, then run `ollama pull <model>`.
2. Do a quick sanity test and measure speed:
   ```bash
   ollama run <model> --verbose "Write a Python function that reverses a string."
   ```
   Read the `eval rate` line at the end. 10+ tokens/sec is comfortable, 5 to 10 is usable, and under 5 is too slow (see Troubleshooting).
3. Check that it runs on the GPU **with the context size from Step 2**. `ollama run` uses a small default context, so load the model through the API with your chosen size, then look at `ollama ps`:
   ```bash
   curl -s http://127.0.0.1:11434/api/generate -d '{"model":"<model>","prompt":"Say hi.","stream":false,"options":{"num_ctx":8192}}'
   ollama ps
   ```
   The PROCESSOR column should say `100% GPU`. A split such as `16%/84% CPU/GPU` means it doesn't fit: halve `num_ctx` and check again. Check the CONTEXT column too.
4. Check tool calling (needed by coding agents):
   ```bash
   curl -s http://127.0.0.1:11434/api/chat -d '{"model":"<model>","stream":false,"messages":[{"role":"user","content":"What is the weather in Paris?"}],"tools":[{"type":"function","function":{"name":"get_weather","description":"Get weather for a city","parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}}}]}'
   ```
   Read the result carefully. There are three possible outcomes:
   - **`"tool_calls": [...]` in the message:** native tool calling works. Any agent can use it.
   - **The call written as JSON in `"content"`** (for example `{"name": "get_weather", ...}` as text): the model understood the request but didn't use the native format. `qwen2.5-coder` often does this in Ollama. Agents that read tool calls from text, such as Ollama Code, still work. Agents that only accept native tool calls won't. Tell the user, and if their tool needs native calls, try another tools-capable model with this same test.
   - **A plain-language answer with no call:** the model can't drive an agent. Use a bigger or different model.

   On Windows PowerShell, use `curl.exe` and put the JSON in a file (`-d "@body.json"`) to avoid quoting problems.

## Step 5: Connect it to a coding tool

Ollama serves the model at `http://127.0.0.1:11434`. Many tools also accept its OpenAI-compatible endpoint, `http://127.0.0.1:11434/v1` (any API key value works). Ask the user which coding tool they want to use, and point it at that address with the chosen model name. Set the context size to the Step 2 value wherever the tool allows. Ollama's own default is smaller than the model's maximum.

If the user has no coding tool yet and wants a free, local, ready-made one, [Ollama Code](https://github.com/sasha-thecornerspore-dev/ollama-code) is an open-source (MIT) desktop app built for exactly this setup. It has a one-click installer for Windows, macOS and Linux.

## Step 6: Report

Finish with a short summary:

- The hardware found (GPU and VRAM, RAM, free disk)
- The model chosen and why, plus the context size to use
- The measured speed (tokens/sec) and whether it runs fully on the GPU
- Anything left to do, such as a missing driver or low disk space

## Troubleshooting

- **Very slow, or much slower than in Step 4:** check `ollama ps` while the coding tool is running. Coding tools often ask for a bigger context than you tested, and a CPU share means it spilled. Set the tool's context to the Step 2 value, close other GPU-heavy apps (games, video editors, other models), or use one model size down.
- **`ollama run` or `ollama pull` sits forever with no output:** the Ollama server isn't running. Start it (Step 3).
- **"model requires more system memory":** the model is too big for this machine. Go one size down.
- **NVIDIA GPU not used:** update the NVIDIA driver, then restart Ollama.
- **The model doesn't call tools, or writes JSON into the chat instead:** smaller models (3b and under) are unreliable at tool calling. Use 7b or bigger for agent work.
- **The model repeats the same step over and over:** this happens with small local models, especially when the context is nearly full. Start a fresh conversation, give a more specific instruction, or use a larger model.
- **`curl` errors on Windows:** use `curl.exe`, not PowerShell's `curl` alias.

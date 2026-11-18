# Contributing to Ollama Code

Thanks for your interest in improving Ollama Code. Bug reports, documentation fixes and code changes are all welcome.

- To report a bug or ask for a feature, [open an issue](https://github.com/sasha-thecornerspore-dev/ollama-code/issues/new/choose).
- To report a security problem, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- For larger changes, please open an issue first to discuss the idea, so your work fits the project's direction.

## Development setup

You need:

- **Node.js 20 or newer** (CI tests 20, 22 and 24).
- **Ollama** with at least one model, to try the app for real. `qwen2.5-coder:7b` is a good choice for development.
- **Git.**

There are no npm dependencies, so there is no `npm install` step.

```bash
git clone https://github.com/sasha-thecornerspore-dev/ollama-code.git
cd ollama-code
npm start            # starts the server on http://localhost:4317 and opens the window
```

Useful while developing:

```bash
node bin/ollama-code.js start --no-open   # start without opening a window
node bin/ollama-code.js doctor            # system check
node bin/ollama-code.js stop              # stop a running server
```

The server serves the files in `public/` directly, so after changing the UI, just reload the window. After changing anything in `server.js`, `bin/` or `src/`, stop and start the server again.

To keep your development sessions separate from your normal ones, point the data folder somewhere else, and use another port if a normal install is running:

```bash
OLLAMA_CODE_HOME=/tmp/oc-dev PORT=4400 npm start
```

```powershell
$env:OLLAMA_CODE_HOME = "$env:TEMP\oc-dev"; $env:PORT = '4400'; npm start
```

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Runs `node bin/ollama-code.js start` |
| `npm run doctor` | Runs the system check |
| `npm test` | Runs the unit tests in `test/` with Node's built-in test runner (`node --test test/`) |
| `npm run icons` | Regenerates `public/icon-*.png` and `public/icon.ico` from the shapes in `tools/make-icons.js` (no dependencies). If you change the icon, update `public/icon.svg` to match. |
| `npm run package` | Builds the release files in `dist/`: `ollama-code.zip`, `ollama-code.tar.gz`, `install.ps1`, `install.sh` and `SHA256SUMS.txt`. Needs `tar`; on Linux it also needs `zip`. It fails if `LICENSE`, `README.md`, `CHANGELOG.md` or `docs/` is missing. |

To build the Windows setup program locally, install [Inno Setup 6](https://jrsoftware.org/isinfo.php) and run, from the repository root:

```powershell
iscc /DAppVersion=1.0.0 installer\windows\OllamaCode.iss
```

The result is `dist\OllamaCodeSetup.exe`.

To test the installers against your working copy, run them from the repository folder. They detect the checkout and install from it instead of downloading (see [Install from a local copy of the code](docs/INSTALL.md#install-from-a-local-copy-of-the-code)). `--check` / `-CheckOnly` reports without changing anything. On Linux, `bash installer/install.sh --yes --skip-ollama --skip-model --no-launch` is what CI runs.

## Project layout

```
bin/ollama-code.js         Command-line entry point: start, stop, doctor, pull, version, help
server.js                  HTTP API, server-sent event stream, static files, host/origin checks
src/agent.js               Agent loop, permission checks, context trimming, text-protocol fallback
src/tools.js               The 8 tools: definitions and implementations
src/prompt.js              System prompt, project instruction files, text tool protocol
src/parse.js               Extracts tool calls that models write as plain text
src/ollama.js              Small client for the Ollama HTTP API
src/store.js               Session files and event fan-out
src/config.js              Settings: config.json and environment variables
src/doctor.js              System checks, GPU detection, model recommendation
public/                    The UI: index.html, app.js, md.js (Markdown), style.css, icons
installer/install.ps1      Windows installer (also run by the setup program)
installer/uninstall.ps1    Windows uninstaller
installer/install.sh       macOS/Linux installer
installer/uninstall.sh     macOS/Linux uninstaller
installer/windows/OllamaCode.iss   Inno Setup script for OllamaCodeSetup.exe
tools/make-icons.js        Icon generator (npm run icons)
tools/package.js           Release packager (npm run package)
test/unit.test.js          Unit tests
docs/                      User documentation
.github/workflows/         CI (ci.yml) and release (release.yml)
```

## Guidelines

- **No runtime dependencies.** The app runs on plain Node.js (20+) and plain browser JavaScript. Please don't add npm packages; if you think one is really needed, discuss it in an issue first.
- **ES modules**, modern JavaScript, and the existing code style: 2-space indentation, single quotes, semicolons.
- **Cross-platform.** Everything must work on Windows, macOS and Linux. Be careful with paths (use `path`), line endings, shells (the `bash` tool uses PowerShell on Windows) and process handling.
- **Keep it safe by default.** Changes that affect permissions, the host/origin checks, or which tools need approval need a clear explanation in the pull request.
- **Small models matter.** Prompts and tool descriptions should be short and unambiguous. If you change them, try the change with a small model (for example a 7b model) as well as a larger one.
- **Add or update tests** for changes to tools, parsing, glob matching and similar logic. UI changes are tested by hand; describe what you checked.
- **Update the docs** (`docs/`, `README.md`) when you change behaviour, options or commands.
- **Add a line to `CHANGELOG.md`** under `## [Unreleased]` for user-visible changes.
- Installer scripts must pass `bash -n` and `shellcheck -S warning` (macOS/Linux) and parse cleanly in PowerShell; CI checks this.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests where it makes sense.
3. Run `npm test`.
4. Try the app by hand for anything that affects the UI, the agent loop or the installers.
5. Open a pull request and fill in the template. CI runs the tests on Windows, macOS and Linux with Node 20, 22 and 24, and checks the installers.

## How releases are made

Releases are built by the GitHub Actions workflow in `.github/workflows/release.yml` when a tag starting with `v` is pushed. Maintainers:

1. Update `version` in `package.json` (for example `1.1.0`).
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [1.1.0] - YYYY-MM-DD` (and add a new empty `## [Unreleased]` section above it). The heading must start with `## [1.1.0]` exactly: the workflow copies the text under it into the release notes.
3. Commit both files, for example `git commit -am "Release 1.1.0"`, and push to `main`.
4. Tag and push the tag:

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

The workflow then:

- checks that the tag matches the version in `package.json` (and stops if not),
- runs `npm test` and `npm run package`,
- builds `OllamaCodeSetup.exe` with Inno Setup on Windows,
- creates `SHA256SUMS.txt` for all files,
- creates the GitHub release `vX.Y.Z` with the CHANGELOG notes plus install instructions, and attaches `OllamaCodeSetup.exe`, `ollama-code.zip`, `ollama-code.tar.gz`, `install.ps1`, `install.sh` and `SHA256SUMS.txt`.

A release for an existing tag can also be built by running the workflow manually (*Actions > Release > Run workflow*) and entering the tag.

The installers download from the `latest` release by default, so a new release reaches users as soon as it is published.

## License

By contributing, you agree that your contributions are licensed under the same license as the project (see [LICENSE](LICENSE)).

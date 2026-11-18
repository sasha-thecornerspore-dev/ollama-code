# Security policy

Ollama Code can read and change files and run shell commands on the computer it runs on. We take reports about ways to misuse that seriously.

## Reporting a vulnerability

**Please don't report security problems in public issues, discussions or pull requests.**

Report them privately through GitHub:

1. Go to the repository's [Security tab](https://github.com/sasha-thecornerspore-dev/ollama-code/security).
2. Click **Report a vulnerability**.
3. Describe the problem, how to reproduce it, which version and operating system you used, and what an attacker could do with it.

You should get a first reply within a week. We will keep you updated while we work on a fix, and credit you in the release notes if you would like.

## Supported versions

Security fixes are made for the latest release. Please check that the problem still exists in the latest release before reporting it. Updating is described in [docs/INSTALL.md](docs/INSTALL.md#updating).

## Threat model

This summary explains what Ollama Code is designed to protect against, so you can judge whether something is a vulnerability.

### What Ollama Code protects

- **Remote access.** The server listens on `127.0.0.1` only, so other computers cannot connect to it.
- **Malicious websites.** Requests are refused unless the `Host` header is `localhost:<port>` or `127.0.0.1:<port>` (this blocks DNS rebinding), and any request other than `GET` that carries an `Origin` header must come from the Ollama Code page itself (this blocks cross-site request forgery). The server sends no CORS headers, so other web pages cannot read its responses.
- **Unapproved changes.** In the default *Ask* mode, every file write, file edit and shell command proposed by the model needs the user's approval, and the user sees the exact change or command first. Read-only tools (reading, listing, searching, updating the task list) never need approval.
- **Data leaving the computer.** Ollama Code sends conversations and file contents only to the configured Ollama server. The UI loads no external resources.

Ways around any of these (for example, a website that can make Ollama Code run a command, a way for the model to run a command or change a file in *Ask* mode without approval, or path tricks in the static file server) are vulnerabilities. Please report them.

### What is out of scope

These are known limits of the design, not vulnerabilities:

- **Local programs and users.** There is no authentication. Any program running on the same computer can use the API, just as it could run commands itself. On shared multi-user machines, other local users can reach the port too.
- **No sandbox.** Tools run with the user's own permissions and can reach files outside the project folder. Approvals are the protection, not a sandbox.
- **Choices the user makes.** Actions taken in *Auto-accept edits* or *Bypass permissions* mode, after "Always allow", or after the user approved them.
- **Model behaviour.** The model producing harmful or wrong commands or edits, including because of instructions hidden in files or command output it read (prompt injection). The user is expected to review requests before approving them. (A way for such content to bypass the approval step would be in scope.)
- **Remote Ollama servers.** If the user points Ollama Code at an Ollama server on another computer, securing that server and the network is up to the user.
- **Session files.** Session history is stored as plain JSON in the user's data folder and is protected by normal file permissions.
- **Problems in Ollama, Node.js or the browser** themselves. Please report those to their projects.

The installers download Node.js (verified against nodejs.org's published SHA-256 checksums), Ollama (from ollama.com, via winget, or with Ollama's official Linux script) and the app (from this repository's GitHub releases). Release files have SHA-256 checksums in `SHA256SUMS.txt`. The Windows setup program is not code-signed.

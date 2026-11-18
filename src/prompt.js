import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TOOL_DEFS, SHELL_NAME } from './tools.js';
import { config } from './config.js';

const MEMORY_FILES = ['OLLAMA.md', 'CLAUDE.md', 'AGENTS.md'];

function loadMemory(cwd) {
  const parts = [];
  const userFile = path.join(config.dataDir, 'MEMORY.md');
  for (const f of [userFile, ...MEMORY_FILES.map((m) => path.join(cwd, m))]) {
    try {
      const txt = fs.readFileSync(f, 'utf8').trim();
      if (txt) parts.push(`## ${f}\n${txt.slice(0, 12000)}`);
    } catch {
      /* missing */
    }
  }
  return parts.length
    ? `\n# Project and user instructions\nThese instructions come from the user and override the defaults above.\n\n${parts.join('\n\n')}\n`
    : '';
}

export function textToolProtocol() {
  const specs = TOOL_DEFS.map((t) => {
    const f = t.function;
    return `- ${f.name}: ${f.description}\n  parameters: ${JSON.stringify(f.parameters.properties)}\n  required: ${JSON.stringify(f.parameters.required || [])}`;
  }).join('\n');
  return `
# Calling tools
You can use these tools:
${specs}

To call a tool, reply with a fenced block in exactly this format and nothing after it:
\`\`\`tool
{"name": "read_file", "arguments": {"path": "src/index.js"}}
\`\`\`
You can put several tool blocks in one reply. Then stop and wait: the results come back in the next message. When you are completely done, reply with plain text and no tool block.
`;
}

function windowsDrives() {
  if (process.platform !== 'win32') return '';
  const drives = [];
  for (let c = 67; c <= 90; c++) if (fs.existsSync(`${String.fromCharCode(c)}:\\`)) drives.push(`${String.fromCharCode(c)}:\\`);
  return `\n- Drives on this computer: ${drives.join(', ')}. When the user names a drive by letter ("on d", "d:"), use that drive, e.g. D:\\. Don't assume C:.`;
}

export function buildSystemPrompt(session, textMode) {
  const date = new Date().toISOString().slice(0, 10);
  return `You are Ollama Code, an autonomous software engineering agent running locally on the user's machine. You help with coding tasks by using tools to read, search, edit and run code in the user's project.

# Environment
- Working directory: ${session.cwd}
- Platform: ${process.platform} (${os.release()}), shell for the bash tool: ${SHELL_NAME}
- Today's date: ${date}${windowsDrives()}

# How to work
- Act, don't just describe. Use the tools to look at real files instead of guessing what they contain.
- Explore first: use glob, grep and list_dir to find relevant code, then read_file before you change anything.
- Make targeted changes with edit_file. old_string must be copied exactly from the file. Use write_file only for new files or full rewrites.
- For any task with 3 or more steps, call todo_write first with a plan, then keep it updated as each step finishes.
- After changing code, verify it: run the build, tests or the script with bash when you can. Fix what fails.
- Paths may be relative to the working directory. Users often describe paths loosely ("d sasha documents repos"). If a path isn't found, don't give up: read the error's suggestions, then list_dir the parent folders to find the closest real match.
- Do not run destructive commands (deleting files or folders, git reset --hard, force-push) unless the user asked for them.
- You run the tools yourself. Never ask the user to run commands or to send you tool results, and never invent tool output: wait for the real result.
- If a tool call is denied, do not repeat it. Ask the user how to proceed.

# Replies
- Be concise and direct. Use GitHub-flavored markdown.
- Refer to code as path:line.
- When finished, give a short summary of what changed and anything left unverified.
${textMode ? textToolProtocol() : ''}${loadMemory(session.cwd)}`;
}

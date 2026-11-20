# Skills

Agent skills (`SKILL.md` files) that work in Claude Code, Codex CLI, Cursor and other agents that support the skills format. They're free and MIT-licensed, like the rest of this repo.

| Skill | What it does |
|---|---|
| [local-ai-coding-setup](local-ai-coding-setup/SKILL.md) | Checks your hardware, picks the coding model and context size that will run fast on it, installs Ollama, then downloads and tests the model. |

## Install a skill

Copy the skill's folder into your agent's skills folder. For Claude Code that's `~/.claude/skills/` (all projects) or `.claude/skills/` (one project):

```bash
git clone --depth 1 https://github.com/sasha-thecornerspore-dev/ollama-code.git
```

```bash
cp -r ollama-code/skills/local-ai-coding-setup ~/.claude/skills/
```

Then ask your agent something like *"set up a local AI coding model on this computer"*.

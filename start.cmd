@echo off
rem Starts Ollama (if needed) and Ollama Code, then opens it as an app window.
cd /d "%~dp0"
curl -s -o nul http://127.0.0.1:11434/api/tags || (
  echo Starting Ollama...
  start "" /min ollama serve
  timeout /t 3 /nobreak >nul
)
node server.js --open

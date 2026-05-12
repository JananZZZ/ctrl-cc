# 05 PTY and Claude CLI Rules — PTY与Claude CLI规则

## Interactive vs Structured
- **Interactive Chat**: PTY + `claude`
- **Structured tasks**: `claude -p --output-format stream-json`

Do NOT use `claude -p` to impersonate current interactive Chat.

## Windows Shell Strategy
Never assume cmd.exe works. Strategy matrix:
1. User override  2. PowerShell + claude.ps1  3. pwsh
4. cmd + claude.cmd  5. Direct executable  6. Node package entry

Every strategy must pass: shell echo → claude --version → PTY echo

## Discovery
Check: `where claude`, `where claude.cmd`, `where claude.ps1`, `powershell Get-Command claude`, `npm prefix -g`, `%APPDATA%\npm`

## Composer Ready Gate
Disable ChatComposer until session.status is: `pty-ready`, `claude-launching`, `claude-active`, `idle`, `waiting-permission`. Do NOT append user bubbles before successful send.

## Message Status
`type ChatMessageStatus = "sending" | "sent" | "failed"`

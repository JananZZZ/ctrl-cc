# 02 RuntimeBridge Contract — 运行时桥接合约

## Public frontend API (only these from UI surfaces)

```ts
RuntimeBridge.startInteractiveSession(input)
RuntimeBridge.write(uiSessionId, data)
RuntimeBridge.ctrlC(uiSessionId) / ctrlD(uiSessionId)
RuntimeBridge.resize(uiSessionId, rows, cols)
RuntimeBridge.stop(uiSessionId) / restart(uiSessionId)
RuntimeBridge.runStructuredTask(input)
RuntimeBridge.openWorkspace(uiSessionId)
RuntimeBridge.getSession(uiSessionId)
RuntimeBridge.getDiagnostics()
```

## FORBIDDEN from UI surfaces

Never call these from Projects/Workspace/Chat/Console/Dock/Resources:
```
invoke("pty_start_claude") / invoke("pty_write") / invoke("pty_resize") / invoke("pty_stop")
invoke("pty_start_claude_session") / invoke("pty_v2_write") / invoke("pty_v2_resize")
invoke("pty_send_ctrl_c") / invoke("pty_v2_stop") / invoke("structured_run")
```
Only RuntimeBridge adapters may call backend commands.

## ID Contract

- `UiSessionId` = frontend session ID (ses-xxx)
- `PtySessionId` = backend PTY registry ID
- `ClaudeSessionId` = Claude Code native session ID

RuntimeBridge.write() maps UiSessionId → PtySessionId internally.

## New Session Rule

```
create RuntimeSession → open Workspace tab → navigate → background PTY
```
Never wait for Claude readiness before opening Workspace.

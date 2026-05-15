# Ctrl-CC Runtime Contracts v25

## ID Contract

- UiSessionId (ses-xxx) ≠ PtySessionId (pty-uuid) ≠ ClaudeSessionId ≠ TraceId (trace-uuid)
- Backend registry key = PtySessionId (pty-uuid), not UiSessionId (ses-xxx)

## Channel Lifecycle

Chat: created → starting → running → stopped/failed/exited
Terminal: created → starting → ready → running → stopped/failed/exited
Background: created → starting → running → stopped/failed/exited

## Session Lifecycle

created → idle → running → waiting-approval → failed/stopped/archived

## RuntimeKernel Contract

UI calls only: createSession, sendChat, startTerminal, stopChannel, cancel
UI NEVER calls: invoke() directly, writes runtimeStore directly

## Provider Contract

ProviderRuntime: createSession, sendChat, startTerminal, stopChannel
Provider owns: CLI resolution, stream parsing, error classification, history hydration

## Forbidden Operations

1. Direct Tauri invoke from UI components
2. Chat and Terminal sharing lifecycle
3. Extensionless npm shim execution on Windows
4. Fake Claude session IDs
5. Store mutation during React render
6. Raw diagnostic matrix exposed to normal users

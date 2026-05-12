# 04 Tauri Rust Backend Rules — Rust 后端规则

## Command Rules — Tauri commands must return quickly
Forbidden inside Tauri commands:
1. `child.wait()`
2. blocking reader loop
3. long filesystem scan
4. waiting for Claude ready
5. waiting for PTY output
6. holding Mutex while reading/waiting/emitting

Long tasks must run in background thread/task.

## PTY Rules
Backend PTY session is valid only after ALL of:
1. openpty success
2. spawn selected shell success
3. writer acquired
4. reader thread started
5. session handle inserted into registry

Only then emit `pty-ready`. Spawn failure must return Err + RuntimeEvent error. No fake `process-created`.

## Registry
PTY registry key must be PtySessionId.

## Mutex Rules
Lock only for short mutation/read. Never hold lock during: read loop, wait, emit, filesystem scan, process kill wait.

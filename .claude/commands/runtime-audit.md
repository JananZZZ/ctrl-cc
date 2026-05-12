# /runtime-audit — Runtime 审计

Run: `rg "invoke\(\"pty_\|invoke\('pty_\|pty_v2_\|pty_start_\|RuntimeBridge\|structured_run" src src-tauri`

Report: all direct PTY invokes outside adapters, duplicate runtime paths, UI session id vs PTY session id mapping, backend session registry key, write path, stop path, error event path.

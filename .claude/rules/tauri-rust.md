# Tauri Rust Backend Rules
- Commands return quickly (< 1s)
- No child.wait() / reader loop / Mutex-hold-read in commands
- PTY valid only after: openpty → spawn → writer → reader → registry
- No fake process-created after spawn failure
- Registry key must be PtySessionId

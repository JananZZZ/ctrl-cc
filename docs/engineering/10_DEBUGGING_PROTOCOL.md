# 10 Debugging Protocol — 调试协议

## Debug Order (never debug everything at once)
1. React stability → 2. Runtime discovery → 3. Shell strategy → 4. claude --version
5. PTY shell echo → 6. Backend session registry → 7. Claude interactive launch
8. ChatComposer write → 9. ErrorLog/Diagnostic bundle → 10. Stop/orphan cleanup

## Required Before Making Fixes
State: observed symptom, failing layer, suspected root cause, files to inspect, exact search commands, expected invariant, proposed fix, validation plan

## Runtime Issue Classification
`react-loop`, `route-loop`, `event-flood`, `pty-spawn-failed`, `shell-strategy-failed`, `claude-not-found`, `session-id-mismatch`, `writer-not-registered`, `composer-not-ready`, `error-not-recorded`, `orphan-process`

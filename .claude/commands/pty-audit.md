# /pty-audit — PTY 生命周期审计

Check: openpty → spawn selected shell → writer acquisition → reader thread start → registry insert → pty-ready emit → write → resize → ctrl-c → stop → orphan cleanup.

No pty-ready before writer is registered. No fake process-created after spawn failure.

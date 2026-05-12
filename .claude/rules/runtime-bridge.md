# RuntimeBridge Rules
- All surfaces use RuntimeBridge. No direct PTY/Claude invoke.
- RuntimeKernel owns discovery, shell strategy, PTY lifecycle.
- ChatComposer writes through RuntimeBridge.write(uiSessionId, text).
- Never `claude -p` for interactive chat.
- PTY raw output → xterm only, not React state.

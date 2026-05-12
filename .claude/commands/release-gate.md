# /release-gate — 发布门禁

Before release:
1. Run /stability-check
2. Run /react-audit
3. Run /runtime-audit
4. Run /pty-audit
5. Manual smoke test: New Session → Workspace → Terminal shows Claude → ChatComposer sends → Ctrl+C → Stop → No orphans
6. Diagnostic Bundle generates correctly
7. `npm run tauri:build` succeeds

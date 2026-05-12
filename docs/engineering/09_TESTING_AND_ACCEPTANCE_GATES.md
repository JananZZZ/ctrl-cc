# 09 Testing and Acceptance Gates — 测试与验收门禁

## Required Commands After Code Changes
```bash
npm run typecheck && npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Runtime Smoke Tests
1. App launch  2. No React #185  3. Diagnostics opens  4. Shell strategy matrix
5. Claude discovery finds candidate  6. claude --version succeeds  7. New Session < 1s
8. Backend ptySessionId registered  9. ChatComposer disabled until ready
10. Send succeeds or marks failed  11. Ctrl+C works  12. Stop kills child  13. No orphan
14. ErrorLog contains runtime errors  15. Diagnostic Bundle copy works

## Completion Rule
If any acceptance gate fails, do not claim success.

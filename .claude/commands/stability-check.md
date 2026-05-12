# /stability-check — 稳定性检查

Run: `npm run typecheck && npm run build && cargo check --manifest-path src-tauri/Cargo.toml`

Verify: App launches, No React #185, New Session < 1s, ChatComposer disabled until ready, Runtime discovery result visible, ErrorLog records runtime errors, Stop kills child process.

# /preflight — 开发前检查清单

Before editing code:
1. Read CLAUDE.md.
2. Read docs/engineering/00_READ_FIRST.md.
3. Identify touched layer (App Shell / RuntimeBridge / RuntimeKernel / Interaction / Structured / Telemetry / Governance / Observability / Performance / Recovery).
4. Run targeted `rg` searches.
5. Report: existing implementation, duplicate systems, direct PTY invokes, unsafe useEffect, unbounded stores, missing error events.
6. Only then modify code.

# 01 Architecture Principles — 架构原则

Ctrl-CC is a Stability-First Desktop Runtime Platform.

## Layers

1. **App Shell** — Windows, layout, navigation, theme, global error boundaries. Must not spawn PTY or Claude.
2. **RuntimeBridge** — Only public API used by UI surfaces. Owns stable frontend contract.
3. **RuntimeKernel** — Owns Claude discovery, shell strategy, PTY lifecycle, process registry, watchdog.
4. **Interaction Plane** — Real PTY and terminal interaction. Claude interactive sessions run here.
5. **Structured Plane** — `claude -p`, stream-json, batch tasks. Must not impersonate interactive chat.
6. **Telemetry Plane** — statusLine, hooks, transcript, git/file/process watcher.
7. **Governance Plane** — permissions, risk, audit, session replay, resource activation.
8. **Observability Plane** — events, traces, logs, diagnostics, health center.
9. **Performance Plane** — throttling, debouncing, virtualization, bounded stores.
10. **Recovery Plane** — error boundaries, safe mode, circuit breakers, watchdog, orphan cleanup.

## Rule

**No feature may bypass RuntimeBridge or write directly to PTY/Claude from UI surfaces.**

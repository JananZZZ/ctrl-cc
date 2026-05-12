# 06 Observability and Diagnostics — 可观测性与诊断

## Event Schema
```ts
interface RuntimeEvent { id, traceId, ts, source, type, level, sessionId?, projectId?, message, payload? }
```

## Error Unification
All errors must enter: RuntimeEventStore → ErrorLog → Session Timeline → Diagnostic Bundle. No top-only error. No hidden error.

## Bounded Logs
- RuntimeEvent max 200
- ErrorLog max 200
- PTY tail max 32 KB/session
- Raw PTY full log → file only

## Diagnostic Bundle
Must include: app version, OS, WebView2 version, route, React last error, render loop guard result, runtime sessions, shell strategy matrix, claude discovery, last 200 RuntimeEvents, last 32KB PTY tail, raw log path, orphan processes, settings snapshot

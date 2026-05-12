# 07 Performance Budget — 性能预算

## UX Budget
- Button feedback < 100ms
- Navigation response < 100ms
- Workspace tab open < 1s
- App initial interactive < 2s

## Store Budget
- RuntimeEvent max 200
- ErrorLog max 200
- PTY tail max 32KB/session
- No list > 500 DOM rows without virtualization
- No raw PTY stream in React list

## Event Budget
- Resize debounce ≥ 100ms
- Search debounce ≥ 150ms
- Snapshot interval ≥ 1000ms
- PTY tail coalesce ≥ 100ms

## Lazy-load
xterm, graph views, diagnostics bundle viewer, resource scanner, replay viewer

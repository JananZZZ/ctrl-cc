# 03 React Stability Rules — React 稳定性规则

## Forbidden
1. No store writes during render
2. No navigation during render
3. No Runtime start during render
4. No useEffect without stable dependencies
5. No useEffect that updates its own dependencies
6. No selector returning new object unless using shallow
7. No unbounded event list in React state
8. No raw PTY chunk list in React state

## Required
1. All store actions must be idempotent (`if (state.x === next) return state`)
2. All intervals must cleanup
3. All Tauri listeners must unlisten
4. Expensive derived data → `useMemo`
5. Callbacks to memoized children → `useCallback`
6. ErrorBoundary at: App, Surface, Panel, Widget levels

## Idempotent Store Template
```ts
setMode: (next) => set((state) => {
  if (state.mode === next) return state;
  return { mode: next };
});
```

## Selector Rule
BAD: `const data = useStore((s) => ({ a: s.a, b: s.b }));`
GOOD: `const a = useStore((s) => s.a); const b = useStore((s) => s.b);`

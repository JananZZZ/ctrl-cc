# React Stability Rules
- No store writes during render
- All store actions idempotent
- useEffect dependencies must be stable
- No unbounded event arrays in React state
- ErrorBoundary at App/Surface/Panel/Widget levels
- RenderLoopGuard on all top-level components

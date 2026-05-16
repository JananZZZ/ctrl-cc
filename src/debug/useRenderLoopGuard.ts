import { useEffect, useRef } from 'react';

const renderCounters = new Map<string, { count: number; firstTs: number; warned: boolean }>();

export function useRenderLoopGuard(name: string, limit = 80, windowMs = 1000) {
  const nameRef = useRef(name);
  const now = performance.now();
  const current = renderCounters.get(nameRef.current);

  if (!current || now - current.firstTs > windowMs) {
    renderCounters.set(nameRef.current, { count: 1, firstTs: now, warned: false });
  } else {
    current.count += 1;
    if (current.count >= limit && !current.warned) {
      current.warned = true;
      console.trace(`[RenderLoopGuard] ${nameRef.current} rendered ${current.count} times within ${windowMs}ms`);
      try {
        localStorage.setItem('ctrlcc:render-loop', JSON.stringify({
          component: nameRef.current,
          count: current.count,
          windowMs,
          ts: new Date().toISOString(),
        }, null, 2));
      } catch {}
    }
  }

  useEffect(() => () => { renderCounters.delete(nameRef.current); }, []);
}

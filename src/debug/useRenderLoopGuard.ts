// useRenderLoopGuard — 抓 React #185 死循环组件
// 60次/1000ms 渲染 → 记录 localStorage → 超 limit+20 → throw Error
import { useEffect, useRef } from 'react';

const renderCounters = new Map<string, { count: number; firstTs: number }>();

export function useRenderLoopGuard(name: string, limit = 60, windowMs = 1000) {
  const nameRef = useRef(name);
  const now = performance.now();
  const current = renderCounters.get(nameRef.current);

  if (!current || now - current.firstTs > windowMs) {
    renderCounters.set(nameRef.current, { count: 1, firstTs: now });
  } else {
    current.count += 1;

    if (current.count === limit) {
      console.trace(`[RenderLoopGuard] ${nameRef.current} rendered ${limit} times within ${windowMs}ms`);
      try {
        localStorage.setItem('ctrlcc:render-loop', JSON.stringify({
          component: nameRef.current, count: current.count, windowMs,
          ts: new Date().toISOString(),
        }, null, 2));
      } catch {}
    }

    if (current.count > limit + 20) {
      throw new Error(`[RenderLoopGuard] ${nameRef.current} render loop detected`);
    }
  }

  useEffect(() => {
    return () => { renderCounters.delete(nameRef.current); };
  }, []);
}

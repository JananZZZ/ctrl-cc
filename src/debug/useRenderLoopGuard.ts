import { useEffect, useRef } from 'react';

type GuardState = {
  count: number;
  start: number;
};

const states = new Map<string, GuardState>();

export function useRenderLoopGuard(name: string, limit = 120, windowMs = 1000) {
  const nameRef = useRef(name);

  const now = performance.now();
  const current = states.get(nameRef.current);

  if (!current || now - current.start > windowMs) {
    states.set(nameRef.current, { count: 1, start: now });
  } else {
    current.count += 1;
    if (current.count > limit) {
      const payload = {
        name: nameRef.current,
        count: current.count,
        windowMs,
        at: new Date().toISOString(),
      };

      queueMicrotask(() => {
        try {
          localStorage.setItem('ctrlcc:render-loop', JSON.stringify(payload));
        } catch {
          // ignore
        }
      });

      console.error(
        `[Ctrl-CC] Render loop suspected in ${nameRef.current}: ${current.count} renders/${windowMs}ms`
      );
    }
  }

  useEffect(() => {
    return () => {
      states.delete(nameRef.current);
    };
  }, []);
}

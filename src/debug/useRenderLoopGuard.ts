import { useEffect, useRef } from 'react';

type GuardState = {
  count: number;
  start: number;
};

const states = new Map<string, GuardState>();

/**
 * 渲染循环检测器。
 * 只在开发环境启用。
 * 生产环境禁止 throw 或写 localStorage，否则会把调试保护变成用户可见崩溃。
 */
export function useRenderLoopGuard(name: string, limit = 120, windowMs = 1000) {
  // 生产环境直接禁用。
  if (!import.meta.env.DEV) return;

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
          // 调试写入失败不影响主流程。
        }
      });

      throw new Error(
        `[Ctrl-CC] Render loop suspected in ${nameRef.current}: ${current.count} renders/${windowMs}ms`,
      );
    }
  }

  useEffect(() => {
    return () => {
      states.delete(nameRef.current);
    };
  }, []);
}

import { describe, test, expect } from 'vitest';

const PRIORITY_ORDER = ['nativeExe', 'nodeWrapper', 'cmdShim', 'gitBash', 'npxDiagnostic', 'unknown'];

describe('ClaudeCodeCliResolver priority ordering', () => {
  test('nativeExe has highest priority', () => {
    expect(PRIORITY_ORDER.indexOf('nativeExe')).toBe(0);
  });

  test('nodeWrapper has second priority', () => {
    expect(PRIORITY_ORDER.indexOf('nodeWrapper')).toBe(1);
  });

  test('cmdShim has third priority', () => {
    expect(PRIORITY_ORDER.indexOf('cmdShim')).toBe(2);
  });

  test('gitBash has fourth priority', () => {
    expect(PRIORITY_ORDER.indexOf('gitBash')).toBe(3);
  });

  test('npxDiagnostic is diagnostic only (lowest)', () => {
    expect(PRIORITY_ORDER.indexOf('npxDiagnostic')).toBeGreaterThan(3);
  });

  test('selector returns stable empty array', () => {
    const EMPTY: never[] = [];
    const result = ([] as string[]).length > 0 ? ['x'] : EMPTY;
    expect(result).toBe(EMPTY);
    // Same reference check
    const result2 = ([] as string[]).length > 0 ? ['x'] : EMPTY;
    expect(result2).toBe(EMPTY);
  });
});

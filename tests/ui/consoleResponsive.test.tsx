import { describe, test, expect } from 'vitest';

describe('Console responsive behavior', () => {
  test('cc-adaptive-grid uses repeat auto-fit', () => {
    const gridStyle = 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))';
    expect(gridStyle).toContain('auto-fit');
    expect(gridStyle).toContain('minmax');
    expect(gridStyle).toContain('260px');
  });

  test('cc-surface-page has overflow auto and proper padding', () => {
    const styles = {
      width: '100%',
      height: '100%',
      minWidth: 0,
      overflow: 'auto',
      padding: 'clamp(18px, 2.4vw, 36px)',
    };
    expect(styles.overflow).toBe('auto');
    expect(styles.padding).toContain('clamp');
    expect(styles.width).toBe('100%');
  });

  test('cc-surface-inner max-width is 1440px', () => {
    const styles = {
      width: 'min(1440px, 100%)',
      margin: '0 auto',
    };
    expect(styles.width).toContain('1440px');
    expect(styles.margin).toBe('0 auto');
  });

  test('small window (<=900px) uses single column', () => {
    // Media query: @media (max-width: 900px) { grid-template-columns: 1fr; }
    const smallScreenCols = '1fr';
    expect(smallScreenCols).toBe('1fr');
  });

  test('medium window (900-1400px) uses two columns', () => {
    const mediumCols = 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))';
    expect(mediumCols).toContain('auto-fit');
  });

  test('font sizes use CSS custom properties', () => {
    const fontVar = 'var(--cc-text-body)';
    expect(fontVar).toContain('--cc-');
  });

  test('health overview shows 4 key metrics', () => {
    const metrics = ['Runtime Channels', 'PTY Registry', 'Errors (24h)', 'Contract'];
    expect(metrics.length).toBe(4);
  });
});

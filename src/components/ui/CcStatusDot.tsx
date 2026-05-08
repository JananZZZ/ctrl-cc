interface Props {
  status: 'idle' | 'running' | 'waiting' | 'error' | 'done';
  size?: number;
  pulse?: boolean;
}

const colors: Record<string, string> = {
  idle: 'var(--cc-text-soft)',
  running: 'var(--cc-green)',
  waiting: 'var(--cc-amber)',
  error: 'var(--cc-red)',
  done: 'var(--cc-blue)',
};

export function CcStatusDot({ status, size = 8, pulse }: Props) {
  return (
    <span
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: colors[status] ?? colors.idle,
        animation: pulse && status === 'running' ? 'cc-pulse 2s ease-in-out infinite' : undefined,
      }}
      data-testid={`status-dot-${status}`}
    />
  );
}

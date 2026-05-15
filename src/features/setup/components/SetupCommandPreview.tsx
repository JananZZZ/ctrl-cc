import { useState } from 'react';

interface Props {
  command: string;
  label?: string;
}

export function SetupCommandPreview({ command, label }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', borderRadius: 'var(--cc-radius-sm)',
      background: 'var(--cc-bg-muted)', border: '1px solid var(--cc-border)',
      fontFamily: 'var(--cc-font-mono)', fontSize: 'var(--cc-font-xs)',
      color: 'var(--cc-text)', wordBreak: 'break-all',
    }}>
      {label && <span style={{ color: 'var(--cc-text-muted)', flexShrink: 0 }}>{label}:</span>}
      <code style={{ flex: 1, color: 'var(--cc-text)' }}>{command}</code>
      <button
        onClick={handleCopy}
        style={{
          padding: '2px 10px', fontSize: 'var(--cc-font-2xs)',
          border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
          background: copied ? 'var(--cc-green-soft)' : 'var(--cc-bg)',
          color: copied ? 'var(--cc-green)' : 'var(--cc-text-muted)',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        {copied ? '已复制' : '复制命令'}
      </button>
    </div>
  );
}

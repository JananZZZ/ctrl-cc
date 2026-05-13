import React, { useState, useCallback } from 'react';

interface DockQuickPromptProps {
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
  onSubmit: (prompt: string) => Promise<boolean>;
}

export const DockQuickPrompt: React.FC<DockQuickPromptProps> = ({
  placeholder = 'Quick prompt...', disabled = false, disabledReason, onSubmit,
}) => {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;
    setSending(true);
    try {
      const ok = await onSubmit(trimmed);
      if (ok) setValue('');
    } finally { setSending(false); }
  }, [value, disabled, sending, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit(); }
  }, [handleSubmit]);

  return (
    <div style={{ display: 'flex', gap: '4px', padding: 'var(--cc-space-xs) var(--cc-space-sm)' }}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? (disabledReason ?? 'Unavailable') : placeholder}
        disabled={disabled || sending}
        style={{
          flex: 1, minWidth: 0,
          padding: '4px 8px', borderRadius: 'var(--cc-radius-sm)',
          border: '1px solid var(--cc-border)', background: 'var(--cc-surface)',
          color: disabled ? 'var(--cc-text-muted)' : 'var(--cc-text)',
          fontSize: '12px', fontFamily: 'var(--cc-font-sans)',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || sending || !value.trim()}
        style={{
          padding: '4px 10px', borderRadius: 'var(--cc-radius-sm)',
          border: 'none', background: 'var(--cc-brand)',
          color: 'var(--cc-text-on-accent)', fontSize: '11px', fontWeight: 600,
          fontFamily: 'var(--cc-font-sans)', cursor: 'pointer',
          opacity: disabled || sending || !value.trim() ? 0.5 : 1,
          transition: 'opacity 120ms var(--cc-ease-standard)',
          whiteSpace: 'nowrap',
        }}
      >
        {sending ? '...' : 'Send'}
      </button>
    </div>
  );
};

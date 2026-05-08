import { useState, useRef, useEffect } from 'react';
import { CcButton } from '../../components/ui/CcButton';
import type { RuntimeMode, PermissionMode } from '../../types';

interface Props {
  viewMode: 'chat' | 'terminal' | 'split' | 'structured-task';
  runtimeMode: RuntimeMode;
  model: string;
  permissionMode: PermissionMode;
  disabled?: boolean;
  onSend: (text: string) => void;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}

export function ComposerBar({ viewMode, runtimeMode, model: _m, permissionMode: _p, disabled, onSend, onRuntimeModeChange }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [disabled]);

  return (
    <div
      data-testid="composer-bar"
      style={{
        display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px',
        borderTop: '1px solid var(--cc-border)', background: 'var(--cc-surface-solid)', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <select
          value={runtimeMode}
          onChange={(e) => onRuntimeModeChange(e.target.value as RuntimeMode)}
          style={selectStyle}
          title="Runtime 模式"
        >
          <option value="pty-interactive">PTY</option>
          <option value="structured-print">CLI</option>
        </select>
        <button style={hintBtnStyle} title="@ 资源">@</button>
        <button style={hintBtnStyle} title="/ 命令">/</button>
      </div>
      <textarea
        ref={inputRef}
        data-testid="chat-composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={viewMode === 'terminal' ? '终端模式 — 直接在下方终端中输入...' : '输入消息... (Enter 发送, Shift+Enter 换行)'}
        rows={1}
        disabled={disabled}
        style={{
          flex: 1, resize: 'none', padding: '8px 12px',
          fontSize: 'var(--cc-font-sm)', lineHeight: 1.5,
          border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
          background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none',
          fontFamily: 'var(--cc-font-sans)',
        }}
      />
      <CcButton
        data-testid="chat-send-button"
        variant="primary"
        size="sm"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
      >
        发送
      </CcButton>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  height: 28, padding: '0 6px', fontSize: 'var(--cc-font-xs)',
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
  background: 'var(--cc-surface-solid)', color: 'var(--cc-text)', cursor: 'pointer',
};
const hintBtnStyle: React.CSSProperties = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 'var(--cc-font-sm)', fontWeight: 600,
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
  background: 'var(--cc-surface-solid)', color: 'var(--cc-text-muted)', cursor: 'pointer',
};

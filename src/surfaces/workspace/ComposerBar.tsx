import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CcButton } from '../../components/ui/CcButton';
import { ResourcePicker } from '../../features/composer/ResourcePicker';
import { CommandPalette } from '../../features/composer/CommandPalette';
import type { PermissionMode, RuntimeMode } from '../../types';

export type SendResult = { ok: true } | { ok: false; error: string };

interface Props {
  viewMode: 'chat' | 'terminal' | 'split' | 'structured-task';
  sessionRuntimeMode?: 'pty-interactive' | 'structured-print';
  disabled?: boolean;
  disabledReason?: 'runtime' | 'setup';
  onDisabledClick?: () => void;
  onSend: (text: string, config: { model: string; effort: string; permissionMode: PermissionMode; runtimeMode: RuntimeMode }) => Promise<SendResult>;
}

const MODELS = ['sonnet', 'opus', 'haiku'] as const;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const PERMISSION_MODES: PermissionMode[] = ['default', 'acceptEdits', 'plan', 'auto', 'dontAsk'];
const PERM_KEYS: Record<string, string> = { default: 'composerBar.permDefault', acceptEdits: 'composerBar.permAcceptEdits', plan: 'composerBar.permPlan', auto: 'composerBar.permAuto', dontAsk: 'composerBar.permDontAsk' };

export function ComposerBar({ viewMode, sessionRuntimeMode, disabled, disabledReason, onDisabledClick, onSend }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [model, setModel] = useState<string>(() => localStorage.getItem('ctrl-cc-model') || 'sonnet');
  const [effort, setEffort] = useState<string>(() => localStorage.getItem('ctrl-cc-effort') || 'medium');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(() => (localStorage.getItem('ctrl-cc-permMode') as PermissionMode) || 'default');
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(
    () => (sessionRuntimeMode === 'pty-interactive' || viewMode === 'terminal' || viewMode === 'split') ? 'pty-interactive' : 'structured-print'
  );
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    const result = await onSend(trimmed, { model, effort, permissionMode, runtimeMode });
    if (result.ok) {
      setText('');
    } else {
      setSendError(result.error);
    }
    setSending(false);
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
        <select value={runtimeMode} onChange={(e) => setRuntimeMode(e.target.value as RuntimeMode)} style={selectStyle} title={t('composerBar.pty')}>
          <option value="pty-interactive">PTY</option>
          <option value="structured-print">CLI</option>
        </select>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle} title={t('composerBar.model')}>
          {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={effort} onChange={(e) => setEffort(e.target.value)} style={selectStyle} title={t('composerBar.effort')}>
          {EFFORTS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={permissionMode} onChange={(e) => setPermissionMode(e.target.value as PermissionMode)} style={selectStyle} title={t('composerBar.permission')}>
          {PERMISSION_MODES.map((p) => <option key={p} value={p}>{t(PERM_KEYS[p])}</option>)}
        </select>
        <div style={{ position: 'relative' }}>
          <button style={hintBtnStyle} title={t('composerBar.resourcePicker')} onClick={() => setShowResourcePicker(!showResourcePicker)}>@</button>
          <ResourcePicker open={showResourcePicker} onClose={() => setShowResourcePicker(false)} onSelect={(r) => { setText((t) => t + ' ' + r + ' '); inputRef.current?.focus(); }} />
        </div>
        <div style={{ position: 'relative' }}>
          <button style={hintBtnStyle} title={t('composerBar.commandPalette')} onClick={() => setShowCommandPalette(!showCommandPalette)}>/</button>
          <CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} onSelect={(c) => { setText((t) => t + ' ' + c + ' '); inputRef.current?.focus(); }} />
        </div>
      </div>
      <textarea
        ref={inputRef}
        data-testid="chat-composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={
          disabled && disabledReason === 'setup'
            ? t('workspace.composerSetupGate')
            : disabled
            ? t('workspace.composerReadyGate')
            : viewMode === 'terminal'
            ? t('composerBar.terminalPlaceholder')
            : `${t('composerBar.placeholder')} (${t('composerBar.shortcutHint')})`
        }
        onClick={() => {
          if (disabled && onDisabledClick) onDisabledClick();
        }}
        rows={1}
        style={{
          flex: 1, resize: 'none', padding: '8px 12px',
          fontSize: 'var(--cc-font-sm)', lineHeight: 1.5,
          border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
          background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none',
          fontFamily: 'var(--cc-font-sans)',
        }}
      />
      {sendError && (
        <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-red)', padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{sendError}</span>
      )}
      <CcButton
        data-testid="chat-send-button"
        variant="primary"
        size="sm"
        onClick={handleSend}
        disabled={disabled || !text.trim() || sending}
      >
        {sending ? t('composerBar.sending') : t('composerBar.send')}
      </CcButton>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  minHeight: 28, padding: '2px 6px', fontSize: 'var(--cc-font-xs)',
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
  background: 'var(--cc-surface-solid)', color: 'var(--cc-text)', cursor: 'pointer',
};
const hintBtnStyle: React.CSSProperties = {
  width: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 'var(--cc-font-sm)', fontWeight: 600,
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
  background: 'var(--cc-surface-solid)', color: 'var(--cc-text-muted)', cursor: 'pointer',
};

interface Props {
  open: boolean;
  title: string;
  message: string;
  commandPreview?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SetupSafeConfirmDialog({
  open, title, message, commandPreview,
  confirmLabel = '确认执行', destructive = false,
  onConfirm, onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cc-overlay)',
    }}>
      <div style={{
        background: 'var(--cc-surface-solid)',
        border: '1px solid var(--cc-border)',
        borderRadius: 'var(--cc-radius-xl)',
        padding: 'clamp(20px, 3vw, 32px)',
        maxWidth: 460, width: '90vw',
        boxShadow: 'var(--cc-shadow-floating)',
      }}>
        <h3 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, color: 'var(--cc-text)', margin: '0 0 8px' }}>
          {destructive && '⚠️ '}{title}
        </h3>
        <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          {message}
        </p>
        {commandPreview && (
          <div style={{
            padding: '8px 12px', marginBottom: 16,
            borderRadius: 'var(--cc-radius-sm)',
            background: 'var(--cc-bg-muted)',
            border: '1px solid var(--cc-border)',
            fontFamily: 'var(--cc-font-mono)', fontSize: 'var(--cc-font-xs)',
            color: 'var(--cc-text)', wordBreak: 'break-all',
          }}>
            {commandPreview}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>取消</button>
          <button onClick={onConfirm} style={{
            ...confirmBtnStyle,
            background: destructive ? 'var(--cc-red)' : 'var(--cc-brand)',
          }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 20px', fontSize: 'var(--cc-font-sm)', fontWeight: 500,
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-bg)', color: 'var(--cc-text)', cursor: 'pointer',
};

const confirmBtnStyle: React.CSSProperties = {
  padding: '8px 20px', fontSize: 'var(--cc-font-sm)', fontWeight: 600,
  border: 'none', borderRadius: 'var(--cc-radius-sm)',
  color: 'var(--cc-text-inverse)', cursor: 'pointer',
};

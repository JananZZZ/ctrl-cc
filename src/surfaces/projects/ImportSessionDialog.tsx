import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CcButton } from '../../components/ui/CcButton';
import { CcStatusDot } from '../../components/ui/CcStatusDot';

interface ScannedSession {
  id: string;
  title: string;
  cwd: string;
  model: string;
  createdAt: string;
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (sessions: ScannedSession[]) => void;
  sessions: ScannedSession[];
  scanning: boolean;
}

export function ImportSessionDialog({ open: isOpen, onClose, onImport, sessions, scanning }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleImport = () => {
    const toImport = sessions.filter((s) => selected.has(s.id));
    onImport(toImport);
    setSelected(new Set());
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 12 }}>
          {t('importDialog.title')}
        </h3>
        <p style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', marginBottom: 16 }}>
          {t('importDialog.desc')}
        </p>

        {scanning ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--cc-text-muted)' }}>
            {t('importDialog.scanning')}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)' }}>
            {t('importDialog.noSessions')}
          </div>
        ) : (
          <div style={{ maxHeight: 320, overflow: 'auto', marginBottom: 12 }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => toggle(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderRadius: 'var(--cc-radius-sm)', cursor: 'pointer',
                  background: selected.has(s.id) ? 'var(--cc-brand-soft)' : 'var(--cc-bg)',
                  border: '1px solid ' + (selected.has(s.id) ? 'var(--cc-navy)' : 'var(--cc-border)'),
                  marginBottom: 4,
                }}
              >
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                <CcStatusDot status={s.status === 'running' ? 'running' : 'idle'} size={7} pulse={false} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 500, fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
                    {s.cwd} &middot; {s.model} &middot; {fmtDate(s.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <CcButton variant="ghost" onClick={onClose}>{t('common.cancel')}</CcButton>
          <CcButton variant="primary" onClick={handleImport} disabled={selected.size === 0}>
            {t('importDialog.importSelected', { count: selected.size })}
          </CcButton>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string) { try { return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'var(--cc-overlay, rgba(0,0,0,0.5))', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 1000,
};
const dialogStyle: React.CSSProperties = {
  background: 'var(--cc-surface-solid)', borderRadius: 'var(--cc-radius-lg)',
  border: '1px solid var(--cc-border)', padding: 24, width: 500, maxWidth: '90vw',
  boxShadow: 'var(--cc-shadow-floating)', maxHeight: '80vh', overflow: 'auto',
};

import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../stores/projectStore';
import { CcButton } from '../../components/ui/CcButton';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateNew: () => void;
}

export function NewSessionDialog({ open: isOpen, onClose, onSelectProject, onCreateNew }: Props) {
  const { t } = useTranslation();
  const projects = useProjectStore((s) => s.projects);

  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 12 }}>
          {t('newSessionDialog.selectProject')}
        </h3>
        <p style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', marginBottom: 16 }}>
          {t('newSessionDialog.selectDesc')}
        </p>

        {/* Default project always available */}
        <button
          onClick={() => onSelectProject('default')}
          style={projectOptionStyle}
        >
          <span>🏠</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)' }}>{t('newSessionDialog.defaultProject')}</div>
            <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{t('newSessionDialog.defaultProjectDesc')}</div>
          </div>
        </button>

        {projects.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={sectionLabel}>{t('newSessionDialog.existingProjects')}</div>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                style={projectOptionStyle}
              >
                <span>📁</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 500, fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.path}
                  </div>
                </div>
                {p.activeSessionCount > 0 && (
                  <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-green)', fontWeight: 600 }}>
                    {p.activeSessionCount} {t('newSessionDialog.active')}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div style={sectionLabel}>{t('newSessionDialog.newProject')}</div>
          <button onClick={onCreateNew} style={{ ...projectOptionStyle, border: '1px dashed var(--cc-border)' }}>
            <span>➕</span>
            <div>
              <div style={{ fontWeight: 500, fontSize: 'var(--cc-font-sm)', color: 'var(--cc-navy)' }}>{t('newSessionDialog.createNew')}</div>
              <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{t('newSessionDialog.createNewDesc')}</div>
            </div>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <CcButton variant="ghost" onClick={onClose}>{t('common.cancel')}</CcButton>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'var(--cc-overlay, rgba(0,0,0,0.5))', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 1000,
};
const dialogStyle: React.CSSProperties = {
  background: 'var(--cc-surface-solid)', borderRadius: 'var(--cc-radius-lg)',
  border: '1px solid var(--cc-border)', padding: 24, width: 440, maxWidth: '90vw',
  boxShadow: 'var(--cc-shadow-floating)', maxHeight: '80vh', overflow: 'auto',
};
const sectionLabel: React.CSSProperties = {
  fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text-soft)',
  marginBottom: 6, paddingLeft: 4,
};
const projectOptionStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '10px 12px', border: '1px solid var(--cc-border)',
  borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)',
  cursor: 'pointer', marginBottom: 4, textAlign: 'left',
};

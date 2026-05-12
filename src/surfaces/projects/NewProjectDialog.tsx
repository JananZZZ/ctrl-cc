import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { CcButton } from '../../components/ui/CcButton';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, path: string, gitBranch?: string) => void;
}

export function NewProjectDialog({ open: isOpen, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [gitBranch, setGitBranch] = useState<string | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    setPicking(true);
    setError(null);
    try {
      const selected = await open({ directory: true, multiple: false, title: t('projects.selectFolderTitle') });
      if (selected && typeof selected === 'string') {
        setFolderPath(selected);
        const folderName = selected.split(/[/\\]/).pop() || '';
        if (!name || name.startsWith(`${t('projects.newProject')}`)) {
          setName(folderName);
        }
        try {
          const { invokeCommand } = await import('../../services/invokeCommand');
          const branch: string = await invokeCommand('detect_git_branch', { path: selected });
          if (branch) setGitBranch(branch);
        } catch { /* git detection is best-effort */ }
      }
    } catch (e) {
      setError(`${t('projects.folderSelectFailed')}: ${String(e)}`);
    } finally {
      setPicking(false);
    }
  };

  const handleConfirm = () => {
    if (!name.trim()) { setError(t('projects.pleaseEnterName')); return; }
    if (!folderPath.trim()) { setError(t('projects.pleaseSelectFolder')); return; }
    onConfirm(name.trim(), folderPath.trim(), gitBranch);
    setName('');
    setFolderPath('');
    setGitBranch(undefined);
    setError(null);
  };

  const handleCancel = () => {
    setName('');
    setFolderPath('');
    setGitBranch(undefined);
    setError(null);
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 16 }}>{t('projects.newProject')}</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>{t('projects.projectName')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projects.projectNamePlaceholder')}
            autoFocus
            style={inputStyle}
            onKeyDown={(e) => { if (e.key === 'Enter' && folderPath) handleConfirm(); }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>{t('projects.workFolder')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder={t('projects.folderPathPlaceholder')}
              style={{ ...inputStyle, flex: 1 }}
            />
            <CcButton size="sm" onClick={handlePickFolder} disabled={picking}>
              {picking ? '...' : `📁 ${t('projects.browse')}`}
            </CcButton>
          </div>
          {folderPath && (
            <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', marginTop: 4 }}>
              {folderPath}
              {gitBranch && <span style={{ marginLeft: 8, color: 'var(--cc-green)' }}>🌿 {gitBranch}</span>}
            </div>
          )}
        </div>

        {error && <div style={{ color: 'var(--cc-red)', fontSize: 'var(--cc-font-xs)', marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <CcButton variant="ghost" onClick={handleCancel}>{t('common.cancel')}</CcButton>
          <CcButton variant="primary" onClick={handleConfirm} disabled={!name.trim() || !folderPath.trim()}>{t('projects.confirmCreate')}</CcButton>
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
  border: '1px solid var(--cc-border)', padding: 24, width: 480, maxWidth: '90vw',
  boxShadow: 'var(--cc-shadow-floating)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--cc-font-xs)', fontWeight: 600,
  color: 'var(--cc-text)', marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', fontSize: 'var(--cc-font-sm)',
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none',
};

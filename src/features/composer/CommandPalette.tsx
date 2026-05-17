import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Command {
  id: string;
  label: string;
  descKey: string;
  category: 'claude' | 'ctrlcc';
}

function useCommands(): Command[] {
  const { t } = useTranslation();
  return [
    { id: 'compact', label: 'compact', descKey: t('commands.compact'), category: 'claude' },
    { id: 'clear', label: 'clear', descKey: t('commands.clear'), category: 'claude' },
    { id: 'doctor', label: 'doctor', descKey: t('commands.doctor'), category: 'claude' },
    { id: 'cost', label: 'cost', descKey: t('commands.cost'), category: 'claude' },
    { id: 'export', label: 'export', descKey: t('commands.export'), category: 'claude' },
    { id: 'resume', label: 'resume', descKey: t('commands.resume'), category: 'claude' },
    { id: 'mcp', label: 'mcp', descKey: t('commands.mcp'), category: 'claude' },
    { id: 'security', label: 'security', descKey: t('commands.security'), category: 'claude' },
    { id: 'init', label: 'init', descKey: t('commands.init'), category: 'claude' },
    { id: 'status', label: 'status', descKey: t('commands.status'), category: 'claude' },
    { id: 'fork', label: 'fork-session', descKey: t('commands.forkSession'), category: 'ctrlcc' },
    { id: 'archive', label: 'archive-session', descKey: t('commands.archiveSession'), category: 'ctrlcc' },
    { id: 'bundle', label: 'export-bundle', descKey: t('commands.exportBundle'), category: 'ctrlcc' },
    { id: 'diagnose', label: 'diagnose', descKey: t('commands.diagnose'), category: 'ctrlcc' },
  ];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (command: string) => void;
}

export function CommandPalette({ open: isOpen, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const COMMANDS = useCommands();
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!isOpen) return null;

  const filtered = search
    ? COMMANDS.filter((c) => c.id.toLowerCase().includes(search.toLowerCase()) || c.descKey.includes(search))
    : COMMANDS;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); }
    else if (e.key === 'ArrowDown') { setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setSelectedIdx((i) => Math.max(i - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' && filtered[selectedIdx]) {
      onSelect('/' + filtered[selectedIdx].id);
      onClose();
    }
  };

  return (
    <div style={popupStyle}>
      <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedIdx(0); }}
        placeholder={t('common.search') + '...'} autoFocus style={searchStyle} onKeyDown={handleKeyDown} />
      <div style={{ maxHeight: 260, overflow: 'auto' }}>
        <div style={{ padding: '4px 10px', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', fontWeight: 600 }}>{t('chat.claudeCommands')}</div>
        {filtered.filter((c) => c.category === 'claude').map((cmd) => {
          const idx = filtered.indexOf(cmd);
          return (
            <div key={cmd.id} onClick={() => { onSelect('/' + cmd.id); onClose(); }}
              style={{ ...itemStyle, background: idx === selectedIdx ? 'var(--cc-brand-soft)' : 'transparent' }}>
              <span style={{ fontWeight: 600, color: 'var(--cc-navy)' }}>/{cmd.id}</span>
              <span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)', flex: 1, textAlign: 'right' }}>{cmd.descKey}</span>
            </div>
          );
        })}
        <div style={{ padding: '4px 10px', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', fontWeight: 600, marginTop: 4 }}>{t('chat.ctrlccCommands')}</div>
        {filtered.filter((c) => c.category === 'ctrlcc').map((cmd) => {
          const idx = filtered.indexOf(cmd);
          return (
            <div key={cmd.id} onClick={() => { onSelect('/' + cmd.id); onClose(); }}
              style={{ ...itemStyle, background: idx === selectedIdx ? 'var(--cc-brand-soft)' : 'transparent' }}>
              <span style={{ fontWeight: 600, color: 'var(--cc-green)' }}>/{cmd.id}</span>
              <span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)', flex: 1, textAlign: 'right' }}>{cmd.descKey}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const popupStyle: React.CSSProperties = { position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-md)', boxShadow: 'var(--cc-shadow-popover)', width: 360, maxHeight: 340, overflow: 'hidden', zIndex: 100 };
const searchStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--cc-border)', outline: 'none', fontSize: 'var(--cc-font-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)' };
const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)' };

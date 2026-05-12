import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invokeCommand } from '../../services/invokeCommand';

interface ResourceItem {
  name: string;
  path: string;
  isDir: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (resource: string) => void;
  cwd?: string;
}

export function ResourcePicker({ open: isOpen, onClose, onSelect, cwd }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const dir = cwd || '.';
    invokeCommand<ResourceItem[]>('list_directory', { path: dir, maxDepth: 2 })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isOpen, cwd]);

  if (!isOpen) return null;

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items.slice(0, 30);

  return (
    <div style={popupStyle}>
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={t('composerBar.searchResources')} autoFocus style={searchStyle}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} />
      <div style={{ maxHeight: 220, overflow: 'auto' }}>
        <div onClick={() => { onSelect('@'); onClose(); }} style={itemStyle}>
          <span>📄</span> @mention
        </div>
        {loading ? (
          <div style={{ padding: 8, color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)' }}>{t('composerBar.scanning')}</div>
        ) : (
          filtered.map((item) => (
            <div key={item.path} onClick={() => { onSelect('@' + item.name); onClose(); }} style={itemStyle}>
              <span>{item.isDir ? '📁' : '📄'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const popupStyle: React.CSSProperties = { position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-md)', boxShadow: 'var(--cc-shadow-popover)', width: 320, maxHeight: 300, overflow: 'hidden', zIndex: 100 };
const searchStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--cc-border)', outline: 'none', fontSize: 'var(--cc-font-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)' };
const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)' };

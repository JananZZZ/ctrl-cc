import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invokeCommand } from '../../services/invokeCommand';
import { CcCard } from '../../components/ui/CcCard';
import { CcButton } from '../../components/ui/CcButton';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';

interface ResourceItem { name: string; path: string; size: number; isDir: boolean; modified: string; }
type TabId = 'skills' | 'agents' | 'rules' | 'memory' | 'hooks' | 'mcp';

const TABS: { id: TabId; labelKey: string; dir: string }[] = [
  { id: 'skills', labelKey: 'resources.skills', dir: '/skills' },
  { id: 'agents', labelKey: 'resources.agents', dir: '/agents' },
  { id: 'rules', labelKey: 'resources.rules', dir: '/rules' },
  { id: 'memory', labelKey: 'resources.memory', dir: '/memory' },
  { id: 'hooks', labelKey: 'resources.hooks', dir: '/hooks' },
  { id: 'mcp', labelKey: 'resources.mcp', dir: '' },
];

export function ResourcesSurface() {
  useRenderLoopGuard('ResourcesSurface');
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('skills');
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResourceItem | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [homeDir, setHomeDir] = useState('');

  useEffect(() => { invokeCommand<string>('get_home_dir').then(setHomeDir).catch(() => setHomeDir('')); }, []);

  const tabDir = TABS.find((tab) => tab.id === activeTab)?.dir || '';
  const basePath = homeDir + '/.claude' + tabDir;

  const loadItems = async () => {
    if (!homeDir) return;
    setLoading(true); setError(null);
    try { setItems(await invokeCommand<ResourceItem[]>('list_directory', { path: basePath, maxDepth: 1 })); }
    catch (e) { setError(String(e)); setItems([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadItems(); }, [activeTab, homeDir]);

  const selectItem = async (item: ResourceItem) => {
    setSelected(item); setEditing(false);
    if (!item.isDir && item.size < 100000) {
      try { setContent(await invokeCommand<string>('read_file_content', { path: item.path })); }
      catch { setContent(t('resources.cannotRead')); }
    } else { setContent(null); }
  };

  const handleSave = async () => {
    if (!selected) return;
    try { await invokeCommand('write_file_content', { path: selected.path, content: editContent }); setContent(editContent); setEditing(false); setStatusMsg(t('common.save')); }
    catch (e) { setError(String(e)); }
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`${t('resources.deleteConfirm')} ${selected.name}?`)) return;
    try { await invokeCommand('delete_file', { path: selected.path }); setSelected(null); setContent(null); loadItems(); setStatusMsg(t('common.delete')); }
    catch (e) { setError(String(e)); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const newPath = basePath + '/' + newName;
    try { await invokeCommand('write_file_content', { path: newPath, content: newContent }); setShowNewForm(false); setNewName(''); setNewContent(''); loadItems(); setStatusMsg(t('common.create')); }
    catch (e) { setError(String(e)); }
  };

  const startEdit = () => { setEditContent(content || ''); setEditing(true); };
  const cancelEdit = () => { setEditing(false); };

  return (
    <div data-testid="surface-resources" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header + Tabs */}
      <div style={{ padding: '10px 24px 0', borderBottom: '1px solid var(--cc-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 'var(--cc-font-xl)', fontWeight: 600, color: 'var(--cc-text)', margin: 0 }}>{t('resources.title')}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <CcButton size="sm" onClick={() => setShowNewForm(true)}>+ {t('common.new')}</CcButton>
            <CcButton size="sm" variant="ghost" onClick={loadItems}>{t('common.refresh')}</CcButton>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelected(null); setContent(null); }}
              style={{ padding: '6px 16px', fontSize: 'var(--cc-font-sm)', fontWeight: activeTab === tab.id ? 600 : 400, border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--cc-navy)' : '2px solid transparent', background: 'transparent', color: activeTab === tab.id ? 'var(--cc-text)' : 'var(--cc-text-muted)', cursor: 'pointer' }}>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>
      {statusMsg && <div style={{ margin: '8px 24px 0', padding: '6px 12px', borderRadius: 'var(--cc-radius-xs)', background: 'var(--cc-bg-success-soft)', color: 'var(--cc-green)', fontSize: 'var(--cc-font-xs)' }}>{statusMsg}</div>}
      {error && <div style={{ margin: '8px 24px 0', padding: '6px 12px', borderRadius: 'var(--cc-radius-xs)', background: 'var(--cc-bg-danger-soft)', color: 'var(--cc-red)', fontSize: 'var(--cc-font-xs)' }}>{error}</div>}

      {/* Main: Left list + Right detail */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Item List */}
        <div style={{ width: 280, flexShrink: 0, overflow: 'auto', borderRight: '1px solid var(--cc-border)', padding: 8 }}>
          {loading ? <div style={{ padding: 20, color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)', textAlign: 'center' }}>{t('common.loading')}</div>
          : items.length === 0 ? <div style={{ padding: 20, color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)', textAlign: 'center' }}>{t('resources.noResources')}</div>
          : items.map((item) => (
            <div key={item.path} onClick={() => selectItem(item)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 'var(--cc-radius-xs)', cursor: 'pointer',
                background: selected?.path === item.path ? 'var(--cc-brand-soft)' : 'transparent', fontSize: 'var(--cc-font-xs)' }}>
              <span>{item.isDir ? 'D' : 'F'}</span>
              <span style={{ color: 'var(--cc-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              {!item.isDir && <span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-3xs)' }}>{fmtSize(item.size)}</span>}
            </div>
          ))}
        </div>

        {/* Right: Detail Panel */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)' }}>{t('resources.selectHint')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Info Bar */}
              <CcCard style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, color: 'var(--cc-text)', margin: 0 }}>{selected.name}</h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!editing && <CcButton size="sm" variant="ghost" onClick={startEdit}>{t('common.edit')}</CcButton>}
                    <CcButton size="sm" variant="ghost" onClick={handleDelete}>{t('common.delete')}</CcButton>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 'var(--cc-font-xs)' }}>
                  <Info label={t('resources.path')} value={selected.path} />
                  <Info label={t('resources.size')} value={fmtSize(selected.size)} />
                  <Info label={t('resources.type')} value={selected.isDir ? t('resources.directory') : t('resources.file')} />
                  <Info label={t('resources.modified')} value={selected.modified || 'N/A'} />
                </div>
              </CcCard>
              {/* Content Editor/Viewer */}
              <CcCard style={{ padding: 14 }}>
                <h3 style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 }}>{t('resources.content')}</h3>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      style={{ width: '100%', minHeight: 300, padding: 10, fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)', resize: 'vertical', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <CcButton size="sm" variant="primary" onClick={handleSave}>{t('common.save')}</CcButton>
                      <CcButton size="sm" variant="ghost" onClick={cancelEdit}>{t('common.cancel')}</CcButton>
                    </div>
                  </div>
                ) : content ? (
                  <pre style={{ fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)', whiteSpace: 'pre-wrap', maxHeight: 500, overflow: 'auto', padding: 10, borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-muted)', color: 'var(--cc-text)', margin: 0 }}>{content.slice(0, 20000)}</pre>
                ) : (
                  <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{selected.isDir ? t('resources.directory') : t('resources.fileTooLarge')}</div>
                )}
              </CcCard>
            </div>
          )}
        </div>
      </div>

      {/* New Resource Modal */}
      {showNewForm && (
        <div style={overlayStyle}>
          <div style={{ background: 'var(--cc-surface-solid)', borderRadius: 'var(--cc-radius-lg)', border: '1px solid var(--cc-border)', padding: 24, width: 440, boxShadow: 'var(--cc-shadow-floating)' }}>
            <h3 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 12 }}>{t('resources.newResource', { tab: t(TABS.find(tab => tab.id === activeTab)?.labelKey || 'resources.skills') })}</h3>
            <div style={{ marginBottom: 12 }}><label style={lbl}>{t('resources.name')}</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('resources.fileNamePlaceholder')} autoFocus style={inp} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>{t('resources.content')}</label><textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder={t('resources.fileContentPlaceholder')} rows={6} style={{ ...inp, resize: 'vertical', fontFamily: 'var(--cc-font-mono)', fontSize: 'var(--cc-font-xs)' }} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <CcButton variant="ghost" onClick={() => setShowNewForm(false)}>{t('common.cancel')}</CcButton>
              <CcButton variant="primary" onClick={handleCreate} disabled={!newName.trim()}>{t('common.create')}</CcButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span style={{ color: 'var(--cc-text-soft)' }}>{label}: </span><span style={{ color: 'var(--cc-text)' }}>{value}</span></div>;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '6px 10px', fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--cc-overlay, rgba(0,0,0,0.5))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };

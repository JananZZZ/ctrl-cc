// v12.0 Resources Capability Center
import { useState, useEffect } from 'react';
import { useResourcesStore } from '../stores/resourcesStore';
import { scanGlobalResources } from '../services/resourceScanner';
import { ResourceActivationBridge } from '../services/resourceActivationBridge';

export function ResourcesSurface() {
  const store = useResourcesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    store.setScanning(true);
    scanGlobalResources().then(r => { store.setResources(r.resources); store.setScanResult(r); store.setScanning(false); }).catch(() => store.setScanning(false));
  }, []);

  const filtered = store.resources.filter(r => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selected = selectedId ? store.resources.find(r => r.id === selectedId) : null;

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--cc-font-sans)', color: 'var(--cc-text)' }}>
      <nav style={{ width: 200, borderRight: '1px solid var(--cc-border-soft)', overflowY: 'auto', padding: 'var(--cc-space-sm)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cc-text-muted)', padding: 'var(--cc-space-sm)' }}>Resources</h4>
        {['skills','agents','rules','memory','hooks','mcp','templates'].map(type => {
          const count = store.resources.filter(r => r.type === type).length;
          return (
            <button key={type} onClick={() => store.setType(type)} style={{
              display: 'flex', justifyContent: 'space-between', width: '100%', padding: '6px 12px', border: 'none',
              background: store.selectedType === type ? 'var(--cc-surface)' : 'transparent',
              color: store.selectedType === type ? 'var(--cc-text)' : 'var(--cc-text-muted)',
              cursor: 'pointer', fontSize: '12px', textAlign: 'left', fontFamily: 'var(--cc-font-sans)', borderRadius: 'var(--cc-radius-sm)',
            }}>
              <span>{type}</span><span style={{ fontSize: '10px', color: 'var(--cc-text-soft)' }}>{count}</span>
            </button>
          );
        })}
      </nav>
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--cc-space-md)' }}>
        <input type="text" placeholder="Search resources..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{
          width: '100%', padding: '6px 12px', marginBottom: 'var(--cc-space-md)', borderRadius: 'var(--cc-radius-sm)',
          border: '1px solid var(--cc-border)', background: 'var(--cc-surface)', color: 'var(--cc-text)',
          fontSize: '12px', fontFamily: 'var(--cc-font-sans)', outline: 'none',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--cc-space-md)' }}>
          {filtered.map(r => (
            <div key={r.id} onClick={() => setSelectedId(r.id)} style={{
              padding: 'var(--cc-space-md)', borderRadius: 'var(--cc-radius-md)',
              border: selectedId === r.id ? '1px solid var(--cc-brand)' : '1px solid var(--cc-border-soft)',
              background: 'var(--cc-surface)', cursor: 'pointer',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>{r.type} · {r.scope}</div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>{r.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--cc-text-muted)', fontFamily: 'var(--cc-font-mono)', wordBreak: 'break-all' }}>{r.path}</div>
            </div>
          ))}
        </div>
      </div>
      {selected && (
        <div style={{ width: 340, borderLeft: '1px solid var(--cc-border-soft)', overflowY: 'auto', padding: 'var(--cc-space-md)', background: 'var(--cc-bg)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{selected.name}</h3>
          <div style={{ fontSize: '11px', color: 'var(--cc-text-muted)', marginBottom: 'var(--cc-space-md)' }}>{selected.type} · {selected.scope}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--cc-space-md)' }}>
            <button onClick={() => ResourceActivationBridge.insertIntoChat(selected, '')} style={btnS}>Insert into Chat</button>
            <button onClick={() => ResourceActivationBridge.applyToProject(selected, '')} style={btnS}>Apply to Project</button>
          </div>
          {selected.content && <pre style={{ fontSize: '11px', fontFamily: 'var(--cc-font-mono)', whiteSpace: 'pre-wrap', background: 'var(--cc-surface)', padding: 'var(--cc-space-sm)', borderRadius: 'var(--cc-radius-sm)' }}>{selected.content.slice(0, 2000)}</pre>}
        </div>
      )}
    </div>
  );
}

const btnS: React.CSSProperties = { padding: '4px 10px', borderRadius: 'var(--cc-radius-sm)', border: '1px solid var(--cc-border)', background: 'var(--cc-surface)', color: 'var(--cc-text)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--cc-font-sans)' };

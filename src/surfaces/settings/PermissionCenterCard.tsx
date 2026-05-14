import { useEffect, useState } from 'react';
import { CcCard } from '../../components/ui/CcCard';
import { CcButton } from '../../components/ui/CcButton';
import { usePermissionStore } from '../../features/permissions/stores/permissionStore';

export function PermissionCenterCard() {
  const rules = usePermissionStore((s) => s.rules);
  const loading = usePermissionStore((s) => s.loading);
  const error = usePermissionStore((s) => s.error);
  const autoTrust = usePermissionStore((s) => s.autoTrust);
  const refresh = usePermissionStore((s) => s.refresh);
  const setAutoTrust = usePermissionStore((s) => s.setAutoTrust);
  const addAllowTool = usePermissionStore((s) => s.addAllowTool);
  const addDenyPattern = usePermissionStore((s) => s.addDenyPattern);

  const [allowTool, setAllowTool] = useState('');
  const [denyPattern, setDenyPattern] = useState('');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
      <div className="cc-card-header">
        <div>
          <h3 className="cc-card-title">权限中心</h3>
          <p className="cc-card-subtitle">管理 Claude 工具调用白名单、黑名单与 AutoTrust 安全级别。</p>
        </div>
        <CcButton size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? '刷新中...' : '刷新规则'}
        </CcButton>
      </div>

      {error && <div className="cc-inline-error">{error}</div>}

      <div className="cc-settings-grid">
        <div className="cc-setting-field">
          <label>AutoTrust 等级</label>
          <select
            value={autoTrust}
            onChange={(e) => void setAutoTrust(Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <small>0 = 最保守；5 = 最高自动信任。建议开发期 ≤ 2。</small>
        </div>

        <div className="cc-setting-field">
          <label>添加白名单工具</label>
          <div className="cc-inline-form">
            <input value={allowTool} onChange={(e) => setAllowTool(e.target.value)} placeholder="read, glob, grep, list..." />
            <CcButton size="sm" onClick={() => { void addAllowTool(allowTool); setAllowTool(''); }}>添加</CcButton>
          </div>
        </div>

        <div className="cc-setting-field">
          <label>添加黑名单规则</label>
          <div className="cc-inline-form">
            <input value={denyPattern} onChange={(e) => setDenyPattern(e.target.value)} placeholder="rm -rf, git push --force..." />
            <CcButton size="sm" variant="ghost" onClick={() => { void addDenyPattern(denyPattern); setDenyPattern(''); }}>添加</CcButton>
          </div>
        </div>
      </div>

      <div className="cc-rule-list">
        {rules.length === 0 ? (
          <div className="cc-empty-hint">暂无后端规则。可添加白名单工具或黑名单模式。</div>
        ) : (
          rules.map((r, i) => (
            <div key={r.id ?? i} className={`cc-rule-row ${r.kind === 'deny' ? 'deny' : 'allow'}`}>
              <span>{r.kind ?? 'rule'}</span>
              <code>{r.tool ?? r.pattern ?? r.value ?? JSON.stringify(r)}</code>
            </div>
          ))
        )}
      </div>
    </CcCard>
  );
}

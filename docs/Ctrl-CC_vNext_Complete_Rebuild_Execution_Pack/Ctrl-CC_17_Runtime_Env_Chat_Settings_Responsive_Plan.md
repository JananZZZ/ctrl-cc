# Ctrl-CC 17.0 全面稳定修复与响应式产品升级执行计划

适用仓库：`https://github.com/JananZZZ/ctrl-cc/tree/master`

建议新建分支：

```bash
git checkout master
git pull origin master
git checkout -b fix/runtime-env-chat-layout-settings-17
```

本轮只允许按顺序执行。不要自由发挥，不要新增半成品页面，不要把旧 surfaces 再切换到 `features/*/pages`。

---

## 0. 当前问题总判断

当前 master 已经比之前稳定，但仍有 5 个关键问题：

```text
1. Runtime 仍然找不到 direct-node Claude launch plan。
   当前只发现 powershell/cmd wrapper，但这些 wrapper 被策略阻止，所以 session 进入 discovery-failed。

2. Console 与 Settings 都会各自自动调用 claude_check_capability。
   首次启动 Console 自动检测一次；首次打开 Settings 又自动检测一次。
   这导致检测来源不统一、缓存策略混乱、UI 状态不一致。

3. RuntimeBridge 创建会话后默认打开 terminal。
   对新手不友好。项目区新建 Claude 会话应该默认进入“气泡聊天”界面。

4. UI 虽然变宽，但没有真正响应式。
   大屏时元素集中但卡片挤；小窗时缺乏不同布局策略；Settings/Diagnostics 长表格仍容易撑开。

5. Settings 权限中心是静态假卡片。
   后端已有 permission_center 相关命令，但前端没有把它们串起来。
```

执行优先级：

```text
P0：Runtime launch plan 可诊断、可配置、可 fallback
P1：环境检测统一成一个 EnvironmentStore，禁止启动自动检测
P2：项目新建会话默认进入 Chat view
P3：Settings 权限中心接入真实后端命令
P4：全页面响应式视觉系统重整
```

---

# 1. Phase A：新增统一 EnvironmentStore，取消启动自动检测

## A1. 新建文件

```text
src/features/environment/stores/environmentStore.ts
```

写入：

```ts
import { create } from 'zustand';
import { invokeCommand } from '../../../services/invokeCommand';

export interface Capability {
  version: string | null;
  exists: boolean;
  authStatus: string | null;
  supportsStreamJson: boolean;
  supportsMCP?: boolean;
  supportsAgents?: boolean;
  checkedAt: string;
  errors: string[];
}

export interface ClaudeJsCandidate {
  path: string;
  exists: boolean;
  source: string;
}

export interface LaunchPlan {
  id: string;
  label?: string;
  program: string;
  argsPrefix?: string[];
  args_prefix?: string[];
  canaryOk?: boolean;
  versionOk?: boolean;
  versionText?: string | null;
  selected?: boolean;
  error?: string | null;
}

export interface EnvironmentSnapshot {
  capability: Capability | null;
  launchPlans: LaunchPlan[];
  jsCandidates: ClaudeJsCandidate[];
  generatedAt: string;
  source: 'cache' | 'manual-refresh' | 'unknown';
}

interface EnvironmentState {
  snapshot: EnvironmentSnapshot | null;
  loading: boolean;
  error: string | null;

  loadCached: () => void;
  refresh: () => Promise<void>;
  clear: () => void;
}

const CACHE_KEY = 'ctrl-cc-environment-snapshot';

function readCache(): EnvironmentSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EnvironmentSnapshot;
  } catch {
    return null;
  }
}

function writeCache(snapshot: EnvironmentSnapshot) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  localStorage.setItem('ctrl-cc-capability', JSON.stringify({
    data: snapshot.capability,
    checkedAt: snapshot.generatedAt,
  }));
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  snapshot: readCache(),
  loading: false,
  error: null,

  loadCached: () => {
    const cached = readCache();
    set({ snapshot: cached, loading: false, error: null });
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [capability, discovery, jsCandidates] = await Promise.all([
        invokeCommand<Capability>('claude_check_capability').catch((err) => ({
          version: null,
          exists: false,
          authStatus: null,
          supportsStreamJson: false,
          supportsMCP: false,
          supportsAgents: false,
          checkedAt: new Date().toISOString(),
          errors: [String(err)],
        })),
        invokeCommand<{ plans?: LaunchPlan[] }>('runtime_discover_claude_v2').catch(() => ({ plans: [] })),
        invokeCommand<ClaudeJsCandidate[]>('runtime_find_claude_js_candidates').catch(() => []),
      ]);

      const snapshot: EnvironmentSnapshot = {
        capability,
        launchPlans: discovery.plans ?? [],
        jsCandidates,
        generatedAt: new Date().toISOString(),
        source: 'manual-refresh',
      };

      writeCache(snapshot);
      set({ snapshot, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  clear: () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('ctrl-cc-capability');
    set({ snapshot: null, loading: false, error: null });
  },
}));
```

---

## A2. 修改 `ConsoleSurface.tsx`

文件：

```text
src/surfaces/console/ConsoleSurface.tsx
```

### 删除自动检测状态与 useEffect

删除或停止使用：

```ts
interface Capability ...
const [cap, setCap] = useState<Capability | null>(null);
const [capLoading, setCapLoading] = useState(true);
useEffect(() => {
  const cached = localStorage.getItem('ctrl-cc-capability');
  ...
  invokeCommand<Capability>('claude_check_capability')
  ...
}, []);
```

删除不再需要的 import：

```ts
import { useEffect, useState } from 'react';
import { invokeCommand } from '../../services/invokeCommand';
```

改为：

```ts
import { useEffect } from 'react';
import { useEnvironmentStore } from '../../features/environment/stores/environmentStore';
```

在组件内加入：

```ts
const envSnapshot = useEnvironmentStore((s) => s.snapshot);
const envLoading = useEnvironmentStore((s) => s.loading);
const refreshEnv = useEnvironmentStore((s) => s.refresh);
const loadCachedEnv = useEnvironmentStore((s) => s.loadCached);

useEffect(() => {
  loadCachedEnv();
}, [loadCachedEnv]);

const cap = envSnapshot?.capability ?? null;
const hasEnvInfo = Boolean(envSnapshot);
const selectedLaunchPlan = envSnapshot?.launchPlans?.find((p) => p.selected);
```

### 环境检测卡片右上角加按钮

在环境检测 `CcCard` 的 header 改为：

```tsx
<CcCard className="cc-section-card">
  <div className="cc-card-header">
    <h3 style={st}>{t('console.environment')}</h3>
    <CcButton size="sm" variant="ghost" onClick={() => void refreshEnv()} disabled={envLoading}>
      {envLoading ? t('common.detecting') : hasEnvInfo ? '刷新环境配置' : '检测环境配置'}
    </CcButton>
  </div>

  {!hasEnvInfo ? (
    <div className="cc-empty-hint">
      尚未检测环境配置。点击右上角按钮检查 Claude CLI、LaunchPlan、Node.js 与认证状态。
    </div>
  ) : (
    <div className="cc-kv-stack">
      <E label={t('console.claudeCli')} value={cap?.exists ? cap?.version || String(t('common.installed')) : String(t('common.notDetected'))} c={cap?.exists ? 'var(--cc-green)' : 'var(--cc-red)'} />
      <E label={t('console.authStatus')} value={cap?.authStatus || String(t('common.unknown'))} c={cap?.authStatus === 'authenticated' ? 'var(--cc-green)' : 'var(--cc-amber)'} />
      <E label="LaunchPlan" value={selectedLaunchPlan?.id ?? 'not selected'} c={selectedLaunchPlan ? 'var(--cc-green)' : 'var(--cc-red)'} />
      <E label="Claude JS" value={`${envSnapshot?.jsCandidates?.filter((c) => c.exists).length ?? 0} candidates`} />
      <E label={t('console.streamJson')} value={cap?.supportsStreamJson ? String(t('common.supported')) : String(t('common.unknown'))} />
      <E label={t('console.frontend')} value={t('console.techFrontend')} />
      <E label={t('console.backend')} value={t('console.techBackend')} />
      <E label={t('console.terminal')} value={t('console.techTerminal')} />
      <E label={t('console.db')} value={t('console.techDb')} />
    </div>
  )}
</CcCard>
```

---

## A3. 修改 `SettingsSurface.tsx`

文件：

```text
src/surfaces/settings/SettingsSurface.tsx
```

### 删除 Settings 打开时自动检测

删除当前：

```ts
const [cap, setCap] = useState<Capability | null>(null);
const [capLoading, setCapLoading] = useState(true);

const checkCap = () => { ... invokeCommand<Capability>('claude_check_capability') ... };

useEffect(() => {
  const cached = localStorage.getItem('ctrl-cc-capability');
  ...
  checkCap();
}, []);
```

新增：

```ts
import { useEnvironmentStore } from '../../features/environment/stores/environmentStore';
```

组件内新增：

```ts
const envSnapshot = useEnvironmentStore((s) => s.snapshot);
const envLoading = useEnvironmentStore((s) => s.loading);
const envError = useEnvironmentStore((s) => s.error);
const refreshEnv = useEnvironmentStore((s) => s.refresh);
const loadCachedEnv = useEnvironmentStore((s) => s.loadCached);
const clearEnv = useEnvironmentStore((s) => s.clear);

useEffect(() => {
  loadCachedEnv();
}, [loadCachedEnv]);

const cap = envSnapshot?.capability ?? null;
```

### 环境检测卡片改为手动按钮

把 Environment 卡片内容替换为：

```tsx
<CcCard className="cc-section-card">
  <div className="cc-card-header">
    <h3 style={sectH3}>{t('settings.environment')}</h3>
    <div style={{ display: 'flex', gap: 8 }}>
      <CcButton size="sm" variant="ghost" onClick={() => void refreshEnv()} disabled={envLoading}>
        {envLoading ? t('common.detecting') : envSnapshot ? '刷新环境配置' : '检测环境配置'}
      </CcButton>
      {envSnapshot && (
        <CcButton size="sm" variant="ghost" onClick={clearEnv}>
          清除环境缓存
        </CcButton>
      )}
    </div>
  </div>

  {envError && <div className="cc-inline-error">{envError}</div>}

  {!envSnapshot ? (
    <div className="cc-empty-hint">
      尚未检测环境。点击“检测环境配置”后，将统一检测 Claude CLI、认证状态、LaunchPlan、Claude JS 候选路径。
    </div>
  ) : (
    <div className="cc-settings-grid">
      <F label={t('console.claudeCli')} value={cap?.exists ? String(t('common.installed')) : String(t('common.notDetected'))} color={cap?.exists ? 'var(--cc-green)' : 'var(--cc-red)'} />
      <F label={t('console.version')} value={cap?.version || 'N/A'} />
      <F label={t('console.authStatus')} value={cap?.authStatus || String(t('common.unknown'))} color={cap?.authStatus === 'authenticated' ? 'var(--cc-green)' : 'var(--cc-amber)'} />
      <F label="LaunchPlan" value={envSnapshot.launchPlans.find((p) => p.selected)?.id ?? 'not selected'} />
      <F label="Claude JS candidates" value={String(envSnapshot.jsCandidates.filter((c) => c.exists).length)} />
      <F label={t('console.checkedAt')} value={fmtTime(envSnapshot.generatedAt)} />
    </div>
  )}
</CcCard>
```

---

# 2. Phase B：修复 Claude LaunchPlan，新增 npx direct fallback

当前 JS Candidates 全部不存在，但用户本机 `claude --version` 能显示 `2.1.138`，说明 `claude.cmd` 可用或者 npm/npx 能解析。为了避免 shell wrapper，同时避免硬猜 JS 文件，新增 direct node + npx-cli.js fallback。

## B1. 修改 `src-tauri/src/runtime_v2/claude_discovery.rs`

### 新增 npx cli 查找函数

添加：

```rust
fn find_npx_cli_js() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(program_files) = env::var("ProgramFiles") {
        candidates.push(PathBuf::from(program_files).join(r"nodejs\node_modules\npm\bin\npx-cli.js"));
    }

    candidates.push(PathBuf::from(r"C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js"));

    if let Ok(appdata) = env::var("APPDATA") {
        candidates.push(PathBuf::from(appdata).join(r"npm\node_modules\npm\bin\npx-cli.js"));
    }

    candidates.into_iter().find(|p| p.exists())
}
```

### 新增 npm exec plan

在 `collect_launch_plans()` 中，`scan_node_modules_for_claude_js()` 后、shell wrappers 前，加入：

```rust
if let (Some(node), Some(npx_cli)) = (find_node_exe(), find_npx_cli_js()) {
    plans.push(ClaudeLaunchPlan {
        id: "direct-node-npx-anthropic-claude-code".to_string(),
        label: "Direct Node.js + npx @anthropic-ai/claude-code".to_string(),
        program: node.to_string_lossy().to_string(),
        args_prefix: vec![
            npx_cli.to_string_lossy().to_string(),
            "--yes".to_string(),
            "@anthropic-ai/claude-code".to_string(),
        ],
        reason: "Runs npx through node.exe directly; avoids cmd.exe/powershell.exe wrappers".to_string(),
    });
}
```

如果 Claude Code 当前包名不是 `@anthropic-ai/claude-code`，再加一个备用：

```rust
if let (Some(node), Some(npx_cli)) = (find_node_exe(), find_npx_cli_js()) {
    plans.push(ClaudeLaunchPlan {
        id: "direct-node-npx-claude-code".to_string(),
        label: "Direct Node.js + npx claude-code".to_string(),
        program: node.to_string_lossy().to_string(),
        args_prefix: vec![
            npx_cli.to_string_lossy().to_string(),
            "--yes".to_string(),
            "claude-code".to_string(),
        ],
        reason: "Fallback package name through direct npx".to_string(),
    });
}
```

### 修改错误消息

`select_launch_plan()` 最后的 `Err(...)` 改成：

```rust
Err(format!(
    "{}\nNo policy-allowed runnable Claude launch plan was found.\n\
     Ctrl-CC tried direct JS entries and direct node+npx fallbacks, but none passed canary.\n\
     Open Settings → Diagnostics → Claude JS Candidates.\n\
     If no JS candidate exists, run `where claude` and inspect `%APPDATA%\\npm\\claude.cmd`.\n\
     Recommended fix: set CTRL_CC_CLAUDE_JS to the real Claude CLI JS entry.\n\
     Temporary fallback: set CTRL_CC_ALLOW_SHELL_WRAPPER=1.",
    blocked_or_failed.join("\n")
))
```

---

# 3. Phase C：项目区新建 Claude 会话默认打开气泡聊天

## C1. 修改 `runtimeBridge.ts`

文件：

```text
src/features/runtime/services/runtimeBridge.ts
```

找到：

```ts
useOpenSessionStore.getState().openSession({
  sessionId: session.id, projectId: session.projectId, projectName: input.projectName,
  title: session.name, status: 'starting', viewMode: 'terminal',
  pendingConfirms: 0, riskCount: 0, isPinned: false,
});
```

替换为：

```ts
useOpenSessionStore.getState().openSession({
  sessionId: session.id,
  projectId: session.projectId,
  projectName: input.projectName,
  title: session.name,
  status: 'starting',
  viewMode: 'chat',
  pendingConfirms: 0,
  riskCount: 0,
  isPinned: false,
});
```

## C2. Workspace 顶部模式同步

确保 `WorkspaceSurface` 里，如果 tab `viewMode === 'chat'`，默认激活气泡聊天，不自动切终端。  
如果代码里有 `activeView = 'terminal'` 的 fallback，改成：

```ts
const activeView = activeTab?.viewMode ?? 'chat';
```

## C3. 保留终端作为高级选项

不要删除终端。Workspace 顶部仍保留：

```text
对话 / 终端 / 分屏
```

但新建会话默认进入：

```text
对话
```

---

# 4. Phase D：修复 failed/discovery-failed 后仍然刷提示

当前 `usePtyTerminal.ts` 已经有 deadRef，但 Chat 气泡输入也可能调用 `RuntimeBridge.write()`。因此必须在 ChatComposer 侧也加 guard。

## D1. 搜索所有写入入口

执行：

```bash
rg "RuntimeBridge.write|\.write\(" src/surfaces src/features -g "*.tsx" -g "*.ts"
```

除 `usePtyTerminal.ts` 外，找到 chat composer / Workspace send handler。

## D2. 在 Workspace send handler 加统一 guard

在发送前加入：

```ts
import { useRuntimeStore } from '../../features/runtime/stores/runtimeStore';
import { isRuntimeWritable } from '../../features/runtime/types/runtimeTypes';
```

发送函数中：

```ts
const rt = useRuntimeStore.getState().sessions[activeSessionId];

if (!rt || !isRuntimeWritable(rt.status)) {
  appendAssistantSystemMessage?.(
    activeSessionId,
    `Claude Runtime 尚未连接：${rt?.status ?? 'missing'}。请先在设置 → 诊断中修复环境配置，然后重新新建会话。`
  );
  return;
}
```

如果没有 `appendAssistantSystemMessage`，就在当前 messages store 或本地 UI 状态加入一条 system bubble。不要再把失败写到 xterm。

---

# 5. Phase E：Settings 权限中心全面重构

后端已有 permission center 命令：

```text
check_permission
set_auto_trust_level
list_permission_rules
add_allow_tool
add_deny_pattern
```

这些命令已经在 `main.rs` 注册。前端必须接起来。

## E1. 新建 `src/features/permissions/stores/permissionStore.ts`

```ts
import { create } from 'zustand';
import { invokeCommand } from '../../../services/invokeCommand';

export interface PermissionRule {
  id?: string;
  kind?: 'allow' | 'deny';
  pattern?: string;
  tool?: string;
  value?: string;
  createdAt?: string;
}

interface PermissionState {
  rules: PermissionRule[];
  loading: boolean;
  error: string | null;
  autoTrust: number;

  refresh: () => Promise<void>;
  setAutoTrust: (level: number) => Promise<void>;
  addAllowTool: (tool: string) => Promise<void>;
  addDenyPattern: (pattern: string) => Promise<void>;
  check: (tool: string, input?: unknown) => Promise<unknown>;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  rules: [],
  loading: false,
  error: null,
  autoTrust: Number(localStorage.getItem('ctrl-cc-autoTrust') ?? 0),

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const rules = await invokeCommand<PermissionRule[]>('list_permission_rules').catch(() => []);
      set({ rules, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  setAutoTrust: async (level) => {
    localStorage.setItem('ctrl-cc-autoTrust', String(level));
    set({ autoTrust: level });
    await invokeCommand('set_auto_trust_level', { level }).catch(() => {});
  },

  addAllowTool: async (tool) => {
    if (!tool.trim()) return;
    await invokeCommand('add_allow_tool', { tool: tool.trim() });
    await get().refresh();
  },

  addDenyPattern: async (pattern) => {
    if (!pattern.trim()) return;
    await invokeCommand('add_deny_pattern', { pattern: pattern.trim() });
    await get().refresh();
  },

  check: async (tool, input) => {
    return invokeCommand('check_permission', { tool, input: input ?? null });
  },
}));
```

## E2. 新建 `src/surfaces/settings/PermissionCenterCard.tsx`

```tsx
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
    <CcCard className="cc-section-card">
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
```

## E3. 修改 `SettingsSurface.tsx`

删除旧权限中心卡片：

```tsx
{/* Permission Center */}
<CcCard ...>
...
</CcCard>
```

导入：

```ts
import { PermissionCenterCard } from './PermissionCenterCard';
```

替换为：

```tsx
<PermissionCenterCard />
```

---

# 6. Phase F：统一响应式视觉系统，解决卡片挤、空、散

## F1. 新增 CSS 文件

```text
src/styles/surface-responsive.css
```

写入：

```css
.cc-surface-stack {
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 1.5vw, 20px);
}

.cc-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: clamp(16px, 2vw, 24px);
}

.cc-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
  gap: clamp(10px, 1vw, 14px);
  margin-bottom: 14px;
}

.cc-two-column-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
  gap: clamp(14px, 1.4vw, 18px);
}

.cc-section-card {
  padding: clamp(14px, 1.4vw, 18px) !important;
}

.cc-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.cc-card-title {
  margin: 0;
  font-size: var(--cc-font-md);
  font-weight: 650;
  color: var(--cc-text);
}

.cc-card-subtitle {
  margin: 4px 0 0;
  color: var(--cc-text-muted);
  font-size: var(--cc-font-xs);
  line-height: 1.45;
}

.cc-kv-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cc-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 12px 18px;
}

.cc-setting-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.cc-setting-field label {
  color: var(--cc-text-soft);
  font-size: var(--cc-font-xs);
  font-weight: 600;
}

.cc-setting-field input,
.cc-setting-field select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid var(--cc-border);
  border-radius: var(--cc-radius-sm);
  background: var(--cc-bg);
  color: var(--cc-text);
}

.cc-setting-field small {
  color: var(--cc-text-muted);
  font-size: var(--cc-font-3xs);
}

.cc-inline-form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cc-inline-form input {
  flex: 1;
}

.cc-empty-hint {
  padding: 12px;
  border: 1px dashed var(--cc-border);
  border-radius: var(--cc-radius-md);
  background: var(--cc-bg-muted);
  color: var(--cc-text-muted);
  font-size: var(--cc-font-xs);
  line-height: 1.5;
}

.cc-inline-error {
  padding: 8px 10px;
  border-radius: var(--cc-radius-sm);
  background: var(--cc-bg-danger-soft);
  color: var(--cc-red);
  font-size: var(--cc-font-xs);
  margin-bottom: 10px;
}

.cc-rule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.cc-rule-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--cc-radius-sm);
  border: 1px solid var(--cc-border);
  background: var(--cc-bg);
  font-size: var(--cc-font-xs);
}

.cc-rule-row.allow span { color: var(--cc-green); }
.cc-rule-row.deny span { color: var(--cc-red); }

.cc-table-scroll {
  width: 100%;
  overflow-x: auto;
  border-radius: var(--cc-radius-sm);
}

.cc-trace-line {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .cc-hero {
    flex-direction: column;
  }

  .cc-stat-grid {
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  }

  .cc-inline-form {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (min-width: 1400px) {
  .cc-stat-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
```

## F2. 导入 CSS

在：

```text
src/index.css
```

末尾添加：

```css
@import './styles/surface-responsive.css';
```

如果项目不允许在 CSS 末尾 `@import`，则在 `src/main.tsx` 或 `src/App.tsx` 中加入：

```ts
import './styles/surface-responsive.css';
```

---

## F3. 修改 `SurfacePage.tsx`

当前 `dashboard maxWidth=1320` 容易显得挤。改成：

```ts
const maxWidthMap = {
  dashboard: 1420,
  management: 1500,
  workspace: 'none',
  diagnostics: 1360,
};
```

内层 padding 改成：

```ts
padding: 'clamp(18px, 2.2vw, 34px)',
```

---

## F4. 修改 ConsoleSurface 使用 class

把 hero 区：

```tsx
<div style={{ marginBottom: 24 }}>
```

改为：

```tsx
<div className="cc-hero">
  <div>
    ...
  </div>
</div>
```

把 stats 外层尽量改成：

```tsx
<div className="cc-stat-grid">
  ...
</div>
```

把两列架构/环境外层改成：

```tsx
<div className="cc-two-column-grid">
  ...
</div>
```

如果继续使用 `ResponsiveGrid`，也要把 `min={160}` 提高：

```tsx
<ResponsiveGrid min={175} gap={14}>
```

架构/环境：

```tsx
<ResponsiveGrid min={460} gap={18}>
```

---

## F5. 修改 SettingsSurface

所有 `CcCard style={{ padding: 16, marginBottom: 16 }}` 改为：

```tsx
<CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
```

环境检测 grid 改为：

```tsx
<div className="cc-settings-grid">
```

权限中心由 `PermissionCenterCard` 接管。

---

# 7. Phase G：Diagnostics 状态修复

当前在 discovery-failed 且 backend=0 时仍可能显示 `CONTRACTS PASSED`，容易误导。改成更准确：

修改 `RuntimeDiagnosticsPanel.tsx` 的 `getContractStatus()`：

```ts
const failedFrontendCount = probe.frontendSessions.filter((s) =>
  ['failed', 'discovery-failed'].includes(s.status)
).length;

if (failedFrontendCount > 0) {
  return {
    label: `${failedFrontendCount} STARTUP FAILED`,
    tone: 'error' as const,
    detail: 'One or more RuntimeSessions failed before backend PTY creation.',
  };
}
```

插入位置：在 `frontendCount === 0 && backendCount === 0` 之后，`mismatchCount > 0` 之前。

---

# 8. Phase H：Workspace Startup Failed 卡片不要过长

当前错误长文本横向撑开。修改失败卡片：

```tsx
<div className="runtime-startup-failure">
```

增加 style 或 CSS：

```css
.runtime-startup-failure {
  margin: 12px;
  padding: 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-bg-danger-soft);
  border: 1px solid var(--cc-red-soft, var(--cc-red));
  color: var(--cc-text);
  max-width: 100%;
  overflow: hidden;
}

.runtime-startup-failure pre,
.runtime-startup-failure code,
.runtime-startup-failure p {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
```

---

# 9. 构建验证

执行：

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

# 10. 本地手动诊断 Claude 路径

如果 Diagnostics 仍然没有 direct-node plan，在 Windows PowerShell 中运行：

```powershell
where.exe node
where.exe npx
where.exe claude
Get-Content "$env:APPDATA\npm\claude.cmd" -TotalCount 160
Get-Content "$env:APPDATA\npm\claude.ps1" -TotalCount 160
dir "$env:APPDATA\npm\node_modules" -Recurse -Include cli.js,cli.mjs,index.js,index.mjs,claude.js,claude.mjs |
  Where-Object { $_.FullName -match "claude" } |
  Select-Object -First 80 FullName
```

如果得到真实 JS path：

```powershell
setx CTRL_CC_CLAUDE_JS "真实路径"
```

重启 Ctrl-CC。

临时 fallback：

```powershell
setx CTRL_CC_ALLOW_SHELL_WRAPPER 1
```

注意：这可能重新触发 powershell/cmd 0xc0000142，只作为临时验证。

---

# 11. 最终验收清单

```text
[ ] Console 不再启动自动环境检测。
[ ] Settings 不再打开时自动环境检测。
[ ] Console 环境卡右上角有“检测环境配置 / 刷新环境配置”。
[ ] Console 与 Settings 使用同一份 EnvironmentStore 数据。
[ ] Diagnostics 显示 Claude JS Candidates 与 direct-node-npx fallback。
[ ] 项目区新建 Claude 会话默认进入气泡聊天 viewMode=chat。
[ ] discovery-failed 后 chat 输入与 terminal 输入都不再刷 Runtime not writable。
[ ] Settings 权限中心可以刷新规则、设置 AutoTrust、添加白名单工具、添加黑名单规则。
[ ] Runtime Diagnostics 对 discovery-failed 显示 STARTUP FAILED，而不是 CONTRACTS PASSED。
[ ] Console / Settings / Diagnostics / Projects / Resources 在小窗口和全屏下布局自适应，不再卡片挤压或空散。
```

---

# 12. 发给 Claude CLI / Codex 的严格 Prompt

```text
执行 Ctrl-CC 17.0 全面稳定修复与响应式产品升级。严格按文档顺序执行，不允许自由重构，不允许切换到 features/*/pages 半成品页面。

必须完成：

1. 新增 src/features/environment/stores/environmentStore.ts。
   - 统一环境检测数据源。
   - loadCached 只读缓存，不自动检测。
   - refresh 手动调用 claude_check_capability、runtime_discover_claude_v2、runtime_find_claude_js_candidates。
   - Console 与 Settings 共用它。

2. 修改 ConsoleSurface.tsx。
   - 删除 useEffect 自动 claude_check_capability。
   - 环境检测卡右上角添加按钮。
   - 无环境信息时显示“检测环境配置”；已有时显示“刷新环境配置”。
   - 使用 EnvironmentStore。

3. 修改 SettingsSurface.tsx。
   - 删除打开页面自动检测。
   - 环境检测卡使用 EnvironmentStore。
   - 清除环境缓存按钮。
   - 删除旧静态权限中心，改用 PermissionCenterCard。

4. 修改 claude_discovery.rs。
   - 新增 find_npx_cli_js。
   - collect_launch_plans 加 direct-node-npx-anthropic-claude-code 与 direct-node-npx-claude-code。
   - select_launch_plan 错误信息包含 direct-node/npx fallback 失败说明。

5. 修改 runtimeBridge.ts。
   - openSession 默认 viewMode 改为 'chat'。
   - 使项目区新建会话自动跳转气泡聊天界面。

6. 修复所有 Chat 发送入口。
   - 搜索 RuntimeBridge.write。
   - 在 chat send handler 中检查 isRuntimeWritable。
   - discovery-failed/failed/exited/killed/disconnected 时不写入后端，只显示 system bubble。

7. 新增 permissionStore.ts 与 PermissionCenterCard.tsx。
   - 接入 list_permission_rules、set_auto_trust_level、add_allow_tool、add_deny_pattern、check_permission。
   - Settings 使用真实权限中心。

8. 新增 src/styles/surface-responsive.css 并导入。
   - 修复卡片挤、空、散。
   - 增加 cc-hero、cc-stat-grid、cc-two-column-grid、cc-section-card、cc-settings-grid、cc-table-scroll 等类。
   - SurfacePage maxWidth 调整为 dashboard 1420、management 1500、diagnostics 1360。

9. RuntimeDiagnosticsPanel 修复。
   - discovery-failed 显示 STARTUP FAILED，不显示 CONTRACTS PASSED。
   - 表格外层用 cc-table-scroll。
   - 长错误文本 word-break/overflow-wrap。

10. Workspace startup failed 卡片修复。
    - 长错误自动换行。
    - 清晰提示 CTRL_CC_CLAUDE_JS、Diagnostics、Copy Error。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

最终验收：
- 首次启动不自动环境检测。
- Console 环境卡可手动检测/刷新。
- Settings 与 Console 环境信息同步。
- 新建 Claude 会话默认进入气泡聊天。
- Chat Runtime failed 不刷屏。
- Permissions Center 功能真实可用。
- 页面在小窗/全屏都自适应、美观、集中。
```

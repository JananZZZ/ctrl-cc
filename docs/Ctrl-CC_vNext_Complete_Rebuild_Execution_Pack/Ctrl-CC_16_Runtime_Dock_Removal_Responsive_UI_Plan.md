# Ctrl-CC 16.0 稳定修复与自适应 UI 重整执行文档

适用仓库：`https://github.com/JananZZZ/ctrl-cc/tree/master`  
建议分支：

```bash
git checkout master
git pull origin master
git checkout -b fix/runtime-dock-layout-16
```

本轮目标：

1. 修复 `No policy-allowed runnable Claude launch plan was found`。
2. 删除主程序内部右侧悬浮 AI Dock；后续 AI Dock 只允许独立窗口实现。
3. 修复 `discovery-failed` 后仍可输入和 RuntimeTrace 刷屏。
4. 修复 Console / Settings / Diagnostics / Projects / Resources 在不同窗口尺寸下的排版问题。
5. 建立统一响应式页面系统：小窗口聚焦、中窗口双栏、大窗口集中式信息面板，避免空、散、左侧局限。

---

# 1. 当前代码审计结论

## 1.1 主窗口内部仍然挂载 AIDock

`src/app/AppShell.tsx` 当前仍然导入并渲染：

```tsx
import { AIDock } from '../components/dock/AIDock';
...
<AIDock onOpenErrorLog={() => setShowLogPanel(true)} errorCount={unresolvedCount} />
```

这是右侧程序内悬浮栏仍然存在的直接原因。必须从 `AppShell` 移除。

## 1.2 AIDock 当前是 fixed widget，不是独立 Dock

`src/components/dock/AIDock.tsx` 当前核心样式是：

```tsx
position: 'fixed',
right: 0,
top: '50%',
transform: 'translateY(-50%)',
height: '50vh'
```

这与目标冲突。最终 AI Dock 应是独立 Tauri window，贴附电脑屏幕右侧，通过 DockSnapshot 和 DockActionBridge 与主窗口通信。

## 1.3 SurfaceHost 已恢复旧 surfaces，方向正确

`SurfaceHost.tsx` 已挂载旧版 `src/surfaces/*`，这是正确方向。不要再切换到 `src/features/*/pages` 半成品页面。

## 1.4 Claude 启动失败的根因

当前错误是：

```text
windows-powershell-ps1 blocked
cmd-claude-cmd blocked
No policy-allowed runnable Claude launch plan was found
```

说明 shell wrapper 已被禁用，但 direct Node.js + Claude CLI JS entry 没有找到。下一步不是放开 powershell，而是增强 direct-node JS 探测，并把 JS candidates 清晰显示出来。

---

# 2. Phase A：移除主窗口内部 AI Dock

## A1. 修改 `src/app/AppShell.tsx`

用下面完整内容替换：

```tsx
import { useState } from 'react';
import { LeftSurfaceRail } from '../components/layout/LeftSurfaceRail';
import { SurfaceHost } from './SurfaceHost';
import { ErrorToast, ErrorModal, ErrorLogPanel } from '../components/error';
import { useErrorStore } from '../stores/errorStore';
import { useRenderLoopGuard } from '../debug/useRenderLoopGuard';

export function AppShell() {
  useRenderLoopGuard('AppShell');
  const [showLogPanel, setShowLogPanel] = useState(false);
  const unresolvedCount = useErrorStore((s) => s.errors.filter((e) => !e.dismissed).length);

  return (
    <div
      data-testid="app-shell"
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        background: 'var(--cc-bg)',
      }}
    >
      <LeftSurfaceRail />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--cc-bg)',
        }}
      >
        <SurfaceHost />
      </div>

      <ErrorToast onOpenLog={() => setShowLogPanel(true)} />
      <ErrorModal />
      <ErrorLogPanel open={showLogPanel} onClose={() => setShowLogPanel(false)} />
    </div>
  );
}
```

执行结果：

```text
删除 import AIDock
删除 <AIDock />
主程序内右侧悬浮栏消失
```

## A2. 暂时保留 `src/components/dock/AIDock.tsx`

不要删除文件，避免旧引用和 i18n 断裂；但主窗口不得挂载它。

---

# 3. Phase B：准备独立 AI Dock 架构

新增：

```text
src/features/dock/types/dockTypes.ts
src/features/dock/services/dockSnapshotBuilder.ts
```

## B1. `dockTypes.ts`

```ts
export type DockMode = 'quiet' | 'calm' | 'focus';

export interface DockSnapshot {
  generatedAt: string;
  mode: DockMode;
  runtime: {
    activeSessionCount: number;
    runningCount: number;
    errorCount: number;
    warningCount: number;
  };
  activeSession?: {
    id: string;
    title: string;
    status: string;
    cwd: string;
  } | null;
}
```

## B2. `dockSnapshotBuilder.ts`

```ts
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { useRuntimeTraceStore } from '../../runtime/stores/runtimeTraceStore';
import type { DockSnapshot } from '../types/dockTypes';

export function buildDockSnapshot(): DockSnapshot {
  const runtimeSessions = Object.values(useRuntimeStore.getState().sessions);
  const sessions = useSessionStore.getState().sessions;
  const traces = useRuntimeTraceStore.getState().events;

  const active = runtimeSessions.find((s) =>
    ['pty-ready', 'claude-active', 'idle', 'waiting-permission'].includes(s.status)
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: 'quiet',
    runtime: {
      activeSessionCount: runtimeSessions.length,
      runningCount: runtimeSessions.filter((s) =>
        ['pty-ready', 'claude-active', 'idle', 'waiting-permission'].includes(s.status)
      ).length,
      errorCount: traces.filter((t) => t.level === 'error').length,
      warningCount: traces.filter((t) => t.level === 'warning').length,
    },
    activeSession: active
      ? { id: active.id, title: active.name, status: active.status, cwd: active.cwd }
      : sessions[0]
        ? { id: sessions[0].id, title: sessions[0].title, status: sessions[0].status, cwd: sessions[0].cwd }
        : null,
  };
}
```

本轮只准备架构，不强行实现独立 Tauri Dock window。

---

# 4. Phase C：增强 Claude JS 查找

## C1. 修改 `src-tauri/src/runtime_v2/runtime_types.rs`

增加：

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeJsCandidate {
    pub path: String,
    pub exists: bool,
    pub source: String,
}
```

## C2. 修改 `src-tauri/src/runtime_v2/claude_discovery.rs`

增加 import：

```rust
use super::runtime_types::ClaudeJsCandidate;
```

新增 public 函数：

```rust
pub fn list_claude_js_candidates() -> Vec<ClaudeJsCandidate> {
    let mut out = Vec::new();

    if let Ok(v) = env::var("CTRL_CC_CLAUDE_JS") {
        let p = PathBuf::from(v.trim());
        out.push(ClaudeJsCandidate {
            path: p.to_string_lossy().to_string(),
            exists: p.exists(),
            source: "CTRL_CC_CLAUDE_JS".to_string(),
        });
    }

    if let Ok(appdata) = env::var("APPDATA") {
        let npm = PathBuf::from(appdata).join("npm");
        for p in known_js_candidates_under_npm_root(&npm) {
            out.push(ClaudeJsCandidate {
                exists: p.exists(),
                path: p.to_string_lossy().to_string(),
                source: "APPDATA npm known candidates".to_string(),
            });
        }

        let node_modules = npm.join("node_modules");
        let mut scanned = Vec::new();
        collect_claude_js_candidates(&node_modules, 0, &mut scanned);
        for p in scanned.into_iter().take(80) {
            out.push(ClaudeJsCandidate {
                exists: p.exists(),
                path: p.to_string_lossy().to_string(),
                source: "APPDATA npm recursive scan".to_string(),
            });
        }
    }

    if let Some(shim) = find_claude_cmd().or_else(find_claude_ps1) {
        if let Some(dir) = shim.parent() {
            for p in search_likely_claude_js_entries(dir) {
                out.push(ClaudeJsCandidate {
                    exists: p.exists(),
                    path: p.to_string_lossy().to_string(),
                    source: format!("shim dir scan: {}", shim.to_string_lossy()),
                });
            }
        }
    }

    let mut seen = std::collections::HashSet::new();
    out.into_iter()
        .filter(|c| seen.insert(c.path.clone()))
        .collect()
}

fn known_js_candidates_under_npm_root(npm_root: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    push_js_cands(&mut candidates, npm_root);
    candidates
}
```

把 `find_claude_cli_js()` 改成：

```rust
fn find_claude_cli_js() -> Option<PathBuf> {
    list_claude_js_candidates()
        .into_iter()
        .filter(|c| c.exists)
        .map(|c| PathBuf::from(c.path))
        .find(|p| p.exists())
}
```

注意：当前文件里辅助函数名可能是 `push_js_cands`、`collect_js`、`search_js_entries`，如果实际函数名不同，按当前文件名对应替换。原则是：`list_claude_js_candidates()` 必须复用当前已有扫描逻辑，并把所有候选路径暴露给前端。

## C3. 修改 `runtime_commands.rs`

把 import 改成：

```rust
use super::claude_discovery::{discover_claude, list_claude_js_candidates};
use super::runtime_types::ClaudeJsCandidate;
```

新增命令：

```rust
#[tauri::command]
pub fn runtime_find_claude_js_candidates() -> Vec<ClaudeJsCandidate> {
    list_claude_js_candidates()
}
```

## C4. 修改 `src-tauri/src/main.rs`

在 invoke handler 中增加：

```rust
runtime_v2::runtime_commands::runtime_find_claude_js_candidates,
```

---

# 5. Phase D：Diagnostics 显示 Claude JS Candidates

修改 `src/features/runtime/components/RuntimeDiagnosticsPanel.tsx`。

新增 state：

```ts
const [jsCandidates, setJsCandidates] = useState<Array<{ path: string; exists: boolean; source: string }>>([]);
```

在 discovery refresh 逻辑中增加：

```ts
invoke<Array<{ path: string; exists: boolean; source: string }>>('runtime_find_claude_js_candidates')
  .then(setJsCandidates)
  .catch(() => setJsCandidates([]));
```

在 Launch Plan Matrix 下方新增：

```tsx
<Section title="Claude JS Candidates">
  {jsCandidates.length === 0 ? (
    <p style={{ color: 'var(--cc-text-muted)' }}>No JS candidates found. Set CTRL_CC_CLAUDE_JS manually.</p>
  ) : (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ ...tableStyle, minWidth: 900 }}>
        <thead>
          <tr>
            <th style={thStyle}>Exists</th>
            <th style={thStyle}>Path</th>
            <th style={thStyle}>Source</th>
          </tr>
        </thead>
        <tbody>
          {jsCandidates.map((c) => (
            <tr key={c.path}>
              <td style={tdStyle}>{c.exists ? '✅' : '❌'}</td>
              <td style={tdStyle}><code>{c.path}</code></td>
              <td style={tdStyle}>{c.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</Section>
```

---

# 6. Phase E：failed / discovery-failed 输入拦截

修改 `src/features/terminal/usePtyTerminal.ts`。

增加：

```ts
import { useRuntimeStore } from '../runtime/stores/runtimeStore';
```

在 hook 内增加：

```ts
const lastBlockedInputAtRef = useRef(0);
const runtimeStatus = useRuntimeStore((s) => sessionId ? s.sessions[sessionId]?.status : undefined);
const runtimeError = useRuntimeStore((s) => sessionId ? s.sessions[sessionId]?.error : undefined);
```

新增 effect：

```ts
useEffect(() => {
  if (!runtimeStatus) return;

  if (['failed', 'discovery-failed', 'exited', 'killed', 'disconnected'].includes(runtimeStatus)) {
    deadRef.current = true;
    setStatus('failed');

    const term = termRef.current;
    if (term) {
      const now = Date.now();
      if (now - lastBlockedInputAtRef.current > 3000) {
        lastBlockedInputAtRef.current = now;
        term.writeln(
          `\x1b[33m[Ctrl-CC] Claude Runtime is not writable (${runtimeStatus}). ${runtimeError ?? 'Open diagnostics and start a new session.'}\x1b[0m`
        );
      }
    }
  }
}, [runtimeStatus, runtimeError]);
```

修改 `term.onData`：

```ts
term.onData((data) => {
  const current = useRuntimeStore.getState().sessions[sessionId];

  if (
    deadRef.current ||
    !current ||
    ['failed', 'discovery-failed', 'exited', 'killed', 'disconnected'].includes(current.status)
  ) {
    const now = Date.now();
    if (now - lastBlockedInputAtRef.current > 3000) {
      lastBlockedInputAtRef.current = now;
      term.writeln(
        `\x1b[33m[Ctrl-CC] Claude Runtime is not writable (${current?.status ?? 'missing'}). Fix Runtime Diagnostics, then start a new session.\x1b[0m`
      );
    }
    return;
  }

  RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
    const msg = String(e);
    warnLog('pty', 'PTY write failed', msg);
    if (msg.includes('not writable') || msg.includes('not ready') || msg.includes('exited') || msg.includes('os error 232') || msg.includes('管道')) {
      deadRef.current = true;
      setStatus('failed');
    }
    term.writeln(`\x1b[31m[Ctrl-CC] Write failed: ${msg}\x1b[0m`);
  });
});
```

---

# 7. Phase F：RuntimeBridge not_ready 限流

修改 `src/features/runtime/services/runtimeBridge.ts`。

在文件顶部增加：

```ts
const notReadyWarnLastAt = new Map<string, number>();

function shouldRecordNotReady(uiSessionId: string, status: string): boolean {
  const key = `${uiSessionId}:${status}`;
  const now = Date.now();
  const last = notReadyWarnLastAt.get(key) ?? 0;
  if (now - last < 3000) return false;
  notReadyWarnLastAt.set(key, now);
  return true;
}
```

找到 `recordRuntimeWarning("runtime.write.not_ready", ...)`，改成：

```ts
if (shouldRecordNotReady(uiSessionId, session.status)) {
  recordRuntimeWarning(
    'runtime.write.not_ready',
    uiSessionId,
    session.ptySessionId,
    `Runtime not ready: ${session.status}`,
    session.traceId
  );
}
```

---

# 8. Phase G：统一响应式页面系统

## G1. 新增 `src/components/layout/SurfacePage.tsx`

```tsx
import type { CSSProperties, ReactNode } from 'react';

interface SurfacePageProps {
  children: ReactNode;
  variant?: 'dashboard' | 'management' | 'workspace' | 'diagnostics';
  style?: CSSProperties;
  testId?: string;
}

const maxWidthMap = {
  dashboard: 1320,
  management: 1440,
  workspace: 'none',
  diagnostics: 1280,
};

export function SurfacePage({ children, variant = 'dashboard', style, testId }: SurfacePageProps) {
  const maxWidth = maxWidthMap[variant];

  return (
    <div
      data-testid={testId}
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        background: 'var(--cc-bg)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth,
          minWidth: 0,
          margin: variant === 'workspace' ? 0 : '0 auto',
          padding: 'clamp(16px, 2vw, 28px)',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

## G2. 新增 `src/components/layout/ResponsiveGrid.tsx`

```tsx
import type { ReactNode } from 'react';

export function ResponsiveGrid({
  children,
  min = 280,
  gap = 16,
}: {
  children: ReactNode;
  min?: number;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
        gap,
        alignItems: 'stretch',
      }}
    >
      {children}
    </div>
  );
}
```

## G3. 修改 `ConsoleSurface.tsx`

导入：

```ts
import { SurfacePage } from '../../components/layout/SurfacePage';
import { ResponsiveGrid } from '../../components/layout/ResponsiveGrid';
```

根容器改为：

```tsx
<SurfacePage variant="dashboard" testId="surface-console">
  {/* 原 console 内容 */}
</SurfacePage>
```

Stat grid 改成：

```tsx
<ResponsiveGrid min={160} gap={12}>
  ...Stat cards...
</ResponsiveGrid>
```

架构/环境区域改成：

```tsx
<ResponsiveGrid min={420} gap={16}>
  ...CcCard...
</ResponsiveGrid>
```

## G4. 修改 `SettingsSurface.tsx`

导入：

```ts
import { SurfacePage } from '../../components/layout/SurfacePage';
```

根容器改成：

```tsx
<SurfacePage variant="diagnostics" testId="surface-settings">
  {/* 原 settings 内容 */}
</SurfacePage>
```

删除原根容器中的 `maxWidth / height / overflow`。

## G5. 修改 `RuntimeDiagnosticsPanel.tsx`

所有大表格外层：

```tsx
<div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--cc-radius-sm)' }}>
  <table style={{ ...tableStyle, minWidth: 980 }}>
    ...
  </table>
</div>
```

Trace Timeline 长文本：

```tsx
<div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
```

## G6. 修改 `ProjectsSurface.tsx`

根容器：

```tsx
<div data-testid="surface-projects" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minWidth: 0 }}>
```

三栏容器：

```tsx
<div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
```

后续将 `ProjectManagementRail` 和 `SessionManagementRail` 根元素加 className：

```text
project-management-rail
session-management-rail
```

新增 CSS：

```css
@media (max-width: 1100px) {
  [data-testid="surface-projects"] .project-management-rail {
    display: none;
  }

  [data-testid="surface-projects"] .session-management-rail {
    width: 260px !important;
  }
}

@media (max-width: 760px) {
  [data-testid="surface-projects"] .session-management-rail {
    display: none;
  }
}
```

---

# 9. Phase H：Workspace 启动失败提示优化

在 `WorkspaceSurface.tsx` 或启动失败 banner 组件中加入：

```ts
function parseRuntimeStartupHint(error?: string | null) {
  if (!error) return null;

  if (error.includes('CTRL_CC_CLAUDE_JS') || error.includes('No policy-allowed runnable')) {
    return {
      title: 'Claude Runtime Startup Failed',
      summary: 'Ctrl-CC did not find a direct Node.js Claude CLI entry. Shell wrappers are blocked to avoid cmd/powershell startup crashes.',
      actions: [
        'Open Settings → Diagnostics → Claude JS Candidates.',
        'If no existing JS candidate is found, set CTRL_CC_CLAUDE_JS to the real Claude CLI JS entry.',
        'Temporary fallback only: set CTRL_CC_ALLOW_SHELL_WRAPPER=1.',
      ],
    };
  }

  return {
    title: 'Claude Runtime Startup Failed',
    summary: error,
    actions: ['Open diagnostics.', 'Copy diagnostic bundle.', 'Start a new session after fixing Runtime.'],
  };
}
```

显示为清晰卡片，提供 `Copy Error`。

---

# 10. Windows 本地诊断命令

```powershell
where.exe node
where.exe claude
Get-Content "$env:APPDATA\npm\claude.cmd" -TotalCount 120
Get-Content "$env:APPDATA\npm\claude.ps1" -TotalCount 120
dir "$env:APPDATA\npm\node_modules" -Recurse -Include cli.js,cli.mjs,index.js,index.mjs,claude.js,claude.mjs |
  Where-Object { $_.FullName -match "claude" } |
  Select-Object -First 50 FullName
```

如果找到真实 JS，例如：

```text
C:\Users\48304\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js
```

设置：

```powershell
setx CTRL_CC_CLAUDE_JS "C:\Users\48304\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js"
```

重启 Ctrl-CC。

临时 fallback：

```powershell
setx CTRL_CC_ALLOW_SHELL_WRAPPER 1
```

该 fallback 可能重新触发 `powershell.exe / cmd.exe 0xc0000142`，只用于临时验证。

---

# 11. 构建验证

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

# 12. 验收标准

## Runtime

```text
[ ] Settings → Diagnostics 显示 Claude JS Candidates。
[ ] 如果存在 JS candidate，Launch Plan Matrix 出现 direct-node-*。
[ ] 默认不 selected powershell/cmd。
[ ] discovery-failed 后 Terminal 不再持续刷 Runtime not writable。
[ ] RuntimeTrace 不再刷屏。
[ ] Contract Test 不再把 discovery-failed 误判为 backend mismatch。
```

## AI Dock

```text
[ ] 主程序右侧内部悬浮栏消失。
[ ] AppShell 不再 import AIDock。
[ ] AppShell 不再渲染 <AIDock />。
[ ] 后续独立 Dock 架构文件已准备，但不影响主窗口。
```

## UI

```text
[ ] Console 小窗口单列，大窗口集中 1320px 左右，不再空散。
[ ] Settings/Diagnostics 宽度合理，表格横向滚动。
[ ] Projects 三栏小窗口时自动隐藏侧栏。
[ ] Resources 保持满屏，左 list + 右 detail 不被 Dock 覆盖。
```

---

# 13. 给 Claude CLI 的严格执行 Prompt

```text
执行 Ctrl-CC 16.0 稳定修复与自适应 UI 重整。严格按文档顺序执行，不允许自由重构，不允许新建半成品 UI 页面。

第一步：移除主窗口内部 AI Dock。
- 修改 src/app/AppShell.tsx，删除 AIDock import 和 <AIDock /> 渲染。
- 保留 ErrorToast/ErrorModal/ErrorLogPanel。
- src/components/dock/AIDock.tsx 暂时保留但不挂载。

第二步：准备独立 Dock 架构。
- 新增 src/features/dock/types/dockTypes.ts。
- 新增 src/features/dock/services/dockSnapshotBuilder.ts。
- 本轮不强行创建 Tauri dock window，只准备架构。

第三步：增强 Claude JS 查找。
- 修改 src-tauri/src/runtime_v2/runtime_types.rs，增加 ClaudeJsCandidate。
- 修改 src-tauri/src/runtime_v2/claude_discovery.rs，新增 list_claude_js_candidates。
- find_claude_cli_js 改为从 list_claude_js_candidates 中选择 exists=true 的路径。
- 修改 runtime_commands.rs，增加 runtime_find_claude_js_candidates。
- 修改 main.rs 注册 runtime_find_claude_js_candidates。
- 修改 RuntimeDiagnosticsPanel.tsx，显示 Claude JS Candidates 表格。

第四步：修复 failed/discovery-failed 后仍能输入。
- 修改 src/features/terminal/usePtyTerminal.ts。
- 订阅 RuntimeStore session.status。
- failed/discovery-failed/exited/killed/disconnected 后 deadRef=true。
- onData 时若不可写，不调用 RuntimeBridge.write，只显示限流提示。

第五步：RuntimeBridge not_ready 限流。
- 修改 runtimeBridge.ts。
- 同一 uiSessionId + status，3 秒最多记录一次 runtime.write.not_ready。

第六步：统一响应式页面。
- 新增 SurfacePage.tsx。
- 新增 ResponsiveGrid.tsx。
- ConsoleSurface 使用 SurfacePage + ResponsiveGrid。
- SettingsSurface 使用 SurfacePage。
- RuntimeDiagnosticsPanel 大表格 overflowX auto，Trace 文本 wordBreak。
- ProjectsSurface 增加 width/minWidth，三栏小窗口时隐藏侧栏。
- ResourcesSurface 保持满屏，不被 Dock 覆盖。

第七步：Workspace 启动失败提示优化。
- 对 CTRL_CC_CLAUDE_JS / No policy-allowed runnable launch plan 错误显示清晰步骤。
- 提供 Copy Error。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

最终验收：
- 主程序内右侧悬浮 AI Dock 消失。
- Diagnostics 能显示 Claude JS Candidates。
- direct-node plan 能被找到或明确提示设置 CTRL_CC_CLAUDE_JS。
- discovery-failed 后不再刷 Runtime not writable。
- Console / Settings / Diagnostics / Projects / Resources 在小窗口和全屏下都自适应、集中、美观。
```

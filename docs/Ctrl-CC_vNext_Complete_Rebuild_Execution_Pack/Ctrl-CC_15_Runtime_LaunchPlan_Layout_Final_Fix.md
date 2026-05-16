# Ctrl-CC 15.0 最终稳定修复执行文档
## 修复 Claude Runtime 无法启动、No runnable launch plan、failed 后仍可输入、RuntimeTrace 时间显示、页面左侧局限与整体排版混乱

适用仓库：

```text
https://github.com/JananZZZ/ctrl-cc/tree/master
```

建议分支：

```bash
git checkout master
git pull origin master
git checkout -b fix/runtime-launch-plan-layout-15
```

---

## 0. 当前问题的准确判断

当前错误已经从“PTY 管道关闭”推进到更清晰的阶段：

```text
No policy-allowed runnable Claude launch plan was found.
Set CTRL_CC_CLAUDE_JS to Claude CLI JS path,
or set CTRL_CC_ALLOW_SHELL_WRAPPER=1 only as a temporary fallback.
```

这说明：

```text
1. runtime_v2 已经开始工作。
2. powershell/cmd wrapper 已经被策略禁止。
3. 但 direct node + Claude CLI JS 没有被成功发现。
4. 所以后端没有创建 PTY，backendPtyCount = 0。
5. 前端 session 进入 discovery-failed。
6. Terminal 输入栏仍然允许输入，于是继续出现 Runtime not writable / discovery-failed。
```

核心修复不是继续放开 powershell，而是：

```text
必须让 Ctrl-CC 自动找到 Claude CLI 的真实 JS entry，
并用 node.exe 直接启动，彻底绕过 powershell.exe / cmd.exe。
```

页面排版问题的直接原因：

```text
ConsoleSurface 根容器 maxWidth = 960
SettingsSurface 根容器 maxWidth = 900
RuntimeDiagnosticsPanel 放在 SettingsSurface 内部，被窄容器压缩
所以页面只占左侧一部分，看起来很空、很乱
```

---

# Phase 1：修复 Claude LaunchPlan，真正找到 Claude CLI JS

## 1.1 当前代码的问题

当前 `src-tauri/src/runtime_v2/claude_discovery.rs` 已经有 `resolve_node_plan_from_claude_shim()`，但仍然失败。主要风险是：

```text
1. read_to_string 可能因为 Windows shim 编码问题失败。
2. 只查 cli.js / bin/claude.js / index.js，不够鲁棒。
3. 没有扫描 cli.mjs / cli.cjs / bin/*.js / dist/*.js。
4. 只检查固定 package 路径，无法适应 Claude CLI 安装结构变化。
5. discover_claude() 仍把 shell wrappers 放进矩阵，但没有给用户一个明确的 direct-node 搜索报告。
```

## 1.2 完整替换 `src-tauri/src/runtime_v2/claude_discovery.rs`

用下面完整内容替换整个文件：

```rust
use std::env;
use std::path::{Path, PathBuf};

use super::claude_launch_plan::ClaudeLaunchPlan;
use super::process_canary::canary_program_owned;
use super::runtime_types::{ClaudeLaunchPlanDebug, RuntimeDiscoveryResult};

pub fn discover_claude() -> RuntimeDiscoveryResult {
    let mut debug = Vec::new();
    let mut selected: Option<ClaudeLaunchPlanDebug> = None;
    let mut errors = Vec::new();

    for plan in collect_launch_plans() {
        let policy_allowed = is_policy_allowed(&plan);
        let (canary_ok, version_ok, version_text, error) = if !policy_allowed {
            (
                false,
                false,
                None,
                Some("Blocked by Ctrl-CC policy: shell wrappers are disabled unless CTRL_CC_ALLOW_SHELL_WRAPPER=1".to_string()),
            )
        } else {
            match canary_launch_plan(&plan) {
                Ok(version) => (true, true, Some(version), None),
                Err(err) => (false, false, None, Some(err)),
            }
        };

        let mut item = ClaudeLaunchPlanDebug {
            id: plan.id.clone(),
            label: plan.label.clone(),
            program: plan.program.clone(),
            args_prefix: plan.args_prefix.clone(),
            canary_ok,
            version_ok,
            version_text,
            error: error.clone(),
            selected: false,
        };

        if selected.is_none() && item.canary_ok && item.version_ok {
            item.selected = true;
            selected = Some(item.clone());
        }

        if let Some(e) = error {
            errors.push(format!("{}: {}", plan.id, e));
        }

        debug.push(item);
    }

    RuntimeDiscoveryResult { selected, plans: debug, errors }
}

pub fn select_launch_plan() -> Result<ClaudeLaunchPlan, String> {
    let mut blocked_or_failed = Vec::new();

    for plan in collect_launch_plans() {
        if !is_policy_allowed(&plan) {
            blocked_or_failed.push(format!(
                "{}: Blocked by Ctrl-CC policy: shell wrappers are disabled unless CTRL_CC_ALLOW_SHELL_WRAPPER=1",
                plan.id
            ));
            continue;
        }

        match canary_launch_plan(&plan) {
            Ok(_) => return Ok(plan),
            Err(err) => blocked_or_failed.push(format!("{}: {}", plan.id, err)),
        }
    }

    Err(format!(
        "{}\nNo policy-allowed runnable Claude launch plan was found.\n\
         Fix: Ctrl-CC must start Claude via direct Node.js, not cmd/powershell.\n\
         Set CTRL_CC_CLAUDE_JS to the real Claude CLI JS file, or install Claude Code globally.\n\
         Temporary fallback only: set CTRL_CC_ALLOW_SHELL_WRAPPER=1.",
        blocked_or_failed.join("\n")
    ))
}

fn is_policy_allowed(plan: &ClaudeLaunchPlan) -> bool {
    if env::var("CTRL_CC_ALLOW_SHELL_WRAPPER").ok().as_deref() == Some("1") {
        return true;
    }

    !(plan.id.contains("powershell") || plan.id.contains("pwsh") || plan.id.contains("cmd"))
}

fn collect_launch_plans() -> Vec<ClaudeLaunchPlan> {
    let mut plans = Vec::new();

    if let Some(plan) = plan_from_user_js_override() {
        plans.push(plan);
    }

    if let Some(plan) = plan_from_user_command_override() {
        plans.push(plan);
    }

    if let (Some(node), Some(cli_js)) = (find_node_exe(), find_claude_cli_js()) {
        plans.push(ClaudeLaunchPlan {
            id: "direct-node-js".to_string(),
            label: "Direct Node.js + Claude CLI JS".to_string(),
            program: node.to_string_lossy().to_string(),
            args_prefix: vec![cli_js.to_string_lossy().to_string()],
            reason: "Direct JS path found from known npm global locations".to_string(),
        });
    }

    if let Some(plan) = resolve_node_plan_from_claude_shim() {
        plans.push(plan);
    }

    for plan in scan_node_modules_for_claude_js() {
        plans.push(plan);
    }

    if let Some(claude_exe) = find_on_path("claude.exe") {
        plans.push(ClaudeLaunchPlan {
            id: "native-claude-exe".to_string(),
            label: "Native claude.exe".to_string(),
            program: claude_exe.to_string_lossy().to_string(),
            args_prefix: vec![],
            reason: "Native executable".to_string(),
        });
    }

    if let Some(pwsh) = find_on_path("pwsh.exe") {
        if let Some(ps1) = find_claude_ps1() {
            plans.push(ClaudeLaunchPlan {
                id: "pwsh-ps1".to_string(),
                label: "PowerShell Core + claude.ps1".to_string(),
                program: pwsh.to_string_lossy().to_string(),
                args_prefix: vec![
                    "-NoLogo".into(),
                    "-NoProfile".into(),
                    "-ExecutionPolicy".into(),
                    "Bypass".into(),
                    "-File".into(),
                    ps1.to_string_lossy().to_string(),
                ],
                reason: "Shell wrapper fallback".to_string(),
            });
        }
    }

    let windows_ps = PathBuf::from(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe");
    if windows_ps.exists() {
        if let Some(ps1) = find_claude_ps1() {
            plans.push(ClaudeLaunchPlan {
                id: "windows-powershell-ps1".to_string(),
                label: "Windows PowerShell + claude.ps1".to_string(),
                program: windows_ps.to_string_lossy().to_string(),
                args_prefix: vec![
                    "-NoLogo".into(),
                    "-NoProfile".into(),
                    "-ExecutionPolicy".into(),
                    "Bypass".into(),
                    "-File".into(),
                    ps1.to_string_lossy().to_string(),
                ],
                reason: "Shell wrapper fallback".to_string(),
            });
        }
    }

    if let Some(cmd) = find_cmd_exe() {
        if let Some(cmd_shim) = find_claude_cmd() {
            plans.push(ClaudeLaunchPlan {
                id: "cmd-claude-cmd".to_string(),
                label: "cmd.exe + claude.cmd".to_string(),
                program: cmd.to_string_lossy().to_string(),
                args_prefix: vec!["/d".into(), "/s".into(), "/c".into(), cmd_shim.to_string_lossy().to_string()],
                reason: "Shell wrapper fallback".to_string(),
            });
        }
    }

    dedupe_plans(plans)
}

fn dedupe_plans(plans: Vec<ClaudeLaunchPlan>) -> Vec<ClaudeLaunchPlan> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for p in plans {
        let key = format!("{}|{}", p.program, p.args_prefix.join("|"));
        if seen.insert(key) {
            out.push(p);
        }
    }

    out
}

fn plan_from_user_js_override() -> Option<ClaudeLaunchPlan> {
    let js = env::var("CTRL_CC_CLAUDE_JS").ok()?;
    let p = PathBuf::from(js.trim());
    if !p.exists() {
        return None;
    }

    let node = find_node_exe()?;
    Some(ClaudeLaunchPlan {
        id: "user-override-claude-js".to_string(),
        label: "User override Claude JS".to_string(),
        program: node.to_string_lossy().to_string(),
        args_prefix: vec![p.to_string_lossy().to_string()],
        reason: "CTRL_CC_CLAUDE_JS".to_string(),
    })
}

fn plan_from_user_command_override() -> Option<ClaudeLaunchPlan> {
    let command = env::var("CTRL_CC_CLAUDE_COMMAND").ok()?;
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(ClaudeLaunchPlan {
        id: "user-override-command".to_string(),
        label: "User override command".to_string(),
        program: trimmed.to_string(),
        args_prefix: vec![],
        reason: "CTRL_CC_CLAUDE_COMMAND".to_string(),
    })
}

fn canary_launch_plan(plan: &ClaudeLaunchPlan) -> Result<String, String> {
    let args = plan.version_args();
    canary_program_owned(&plan.program, &args)
}

fn find_node_exe() -> Option<PathBuf> {
    find_on_path("node.exe")
        .or_else(|| {
            let p = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
            p.exists().then_some(p)
        })
        .or_else(|| {
            let local = env::var("LOCALAPPDATA").ok().map(PathBuf::from)?;
            let p = local.join(r"Programs\nodejs\node.exe");
            p.exists().then_some(p)
        })
}

fn find_cmd_exe() -> Option<PathBuf> {
    if let Ok(comspec) = env::var("ComSpec") {
        let p = PathBuf::from(comspec);
        if p.exists() {
            return Some(p);
        }
    }

    let p = PathBuf::from(r"C:\Windows\System32\cmd.exe");
    p.exists().then_some(p)
}

fn find_claude_cli_js() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        let npm = PathBuf::from(appdata).join("npm");
        push_known_js_candidates(&mut candidates, &npm);
    }

    if let Ok(prefix) = env::var("NPM_CONFIG_PREFIX") {
        push_known_js_candidates(&mut candidates, &PathBuf::from(prefix));
    }

    candidates.into_iter().find(|p| p.exists())
}

fn push_known_js_candidates(candidates: &mut Vec<PathBuf>, npm_root_or_prefix: &Path) {
    let package_roots = [
        npm_root_or_prefix.join(r"node_modules\@anthropic-ai\claude-code"),
        npm_root_or_prefix.join(r"node_modules\@anthropic-ai\claude"),
        npm_root_or_prefix.join(r"node_modules\claude-code"),
        npm_root_or_prefix.join(r"node_modules\claude"),
    ];

    let entry_names = [
        "cli.js", "cli.mjs", "cli.cjs", "index.js", "index.mjs",
        "bin/claude.js", "bin/claude.mjs", "bin/cli.js", "dist/cli.js", "dist/index.js",
    ];

    for root in package_roots {
        for entry in entry_names {
            candidates.push(root.join(entry));
        }
    }
}

fn find_claude_ps1() -> Option<PathBuf> {
    env::var("APPDATA")
        .ok()
        .map(PathBuf::from)
        .map(|p| p.join(r"npm\claude.ps1"))
        .filter(|p| p.exists())
        .or_else(|| find_on_path("claude.ps1"))
}

fn find_claude_cmd() -> Option<PathBuf> {
    env::var("APPDATA")
        .ok()
        .map(PathBuf::from)
        .map(|p| p.join(r"npm\claude.cmd"))
        .filter(|p| p.exists())
        .or_else(|| find_on_path("claude.cmd"))
}

fn resolve_node_plan_from_claude_shim() -> Option<ClaudeLaunchPlan> {
    let shim = find_claude_cmd().or_else(find_claude_ps1).or_else(|| find_on_path("claude"));
    let shim = shim?;
    let node = find_node_exe()?;

    let bytes = std::fs::read(&shim).ok()?;
    let content = String::from_utf8_lossy(&bytes).to_string();
    let shim_dir = shim.parent()?.to_path_buf();

    if let Some(js) = parse_js_entry_from_shim_content(&content, &shim_dir) {
        if js.exists() {
            return Some(ClaudeLaunchPlan {
                id: "direct-node-from-shim".to_string(),
                label: "Direct Node.js resolved from Claude shim".to_string(),
                program: node.to_string_lossy().to_string(),
                args_prefix: vec![js.to_string_lossy().to_string()],
                reason: format!("Resolved from shim {}", shim.to_string_lossy()),
            });
        }
    }

    for js in search_likely_claude_js_entries(&shim_dir) {
        return Some(ClaudeLaunchPlan {
            id: "direct-node-from-shim-search".to_string(),
            label: "Direct Node.js resolved by searching shim directory".to_string(),
            program: node.to_string_lossy().to_string(),
            args_prefix: vec![js.to_string_lossy().to_string()],
            reason: format!("Searched below {}", shim_dir.to_string_lossy()),
        });
    }

    None
}

fn parse_js_entry_from_shim_content(content: &str, shim_dir: &Path) -> Option<PathBuf> {
    let normalized = content.replace('/', "\\");
    let markers = [
        "node_modules\\@anthropic-ai\\claude-code\\",
        "node_modules\\@anthropic-ai\\claude\\",
        "node_modules\\claude-code\\",
        "node_modules\\claude\\",
    ];

    for marker in markers {
        if let Some(idx) = normalized.find(marker) {
            let tail = &normalized[idx..];
            let mut end = tail.len();
            for sep in ['"', '\'', ' ', '\r', '\n', '`'] {
                if let Some(pos) = tail.find(sep) {
                    end = end.min(pos);
                }
            }
            let rel = &tail[..end];
            if rel.ends_with(".js") || rel.ends_with(".mjs") || rel.ends_with(".cjs") {
                return Some(shim_dir.join(rel));
            }
        }
    }

    None
}

fn search_likely_claude_js_entries(base: &Path) -> Vec<PathBuf> {
    let roots = [base.join("node_modules"), base.join(r"node_modules\@anthropic-ai")];
    let mut out = Vec::new();

    for root in roots {
        collect_claude_js_candidates(&root, 0, &mut out);
    }

    out
}

fn collect_claude_js_candidates(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 6 || out.len() >= 20 || !dir.exists() {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(v) => v,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_lowercase();

        if path.is_dir() {
            if name.contains("claude") || name == "@anthropic-ai" || depth > 0 {
                collect_claude_js_candidates(&path, depth + 1, out);
            }
            continue;
        }

        let p = path.to_string_lossy().to_lowercase();
        let likely_name =
            name == "cli.js" || name == "cli.mjs" || name == "index.js" || name == "index.mjs" ||
            name == "claude.js" || name == "claude.mjs";

        if likely_name && p.contains("claude") {
            out.push(path);
        }
    }
}

fn scan_node_modules_for_claude_js() -> Vec<ClaudeLaunchPlan> {
    let node = match find_node_exe() {
        Some(v) => v,
        None => return Vec::new(),
    };

    let mut roots = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        roots.push(PathBuf::from(appdata).join("npm").join("node_modules"));
    }

    if let Ok(prefix) = env::var("NPM_CONFIG_PREFIX") {
        roots.push(PathBuf::from(prefix).join("node_modules"));
    }

    let mut plans = Vec::new();

    for root in roots {
        let mut entries = Vec::new();
        collect_claude_js_candidates(&root, 0, &mut entries);

        for js in entries.into_iter().take(5) {
            plans.push(ClaudeLaunchPlan {
                id: "direct-node-scanned-js".to_string(),
                label: "Direct Node.js discovered by scanning npm modules".to_string(),
                program: node.to_string_lossy().to_string(),
                args_prefix: vec![js.to_string_lossy().to_string()],
                reason: format!("Scanned {}", root.to_string_lossy()),
            });
        }
    }

    plans
}

fn find_on_path(exe: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    for dir in env::split_paths(&path) {
        let candidate = dir.join(exe);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}
```

---

# Phase 2：修复 Terminal 输入 guard，discovery-failed 后禁止继续输入

文件：

```text
src/features/terminal/usePtyTerminal.ts
```

## 2.1 增加 import

在 import 区增加：

```ts
import { useRuntimeStore } from '../runtime/stores/runtimeStore';
```

## 2.2 增加 runtimeStatus / runtimeError 订阅

在：

```ts
const deadRef = useRef(false);
const [status, setStatus] = useState<PtyStatus>('idle');
```

后面增加：

```ts
const runtimeStatus = useRuntimeStore((s) =>
  sessionId ? s.sessions[sessionId]?.status : undefined
);
const runtimeError = useRuntimeStore((s) =>
  sessionId ? s.sessions[sessionId]?.error : undefined
);
```

## 2.3 增加 failed/discovery-failed 同步 effect

在 xterm 初始化 effect 前面增加：

```ts
useEffect(() => {
  if (!runtimeStatus) return;

  if (
    runtimeStatus === 'failed' ||
    runtimeStatus === 'discovery-failed' ||
    runtimeStatus === 'exited' ||
    runtimeStatus === 'killed' ||
    runtimeStatus === 'disconnected'
  ) {
    deadRef.current = true;
    setStatus('failed');

    const term = termRef.current;
    if (term) {
      term.writeln(
        `\x1b[33m[Ctrl-CC] Claude Runtime is not writable (${runtimeStatus}). ${runtimeError ?? 'Open diagnostics for details.'}\x1b[0m`
      );
    }
  }
}, [runtimeStatus, runtimeError]);
```

## 2.4 修改 `term.onData`

找到：

```ts
term.onData((data) => {
  if (deadRef.current) {
    term.writeln('\x1b[33m[Ctrl-CC] This PTY session has exited. Start or resume a session before typing.\x1b[0m');
    return;
  }

  RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
```

替换为：

```ts
term.onData((data) => {
  const current = useRuntimeStore.getState().sessions[sessionId];

  if (
    deadRef.current ||
    !current ||
    current.status === 'failed' ||
    current.status === 'discovery-failed' ||
    current.status === 'exited' ||
    current.status === 'killed' ||
    current.status === 'disconnected'
  ) {
    term.writeln(
      `\x1b[33m[Ctrl-CC] Claude Runtime is not writable (${current?.status ?? 'missing'}). Open diagnostics, fix launch plan, then start a new session.\x1b[0m`
    );
    return;
  }

  RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
```

---

# Phase 3：RuntimeBridge 写入 warning 限流，避免 RuntimeTrace 刷屏

文件：

```text
src/features/runtime/services/runtimeBridge.ts
```

在 import 后增加模块级变量：

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

找到：

```ts
if (!isRuntimeWritable(session.status)) {
  recordRuntimeWarning("runtime.write.not_ready", uiSessionId, session.ptySessionId, `Runtime not ready: ${session.status}`, session.traceId);
  throw new Error(`Runtime not ready: ${session.status}`);
}
```

替换为：

```ts
if (!isRuntimeWritable(session.status)) {
  if (shouldRecordNotReady(uiSessionId, session.status)) {
    recordRuntimeWarning(
      "runtime.write.not_ready",
      uiSessionId,
      session.ptySessionId,
      `Runtime not ready: ${session.status}`,
      session.traceId
    );
  }
  throw new Error(`Runtime not ready: ${session.status}`);
}
```

---

# Phase 4：RuntimeTrace 时间显示使用本地时间，不再混用 UTC

文件：

```text
src/features/runtime/components/RuntimeDiagnosticsPanel.tsx
```

在文件顶部增加：

```ts
function formatTraceTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}
```

把所有类似：

```tsx
{event.ts.slice(11, 19)}
```

替换为：

```tsx
{formatTraceTime(event.ts)}
```

把所有类似：

```tsx
{new Date(x.createdAt).toLocaleTimeString()}
```

统一改为：

```tsx
{formatTraceTime(x.createdAt)}
```

---

# Phase 5：修复 Contract Probe：discovery-failed 不应该算 backend registry mismatch

文件：

```text
src/features/runtime/services/runtimeContractProbe.ts
```

新增：

```ts
const preBackendFailureStatuses = new Set([
  'created',
  'workspace-opened',
  'discovering',
  'discovery-failed',
  'pty-starting',
  'failed',
]);

const requiresBackend = new Set([
  'pty-ready',
  'claude-launching',
  'claude-active',
  'idle',
  'waiting-permission',
]);
```

在循环 frontend sessions 时使用这个结构：

```ts
for (const s of frontendSessions) {
  if (!s.ptySessionId) {
    if (requiresBackend.has(s.status)) {
      mismatches.push({
        uiSessionId: s.uiSessionId,
        ptySessionId: null,
        reason: `frontend status=${s.status} requires PTY but ptySessionId is missing`,
      });
    }
    continue;
  }

  if (preBackendFailureStatuses.has(s.status) && !backendIds.has(s.ptySessionId)) {
    continue;
  }

  if (requiresBackend.has(s.status) && !backendIds.has(s.ptySessionId)) {
    mismatches.push({
      uiSessionId: s.uiSessionId,
      ptySessionId: s.ptySessionId,
      reason: "backend registry missing ptySessionId",
    });
    continue;
  }

  const backend = backendPtySessions.find((b) => b.ptySessionId === s.ptySessionId);
  if (!backend) continue;

  if (requiresBackend.has(s.status)) {
    if (backend.status === 'exited' || backend.status === 'failed' || backend.status === 'killed') {
      mismatches.push({
        uiSessionId: s.uiSessionId,
        ptySessionId: s.ptySessionId,
        reason: `backend PTY is not alive: status=${backend.status}`,
      });
    }
    if (backend.readerAlive === false) {
      mismatches.push({
        uiSessionId: s.uiSessionId,
        ptySessionId: s.ptySessionId,
        reason: "backend readerAlive=false",
      });
    }
    if (!backend.hasWriter) {
      mismatches.push({
        uiSessionId: s.uiSessionId,
        ptySessionId: s.ptySessionId,
        reason: "backend hasWriter=false",
      });
    }
  }
}
```

---

# Phase 6：页面宽度与自适应排版统一修复

## 6.1 ConsoleSurface 宽度修复

文件：

```text
src/surfaces/console/ConsoleSurface.tsx
```

找到根容器：

```tsx
<div data-testid="surface-console" style={{ padding: '28px 36px', maxWidth: 960, overflow: 'auto', height: '100%' }}>
```

替换为：

```tsx
<div
  data-testid="surface-console"
  style={{
    padding: 'clamp(20px, 2vw, 32px)',
    overflow: 'auto',
    height: '100%',
    width: '100%',
    maxWidth: 1480,
    margin: '0 auto',
    boxSizing: 'border-box',
  }}
>
```

找到架构/环境两列：

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
```

替换为：

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 20 }}>
```

## 6.2 SettingsSurface 宽度修复

文件：

```text
src/surfaces/settings/SettingsSurface.tsx
```

找到根容器：

```tsx
<div data-testid="surface-settings" style={{ padding: '24px 32px', overflow: 'auto', height: '100%', maxWidth: 900 }}>
```

替换为：

```tsx
<div
  data-testid="surface-settings"
  style={{
    padding: 'clamp(20px, 2vw, 32px)',
    overflow: 'auto',
    height: '100%',
    width: '100%',
    maxWidth: 1480,
    margin: '0 auto',
    boxSizing: 'border-box',
  }}
>
```

找到环境检测 grid：

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 'var(--cc-font-sm)' }}>
```

替换为：

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px 28px', fontSize: 'var(--cc-font-sm)' }}>
```

## 6.3 RuntimeDiagnosticsPanel 表格自适应

文件：

```text
src/features/runtime/components/RuntimeDiagnosticsPanel.tsx
```

给这些大表格外层加横向滚动容器：

```text
Launch Plan Matrix
Session Mapping
PTY Registry
```

把对应：

```tsx
<table style={tableStyle}>
```

替换为：

```tsx
<div style={{ overflowX: 'auto', width: '100%' }}>
  <table style={{ ...tableStyle, minWidth: 900 }}>
```

对应结束：

```tsx
</table>
```

替换为：

```tsx
  </table>
</div>
```

## 6.4 SurfaceHost 容器修复

文件：

```text
src/app/SurfaceHost.tsx
```

确保返回容器是：

```tsx
return (
  <div style={{ flex: 1, minWidth: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
    <ErrorBoundary key={activeSurface}>
      <Component />
    </ErrorBoundary>
  </div>
);
```

---

# Phase 7：Workspace 启动失败提示更清晰

在 Workspace 启动失败 UI 中增加辅助函数：

```ts
function getStartupFailureHint(error?: string | null) {
  if (!error) return null;

  if (error.includes('CTRL_CC_CLAUDE_JS') || error.includes('No policy-allowed runnable Claude launch plan')) {
    return {
      title: 'Claude Runtime Startup Failed',
      message: 'Ctrl-CC did not find the real Claude CLI JavaScript entry. It intentionally blocked cmd/powershell wrappers to avoid 0xc0000142.',
      steps: [
        'Open Settings → Diagnostics → Launch Plan Matrix.',
        'If no direct-node plan is found, set CTRL_CC_CLAUDE_JS to Claude CLI JS path.',
        'Temporary fallback: set CTRL_CC_ALLOW_SHELL_WRAPPER=1, but this may reintroduce powershell/cmd 0xc0000142.',
      ],
    };
  }

  return {
    title: 'Claude Runtime Startup Failed',
    message: error,
    steps: ['Open Runtime Diagnostics.', 'Copy Diagnostic Bundle.', 'Start a new session after fixing the error.'],
  };
}
```

UI 上显示：

```tsx
{hint && (
  <div className="runtime-startup-failure">
    <strong>{hint.title}</strong>
    <p>{hint.message}</p>
    <ol>
      {hint.steps.map((s) => <li key={s}>{s}</li>)}
    </ol>
    <button onClick={() => navigator.clipboard.writeText(session.error ?? '')}>Copy Error</button>
  </div>
)}
```

---

# Phase 8：本地验证命令

执行：

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

然后在 Windows PowerShell 里验证 Claude JS 路径：

```powershell
where.exe node
where.exe claude
Get-Content "$env:APPDATA\npm\claude.cmd" -TotalCount 80
dir "$env:APPDATA\npm\node_modules" -Recurse -Include cli.js,cli.mjs,index.js,index.mjs,claude.js,claude.mjs |
  Where-Object { $_.FullName -match "claude" } |
  Select-Object -First 20 FullName
```

如果扫描仍找不到，手动设置：

```powershell
setx CTRL_CC_CLAUDE_JS "C:\Users\48304\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js"
```

`setx` 后需要重新启动 Ctrl-CC。

临时 fallback，不推荐：

```powershell
setx CTRL_CC_ALLOW_SHELL_WRAPPER 1
```

这个可能重新触发 `powershell.exe / cmd.exe 0xc0000142`，只能临时使用。

---

# Phase 9：验收标准

必须满足：

```text
[ ] Launch Plan Matrix 至少出现一个 direct-node-* plan，或者明确显示用户需要设置 CTRL_CC_CLAUDE_JS。
[ ] 默认不 selected windows-powershell-ps1。
[ ] 默认不 selected cmd-claude-cmd。
[ ] 新建会话失败后 Terminal 不再持续刷 Runtime not writable。
[ ] RuntimeTrace 不再每个按键刷一条 runtime.write.not_ready。
[ ] RuntimeTrace 时间显示为本地时间。
[ ] discovery-failed 不再被错误标记为 backend registry missing ptySessionId。
[ ] Console 页面不再被限制在左侧 960px。
[ ] Settings / Diagnostics 页面不再被限制在左侧 900px。
[ ] 大表格横向滚动，不撑坏布局。
```

---

# Phase 10：给 Claude CLI / Codex 的执行 Prompt

```text
执行 Ctrl-CC 15.0 最终稳定修复。

必须按顺序完成：

1. 完整替换 src-tauri/src/runtime_v2/claude_discovery.rs。
   目标：
   - discover_claude() 和 select_launch_plan() 使用同一 policy。
   - 默认禁止 powershell/cmd shell wrapper selected。
   - 增强 direct node + Claude CLI JS 查找。
   - 读取 claude.cmd/claude.ps1 时用 bytes + from_utf8_lossy。
   - 搜索 cli.js/cli.mjs/index.js/index.mjs/claude.js/claude.mjs。
   - 支持 CTRL_CC_CLAUDE_JS override。

2. 修改 src/features/terminal/usePtyTerminal.ts。
   目标：
   - 订阅 RuntimeStore session.status。
   - discovery-failed/failed/exited/killed/disconnected 后 deadRef=true。
   - 输入时如果 runtime 不可写，只显示一次明确提示，不调用 RuntimeBridge.write 刷屏。

3. 修改 src/features/runtime/services/runtimeBridge.ts。
   目标：
   - runtime.write.not_ready 每 3 秒同一 session/status 最多记录一次。
   - 避免 RuntimeTrace 刷屏。

4. 修改 RuntimeDiagnosticsPanel.tsx。
   目标：
   - RuntimeTrace 时间用 local time 格式化，不直接 slice ISO。
   - Launch Plan Matrix / Session Mapping / PTY Registry 外层加 overflowX auto。
   - 大表格 minWidth 900。

5. 修改 runtimeContractProbe.ts。
   目标：
   - discovery-failed/failed 且 backend registry 缺失时，不算 contract mismatch。
   - 只有 pty-ready/claude-active/idle/waiting-permission 等需要 backend 的状态才检查 backend registry。
   - backend status exited / readerAlive=false / hasWriter=false 才算 mismatch。

6. 修复页面自适应布局：
   - ConsoleSurface 根容器 maxWidth 从 960 改为 1480，width 100%，margin 0 auto，boxSizing border-box。
   - SettingsSurface 根容器 maxWidth 从 900 改为 1480，width 100%，margin 0 auto，boxSizing border-box。
   - Console 两列布局改 repeat(auto-fit, minmax(360px, 1fr))。
   - Settings 环境检测 grid 改 repeat(auto-fit, minmax(260px, 1fr))。
   - SurfaceHost 根容器增加 minWidth:0, width:'100%', height:'100%'.

7. 改善 Workspace 启动失败提示：
   - 对 No policy-allowed runnable Claude launch plan / CTRL_CC_CLAUDE_JS 错误显示专门 hint。
   - 提供 Copy Error。
   - 不要让用户继续在 failed Runtime 中输入。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

验收：
- 不再默认 selected powershell/cmd。
- direct-node plan 能被扫描出来，或错误明确指向 CTRL_CC_CLAUDE_JS。
- discovery-failed 后不会刷 Runtime not writable。
- RuntimeTrace 时间正确。
- Console / Settings / Diagnostics 页面自适应铺开，不再局限在左侧小区域。
```

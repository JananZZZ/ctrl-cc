# Ctrl-CC 14.0 Runtime LaunchPlan / Input Guard / Time Fix 可执行修复文档

> 仓库：`https://github.com/JananZZZ/ctrl-cc/tree/master`  
> 分支建议：`fix/runtime-launchplan-inputguard-time-14`  
> 目标：彻底解决当前仍然存在的 `Runtime not ready: failed`、`No runnable Claude launch plan found`、错误日志重复刷屏、RuntimeTrace 时间显示混乱问题。  
> 原则：不要继续大改 UI；先让 Runtime 真正稳定启动、失败可解释、失败后不可继续写入。

---

## 0. 当前现象与根因

### 0.1 你截图中的现象

当前日志核心是：

```text
pty.start.failed No runnable Claude launch plan found. Install Node.js and Claude Code CLI, or set CTRL_CC_CLAUDE_COMMAND.
runtime.write.not_ready Runtime not ready: failed
[Ctrl-CC] Write failed: Error: Runtime not ready: failed
```

这说明：

```text
1. PTY 没有真正启动成功。
2. RuntimeSession 已经被置为 failed。
3. Terminal / Composer 仍然允许输入。
4. 每个键盘输入都调用 RuntimeBridge.write。
5. RuntimeBridge.write 发现 status=failed，于是重复写 RuntimeTrace 和 ErrorLog。
```

### 0.2 时间显示是不是根因？

不是根因。

时间显示不一致主要是因为：

```text
RuntimeTraceStore 使用 new Date().toISOString() 存 UTC 时间。
有些 UI 直接 e.ts.slice(11,19)，显示 UTC 时分秒。
有些卡片用 toLocaleTimeString()，显示本地时间。
所以你看到 06:05 / 14:05 / 15:43 这类不一致。
```

这会严重干扰排查，但不会导致 PTY 启动失败。需要修，但它是诊断可读性问题，不是 Runtime 失败根因。

### 0.3 真正根因

当前代码已经做了一部分 v13 修复，但还有三个关键漏洞：

```text
漏洞 A：Discovery 和 Launch 不一致
  discover_claude() 仍然可能 selected windows-powershell-ps1；
  select_launch_plan() 又默认禁止 powershell/cmd shell wrapper；
  于是前端看到 discovery.ok，但 backend start 又报 No runnable launch plan。

漏洞 B：Direct Node.js Claude CLI JS 查找不够强
  find_claude_cli_js() 只查 APPDATA/npm 下几个固定路径；
  如果 Claude CLI JS 在 npm prefix、pnpm、volta、nvm、Program Files 或 shim 里解析不到，runtime_v2 找不到真正可绕开 shell wrapper 的启动方式。

漏洞 C：失败 session 仍挂着 xterm 输入层
  usePtyTerminal 只在 pty://exit / pty://error 后 deadRef=true；
  但 discovery/launch 失败时根本没有 PTY 事件，只有 RuntimeStore status=failed；
  xterm 仍然 onData -> RuntimeBridge.write -> Runtime not ready: failed 无限刷屏。
```

---

# 1. 修改总览

本轮只做 6 件事：

```text
1. 重写 runtime_v2/claude_discovery.rs：Discovery 与 Launch 使用同一个策略，默认不再 selected shell wrapper。
2. 增强 Claude CLI JS 定位：APPDATA、NPM_CONFIG_PREFIX、npm_config_prefix、PREFIX、USERPROFILE、LOCALAPPDATA、shim 内容解析、显式 CTRL_CC_CLAUDE_JS。
3. RuntimeBridge：失败时同步 OpenSessionTab 状态；write 对 non-writable 状态限流，不再每个键都写 error trace。
4. usePtyTerminal：读取 RuntimeStore 状态，failed/discovery-failed/exited/killed 直接阻断输入，不再调用 RuntimeBridge.write。
5. TerminalView：显示 RuntimeSession 状态和 error，失败时给明确恢复按钮/提示。
6. RuntimeTrace 时间统一：存 UTC，显示一律本地时间，不再 slice ISO。
```

---

# 2. Phase A：修 Discovery / LaunchPlan 一致性

## 2.1 完整替换 `src-tauri/src/runtime_v2/claude_discovery.rs`

用下面完整代码替换整个文件。

```rust
use std::env;
use std::path::{Path, PathBuf};

use super::claude_launch_plan::ClaudeLaunchPlan;
use super::process_canary::canary_program_owned;
use super::runtime_types::{ClaudeLaunchPlanDebug, RuntimeDiscoveryResult};

const CLI_RELATIVE_CANDIDATES: &[&str] = &[
    r"node_modules\@anthropic-ai\claude-code\cli.js",
    r"node_modules\@anthropic-ai\claude-code\bin\claude.js",
    r"node_modules\@anthropic-ai\claude-code\index.js",
    r"node_modules/@anthropic-ai/claude-code/cli.js",
    r"node_modules/@anthropic-ai/claude-code/bin/claude.js",
    r"node_modules/@anthropic-ai/claude-code/index.js",
];

const CLI_PACKAGE_RELATIVE_CANDIDATES: &[&str] = &[
    r"@anthropic-ai\claude-code\cli.js",
    r"@anthropic-ai\claude-code\bin\claude.js",
    r"@anthropic-ai\claude-code\index.js",
    r"@anthropic-ai/claude-code/cli.js",
    r"@anthropic-ai/claude-code/bin/claude.js",
    r"@anthropic-ai/claude-code/index.js",
];

pub fn discover_claude() -> RuntimeDiscoveryResult {
    let mut debug = Vec::new();
    let mut selected: Option<ClaudeLaunchPlanDebug> = None;
    let mut errors = Vec::new();

    for plan in collect_launch_plans() {
        let policy_allowed = is_launch_plan_allowed_by_policy(&plan);
        let (canary_ok, version_ok, version_text, error) = if policy_allowed {
            match canary_launch_plan(&plan) {
                Ok(version) => (true, true, Some(version), None),
                Err(err) => (false, false, None, Some(err)),
            }
        } else {
            (
                false,
                false,
                None,
                Some("Blocked by Ctrl-CC policy: shell wrappers are disabled unless CTRL_CC_ALLOW_SHELL_WRAPPER=1".to_string()),
            )
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

    if selected.is_none() {
        errors.push(
            "No policy-allowed runnable Claude launch plan was found. Set CTRL_CC_CLAUDE_JS to Claude CLI JS path, or set CTRL_CC_ALLOW_SHELL_WRAPPER=1 only as a temporary fallback.".to_string(),
        );
    }

    RuntimeDiscoveryResult { selected, plans: debug, errors }
}

pub fn select_launch_plan() -> Result<ClaudeLaunchPlan, String> {
    let mut errors = Vec::new();

    for plan in collect_launch_plans() {
        if !is_launch_plan_allowed_by_policy(&plan) {
            errors.push(format!(
                "{} blocked by policy. Set CTRL_CC_ALLOW_SHELL_WRAPPER=1 to allow shell wrappers temporarily.",
                plan.id
            ));
            continue;
        }

        match canary_launch_plan(&plan) {
            Ok(_) => return Ok(plan),
            Err(err) => errors.push(format!("{} failed canary: {}", plan.id, err)),
        }
    }

    Err(format!(
        "No runnable Claude launch plan found.\n{}\n\nRecommended fixes:\n1. Find Claude CLI JS path and set CTRL_CC_CLAUDE_JS.\n2. Or reinstall Claude Code CLI globally.\n3. Temporary fallback only: set CTRL_CC_ALLOW_SHELL_WRAPPER=1.",
        errors.join("\n")
    ))
}

fn is_launch_plan_allowed_by_policy(plan: &ClaudeLaunchPlan) -> bool {
    if plan.id == "user-override-program" || plan.id == "user-override-js" {
        return true;
    }

    let is_shell_wrapper = plan.id.contains("powershell")
        || plan.id.contains("pwsh")
        || plan.id.contains("cmd")
        || plan.id.contains("ps1")
        || plan.id.contains("claude-cmd");

    if is_shell_wrapper && env::var("CTRL_CC_ALLOW_SHELL_WRAPPER").is_err() {
        return false;
    }

    true
}

fn collect_launch_plans() -> Vec<ClaudeLaunchPlan> {
    let mut plans = Vec::new();

    // Highest priority: explicit JS path. This is the most stable Windows path.
    if let Some(node) = find_node_exe() {
        if let Ok(js) = env::var("CTRL_CC_CLAUDE_JS") {
            let trimmed = js.trim();
            if !trimmed.is_empty() && Path::new(trimmed).exists() {
                plans.push(ClaudeLaunchPlan {
                    id: "user-override-js".to_string(),
                    label: "User override Claude CLI JS".to_string(),
                    program: node.to_string_lossy().to_string(),
                    args_prefix: vec![trimmed.to_string()],
                    reason: "CTRL_CC_CLAUDE_JS".to_string(),
                });
            }
        }
    }

    // Program-only override. Use for native exe only.
    if let Ok(command) = env::var("CTRL_CC_CLAUDE_COMMAND") {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            plans.push(ClaudeLaunchPlan {
                id: "user-override-program".to_string(),
                label: "User override program".to_string(),
                program: trimmed.to_string(),
                args_prefix: vec![],
                reason: "CTRL_CC_CLAUDE_COMMAND".to_string(),
            });
        }
    }

    if let (Some(node), Some(cli_js)) = (find_node_exe(), find_claude_cli_js()) {
        plans.push(ClaudeLaunchPlan {
            id: "direct-node-js".to_string(),
            label: "Direct Node.js + Claude CLI JS".to_string(),
            program: node.to_string_lossy().to_string(),
            args_prefix: vec![cli_js.to_string_lossy().to_string()],
            reason: "Bypasses cmd.exe / powershell.exe shims".to_string(),
        });
    }

    if let Some(plan) = resolve_node_plan_from_claude_shim() {
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

    // Shell wrappers are listed for diagnostics, but blocked by default policy.
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
                reason: "Shell wrapper fallback only".to_string(),
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
                reason: "Shell wrapper fallback only; can trigger 0xc0000142 on this machine".to_string(),
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
                reason: "Shell wrapper fallback only; avoid if cmd.exe/powershell.exe fails".to_string(),
            });
        }
    }

    dedupe_plans(plans)
}

fn dedupe_plans(plans: Vec<ClaudeLaunchPlan>) -> Vec<ClaudeLaunchPlan> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for p in plans {
        let key = format!("{}::{:?}", p.program, p.args_prefix);
        if seen.insert(key) {
            out.push(p);
        }
    }
    out
}

fn canary_launch_plan(plan: &ClaudeLaunchPlan) -> Result<String, String> {
    let args = plan.version_args();
    canary_program_owned(&plan.program, &args)
}

fn find_node_exe() -> Option<PathBuf> {
    find_on_path("node.exe").or_else(|| {
        let p = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
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
    let mut bases: Vec<PathBuf> = Vec::new();

    for key in ["NPM_CONFIG_PREFIX", "npm_config_prefix", "PREFIX"] {
        if let Ok(v) = env::var(key) {
            let p = PathBuf::from(v);
            bases.push(p.clone());
            bases.push(p.join("node_modules"));
        }
    }

    if let Ok(appdata) = env::var("APPDATA") {
        bases.push(PathBuf::from(&appdata).join("npm"));
        bases.push(PathBuf::from(&appdata).join("npm").join("node_modules"));
    }

    if let Ok(local) = env::var("LOCALAPPDATA") {
        bases.push(PathBuf::from(&local).join("npm"));
        bases.push(PathBuf::from(&local).join("npm").join("node_modules"));
    }

    if let Ok(user) = env::var("USERPROFILE") {
        bases.push(PathBuf::from(&user).join("AppData").join("Roaming").join("npm"));
        bases.push(PathBuf::from(&user).join("AppData").join("Roaming").join("npm").join("node_modules"));
        bases.push(PathBuf::from(&user).join(".npm-global"));
        bases.push(PathBuf::from(&user).join(".npm-global").join("lib").join("node_modules"));
    }

    if let Ok(program_files) = env::var("ProgramFiles") {
        bases.push(PathBuf::from(program_files).join("nodejs").join("node_modules"));
    }

    for base in bases {
        for rel in CLI_RELATIVE_CANDIDATES.iter().chain(CLI_PACKAGE_RELATIVE_CANDIDATES.iter()) {
            let p = base.join(rel);
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
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
    let shim = find_on_path("claude.cmd")
        .or_else(|| find_on_path("claude.ps1"))
        .or_else(|| find_on_path("claude"))?;

    let node = find_node_exe()?;
    let shim_dir = shim.parent()?.to_path_buf();
    let content = std::fs::read_to_string(&shim).unwrap_or_default();

    if let Some(js) = extract_cli_js_from_shim_content(&content, &shim_dir) {
        if js.exists() {
            return Some(ClaudeLaunchPlan {
                id: "direct-node-from-shim".to_string(),
                label: "Direct Node.js resolved from Claude npm shim".to_string(),
                program: node.to_string_lossy().to_string(),
                args_prefix: vec![js.to_string_lossy().to_string()],
                reason: format!("Resolved from shim {}", shim.to_string_lossy()),
            });
        }
    }

    let common_roots = [
        shim_dir.join("node_modules").join("@anthropic-ai").join("claude-code"),
        shim_dir.join("..").join("node_modules").join("@anthropic-ai").join("claude-code"),
    ];

    for root in common_roots {
        for file in ["cli.js", "bin/claude.js", "index.js"] {
            let p = root.join(file);
            if p.exists() {
                return Some(ClaudeLaunchPlan {
                    id: "direct-node-from-shim-dir".to_string(),
                    label: "Direct Node.js resolved from shim directory".to_string(),
                    program: node.to_string_lossy().to_string(),
                    args_prefix: vec![p.to_string_lossy().to_string()],
                    reason: format!("Resolved from shim dir {}", shim_dir.to_string_lossy()),
                });
            }
        }
    }

    None
}

fn extract_cli_js_from_shim_content(content: &str, shim_dir: &Path) -> Option<PathBuf> {
    for line in content.lines() {
        if !line.contains("@anthropic-ai") || !line.contains("claude-code") {
            continue;
        }

        let cleaned = line
            .replace("%dp0%", &shim_dir.to_string_lossy())
            .replace("%~dp0", &shim_dir.to_string_lossy())
            .replace("$basedir", &shim_dir.to_string_lossy())
            .replace("$PSScriptRoot", &shim_dir.to_string_lossy())
            .replace('"', " ")
            .replace('\'', " ");

        for token in cleaned.split_whitespace() {
            if token.contains("@anthropic-ai") && token.contains("claude-code") && token.ends_with(".js") {
                let p = PathBuf::from(token);
                if p.is_absolute() {
                    return Some(p);
                }
                return Some(shim_dir.join(p));
            }
        }
    }

    None
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

## 2.2 预期效果

修完后：

```text
runtime_discover_claude_v2 和 runtime_start_interactive_v2 使用同一套 allow policy。
如果没有 direct-node-js，就不会再显示 discovery.ok selected windows-powershell-ps1。
如果真的只能通过 shell wrapper 运行，会明确显示 blocked by policy。
用户可以临时设置 CTRL_CC_ALLOW_SHELL_WRAPPER=1，但默认不走 powershell/cmd。
```

---

# 3. Phase B：给用户一个立即可用的手动兜底方式

如果自动查找仍失败，让用户可以直接指定 Claude CLI JS。

## 3.1 在 Windows PowerShell 里查找 Claude CLI JS

```powershell
Get-ChildItem "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code" -Recurse -Filter *.js | Select-Object FullName
```

优先找：

```text
cli.js
bin\claude.js
index.js
```

## 3.2 设置环境变量

假设找到：

```text
C:\Users\你的用户名\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js
```

执行：

```powershell
setx CTRL_CC_CLAUDE_JS "C:\Users\你的用户名\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js"
```

然后完全退出 Ctrl-CC，再重新打开。

注意：不要设置 `CTRL_CC_ALLOW_SHELL_WRAPPER=1`，除非只是临时验证。你的机器上 powershell/cmd wrapper 风险很高。

---

# 4. Phase C：修 RuntimeBridge 失败状态与重复 trace

## 4.1 修改 `src/stores/openSessionStore.ts`

给 OpenSessionStore 增加 patch 能力，让 Runtime 失败时 tab 能同步显示失败。

### 找到 interface，加入：

```ts
  patchTab: (sessionId: string, patch: Partial<OpenSessionTab>) => void;
```

### 在 create 里加入实现：

```ts
  patchTab: (sessionId, patch) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.sessionId === sessionId ? { ...t, ...patch } : t)),
    })),
```

### 修改后的关键片段应类似：

```ts
interface OpenSessionState {
  tabs: OpenSessionTab[];
  activeTabId: string | null;
  openSession: (tab: OpenSessionTab) => void;
  closeTab: (sessionId: string) => void;
  setActiveTab: (sessionId: string | null) => void;
  pinTab: (sessionId: string) => void;
  patchTab: (sessionId: string, patch: Partial<OpenSessionTab>) => void;
}
```

```ts
  patchTab: (sessionId, patch) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.sessionId === sessionId ? { ...t, ...patch } : t)),
    })),
```

## 4.2 修改 `src/features/runtime/services/runtimeBridge.ts`

### 4.2.1 在文件顶部增加一个限流 map

放在 imports 后面：

```ts
const blockedWriteTraceAt = new Map<string, number>();

function shouldTraceBlockedWrite(uiSessionId: string, status: string): boolean {
  const key = `${uiSessionId}:${status}`;
  const now = Date.now();
  const last = blockedWriteTraceAt.get(key) ?? 0;
  if (now - last < 5000) return false;
  blockedWriteTraceAt.set(key, now);
  return true;
}
```

### 4.2.2 替换 `write()` 中 non-writable 判断

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
    if (shouldTraceBlockedWrite(uiSessionId, session.status)) {
      recordRuntimeWarning(
        'runtime.write.not_ready',
        uiSessionId,
        session.ptySessionId,
        `Runtime not ready: ${session.status}`,
        session.traceId,
      );
    }
    throw new Error(`Runtime not ready: ${session.status}`);
  }
```

### 4.2.3 修 `sendCtrlC` / `sendCtrlD`

找到：

```ts
export async function sendCtrlC(sessionId: string): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  if (!s?.ptySessionId) return;
  await invokeCommand('runtime_write_v2', {
    req: { traceId: s.traceId, uiSessionId: s.id, ptySessionId: s.ptySessionId, data: '\x03' },
  });
}
```

替换为：

```ts
export async function sendCtrlC(sessionId: string): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  if (!s?.ptySessionId || !isRuntimeWritable(s.status)) return;
  await invokeCommand('runtime_write_v2', {
    req: { traceId: s.traceId, uiSessionId: s.id, ptySessionId: s.ptySessionId, data: '\x03' },
  });
}
```

同理把 `sendCtrlD` 改成：

```ts
export async function sendCtrlD(sessionId: string): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  if (!s?.ptySessionId || !isRuntimeWritable(s.status)) return;
  await invokeCommand('runtime_write_v2', {
    req: { traceId: s.traceId, uiSessionId: s.id, ptySessionId: s.ptySessionId, data: '\x04' },
  });
}
```

### 4.2.4 在 start 失败时同步 OpenSessionTab

在 `startSessionInBackground()` 的 discovery 失败 catch 内，当前有：

```ts
useRuntimeStore.getState().patchSession(session.id, { status: 'discovery-failed', error: msg });
useSessionStore.getState().updateSession(session.id, { status: 'failed' as const });
return;
```

替换为：

```ts
useRuntimeStore.getState().patchSession(session.id, { status: 'discovery-failed', error: msg });
useSessionStore.getState().updateSession(session.id, { status: 'failed' as const });
useOpenSessionStore.getState().patchTab?.(session.id, { status: 'failed', ptyStatus: 'failed' });
return;
```

在最外层 catch 内，当前有：

```ts
useRuntimeStore.getState().patchSession(session.id, { status: 'failed', error: msg });
useSessionStore.getState().updateSession(session.id, { status: 'failed' as const });
```

替换为：

```ts
useRuntimeStore.getState().patchSession(session.id, { status: 'failed', error: msg });
useSessionStore.getState().updateSession(session.id, { status: 'failed' as const });
useOpenSessionStore.getState().patchTab?.(session.id, { status: 'failed', ptyStatus: 'failed' });
```

---

# 5. Phase D：修 usePtyTerminal 输入层

## 5.1 修改 `src/features/terminal/usePtyTerminal.ts`

### 5.1.1 增加 imports

当前只有：

```ts
import { RuntimeBridge } from '../runtime/services/runtimeBridge';
```

替换为：

```ts
import { RuntimeBridge } from '../runtime/services/runtimeBridge';
import { useRuntimeStore } from '../runtime/stores/runtimeStore';
import { isRuntimeWritable } from '../runtime/types/runtimeTypes';
```

### 5.1.2 增加一次性提示 ref

在：

```ts
const deadRef = useRef(false);
```

下面加入：

```ts
const blockedInputReportedRef = useRef(false);
```

### 5.1.3 useEffect 初始化时重置

找到：

```ts
    deadRef.current = false;
```

替换为：

```ts
    deadRef.current = false;
    blockedInputReportedRef.current = false;
```

### 5.1.4 在 `term.onData` 内先检查 RuntimeStore 状态

找到完整的：

```ts
    term.onData((data) => {
      if (deadRef.current) {
        term.writeln('\x1b[33m[Ctrl-CC] This PTY session has exited. Start or resume a session before typing.\x1b[0m');
        return;
      }

      RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
        const msg = String(e);
        warnLog('pty', 'PTY write failed', msg);
        if (msg.includes('not writable') || msg.includes('exited') || msg.includes('os error 232') || msg.includes('管道')) {
          deadRef.current = true;
          setStatus('exited');
        }
        term.writeln(`\x1b[31m[Ctrl-CC] Write failed: ${msg}\x1b[0m`);
      });
    });
```

替换为：

```ts
    term.onData((data) => {
      const rt = useRuntimeStore.getState().sessions[sessionId];
      const rtStatus = rt?.status ?? 'missing';

      if (deadRef.current || !rt || !isRuntimeWritable(rtStatus as any)) {
        if (!blockedInputReportedRef.current) {
          blockedInputReportedRef.current = true;
          const reason = rt?.error ? `${rtStatus}: ${rt.error}` : rtStatus;
          term.writeln(`\x1b[33m[Ctrl-CC] Runtime is not writable (${reason}). Fix Runtime diagnostics, then start a new session.\x1b[0m`);
        }
        if (rtStatus === 'failed' || rtStatus === 'discovery-failed' || rtStatus === 'exited' || rtStatus === 'killed' || rtStatus === 'disconnected') {
          deadRef.current = true;
          setStatus(rtStatus === 'failed' || rtStatus === 'discovery-failed' ? 'failed' : 'exited');
        }
        return;
      }

      RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
        const msg = String(e);
        warnLog('pty', 'PTY write failed', msg);
        if (msg.includes('not writable') || msg.includes('exited') || msg.includes('os error 232') || msg.includes('管道') || msg.includes('Runtime not ready')) {
          deadRef.current = true;
          setStatus('exited');
        }
        if (!blockedInputReportedRef.current) {
          blockedInputReportedRef.current = true;
          term.writeln(`\x1b[31m[Ctrl-CC] Write failed: ${msg}\x1b[0m`);
        }
      });
    });
```

### 5.1.5 修 `write` callback

找到：

```ts
const write = useCallback((data: string) => { RuntimeBridge.write(sessionId!, data).catch((e: unknown) => warnLog('pty', 'PTY write failed', String(e))); }, [sessionId]);
```

替换为：

```ts
const write = useCallback((data: string) => {
  if (!sessionId) return;
  const rt = useRuntimeStore.getState().sessions[sessionId];
  if (!rt || !isRuntimeWritable(rt.status)) return;
  RuntimeBridge.write(sessionId, data).catch((e: unknown) => warnLog('pty', 'PTY write failed', String(e)));
}, [sessionId]);
```

---

# 6. Phase E：TerminalView 显示真实 Runtime 错误

## 6.1 修改 `src/surfaces/workspace/TerminalView.tsx`

### 6.1.1 增加 imports

顶部加入：

```ts
import { useRuntimeStore } from '../../features/runtime/stores/runtimeStore';
import { CcButton } from '../../components/ui/CcButton';
```

### 6.1.2 在组件内拿 runtime session

在：

```ts
const handle = usePtyTerminal(sessionId, container);
```

下面加入：

```ts
const runtimeSession = useRuntimeStore((s) => (sessionId ? s.sessions[sessionId] : null));
const runtimeFailed = runtimeSession?.status === 'failed' || runtimeSession?.status === 'discovery-failed';
```

### 6.1.3 在 toolbar 下、xterm root 上方加入失败 banner

找到：

```tsx
      <div ref={containerCb} data-testid="terminal-xterm-root" style={{ flex: 1, overflow: 'hidden', padding: 2 }} />
```

替换为：

```tsx
      {runtimeFailed && (
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--cc-border)',
          background: 'var(--cc-red-soft, rgba(230,107,107,0.10))',
          color: 'var(--cc-text)',
          fontSize: 'var(--cc-font-xs)',
          lineHeight: 1.55,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--cc-red)', marginBottom: 4 }}>
            Claude Runtime 启动失败
          </div>
          <div style={{ color: 'var(--cc-text-muted)', wordBreak: 'break-word' }}>
            {runtimeSession?.error || 'Runtime failed before PTY became writable.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <CcButton size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(runtimeSession?.error || '')}>
              复制错误
            </CcButton>
          </div>
        </div>
      )}
      <div
        ref={containerCb}
        data-testid="terminal-xterm-root"
        style={{ flex: 1, overflow: 'hidden', padding: 2, opacity: runtimeFailed ? 0.55 : 1 }}
      />
```

### 6.1.4 toolbar 状态显示改成 RuntimeStore 优先

找到：

```tsx
{handle?.status === 'running' ? '●' : handle?.status === 'starting' ? '◐' : '○'} {handle?.status ?? 'idle'}
```

替换为：

```tsx
{runtimeSession?.status === 'claude-active' || runtimeSession?.status === 'pty-ready' ? '●' : runtimeFailed ? '×' : '○'} {runtimeSession?.status ?? handle?.status ?? 'idle'}
```

---

# 7. Phase F：修 RuntimeTrace 时间显示

## 7.1 新建 `src/features/runtime/utils/traceTime.ts`

```ts
export function formatTraceTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatTraceDateTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
```

## 7.2 修改 `src/features/runtime/components/RuntimeDiagnosticsPanel.tsx`

### 7.2.1 增加 import

```ts
import { formatTraceTime } from '../utils/traceTime';
```

### 7.2.2 替换所有 `e.ts.slice(11,19)`

找到：

```tsx
<span style={{ color: 'var(--cc-text-soft)' }}>{e.ts.slice(11,19)}</span>
```

替换为：

```tsx
<span style={{ color: 'var(--cc-text-soft)' }}>{formatTraceTime(e.ts)}</span>
```

## 7.3 修改错误日志 / RuntimeTrace 列表组件

搜索全仓库：

```bash
grep -R "slice(11,19)" -n src
```

把所有 runtime trace 时间显示统一替换为：

```ts
formatTraceTime(event.ts)
```

---

# 8. Phase G：Runtime diagnostics 必须显示“为什么没有 direct node plan”

## 8.1 修改 `RuntimeDiagnosticsPanel.tsx` 的 Launch Plan Matrix

必须显示这些字段：

```text
Plan ID
Program
Args Prefix
Policy
Canary
Version
Selected
Error
```

如果 `windows-powershell-ps1` canary 成功但被 policy blocked，必须显示：

```text
Policy: blocked, shell wrapper disabled
Selected: no
Error: Blocked by Ctrl-CC policy...
```

这样你不会再被“discovery.ok 但 start failed”误导。

---

# 9. Phase H：清理旧失败 session，避免历史失败 tab 继续干扰

## 9.1 启动时清理 RuntimeStore 不需要，因为 RuntimeStore 是内存

但 DB 会恢复旧 sessions。当前 App.tsx 会把非终态 sessions 置为 disconnected，这是对的。

## 9.2 增加一个诊断按钮：Close Failed Runtime Tabs

可选，但建议在 Workspace 或 Diagnostics 中加入：

```ts
useOpenSessionStore.getState().tabs
  .filter(t => t.status === 'failed')
  .forEach(t => useOpenSessionStore.getState().closeTab(t.sessionId));
```

---

# 10. 验收流程

## 10.1 清理进程

先完全退出 Ctrl-CC，然后执行：

```powershell
taskkill /F /IM powershell.exe /T
taskkill /F /IM cmd.exe /T
taskkill /F /IM node.exe /T
taskkill /F /IM claude.exe /T
```

如果你有其他重要 node 程序，不要杀所有 node，手动在任务管理器里关 Ctrl-CC 子进程。

## 10.2 构建

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 10.3 Discovery 验收

打开诊断，运行 Runtime Contract Test。必须满足：

```text
[ ] selected 不再是 windows-powershell-ps1
[ ] selected 不再是 cmd-claude-cmd
[ ] 如果 direct-node-js 找不到，diagnostics 明确显示所有 direct-node 候选失败原因
[ ] 如果设置 CTRL_CC_CLAUDE_JS，selected 必须是 user-override-js
```

## 10.4 Runtime 验收

新建会话后：

```text
[ ] RuntimeTrace: discovery.ok selected direct-node-js / direct-node-from-shim / user-override-js
[ ] RuntimeTrace: pty.start.request
[ ] Backend session readerAlive=true
[ ] Backend status 不应立即 exited
[ ] 前端 status 先 pty-ready，收到 pty://data 后 claude-active
```

## 10.5 失败态验收

故意设置错误路径：

```powershell
setx CTRL_CC_CLAUDE_JS "C:\bad\missing\cli.js"
```

重启后新建会话，必须满足：

```text
[ ] Terminal 显示 Claude Runtime 启动失败 banner
[ ] 输入键盘不会刷 Runtime not ready: failed 多行
[ ] RuntimeTrace 最多每 5 秒一条 runtime.write.not_ready
[ ] ErrorLog 不再无限增长
```

测试完删除错误变量：

```powershell
reg delete HKCU\Environment /F /V CTRL_CC_CLAUDE_JS
```

---

# 11. 直接发送给 Claude CLI / Codex 的执行 Prompt

```text
执行 Ctrl-CC 14.0 Runtime LaunchPlan / Input Guard / Time Fix。

不要继续改 UI，不要新建半成品页面。只修 Runtime 启动、失败态输入保护、时间显示。

必须完成：
1. 完整替换 src-tauri/src/runtime_v2/claude_discovery.rs。
   - discover_claude() 和 select_launch_plan() 必须使用同一个 policy。
   - 默认禁止 selected powershell/cmd shell wrapper。
   - 支持 CTRL_CC_CLAUDE_JS 指向 Claude CLI JS。
   - 增强 APPDATA / NPM_CONFIG_PREFIX / npm_config_prefix / PREFIX / USERPROFILE / LOCALAPPDATA / shim 内容解析。

2. 修改 src/stores/openSessionStore.ts。
   - 增加 patchTab(sessionId, patch)。

3. 修改 src/features/runtime/services/runtimeBridge.ts。
   - 对 runtime.write.not_ready 做 5 秒限流。
   - sendCtrlC/sendCtrlD 只在 isRuntimeWritable 时执行。
   - discovery-failed / start failed 时同步 openSessionStore.patchTab 为 failed。

4. 修改 src/features/terminal/usePtyTerminal.ts。
   - import useRuntimeStore + isRuntimeWritable。
   - onData 前先检查 RuntimeStore status。
   - failed/discovery-failed/exited/killed/disconnected 时直接阻断输入，不调用 RuntimeBridge.write。
   - 同一个失败状态只在 terminal 打印一次提示。

5. 修改 src/surfaces/workspace/TerminalView.tsx。
   - 显示 runtimeSession.status。
   - failed/discovery-failed 时显示 Claude Runtime 启动失败 banner 和 error。

6. 新建 src/features/runtime/utils/traceTime.ts。
   - formatTraceTime / formatTraceDateTime。
   - 替换 RuntimeDiagnosticsPanel.tsx 中 e.ts.slice(11,19)。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

验收：
- 不再 selected windows-powershell-ps1，除非 CTRL_CC_ALLOW_SHELL_WRAPPER=1。
- No runnable launch plan 时 UI 给出清晰原因。
- Runtime failed 后输入键盘不再刷 Runtime not ready: failed。
- RuntimeTrace 时间显示使用本地时间，不再 UTC/local 混用。
```

---

# 12. 后续如果仍然无法找到 direct-node-js

如果 14.0 后仍显示 No runnable launch plan，那么不是 Ctrl-CC Runtime 管理问题，而是机器上找不到可绕过 shell wrapper 的 Claude CLI JS。直接执行：

```powershell
Get-ChildItem "$env:APPDATA\npm" -Recurse -Filter "*.js" | Where-Object { $_.FullName -match "claude-code" } | Select-Object FullName
```

找到 `cli.js` 后：

```powershell
setx CTRL_CC_CLAUDE_JS "实际找到的 cli.js 完整路径"
```

重启 Ctrl-CC，再运行诊断。

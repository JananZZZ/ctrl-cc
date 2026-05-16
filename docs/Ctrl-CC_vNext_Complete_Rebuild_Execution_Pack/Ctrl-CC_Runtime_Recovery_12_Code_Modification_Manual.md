# Ctrl-CC Runtime Recovery 12.0 — 稳定可执行代码修改说明书

> 适用仓库：`JananZZZ/ctrl-cc`  
> 适用分支：`master`  
> 建议新建分支：`fix/runtime-recovery-12`  
> 目标：彻底解决 `powershell.exe 0xc0000142`、Diagnostics 假通过、Runtime split-brain、`Session not found: ses-xxx`、页面升级未落地等问题，并为 100%+200%+500% 建立稳定地基。  
>
> 执行原则：先 Runtime，后页面。没有真实 Runtime，Console / Projects / Resources / AI Dock 的所有“升级”都会变成假 UI。

---

## 0. 先做分支

```bash
git checkout master
git pull origin master
git checkout -b fix/runtime-recovery-12
```

执行前先保存当前状态：

```bash
git status
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
```

即使现在报错，也要把错误保存到：

```text
docs/audit/baseline-typecheck.txt
docs/audit/baseline-cargo-check.txt
```

---

## 1. 当前问题定性

### 1.1 PowerShell 0xc0000142

当前 `Discovery` 逻辑只判断 PowerShell 路径存在，就可能 selected。实际运行时：

```text
powershell.exe 0xc0000142
```

说明 PowerShell 在当前 Tauri / GUI / PTY 环境里无法初始化。  
因此 Discovery 必须从“路径发现”升级为“可执行 LaunchPlan 发现”。

### 1.2 Diagnostics 假通过

当前空状态：

```text
Frontend RuntimeStore (0 sessions)
PTY Registry (0)
Trace Timeline (0)
ALL CONTRACTS PASSED
```

这是错误的。正确状态：

```text
NOT TESTED — NO SESSIONS
```

真正 Contract Test 必须主动创建 session、启动 PTY、检查 registry、检查 writer、写入测试、停止。

### 1.3 Runtime split-brain

当前仍然有：

```text
WorkspaceSurface -> interactionAdapter.startPtyV2ClaudeSession
ProjectsSurface -> interactionAdapter.startPtyV2ClaudeSession
usePtyTerminal -> writePtyV2 / resizePtyV2 / sendCtrlC
RuntimeBridge -> 另一套路由
后端 old PtyManager -> session_id 作为 registry key
```

必须统一：

```text
Surface -> RuntimeBridge -> runtime_v2 commands -> RuntimeManager -> backend registry key = ptySessionId
```

---

## 2. 全局硬规则

### 2.1 不允许 Surface 直接碰 PTY

全仓库搜索：

```bash
rg "startPtyV2ClaudeSession|writePtyV2|resizePtyV2|sendCtrlCPtyV2|sendCtrlDPtyV2|stopPtyV2" src
```

除 `src/features/runtime/services/interactionAdapter.ts` 和过渡期 `runtimeBridge.ts` 外，其他文件不得出现。

### 2.2 四种 ID 分离

```ts
type UiSessionId = string;      // ses-xxx
type PtySessionId = string;     // pty-uuid
type ClaudeSessionId = string;  // Claude Code 自己的 session id
type TraceId = string;          // trace-uuid
```

### 2.3 后端 registry key 必须是 ptySessionId

后端错误不得再出现：

```text
Session not found: ses-xxx
```

应该是：

```text
PTY session not found: pty-xxx (uiSessionId=ses-xxx)
```

---

# Phase A：修 Diagnostics 假通过

## A1. 修改文件

```text
src/features/runtime/components/RuntimeDiagnosticsPanel.tsx
```

## A2. 新增状态判断函数

把任何 `mismatches.length === 0 ? passed` 逻辑替换为：

```ts
function getContractStatus(probe: RuntimeContractProbeResult | null) {
  if (!probe) {
    return {
      label: "NOT RUN",
      tone: "muted" as const,
      detail: "Runtime contract probe has not been executed.",
    };
  }

  const frontendCount = probe.frontendSessions?.length ?? 0;
  const backendCount = probe.backendPtySessions?.length ?? 0;
  const mismatchCount = probe.mismatches?.length ?? 0;

  if (frontendCount === 0 && backendCount === 0) {
    return {
      label: "NOT TESTED — NO SESSIONS",
      tone: "warning" as const,
      detail: "No frontend RuntimeSession and no backend PTY session exist. Run an active Runtime Contract Test.",
    };
  }

  if (mismatchCount > 0) {
    return {
      label: `${mismatchCount} CONTRACT MISMATCHES`,
      tone: "error" as const,
      detail: "Frontend RuntimeStore and backend PTY registry are inconsistent.",
    };
  }

  return {
    label: "CONTRACTS PASSED",
    tone: "success" as const,
    detail: "RuntimeSession mappings match backend PTY registry.",
  };
}
```

UI 显示：

```tsx
const contractStatus = getContractStatus(probe);

<div className={`runtime-contract-status ${contractStatus.tone}`}>
  <strong>{contractStatus.label}</strong>
  <p>{contractStatus.detail}</p>
</div>
```

## A3. 新增真实 Contract Test 按钮

```tsx
<button onClick={() => void runActiveContractTest()} disabled={contractTestRunning}>
  {contractTestRunning ? "Running Contract Test..." : "Run Active Runtime Contract Test"}
</button>
```

```ts
async function runActiveContractTest() {
  setContractTestRunning(true);
  setContractTestResult(null);

  try {
    const result = await RuntimeBridge.runContractTest({
      projectId: "diagnostic",
      projectName: "Runtime Diagnostic",
      cwd: await RuntimeBridge.getDefaultDiagnosticCwd(),
    });

    setContractTestResult(result);
    await refreshProbe();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setContractTestResult({ ok: false, error: message });
    RuntimeBridge.recordError?.({
      type: "diagnostics.contract_test.failed",
      level: "error",
      message,
      payload: { source: "RuntimeDiagnosticsPanel" },
    });
  } finally {
    setContractTestRunning(false);
  }
}
```

如果 `RuntimeBridge.recordError` 不存在，先用：

```ts
useRuntimeStore.getState().addEvent({
  type: "diagnostics.contract_test.failed",
  level: "error",
  message,
});
```

---

# Phase B：新增后端 runtime_v2

## B1. 新建目录

```text
src-tauri/src/runtime_v2/
```

文件：

```text
mod.rs
runtime_types.rs
process_canary.rs
claude_launch_plan.rs
claude_discovery.rs
runtime_manager.rs
runtime_commands.rs
```

## B2. `mod.rs`

```rust
pub mod runtime_types;
pub mod process_canary;
pub mod claude_launch_plan;
pub mod claude_discovery;
pub mod runtime_manager;
pub mod runtime_commands;
```

## B3. `runtime_types.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub mode: String,
    pub session_name: Option<String>,
    pub resume_target: Option<String>,
    pub initial_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveResponse {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub status: String,
    pub launch_plan_id: String,
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWriteRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStopRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePtySessionDebugInfo {
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiscoveryResult {
    pub selected: Option<ClaudeLaunchPlanDebug>,
    pub plans: Vec<ClaudeLaunchPlanDebug>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeLaunchPlanDebug {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub canary_ok: bool,
    pub version_ok: bool,
    pub version_text: Option<String>,
    pub error: Option<String>,
    pub selected: bool,
}
```

## B4. `process_canary.rs`

```rust
use std::process::{Command, Stdio};

pub fn canary_program(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("spawn failed: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "exit={:?}, stderr={}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn canary_program_owned(program: &str, args: &[String]) -> Result<String, String> {
    let ref_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    canary_program(program, &ref_args)
}
```

## B5. `claude_launch_plan.rs`

```rust
#[derive(Debug, Clone)]
pub struct ClaudeLaunchPlan {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub reason: String,
}

impl ClaudeLaunchPlan {
    pub fn command_parts(&self, claude_args: &[String]) -> (String, Vec<String>) {
        let mut args = self.args_prefix.clone();
        args.extend_from_slice(claude_args);
        (self.program.clone(), args)
    }

    pub fn version_args(&self) -> Vec<String> {
        let mut args = self.args_prefix.clone();
        args.push("--version".to_string());
        args
    }
}
```

## B6. `claude_discovery.rs`

> 重点：优先 `node.exe + Claude CLI JS`，PowerShell 和 CMD 必须 canary 成功后才可用。

```rust
use std::env;
use std::path::PathBuf;

use super::claude_launch_plan::ClaudeLaunchPlan;
use super::process_canary::canary_program_owned;
use super::runtime_types::{ClaudeLaunchPlanDebug, RuntimeDiscoveryResult};

pub fn discover_claude() -> RuntimeDiscoveryResult {
    let mut debug = Vec::new();
    let mut selected: Option<ClaudeLaunchPlanDebug> = None;
    let mut errors = Vec::new();

    for plan in collect_launch_plans() {
        let (canary_ok, version_ok, version_text, error) = match canary_launch_plan(&plan) {
            Ok(version) => (true, true, Some(version), None),
            Err(err) => (false, false, None, Some(err)),
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
    for plan in collect_launch_plans() {
        if canary_launch_plan(&plan).is_ok() {
            return Ok(plan);
        }
    }

    Err("No runnable Claude launch plan found. Install Node.js and Claude Code CLI, or set CTRL_CC_CLAUDE_COMMAND.".to_string())
}

fn collect_launch_plans() -> Vec<ClaudeLaunchPlan> {
    let mut plans = Vec::new();

    if let Ok(command) = env::var("CTRL_CC_CLAUDE_COMMAND") {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            plans.push(ClaudeLaunchPlan {
                id: "user-override".to_string(),
                label: "User override".to_string(),
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
                reason: "pwsh + npm PowerShell shim".to_string(),
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
                reason: "Windows PowerShell + npm PowerShell shim".to_string(),
            });
        }
    }

    if let Some(cmd) = find_cmd_exe() {
        if let Some(cmd_shim) = find_claude_cmd() {
            plans.push(ClaudeLaunchPlan {
                id: "cmd-claude-cmd".to_string(),
                label: "cmd.exe + claude.cmd".to_string(),
                program: cmd.to_string_lossy().to_string(),
                args_prefix: vec![
                    "/d".into(),
                    "/s".into(),
                    "/c".into(),
                    cmd_shim.to_string_lossy().to_string(),
                ],
                reason: "Last resort. Avoid if cmd.exe fails 0xc0000142.".to_string(),
            });
        }
    }

    plans
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
    let appdata = env::var("APPDATA").ok().map(PathBuf::from);
    let mut candidates = Vec::new();

    if let Some(appdata) = appdata {
        candidates.push(appdata.join(r"npm\node_modules\@anthropic-ai\claude-code\cli.js"));
        candidates.push(appdata.join(r"npm\node_modules\@anthropic-ai\claude-code\bin\claude.js"));
        candidates.push(appdata.join(r"npm\node_modules\@anthropic-ai\claude-code\index.js"));
    }

    candidates.into_iter().find(|p| p.exists())
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


## B7. `runtime_manager.rs`

```rust
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};

use super::claude_discovery::select_launch_plan;
use super::runtime_types::{
    RuntimePtySessionDebugInfo, RuntimeStartInteractiveRequest, RuntimeStartInteractiveResponse,
    RuntimeStopRequest, RuntimeWriteRequest,
};

pub struct RuntimeManager {
    sessions: Arc<Mutex<HashMap<String, RuntimePtyHandle>>>,
}

pub struct RuntimePtyHandle {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub last_error: Option<String>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl Default for RuntimeManager {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl RuntimeManager {
    pub fn start_interactive(
        &self,
        app: AppHandle,
        req: RuntimeStartInteractiveRequest,
    ) -> Result<RuntimeStartInteractiveResponse, String> {
        if req.cwd.trim().is_empty() {
            return Err("cwd is empty".into());
        }

        let cwd_path = std::path::PathBuf::from(&req.cwd);
        if !cwd_path.exists() {
            return Err(format!("cwd not found: {}", req.cwd));
        }
        if !cwd_path.is_dir() {
            return Err(format!("cwd is not a directory: {}", req.cwd));
        }

        let plan = select_launch_plan()?;
        let mut claude_args = build_claude_args(&req);
        if let Some(initial) = &req.initial_prompt {
            if !initial.trim().is_empty() {
                claude_args.push(initial.clone());
            }
        }

        let (program, args) = plan.command_parts(&claude_args);

        let pty_system = NativePtySystem::default();
        let pair = pty_system
            .openpty(PtySize {
                rows: 32,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("openpty failed: {}", e))?;

        let mut cmd = CommandBuilder::new(program.clone());
        for arg in &args {
            cmd.arg(arg);
        }
        cmd.cwd(&req.cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("pty spawn failed: {}", e))?;

        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone reader failed: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take writer failed: {}", e))?;

        let pid = child.process_id();

        let handle = RuntimePtyHandle {
            trace_id: req.trace_id.clone(),
            ui_session_id: req.ui_session_id.clone(),
            pty_session_id: req.pty_session_id.clone(),
            project_id: req.project_id.clone(),
            cwd: req.cwd.clone(),
            pid,
            status: "pty-ready".into(),
            has_writer: true,
            reader_alive: true,
            created_at: Utc::now().to_rfc3339(),
            last_error: None,
            writer,
            child,
        };

        {
            let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            sessions.insert(req.pty_session_id.clone(), handle);
        }

        let app_for_reader = app.clone();
        let ui_session_id = req.ui_session_id.clone();
        let pty_session_id = req.pty_session_id.clone();
        let trace_id = req.trace_id.clone();
        let sessions_ref = self.sessions.clone();

        std::thread::spawn(move || {
            let _ = app_for_reader.emit(
                "runtime://session-status",
                serde_json::json!({
                    "traceId": trace_id,
                    "uiSessionId": ui_session_id,
                    "ptySessionId": pty_session_id,
                    "status": "reader-started",
                }),
            );

            let mut buf = [0u8; 8192];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_for_reader.emit(
                            "pty://data",
                            serde_json::json!({
                                "traceId": trace_id,
                                "uiSessionId": ui_session_id,
                                "ptySessionId": pty_session_id,
                                "session_id": ui_session_id,
                                "data": data,
                            }),
                        );
                    }
                    Err(err) => {
                        let _ = app_for_reader.emit(
                            "pty://error",
                            serde_json::json!({
                                "traceId": trace_id,
                                "uiSessionId": ui_session_id,
                                "ptySessionId": pty_session_id,
                                "error": err.to_string(),
                            }),
                        );
                        break;
                    }
                }
            }

            if let Ok(mut sessions) = sessions_ref.lock() {
                if let Some(handle) = sessions.get_mut(&pty_session_id) {
                    handle.reader_alive = false;
                    handle.status = "exited".into();
                }
            }

            let _ = app_for_reader.emit(
                "pty://exit",
                serde_json::json!({
                    "traceId": trace_id,
                    "uiSessionId": ui_session_id,
                    "ptySessionId": pty_session_id,
                }),
            );
        });

        let _ = app.emit(
            "runtime://session-status",
            serde_json::json!({
                "traceId": req.trace_id,
                "uiSessionId": req.ui_session_id,
                "ptySessionId": req.pty_session_id,
                "status": "pty-ready",
            }),
        );

        Ok(RuntimeStartInteractiveResponse {
            trace_id: req.trace_id,
            ui_session_id: req.ui_session_id,
            pty_session_id: req.pty_session_id,
            pid,
            cwd: req.cwd,
            status: "pty-ready".into(),
            launch_plan_id: plan.id,
            program,
            args,
        })
    }

    pub fn write(&self, req: RuntimeWriteRequest) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let handle = sessions.get_mut(&req.pty_session_id).ok_or_else(|| {
            format!(
                "PTY session not found: {} (uiSessionId={})",
                req.pty_session_id, req.ui_session_id
            )
        })?;

        handle
            .writer
            .write_all(req.data.as_bytes())
            .map_err(|e| format!("PTY write failed: {}", e))?;

        handle
            .writer
            .flush()
            .map_err(|e| format!("PTY flush failed: {}", e))?;

        Ok(())
    }

    pub fn stop(&self, req: RuntimeStopRequest) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let mut handle = sessions.remove(&req.pty_session_id).ok_or_else(|| {
            format!(
                "PTY session not found: {} (uiSessionId={})",
                req.pty_session_id, req.ui_session_id
            )
        })?;

        handle
            .child
            .kill()
            .map_err(|e| format!("kill failed: {}", e))?;

        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<RuntimePtySessionDebugInfo>, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        Ok(sessions
            .values()
            .map(|h| RuntimePtySessionDebugInfo {
                ui_session_id: h.ui_session_id.clone(),
                pty_session_id: h.pty_session_id.clone(),
                project_id: h.project_id.clone(),
                cwd: h.cwd.clone(),
                pid: h.pid,
                status: h.status.clone(),
                has_writer: h.has_writer,
                reader_alive: h.reader_alive,
                created_at: h.created_at.clone(),
                last_error: h.last_error.clone(),
            })
            .collect())
    }
}

fn build_claude_args(req: &RuntimeStartInteractiveRequest) -> Vec<String> {
    let mut args = Vec::new();

    if let Some(permission) = &req.permission_mode {
        args.push("--permission-mode".into());
        args.push(permission.clone());
    }

    if let Some(model) = &req.model {
        args.push("--model".into());
        args.push(model.clone());
    }

    match req.mode.as_str() {
        "continue" => args.push("--continue".into()),
        "resume" => {
            args.push("--resume".into());
            if let Some(target) = &req.resume_target {
                args.push(target.clone());
            }
        }
        _ => {}
    }

    args
}
```

---

## B8. `runtime_commands.rs`

```rust
use tauri::State;

use super::claude_discovery::discover_claude;
use super::runtime_manager::RuntimeManager;
use super::runtime_types::{
    RuntimeDiscoveryResult, RuntimePtySessionDebugInfo, RuntimeStartInteractiveRequest,
    RuntimeStartInteractiveResponse, RuntimeStopRequest, RuntimeWriteRequest,
};

#[tauri::command]
pub fn runtime_discover_claude_v2() -> RuntimeDiscoveryResult {
    discover_claude()
}

#[tauri::command]
pub fn runtime_start_interactive_v2(
    app: tauri::AppHandle,
    manager: State<'_, RuntimeManager>,
    req: RuntimeStartInteractiveRequest,
) -> Result<RuntimeStartInteractiveResponse, String> {
    manager.start_interactive(app, req)
}

#[tauri::command]
pub fn runtime_write_v2(
    manager: State<'_, RuntimeManager>,
    req: RuntimeWriteRequest,
) -> Result<(), String> {
    manager.write(req)
}

#[tauri::command]
pub fn runtime_stop_v2(
    manager: State<'_, RuntimeManager>,
    req: RuntimeStopRequest,
) -> Result<(), String> {
    manager.stop(req)
}

#[tauri::command]
pub fn runtime_list_sessions_v2(
    manager: State<'_, RuntimeManager>,
) -> Result<Vec<RuntimePtySessionDebugInfo>, String> {
    manager.list_sessions()
}
```

---

## B9. 修改 `src-tauri/src/main.rs`

增加模块：

```rust
mod runtime_v2;
```

增加 manager：

```rust
.manage(runtime_v2::runtime_manager::RuntimeManager::default())
```

增加 invoke handler：

```rust
runtime_v2::runtime_commands::runtime_discover_claude_v2,
runtime_v2::runtime_commands::runtime_start_interactive_v2,
runtime_v2::runtime_commands::runtime_write_v2,
runtime_v2::runtime_commands::runtime_stop_v2,
runtime_v2::runtime_commands::runtime_list_sessions_v2,
```

---

# Phase C：前端 RuntimeBridge 改为 runtime_v2

## C1. 修改 `src/features/runtime/types/runtimeTypes.ts`

确保存在：

```ts
export type UiSessionId = string;
export type PtySessionId = string;
export type ClaudeSessionId = string;
export type TraceId = string;

export type RuntimeSessionStatus =
  | "created"
  | "workspace-opened"
  | "discovering"
  | "discovery-failed"
  | "pty-starting"
  | "pty-ready"
  | "claude-launching"
  | "claude-active"
  | "idle"
  | "waiting-permission"
  | "failed"
  | "exited"
  | "killed"
  | "disconnected";

export function canWriteToRuntime(status: RuntimeSessionStatus): boolean {
  return (
    status === "pty-ready" ||
    status === "claude-launching" ||
    status === "claude-active" ||
    status === "idle" ||
    status === "waiting-permission"
  );
}
```

---

## C2. 修改 `src/features/runtime/services/runtimeBridge.ts`

核心要求：

```text
1. startInteractiveSession 生成 uiSessionId / ptySessionId / traceId。
2. 立即写 RuntimeStore + legacy SessionStore + OpenSessionStore。
3. 立即 navigate workspace。
4. 后台 invoke runtime_start_interactive_v2。
5. write 通过 uiSessionId 查 ptySessionId，再 invoke runtime_write_v2。
6. stop invoke runtime_stop_v2。
7. discover invoke runtime_discover_claude_v2。
8. listBackendSessions invoke runtime_list_sessions_v2。
```

可以保留现有文件结构，但必须删除对旧 adapter 的强依赖：

```ts
adapter.startPtyV2ClaudeSession
adapter.writePtyV2
```

`write()` 必须是：

```ts
export async function write(uiSessionId: string, data: string): Promise<void> {
  const session = useRuntimeStore.getState().sessions[uiSessionId];

  if (!session) {
    throw new Error(`UI session not found: ${uiSessionId}`);
  }

  if (!session.ptySessionId) {
    throw new Error(`PTY session not attached: ${uiSessionId}`);
  }

  if (!canWriteToRuntime(session.status)) {
    throw new Error(`Runtime not ready: ${session.status}`);
  }

  await invoke("runtime_write_v2", {
    req: {
      traceId: session.traceId,
      uiSessionId: session.id,
      ptySessionId: session.ptySessionId,
      data,
    },
  });
}
```

`startInteractiveInBackground()` 必须 invoke：

```ts
await invoke("runtime_start_interactive_v2", {
  req: {
    traceId: session.traceId,
    uiSessionId: session.id,
    ptySessionId: session.ptySessionId,
    projectId: session.projectId,
    cwd: session.cwd,
    model: input.model ?? null,
    permissionMode: input.permissionMode ?? "default",
    mode: input.mode ?? "new",
    sessionName: input.sessionName ?? null,
    resumeTarget: input.resumeTarget ?? null,
    initialPrompt: input.initialPrompt ?? null,
  },
});
```

---

# Phase D：删除 Workspace / Projects / Terminal 的 split-brain

## D1. `src/surfaces/workspace/WorkspaceSurface.tsx`

删除：

```ts
import { startPtyV2ClaudeSession, stopPtyV2 } from '../../features/runtime/services/interactionAdapter';
```

新增：

```ts
import { RuntimeBridge } from '../../features/runtime/services/runtimeBridge';
```

把所有手动创建 session + startPty 的逻辑替换为：

```ts
await RuntimeBridge.startInteractiveSession({
  projectId,
  projectName: proj?.name ?? "Project",
  cwd,
  mode: "new",
});
```

发送只允许：

```ts
await RuntimeBridge.write(activeTabId, text + "\r");
```

停止只允许：

```ts
await RuntimeBridge.stop(sessionId);
```

---

## D2. `src/surfaces/projects/ProjectsSurface.tsx`

删除：

```ts
import { startPtyV2ClaudeSession } from '../../features/runtime/services/interactionAdapter';
```

新增：

```ts
import { RuntimeBridge } from '../../features/runtime/services/runtimeBridge';
```

`handleCreateSession(projectId)` 改为：

```ts
const project = projects.find((p) => p.id === projectId);
if (!project) return;

await RuntimeBridge.startInteractiveSession({
  projectId: project.id,
  projectName: project.name,
  cwd: project.path,
  mode: "new",
});
```

不要再手动 `addSession / openSession / startPtyV2ClaudeSession`。

---

## D3. `src/features/terminal/usePtyTerminal.ts`

删除：

```ts
writePtyV2
resizePtyV2
sendCtrlCPtyV2
sendCtrlDPtyV2
```

新增：

```ts
import { RuntimeBridge } from '../runtime/services/runtimeBridge';
```

`onData` 改为：

```ts
term.onData((data) => {
  if (!sessionId) return;
  RuntimeBridge.write(sessionId, data).catch((error) => {
    console.warn("terminal write failed:", error);
  });
});
```

监听 `pty://data` 时：

```ts
if (payload.uiSessionId !== sessionId && payload.session_id !== sessionId) return;
```

---

# Phase E：Diagnostics 接 runtime_v2

## E1. `src/features/runtime/services/runtimeContractProbe.ts`

改 backend list command：

```ts
const backendPtySessions = await invoke("runtime_list_sessions_v2");
```

## E2. Discovery UI

在 `RuntimeDiagnosticsPanel.tsx` 新增：

```tsx
<button onClick={() => void runDiscovery()}>Run Claude Discovery</button>
```

```ts
async function runDiscovery() {
  const result = await RuntimeBridge.discover();
  setDiscovery(result);
}
```

显示列：

```text
Plan ID
Program
Args Prefix
Canary OK
Version OK
Selected
Error
```

---

# Phase F：页面升级为什么没变化，以及怎么落地

当前新页面没变化的直接原因：

```text
SurfaceHost 仍然引用 src/surfaces/*
```

正确做法：

```text
创建 src/features/console/pages/ConsoleSurface.tsx
创建 src/features/projects/pages/ProjectsSurface.tsx
创建 src/features/resources/pages/ResourcesSurface.tsx
创建 src/features/dock/pages/AIDockSurface.tsx
修改 src/app/SurfaceHost.tsx 引用 features/*/pages
```

但注意：页面升级必须在 Runtime 可用后做。否则只是漂亮空壳。

---

# Phase G：最小商用级页面落地

## G1. Console 最小新页面

创建：

```text
src/features/console/pages/ConsoleSurface.tsx
```

内容必须至少包括：

```text
Mission Hero
Runtime Health Strip
Quick Start Deck
Active Work Board
Need Attention Queue
```

所有 Runtime 动作只调用：

```ts
RuntimeBridge.startInteractiveSession
RuntimeBridge.stop
RuntimeBridge.write
```

## G2. Projects 最小新页面

创建：

```text
src/features/projects/pages/ProjectsSurface.tsx
```

必须：

```text
显示项目列表
显示项目状态
New Session 调 RuntimeBridge.startInteractiveSession
Stop 调 RuntimeBridge.stop
不直接 import interactionAdapter
```

## G3. Resources 最小新页面

创建：

```text
src/features/resources/pages/ResourcesSurface.tsx
```

保留原文件读写能力，新增：

```ts
ResourceActivationBridge.insertIntoChat(resourceId, uiSessionId)
ResourceActivationBridge.applyToProject(resourceId, projectId)
```

Resources 不直接运行 Claude。

## G4. Dock 最小新页面

当前 `components/dock/AIDock.tsx` 暂时保留为 launcher。  
新增：

```text
src/features/dock/pages/AIDockSurface.tsx
```

Dock 的所有动作都通过：

```ts
RuntimeBridge
NavigationBus
DockActionBridge
```

---

# Phase H：验收命令

每阶段必须执行：

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

# Phase I：最终验收清单

## Runtime

```text
[ ] Discovery Matrix 中 powershell 0xc0000142 不会 selected。
[ ] 如果 node direct 可用，则 selected = direct-node-js。
[ ] RuntimeBridge.startInteractiveSession 生成 uiSessionId + ptySessionId + traceId。
[ ] runtime_start_interactive_v2 使用 ptySessionId 作为 registry key。
[ ] runtime_list_sessions_v2 能看到 ptySessionId。
[ ] RuntimeBridge.write 调 runtime_write_v2，参数包含 ptySessionId。
[ ] 不再出现 Session not found: ses-xxx。
```

## Diagnostics

```text
[ ] 空状态显示 NOT TESTED — NO SESSIONS。
[ ] Contract Test 会真实创建 session。
[ ] Contract Test 失败显示具体阶段。
[ ] Discovery Matrix 显示 plan、canary、version、error。
```

## Surfaces

```text
[ ] WorkspaceSurface 不 import interactionAdapter。
[ ] ProjectsSurface 不 import interactionAdapter。
[ ] usePtyTerminal 不 import interactionAdapter。
[ ] SurfaceHost 引用 features/*/pages。
```

## Product

```text
[ ] Console 有 Mission Hero / Health Strip / Active Work。
[ ] Projects 新建会话走 RuntimeBridge。
[ ] Resources 有 ResourceActivationBridge。
[ ] Dock 不再直接操作 PTY。
```

---

# Phase J：给 Claude CLI 的短 Prompt

```text
执行 Ctrl-CC Runtime Recovery 12.0。严格按文档修改，不允许跳步骤。

当前问题：
- powershell.exe 0xc0000142，但 Discovery 仍 selected powershell。
- Diagnostics 空状态显示 ALL CONTRACTS PASSED，是假通过。
- RuntimeBridge 生成 ptySessionId 但没有真正用于 backend registry。
- WorkspaceSurface / ProjectsSurface / usePtyTerminal 仍绕过 RuntimeBridge。
- 新 Console/Projects/Resources/Dock 页面没有落地，因为 SurfaceHost 仍引用旧 src/surfaces。

必须完成：
1. 新增 src-tauri/src/runtime_v2，包含 runtime_types、process_canary、claude_launch_plan、claude_discovery、runtime_manager、runtime_commands。
2. Discovery 优先 direct node.exe + Claude CLI JS。powershell/cmd 必须 canary 通过才可 selected。
3. 新增 runtime_start_interactive_v2/runtime_write_v2/runtime_stop_v2/runtime_list_sessions_v2/runtime_discover_claude_v2。
4. 后端 registry key 必须是 ptySessionId。
5. RuntimeBridge 改为 runtime_v2 唯一入口。
6. WorkspaceSurface / ProjectsSurface / usePtyTerminal 删除 interactionAdapter import，全部改 RuntimeBridge。
7. Diagnostics 空状态显示 NOT TESTED，不得显示 passed。
8. Contract Test 必须真实创建 session 并检查 backend registry/writer。
9. 创建 features/console/projects/resources/dock 新页面，并修改 SurfaceHost 挂载新页面。
10. 运行 npm run typecheck、npm run build、cargo check。

验收：
- Discovery 不再 selected 0xc0000142 的 powershell。
- Console -> New Session -> Workspace。
- Runtime list 能看到 ptySessionId。
- ChatComposer 发送进入同一个 PTY。
- 不再出现 Session not found: ses-xxx。
- SurfaceHost 使用新 feature pages。
```

---

## 附录：为什么不继续修 old PTY

旧 PTY 不是完全不能用，而是已经被多套 store、多套 surface、多套 ID 合约污染：

```text
修 Workspace，Projects 仍绕过
修 RuntimeBridge，usePtyTerminal 仍直连
修 Diagnostics，Contract Test 仍假通过
修 powershell，cmd 仍可能 0xc0000142
```

所以必须新建 `runtime_v2`，所有新功能只接 `runtime_v2`。旧命令保留为 deprecated wrapper，等新链路稳定后再删除。

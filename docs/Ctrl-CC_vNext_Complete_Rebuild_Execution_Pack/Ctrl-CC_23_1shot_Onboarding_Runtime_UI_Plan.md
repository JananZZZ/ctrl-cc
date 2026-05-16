# Ctrl-CC 23.0 顶级商用级修复方案：复刻 1shot-CC 功能的首次启动引导 × Claude Code CLI 环境部署 × Runtime 全链路修复 × 统一视觉系统

适用仓库：

```text
Ctrl-CC:   https://github.com/JananZZZ/ctrl-cc/tree/master
参考项目: https://github.com/JananZZZ/1shot-cc
```

建议分支：

```bash
git checkout master
git pull origin master
git checkout -b fix/v23-onboarding-1shot-runtime-ui
```

---

## 0. 本轮目标

本轮不是继续局部修复 Chat/PTY，也不是简单增加一个环境检测按钮，而是把 Ctrl-CC 恢复成完整的商业级产品流程：

```text
首次启动 → 小白友好的环境配置向导 → 检测已有依赖 → 安全安装缺失依赖 → 配置 Claude Code CLI → 配置 API / provider → 验证可用 → 进入主程序
```

并且在非首次启动时：

```text
启动后不强制打断用户；
若环境不完整，用温和 Banner / Console 环境卡 / Settings 修复中心提醒用户完成配置；
Chat/Terminal 在环境未完成时进入 safe disabled 状态，给出清晰修复入口。
```

**注意：部署目标是 Claude Code CLI，不是 Claude 桌面端应用。**

---

## 1. 必须复制 1shot-CC 的功能，不复制 UI

1shot-CC 的产品目标是用 Windows 桌面向导帮助零命令行经验用户完成 Claude Code 环境搭建。Ctrl-CC 要迁移它的功能能力：

```text
1. 环境检测
2. 安装 Node.js
3. 安装 Git / Git Bash
4. 安装 Claude Code CLI
5. 修复 PowerShell 执行策略
6. 配置 npm 镜像源
7. 配置 Claude settings.json / .claude.json
8. API Provider 配置
9. 安装/检测 Windows Terminal
10. 检测 PATH / 中文路径 / APPDATA 路径问题
11. 安装过程进度推送
12. 错误诊断知识库
13. 配置备份
14. 完成页与启动 Claude Code CLI
15. 非首次启动的修复入口
```

但 UI 必须重做，不能直接套用 1shot-CC 的 Flask/Jinja/Vanilla JS 界面。Ctrl-CC 使用：

```text
React 18 + TS + Zustand + Tauri v2 + Rust backend + current four-theme visual system
```

---

## 2. 当前 Ctrl-CC 最新代码审计结论

### 2.1 Runtime Fabric 已有雏形，但 Chat 仍没有完整闭环

当前 `runtimeFabricBridge.ts` 已经提供：

```ts
createCtrlCcSession()
sendChatMessage()
startTerminalChannel()
```

其中 `createCtrlCcSession()` 会创建 Fabric session、写入 SessionStore、打开 Workspace，并默认 viewMode 为 `chat`。这是正确方向。

但是问题仍然存在：

```text
1. createCtrlCcSession 创建的 session status 仍写成 starting，容易让 UI 误以为 runtime 已启动。
2. sendChatMessage 只 append ledger，不保证 ChatView 可显示 assistant 消息。
3. startTerminalChannel 仍会调用 legacy runtime_start_interactive_v2，Terminal 失败虽然不改 Session failed，但 UI 仍容易显示 failed / missing。
```

### 2.2 WorkspaceSurface 的 ChatView 数据源仍然不完整

当前 `WorkspaceSurface.tsx` 监听的是：

```ts
listen<RuntimeEvent>('runtime:event', ...)
```

然后将 `rawEvents` 交给 ChatView。Runtime Fabric 的 `runtime://chat-stream` 是进入 `runtimeFabricEventBridge.ts`，只写入 Fabric ledger。  
所以即使 stream-json 后端产生输出，也不一定出现在 ChatView。

必须建立：

```text
runtime://chat-stream → RuntimeFabricEventBridge → RuntimeFabricStore.chatEvents → WorkspaceSurface → ChatView
```

### 2.3 当前 App 已安装 RuntimeFabricEventBridge，但缺少 Onboarding Gate

当前 `App.tsx` 已经安装：

```ts
installRuntimeLifecycleBridge()
installRuntimeFabricEventBridge()
```

但没有：

```text
首次启动引导
环境完整性 gate
非首次启动环境修复提醒
统一 EnvironmentStore / SetupStore
```

### 2.4 1shot-CC 的检测逻辑更完整

1shot-CC 的 detector 包含 Node.js、npm、Git、Claude Code、CC-Switch、Color-cc、Claude 配置、Windows Terminal、PowerShell 执行策略、npm registry、PATH、路径问题等检测项，且有 60 秒缓存。Ctrl-CC 应迁移这一套思路，而不是继续零散检测。

### 2.5 1shot-CC 的安装逻辑更适合小白

1shot-CC 的安装 API 使用后台任务 + 进度状态：

```text
task_id
step
progress
message
done
error
```

并且安装前有 preflight，失败时返回 error_detail。Ctrl-CC 应改为 Tauri event 版本：

```text
setup://task-progress
setup://task-log
setup://task-error
setup://task-complete
```

### 2.6 1shot-CC 的配置写入逻辑必须迁移

1shot-CC 的 config_writer 支持：

```text
1. 读取 settings.json
2. 写入 ANTHROPIC_AUTH_TOKEN
3. 写入 ANTHROPIC_BASE_URL
4. 写入默认 Haiku / Sonnet / Opus 模型
5. 写入 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
6. 写入 .claude.json 的 hasCompletedOnboarding
7. 备份原配置
8. 脱敏读取当前配置
```

Ctrl-CC 必须完整复制功能，但表单 UI 改成 Ctrl-CC 风格。

---

## 3. 产品级架构：Setup Center + Runtime Fabric

最终架构：

```text
Ctrl-CC App
├── Setup Center
│   ├── FirstRun Wizard
│   ├── Environment Check
│   ├── Dependency Installer
│   ├── Provider/API Config
│   ├── Safe Repair Center
│   └── Completion Verify
│
├── Runtime Fabric
│   ├── Chat Channel      = claude -p --output-format stream-json
│   ├── Terminal Channel  = claude interactive via PTY
│   ├── Background Channel
│   └── Event Ledger
│
├── Main Surfaces
│   ├── Console
│   ├── Projects
│   ├── Workspace
│   ├── Resources
│   ├── Settings
│   ├── Diagnostics
│   └── GitHub
│
└── AI Dock
    └── Independent right-edge desktop window, not internal floating sidebar
```

---

## 4. Phase A：建立 Setup Domain

### A1. 新建目录

```text
src/features/setup/
src/features/setup/types/
src/features/setup/stores/
src/features/setup/services/
src/features/setup/components/
src/features/setup/styles/
```

### A2. 新建类型文件

新建：

```text
src/features/setup/types/setupTypes.ts
```

写入：

```ts
export type SetupStatus = 'unknown' | 'checking' | 'ok' | 'warning' | 'missing' | 'error' | 'installing' | 'done';

export type SetupItemId =
  | 'nodejs'
  | 'npm'
  | 'git'
  | 'gitBash'
  | 'claudeCode'
  | 'claudeAuth'
  | 'claudeConfig'
  | 'windowsTerminal'
  | 'powershellPolicy'
  | 'npmRegistry'
  | 'pathEnv'
  | 'pathIssues'
  | 'workspace'
  | 'apiProvider';

export interface SetupCheckResult {
  id: SetupItemId;
  label: string;
  status: SetupStatus;
  installed: boolean;
  ok: boolean;
  required: boolean;
  version?: string;
  latestVersion?: string;
  outdated?: boolean;
  paths: string[];
  method?: string;
  message?: string;
  error?: string;
  fixHint?: string;
  details?: Record<string, unknown>;
}

export interface ClaudeCommandCapability {
  id: string;
  label: string;
  program: string;
  argsPrefix: string[];
  kind: 'nativeExe' | 'cmdShim' | 'powershellShim' | 'gitBash' | 'npmShim' | 'npxDiagnostic' | 'unknown';
  source: string;
  versionOk: boolean;
  versionText?: string | null;
  printOk: boolean;
  interactivePtyOk: boolean;
  selectableForChat: boolean;
  selectableForTerminal: boolean;
  recommendedForChat: boolean;
  recommendedForTerminal: boolean;
  error?: string | null;
}

export interface SetupSnapshot {
  generatedAt: string;
  ready: boolean;
  severity: 'ok' | 'warning' | 'error';
  summary: string;
  checks: Record<SetupItemId, SetupCheckResult>;
  claudeCommands: ClaudeCommandCapability[];
  selectedChatCommandId: string | null;
  selectedTerminalCommandId: string | null;
}

export type SetupTaskStatus = 'queued' | 'running' | 'complete' | 'error' | 'cancelled';

export interface SetupTaskProgress {
  taskId: string;
  actionId: string;
  status: SetupTaskStatus;
  step: string;
  progress: number;
  message: string;
  error?: string;
  updatedAt: string;
}

export interface SetupAction {
  id: string;
  label: string;
  description: string;
  target: SetupItemId | 'all' | 'provider';
  kind: 'detect' | 'install' | 'repair' | 'configure' | 'verify' | 'openExternal' | 'copyCommand';
  commandPreview?: string;
  safeLevel: 'safe' | 'needs-confirmation' | 'admin-required' | 'manual-only';
  destructive: boolean;
}
```

---

## 5. Phase B：Rust 后端复刻 1shot-CC 检测功能

### B1. 新建后端目录

```text
src-tauri/src/setup/
```

新增：

```text
src-tauri/src/setup/mod.rs
src-tauri/src/setup/types.rs
src-tauri/src/setup/detector.rs
src-tauri/src/setup/installer.rs
src-tauri/src/setup/config_writer.rs
src-tauri/src/setup/error_resolver.rs
src-tauri/src/setup/path_helper.rs
src-tauri/src/setup/subprocess_runner.rs
src-tauri/src/setup/task_manager.rs
src-tauri/src/setup/commands.rs
```

### B2. `mod.rs`

```rust
pub mod types;
pub mod detector;
pub mod installer;
pub mod config_writer;
pub mod error_resolver;
pub mod path_helper;
pub mod subprocess_runner;
pub mod task_manager;
pub mod commands;
```

在 `src-tauri/src/main.rs` 增加：

```rust
mod setup;
```

### B3. `types.rs`

```rust
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupCheckResult {
    pub id: String,
    pub label: String,
    pub status: String,
    pub installed: bool,
    pub ok: bool,
    pub required: bool,
    pub version: Option<String>,
    pub latest_version: Option<String>,
    pub outdated: bool,
    pub paths: Vec<String>,
    pub method: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
    pub fix_hint: Option<String>,
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupSnapshot {
    pub generated_at: String,
    pub ready: bool,
    pub severity: String,
    pub summary: String,
    pub checks: HashMap<String, SetupCheckResult>,
    pub claude_commands: Vec<crate::runtime_v2::claude_command_resolver::ClaudeCommandSpec>,
    pub selected_chat_command_id: Option<String>,
    pub selected_terminal_command_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupTaskProgress {
    pub task_id: String,
    pub action_id: String,
    pub status: String,
    pub step: String,
    pub progress: f32,
    pub message: String,
    pub error: Option<String>,
    pub updated_at: String,
}
```

### B4. `subprocess_runner.rs`

```rust
use std::process::{Command, Stdio};

#[derive(Debug, Clone)]
pub struct CmdResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
}

pub fn run_cmd(program: &str, args: &[&str]) -> CmdResult {
    match Command::new(program).args(args).stdin(Stdio::null()).output() {
        Ok(o) => CmdResult {
            success: o.status.success(),
            stdout: String::from_utf8_lossy(&o.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).trim().to_string(),
            code: o.status.code(),
        },
        Err(e) => CmdResult { success: false, stdout: String::new(), stderr: e.to_string(), code: None },
    }
}

pub fn run_cmd_shell(command: &str) -> CmdResult {
    run_cmd("cmd.exe", &["/d", "/s", "/c", command])
}

pub fn run_powershell(script: &str) -> CmdResult {
    run_cmd("powershell.exe", &["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
}
```

### B5. `path_helper.rs`

```rust
use std::env;
use std::path::PathBuf;

pub fn user_home() -> PathBuf {
    env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

pub fn claude_config_dir() -> PathBuf { user_home().join(".claude") }
pub fn claude_settings_path() -> PathBuf { claude_config_dir().join("settings.json") }
pub fn claude_json_path() -> PathBuf { user_home().join(".claude.json") }

pub fn npm_global_path() -> Option<PathBuf> {
    let out = crate::setup::subprocess_runner::run_cmd_shell("npm root -g");
    if out.success && !out.stdout.trim().is_empty() { Some(PathBuf::from(out.stdout.trim())) } else { None }
}

pub fn find_on_path(exe: &str) -> Option<PathBuf> {
    let path_env = env::var_os("PATH")?;
    for dir in env::split_paths(&path_env) {
        let p = dir.join(exe);
        if p.exists() { return Some(p); }
    }
    None
}

pub fn appdata() -> Option<PathBuf> { env::var("APPDATA").ok().map(PathBuf::from) }
```

### B6. `detector.rs`

实现以下检测项，必须全部存在：

```text
nodejs
npm
git
gitBash
claudeCode
claudeAuth
claudeConfig
windowsTerminal
powershellPolicy
npmRegistry
pathEnv
pathIssues
workspace
apiProvider
```

核心规则：

```text
1. claudeCode 检测优先执行 cmd shell 的 `claude --version`。
2. 如果失败，再看 npm root -g 下是否存在 @anthropic-ai/claude-code 包。
3. 不执行 APPDATA\npm\claude extensionless 文件。
4. APPDATA\npm\claude.cmd 交给 Runtime resolver 的 cmdShim 处理。
5. API Provider 检测读取 ~/.claude/settings.json 中的 env 字段。
6. .claude.json 检测 hasCompletedOnboarding。
```

`detect_all_setup()` 返回：

```rust
pub fn detect_all_setup() -> SetupSnapshot
```

必需组件：

```text
nodejs
npm
git
claudeCode
powershellPolicy
```

推荐组件：

```text
gitBash
windowsTerminal
npmRegistry
apiProvider
```

---

## 6. Phase C：安全安装任务系统

### C1. 安装原则

```text
1. 所有安装动作必须用户点击确认。
2. 所有修改系统的动作必须显示命令预览。
3. Node.js/Git 第一版优先复制命令或打开外部安装，不默认静默安装 MSI。
4. Claude Code CLI 可以自动执行 npm install，但必须预检 Node/npm。
5. 失败后必须给出中文错误说明和下一步建议。
6. 安装完成后自动重新检测环境。
```

### C2. `task_manager.rs`

实现：

```rust
SetupTaskManager::new_task(action_id)
SetupTaskManager::emit(app, task_id, action_id, status, step, progress, message, error)
```

事件名：

```text
setup://task-progress
```

### C3. `installer.rs`

必须实现：

```rust
fix_powershell_policy(app, tasks) -> Result<String, String>
set_npm_mirror(app, tasks) -> Result<String, String>
install_claude_code_cli(app, tasks) -> Result<String, String>
```

`install_claude_code_cli` 流程：

```text
1. preflight: node --version, npm --version
2. npm config set registry https://registry.npmmirror.com
3. npm install -g @anthropic-ai/claude-code@latest
4. claude --version
5. 写入 .claude.json hasCompletedOnboarding=true
6. emit complete
```

若第 4 步失败：

```text
不要宣称安装成功。
提示：安装完成但 claude 命令不可用，请重启 Ctrl-CC 或修复 npm global PATH。
```

---

## 7. Phase D：Rust 命令注册

新建 `src-tauri/src/setup/commands.rs`：

```rust
use tauri::{AppHandle, State};
use crate::setup::types::SetupSnapshot;
use crate::setup::task_manager::SetupTaskManager;

#[tauri::command]
pub fn setup_detect_all() -> SetupSnapshot {
    crate::setup::detector::detect_all_setup()
}

#[tauri::command]
pub fn setup_fix_powershell_policy(app: AppHandle, tasks: State<SetupTaskManager>) -> Result<String, String> {
    crate::setup::installer::fix_powershell_policy(app, tasks)
}

#[tauri::command]
pub fn setup_set_npm_mirror(app: AppHandle, tasks: State<SetupTaskManager>) -> Result<String, String> {
    crate::setup::installer::set_npm_mirror(app, tasks)
}

#[tauri::command]
pub fn setup_install_claude_code_cli(app: AppHandle, tasks: State<SetupTaskManager>) -> Result<String, String> {
    crate::setup::installer::install_claude_code_cli(app, tasks)
}

#[tauri::command]
pub fn setup_write_provider_config(req: crate::setup::config_writer::ProviderConfigRequest) -> Result<(), String> {
    crate::setup::config_writer::write_provider_config(req)
}

#[tauri::command]
pub fn setup_read_provider_config_safe() -> crate::setup::config_writer::ProviderConfigSafe {
    crate::setup::config_writer::read_provider_config_safe()
}
```

`main.rs` 注册：

```rust
.manage(setup::task_manager::SetupTaskManager::new())
```

并注册命令：

```rust
setup::commands::setup_detect_all,
setup::commands::setup_fix_powershell_policy,
setup::commands::setup_set_npm_mirror,
setup::commands::setup_install_claude_code_cli,
setup::commands::setup_write_provider_config,
setup::commands::setup_read_provider_config_safe,
```

---

## 8. Phase E：Provider/API 配置复刻 1shot-CC

新建 `src-tauri/src/setup/config_writer.rs`。

必须支持：

```text
1. provider presets:
   - DeepSeek
   - 智谱 GLM
   - MiniMax
   - 小米 MiMo
   - 通义千问 Qwen
   - Custom
2. 写入 ~/.claude/settings.json env:
   - ANTHROPIC_AUTH_TOKEN
   - ANTHROPIC_BASE_URL
   - CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
   - ANTHROPIC_DEFAULT_HAIKU_MODEL
   - ANTHROPIC_DEFAULT_SONNET_MODEL
   - ANTHROPIC_DEFAULT_OPUS_MODEL
3. 写入 ~/.claude.json:
   - hasCompletedOnboarding=true
4. 写入前备份 settings.json
5. 脱敏读取当前配置
```

关键类型：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigRequest {
    pub provider: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub haiku_model: Option<String>,
    pub sonnet_model: Option<String>,
    pub opus_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigSafe {
    pub configured: bool,
    pub provider: String,
    pub base_url: String,
    pub api_key_masked: String,
}
```

---

## 9. Phase F：前端 SetupStore

新建：

```text
src/features/setup/stores/setupStore.ts
```

实现：

```ts
snapshot: SetupSnapshot | null;
checking: boolean;
error: string | null;
tasks: Record<string, SetupTaskProgress>;
onboardingCompleted: boolean;

detectAll(): Promise<SetupSnapshot>;
installClaudeCodeCli(): Promise<string>;
fixPowershellPolicy(): Promise<string>;
setNpmMirror(): Promise<string>;
markOnboardingCompleted(): void;
resetOnboarding(): void;
installListeners(): Promise<() => void>;
```

事件监听：

```ts
listen<SetupTaskProgress>('setup://task-progress', ...)
```

完成任务后自动：

```ts
detectAll()
```

---

## 10. Phase G：首次启动引导 UI

### G1. 新建 FirstRunSetupWizard

```text
src/features/setup/components/FirstRunSetupWizard.tsx
```

分步：

```text
Step 1 欢迎：说明这是 Claude Code CLI 配置向导，不是 Claude 桌面端应用
Step 2 检测：检测已有环境
Step 3 修复依赖：Node/npm/Git/Git Bash/PowerShell/npm registry/Claude Code CLI
Step 4 API 配置：官方登录 / API Provider 二选一
Step 5 验证：claude --version / claude doctor / print smoke
Step 6 完成：进入 Ctrl-CC / 打开 Workspace / 打开教程
```

### G2. UI 规则

```text
- 大卡片居中，最多 1060px
- 左侧 Stepper，右侧内容
- 每个检测项使用状态 chip
- 所有危险操作必须二次确认
- 安装按钮旁边必须有“复制命令”
- 失败时显示：发生了什么 / 为什么 / 下一步怎么做
- 不出现堆栈信息，堆栈只进入诊断日志
```

组件拆分：

```text
FirstRunSetupWizard.tsx
SetupCheckList.tsx
SetupRepairPanel.tsx
SetupProviderConfigStep.tsx
TaskProgressCard.tsx
SetupCommandPreview.tsx
SetupSafeConfirmDialog.tsx
```

---

## 11. Phase H：首次启动 Gate 与非首次启动提醒

### H1. App Gate

修改 `src/app/App.tsx`：

```ts
import { FirstRunSetupWizard } from '../features/setup/components/FirstRunSetupWizard';
import { useSetupStore } from '../features/setup/stores/setupStore';
import '../features/setup/styles/first-run-setup.css';
```

在 `App()` 中：

```ts
const onboardingCompleted = useSetupStore((s) => s.onboardingCompleted);
```

在 return 前：

```tsx
if (!onboardingCompleted) {
  return (
    <ErrorBoundary>
      <FirstRunSetupWizard />
    </ErrorBoundary>
  );
}
```

### H2. 非首次启动 Banner

在 `AppShell` 或 `ConsoleSurface` 增加：

```text
若 snapshot 存在且 ready=false：
显示轻量 Banner：
“Claude Code CLI 环境未完成，Chat/Terminal 可能不可用。立即配置 / 稍后”
```

按钮：

```text
立即配置 → Settings / Setup Center
重新检测 → setupStore.detectAll()
稍后 → localStorage ctrlcc.setup.dismissedUntil
```

---

## 12. Phase I：Settings 中新增 Setup Center

Settings 页面新增 tab：

```text
环境配置
API 配置
权限中心
诊断
外观
```

环境配置卡片：

```text
- 一键检测
- 依赖状态
- 缺失项修复
- 安装任务进度
- 复制命令
- 打开教程
```

API 配置卡片：

```text
- Provider 选择
- Base URL
- API Key 输入
- Haiku/Sonnet/Opus 模型
- 备份当前配置
- 写入配置
- 脱敏显示当前配置
```

权限中心：

```text
- AutoTrust level
- Allow tools
- Deny patterns
- 黑名单命令
- 规则导入导出
```

---

## 13. Phase J：Runtime 修复与 Setup 联动

### J1. Chat 发送前检查环境

修改 `RuntimeFabricBridge.sendChatMessage`：

```ts
const setup = useSetupStore.getState().snapshot;
if (!setup?.selectedChatCommandId) {
  throw new Error('Claude Code CLI 尚未配置完成，请先打开 Setup Center 完成环境配置。');
}
```

但不要每次自动检测。只读已有 snapshot；如果没有 snapshot，提示用户检测。

### J2. Terminal 启动前检查环境

修改 `startTerminalChannel`：

```ts
const setup = useSetupStore.getState().snapshot;
if (!setup?.selectedTerminalCommandId) {
  throw new Error('Exact CLI Terminal 尚未就绪，请先安装 Git Bash 或修复 Claude Code CLI。');
}
```

### J3. Runtime resolver 必须允许受控 cmd shim

当前 `claude_command_resolver.rs` 只有在：

```rust
CTRL_CC_ALLOW_CMD_SHIM=1
```

时才加入 `cmd-claude-cmd`。这对小白不友好。应改为允许受控 cmd shim：

```text
- 仅允许 APPDATA\npm\claude.cmd
- 路径必须存在
- 必须通过 claude --version smoke
- 只能作为 Claude command，不允许任意 shell
```

因此将：

```rust
if env::var("CTRL_CC_ALLOW_CMD_SHIM").ok().as_deref() == Some("1") {
    specs.push(...)
}
```

替换为直接加入，但 `kind = "cmdShim"`。

推荐能力：

```text
cmdShim selectable_for_chat = true
cmdShim selectable_for_terminal = true
```

### J4. 禁止执行 extensionless `claude`

保持当前正确方向：不要把 `C:\Users\...\npm\claude` 当 exe 执行。

### J5. 正确构建 cmdShim / gitBash / native

新增 `ResolvedInvocation`：

```rust
#[derive(Debug, Clone)]
pub struct ResolvedInvocation {
    pub program: String,
    pub args: Vec<String>,
}
```

新增：

```rust
pub fn build_invocation(spec: &ClaudeCommandSpec, claude_args: &[String]) -> ResolvedInvocation
```

cmdShim：

```text
program = C:\Windows\System32\cmd.exe
args = ["/d", "/s", "/c", "\"C:\Users\...\npm\claude.cmd\" <args...>"]
```

Git Bash：

```text
program = C:\Program Files\Git\bin\bash.exe
args = ["-lc", "claude <args...>"]
```

native：

```text
program = claude.exe
args = <args...>
```

---

## 14. Phase K：修复 ChatView 不显示 Fabric 输出

### K1. RuntimeFabricStore 增加 chatEvents

修改：

```text
src/features/runtime-fabric/stores/runtimeFabricStore.ts
```

新增：

```ts
import type { RuntimeEvent } from '../../../types';

chatEvents: Record<string, RuntimeEvent[]>;
appendChatEvent: (sessionId: string, event: RuntimeEvent) => void;
```

实现：

```ts
chatEvents: {},

appendChatEvent: (sessionId, event) => {
  set((state) => {
    const prev = state.chatEvents[sessionId] ?? [];
    return {
      chatEvents: {
        ...state.chatEvents,
        [sessionId]: [...prev, event].slice(-500),
      },
    };
  });
},
```

### K2. RuntimeFabricEventBridge 转换 stream-json

修改：

```text
src/features/runtime-fabric/services/runtimeFabricEventBridge.ts
```

在 `runtime://chat-stream` listener 中解析：

```ts
function extractText(parsed: any): string {
  if (!parsed) return '';
  if (typeof parsed.text === 'string') return parsed.text;
  if (typeof parsed.delta === 'string') return parsed.delta;
  if (typeof parsed.result === 'string') return parsed.result;

  const content = parsed.message?.content ?? parsed.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((x) => x?.text || x?.content || '').join('');
  }
  return '';
}
```

append：

```ts
const text = extractText(parsed);
if (text) {
  useRuntimeFabricStore.getState().appendChatEvent(p.sessionId, {
    id: `fabric-${p.sessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sessionId: p.sessionId,
    projectId: '',
    type: 'assistant_delta' as any,
    content: text,
    severity: 'low',
    createdAt: new Date().toISOString(),
  } as RuntimeEvent);
}
```

### K3. WorkspaceSurface 合并事件

```ts
const fabricChatEvents = useRuntimeFabricStore(
  useCallback((s) => activeTabId ? (s.chatEvents[activeTabId] ?? []) : [], [activeTabId])
);

const events = useMemo(() => {
  const merged = [...rawEvents, ...fabricChatEvents];
  ...
}, [rawEvents, fabricChatEvents]);
```

---

## 15. Phase L：UI 视觉系统统一

### L1. 字体层级

新增：

```text
src/styles/typography.css
```

```css
:root {
  --cc-type-display: clamp(28px, 3.2vw, 40px);
  --cc-type-title: clamp(22px, 2vw, 28px);
  --cc-type-section: 18px;
  --cc-type-card-title: 15px;
  --cc-type-body: 14px;
  --cc-type-caption: 12px;
  --cc-type-micro: 11px;
}

.cc-display { font-size: var(--cc-type-display); line-height: 1.08; font-weight: 760; letter-spacing: -0.03em; }
.cc-title { font-size: var(--cc-type-title); line-height: 1.15; font-weight: 720; letter-spacing: -0.025em; }
.cc-section-title { font-size: var(--cc-type-section); font-weight: 680; }
.cc-card-title { font-size: var(--cc-type-card-title); font-weight: 650; }
.cc-body { font-size: var(--cc-type-body); line-height: 1.55; }
.cc-caption { font-size: var(--cc-type-caption); color: var(--cc-text-muted); }
.cc-micro { font-size: var(--cc-type-micro); color: var(--cc-text-soft); }
.cc-mono { font-family: var(--cc-font-mono); font-size: var(--cc-type-caption); }
```

`main.tsx` 引入：

```ts
import './styles/typography.css';
```

### L2. Setup Wizard CSS

新建：

```text
src/features/setup/styles/first-run-setup.css
```

关键：

```css
.setup-v23-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: clamp(18px, 3vw, 42px);
  background:
    radial-gradient(circle at 18% 10%, var(--cc-brand-soft), transparent 34%),
    radial-gradient(circle at 82% 88%, var(--cc-accent-soft), transparent 30%),
    var(--cc-bg);
}

.setup-v23-card {
  width: min(1060px, 100%);
  min-height: min(720px, calc(100vh - 64px));
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  border: 1px solid var(--cc-border);
  border-radius: var(--cc-radius-2xl);
  background: var(--cc-surface);
  box-shadow: var(--cc-shadow-floating);
  overflow: hidden;
}

.setup-v23-stepper {
  padding: 28px 20px;
  border-right: 1px solid var(--cc-border);
  background: color-mix(in srgb, var(--cc-surface) 86%, var(--cc-brand-soft));
}

.setup-v23-main {
  padding: clamp(28px, 4vw, 52px);
  overflow: auto;
}

.setup-v23-main h1 {
  margin: 8px 0 12px;
  font-size: var(--cc-type-display);
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.setup-v23-check-row {
  display: grid;
  grid-template-columns: 160px 96px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  border: 1px solid var(--cc-border-soft);
  border-radius: var(--cc-radius-lg);
  padding: 12px 14px;
  background: var(--cc-surface-solid);
}

@media (max-width: 820px) {
  .setup-v23-card { grid-template-columns: 1fr; }
  .setup-v23-stepper {
    display: flex;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--cc-border);
  }
}

@media (max-width: 560px) {
  .setup-v23-check-row { grid-template-columns: 1fr; }
}
```

---

## 16. Phase M：Diagnostics 降噪

Diagnostics 默认只显示：

```text
Runtime Setup Summary
Selected Chat Command
Selected Terminal Command
Missing Required Items
Latest Task Errors
```

以下默认折叠：

```text
Legacy Launch Plan Matrix
Claude JS Candidates
Raw PTY Registry
Raw Trace Timeline
```

---

## 17. Phase N：非首次启动环境不完整处理

在 Console 加顶部 Banner：

```text
Claude Code CLI 环境未完成
[立即配置] [重新检测] [今天不再提醒]
```

规则：

```text
如果 setup.snapshot.ready=false 且 dismissedUntil < now：显示 Banner
```

Workspace Chat 输入框 placeholder：

```text
Claude Code CLI 尚未配置完成，请先完成环境配置
```

点击输入框时打开 Setup Center，而不是刷错误日志。

---

## 18. Phase O：本机直接排查命令

用户机器当前建议手动运行：

```powershell
where.exe node
where.exe npm
where.exe claude
where.exe claude.cmd
where.exe git
where.exe bash
npm root -g
npm config get registry
claude --version
claude doctor
```

若 Claude Code CLI 缺失：

```powershell
npm config set registry https://registry.npmmirror.com
npm install -g @anthropic-ai/claude-code@latest
```

若 PowerShell 策略阻止：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

若 Git Bash 缺失：

```powershell
winget install Git.Git
```

若 Node.js 缺失：

```powershell
winget install OpenJS.NodeJS.LTS
```

---

## 19. 验收标准

### 19.1 首次启动

```text
[ ] 首次启动显示美观、稳定、小白友好的 Setup Wizard。
[ ] 用户可明确知道这是 Claude Code CLI，不是桌面端应用。
[ ] 点击开始检测后可以看到本机已有 Node/npm/Git/Claude Code/PowerShell/npm registry/API config。
[ ] 不自动执行高风险安装。
[ ] 所有安装动作都有说明、命令预览、确认、进度、错误解释。
```

### 19.2 环境检测

```text
[ ] 能识别 npm 安装的 Claude Code CLI。
[ ] 能识别 APPDATA\npm\claude.cmd。
[ ] 不再执行 APPDATA\npm\claude extensionless 文件。
[ ] 能检测 PowerShell policy。
[ ] 能检测 npm registry。
[ ] 能检测 .claude/settings.json 与 .claude.json。
[ ] 能脱敏显示 API 配置。
```

### 19.3 Chat

```text
[ ] New Claude Session 不启动 PTY。
[ ] Chat 发送前检查 setup readiness。
[ ] Chat 使用 runtime_start_chat_stream。
[ ] runtime://chat-stream 能显示到 ChatView。
[ ] Chat 失败不永久禁用输入框。
```

### 19.4 Terminal

```text
[ ] 只有点击 Terminal tab 才启动 PTY。
[ ] Terminal 使用 resolver 的 cmdShim / gitBash / native invocation。
[ ] Terminal failed 不影响 Chat。
```

### 19.5 UI

```text
[ ] Console / Settings / Diagnostics / Setup 字体统一。
[ ] Console 不再卡片重叠。
[ ] Diagnostics 不再默认展开 40 条候选表。
[ ] Setup Wizard 小窗口和大屏幕都美观。
```

---

## 20. 必须运行

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

## 21. 给 Claude CLI / Codex 的严格执行 Prompt

```text
执行 Ctrl-CC 23.0 顶级商用级修复。严格按 plan.md 顺序执行，不允许自由发挥，不允许只改局部。

核心目标：
完整复刻 1shot-CC 的功能逻辑，但不复用它的 UI。Ctrl-CC 必须恢复首次启动环境配置向导，面向小白用户安全部署 Claude Code CLI（不是 Claude 桌面端应用），并在非首次启动环境不完整时温和提醒用户进入 Setup Center 修复。

必须完成：
1. 新增 setup domain：types / detector / installer / config_writer / task_manager / subprocess_runner / path_helper / commands。
2. Rust 复刻 1shot-CC 检测能力：Node.js、npm、Git、Git Bash、Claude Code CLI、Claude Auth、Claude Config、Windows Terminal、PowerShell 执行策略、npm registry、PATH、路径问题、API Provider。
3. 安装任务系统：setup://task-progress、安装 Claude Code CLI、修复 PowerShell policy、设置 npm 镜像、任务进度、失败、重试。
4. 迁移 API 配置：provider presets、settings.json 写入、.claude.json onboarding done、config backup、脱敏读取。
5. 新增 FirstRunSetupWizard：welcome/check/install/config/verify/done，小白友好、操作安全、视觉符合 Ctrl-CC 四主题。
6. App.tsx 加首次启动 gate。
7. 非首次启动环境不完整显示 Banner 和 Setup Center 入口。
8. Runtime 与 setup 联动：Chat 发送前检查 selectedChatCommandId，Terminal 启动前检查 selectedTerminalCommandId。
9. 修复 resolver：允许受控 cmd shim、禁止 extensionless claude、实现 ResolvedInvocation，native/cmdShim/gitBash 均正确构造命令。
10. 修复 ChatView：RuntimeFabricStore 增加 chatEvents，RuntimeFabricEventBridge 将 stream-json 转 RuntimeEvent，Workspace 合并 fabricChatEvents。
11. UI 统一：typography.css、setup wizard CSS、Console/Settings/Diagnostics 字体与布局统一。
12. Diagnostics 降噪：默认 summary，折叠 legacy/raw 表格。

验收：
- 首次启动出现美观 Setup Wizard。
- 能检测电脑已有 npm/npx Claude Code CLI。
- 能安全安装 Claude Code CLI。
- 能配置 provider API。
- Chat 不依赖 PTY。
- Chat 回复能显示。
- Terminal 按需启动。
- Console 不重叠，字体统一。
- Diagnostics 清晰，不再被长表淹没。

运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

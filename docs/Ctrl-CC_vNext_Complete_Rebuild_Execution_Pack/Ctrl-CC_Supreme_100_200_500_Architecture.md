
# Ctrl-CC Supreme Architecture：100% + 200% + 500% 不妥协终极构建方案

> **可直接发送给 Claude Code 执行。**  
> **项目定位**：Ctrl-CC 不是 Claude Code 的替代品，不复现 Claude Code 内部 agent loop，不破解、不逆向、不使用非公开/泄露源码。Ctrl-CC 是 Claude Code CLI 的 **Supreme GUI Control Plane**：以官方 CLI 为事实来源，以 PTY 承载原生交互，以 structured streams / statusLine / hooks / local observers 构建结构化控制、可视化、审计、安全和自动化管理能力。  
> **终极目标**：  
> - **100%+ 原生能力承载**：Claude Code CLI 在 Ctrl-CC 内部的 Terminal View 中运行时，体验必须尽可能等价于 Windows Terminal / PowerShell 中运行 Claude Code。  
> - **200% 可视化增强**：所有官方可暴露、可观察、可采集的输入输出、事件、状态、上下文、工具调用、权限、文件、Git、资源、风险全部转成可视化卡片、仪表盘、时间线、审计流和回放系统。  
> - **500% 管理效能提升**：在项目管理、会话管理、多进程管控、Worktree 隔离、自动托管、风险治理、审计追踪、资源管理、远程审批、工作坞、测试闭环方面远超 CLI 原始体验。

---

## 0. 最高原则：什么叫“不妥协”

本方案所谓 100%+200%+500%，不是说 Ctrl-CC 要复制 Claude Code 的内部私有实现。那既不现实，也不应该。

真正不妥协的定义是：

```text
100%+：
  使用官方 Claude Code CLI 作为唯一交互事实来源。
  通过 PTY 完整承载原生交互。
  任何 CLI 能做的事情，GUI 不应阻碍、不应丢失、不应改写。

200%：
  对所有官方可暴露信号进行结构化采集。
  对所有可观察行为进行可视化增强。
  对不可观察的私有内部状态明确标注 unavailable，不伪造。

500%：
  原 CLI 没有的管理能力由 Ctrl-CC 外层提供：
  项目、会话、风险、资源、审计、回放、自动托管、测试闭环、多窗口、多工作坞、远程审批、可视化编排。
```

禁止：

```text
1. 不复现 Claude Code 内部 agent loop。
2. 不破解 Claude Code。
3. 不使用泄露源码。
4. 不绕过官方权限、安全与认证。
5. 不假装支持当前 CLI 未暴露的能力。
6. 不做假数据、假按钮、假状态。
7. 不自动通过高风险操作。
```

---

## 1. 终极架构总览：四平面合流

原先“PTY-first”是正确方向，但不够完整。  
上传的技术方案指出了纯 PTY screen scraping 的局限，这是关键洞察。最终架构必须升级为：

```text
Ctrl-CC Supreme Runtime = Interaction Plane + Control Plane + Telemetry Plane + Governance Plane
```

### 1.1 Interaction Plane：原生交互平面

职责：100% 承载 Claude Code CLI 原生终端体验。

```text
xterm.js
↔ Tauri IPC
↔ Rust PtySessionManager
↔ portable-pty / Windows ConPTY
↔ claude interactive CLI
```

承载：

```text
slash commands
interactive prompts
permission prompt
方向键
Ctrl+C / Ctrl+D
resize
ANSI
终端 title
原始 stdout/stderr
原生命令行体验
```

### 1.2 Control Plane：结构化控制平面

职责：结构化任务、自动化任务、CI 风格任务、可解析输出。

```text
claude -p
--input-format stream-json
--output-format stream-json
--include-partial-messages
--include-hook-events
```

承载：

```text
structured task
batch task
JSON event stream
tool event parsing
message delta
usage parsing
CI style check
non-interactive task
```

### 1.3 Telemetry Plane：遥测观测平面

职责：Session Monitor、审计、风险、指标、上下文、成本、工具链状态。

```text
statusLine probe
hooks events
RuntimeEvent
AuditLog
RiskItem
FileChange
GitSnapshot
ProcessSnapshot
Xterm parser hooks
Local file watcher
```

承载：

```text
model
effort
thinking
context window
tokens
cost
duration
rate limits
cwd
workspace
git
tool use
permission request
file change
agent/subagent
MCP
hooks
risk
audit
```

### 1.4 Governance Plane：治理与安全平面

职责：把原 CLI 的单次确认，升级为全局可治理系统。

```text
Risk Engine
Permission Center
AutoTrust Policy
File Lock Manager
Project Concurrency Guard
Worktree Isolation
Process Watchdog
Credential Guard
Audit Exporter
Session Replay
```

承载：

```text
自动托管
安全分级
危险操作拦截
同项目并发风险
同文件冲突风险
进程泄漏保护
凭据保护
审计留痕
回放与追责
```

---

## 2. 100%+ 原生能力承载：Terminal View 必须是事实来源

### 2.1 Terminal View 的定位

Terminal View 不是“模拟终端”，不是“日志窗口”，不是“Chat 输出面板”。  
它必须是：

```text
在 Ctrl-CC 内部真实打开 Claude Code CLI
体验尽可能等价于 Windows Terminal / PowerShell 中运行 claude
```

### 2.2 技术实现

```text
Frontend:
  @xterm/xterm
  @xterm/addon-fit
  @xterm/addon-search
  @xterm/addon-web-links
  @xterm/addon-serialize

Backend:
  Rust
  portable-pty
  Windows ConPTY
  PtySessionManager
  ProcessTreeGuard
  RawLogWriter
```

### 2.3 必须支持

```text
输入：
  普通键盘输入
  中文输入法
  复制/粘贴
  Ctrl+C
  Ctrl+D
  方向键
  Tab / Shift+Tab
  slash command
  permission prompt 操作

输出：
  ANSI color
  光标移动
  清屏
  进度刷新
  spinner
  terminal title
  CJK 字符宽度
  emoji
  truecolor

窗口：
  resize
  split view resize
  fullscreen terminal
  scrollback
  search
  serialize replay
```

### 2.4 PTY resize 必须严格实现

前端：

```text
ResizeObserver
→ fitAddon.fit()
→ 获取 cols / rows
→ invoke("pty_resize", { sessionId, cols, rows, pixelWidth, pixelHeight })
```

后端：

```text
portable-pty resize
→ Windows ConPTY / Unix PTY resize
→ 子进程获得终端尺寸更新
```

### 2.5 进程清理必须是 P0

Windows-first 必须实现：

```text
Windows Job Object
Process tree kill
Graceful stop
Force kill timeout
Orphan process scanner
Watchdog snapshot
```

Unix/macOS 后续实现：

```text
process group
SIGTERM
SIGKILL
waitpid reap
```

禁止再次出现几十个 cmd / powershell / bash / git / claude 残留进程。

---

## 3. 200% 可视化增强：不要靠 PTY 正则硬猜语义

上传方案对纯 PTY screen scraping 的批评是正确的：  
不要把 ANSI 字符流当作唯一语义来源。

最终数据源优先级：

```text
Level A：官方结构化数据
  statusLine JSON
  stream-json
  hooks

Level B：本地可观察数据
  Git
  file watcher
  process watcher
  SQLite
  project/session db

Level C：PTY 辅助解析
  terminal title
  OSC / CSI hooks
  xterm parser hooks
  raw output hints

Level D：不可得信息
  显示 Not surfaced by current runtime
  不伪造
```

### 3.1 Chat View

Chat View 是小白友好的语义视图，不是事实来源。

```text
UserBubble
AssistantBubble
CommandCard
FileChangeCard
DiffCard
PermissionCard
RiskCard
ToolCard
AgentCard
McpCard
HookCard
SummaryCard
ErrorCard
RawEventCollapse
```

### 3.2 Session Monitor

Session Monitor 是右侧顶级监视器：

```text
StickyStatusDeck
CoreKpiGrid
LiveFlowCard
ContextMemoryCard
CodeWorkspaceCard
ToolAgentMcpCard
RiskDecisionCenter
AuditStream
DetailDrawer
```

必须显示：

```text
model
effort: low / medium / high / xhigh / max
thinking.enabled
context_window
token
cost
rate_limits
cwd
workspace
git branch
worktree
file diff
tool activity
agent/subagent
MCP
permissions
risks
audit
raw payload
```

### 3.3 Session Replay

必须支持两种回放：

```text
Terminal Replay:
  raw pty log
  xterm serialize snapshot
  terminal timeline

Semantic Replay:
  RuntimeEvent
  AuditLog
  RiskItem
  FileChange
  Chat cards
```

---

## 4. 500% 管理效能：让 CLI 成为可治理开发操作系统

### 4.1 Projects Surface

Projects 不只是项目列表，而是项目与会话控制中心。

```text
WorkspaceRoot
Project
Session
OpenSessionTab
PtySession
StructuredTask
RiskItem
AuditLog
GitSnapshot
FileChange
```

功能：

```text
工作文件夹管理
项目管理
会话管理
会话状态
resume
fork
archive
export bundle
project risk
session risk
git status
worktree isolation
concurrency guard
file lock
```

### 4.2 Workspace Surface

Workspace 只负责当前打开会话的实际工作：

```text
OpenSessionTabs
Chat View
Terminal View
Split View
Structured Task View
Session Monitor
ComposerBar
```

### 4.3 Resources Surface

统一管理：

```text
Skills
Agents
MCP
Hooks
Plugins
CLAUDE.md
Memory
Slash Commands
Permission Rules
Output Styles
StatusLine
```

要求：

```text
扫描真实配置
显示来源
显示作用域
风险扫描
保存前备份
写 AuditLog
secret redaction
```

### 4.4 AI 工作坞

固定贴附屏幕最右侧中间，不属于主窗口内部。

模式：

```text
Quiet：极窄状态条
Calm：待处理中心
Focus：多会话指挥板
```

显示：

```text
running sessions
pending permissions
critical risks
active tools
AutoTrust
cost
context
process health
```

操作：

```text
打开会话
跳转 Monitor
处理权限
暂停 AutoTrust
发送 Ctrl+C
停止会话
导出日志
```

---

## 5. Claude Code 官方能力对齐矩阵

所有能力必须通过 Capability Matrix 探测，不允许默认假设。

### 5.1 CLI 探测

```powershell
claude --version
claude --help
claude auth status
claude -p "Return pong" --output-format stream-json
claude -p --input-format stream-json --output-format stream-json
claude agents --help
claude mcp --help
claude plugin --help
claude remote-control --help
claude setup-token --help
```

### 5.2 CapabilitySnapshot

```ts
interface CapabilitySnapshot {
  claudeVersion: string;
  interactive: SupportState;
  printMode: SupportState;
  streamJsonOutput: SupportState;
  streamJsonInput: SupportState;
  statusLine: SupportState;
  hooks: SupportState;
  agents: SupportState;
  mcp: SupportState;
  plugins: SupportState;
  remoteControl: SupportState;
  setupToken: SupportState;
  worktree: SupportState;
  slashCommands: SupportState;
  lastCheckedAt: string;
}
```

### 5.3 SupportState

```ts
type SupportState =
  | "supported"
  | "unsupported"
  | "unknown"
  | "disabled"
  | "requires-user-config"
  | "requires-auth"
  | "requires-version-upgrade";
```

---

## 6. Control Plane 详细设计

### 6.1 StructuredPrintRuntime

```text
输入：
  user prompt
  structured JSON task
  selected resources
  project cwd
  settings

命令：
  claude -p
  --input-format stream-json
  --output-format stream-json
  --include-partial-messages
  --include-hook-events

输出：
  NDJSON
  RuntimeEvent
  Chat cards
  AuditLog
  RiskItem
```

### 6.2 不能替代 Interactive PTY

StructuredPrintRuntime 用于：

```text
批处理
自动化检查
CI
结构化问答
JSON 输出
非交互式任务
```

不用于：

```text
完整 slash command 体验
interactive picker
原生 permission prompt
原生 terminal 操作
```

---

## 7. Telemetry Plane 详细设计

### 7.1 statusLine Probe

必须 opt-in，不得静默覆盖用户配置。

功能：

```text
读取 Claude Code statusLine JSON stdin
写入 statusline.latest.json
追加 statusline.snapshots.jsonl
stdout 输出简短 statusline
```

字段必须支持：

```text
model
workspace
cost
context_window
effort
thinking
rate_limits
session_id
session_name
transcript_path
version
output_style
vim
agent
```

### 7.2 hooks 采集

支持：

```text
SessionStart
Setup
InstructionsLoaded
UserPromptSubmit
UserPromptExpansion
PreToolUse
PermissionRequest
PostToolUse
PostToolUseFailure
PostToolBatch
PermissionDenied
Notification
SubagentStart
SubagentStop
TaskCreated
TaskCompleted
Stop
StopFailure
TeammateIdle
ConfigChange
CwdChanged
FileChanged
WorktreeCreate
WorktreeRemove
PreCompact
PostCompact
```

### 7.3 Local Observers

```text
FileWatcher
GitWatcher
ProcessWatcher
CostAggregator
ContextSourceTracker
CredentialRedactor
```

---

## 8. Governance Plane 详细设计

### 8.1 AutoTrust 分级

```text
Level 0：关闭
Level 1：只读自动允许
Level 2：项目内安全编辑
Level 3：构建/测试命令
Level 4：用户 allowlist
Level 5：sandbox-only 高自动化
```

永不自动通过：

```text
rm -rf
del /s
rmdir
git reset --hard
git clean -fd
git push --force
claude project purge
setup-token export
plugin install/remove
remote-control enable
修改 .env / token / key
修改 .git / hooks
删除项目目录
bypassPermissions
system prompt replacement
strict MCP config with secret
```

### 8.2 File Lock Manager

```text
同项目多会话 → warning
同文件多会话修改 → high risk
dirty worktree + new session → warning
parallel task → suggest worktree
```

### 8.3 Worktree Isolation

提供：

```text
Create Worktree Session
Open Worktree
Merge Back
Compare Worktree
Archive Worktree
```

---

## 9. Remote Control 与 SDK 的定位

### 9.1 Remote Control

不是 MVP 核心，放入高级阶段：

```text
Remote Approval
Mobile Approval
Remote Session View
Daemon Management
Encrypted Outbound Tunnel
```

必须强安全：

```text
explicit opt-in
pairing code
session scope
audit
revocation
no inbound port
```

### 9.2 Claude Agent SDK

作为未来高级可控自动化通道，不替代 CLI 主路径。

```text
MVP:
  CLI interactive PTY
  structured-print
  statusLine
  hooks

Future:
  Agent SDK Runtime
  custom orchestration
  internal tool approval callback
```

---

## 10. xterm 增强与数据面工程

### 10.1 IPC batching

```text
PTY reader
→ buffer chunks
→ flush every 16ms or threshold
→ Tauri event
→ xterm.write
```

### 10.2 xterm parser hooks

仅作为辅助信号：

```text
terminal title
OSC progress
CSI hints
build/test progress
cwd hints
```

不要作为唯一语义来源。

### 10.3 Terminal Replay

```text
raw pty chunks
xterm serialized frame
timeline snapshot
searchable transcript
```

---

## 11. 数据库与存储

必须真实持久化：

```text
projects
sessions
pty_sessions
structured_tasks
runtime_events
audit_logs
risk_items
file_changes
git_snapshots
statusline_snapshots
hook_events
process_snapshots
resource_items
capability_snapshots
session_replay_frames
dock_notifications
settings
```

### 11.1 Raw artifacts

每个 session：

```text
pty_raw.bin
pty_utf8.log
pty_ansi.log
pty_events.jsonl
statusline.snapshots.jsonl
hook_events.jsonl
runtime_events.jsonl
audit.jsonl
risk.jsonl
session_bundle.zip
```

---

## 12. 不妥协测试体系

### 12.1 测试工具

```text
Unit tests
Integration tests
Tauri WebDriver
WebdriverIO
Appium / WinAppDriver
PowerShell Process Watchdog
Visual regression
Replay tests
PTY smoke tests
Capability audit tests
```

### 12.2 Watchdog 限制

```text
最多 1 个 Ctrl-CC app
最多 1 个 Claude PTY session per test
claude processes <= 2
cmd + powershell + bash <= 6
git <= 4
node test processes <= 8
single iteration <= 10 minutes
CPU > 85% for 60s → abort
free memory < 1.5GB → abort
```

### 12.3 P0 E2E

```text
启动 App
环境检测
新建项目
新建 PTY 会话
Terminal 显示 Claude CLI
Chat 输入进入 PTY
Session Monitor 更新
AuditLog 更新
RiskItem 更新
停止会话
无残留进程
导出 bundle
```

---

## 13. 分阶段执行路线

### Phase S0：Supreme Architecture Audit

只审计，不修改代码。

输出：

```text
docs/supreme-architecture-audit.md
docs/capability-matrix.md
docs/runtime-plane-gap-report.md
```

### Phase S1：RuntimeBridge 4.0 骨架

建立：

```text
Interaction Plane
Control Plane
Telemetry Plane
Governance Plane
```

### Phase S2：PTY Interaction 真连接

```text
portable-pty / ConPTY
xterm
resize
Ctrl+C
raw log
process cleanup
```

### Phase S3：Structured Control

```text
stream-json input/output
structured task
event normalizer
Chat semantic cards
```

### Phase S4：Telemetry

```text
statusLine probe
hooks collector
file/git/process watcher
Session Monitor
```

### Phase S5：Governance

```text
Risk Engine
AutoTrust
Permission Center
FileLock
Worktree isolation
Audit export
```

### Phase S6：Projects / Workspace / Resources / Dock 融合

```text
Projects
Workspace
Session Monitor
Resources
AI Dock
GitHub
Canvas
```

### Phase S7：Testing Fortress

```text
Watchdog
E2E
Replay
Visual regression
Release gate
```

---

## 14. Claude Code 直接执行总 Prompt

```text
请执行 Ctrl-CC Supreme Architecture：100%+200%+500% 不妥协终极方案。

核心定位：
Ctrl-CC 是 Claude Code CLI 的 Supreme GUI Control Plane。
不要复现 Claude Code 内部 agent loop。
不要破解、逆向、使用泄露源码或绕过官方权限。
必须以官方 Claude Code CLI 为事实来源。

最终架构必须是四平面：
1. Interaction Plane：PTY + xterm + portable-pty / ConPTY，承载完整原生 Claude Code CLI。
2. Control Plane：claude -p + stream-json input/output，用于结构化任务。
3. Telemetry Plane：statusLine + hooks + local observers，用于 Session Monitor、指标、审计、风险。
4. Governance Plane：Risk Engine + AutoTrust + Permission Center + FileLock + Worktree + Watchdog。

执行原则：
1. 所有能力先做 Capability Matrix 探测。
2. 不支持的能力显示 disabled reason，不伪造。
3. 所有数据来自真实 runtime / statusLine / hooks / file/git/process observers / SQLite。
4. Terminal View 是事实来源。
5. Chat View 是语义增强。
6. Session Monitor 是实时仪表盘、监视器、审计台和风险中心。
7. 高风险永不自动通过。
8. 所有操作写 AuditLog。
9. 测试必须由 Process Watchdog 保护，防止进程爆炸。

当前先执行 Phase S0：Supreme Architecture Audit。
不要修改业务代码。

S0 任务：
1. 审查当前项目架构。
2. 检查是否已有 PTY / xterm / portable-pty / ConPTY。
3. 检查是否已有 stream-json input/output。
4. 检查是否已有 statusLine probe。
5. 检查是否已有 hooks collector。
6. 检查是否已有 RuntimeEvent / AuditLog / RiskItem / FileChange / GitSnapshot。
7. 检查是否已有 Process Watchdog。
8. 检查是否已有 Session Monitor。
9. 运行 claude capability probes：
   claude --version
   claude --help
   claude auth status
   claude -p "Return pong" --output-format stream-json
   claude -p --input-format stream-json --output-format stream-json
   claude agents --help
   claude mcp --help
   claude plugin --help
   claude remote-control --help
   claude setup-token --help
10. 输出：
   docs/supreme-architecture-audit.md
   docs/capability-matrix.md
   docs/runtime-plane-gap-report.md
11. 运行：
   npm run typecheck
   npm run build
   cargo check --manifest-path src-tauri/Cargo.toml
12. 输出构建结果、差距、风险和下一阶段最小实现计划。
```

---

## 15. 最终验收标准

最终产品必须做到：

```text
[ ] Terminal View 中 Claude Code CLI 原生体验完整。
[ ] Chat View 提供小白友好语义视图。
[ ] Split View 同时显示真实终端与语义卡片。
[ ] Projects 能管理项目、会话、resume、fork、worktree、archive。
[ ] Session Monitor 能显示 model、effort、thinking、context、token、cost、rate limit、workspace、git、tool、agent、mcp、risk、audit。
[ ] Resources 能管理 Skills、Agents、MCP、Hooks、Plugins、CLAUDE.md、Memory、StatusLine。
[ ] AI Dock 能后台管理运行、待确认、风险和快速跳转。
[ ] Governance 能拦截高风险操作。
[ ] AuditLog 覆盖所有关键动作。
[ ] Replay 能回放终端和语义事件。
[ ] E2E 测试能真实操作 GUI。
[ ] Watchdog 能防止进程爆炸。
[ ] 所有 unsupported 能力都有 disabled reason。
[ ] 无假按钮、无假状态、无假数据。
```

---

## 16. 最终判断

最顶级的 Ctrl-CC 不是：

```text
一个漂亮终端壳
```

也不是：

```text
一个普通 AI Chat 客户端
```

而是：

```text
Claude Code CLI 的本地 AI 编程操作系统
```

它必须同时是：

```text
Terminal
Chat
IDE Control Plane
Project Manager
Session Manager
Telemetry Dashboard
Audit Console
Risk Center
Resource Manager
Automation Supervisor
Replay System
Remote Approval Hub
```

这才是 100% + 200% + 500% 的真正含义。

# Ctrl-CC vNext Session Monitor 终极重构执行方案（官方细节对齐版）

> 本文档可直接发送给 Claude Code 执行。  
> 目标：把 Chat 工作区右侧原来的多标签 Inspector，重构为 **Session Monitor：顶级仪表盘 + 实时监视器 + 全流程追踪审计中心**。  
> 核心原则：不再把右侧栏做成很多小页叠加，而是做成一个面向当前会话的实时状态中枢，既对齐 Claude Code CLI 官方可暴露的全部细节，又提供远超 CLI 的可视化、审计、风险与开发日志能力。

---

## 0. 阶段边界

本阶段只负责重构 **Workspace / Chat 工作区右侧监视器栏**。

不要重构整个项目，不要重写 Chat 主体，不要重写 Projects Surface，不要实现新的 Runtime。

如果 PTY Runtime、RuntimeEvent、AuditLog、RiskItem 尚未完全实现，则先建立清晰接口、空状态和数据适配层，禁止用假数据伪装。

---

## 1. 产品定位

新的右侧栏命名为：

```text
Session Monitor
```

副标题：

```text
Live Status · Metrics · Flow · Audit · Risk
```

它不是传统 Inspector，而是当前会话的：

```text
1. Claude Code statusline GUI 化镜像
2. 会话实时运行仪表盘
3. 当前开发流程监视器
4. 全流程操作审计台
5. 风险与决策中心
6. 上下文与成本监控中心
7. 文件、Git、工具调用、Agent、MCP、Hook 的综合观察面板
```

原 Inspector 的问题：

```text
1. 多个 tab 信息割裂。
2. 用户必须频繁切换页面，才能拼出当前会话全貌。
3. 核心运行状态没有固定可见。
4. 指标、日志、风险、文件、Git、工具调用、上下文没有统一视觉语言。
5. 更像“调试页”，不像“产品级实时监视器”。
```

---

## 2. 官方能力对齐原则

必须严格对齐 Claude Code CLI 官方可暴露能力。

不得臆造内部指标，不得伪造 Claude Code 私有状态。

### 2.1 statusLine 官方字段完整映射

Claude Code 的 `statusLine` 是本监视器最重要的官方数据来源之一。Claude Code 会把 JSON session data 通过 stdin 传给用户配置的 status line 命令，命令输出文本到 stdout，Claude Code 显示该文本。

必须支持以下字段：

```text
model.id
model.display_name

cwd
workspace.current_dir
workspace.project_dir
workspace.added_dirs
workspace.git_worktree

cost.total_cost_usd
cost.total_duration_ms
cost.total_api_duration_ms
cost.total_lines_added
cost.total_lines_removed

context_window.total_input_tokens
context_window.total_output_tokens
context_window.context_window_size
context_window.used_percentage
context_window.remaining_percentage
context_window.current_usage
exceeds_200k_tokens

effort.level
  low
  medium
  high
  xhigh
  max

thinking.enabled

rate_limits.five_hour.used_percentage
rate_limits.five_hour.resets_at
rate_limits.seven_day.used_percentage
rate_limits.seven_day.resets_at

session_id
session_name
transcript_path
version

output_style.name

vim.mode
  NORMAL
  INSERT
  VISUAL
  VISUAL LINE

agent.name
```

实现要求：

```text
1. 所有字段必须支持 null / absent。
2. 不支持的字段显示 “—” 或 “Not surfaced by current runtime”。
3. 不允许编造数值。
4. effort 必须按官方五档：low / medium / high / xhigh / max。
5. context_window_size 必须支持 200K 与 1M 等不同窗口。
6. cost.total_cost_usd 标注为 estimated client-side cost。
7. rate limit 字段如果缺失，不显示假百分比。
```

### 2.2 statusLine 更新机制对齐

必须支持：

```text
1. statusLine command event-driven 更新。
2. 支持 refreshInterval，最小 1 秒。
3. 处理 300ms debounce 后的数据到达。
4. 处理 command 正在运行时被新更新取消。
5. 处理 permission prompt、autocomplete、help menu 等状态下 statusline 暂时隐藏。
6. 处理 workspace trust 未接受导致 statusline skipped。
7. 处理 disableAllHooks 导致 statusline 关闭。
8. statusLine runs locally and does not consume API tokens。
```

### 2.3 官方 CLI 命令与 flags 映射

Session Monitor 不直接执行所有命令，但必须知道当前会话可能来自以下模式：

```text
claude
claude "query"
claude -p "query"
cat file | claude -p "query"
claude -c
claude -c -p "query"
claude -r "<session>" "query"
claude auth status
claude agents
claude auto-mode defaults
claude auto-mode config
claude mcp
claude plugin / plugins
claude project purge
claude remote-control
claude setup-token
claude ultrareview
```

必须识别或展示相关 flags：

```text
--add-dir
--agent
--agents
--session-id
--setting-sources
--settings
--strict-mcp-config
--system-prompt
--system-prompt-file
--append-system-prompt
--append-system-prompt-file
--teleport
--teammate-mode
--tmux
--tools
--verbose
--worktree / -w
--output-format
--include-partial-messages
--include-hook-events
```

以下能力或 flags 进入 Risk / Audit 特殊关注：

```text
claude project purge
setup-token
settings override
system prompt replacement
strict MCP config
plugin install/remove
remote-control
worktree
tools restriction / broadening
```

### 2.4 官方 hooks 事件映射

Session Monitor 必须能展示或预留以下 hook/event 类型：

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

事件字段必须尽量保留原始 payload：

```text
session_id
transcript_path
cwd
permission_mode
hook_event_name
source
model
agent_type
prompt
tool_name
tool_input
tool_use_id
tool_response
duration_ms
file_path
event
agent_id
agent_transcript_path
last_assistant_message
error
error_details
```

决策类事件必须显示：

```text
allow
deny
ask
defer
block
additionalContext
updatedInput
permissionDecisionReason
```

---

## 3. 信息架构：从 Tab Inspector 改为单页 Session Monitor

### 3.1 总体结构

右侧 Session Monitor 是一个单栏结构：

```text
SessionMonitor
├── StickyStatusDeck
├── AnchorNav
├── ScrollDashboardBody
│   ├── CoreKpiGrid
│   ├── LiveFlowCard
│   ├── ContextMemoryCard
│   ├── CodeWorkspaceCard
│   ├── ToolAgentMcpCard
│   ├── RiskDecisionCenter
│   └── AuditStream
└── DetailDrawerHost
```

不要再做大量平级 tabs。

只保留锚点导航：

```text
总览
流程
上下文
代码
工具
风险
审计
```

点击锚点时不是切换页面，而是平滑滚动到对应区块。

### 3.2 宽度状态

必须支持四种宽度：

```text
Collapsed：56px，只显示状态竖条
Compact：320px，常规右栏
Expanded：520px，专业监视器
Fullscreen：覆盖主区域的完整会话监视面板
```

每种宽度必须有明确布局：

#### Collapsed

```text
状态灯
Context 百分比小环
Risk 点
Cost 小标
Audit 新事件点
展开按钮
```

#### Compact

```text
StickyStatusDeck
核心 KPI 2 列
简化 LiveFlow
简化 Audit Stream
```

#### Expanded

```text
完整 Statusline Mirror
完整 KPI Grid
详细 LiveFlow
完整 Audit Stream
可展开详情
```

#### Fullscreen

```text
多列 Dashboard
完整日志搜索
完整审计筛选
完整图表
导出报告
```

---

## 4. StickyStatusDeck 设计

顶部固定区，高度 150–190px。

永远可见，不随滚动消失。

### 4.1 第一行：会话身份条

字段：

```text
session status dot
session_name
session_id short
project name
model.display_name
effort.level
thinking.enabled
output_style.name
agent.name
runtime mode
permission mode
```

状态颜色：

```text
绿色 steady：ready / idle
蓝色 pulse：thinking / streaming
紫色 pulse：tool / agent / mcp active
黄色 pulse：waiting permission
红色：error / blocked
灰色：stopped / sleeping
```

### 4.2 第二行：Statusline Mirror

以 GUI 形式镜像 Claude Code statusline。

标准模式两行：

```text
🤖 {model.display_name} · 🧠 {used}/{size} ({used_percentage}%) · ⚙ {effort.level} · 💭 {thinking.enabled}
📥 In {total_input_tokens} · 📤 Out {total_output_tokens} · 💰 ${total_cost_usd} · ⏱ {duration} · 📝 +{lines_added}/-{lines_removed}
```

专业模式三行：

```text
🤖 {model.display_name} [{effort.level}] · 🎭 {output_style.name} · 🧑‍💻 {agent.name}
🧠 {total_input_tokens + total_output_tokens}/{context_window_size} · {used_percentage}% · remaining {remaining_percentage}%
📥 In {total_input_tokens} · 📤 Out {total_output_tokens} · API {total_api_duration_ms} · Cost ${total_cost_usd}
📂 {workspace.current_dir} · 🌿 {git_branch} · 🧩 {workspace.git_worktree} · 💻 {hostname}
```

字段缺失：

```text
field missing → —
field unavailable → not surfaced
field pending → loading
```

### 4.3 交互

```text
点击 model → 打开 model / effort 设置说明
点击 context → 滚动到 ContextMemoryCard
点击 cost → 打开 Cost Detail Drawer
点击 cwd → 打开文件夹
点击 branch → 打开 Git detail
点击 risk dot → 滚动到 RiskDecisionCenter
```

---

## 5. CoreKpiGrid 设计

核心指标区采用 2 列卡片。每张卡片必须明确数据来源、展示字段、空状态。

### 5.1 ContextKpiCard

字段：

```text
context_window.total_input_tokens
context_window.total_output_tokens
context_window.context_window_size
context_window.used_percentage
context_window.remaining_percentage
context_window.current_usage
exceeds_200k_tokens
```

视觉：

```text
半环进度
used_percentage 大数字
remaining 小标签
>70% amber
>85% red
exceeds_200k_tokens 显示固定阈值警告
```

交互：

```text
点击 → Context Detail Drawer
按钮 → Insert /compact suggestion
按钮 → Show context sources
```

### 5.2 TokenKpiCard

字段：

```text
total_input_tokens
total_output_tokens
current_usage.input_tokens
current_usage.output_tokens
current_usage.cache_read_input_tokens
current_usage.cache_creation_input_tokens
```

如 current_usage schema 未暴露全部子字段：

```text
显示 current_usage raw expandable
```

视觉：

```text
Input / Output 双柱
Current turn 小数字
Cache read/write 小胶囊
```

### 5.3 CostKpiCard

字段：

```text
cost.total_cost_usd
session budget from settings
project/day budget from app db
last turn delta from RuntimeEvent
```

标注：

```text
Estimated client-side cost
May differ from final bill
```

视觉：

```text
大号 $ 数字
预算进度条
近 5 轮成本 sparkline
```

### 5.4 RuntimeKpiCard

字段：

```text
cost.total_duration_ms
cost.total_api_duration_ms
local active duration
idle duration
started_at
last_activity_at
```

视觉：

```text
Total / API / Idle 三段条
API duration 占比
```

### 5.5 CodeChangeKpiCard

字段：

```text
cost.total_lines_added
cost.total_lines_removed
FileChange count
git diff stats
files_created
files_modified
files_deleted
```

视觉：

```text
+ / - 大数字
文件变更条
Top 3 changed files
```

### 5.6 GitWorkspaceKpiCard

字段：

```text
workspace.current_dir
workspace.project_dir
workspace.added_dirs
workspace.git_worktree
git branch
git dirty
untracked count
staged count
conflict count
```

视觉：

```text
branch pill
dirty / clean status
added dirs count
worktree badge
```

### 5.7 ToolActivityKpiCard

字段：

```text
PreToolUse count
PostToolUse count
PostToolUseFailure count
current running tool
tool duration_ms
tool_name distribution
```

视觉：

```text
工具调用数
成功/失败小环
当前工具动态状态
```

### 5.8 RiskKpiCard

字段：

```text
RiskItem unresolved count
critical/high/medium/low count
permission pending count
autoTrust decisions count
concurrency risk
file lock risk
```

视觉：

```text
总体风险等级
风险分布条
待处理按钮
```

### 5.9 RateLimitKpiCard

字段：

```text
rate_limits.five_hour.used_percentage
rate_limits.five_hour.resets_at
rate_limits.seven_day.used_percentage
rate_limits.seven_day.resets_at
```

展示规则：

```text
字段存在才显示
缺失则隐藏或显示 “not surfaced”
```

视觉：

```text
5h / 7d 两条进度条
reset countdown
```

### 5.10 VimModeAndInteractionCard

字段：

```text
vim.mode
permission_mode
output_style.name
statusline visible / skipped
terminal focus
```

显示：

```text
NORMAL / INSERT / VISUAL / VISUAL LINE
当前输入模式
当前交互状态
```

---

## 6. LiveFlowCard 设计

LiveFlowCard 是“Claude 当前正在做什么”的核心可视化。

### 6.1 阶段模型

```text
1. SessionStart
2. InstructionsLoaded
3. UserPromptSubmit
4. UserPromptExpansion
5. Thinking / Assistant streaming
6. PreToolUse
7. PermissionRequest
8. Tool Running
9. PostToolUse / PostToolUseFailure
10. FileChanged
11. SubagentStart / SubagentStop
12. TaskCreated / TaskCompleted
13. PreCompact / PostCompact
14. Stop / StopFailure
```

### 6.2 每个节点字段

```text
timestamp
event type
status
title
short detail
duration
risk level
source
raw payload expandable
```

### 6.3 状态

```text
not_started
running
waiting
completed
failed
blocked
skipped
```

### 6.4 交互

```text
点击节点 → 详情抽屉
双击节点 → 定位 Chat 卡片 / Terminal 位置
右键 → copy payload / export event / reveal transcript
```

---

## 7. ContextMemoryCard 设计

### 7.1 展示内容

```text
context usage
context window size
current usage
remaining percentage
CLAUDE.md loaded status
instructions loaded events
workspace.added_dirs
SessionStart additional context
UserPromptExpansion additional context
MCP returned context
file read context
compact history
```

### 7.2 Sources 列表

每个上下文来源一张小条目：

```text
Source type
Path / name
Loaded at
Token estimate if available
Risk / trust status
Click to inspect
```

类型：

```text
User prompt
Transcript history
CLAUDE.md
.claude/rules
SessionStart hook
UserPromptExpansion hook
MCP response
Read tool
Added directory
Agent transcript
Compact summary
```

### 7.3 操作

```text
Open CLAUDE.md
Open transcript
Suggest /compact
Show context diff
Export context map
```

---

## 8. CodeWorkspaceCard 设计

### 8.1 展示内容

```text
cwd
workspace.project_dir
added_dirs
git branch
git status
git worktree
file changes
diff stats
recent files
hot files
conflicts
```

### 8.2 文件列表

按分组显示：

```text
Created
Modified
Deleted
Read-only touched
Hot files
Conflicts
```

每行：

```text
icon
file name
path tail
operation
+/- lines
last event time
risk tag
open button
diff button
```

---

## 9. ToolAgentMcpCard 设计

### 9.1 工具统计

```text
Bash
Edit
Write
Read
Glob
Grep
Agent
WebFetch
WebSearch
AskUserQuestion
ExitPlanMode
MCP tools
```

每类显示：

```text
count
success
failure
avg duration
last used
risk level
```

### 9.2 当前活跃工具

如果有正在运行工具，显示：

```text
tool_name
started_at
elapsed
cwd
summary
cancel / interrupt if safe
```

### 9.3 Agent / Subagent

字段：

```text
agent.name
agent_id
agent_type
agent_transcript_path
last_assistant_message
status
duration
```

可视化：

```text
Agent chips
Subagent timeline
Transcript link
```

---

## 10. RiskDecisionCenter 设计

这是主动风险中心，不只是风险列表。

### 10.1 风险类型

```text
High context usage
High cost / budget exceeded
Rate limit high usage
Pending permission
AutoTrust decision
Dangerous command
Project purge
Setup token exposed risk
Plugin install/remove
MCP strict config
Remote-control session
System prompt replacement
Multiple sessions same project
Same file modified by multiple sessions
Dirty git worktree
Tool repeated failures
PTY process leak
Statusline unavailable
Hooks disabled
Workspace trust not accepted
```

### 10.2 风险卡字段

```text
level
category
title
detail
source event
affected object
recommended action
created_at
status
```

### 10.3 操作

```text
Open details
Mark resolved
Open related event
Open related file
Open permission center
Pause AutoTrust
Stop session
Export risk report
```

---

## 11. AuditStream 设计

AuditStream 是当前会话的事件审计日志，不是完整 raw log。

### 11.1 事件类型

```text
Session started
Session resumed
User prompt submitted
Slash command inserted
StatusLine updated
Permission requested
Permission allowed
Permission denied
AutoTrust allowed
Tool started
Tool completed
Tool failed
File read
File created
File edited
File deleted
Git status changed
MCP called
Agent started
Agent stopped
Hook triggered
Notification received
Compact started
Compact completed
Stop requested
Stop failed
Session exported
```

### 11.2 卡片字段

```text
timestamp
type icon
title
summary
actor
risk level
source
expandable raw payload
jump target
```

### 11.3 过滤

```text
All
User
Claude
Tool
File
Git
Permission
Risk
Hook
Agent
MCP
Error
AutoTrust
```

### 11.4 操作

```text
Search
Filter
Export JSONL
Export Markdown report
Copy event
Jump to Chat
Jump to Terminal timestamp
Jump to file
```

---

## 12. Detail Drawer 设计

任何卡片点击后，不切换主页面，而是打开右内抽屉。

### 12.1 Drawer 类型

```text
CostDetailDrawer
ContextDetailDrawer
TokenDetailDrawer
ToolDetailDrawer
FileChangeDetailDrawer
GitDetailDrawer
RiskDetailDrawer
AuditEventDrawer
RawPayloadDrawer
TranscriptDrawer
```

### 12.2 Drawer 统一结构

```text
DrawerHeader
  title
  subtitle
  source
  copy / export / close

DrawerBody
  summary
  structured fields
  raw payload
  related events
  actions
```

---

## 13. 数据接口与 Store 设计

### 13.1 核心 Store

```ts
interface SessionMonitorStore {
  activeSessionId: string | null;
  statusSnapshot: StatusLineSnapshot | null;
  runtimeState: RuntimeState | null;
  kpis: SessionKpis;
  liveFlow: MonitorFlowEvent[];
  auditEvents: MonitorAuditEvent[];
  risks: MonitorRiskItem[];
  contextSources: ContextSource[];
  fileChanges: MonitorFileChange[];
  toolStats: ToolStats[];
  gitSnapshot: GitSnapshot | null;
  ui: SessionMonitorUiState;
}
```

### 13.2 StatusLineSnapshot

```ts
interface StatusLineSnapshot {
  model?: { id?: string; display_name?: string };
  cwd?: string;
  workspace?: {
    current_dir?: string;
    project_dir?: string;
    added_dirs?: string[];
    git_worktree?: string;
  };
  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
    total_api_duration_ms?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
  };
  context_window?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    context_window_size?: number;
    used_percentage?: number;
    remaining_percentage?: number;
    current_usage?: unknown;
  };
  exceeds_200k_tokens?: boolean;
  effort?: { level?: "low" | "medium" | "high" | "xhigh" | "max" };
  thinking?: { enabled?: boolean };
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number };
    seven_day?: { used_percentage?: number; resets_at?: number };
  };
  session_id?: string;
  session_name?: string;
  transcript_path?: string;
  version?: string;
  output_style?: { name?: string };
  vim?: { mode?: "NORMAL" | "INSERT" | "VISUAL" | "VISUAL LINE" };
  agent?: { name?: string };
  received_at: string;
  source: "claude-statusline" | "runtime-event" | "manual-import";
}
```

### 13.3 MonitorFlowEvent

```ts
interface MonitorFlowEvent {
  id: string;
  sessionId: string;
  type: string;
  title: string;
  detail?: string;
  status: "running" | "waiting" | "completed" | "failed" | "blocked" | "skipped";
  severity: "info" | "success" | "warning" | "error" | "critical";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  source: "hook" | "pty" | "structured-print" | "gui" | "filesystem" | "git";
  rawPayload?: unknown;
  relatedRuntimeEventId?: string;
  relatedAuditLogId?: string;
}
```

---

## 14. statusLine Probe 设计

为了可靠采集官方 statusLine JSON，建议实现一个可选的 Ctrl-CC statusline probe。

### 14.1 原则

```text
1. 不静默覆盖用户已有 statusLine。
2. 第一次启用时必须征得用户确认。
3. 如果用户已有 statusLine，提供 chain / wrap 方案。
4. Probe 写入 Ctrl-CC session monitor snapshot 文件或本地 IPC。
5. Probe 同时输出简短 status line 文本给 Claude Code 原生终端。
6. Probe 必须很快，避免拖慢 Claude Code statusLine 更新。
```

### 14.2 Windows PowerShell Probe

路径示例：

```text
%USERPROFILE%\.ctrl-cc\statusline-probe.ps1
```

行为：

```text
stdin JSON
→ parse
→ write snapshot to %LOCALAPPDATA%\Ctrl-CC\sessions\<session_id>\statusline.latest.json
→ append compact event to statusline.snapshots.jsonl
→ stdout print concise statusline
```

### 14.3 settings 配置

只在用户确认后写入：

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -NoProfile -File C:/Users/<user>/.ctrl-cc/statusline-probe.ps1",
    "refreshInterval": 5,
    "padding": 1
  }
}
```

如果已有 statusLine：

```text
显示：
检测到已有 Claude Code statusLine。
请选择：
1. 不接管，仅通过 PTY/Hook 采集有限信息
2. 链接现有 statusLine，Ctrl-CC 作为 wrapper
3. 替换为 Ctrl-CC statusLine probe
```

必须写 AuditLog。

---

## 15. 视觉设计规范

### 15.1 风格

```text
Neo Calm Industrial
高信息密度
低视觉噪音
圆角卡片
柔和分割
细线图标
等宽数字
小型图表
不炫技
不荧光
不游戏化
```

### 15.2 颜色

```text
bg: #f7f4ee
surface: rgba(255,255,255,0.88)
surface-muted: #fbf8f2
border: #e8ded1
text: #243044
text-muted: #7b6f62
brand: #d8c29b
green: #63c59b
amber: #f0a54a
red: #e66b6b
blue: #82afff
purple: #9a8cff
```

### 15.3 字体

```text
中文：MiSans / HarmonyOS Sans / Source Han Sans
英文：Inter
数字：JetBrains Mono / Cascadia Code
指标数字：tabular-nums
代码与 raw payload：JetBrains Mono
```

### 15.4 卡片

```text
radius: 16px
padding: 12-16px
gap: 10-12px
border: 1px solid var(--cc-border)
shadow: subtle only
```

---

## 16. 动效规范

### 16.1 状态灯

```text
Idle：静止常亮
Thinking：柔和呼吸 1600ms
Tool Running：轻微流动扫光 1400ms
Waiting Permission：琥珀色 pulse 1200ms
Error：短促双闪后静止
```

### 16.2 数值更新

```text
数字 crossfade 200ms
进度条 smooth fill 260ms
cost 增长时轻微 highlight 600ms
context 超阈值只高亮一次，不持续闪
```

### 16.3 卡片进入

```text
opacity 0 → 1
translateY 6px → 0
duration 160ms
```

### 16.4 LiveFlow

```text
当前节点流动光点
完成节点淡入 check
失败节点轻微 shake 一次
```

### 16.5 Drawer

```text
slide from right
duration 220-280ms
easing cubic-bezier(0.22, 1, 0.36, 1)
```

---

## 17. 实现阶段划分

### Phase SM-0：官方能力审计

任务：

```text
1. 检查当前项目是否有 statusLine probe。
2. 检查是否采集 statusLine JSON。
3. 检查是否有 RuntimeEvent / AuditLog / RiskItem。
4. 检查 PTY raw log 是否存在。
5. 检查 hook events 是否被采集。
6. 输出 docs/session-monitor-official-alignment-audit.md。
```

不要改 UI。

### Phase SM-1：重构 Session Monitor 骨架

任务：

```text
1. 新建 SessionMonitor 组件目录。
2. 替换原右侧 Inspector 主入口。
3. 实现 StickyStatusDeck。
4. 实现 AnchorNav。
5. 实现 ScrollDashboardBody。
6. 实现 Empty / Loading / Unavailable 状态。
```

### Phase SM-2：实现 KPI 卡片

任务：

```text
ContextKpiCard
TokenKpiCard
CostKpiCard
RuntimeKpiCard
CodeChangeKpiCard
GitWorkspaceKpiCard
ToolActivityKpiCard
RiskKpiCard
RateLimitKpiCard
VimModeAndInteractionCard
```

### Phase SM-3：实现 LiveFlow 与 AuditStream

任务：

```text
LiveFlowCard
AuditStream
Event filters
Event search
Jump to Chat / Terminal / File
Raw payload drawer
```

### Phase SM-4：实现 Context / Code / Tool / Risk 详情

任务：

```text
ContextMemoryCard
CodeWorkspaceCard
ToolAgentMcpCard
RiskDecisionCenter
DetailDrawerHost
```

### Phase SM-5：statusLine Probe 集成

任务：

```text
PowerShell probe
JSONL snapshot
User opt-in
Existing statusLine detection
Wrapper / chain option
AuditLog
```

### Phase SM-6：测试与验收

任务：

```text
Unit tests for data adapters
Snapshot tests for cards
E2E test for PTY session monitor
Mock statusLine JSON test
Hook event replay test
Visual regression
```

---

## 18. 验收标准

### 18.1 功能验收

```text
[ ] 原右侧多 tab Inspector 被 Session Monitor 替代
[ ] 顶部 StickyStatusDeck 固定可见
[ ] statusLine 官方字段完整映射
[ ] effort 五档 low/medium/high/xhigh/max 正确显示
[ ] context/cost/token/runtime/file/git/tool/risk/rate-limit 均有卡片
[ ] LiveFlow 能显示会话流程
[ ] AuditStream 能显示全流程事件
[ ] RiskDecisionCenter 能主动提示风险
[ ] Detail Drawer 可查看细节
[ ] 字段缺失时不伪造
[ ] 支持 Compact / Expanded / Fullscreen
[ ] 与 Chat / Terminal / Workspace 联动
```

### 18.2 数据验收

```text
[ ] 数据来自真实 StatusLineSnapshot / RuntimeEvent / AuditLog / RiskItem / FileChange / GitSnapshot
[ ] 无假数据
[ ] 所有 unknown 字段有明确 unavailable 状态
[ ] raw payload 可查看
[ ] JSONL 可导出
[ ] statusLine probe 不静默覆盖用户配置
```

### 18.3 视觉验收

```text
[ ] 信息密度高但不乱
[ ] 卡片统一
[ ] 状态色统一
[ ] 数字易读
[ ] 动效克制
[ ] 窄栏不拥挤
[ ] 展开模式足够专业
```

---

## 19. 直接发送给 Claude Code 的执行 Prompt

```text
请执行 Ctrl-CC vNext：Session Monitor 右侧监视器终极重构。

目标：
把 Workspace Chat 工作区右侧原来的多 tab Inspector，重构为一个顶级 Session Monitor：
Live Status · Metrics · Flow · Audit · Risk。

请严格对齐 Claude Code CLI 官方可暴露细节：
1. statusLine 官方 JSON 字段必须完整建模。
2. effort.level 必须支持 low / medium / high / xhigh / max 五档。
3. context_window / cost / workspace / rate_limits / output_style / vim / agent / session 字段必须完整支持。
4. hooks 事件必须预留并映射：
   SessionStart、UserPromptSubmit、PreToolUse、PermissionRequest、PostToolUse、PostToolUseFailure、Notification、FileChanged、SubagentStart/Stop、TaskCreated/Completed、Stop/StopFailure、CwdChanged、PreCompact/PostCompact 等。
5. CLI 命令和 flags 相关风险必须能进入 Audit / Risk：
   --add-dir、--agent、--agents、--session-id、--settings、--setting-sources、--strict-mcp-config、--system-prompt、--append-system-prompt、--tools、--verbose、--worktree、project purge、remote-control、setup-token、plugin、mcp 等。

实现要求：
1. 不要再做很多小 tab。
2. 使用单页滚动式 Session Monitor。
3. 顶部 StickyStatusDeck 固定展示核心 statusline 信息。
4. 中部使用卡片化 KPI 仪表盘。
5. 下部使用 LiveFlow + AuditStream + RiskDecisionCenter。
6. 深度信息通过 Detail Drawer 展示。
7. 数据必须来自真实 StatusLineSnapshot / RuntimeEvent / AuditLog / RiskItem / FileChange / GitSnapshot。
8. 不允许伪造任何数值。
9. 字段缺失时显示 “—” 或 “Not surfaced by current runtime”。
10. 保持 Ctrl-CC Neo Calm Industrial 视觉语言。

请按阶段执行：
SM-0：官方能力审计，只写报告，不改 UI。
SM-1：Session Monitor 骨架。
SM-2：KPI 卡片。
SM-3：LiveFlow 与 AuditStream。
SM-4：Context / Code / Tool / Risk 详情。
SM-5：statusLine Probe 集成。
SM-6：测试与验收。

当前先执行 SM-0：
1. 审查现有代码中是否有 statusLine 采集、RuntimeEvent、AuditLog、RiskItem、FileChange、GitSnapshot、PTY raw log、hook events。
2. 输出 docs/session-monitor-official-alignment-audit.md。
3. 不要修改业务代码。
4. 运行 npm run typecheck、npm run build、cargo check --manifest-path src-tauri/Cargo.toml。
5. 输出构建结果和下一步最小修改计划。
```

---

## 20. 当前必须避免的问题

```text
1. 不要把 Session Monitor 做成十几个 tab。
2. 不要做假数字。
3. 不要伪造 Claude Code 内部 thinking 状态。
4. 不要只做 UI，不接数据。
5. 不要强行覆盖用户已有 statusLine。
6. 不要让 statusLine probe 变慢。
7. 不要在窄栏里塞大图表。
8. 不要让风险提示频繁弹窗干扰用户。
9. 不要把 raw log 和 audit stream 混成一团。
10. 不要让右侧栏抢走 Chat 主区域的注意力。
```

---

## 21. 最终产品标准

Session Monitor 完成后，用户应该能在右侧一眼看到：

```text
Claude 当前是什么模型？
effort 是哪一档？
thinking 是否开启？
上下文用了多少？
本轮和累计 token 多少？
本会话花了多少钱？
运行了多久？
API 等待时间多少？
改了多少代码？
当前目录和分支是什么？
有没有 worktree？
是否接近 rate limit？
当前 Claude 正在执行什么阶段？
最近执行了什么工具？
哪些文件被改了？
有哪些权限确认？
有哪些自动接受？
有哪些风险？
有什么审计记录？
能不能跳转到具体 Chat / Terminal / 文件 / raw payload？
```

这才是 Ctrl-CC 作为新时代 Claude Code GUI Control Plane 应具备的顶级右侧监视器。

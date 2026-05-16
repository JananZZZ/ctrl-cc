# Ctrl-CC v25 顶级商业级架构升级与核心功能打通方案

适用仓库：

```text
https://github.com/JananZZZ/ctrl-cc
branch: master
```

目标：

```text
1. 彻底打通 Chat / Terminal / Project / Setup / Settings / Resources / Diagnostics。
2. 把 Chat 功能从“临时 stream glue”升级为稳定 Runtime Provider 架构。
3. 学习 Claudian 的 provider-native ChatRuntime 边界。
4. 学习 Abu-Cowork 的 core engine、权限、资源、诊断、设置、工程规范。
5. 保留 Ctrl-CC 特色：Claude Code CLI 控制平面、工作区、项目、资源、AI Dock、四主题视觉。
6. 默认小白友好：新建会话默认 Chat 气泡界面；Terminal 是专家模式。
7. 实现真正可维护、可扩展、可测试、可诊断的商用级软件架构。
```

---

## 0. v25 总结：必须从“Runtime Glue”升级为“Provider Runtime Kernel”

当前 v24 已经修了一部分问题，但底层仍然是：

```text
WorkspaceSurface → RuntimeFabricBridge → Tauri Command → Rust process/PTY → Tauri event → Zustand store → UI
```

问题是：这些模块仍然没有形成稳定的边界。Chat、Terminal、Setup、Diagnostics、Project 都在直接或间接读写同一批状态，导致功能不断互相污染。

v25 的核心改变：

```text
旧架构：
UI 驱动 Runtime

新架构：
Runtime Kernel 驱动 UI
```

也就是说：

```text
UI 只发 Intent。
Runtime Kernel 负责执行、状态机、错误归类、事件归一化、会话生命周期。
UI 只订阅投影后的 ViewModel。
```

---

## 1. 能否复用 Claudian / Abu-Cowork / 其他 TUI-GUI 的 Chat 架构？

结论：可以复用“架构模式”，不能直接复制代码。

### 1.1 Claudian 可迁移部分

Claudian 的核心价值：

```text
1. Provider-neutral runtime interface。
2. Provider owns provider-specific details。
3. Conversation 保存 providerId + opaque providerState。
4. Claude provider 负责：
   - Claude runtime
   - prompt encoding
   - stream transform
   - history hydration
   - CLI resolution
   - plugin / agent discovery
   - MCP storage
   - Claude-specific settings UI
5. ChatRuntime 层统一 send / stream / cancel / resume / fork。
```

迁移到 Ctrl-CC：

```text
src/core/runtime/
src/core/providers/
src/providers/claude-code/
```

不要让 WorkspaceSurface 直接知道：

```text
stream-json 格式
PTY session id
Claude command resolver
Tauri event name
Claude CLI path
```

Workspace 只知道：

```ts
runtime.sendMessage(sessionId, input)
runtime.startTerminal(sessionId)
runtime.cancel(sessionId)
runtime.resume(sessionId)
```

### 1.2 Abu-Cowork 可迁移部分

Abu-Cowork 的核心价值：

```text
1. Tauri + React + TypeScript 的桌面应用分层。
2. core/ 作为非 UI 核心引擎。
3. components/ 按功能归类。
4. stores/ Zustand 管理状态。
5. permissions/ 权限模型。
6. skill/ 技能系统。
7. mcp/ MCP 客户端。
8. session/ 会话管理。
9. diagnostics/ 诊断面板。
10. settings/ 多面板设置。
11. 明确工程约束、测试约束、发布约束。
```

迁移到 Ctrl-CC：

```text
src/core/
src/core/runtime/
src/core/session/
src/core/project/
src/core/resources/
src/core/permissions/
src/core/diagnostics/
src/core/setup/
src/providers/claude-code/
src/surfaces/*
```

### 1.3 其他 Claude Code GUI/TUI 可迁移部分

从公开 Claude Code GUI/TUI 的共同模式看，成功路径基本一致：

```text
1. Chat 走 headless / SDK / stream-json。
2. Terminal 走真实 PTY。
3. Chat 和 Terminal 是两个独立 channel。
4. 会话状态和通道状态分离。
5. UI 展示 chat / activity / file changes / terminal，而不是把所有东西混在一个 terminal 里。
6. MCP / settings / ~/.claude 配置必须兼容 Claude Code 原生配置。
```

因此 Ctrl-CC v25 必须采用：

```text
Chat channel: headless stream-json / SDK
Terminal channel: PTY
Background channel: 自动任务 / 长任务
Activity channel: 文件变化 / 工具调用 / 权限审批
```

---

## 2. 当前最新版代码的关键问题审计

### 2.1 WorkspaceSurface 仍然承担过多职责

文件：

```text
src/surfaces/workspace/WorkspaceSurface.tsx
```

当前该文件同时负责：

```text
1. tabs
2. viewMode
3. rawEvents
4. runtime event listen
5. Chat send
6. Project session creation
7. Terminal start
8. Setup incomplete 判断
9. ErrorStore 写入
10. Dialog 控制
11. Inspector 控制
```

这会导致 UI 与 Runtime 强耦合。

v25 必须拆分为：

```text
WorkspaceSurface.tsx             // only layout
WorkspaceHeader.tsx
WorkspaceTabBar.tsx
WorkspaceMainPanel.tsx
WorkspaceInspectorHost.tsx
useWorkspaceController.ts         // UI controller
useRuntimeSessionViewModel.ts     // read-only ViewModel
```

### 2.2 RuntimeFabricBridge 是当前最大架构瓶颈

文件：

```text
src/features/runtime-fabric/services/runtimeFabricBridge.ts
```

当前问题：

```text
1. createCtrlCcSession 直接写 RuntimeFabricStore。
2. 同时写 useSessionStore。
3. 同时写 useOpenSessionStore。
4. 同时调用 useSurfaceStore.navigateTo。
5. sendChatMessage 同时创建 channel、改状态、写 ledger、检查 setup、调 invoke。
6. startTerminalChannel 同样承担太多职责。
```

这意味着 RuntimeFabricBridge 不是 bridge，而是一个混杂的 app service。必须重构。

### 2.3 Rust ClaudeCommandResolver 已有雏形，但仍不够“能力矩阵化”

文件：

```text
src-tauri/src/runtime_v2/claude_command_resolver.rs
```

当前已经支持：

```text
nativeExe
nodeWrapper
cmdShim
gitBash
npxDiagnostic
```

但缺少：

```text
1. capability matrix: chat / terminal / resume / print / mcp / version / auth。
2. command smoke test。
3. extensionless claude 永久黑名单。
4. stdout/stderr 原始错误结构化。
5. selected command 持久化。
6. 用户手动指定 command path。
7. selected command 和 SetupSnapshot 双向同步。
```

### 2.4 chat_stream.rs 仍是裸 process 模式

文件：

```text
src-tauri/src/runtime_v2/chat_stream.rs
```

当前问题：

```text
1. 每次 send 都重新启动一个 process。
2. claudeSessionId 使用 crypto.randomUUID，但这不是 Claude Code 原生 session id。
3. 没有解析 system/init 中真实 session_id。
4. 没有把 result / usage / tool_use / permission / file edit 归一化。
5. stderr 只是原样作为 warning。
6. exit code 非 0 只变成 chat.failed，但缺少错误分类。
```

v25 必须引入：

```text
ClaudeStreamParser
ClaudeSessionMapper
ClaudeErrorClassifier
ClaudeTurnRunner
```

### 2.5 SetupSnapshot 的 ready 定义仍不够准确

当前：

```text
ready = 所有 required check ok
```

这不够。应该拆成：

```text
setup.readyForChat
setup.readyForTerminal
setup.readyForApi
setup.readyForProject
setup.readyForResource
```

例如：

```text
Chat 只需要 selectedChatCommand + auth/config。
Terminal 需要 selectedTerminalCommand + PTY 可启动。
Resources 不一定依赖 Claude 可运行。
```

### 2.6 UI 视觉系统仍不是商业级 Design System

当前现象：

```text
1. 部分页面字体过大，部分表格字体过小。
2. card 内部空白过大。
3. dashboard 在宽屏下左侧堆积，视觉重心不稳。
4. diagnostics 原始长表直接暴露给普通用户。
5. 页面样式混合 inline style 和 CSS token。
```

v25 要求：

```text
1. 全局 typography token。
2. Surface layout token。
3. Card density token。
4. 自适应断点。
5. diagnostics 默认摘要，raw details 折叠。
6. 所有表格进入 scroll panel，不能撑破布局。
```

---

## 3. v25 最终架构

### 3.1 目标目录结构

新增并迁移到：

```text
src/
├── app/
│   ├── App.tsx
│   ├── AppShell.tsx
│   └── SurfaceHost.tsx
├── core/
│   ├── runtime/
│   │   ├── RuntimeTypes.ts
│   │   ├── RuntimeKernel.ts
│   │   ├── RuntimeRegistry.ts
│   │   ├── RuntimeEventBus.ts
│   │   ├── RuntimeLedger.ts
│   │   ├── RuntimeReducer.ts
│   │   └── RuntimeSelectors.ts
│   ├── providers/
│   │   ├── ProviderTypes.ts
│   │   └── ProviderRegistry.ts
│   ├── session/
│   │   ├── SessionModel.ts
│   │   ├── SessionRepository.ts
│   │   └── SessionViewModel.ts
│   ├── project/
│   │   ├── ProjectModel.ts
│   │   ├── ProjectRepository.ts
│   │   └── ProjectService.ts
│   ├── setup/
│   │   ├── SetupModel.ts
│   │   ├── SetupService.ts
│   │   └── SetupSelectors.ts
│   ├── diagnostics/
│   │   ├── DiagnosticModel.ts
│   │   ├── DiagnosticService.ts
│   │   └── DiagnosticBundle.ts
│   ├── permissions/
│   │   ├── PermissionProfile.ts
│   │   └── PermissionPolicy.ts
│   └── resources/
│       ├── ResourceModel.ts
│       ├── SkillRegistry.ts
│       ├── AgentRegistry.ts
│       ├── RuleRegistry.ts
│       ├── MemoryRegistry.ts
│       └── McpRegistry.ts
├── providers/
│   └── claude-code/
│       ├── ClaudeCodeProvider.ts
│       ├── ClaudeCodeRuntime.ts
│       ├── ClaudeCodeCommandResolver.ts
│       ├── ClaudeCodeStreamParser.ts
│       ├── ClaudeCodeTurnRunner.ts
│       ├── ClaudeCodeTerminalRunner.ts
│       ├── ClaudeCodeHistory.ts
│       ├── ClaudeCodeSettings.ts
│       └── ClaudeCodeErrors.ts
├── stores/
│   ├── runtimeStore.ts
│   ├── sessionStore.ts
│   ├── projectStore.ts
│   ├── setupStore.ts
│   └── uiStore.ts
├── surfaces/
│   ├── console/
│   ├── projects/
│   ├── workspace/
│   ├── resources/
│   ├── github/
│   └── settings/
└── styles/
    ├── tokens.css
    ├── typography.css
    ├── layout.css
    ├── surfaces.css
    └── components.css
```

---

## 4. Runtime Kernel 设计

### 4.1 核心类型

新建：

```text
src/core/runtime/RuntimeTypes.ts
```

```ts
export type RuntimeProviderId = 'claude-code' | 'codex' | 'opencode';

export type RuntimeSessionStatus =
  | 'created'
  | 'idle'
  | 'running'
  | 'waiting-approval'
  | 'failed'
  | 'stopped'
  | 'archived';

export type RuntimeChannelKind = 'chat' | 'terminal' | 'background' | 'activity';

export type RuntimeChannelStatus =
  | 'created'
  | 'starting'
  | 'ready'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'exited';

export interface RuntimeSessionRecord {
  id: string;
  projectId: string;
  providerId: RuntimeProviderId;
  title: string;
  cwd: string;
  status: RuntimeSessionStatus;
  activeView: 'chat' | 'terminal' | 'split';
  channels: {
    chat?: string;
    terminal?: string;
    background?: string;
    activity?: string;
  };
  providerState: Record<string, unknown>;
  error: RuntimeErrorRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeChannelRecord {
  id: string;
  sessionId: string;
  kind: RuntimeChannelKind;
  status: RuntimeChannelStatus;
  cwd: string;
  pid?: number | null;
  program?: string | null;
  args?: string[];
  error?: RuntimeErrorRecord | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  exitedAt?: string | null;
}

export type RuntimeUiEvent =
  | { id: string; type: 'user_message'; sessionId: string; content: string; createdAt: string }
  | { id: string; type: 'assistant_message'; sessionId: string; content: string; createdAt: string; streaming?: boolean }
  | { id: string; type: 'tool_start'; sessionId: string; toolName: string; input?: unknown; createdAt: string }
  | { id: string; type: 'tool_done'; sessionId: string; toolName: string; output?: unknown; createdAt: string }
  | { id: string; type: 'system'; sessionId: string; level: 'info' | 'warning' | 'error'; content: string; createdAt: string };

export interface RuntimeErrorRecord {
  code:
    | 'COMMAND_NOT_FOUND'
    | 'AUTH_REQUIRED'
    | 'CLI_CRASH'
    | 'SPAWN_FAILED'
    | 'STREAM_PARSE_FAILED'
    | 'PTY_FAILED'
    | 'SETUP_INCOMPLETE'
    | 'UNKNOWN';
  message: string;
  raw?: string;
  fixHint?: string;
}
```

---

### 4.2 RuntimeKernel

新建：

```text
src/core/runtime/RuntimeKernel.ts
```

职责：

```text
1. createSession
2. sendChat
3. startTerminal
4. stopChannel
5. cancelTurn
6. resumeSession
7. appendEvent
8. classifyError
9. route provider events into store
```

接口：

```ts
export interface RuntimeKernel {
  createSession(input: CreateRuntimeSessionInput): Promise<RuntimeSessionRecord>;
  sendChat(input: SendChatInput): Promise<void>;
  startTerminal(input: StartTerminalInput): Promise<void>;
  stopChannel(channelId: string): Promise<void>;
  cancel(sessionId: string): Promise<void>;
}
```

实现原则：

```text
1. UI 永远不直接 invoke Tauri command。
2. UI 永远不直接写 runtimeStore。
3. UI 只调用 RuntimeKernel。
4. RuntimeKernel 调 ProviderRuntime。
5. ProviderRuntime 调 Tauri invoke。
6. ProviderRuntime emit normalized event。
7. RuntimeKernel 统一写 store。
```

---

### 4.3 ProviderRuntime 接口

新建：

```text
src/core/providers/ProviderTypes.ts
```

```ts
export interface ProviderRuntime {
  providerId: RuntimeProviderId;

  createSession(input: CreateRuntimeSessionInput): Promise<ProviderSessionState>;

  sendChat(input: {
    session: RuntimeSessionRecord;
    prompt: string;
    model?: string;
    permissionMode?: string;
    effort?: string;
  }): Promise<ProviderTurnHandle>;

  startTerminal(input: {
    session: RuntimeSessionRecord;
    cols: number;
    rows: number;
  }): Promise<ProviderTerminalHandle>;

  stopChannel(channelId: string): Promise<void>;
}

export interface ProviderTurnHandle {
  channelId: string;
  pid?: number | null;
}

export interface ProviderTerminalHandle {
  channelId: string;
  pid?: number | null;
}
```

---

## 5. Claude Code Provider v25

### 5.1 Chat 必须使用 headless / stream-json 作为第一实现

Chat 不要通过 PTY 模拟人敲字。Chat 默认实现：

```bash
claude -p "<prompt>" --output-format stream-json --verbose --include-partial-messages
```

如果要连续上下文，必须从 Claude 的 `system/init` 或 result event 中拿真实 `session_id`，保存到：

```ts
session.providerState.claudeSessionId
```

下一轮使用官方支持的 resume/session 机制，而不是 `crypto.randomUUID()` 伪造。

### 5.2 Terminal 才使用 PTY

Terminal 是专家模式：

```text
用户点击 Terminal → startTerminal → 启动 PTY → xterm.js 连接
```

不要在新建 session 时自动启动 PTY。

### 5.3 背景任务使用 background channel

Background channel 使用 headless 模式，不占用 UI Chat 输入流。

---

## 6. Rust 后端 v25 拆分

当前 Rust runtime_v2 建议升级为：

```text
src-tauri/src/runtime_v3/
├── mod.rs
├── types.rs
├── command_resolver.rs
├── chat_runner.rs
├── terminal_runner.rs
├── process_registry.rs
├── event_emit.rs
├── error_classifier.rs
└── commands.rs
```

### 6.1 command_resolver.rs

能力矩阵：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCommandCapability {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub kind: String,
    pub source: String,

    pub exists: bool,
    pub version_ok: bool,
    pub version_text: Option<String>,

    pub can_chat_print: bool,
    pub can_stream_json: bool,
    pub can_terminal_pty: bool,
    pub can_resume: bool,

    pub selected_for_chat: bool,
    pub selected_for_terminal: bool,

    pub error_code: Option<String>,
    pub error_message: Option<String>,
}
```

### 6.2 严格禁止 extensionless claude

加入：

```rust
fn is_forbidden_windows_extensionless(path: &Path) -> bool {
    cfg!(windows)
        && path.file_name().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("claude")).unwrap_or(false)
        && path.extension().is_none()
}
```

在 resolver 中：

```rust
if is_forbidden_windows_extensionless(&path) {
    capability.error_code = Some("EXTENSIONLESS_WINDOWS_SHIM".into());
    capability.error_message = Some("Do not execute extensionless npm shim directly on Windows.".into());
    return capability;
}
```

### 6.3 Chat runner

```rust
pub fn start_chat_turn(app: AppHandle, req: ChatTurnRequest) -> Result<ChatTurnStarted, RuntimeError>
```

行为：

```text
1. resolve selected chat command。
2. build invocation。
3. spawn child。
4. stdout line → runtime://chat/raw-line。
5. stderr line → runtime://chat/stderr。
6. exit → runtime://chat/exit。
7. process_registry 记录 pid/channel/session。
```

### 6.4 Terminal runner

```rust
pub fn start_terminal(app: AppHandle, req: TerminalStartRequest) -> Result<TerminalStarted, RuntimeError>
```

行为：

```text
1. resolve selected terminal command。
2. portable_pty openpty。
3. spawn command。
4. reader thread → pty://data。
5. registry 记录 writer。
6. exit → pty://exit。
```

---

## 7. ClaudeCodeStreamParser v25

新建：

```text
src/providers/claude-code/ClaudeCodeStreamParser.ts
```

功能：

```text
1. JSON line parse。
2. system/init 提取真实 session_id / model / cwd / tools。
3. stream_event + text_delta 合并成 assistant_message。
4. tool_use start。
5. tool_result done。
6. result event 更新 usage / cost / status。
7. system/api_retry 转成 retry 状态。
8. stderr 分类。
```

示例：

```ts
export class ClaudeCodeStreamParser {
  parseLine(line: string): ClaudeCodeParsedEvent {
    const raw = JSON.parse(line);

    if (raw.type === 'system' && raw.subtype === 'init') {
      return {
        type: 'session_init',
        claudeSessionId: raw.session_id,
        model: raw.model,
        tools: raw.tools ?? [],
        raw,
      };
    }

    if (
      raw.type === 'stream_event' &&
      raw.event?.type === 'content_block_delta' &&
      raw.event?.delta?.type === 'text_delta'
    ) {
      return {
        type: 'assistant_delta',
        text: raw.event.delta.text,
        raw,
      };
    }

    if (raw.type === 'assistant') {
      return {
        type: 'assistant_message',
        message: raw.message,
        raw,
      };
    }

    if (raw.type === 'result') {
      return {
        type: 'turn_result',
        result: raw,
        raw,
      };
    }

    return { type: 'raw', raw };
  }
}
```

---

## 8. 修复 Chat “一直没打通”的核心路线

### 8.1 立即替换 session id 逻辑

当前：

```ts
claudeSessionId: crypto.randomUUID()
```

错误。应改为：

```ts
providerState: {
  claudeSessionId: null,
  claudeProjectPath: null,
  previousClaudeSessionIds: [],
}
```

在收到 `system/init.session_id` 后再保存。

### 8.2 首轮 send 不传 `--session-id`

首轮：

```bash
claude -p "..." --output-format stream-json --verbose --include-partial-messages
```

收到真实 session id 后：

```ts
session.providerState.claudeSessionId = event.claudeSessionId
```

下一轮才传 resume/session 参数，具体参数以当前 Claude Code 版本验证结果为准。禁止伪造 UUID。

### 8.3 Chat 失败不能禁用整个会话

Chat turn 失败：

```text
channel.status = failed
session.status = idle
session.error = lastTurnError
composer enabled = true unless setup missing
```

Terminal 失败：

```text
terminalChannel.status = failed
session.status 不变
chat still available
```

---

## 9. Setup Center v25

SetupSnapshot 改造：

```ts
export interface SetupSnapshot {
  generatedAt: string;
  severity: 'ok' | 'warning' | 'error';
  summary: string;

  readyForChat: boolean;
  readyForTerminal: boolean;
  readyForApi: boolean;
  readyForProject: boolean;

  checks: Record<string, SetupCheckResult>;
  claudeCommands: ClaudeCommandCapability[];

  selectedChatCommandId: string | null;
  selectedTerminalCommandId: string | null;
}
```

判断：

```ts
readyForChat =
  selectedChatCommandId !== null &&
  claudeCode.ok &&
  (claudeAuth.ok || claudeConfig.ok);

readyForTerminal =
  selectedTerminalCommandId !== null;

readyForApi =
  claudeAuth.ok || apiProvider.ok;

readyForProject =
  workspace.ok;
```

UI：

```text
Console 环境卡显示 readyForChat / readyForTerminal。
Workspace Chat 只看 readyForChat。
Terminal 按钮只看 readyForTerminal。
Settings Setup Center 显示完整 matrix。
```

---

## 10. Project / Session / Resource 全打通

### 10.1 Project 新建 Claude 会话

流程：

```text
ProjectsSurface 点击 New Claude Session
→ RuntimeKernel.createSession({
    providerId: 'claude-code',
    projectId,
    cwd: project.path,
    viewMode: 'chat'
  })
→ openSessionStore.open(session.id)
→ navigateTo('workspace')
→ Workspace 显示 Chat
→ 不启动 PTY
```

### 10.2 Chat 中 @mention 资源

Resources 输出：

```ts
interface MentionableResource {
  id: string;
  type: 'file' | 'skill' | 'agent' | 'rule' | 'memory' | 'mcp';
  label: string;
  insertText: string;
  contextPayload?: unknown;
}
```

ComposerBar 接入：

```text
@ 文件
/ slash command
$ skill
# instruction
```

### 10.3 Rules 写入项目记忆

项目内：

```text
{project}/.claude/settings.json
{project}/.claude/commands/
{project}/.claude/skills/
{project}/.claude/agents/
{project}/.ctrlcc/rules/
{project}/.ctrlcc/memory/
```

---

## 11. Diagnostics v25

默认不要展示巨大的 raw matrix。改为三层：

```text
Level 1: 用户摘要
- Chat 是否可用
- Terminal 是否可用
- Claude CLI 版本
- 当前 selected command
- 最近错误
- 一键修复建议

Level 2: 工程诊断
- Command capability matrix
- Runtime sessions
- Channels
- Recent normalized events
- Setup snapshot

Level 3: Raw forensic
- raw stream-json lines
- raw stderr
- full candidate scan
- PTY registry
- process registry
```

---

## 12. UI v25：统一字体、密度、自适应

### 12.1 全局字体

```css
:root {
  --cc-font-family: "Inter", "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif;

  --cc-text-display: clamp(28px, 2.2vw, 36px);
  --cc-text-title: clamp(22px, 1.7vw, 28px);
  --cc-text-section: 18px;
  --cc-text-card: 15px;
  --cc-text-body: 14px;
  --cc-text-caption: 12px;
  --cc-text-micro: 11px;

  --cc-weight-display: 780;
  --cc-weight-title: 720;
  --cc-weight-section: 680;
  --cc-weight-card: 640;
  --cc-weight-body: 430;
}
```

### 12.2 页面容器

```css
.cc-surface {
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: auto;
  background: var(--cc-bg);
}

.cc-surface-inner {
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: clamp(16px, 2vw, 28px);
}

.cc-grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: clamp(12px, 1.4vw, 18px);
}
```

### 12.3 Card density

```css
.cc-card {
  min-width: 0;
  border: 1px solid var(--cc-border);
  border-radius: 18px;
  background: var(--cc-surface);
  box-shadow: var(--cc-shadow-soft);
  overflow: hidden;
}

.cc-card-compact {
  padding: 12px 14px;
}

.cc-card-comfortable {
  padding: 16px 18px;
}

.cc-card-dense {
  padding: 10px 12px;
}
```

### 12.4 断点规则

```css
@media (max-width: 900px) {
  .cc-surface-inner { padding: 14px; }
  .cc-dashboard-layout { grid-template-columns: 1fr; }
  .cc-hide-compact { display: none; }
}

@media (min-width: 901px) and (max-width: 1399px) {
  .cc-dashboard-layout { grid-template-columns: 1fr 1fr; }
}

@media (min-width: 1400px) {
  .cc-dashboard-layout { grid-template-columns: 1.2fr 1fr 0.9fr; }
}
```

---

## 13. AI Dock v25

移除主应用内部悬浮栏。改为独立窗口：

Rust/Tauri：

```text
window label: ai-dock
decorations: false
transparent: true
always_on_top: true
skip_taskbar: true
resizable: false
```

Dock 与主窗口通信：

```text
runtime://session-status
runtime://chat-progress
runtime://approval-needed
runtime://error
dock://open-main
dock://focus-session
```

Dock 模式：

```text
quiet: 边缘小条
focus: 展示当前任务
control: 可审批/暂停/继续
```

---

## 14. 工程规范写入项目记忆

新增：

```text
CLAUDE.md
docs/ENGINEERING_PRINCIPLES.md
docs/ARCHITECTURE_V25.md
docs/RUNTIME_CONTRACTS.md
docs/UI_DESIGN_SYSTEM.md
```

`CLAUDE.md` 顶部写：

```md
# Ctrl-CC Engineering Memory

Before every code change, read:

1. docs/ENGINEERING_PRINCIPLES.md
2. docs/ARCHITECTURE_V25.md
3. docs/RUNTIME_CONTRACTS.md
4. docs/UI_DESIGN_SYSTEM.md

Hard rules:

- Do not let UI call Tauri invoke directly for runtime operations.
- Do not let Chat and Terminal share lifecycle status.
- Do not execute extensionless npm shims on Windows.
- Do not fake Claude session IDs.
- Do not mutate stores from React render phase.
- Do not expose raw diagnostics to normal users by default.
- Every runtime behavior change must have tests.
```

---

## 15. 测试计划

新增：

```text
tests/runtime/commandResolver.test.ts
tests/runtime/streamParser.test.ts
tests/runtime/runtimeKernel.test.ts
tests/runtime/channelIsolation.test.ts
tests/setup/setupSnapshot.test.ts
tests/ui/workspaceRender.test.tsx
tests/ui/consoleResponsive.test.tsx
```

覆盖：

```text
[ ] extensionless claude never selected
[ ] nodeWrapper selected before cmdShim
[ ] chat first turn does not send fake session id
[ ] system/init session_id persisted
[ ] assistant deltas coalesced once
[ ] final assistant message deduped
[ ] chat failure leaves session idle
[ ] terminal failure does not disable chat
[ ] setup readyForChat independent from readyForTerminal
[ ] WorkspaceSurface has no direct invokeCommand usage
[ ] RuntimeKernel is the only runtime entry
[ ] Console responsive layout does not overflow at 900/1280/1600 width
```

---

## 16. 执行顺序

### Phase 1：v25 runtime hardening

```text
1. 建 core/runtime 类型。
2. 建 RuntimeKernel。
3. 把 RuntimeFabricBridge 逻辑迁入 RuntimeKernel。
4. WorkspaceSurface 改为只调用 useWorkspaceController。
5. RuntimeKernel 统一写 runtimeStore。
6. Chat/Terminal channel 独立状态。
7. 修复 fake claudeSessionId。
8. Chat parser 提取真实 session_id。
9. 加 stream parser tests。
```

### Phase 2：ClaudeCode Provider

```text
1. 建 providers/claude-code。
2. 迁移 command resolver 前端类型。
3. 迁移 chat runner。
4. 迁移 terminal runner。
5. 迁移 error classifier。
6. 迁移 settings merge。
7. ProviderRegistry 注册 claude-code。
```

### Phase 3：Setup Center v25

```text
1. SetupSnapshot 加 readyForChat/readyForTerminal。
2. Console 环境卡只读 snapshot。
3. Settings 环境页成为 Setup Center。
4. 首次引导复刻 1shot-CC 功能。
5. 非首次启动只提示，不自动重跑。
```

### Phase 4：UI Design System

```text
1. 新建 typography/layout/card tokens。
2. 所有 surfaces 使用 cc-surface / cc-surface-inner。
3. Console 重排。
4. Projects 重排。
5. Workspace 重排。
6. Resources 重排。
7. Diagnostics 三层折叠。
```

### Phase 5：Resources / AI Dock

```text
1. Resources 资源模型化。
2. Skill/Agent/Rule/Memory/MCP 与 Project 绑定。
3. Composer 接入 @ / / / $ / #。
4. AI Dock 独立 Tauri window。
5. Dock 订阅 RuntimeKernel events。
```

---

## 17. 成功标准

```text
[ ] 新建项目会话默认进入 Chat 气泡界面。
[ ] 第一条消息可以真实调用 Claude Code CLI。
[ ] Chat 输出能流式显示。
[ ] 工具调用能显示在 Activity。
[ ] Terminal 点击后才启动，且能完整交互 Claude CLI。
[ ] Terminal crash 不影响 Chat。
[ ] Chat turn crash 不影响 Session。
[ ] Setup Center 能识别已有 Node/npm/Git/Claude/Windows Terminal/PATH。
[ ] Diagnostics 能定位错误但不淹没普通用户。
[ ] Console/Projects/Workspace/Resources/Settings 字体统一。
[ ] 页面在小窗口和全屏下都不挤压、不重叠、不空洞。
[ ] AI Dock 不再是主窗口内部悬浮条，而是独立窗口。
[ ] Runtime 全状态可导出、可复盘、可测试。
```

---

## 18. 给 Claude CLI 的执行命令

```bash
git checkout master
git pull origin master

mkdir -p docs
mkdir -p src/core/runtime src/core/providers src/core/session src/core/project src/core/setup src/core/diagnostics src/core/permissions src/core/resources
mkdir -p src/providers/claude-code
mkdir -p tests/runtime tests/setup tests/ui

npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm test
```

每个 phase 完成后必须提交本地 commit，但不要自动 push：

```bash
git add .
git commit -m "refactor(runtime): introduce v25 runtime kernel"
```

---

## 19. 最重要的禁止事项

```text
1. 禁止再用 UI 组件直接 invoke runtime Tauri command。
2. 禁止 Chat 和 Terminal 共用同一个 status。
3. 禁止 fake Claude session id。
4. 禁止 render 阶段做 store mutation / parser feed。
5. 禁止 Diagnostics 默认展示超长 raw matrix。
6. 禁止直接运行 C:\Users\...\AppData\Roaming\npm\claude。
7. 禁止把 npm/npx diagnostic 当正式 chat runtime。
8. 禁止 Settings / Console 各自重复环境检测逻辑。
9. 禁止所有页面继续 inline style 泛滥。
10. 禁止“修 Chat”时顺手重写 UI 大结构，必须分 phase。
```

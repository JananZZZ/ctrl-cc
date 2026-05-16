# Ctrl-CC 24.0 / PLAN-P2：学习 Claudian 与 Abu-Cowork 的商用级架构升级

目标：把 Ctrl-CC 从“页面 + 临时 runtime glue”升级为真正的 AI Coding Control Plane。  
方向：吸收 Claudian 的 provider-native runtime 边界，吸收 Abu-Cowork 的 core engine / agent / permission / diagnostics / settings 架构，但保留 Ctrl-CC 的特色：Claude Code CLI 控制台、项目-会话管理、资源管理、AI Dock、四主题视觉系统。

---

## 0. 总体判断

当前 Ctrl-CC 的问题不是单个 bug，而是架构层级还不够清晰：

```text
UI 页面
状态 store
Runtime bridge
PTY
Chat stream
环境检测
资源管理
诊断
```

这些模块现在互相穿插，导致：

```text
1. Chat 失败会污染 Terminal。
2. Terminal 失败会污染 Session。
3. 环境检测误判会禁用 Chat。
4. Workspace 渲染状态和 runtime 状态互相触发。
5. Diagnostics 长表直接压垮界面。
6. UI 字体和布局没有统一 tokens。
```

---

## 1. 学习 Claudian：Provider-native Runtime 边界

Claudian 的关键思想：

```text
ProviderRegistry
ChatRuntime interface
ProviderWorkspaceRegistry
Claude provider owns Claude runtime, prompt encoding, stream transform, history hydration, CLI resolution, settings UI
Conversation carries providerId + opaque providerState
```

Ctrl-CC 应迁移为：

```text
src/core/runtime/
src/core/providers/
src/providers/claude-code/
src/providers/codex/
src/providers/opencode/
src/features/workspace/
```

---

## 2. 新 Runtime 架构

### 2.1 核心接口

新建：

```text
src/core/runtime/ChatRuntime.ts
```

```ts
export interface ChatRuntime {
  providerId: string;
  createSession(input: CreateSessionInput): Promise<RuntimeSession>;
  send(input: SendMessageInput): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  fork(sessionId: string): Promise<RuntimeSession>;
  compact(sessionId: string): Promise<void>;
  dispose(sessionId: string): Promise<void>;
}

export interface RuntimeSession {
  id: string;
  providerId: string;
  projectId: string;
  cwd: string;
  status: 'idle' | 'running' | 'waiting-approval' | 'failed' | 'stopped';
  providerState: Record<string, unknown>;
}
```

### 2.2 Provider Registry

新建：

```text
src/core/providers/ProviderRegistry.ts
```

```ts
export interface ProviderDefinition {
  id: string;
  label: string;
  createRuntime(): ChatRuntime;
  capabilities: {
    chat: boolean;
    terminal: boolean;
    resume: boolean;
    fork: boolean;
    mcp: boolean;
    skills: boolean;
    planMode: boolean;
    inlineEdit: boolean;
  };
}

export class ProviderRegistry {
  private providers = new Map<string, ProviderDefinition>();

  register(provider: ProviderDefinition) {
    this.providers.set(provider.id, provider);
  }

  get(id: string) {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider not found: ${id}`);
    return p;
  }

  list() {
    return Array.from(this.providers.values());
  }
}
```

### 2.3 Claude Code Provider

新建：

```text
src/providers/claude-code/
src/providers/claude-code/ClaudeCodeRuntime.ts
src/providers/claude-code/ClaudeCodeCliResolver.ts
src/providers/claude-code/ClaudeCodeStreamParser.ts
src/providers/claude-code/ClaudeCodeSettings.ts
src/providers/claude-code/ClaudeCodeHistory.ts
```

职责：

```text
ClaudeCodeRuntime:
- createSession
- send stream-json
- cancel
- resume
- fork
- compact

ClaudeCodeCliResolver:
- native exe
- npm cli-wrapper
- cmd shim fallback
- diagnostics

ClaudeCodeStreamParser:
- stream-json → normalized RuntimeEvent
- tool call
- assistant text
- usage
- error
- result

ClaudeCodeSettings:
- settings.json merge
- API provider env
- permissions
- MCP

ClaudeCodeHistory:
- ~/.claude/projects jsonl hydrate
- session mapping
```

---

## 3. 学习 Abu-Cowork：Core Engine 与商业级模块分层

Abu-Cowork 的核心启发：

```text
components/    UI by feature
core/          non-UI engine
stores/        Zustand state
settings/      多面板设置
permissions/   权限模型
skill/         技能加载
memdir/        文件化记忆
scheduler/     定时任务
trigger/       触发器
logging/       结构化日志
```

Ctrl-CC 应升级为：

```text
src/
├── app/
├── components/
├── core/
│   ├── runtime/
│   ├── providers/
│   ├── project/
│   ├── session/
│   ├── resources/
│   ├── permissions/
│   ├── diagnostics/
│   ├── logging/
│   └── setup/
├── providers/
│   ├── claude-code/
│   ├── codex/
│   └── opencode/
├── surfaces/
│   ├── console/
│   ├── projects/
│   ├── workspace/
│   ├── resources/
│   ├── github/
│   └── settings/
├── stores/
└── styles/
```

---

## 4. Runtime Fabric Ledger 2.0

当前 ledger 是数组。升级为：

```ts
export interface RuntimeLedger {
  sessions: Record<string, RuntimeSessionRecord>;
  channels: Record<string, RuntimeChannelRecord>;
  events: Record<string, RuntimeEvent[]>;
  metrics: Record<string, RuntimeMetrics>;
  errors: RuntimeError[];
}
```

规则：

```text
1. Chat channel 和 Terminal channel 分离。
2. Session 不因单个 channel failed 而 failed。
3. failed channel 只影响对应 UI 区块。
4. 所有事件 append-only。
5. 所有 UI 只读 normalized store，不直接读 backend raw event。
6. raw event 只在 Diagnostics 展示。
```

---

## 5. Chat / Terminal 双通道

### 5.1 Chat Channel

```text
用途：小白默认聊天界面
启动：claude -p --output-format stream-json
显示：气泡聊天
失败：显示气泡错误 + 修复按钮
不需要 PTY
```

### 5.2 Terminal Channel

```text
用途：专业用户完全操作 Claude Code CLI
启动：用户点击 Terminal 后才启动
渲染：xterm.js
失败：只影响 Terminal tab
不影响 Chat
```

### 5.3 Background Channel

```text
用途：自动任务、批量执行、资源扫描
启动：用户授权后后台运行
显示：AI Dock / Console timeline
```

---

## 6. Project / Session 商业级模型

### 6.1 Project

```ts
interface Project {
  id: string;
  name: string;
  path: string;
  providerDefaults: ProviderDefaults;
  resourceScope: ResourceScope;
  permissions: PermissionProfile;
  skills: string[];
  agents: string[];
  mcpServers: string[];
  githubRepo?: string;
  stats: ProjectStats;
}
```

### 6.2 Session

```ts
interface Session {
  id: string;
  projectId: string;
  providerId: string;
  title: string;
  cwd: string;
  status: SessionStatus;
  channels: {
    chat?: string;
    terminal?: string;
    background?: string;
  };
  providerState: Record<string, unknown>;
  summary?: string;
  metrics: SessionMetrics;
  createdAt: string;
  updatedAt: string;
}
```

---

## 7. UI 视觉系统 2.0

### 7.1 字体层级

全局 tokens：

```css
:root {
  --cc-text-display: clamp(30px, 2.8vw, 42px);
  --cc-text-title: clamp(22px, 2vw, 30px);
  --cc-text-section: 18px;
  --cc-text-card: 15px;
  --cc-text-body: 14px;
  --cc-text-caption: 12px;
  --cc-text-micro: 11px;

  --cc-weight-display: 780;
  --cc-weight-title: 720;
  --cc-weight-section: 680;
  --cc-weight-body: 430;

  --cc-color-text: var(--cc-text);
  --cc-color-muted: var(--cc-text-muted);
  --cc-color-soft: var(--cc-text-soft);
}
```

### 7.2 页面容器规则

```css
.cc-surface-page {
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: auto;
  padding: clamp(18px, 2.4vw, 36px);
}

.cc-surface-inner {
  width: min(1440px, 100%);
  margin: 0 auto;
}

.cc-adaptive-grid {
  display: grid;
  gap: clamp(12px, 1.5vw, 20px);
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
}
```

### 7.3 小窗口与全屏不同设计

```text
≤ 900px:
- 单列
- 卡片压缩
- 隐藏次要指标
- 右侧 inspector 变 drawer

900-1400px:
- 两列
- 主内容 + 侧边信息

≥ 1400px:
- 三列/瀑布流
- 指标卡、图表、最近会话并列
```

---

## 8. Console 重构

Console 不再是静态展示页，而是控制塔：

```text
顶部 Hero：问候 + runtime status + 环境配置按钮
指标区：运行中 / 项目 / 今日费用 / Claude CLI / Tokens
健康条：PTY / Chat / Errors / Bridge
主体：
  左：最近会话
  中：项目热力 / 任务瀑布
  右：环境配置 / 快速操作
底部：需要关注事项
```

---

## 9. Projects 重构

Projects 页面：

```text
左：项目列表 / 搜索 / 分组
中：项目卡片瀑布流
右：项目详情 Inspector
```

每个项目卡片：

```text
名称
路径
Git 状态
运行会话
最近 activity
默认 provider/model
风险/审批
快捷按钮：新建 Chat / 打开 Workspace / 资源 / GitHub / 设置
```

---

## 10. Workspace 重构

Workspace：

```text
顶部 tab bar
左：Chat / Terminal / Split 切换
中：Chat bubble or Terminal
右：Session Inspector
底部：Composer
```

默认：

```text
Project 新建 Claude 会话 → 自动打开 Chat bubble
Terminal 只有专业用户点击后启动
```

---

## 11. Resources 重构

Resources 与 Workspace 连接：

```text
Skills:
- 可启用/禁用
- 可绑定 project
- 可插入 prompt
- 可发给当前 session

Agents:
- 可作为 @mention
- 可分配到项目
- 可后台运行

Rules:
- 用户级
- 项目级
- 会话级

Memory:
- 全局
- 项目
- 会话

MCP:
- 安装
- 健康检测
- 绑定 provider/project
```

---

## 12. AI Dock 独立窗口

移除主程序内部右侧悬浮条。AI Dock 应该是独立 Tauri window：

```text
label: ai-dock
position: screen right edge
alwaysOnTop: optional
transparent: true
decorations: false
skipTaskbar: true
```

主程序只保留：

```text
Dock 设置入口
Dock 状态同步
Dock notification event bus
```

---

## 13. Diagnostics 商业级升级

默认视图：

```text
健康总览
最近 10 条错误
Runtime channels
Selected command
环境状态
导出诊断包
```

高级折叠：

```text
Raw launch matrix
Raw candidates
Raw event trace
Raw PTY registry
```

诊断包：

```text
app version
os
node/npm/claude/git/wt paths
selected command
runtime ledger
last errors
redacted settings
```

---

## 14. 测试策略

新增测试：

```text
tests/runtime/claudeResolver.test.ts
tests/runtime/chatStreamParser.test.ts
tests/runtime/runtimeLedger.test.ts
tests/setup/detector.test.ts
tests/ui/workspaceRender.test.tsx
tests/ui/consoleResponsive.test.tsx
```

必须覆盖：

```text
[ ] selector 返回稳定空数组
[ ] stream-json 合并 assistant message
[ ] Chat 失败不 kill session
[ ] Terminal 失败不影响 Chat
[ ] PATH 检测用 where.exe
[ ] Windows Terminal 检测用 where wt
[ ] extensionless claude 永不作为 executable
[ ] node cli-wrapper.cjs 优先于 npx diagnostic
```

---

## 15. 三阶段执行

### Stage 1：止血

执行 PLAN-P0。

### Stage 2：Setup Center

执行 PLAN-P1。

### Stage 3：商业级架构升级

执行本计划：

```text
1. 建 core/runtime
2. 建 providers/claude-code
3. 迁移 RuntimeFabric
4. 迁移 Workspace 到 provider runtime
5. 迁移 Settings 到多面板
6. 迁移 Resources 到 project/session 绑定
7. AI Dock 改独立 window
8. Diagnostics 降噪和诊断包
9. UI token 全局统一
10. 补测试
```

---

## 16. 验收标准

```text
[ ] Chat 像普通聊天软件一样稳定使用。
[ ] Terminal 像 Claude Code CLI 一样完整可操作。
[ ] Project 新建会话默认进入 Chat。
[ ] Terminal 点击才启动。
[ ] 环境缺失有 Setup Center 引导。
[ ] Console / Project / Workspace / Resource / Settings 视觉统一。
[ ] 小窗口和大窗口都有自适应布局。
[ ] Diagnostics 能定位问题但不淹没用户。
[ ] AI Dock 作为独立桌面窗口运行。
[ ] 所有 Runtime 状态都能追踪、导出、复盘。
```

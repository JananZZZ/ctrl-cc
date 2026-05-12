# Ctrl-CC vNext 全新重构执行总则

> 本文档可直接发送给 Claude Code。  
> 目标：在 `G:/Claude Code/ctrl-cc/` 下新建一个干净的 Ctrl-CC vNext 项目，保留原有视觉语言、产品目标和全层架构，但彻底重写底层代码，避免继续在旧项目屎山代码上堆叠。  
> 核心定位：Ctrl-CC 是 Claude Code CLI 的 **PTY-first GUI Control Plane**，不是 Claude Code 的替代品，不复现 Claude Code 内部 agent loop，不破解、不逆向、不绕过官方权限与认证。

---

## 0. 总体原则

### 0.1 这次要重建，不要修补

旧项目中已经存在大量半实现、假按钮、状态混乱、页面职责不清、Runtime 链路不稳定的问题。vNext 必须重新建立清晰架构：

```text
新项目路径：G:/Claude Code/ctrl-cc/
保留：视觉风格、产品理念、全功能目标、架构分层
推翻：旧业务代码、旧页面耦合、旧状态混乱、假数据、假按钮、半实现 Runtime
```

可以参考旧项目：

```text
设计 token
视觉组件风格
页面布局概念
图标与动效逻辑
需求文档
IP 形象
```

禁止直接继承：

```text
旧 Runtime 代码
旧状态管理混乱代码
旧页面堆叠逻辑
旧假数据
旧无行为按钮
旧无法维护组件
```

### 0.2 最高产品目标

```text
1. 100% 承载 Claude Code CLI 原生交互能力
2. 200% 可视化 Claude Code 公开可观察行为
3. 500% 提升项目、会话、资源、风险、审计、自动化管理能力
```

### 0.3 PTY-first 是主架构

普通 Claude Code 会话必须通过真实 PTY 启动：

```text
Rust backend: portable-pty / Windows ConPTY
Frontend: xterm.js
普通交互：PTY interactive runtime
结构化任务：claude -p --output-format stream-json
```

注意：

```text
Terminal View = 完全原生 Claude Code CLI 体验，和 PowerShell / Windows Terminal 中打开 Claude Code 尽可能一致
Chat View = 小白友好语义视图，基于 RuntimeEvent / Semantic Overlay 增强展示
Split View = 原生终端 + 小白语义视图并排显示
```

---

## 1. 新主 Surface 架构

左侧主快捷切换栏固定为 7 个 Surface：

```text
1. 控制台 Console
2. 项目管理区 Projects
3. 工作区 Workspace / Chat
4. 资源区 Resources
5. 无限画布 Canvas
6. GitHub 映射 GitHub
7. 设置 Settings
```

### 1.1 左侧栏行为

```text
icon-only / icon+text 可切换
hover 显示 tooltip
选中 Surface 使用浅卡其高亮
运行中、待确认、风险使用状态点和 badge
底部显示 Claude CLI / PTY / AutoTrust / Dock 状态
```

### 1.2 Surface 职责

```text
Console：启动页、全局驾驶舱、最近动态、快捷入口
Projects：工作文件夹、项目、会话、resume/fork/archive、项目状态管理
Workspace：当前打开会话的 Chat / Terminal / Split / Inspector
Resources：Skills、Agents、MCP、Hooks、Plugins、CLAUDE.md、Memory、Permissions
Canvas：高级用户自由编排项目/会话/资源/风险节点
GitHub：安全 WebView + 当前项目 GitHub repo/PR/Issue 映射
Settings：首次引导、环境检测、Runtime、外观、安全、诊断
```

---

## 2. 工程目录建议

推荐采用清晰分层。可以使用单应用结构，也可以预留 monorepo，但不要复杂化第一版。

```text
G:/Claude Code/ctrl-cc/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── surfaces/
│       │   ├── features/
│       │   ├── components/
│       │   ├── stores/
│       │   ├── services/
│       │   ├── types/
│       │   └── styles/
│       └── src-tauri/
│           └── src/
│               ├── commands/
│               ├── pty/
│               ├── runtime/
│               ├── database/
│               ├── repositories/
│               ├── resources/
│               ├── git/
│               ├── settings/
│               ├── audit/
│               ├── risk/
│               └── diagnostics/
├── docs/
├── scripts/
└── tests/
```

如果第一阶段不做 monorepo，可以直接：

```text
G:/Claude Code/ctrl-cc/
├── src/
├── src-tauri/
├── docs/
├── scripts/
└── tests/
```

但 src 内部必须保持模块边界。

---

## 3. 统一视觉语言

必须沿用 Ctrl-CC 已定视觉：

```text
Neo Calm Industrial
新极简主义 + 新复古主义 + 舒缓界面
浅卡其 Claude Sand
米白 / 深海军蓝 / 柔和蓝绿
低对比、弱边框、轻阴影
大圆角
图标优先、文字按需
中文默认
小白友好，高级用户不受限
```

### 3.1 基础组件

必须先建立统一 UI 组件，不允许各 Surface 自己写不同卡片：

```text
CcCard
CcPanel
CcButton
CcIconButton
CcBadge
CcStatusDot
CcTabs
CcTooltip
CcDropdown
CcSearchInput
CcEmptyState
CcLoadingState
CcErrorState
CcConfirmDialog
CcModal
CcDrawer
CcSplitPane
CcCodeBlock
CcCollapsible
CcProgressBar
CcTimeline
CcTree
```

### 3.2 设计 token

```css
:root {
  --cc-bg: #f7f4ee;
  --cc-surface: rgba(255,255,255,0.88);
  --cc-surface-solid: #ffffff;
  --cc-surface-muted: #fbf8f2;
  --cc-border: #e8ded1;
  --cc-border-strong: #d7c7b4;
  --cc-text: #243044;
  --cc-text-muted: #7b6f62;
  --cc-text-soft: #9a8f83;
  --cc-brand: #d8c29b;
  --cc-brand-soft: #f1e7d2;
  --cc-navy: #223047;
  --cc-blue: #82afff;
  --cc-green: #63c59b;
  --cc-amber: #f0a54a;
  --cc-red: #e66b6b;
  --cc-purple: #9a8cff;
  --cc-radius-card: 20px;
  --cc-radius-panel: 24px;
  --cc-shadow-soft: 0 10px 30px rgba(36,48,68,0.08);
  --cc-shadow-card: 0 6px 18px rgba(36,48,68,0.06);
}
```

---

## 4. 数据模型总纲

必须从第一天建立真实数据模型，不允许假数据驱动 UI。

```text
WorkspaceRoot
Project
Session
OpenSessionTab
PtySession
StructuredTask
RuntimeEvent
AuditLog
RiskItem
FileChange
GitSnapshot
ResourceItem
AgentState
McpServer
HookConfig
SkillConfig
CanvasLayout
Settings
CapabilitySnapshot
RawLogBundle
DockState
NotificationItem
```

### 4.1 数据流

```text
用户操作
→ GUI 组件
→ Zustand Store / Service
→ Tauri Command
→ Rust backend / PTY / FileSystem / Git / Resource Scanner
→ SQLite / Raw Log
→ RuntimeEvent / AuditLog / RiskItem / FileChange
→ Surface / Inspector / Dock / Console 同步更新
```

禁止：

```text
UI 直接 spawn 进程
UI 直接读写 SQLite
UI 直接操作真实文件删除
UI 绕过 AuditLog
UI 绕过 RiskEngine
UI 使用假状态
```

---

## 5. 分阶段执行路线

### Stage 0：新项目初始化与架构搭建

只搭骨架，不接 Claude Runtime。

### Stage 1：Projects Surface 顶级项目管理体验

重构项目管理区，建立工作文件夹、项目、会话、resume、fork、archive、会话预览、项目详情。

### Stage 2：Workspace / Chat 顶级聊天与终端体验

建立 Workspace：Open Session Tabs + Chat / Terminal / Split View + Inspector + ComposerBar。

### Stage 3：PTY Runtime 与 Claude Code CLI 真连接

实现 portable-pty / ConPTY + xterm.js + raw log + semantic overlay。

### Stage 4：Resources / Settings / Console / Dock / GitHub / Canvas 全面融合

把所有 Surface 接入真实数据链和运行状态。

### Stage 5：真实物理 UI 自动化测试与发布标准

建立 watchdog、安全循环、E2E、截图、回放、回归矩阵。

---

## 6. Claude Code 执行总 Prompt

```text
你现在负责在 G:/Claude Code/ctrl-cc/ 下新建 Ctrl-CC vNext。

这是一个全新重构项目，不要继续在旧项目上堆代码。
目标是保留 Ctrl-CC 原有全层架构、视觉语言和功能要求，但彻底重写底层代码。

最高原则：
1. 新项目路径必须是 G:/Claude Code/ctrl-cc/
2. 不复制旧项目业务代码。
3. 可以参考旧项目视觉 token、组件风格、需求文档和页面设计。
4. 普通 Claude Code 会话最终必须是 PTY-first：portable-pty / ConPTY + xterm.js。
5. Terminal View 必须尽可能等价于在 PowerShell / Windows Terminal 中打开 Claude Code CLI。
6. Chat View 是小白友好的语义增强视图。
7. Projects Surface 和 Workspace Surface 必须分离：
   - Projects 管理工作文件夹、项目、所有会话、resume/fork/archive
   - Workspace 负责当前打开会话的 Chat / Terminal / Split / Inspector
8. 所有功能必须接入真实 store/service/Tauri/SQLite/RuntimeEvent/AuditLog/RiskItem。
9. 禁止假按钮、假状态、假数据。
10. 所有 UI 保持 Ctrl-CC Neo Calm Industrial 视觉语言。
11. 所有危险操作必须确认并写 AuditLog，高风险永不自动通过。

每个阶段执行前：
1. 阅读当前阶段文档。
2. 输出最小实现计划。
3. 小步实现。
4. 运行 npm run typecheck、npm run build、cargo check。
5. 输出修改文件清单、测试结果、问题和下一阶段建议。
6. 不要跳阶段，不要一次性做完所有模块。
```

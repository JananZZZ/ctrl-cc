# Part 3：Workspace / Chat 顶级交互区执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：重构 Chat 功能，使 Ctrl-CC 在应用内部直接内嵌完整原生终端，同时保留小白友好的 Chat View。  
> 核心原则：Terminal View 必须尽可能等价于在 PowerShell / Windows Terminal 中运行 Claude Code CLI；Chat View 是顶级聊天应用体验，类似 QQ / 微信 / Discord / Telegram 的交互自然度。

---

## 1. Workspace Surface 定位

Workspace Surface 只负责当前打开会话的实际工作：

```text
当前打开的会话标签
Chat View
Terminal View
Split View
Structured Task View
当前会话 Inspector
ComposerBar
```

Projects Surface 管理所有项目和会话；Workspace Surface 处理当前会话工作。

---

## 2. 整体布局

```text
WorkspaceSurface
├── OpenSessionTabs
├── CurrentSessionHeader
├── WorkspaceBody
│   ├── ChatTerminalArea
│   │   ├── ChatView
│   │   ├── TerminalView
│   │   ├── SplitView
│   │   └── StructuredTaskView
│   └── SessionInspector
└── ComposerBar
```

视觉布局：

```text
┌────────────────────────────────────────────────────────────┐
│ Open Session Tabs                                          │
├──────────────────────────────────────────────┬─────────────┤
│ Chat / Terminal / Split View                  │ Inspector   │
├──────────────────────────────────────────────┴─────────────┤
│ ComposerBar                                                │
└────────────────────────────────────────────────────────────┘
```

---

## 3. OpenSessionTabs

顶部标签管理所有已打开会话。

每个标签显示：会话名、项目名、状态点、待确认 badge、风险 badge、关闭按钮。

支持：点击切换、关闭、固定、拖拽排序、右键菜单。右键菜单包括 Resume、Pause、Stop、Fork、Archive、Export、Reveal in Projects、Open Raw Log、Close Others、Close All Stopped。

多会话规则：不同项目允许并行；同项目提示风险，建议 Worktree；同文件 FileLock 强提醒。

---

## 4. ChatWorkbench 四种视图

### 4.1 Chat View

面向小白用户，类似顶级聊天软件。

必须具备：左右气泡布局、用户消息右侧、Claude 消息左侧、头像 / 状态点、消息时间、消息分组、连续消息合并、复制按钮、重试按钮、引用回复、折叠长消息、搜索消息、跳转最新、未读/新消息提示。

消息类型：UserBubble、AssistantBubble、SystemNotice、CommandCard、FileChangeCard、DiffCard、PermissionCard、RiskCard、AgentCard、McpCard、HookCard、SummaryCard、ErrorCard、RawEventCollapse。

### 4.2 Terminal View

完整原生终端体验：xterm.js、真实 Claude Code CLI、完整 ANSI、完整键盘、完整 slash command、完整 permission prompt、Ctrl+C、Ctrl+D、Resize、复制粘贴、搜索、Raw Log。Terminal View 是事实来源，不得用 div 模拟终端。

### 4.3 Split View

专业模式。可选左右分屏或上下分屏，支持拖拽调整比例并持久化。

### 4.4 Structured Task View

用于 claude -p、stream-json、JSON schema、批任务、CI 风格任务。

---

## 5. Chat View 顶级聊天体验设计

消息流包含日期分割线、会话状态提示、用户消息、Claude 流式回复、工具调用卡片、文件修改卡片、风险提示、权限确认卡、总结。

用户气泡：右对齐、浅卡其 / 柔和蓝色、圆角 18-22px、最大宽度 72%、支持编辑后重新发送。

Claude 气泡：左对齐、白色 / 低对比卡片、带 Ctrl-CC 猫猫小头像、支持 markdown、代码折叠、复制。

系统提示：居中小胶囊，低对比，例如 Claude Code 已启动、会话已恢复、权限等待中。

工具卡片包括命令卡、文件卡、权限卡、风险卡。每张卡必须可展开、可跳转 Inspector、可复制、可审计。

---

## 6. ComposerBar 输入区

小白模式默认只显示：输入框、发送按钮、+ 文件、模型、权限模式。

专业模式显示：Runtime 模式、模型、effort、permission、@Skill、@Agent、@MCP、/Command、+ File、+ Folder、Tools、Budget、Max turns、Command Preview、Raw Log。

输入交互：Enter 发送、Shift+Enter 换行、@ 打开资源选择、/ 打开命令选择、Ctrl+K 打开全局 Command Center、拖入文件、粘贴图片或文本、历史输入上下切换、草稿保存。

@ 面板显示文件、目录、Skill、Agent、MCP Tool、Hook、CLAUDE.md、最近上下文。

/ 面板显示 /help、/permissions、/agents、/mcp、/compact、/cost、/status、/resume、/clear。PTY 模式下 slash command 插入真实终端，不由 GUI 伪造执行。

---

## 7. Chat 与 Terminal 的关系

ChatComposer 输入：runtimeMode = pty-interactive → pty_write(text + Enter)；runtimeMode = structured-print → claude -p task。

Terminal 中直接输入：xterm.onData → pty_write。

PTY 输出路径：raw bytes → xterm Terminal View → raw log → semantic parser → RuntimeEvent → Chat View 卡片 → Inspector → Audit/Risk。

事实来源：Terminal View 是事实来源；Chat View 是语义增强；Inspector 是诊断与追踪。

---

## 8. SessionInspector

Workspace 中右侧 Inspector 是当前工作会话的实时诊断面板。

Tabs：详情、文件、Git、上下文、权限、风险、审计、Hook、Agent、资源、Raw Log。

Inspector 可折叠。折叠后只显示状态竖条：Details、Files、Risk、Audit、Raw。

---

## 9. 动效设计

新消息 fade + translateY 6px；流式输出平滑追加；工具卡片进入时轻微 scale 0.98 → 1；权限卡 amber 边框柔和 pulse 一次；风险卡 red/amber 静态强调，不持续闪烁；切换视图 120-180ms fade；标签切换保留滚动位置。

---

## 10. 验收标准

```text
[ ] OpenSessionTabs 可切换多个会话
[ ] Chat View 有顶级聊天软件体验
[ ] Terminal View 是真实 xterm 终端
[ ] Split View 可用
[ ] Composer 支持 @ 和 /
[ ] Chat 输入能进入 PTY
[ ] Terminal 输出能生成 RuntimeEvent
[ ] Permission/Risk/File/Command 卡片可见
[ ] Inspector 与当前会话同步
[ ] 视图切换不丢状态
[ ] build/typecheck/cargo check 通过
```

---

## 11. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 3：Workspace / Chat 顶级交互区。

目标：
重构 Workspace 和 Chat，让我们的应用内部直接内嵌完整原生终端，并同时提供小白友好的顶级 Chat View。

要求：
1. Workspace 只负责当前打开会话工作。
2. Projects Surface 负责项目和所有会话管理。
3. 建立 OpenSessionTabs。
4. 建立 Chat View / Terminal View / Split View / Structured Task View。
5. Terminal View 必须用 xterm.js，准备接入真实 PTY。
6. Chat View 必须做到类似 QQ / 微信 / Discord / Telegram 的顶级聊天体验。
7. ComposerBar 支持 @资源、/命令、模型、权限、runtime、文件、Command Preview。
8. Chat View 是语义增强，Terminal View 是事实来源。
9. Inspector 作为当前会话实时诊断面板。
10. 所有 UI 复用 Cc* 组件和 Neo Calm Industrial 风格。

本阶段可以先做前端结构和交互骨架，如果 PTY Runtime 还未实现，Terminal View 显示明确 EmptyState：PTY Runtime 尚未接入。不要用假终端输出伪装。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

输出修改文件清单、构建结果、当前功能完成度和下一步建议。
```

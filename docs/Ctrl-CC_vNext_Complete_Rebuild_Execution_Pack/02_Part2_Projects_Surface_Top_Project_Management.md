# Part 2：Projects Surface 顶级项目管理区执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：把项目管理区设计成顶级项目管理软件风格，承担工作文件夹、项目、会话、resume、fork、archive、项目状态、会话状态和项目级风险管理。  
> 原则：Projects Surface 负责“管理所有项目与所有会话”；Workspace Surface 负责“当前会话实际工作”。

---

## 1. 产品定位

Projects Surface 是 Ctrl-CC 的“项目与会话管理中心”，不是简单项目列表。

它要像顶级项目管理软件一样清晰：

```text
工作文件夹在哪？
有哪些项目？
哪个项目正在运行？
每个项目有哪些会话？
哪些会话可以 resume？
哪些会话已经休眠或归档？
哪个会话有风险？
哪个会话修改了文件？
我能不能从一个旧会话 fork 一个新会话？
我应该进入哪个会话继续工作？
```

---

## 2. 页面整体布局

建议采用四栏可折叠布局：

```text
┌────────────────────┬────────────────────┬──────────────────────────────┬────────────────────┐
│ 工作文件夹 / 项目   │ 会话管理            │ 项目/会话预览主面板            │ 详情信息栏          │
│ Project Rail       │ Session Rail        │ Main Preview Panel            │ Info Drawer        │
└────────────────────┴────────────────────┴──────────────────────────────┴────────────────────┘
```

组件结构：

```text
ProjectsSurface
├── ProjectsTopBar
├── ProjectsLayout
│   ├── ProjectManagementRail
│   ├── SessionManagementRail
│   ├── ProjectSessionMainPanel
│   └── ProjectSessionInfoDrawer
└── ProjectsCommandPalette
```

所有栏都支持折叠：

```text
ProjectManagementRail 可折叠
SessionManagementRail 可折叠
InfoDrawer 可折叠
折叠状态持久化
```

---

## 3. 顶部 TopBar

ProjectsTopBar 包含：

```text
搜索框：搜索项目 / 会话 / 文件 / 风险
新建项目
导入项目
新建会话
继续最近会话
刷新状态
视图切换：列表 / 紧凑 / 分组
筛选：运行中 / 待确认 / 有风险 / 已归档
```

搜索应支持：

```text
项目名
路径
会话标题
会话摘要
Git branch
风险标题
```

---

## 4. 第一栏：ProjectManagementRail

### 4.1 结构

```text
ProjectManagementRail
├── RailHeader
│   ├── 搜索 / 过滤
│   ├── 新建工作文件夹
│   ├── 导入项目
│   └── 扫描按钮
├── WorkspaceFolderTree
│   ├── 工作文件夹 A
│   │   ├── 项目 1
│   │   ├── 项目 2
│   │   └── 项目 3
│   └── 工作文件夹 B
├── SmartProjectGroups
│   ├── 最近打开
│   ├── 收藏项目
│   ├── 正在运行
│   ├── 有待确认
│   ├── 有风险
│   └── 已归档
└── RailFooter
```

### 4.2 项目节点信息

每个项目节点显示：

```text
项目名
路径尾部
Git branch
运行中会话数
休眠会话数
待确认数
风险数
最近活动时间
状态点
```

视觉示例：

```text
● ctrl-cc
  main · 2 running · 1 risk
  G:/Claude Code/ctrl-cc
```

状态颜色：

```text
绿色：正常
蓝色：有运行中会话
黄色：待确认 / 轻风险
红色：高风险
灰色：路径缺失 / 已归档
紫色：Agent 活跃
```

### 4.3 项目右键菜单

```text
打开项目总览
新建 Claude 会话
继续最近会话
打开工作区
在文件管理器中打开
打开 GitHub
刷新 Git 状态
扫描资源
创建 Worktree 会话
收藏 / 取消收藏
归档项目
从列表移除
```

禁止默认提供“删除真实文件夹”。如果必须提供，必须二次确认并明确危险等级。

---

## 5. 第二栏：SessionManagementRail

### 5.1 职责

SessionManagementRail 跟随当前选中项目变化，展示该项目下所有会话。

分组：

```text
工作中 Running
等待输入 Waiting
暂停 Paused
休眠 Sleeping
已完成 Completed
失败 Failed
已归档 Archived
```

### 5.2 会话卡片

每张会话卡显示：

```text
会话标题
状态点
runtime mode：PTY / Structured
模型
permission mode
最后活动时间
token / cost 简要
文件变更数
风险数
审计数
是否可 resume
是否可 fork
```

视觉示例：

```text
🟢 修复 PTY Runtime
Sonnet · PTY · default
12 min ago · 8 files · 1 risk
[Resume] [Fork]
```

### 5.3 会话操作

每个会话支持：

```text
打开到 Workspace
Resume
Fork
Archive
Export Bundle
Open Raw Log
Rename
Pin
Delete Local Record
```

所有操作写 AuditLog。

---

## 6. Resume 会话逻辑

### 6.1 Resume 是什么

Resume 表示尽可能调用 Claude Code CLI 的原生 resume / continue 能力，恢复历史 Claude 会话。

### 6.2 流程

```text
用户点击 Resume
→ 检查项目路径存在
→ 检查 Claude CLI 可用
→ 检查 session.claudeSessionId
→ 检查当前项目是否已有 running session
→ 如有并发风险，弹窗提示
→ 通过 PTY 启动 claude resume / continue 命令
→ 绑定新的 PtySession 到该 Session
→ 状态变为 Running
→ 打开 Workspace
→ 打开对应 OpenSessionTab
→ 写 AuditLog(session_resumed)
```

### 6.3 如果不支持

如果当前 Claude CLI 不支持精确 resume：

```text
显示 disabled reason：
当前 Claude Code CLI 未暴露精确 resume 指定会话能力。
你可以使用 Fork Session 基于摘要创建新会话。
```

不要伪造 resume。

---

## 7. Fork 会话逻辑

### 7.1 Fork 是什么

Fork 是 Ctrl-CC 增强能力。它不等于 Claude 原生 resume，而是基于旧会话摘要创建一个新会话。

### 7.2 Fork 流程

```text
用户点击 Fork
→ 读取旧会话 summary
→ 读取最近 RuntimeEvent
→ 读取 FileChange
→ 读取 unresolved RiskItem
→ 读取相关 ResourceItem
→ 生成 SessionSeed
→ 弹出 ForkSessionDialog
→ 用户选择继承内容
→ 创建新 Session
→ 启动新的 PTY Claude 会话
→ 将摘要作为首条上下文注入
→ 打开 Workspace 新标签
→ 写 AuditLog(session_forked)
```

### 7.3 Fork 模板

```text
这是从历史会话「{sessionTitle}」派生的新会话。

上一会话摘要：
- 目标：
- 已完成：
- 未完成：
- 涉及文件：
- 风险：
- 下一步建议：

请基于这些上下文继续工作。不要假设未列出的文件状态，必要时先读取当前项目。
```

---

## 8. 中间 Main Preview Panel

### 8.1 选中项目时

展示 ProjectOverview：

```text
项目名
路径
Git branch
最近会话
运行中会话
风险
文件变更
资源绑定
Git 状态
快捷操作
```

模块：

```text
ProjectHero
ProjectStatsGrid
RecentSessions
ActiveRisks
GitSummary
ResourceSummary
QuickActions
```

快捷操作：

```text
新建 Claude 会话
继续最近会话
打开 Workspace
打开文件夹
打开 GitHub
创建 Worktree 会话
扫描资源
```

### 8.2 选中会话时

展示 SessionPreview：

```text
会话标题
状态
摘要
最近消息
最近命令
文件变更
风险
审计
按钮：打开工作区 / Resume / Fork / Export / Archive
```

注意：Projects Surface 不做完整 Chat，只做管理与预览。

---

## 9. 右侧 Info Drawer

Tabs：

```text
概览
摘要
文件
Git
风险
审计
资源
原始日志
```

职责：

```text
展示选中项目或会话的管理信息
允许快速跳转 Workspace / Inspector
不做完整实时 Chat
```

---

## 10. 与 Workspace 的连接

用户从 Projects 进入 Workspace 的路径：

```text
双击会话卡
点击打开工作区
点击 Resume 成功
点击 Fork 成功
点击运行中会话
```

进入后：

```text
Workspace Surface 激活
OpenSessionTabs 打开该会话
Chat / Terminal / Inspector 加载该会话
Projects 中该会话显示“已打开”
```

---

## 11. 验收标准

```text
[ ] Projects Surface 四栏布局可用
[ ] ProjectManagementRail 可折叠
[ ] SessionManagementRail 可折叠
[ ] InfoDrawer 可折叠
[ ] 可新建/导入项目
[ ] 可展示项目分组
[ ] 可展示会话分组
[ ] Resume 有真实能力检测和 disabled reason
[ ] Fork 可生成新会话 seed
[ ] 项目/会话预览清晰
[ ] 所有操作写 AuditLog
[ ] 无假项目/假会话伪装
[ ] build/typecheck/cargo check 通过
```

---

## 12. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 2：Projects Surface 顶级项目管理区。

目标：
把项目管理区设计成顶级项目管理软件风格，承担工作文件夹、项目、所有会话、resume、fork、archive、项目状态、会话状态和项目级风险管理。

要求：
1. 不做完整 Chat。
2. Projects 只做项目/会话管理与预览。
3. Workspace 才是实际会话工作区。
4. 建立四栏可折叠布局：Project Rail / Session Rail / Main Preview / Info Drawer。
5. 实现项目节点、会话节点、分组、筛选、搜索、右键菜单。
6. Resume 必须调用真实 Claude CLI 能力或显示 disabled reason，禁止伪造。
7. Fork 是 Ctrl-CC 增强能力，基于旧会话摘要创建新会话。
8. 所有操作写 AuditLog。
9. 所有 UI 复用 Cc* 组件和 Neo Calm Industrial 风格。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

输出修改文件清单、构建结果、当前功能完成度和下一步建议。
```

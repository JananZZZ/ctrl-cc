# Ctrl-CC Surface 设计

## 7 个 Surface

```
1. Console      — 启动页、全局驾驶舱、最近动态、快捷入口
2. Projects     — 工作文件夹、项目、会话、resume/fork/archive、项目状态管理
3. Workspace    — 当前打开会话的 Chat / Terminal / Split / Inspector / ComposerBar
4. Resources    — Skills / Agents / MCP / Hooks / Plugins / CLAUDE.md / Memory / Permissions
5. Canvas       — 高级用户自由编排项目 / 会话 / 风险 / 资源节点
6. GitHub       — 安全 WebView + 当前项目 GitHub repo / PR / Issue 映射
7. Settings     — 首次引导、环境检测、Runtime、外观、安全、诊断
```

## 左侧导航 (LeftSurfaceRail)

- icon-only 模式，56px 宽
- hover 显示 tooltip
- 选中 Surface 使用浅卡其高亮 + 左侧蓝色指示条
- 底部显示 Claude CLI / PTY / AutoTrust / Dock 状态
- Logo (🐱) 点击跳转 Console

## Surface 切换

- 通过 Zustand `surfaceStore.activeSurface` 控制
- `SurfaceHost` 组件根据 activeSurface 渲染对应 Surface
- 切换不销毁非活动 Surface（保持状态）

## Console Surface

- 生活化启动页：欢迎语、日期/时钟/月历、猫猫状态
- 全局驾驶舱：运行中 PTY 会话、待确认权限、高风险事件、今日完成数
- 快捷入口：新建项目、新建 Claude 会话、继续最近会话、Settings 诊断
- 最近动态：最近项目、最近会话、最近审计

## Projects Surface

- 四栏可折叠布局：Project Rail + Session Rail + Main Preview + Info Drawer
- 工作文件夹管理、项目分组（最近/收藏/运行中/风险/归档）
- 会话按状态分组（Running/Waiting/Paused/Sleeping/Completed/Failed/Archived）
- Resume / Fork / Archive / Export 等操作
- 所有操作写 AuditLog

## Workspace Surface

- 只负责当前打开会话的实际工作
- OpenSessionTabs: 多会话标签管理
- Chat View: 左右气泡、Markdown、工具/文件/权限/风险卡片
- Terminal View: xterm.js 原生终端 = 真实 Claude Code CLI
- Split View: Chat + Terminal 并排
- ComposerBar: @资源、/命令、模型、权限
- SessionInspector: 详情/文件/Git/上下文/权限/风险/审计/Hook/Agent/资源/Raw Log

## Resources Surface

- 管理 Skills / Agents / MCP / Hooks / Plugins / CLAUDE.md / Memory / Slash Commands / Permission Rules / Output Styles
- 每个资源显示：来源、作用域、路径、启用状态、风险等级、影响项目
- @ResourcePalette 插入资源引用到 ChatComposer

## Canvas Surface

- 高级用户模式，拖拽式节点图
- 节点: ProjectNode, SessionNode, PtySessionNode, FileChangeNode, RiskNode, AuditNode, ResourceNode, GitHubNode, AgentNode
- 只做可视化和导航跳转，不自动执行工作流

## GitHub Surface

- 安全 WebView，从当前 Project git remote 打开 repo
- 不读取 token/cookie，不记录敏感 URL
- 支持打开 Issues、Pull Requests、Actions

## Settings Surface

- 分类: 通用、外观、Claude Code、PTY Runtime、Chat、Projects、Resources、安全/AutoTrust
- 环境健康检测: Windows、WebView2、Git、Claude CLI、Claude auth、ConPTY、portable-pty、xterm
- 首次引导: 10 步向导

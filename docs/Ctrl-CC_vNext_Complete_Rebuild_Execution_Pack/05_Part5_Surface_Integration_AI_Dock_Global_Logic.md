# Part 5：七大 Surface 融合、AI 工作坞与全局操作逻辑执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：在 Projects、Workspace、PTY Runtime 打通之后，全面收口 Console、Resources、Canvas、GitHub、Settings、AI 工作坞，让所有 Surface 协同工作。

---

## 1. 全局协同原则

所有 Surface 不应是孤岛。

```text
Console → 快速进入 Projects / Workspace / Settings
Projects → 管理项目和会话 → 打开 Workspace
Workspace → 当前会话工作 → 跳转 Projects / Resources / GitHub
Resources → 管理 Claude 资源 → 被 ChatComposer / CommandCenter 调用
Canvas → 可视化项目 / 会话 / 风险 / 资源 → 跳转对应 Surface
GitHub → 当前项目仓库映射 → 来自 Projects / Inspector
Settings → 配置 Runtime / Appearance / Safety / Resources
AI Dock → 全局状态入口 → 跳转任意 Surface
```

---

## 2. Console Surface

功能：欢迎语、日期 / 时钟 / 月历、猫猫状态、运行中会话、待确认权限、高风险、最近项目、最近会话、最近审计、快捷入口。

快捷入口：新建项目、导入项目、新建 Claude 会话、继续最近会话、打开环境诊断、打开 Resources。

---

## 3. Resources Surface

管理 Skills、Agents、MCP、Hooks、Plugins、CLAUDE.md、Memory、Slash Commands、Permission Rules、Output Styles。

每个资源必须显示来源、作用域、路径、启用状态、风险等级、影响项目、最近修改。

资源与 Chat 的连接：ChatComposer @Skill、@Agent、@MCP；CommandCenter /agents、/mcp；Inspector Resources Tab。

---

## 4. Settings Surface

分类：通用、外观、Claude Code、PTY Runtime、Chat、Projects、Resources、AI 工作坞、安全 / AutoTrust、GitHub、Canvas、诊断。

必须支持环境检测：Windows、WebView2、Git、Claude Code CLI、Claude auth、ConPTY、portable-pty、xterm、默认工作目录、资源路径。

---

## 5. GitHub Surface

第一版只做安全 WebView 和项目映射：从当前 Project git remote 打开 GitHub repo、打开 Issues、打开 Pull Requests、打开 Actions、外部浏览器打开、不读取 token/cookie、不记录敏感 URL。

---

## 6. Canvas Surface

高级用户模式。节点：ProjectNode、SessionNode、PtySessionNode、FileChangeNode、RiskNode、AuditNode、ResourceNode、GitHubNode、AgentNode。只做可视化与跳转，不自动执行工作流。

---

## 7. AI 工作坞重构

### 7.1 定位

AI 工作坞是固定贴附在电脑屏幕最右侧中间的常驻工作状态控制器，不属于主窗口内部。

必须可折叠、可展开、可隐藏、可从托盘恢复、贴附屏幕右侧中间、不遮挡太多视野、显示多项目多会话状态、处理待确认、提醒风险、快速跳转主应用。

### 7.2 三种模式

Quiet 安静模式：极窄条，Logo、running dot、waiting dot、risk dot，hover 展开 mini popover。

Calm 舒缓模式：默认推荐，当前重点会话、待确认事项、风险摘要、最近完成、打开主窗口。

Focus 聚焦模式：运行中会话列表、待确认队列、风险队列、Agent 状态、Token/Cost、快捷操作。

### 7.3 工作坞操作

打开会话、跳转 Workspace、跳转 Inspector Permission、跳转 Risk、发送 Ctrl+C、停止会话、暂停 AutoTrust、导出日志。高风险操作必须二次确认。

### 7.4 状态灯

绿色 steady：正常；绿色 pulse：运行中；黄色 pulse：待确认；红色 pulse：高风险；蓝色 pulse：AutoTrust；灰色 steady：空闲。动画必须克制，不要持续强闪烁。

---

## 8. 全局 Command Center

Ctrl+K 打开。命令来源：Surface navigation、Project actions、Session actions、Runtime actions、Resources actions、Settings actions、Dock actions。

命令示例：新建项目、新建 Claude 会话、打开当前会话、Resume 会话、Fork 会话、停止会话、打开资源区、打开 Settings Runtime、打开 GitHub Repo、显示 AI 工作坞、导出 Session Bundle。

---

## 9. 通知系统

通知类型：会话完成、等待权限、高风险、Claude CLI 错误、PTY 崩溃、资源异常、Git 冲突、工作坞状态。

通知渠道：主窗口 Toast、AI 工作坞、系统右下角通知、Console 最近动态、AuditLog。

---

## 10. 验收标准

```text
[ ] Console 读取真实项目/会话/风险/审计
[ ] Resources 可管理真实资源
[ ] Settings 可检测环境
[ ] GitHub 可从项目打开 repo
[ ] Canvas 可展示真实节点
[ ] AI 工作坞贴附屏幕右侧中间
[ ] AI 工作坞 Quiet/Calm/Focus 可切换
[ ] Command Center 可用
[ ] 通知系统可用
[ ] 所有跳转准确
[ ] 所有危险操作审计
[ ] build/typecheck/cargo check 通过
```

---

## 11. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 5：七大 Surface 融合、AI 工作坞与全局操作逻辑。

目标：
让 Console、Projects、Workspace、Resources、Canvas、GitHub、Settings、AI 工作坞全部协同工作，而不是孤立页面。

要求：
1. Console 是生活化启动页和全局驾驶舱。
2. Resources 管理 Skills / Agents / MCP / Hooks / Plugins / CLAUDE.md / Memory。
3. Settings 管理环境检测、PTY Runtime、Chat、Projects、Resources、安全、工作坞。
4. GitHub 只做安全 WebView 和项目 repo 映射。
5. Canvas 只做可视化节点和跳转，不自动执行 workflow。
6. AI 工作坞固定贴附屏幕右侧中间，支持 Quiet / Calm / Focus。
7. 所有 Surface 通过真实 store / service / Tauri / SQLite 联动。
8. 所有危险操作写 AuditLog。
9. 所有 UI 保持 Neo Calm Industrial 视觉语言。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

输出修改文件清单、构建结果、功能完成度和下一步建议。
```

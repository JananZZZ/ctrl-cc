# Part 6：真实物理操作测试与发布验收执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：建立受控、安全、不会拖死电脑的真实 UI 自动化测试闭环，验证 Ctrl-CC vNext 的全功能真实可用。

---

## 1. 测试目标

必须模拟真实用户操作，而不是只跑单元测试。

主链路：启动软件 → 环境检测 → 新建项目 → 新建 PTY Claude 会话 → Terminal 显示 Claude CLI → Chat 输入 → Claude 响应 → Inspector 监控 → AuditLog 记录 → RiskItem 记录 → 停止会话 → 清理进程 → 导出报告。

---

## 2. 工具链

```text
Tauri WebDriver + WebdriverIO：测试 WebView 内部 UI
Appium / WinAppDriver：测试主窗口、系统托盘、AI 工作坞
xterm 测试钩子：测试终端输入输出
PowerShell Watchdog：进程、CPU、内存保护
Screenshot / Video：测试证据
```

---

## 3. 安全护栏

必须先创建：

```text
scripts/e2e/preflight.ps1
scripts/e2e/process-watchdog.ps1
scripts/e2e/cleanup-ctrlcc-processes.ps1
scripts/e2e/run-e2e-safe.ps1
tests/e2e/README.md
```

Watchdog 限制：最多 1 个 Ctrl-CC，最多 1 个 Claude PTY session，claude 进程数 <= 2，cmd + powershell + bash <= 6，git 进程数 <= 4，单轮测试 <= 10 分钟，CPU 连续 60 秒不得 > 85%，可用内存不得 < 1.5GB。

触发后：截图，写 watchdog-failure.json，清理测试进程，停止循环。

---

## 4. data-testid

必须为关键组件补齐：app-shell、surface-console、surface-projects、surface-workspace、surface-resources、surface-canvas、surface-github、surface-settings、projects-surface、project-management-rail、session-management-rail、project-session-main-panel、project-session-info-drawer、create-project-button、import-project-button、create-session-button、project-node、session-node、session-resume-button、session-fork-button、workspace-surface、open-session-tabs、chat-view-tab、terminal-view-tab、split-view-tab、chat-composer-input、chat-send-button、terminal-panel、terminal-xterm-root、runtime-status-badge、stop-session-button、export-session-button、inspector-panel、inspector-tab-details、inspector-tab-files、inspector-tab-risk、inspector-tab-audit、inspector-tab-raw-log、floating-dock、dock-mode-quiet、dock-mode-calm、dock-mode-focus。

---

## 5. P0 测试

P0-001 启动与环境检测：启动 Ctrl-CC，等待 app-shell，进入 Settings，运行环境检测，验证 Claude / Git / WebView2 / PTY 状态，截图。

P0-002 新建项目：进入 Projects，点击新建项目，在 sandbox workspace 创建 ctrlcc-e2e-demo，验证 project-node、真实目录、AuditLog。

P0-003 新建 PTY 会话：选中项目，点击新建会话，选择 pty-interactive，启动，切 Workspace，打开 Terminal View，验证 terminal-xterm-root 和 Claude CLI 输出。

P0-004 Chat 输入进入 PTY：切 Split View，输入“请查看当前目录，只输出一句话说明当前目录里有什么，不要修改任何文件。”，点击发送，验证 Terminal 输出、Chat View 语义卡片、AuditLog。

P0-005 停止与清理：点击 stop-session-button，验证状态 stopped，导出 session bundle，关闭 App，执行 cleanup，验证无残留测试进程。

---

## 6. P1 测试

文件写入权限测试、风险拦截测试、多会话并发保护测试、Resume 会话测试、Fork 会话测试、AI 工作坞状态测试、Resources @Skill/@Agent/@MCP 测试。

---

## 7. 多轮循环

限制：maxIterations = 5，每轮最多 10 分钟，连续 3 次同类失败停止，每轮结束必须 cleanup，watchdog 触发立即停止。

每轮：preflight → run P0 → 收集截图 / 日志 / raw log / db snapshot / process snapshot → 分析失败 → 只修 P0 → 下一轮 → P0 全过后跑 P1 → 输出 final report。

---

## 8. 输出报告

每轮：`test-results/e2e-runs/<timestamp>/iteration-report.md`。

最终：`test-results/e2e-runs/final-e2e-report.md`。

内容包括总体结论、P0/P1/P2 通过情况、Chat / Terminal / Projects / Inspector / Dock 覆盖情况、进程泄漏检查、已修复问题、未解决阻塞、下一步建议。

---

## 9. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 6：真实物理操作测试与发布验收。

目标：
建立受控、安全、不会拖死电脑的真实 UI 自动化测试闭环。

第一步只做测试基建，不要立刻跑完整大循环：
1. 创建 scripts/e2e/preflight.ps1
2. 创建 scripts/e2e/process-watchdog.ps1
3. 创建 scripts/e2e/cleanup-ctrlcc-processes.ps1
4. 创建 scripts/e2e/run-e2e-safe.ps1
5. 创建 tests/e2e/README.md
6. 补齐关键 data-testid
7. 创建 docs/e2e-physical-ui-test-plan.md
8. 不要修改业务功能，除非只是 harmless data-testid

完成后停止，等待我确认，再进入 P0 自动化测试实现。
```

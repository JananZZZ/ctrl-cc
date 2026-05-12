# Ctrl-CC Stability-First Supreme Architecture 6.0：商业级稳定性、丝滑体验与全链路可观测方案

> 目标：Ctrl-CC 不仅功能强，而且像成熟商业软件一样稳定、丝滑、可诊断、可恢复。  
> 本方案不是“临时绕过 bug”，而是将 Ctrl-CC 的底层工程架构升级为 **Stability-First Runtime Platform**。

---

## 0. 先回答核心问题：为什么现在这么脆弱？

现在 Ctrl-CC 脆弱，不是因为 Tauri / React / Claude CLI 天生不稳定，而是因为当前架构缺少商业软件最基础的几层保护：

```text
1. 没有统一 Runtime 内核
   Projects / Workspace / Chat / Console / Dock / Resources 可能各自操作 PTY/Claude。

2. 没有强约束状态机
   会话状态、PTY 状态、Claude 状态、Workspace 状态混在一起，失败后不知道退到哪里。

3. UI 线程承担了太多重任务
   启动 PTY、等待 Claude、处理日志、渲染事件、跳转页面可能连在一个同步链路里。

4. 输出流没有背压
   PTY raw output、ErrorLog、React store 如果无限增长，WebView 会被拖死。

5. React 副作用没有治理
   useEffect / store action / navigation / interval 互相触发，导致 React #185 无限更新。

6. 缺少进程隔离和 watchdog
   cmd / conhost / claude 出错时，主程序没有可靠隔离、超时、kill、恢复机制。

7. 缺少分级错误处理
   商业软件不会“一错全崩”，而是某个功能失败、某个面板降级、某个任务重试。

8. 缺少可观测性
   没有 traceId、sessionId、文件日志、diagnostic bundle、性能采样、错误分类，所以一出问题只能靠截图猜。

9. 没有 feature flag 和 circuit breaker
   某个模块坏了，不能快速熔断，只能拖垮整个应用。

10. 没有性能预算
   事件数、日志量、渲染频率、WebView 实例数、store 更新频率都没有上限。
```

成熟商业软件强，不是因为它们没有 bug，而是因为它们有：

```text
隔离
限流
降级
恢复
日志
诊断
状态机
监控
自动清理
错误边界
```

Ctrl-CC 也必须具备这些。

---

## 1. 最终架构目标

Ctrl-CC 必须升级为：

```text
Stability-First Desktop Runtime Platform
├── App Shell Layer
├── RuntimeKernel Layer
├── Interaction Plane
├── Structured Plane
├── Telemetry Plane
├── Governance Plane
├── Observability Plane
├── Performance Plane
└── Recovery Plane
```

### 1.1 App Shell Layer

负责：

```text
窗口
路由
主题
布局
ErrorBoundary
Suspense
全局空状态
全局通知
```

禁止：

```text
启动 Claude
直接操作 PTY
等待子进程
处理 raw output
```

### 1.2 RuntimeKernel Layer

唯一 Runtime 内核。

负责：

```text
Claude discovery
shell strategy
PTY lifecycle
session registry
process registry
structured task
runtime diagnostics
watchdog
orphan cleanup
```

### 1.3 Interaction Plane

负责真实交互：

```text
Claude Code CLI interactive PTY
xterm rendering
keyboard input
ChatComposer write
Ctrl+C
Stop
Resize
raw log
```

### 1.4 Structured Plane

负责非交互任务：

```text
claude -p
stream-json
batch task
diagnostic query
structured reports
```

### 1.5 Telemetry Plane

负责 200% 可视化：

```text
statusLine
hooks
transcript
git watcher
file watcher
process watcher
runtime events
semantic cards
```

### 1.6 Governance Plane

负责 500% 管理：

```text
permission
risk
audit
policy
auto-trust
replay
session bundle
resource activation
```

### 1.7 Observability Plane

负责所有问题追踪：

```text
traceId
span
event log
file log
diagnostic bundle
React error
Rust panic
PTY error
performance sample
```

### 1.8 Performance Plane

负责丝滑：

```text
event coalescing
throttle
debounce
virtual list
bounded store
worker offload
idle scheduling
progressive rendering
```

### 1.9 Recovery Plane

负责不闪退：

```text
ErrorBoundary
feature flag
circuit breaker
module degrade
restart session
kill orphan
restore workspace
safe mode
```

---

## 2. 核心设计原则

## 2.1 UI 永远不等待 Runtime 成功

点击“新建会话”必须：

```text
立即创建 RuntimeSession
立即打开 Workspace tab
立即显示 Starting 状态
后台启动 PTY / Claude
成功或失败都显示在当前 tab
```

禁止：

```text
点击新建会话
await Claude ready
然后再跳 Workspace
```

## 2.2 所有页面只能调用 RuntimeBridge

禁止任何页面直接：

```text
invoke("pty_start_claude")
invoke("pty_v2_write")
invoke("pty_write")
invoke("structured_run")
```

只允许：

```text
RuntimeBridge.startInteractiveSession()
RuntimeBridge.write()
RuntimeBridge.ctrlC()
RuntimeBridge.stop()
RuntimeBridge.resize()
RuntimeBridge.runStructuredTask()
```

## 2.3 PTY raw output 只能走 raw plane

允许：

```text
xterm.write(chunk)
raw log file
bounded tail buffer
```

禁止：

```text
ErrorLog 全量显示
ChatBlockRenderer 直接渲染 raw chunk
React store 无限保存
```

## 2.4 所有 store action 必须幂等

同样的输入不能产生新的 state object。

```ts
setMode: (next) =>
  set((state) => {
    if (state.mode === next) return state;
    return { mode: next };
  });
```

## 2.5 所有事件必须有边界

```text
RuntimeEvent max 200
ErrorLog max 200
PTY tail max 32 KB / session
Raw log 写文件
Snapshot interval >= 1000 ms
Resize debounce >= 100 ms
Search debounce >= 150 ms
```

## 2.6 所有长任务必须离开 UI 热路径

长任务包括：

```text
PTY spawn
reader loop
child wait
file scan
resource scan
git status
MCP check
large markdown parse
diagnostic bundle
```

这些不能阻塞 UI render。

---

## 3. 商业级稳定性为什么强？

成熟商业软件一般有以下机制：

```text
1. 主 UI 线程只做渲染和交互。
2. 所有 I/O、子进程、网络、扫描、解析都在后台线程或独立 worker。
3. 所有事件进入 bounded queue。
4. 所有模块都有 error boundary。
5. 所有功能都有 timeout。
6. 所有失败都有 fallback。
7. 所有状态都有明确 finite-state machine。
8. 所有用户操作都有 optimistic UI。
9. 所有崩溃都能生成 diagnostic bundle。
10. 所有高风险功能都有 feature flag 和 circuit breaker。
```

Ctrl-CC 现在必须把这些机制补齐。

---

## 4. RuntimeKernel 6.0

### 4.1 Runtime Session 状态机

```ts
export type RuntimeSessionStatus =
  | "created"
  | "workspace-opened"
  | "discovering"
  | "shell-testing"
  | "pty-starting"
  | "pty-ready"
  | "claude-launching"
  | "claude-active"
  | "waiting-permission"
  | "idle"
  | "failed"
  | "exited"
  | "killed";
```

所有状态只能按允许的边转移：

```text
created -> workspace-opened
workspace-opened -> discovering
discovering -> shell-testing | failed
shell-testing -> pty-starting | failed
pty-starting -> pty-ready | failed
pty-ready -> claude-launching
claude-launching -> claude-active | failed
claude-active -> idle | waiting-permission | exited | failed
```

非法转移必须记录：

```text
runtime.state.invalid_transition
```

### 4.2 RuntimeBridge API

```ts
export const RuntimeBridge = {
  startInteractiveSession,
  write,
  ctrlC,
  ctrlD,
  resize,
  stop,
  restart,
  runStructuredTask,
  openWorkspace,
  getSession,
  getDiagnostics,
};
```

### 4.3 RuntimeKernel 后台启动流程

```text
RuntimeBridge.startInteractiveSession
├── create session record
├── open Workspace tab
├── navigate Workspace
└── queueMicrotask RuntimeKernel.startBackground

RuntimeKernel.startBackground
├── discoverClaude
├── test shell strategies
├── test claude --version
├── start PTY with selected strategy
├── write launch command
├── monitor first output
└── update status / error
```

---

## 5. Windows Shell Strategy

不能再单押 `cmd.exe`。

### 5.1 Strategy Matrix

```text
A. Direct exe
B. PowerShell + claude.ps1
C. cmd.exe + claude.cmd
D. pwsh
E. node package entry
F. user override
```

### 5.2 Discovery

```text
1. user configured path
2. where claude
3. where claude.cmd
4. where claude.ps1
5. npm prefix -g
6. PATH scan
```

### 5.3 Smoke Test

每个 strategy 必须通过：

```text
shell echo
claude --version
PTY echo
```

不通过就不可用。

### 5.4 失败显示

用户看到的不是：

```text
创建失败
```

而是：

```text
Claude Runtime 不可用

Shell strategy:
- cmd.exe: failed, 0xc0000142
- powershell.exe: ok
- claude.ps1: not found
- claude.cmd: found but cmd failed

建议：
1. 修复 cmd.exe 环境
2. 安装 claude PowerShell shim
3. 在 Settings 指定 Claude executable
```

---

## 6. React 稳定性治理

### 6.1 ErrorBoundary 分层

```text
AppErrorBoundary
SurfaceErrorBoundary
PanelErrorBoundary
WidgetErrorBoundary
```

某个 panel 崩溃，不允许拖垮整个应用。

### 6.2 RenderLoopGuard

在开发版和 debug 版启用：

```text
1 秒内 render 超过 60 次，记录 component。
超过 80 次，抛出可读错误。
```

### 6.3 useEffect 审计规则

每个 `useEffect` 必须满足：

```text
1. 有稳定 dependency。
2. 有 cleanup。
3. 不会修改自身 dependency。
4. 不会无限 navigate。
5. 不会无限 set store。
```

### 6.4 Store selector 规则

禁止：

```ts
useStore((s) => ({ a: s.a, b: s.b }))
```

除非 shallow。

### 6.5 Store action 规则

所有 action 必须：

```text
幂等
小粒度
不做 I/O
不做 navigate
不启动 Runtime
```

---

## 7. WebView2 / Tauri 性能治理

### 7.1 WebView 数量

只保留必要 WebView。AI Dock 可以独立窗口，但不要反复创建销毁。

### 7.2 Startup

```text
1. 启动先显示轻量 shell。
2. 再加载重组件。
3. Runtime diagnostics 懒加载。
4. xterm 懒加载。
5. Resources 大扫描延迟执行。
```

### 7.3 Event Bridge

Tauri event listen 必须 unlisten。

```ts
useEffect(() => {
  let dispose: undefined | (() => void);
  listen("runtime:event", handler).then((fn) => (dispose = fn));
  return () => dispose?.();
}, []);
```

### 7.4 invoke 防抖

高频 invoke：

```text
resize
status polling
git scan
file scan
```

必须 debounce/throttle。

---

## 8. 可观测性系统

### 8.1 TraceId

每个用户操作生成一个 trace：

```ts
const traceId = createTraceId("new-session");
```

贯穿：

```text
button click
RuntimeBridge
Tauri command
PTY spawn
Claude launch
Workspace update
ErrorLog
AuditLog
```

### 8.2 Event schema

```ts
export interface AppEvent {
  id: string;
  traceId: string;
  ts: string;
  source: "ui" | "runtime" | "pty" | "diagnostics" | "resources" | "dock";
  type: string;
  level: "debug" | "info" | "warning" | "error";
  message: string;
  payload?: unknown;
}
```

### 8.3 Diagnostic Bundle

一键复制：

```text
app version
OS
WebView2 version
React last error
route
runtime sessions
shell strategy matrix
claude discovery
last 200 events
last 32KB pty tail
debug log path
orphan processes
settings snapshot
```

### 8.4 Health Center

新增：

```text
Diagnostics -> Health Center
```

分区：

```text
React
WebView2
Tauri IPC
Runtime
PTY
Claude
Shell
Git
Resources
MCP
Hooks
Performance
```

每个模块：

```text
Ready / Warning / Error / Unavailable
原因
修复建议
测试按钮
复制诊断
```

---

## 9. 丝滑体验架构

### 9.1 操作即时反馈

所有按钮点击后 100ms 内必须反馈：

```text
loading
toast
skeleton
workspace tab
status chip
```

### 9.2 Heavy component lazy load

```ts
const TerminalPane = lazy(() => import("./TerminalPane"));
const ResourcesGraphView = lazy(() => import("./ResourcesGraphView"));
```

### 9.3 Virtualization

大量列表必须虚拟化：

```text
Projects list
Sessions list
Resources list
ErrorLog
AuditLog
```

### 9.4 Coalescing

事件合并：

```text
100 个 pty output chunk -> xterm 直接写
Runtime tail 100ms 合并一次
UI event log 1s 合并摘要
```

### 9.5 Background tasks

```text
resource scan
git scan
diagnostics
markdown parse
large file preview
```

进入 background queue。

---

## 10. Recovery / 不闪退体系

### 10.1 Safe Mode

如果 App 连续 2 次启动失败：

```text
自动进入 Safe Mode
- 禁用 PTY autostart
- 禁用 Dock publisher
- 禁用 Console live interval
- 禁用 Resources auto scan
- 显示 Diagnostics
```

### 10.2 Circuit Breaker

某模块短时间内错误超过阈值：

```text
暂停模块
显示降级
提供重试
不拖垮全局
```

示例：

```text
PTY 30 秒内失败 3 次 -> Runtime circuit open
Resources scan 失败 -> Resources degraded
Dock event loop 异常 -> Dock publisher disabled
```

### 10.3 Watchdog

Rust 端 watchdog：

```text
child process timeout
no output timeout
orphan detection
zombie cleanup
heartbeat
```

前端 watchdog：

```text
render loop
event flood
store update flood
long task
unhandled promise rejection
```

---

## 11. 页面级升级

## 11.1 Projects

```text
新建会话：立即跳 Workspace
失败：显示在 session card 和 Workspace tab
状态：真实 RuntimeSession 派生
```

## 11.2 Workspace

```text
Terminal raw
Chat semantic
Monitor diagnostics
Composer same PTY
```

## 11.3 Console

```text
只读 RuntimeStore
不直接启动进程
显示健康状态
```

## 11.4 AI Dock

```text
轻量遥控器
不能直接 invoke
只能 RuntimeBridge action
```

## 11.5 Resources

```text
ResourceActivationBridge
不运行 Claude
只插入 Chat 或配置项目
```

## 11.6 Diagnostics

```text
所有系统问题的入口
所有错误必须可复制
```

---

## 12. 工程质量门禁

### 12.1 Typecheck

```bash
npm run typecheck
```

### 12.2 Build

```bash
npm run build
```

### 12.3 Rust

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

### 12.4 E2E Smoke

```text
App launch
React no #185
Runtime diagnostics
Shell strategy
claude --version
new session
chat send
ctrl+c
stop
orphan cleanup
```

### 12.5 Performance Budget

```text
App initial interactive < 2s
Navigation response < 100ms
Button feedback < 100ms
Workspace tab open < 1s
ErrorLog render < 16ms typical
No list render > 500 DOM rows without virtualization
```

---

## 13. 给 Claude CLI 的执行 Prompt

```text
执行 Ctrl-CC Stability-First Supreme Architecture 6.0。

目标：
把 Ctrl-CC 从脆弱原型升级为商业级稳定软件。不是临时修 bug，而是建立稳定性优先的最终架构。

必须实现：
1. 唯一 RuntimeBridge / RuntimeKernel。
2. 所有页面禁止直接 invoke PTY。
3. RuntimeSession 严格状态机。
4. Windows Shell Strategy Matrix：cmd / powershell / pwsh / user override。
5. Runtime Diagnostics / Health Center。
6. React #185 根治：ErrorBoundary、RenderLoopGuard、idempotent store、useEffect 审计。
7. PTY raw output 只进 xterm/raw log/bounded tail。
8. ErrorLog max 200，不吃 raw pty。
9. WebView/Tauri event listen 必须 unlisten。
10. Resize / scan / log / snapshot 全部 debounce/throttle。
11. Safe Mode / Circuit Breaker / Watchdog。
12. Diagnostic Bundle 一键复制。
13. Projects 新建会话 1 秒内跳 Workspace。
14. ChatComposer 写同一个 PTY。
15. Console / Dock / Resources 全部通过 RuntimeBridge 联动。

执行顺序：
1. 审计所有直接 invoke PTY 的调用点。
2. 建立 RuntimeBridge / RuntimeKernel。
3. 修 React #185。
4. 建立 Diagnostics Health Center。
5. 接 Workspace / Chat。
6. 接 Projects。
7. 接 Console / Dock / Resources。
8. 接 Telemetry statusLine/hooks。
9. 接 Governance risk/audit/recovery。
10. 执行 typecheck/build/cargo check/E2E smoke。

交付：
- 修改文件清单
- 新架构图
- RuntimeBridge API 清单
- 直接 invoke PTY 的清理结果
- React #185 修复点
- Shell strategy matrix 测试结果
- Diagnostic bundle 示例
- E2E 测试结果
```

---

## 14. 不通过则不算完成

```text
[ ] App 不出现 React #185。
[ ] UI 操作不卡死。
[ ] 新建会话 1 秒内打开 Workspace。
[ ] Terminal 显示真实 Claude Code CLI。
[ ] ChatComposer 输入进入同一个 PTY。
[ ] Stop 后无残留 child process。
[ ] ErrorLog 不渲染 raw PTY。
[ ] Diagnostics 能解释错误原因。
[ ] 任何模块失败不拖垮整个 App。
[ ] Console / Dock / Resources 与 RuntimeBridge 同源。
```

# Ctrl-CC 下一步可执行修复 Plan：从“能进 Chat”到“后端真实创建 Claude 会话”

## 0. 截图结论

当前已经有明显进展：React #185 已解决，Workspace/Chat 能进入，说明前端页面和跳转链路已经基本打通。

但后端会话没有真正创建成功。截图显示了三个核心错误：

```text
cmd.exe - 应用程序错误 0xc0000142
发送失败: Process error: claude spawn failed: program not found
发送失败: Session not found: ses-1778555590011
```

这说明当前链路是：

```text
前端创建 UI session
-> Workspace tab 成功打开
-> 后端尝试启动 PTY / Claude
-> cmd.exe 或 claude 启动失败
-> 后端 sessions registry 没有真实 writer
-> ChatComposer 仍然允许发送
-> 写入 ses-xxx 时后端找不到 session
-> UI 把“你好”显示成 bubble，但实际没有进入 Claude
```

当前最重要的问题不是 UI，而是：

```text
1. Claude discovery 没做好。
2. Windows shell strategy 没做好。
3. UI session id 和后端 PTY session id 没统一。
4. Composer 在 session 未 ready 时仍允许发送。
5. ErrorLog 没接入 RuntimeEventStore。
```

---

## 1. 当前必须修的五个点

### 1.1 cmd.exe 0xc0000142

不能再单押 cmd.exe。需要 shell strategy matrix：

```text
powershell.exe
pwsh.exe
cmd.exe
direct executable
user configured override
```

每个 strategy 都必须先测试：

```text
shell echo
claude --version
PTY echo
```

### 1.2 claude spawn failed: program not found

Windows 上 `claude` 通常可能是 npm shim：

```text
claude.cmd
claude.ps1
```

不能直接 spawn `"claude"`。必须先 discovery：

```text
where claude
where claude.cmd
where claude.ps1
powershell Get-Command claude
npm prefix -g
%APPDATA%\npm
```

### 1.3 Session not found

必须区分：

```ts
type UiSessionId = string;   // ses-xxx，前端 RuntimeSession / Workspace / Chat 使用
type PtySessionId = string;  // pty-xxx，后端 PTY registry 使用
```

RuntimeSession 必须包含：

```ts
{
  id: UiSessionId,
  ptySessionId: PtySessionId | null
}
```

ChatComposer 只能调用：

```ts
RuntimeBridge.write(uiSessionId, text)
```

RuntimeBridge 内部查 `ptySessionId`，再调用后端 write。  
不要让 ChatComposer 直接把 `ses-xxx` 发给后端 PTY write，除非后端 registry 也用 `ses-xxx` 作为 key。

### 1.4 Composer 未 ready 仍发送

以下状态必须禁用输入：

```text
created
workspace-opened
discovering
discovery-failed
pty-starting
failed
exited
killed
```

可发送状态：

```text
pty-ready
claude-launching
claude-active
idle
waiting-permission
```

### 1.5 ErrorLog 显示 0

顶部已经有错误，但右侧 ErrorLog=0，说明错误没有统一进入 RuntimeEventStore。

所有错误必须进入：

```text
RuntimeEventStore
Session timeline
ErrorLog
```

包括：

```text
spawn failed
program not found
session not found
send failed
cwd invalid
shell strategy failed
```

---

## 2. 这次的正确目标链路

```text
New Session
  -> create RuntimeSession
  -> open Workspace tab
  -> runtime_discover_claude
  -> choose shell strategy
  -> start PTY
  -> register backend writer
  -> emit pty-ready
  -> launch Claude interactive
  -> status claude-active
  -> enable ChatComposer
  -> send "你好" writes same PTY
```

---

## 3. 后端必须实现 runtime_discover_claude

返回结构建议：

```ts
interface RuntimeDiscovery {
  shellStrategies: Array<{
    id: string;
    shell: "powershell" | "pwsh" | "cmd" | "direct";
    shellPath: string;
    shellEchoOk: boolean;
    error?: string;
  }>;

  claudeCandidates: Array<{
    path: string;
    kind: "exe" | "cmd" | "ps1" | "js" | "unknown";
    runnableBy: string[];
    versionOk: boolean;
    versionText?: string;
    error?: string;
  }>;

  selected?: {
    shellStrategyId: string;
    claudePath: string;
    launchCommand: string;
  };
}
```

Windows 检测命令：

```cmd
where claude
where claude.cmd
where claude.ps1
npm prefix -g
```

PowerShell 检测：

```powershell
Get-Command claude -ErrorAction SilentlyContinue
claude --version
```

---

## 4. 后端 PTY 注册规则

只有这些全部成功后，才能宣称会话 ready：

```text
openpty ok
spawn selected shell ok
writer acquired
reader thread started
sessions map insert ok
```

失败时必须：

```text
return Err
emit runtime.error
patch session status failed
不要 emit pty-process-created
不要启用 ChatComposer
```

后端 sessions map 的 key 必须是 `ptySessionId`。

---

## 5. Chat 发送逻辑必须改

当前错误：消息已经显示，但发送失败。

改成：

```ts
type ChatMessageStatus = "sending" | "sent" | "failed";
```

流程：

```ts
const msg = addMessage({ content, status: "sending" });

try {
  await RuntimeBridge.write(sessionId, content + "\r");
  patchMessage(msg.id, { status: "sent" });
} catch (e) {
  patchMessage(msg.id, { status: "failed", error: String(e) });
  runtimeStore.addEvent({
    type: "composer.send.failed",
    level: "error",
    sessionId,
    message: String(e),
  });
}
```

如果 session 未 ready：

```text
不要创建 bubble
只显示明确提示：Claude Runtime 尚未就绪
```

---

## 6. cwd 验证

截图中 cwd 显示：

```text
G:\Claude Code\Test
```

资源管理器显示其中有 `test` 子目录。必须确认项目 root 是：

```text
G:\Claude Code\Test
```

还是：

```text
G:\Claude Code\Test\test
```

启动前必须验证：

```rust
cwd exists
cwd is directory
```

空目录不是错误。Claude Code 不一定会自动在 cwd 创建文件，所以“文件夹空”不是根因。

---

## 7. 给 Claude CLI 的执行 Prompt

```text
现在 React #185 已解决，Workspace/Chat 能进入，但后端没有真正创建 Claude 会话。

截图显示：
1. cmd.exe 0xc0000142。
2. claude spawn failed: program not found。
3. Session not found: ses-1778555590011。
4. UI 把“你好”显示成 bubble，但实际发送失败。
5. ErrorLog=0，说明错误没有进入统一 RuntimeEventStore。

请只修 Runtime 创建/写入主链路，不要继续 UI 美化。

必须完成：

一、统一 ID 合约
- RuntimeSession.id 是 UI session id。
- RuntimeSession.ptySessionId 是后端 PTY registry id。
- ChatComposer 只能调用 RuntimeBridge.write(uiSessionId, text)。
- RuntimeBridge.write 内部查 ptySessionId，再调用后端 write。
- 禁止 ChatComposer 直接 pty_v2_write(ses-xxx)。

二、Composer ready gate
- session.status 未达到 pty-ready/claude-launching/claude-active 时，输入框禁用。
- 禁用时不要 append user bubble。
- 发送失败时 message 标记 failed，并提供 Retry。

三、Claude discovery
- 新增 runtime_discover_claude。
- Windows 不要直接 spawn "claude"。
- 检查 where claude / where claude.cmd / where claude.ps1 / PowerShell Get-Command claude / npm prefix -g / %APPDATA%\npm。
- 返回 shell strategy matrix 和 claude candidate matrix。

四、Shell strategy fallback
- 不要单押 cmd.exe。
- 当前 cmd.exe 0xc0000142 时，优先尝试 powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass。
- 支持 user configured command override。
- 每个 strategy 要先 shell echo，再 claude --version，再 PTY echo。

五、后端 start 规则
- 只有 openpty/spawn/writer registry insert 全部成功后，才能 emit pty-ready/process-created。
- spawn 失败必须 return Err，不许伪造 pty-process-created。
- sessions map key 必须与 RuntimeSession.ptySessionId 一致。
- pty write 找不到 session 时必须返回结构化错误，并进入 RuntimeEventStore。

六、ErrorLog 统一
- 所有 spawn failed / session not found / send failed 进入 RuntimeEventStore。
- ErrorLog 从 RuntimeEventStore 读取 error/warning。
- 不要出现顶部报错但 ErrorLog=0。

七、cwd 验证
- 启动前检查 cwd exists/is_dir。
- cwd 为空目录不是错误。
- 显示实际 cwd。

八、测试
- runtime_discover_claude 显示 claude candidates。
- New Session 后状态能到 pty-ready 或给出明确 discovery error。
- 不再弹 cmd.exe 0xc0000142。
- 不再出现 Session not found。
- ChatComposer 发送“你好”能进入同一个后端 session。
- 如果发送失败，bubble 标记 failed，不伪装成功。
- npm run typecheck / npm run build / cargo check 全部通过。

完成后输出：
1. ID 合约说明。
2. RuntimeBridge.write 调用链。
3. Discovery matrix 结果。
4. 后端 sessions map key 使用说明。
5. ErrorLog 接入说明。
6. E2E 测试结果。
```

---

## 8. 验收标准

```text
[ ] New Session 后不再弹 cmd.exe 0xc0000142。
[ ] Discovery 能找到 claude.cmd / claude.ps1 / claude command。
[ ] 如果找不到 Claude，UI 明确显示 PATH/安装问题，不创建假 session。
[ ] 后端 sessions map 中存在 ptySessionId。
[ ] ChatComposer 发送时不再出现 Session not found。
[ ] 发送失败不会显示成成功 bubble。
[ ] ErrorLog 能看到 spawn/send/session errors。
[ ] Terminal 或 Chat 能显示 Claude interactive session。
```

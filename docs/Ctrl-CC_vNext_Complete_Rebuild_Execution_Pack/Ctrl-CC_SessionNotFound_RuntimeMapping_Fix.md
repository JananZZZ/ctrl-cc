# Ctrl-CC “Session not found” 最终定点修复方案

> 当前截图已经说明：前端 Workspace / Chat / ErrorLog 已有明显进展，但后端 Runtime 会话仍没有真正注册成功。  
> 当前核心错误：
>
> ```text
> Send failed
> Session not found: ses-1778565225685
> ```
>
> 这不是 React #185，也不是 UI 美化问题。  
> 这是 **RuntimeSession ID 合约 / 后端 PTY registry / ChatComposer ready gate / RuntimeBridge.write** 没打通。

---

# 0. 截图结论

从截图可以直接判断：

```text
1. Workspace 能打开。
2. ChatComposer 能提交。
3. ErrorLog 已经能显示错误。
4. 但是 ChatComposer 发送时，后端找不到 session。
```

这说明当前链路是：

```text
ChatComposer
  -> RuntimeBridge.write 或某个 send 函数
  -> 后端 write
  -> 后端 sessions map 查找 ses-1778565225685
  -> not found
```

直接结论：

```text
前端正在用 UI session id: ses-xxx 去写后端 PTY registry。
但后端 registry 里没有这个 key。
```

这只有几种可能：

```text
A. 后端根本没创建 PTY session。
B. 后端创建失败，但前端仍允许发送。
C. 后端 registry 使用 pty-xxx 作为 key，但前端 write 用 ses-xxx。
D. 后端 registry 曾经创建了，但 spawn failed 后清理了，前端状态没同步。
E. 前端从 localStorage 恢复了旧 UI session，但后端进程已经不存在。
```

---

# 1. 必须立刻建立的硬性不变量

从现在开始，必须强制：

```text
ChatComposer 永远不能直接写后端 session。
ChatComposer 只能调用 RuntimeBridge.write(uiSessionId, data)。

RuntimeBridge.write 必须：
1. 查 RuntimeSession。
2. 检查 RuntimeSession.status 是否 ready。
3. 检查 RuntimeSession.ptySessionId 是否存在。
4. 检查后端 registry 是否存在该 ptySessionId。
5. 再调用 backend write。
```

绝不允许：

```ts
invoke("pty_v2_write", { sessionId: uiSessionId, data })
```

除非后端 registry 明确就是用 uiSessionId 做 key。  
但为了架构清晰，推荐统一：

```text
RuntimeSession.id = ses-xxx
RuntimeSession.ptySessionId = pty-xxx
Backend PTY registry key = pty-xxx
```

---

# 2. 立即修复 ChatComposer：未 ready 禁止发送

当前错误说明用户还能发送，但后端 session 不存在。  
必须把输入框禁用逻辑做硬。

```ts
const READY_TO_SEND = new Set([
  "pty-ready",
  "claude-launching",
  "claude-active",
  "idle",
  "waiting-permission",
]);

const canSend =
  Boolean(session) &&
  Boolean(session.ptySessionId) &&
  READY_TO_SEND.has(session.status);
```

UI：

```tsx
<textarea
  disabled={!canSend}
  placeholder={
    canSend
      ? "输入消息... (Enter 发送) (Ctrl+Enter 换行)"
      : "Claude Runtime 尚未连接：请等待 PTY/Claude 启动成功，或打开诊断查看原因"
  }
/>
<button disabled={!canSend || !draft.trim()}>发送</button>
```

如果用户通过快捷键触发 submit：

```ts
if (!canSend) {
  runtimeStore.addEvent({
    type: "composer.blocked.not_ready",
    level: "warning",
    sessionId,
    message: `Cannot send: runtime session is not ready. status=${session?.status}, ptySessionId=${session?.ptySessionId ?? "null"}`,
  });
  return;
}
```

---

# 3. 立即修复 RuntimeBridge.write

`RuntimeBridge.write` 必须是唯一发送入口。

```ts
export async function write(uiSessionId: string, data: string): Promise<void> {
  const runtime = useRuntimeStore.getState();
  const session = runtime.sessions[uiSessionId];

  if (!session) {
    const message = `UI session not found: ${uiSessionId}`;
    runtime.addEvent({
      type: "runtime.write.ui_session_missing",
      level: "error",
      sessionId: uiSessionId,
      message,
    });
    throw new Error(message);
  }

  if (!session.ptySessionId) {
    const message = `PTY session not attached for UI session: ${uiSessionId}`;
    runtime.addEvent({
      type: "runtime.write.pty_session_missing",
      level: "error",
      sessionId: uiSessionId,
      message,
      payload: { status: session.status },
    });
    throw new Error(message);
  }

  if (!READY_TO_SEND.has(session.status)) {
    const message = `Runtime session is not ready: ${uiSessionId}, status=${session.status}`;
    runtime.addEvent({
      type: "runtime.write.not_ready",
      level: "warning",
      sessionId: uiSessionId,
      message,
      payload: {
        uiSessionId,
        ptySessionId: session.ptySessionId,
        status: session.status,
      },
    });
    throw new Error(message);
  }

  try {
    await invoke("runtime_write", {
      ptySessionId: session.ptySessionId,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    runtime.addEvent({
      type: "runtime.write.backend_failed",
      level: "error",
      sessionId: uiSessionId,
      message,
      payload: {
        uiSessionId,
        ptySessionId: session.ptySessionId,
        status: session.status,
      },
    });

    throw error;
  }
}
```

如果当前后端命令还叫 `pty_v2_write`，也必须由 Adapter 包装：

```ts
await invoke("pty_v2_write", {
  sessionId: session.ptySessionId,
  data,
});
```

关键：传后端 registry key，不传 `ses-xxx`。

---

# 4. 后端必须提供 registry 查询命令

现在用户看不出问题，因为不知道后端有没有 session。  
必须增加：

```rust
#[tauri::command]
pub fn runtime_list_pty_sessions(state: State<PtyManager>) -> Vec<PtySessionDebugInfo>
```

返回：

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionDebugInfo {
    pub pty_session_id: String,
    pub ui_session_id: Option<String>,
    pub project_id: Option<String>,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub created_at: String,
}
```

前端 Diagnostics 显示：

```text
UI Session ID
PTY Session ID
Backend exists?
Status
PID
Has writer?
CWD
Last error
```

当前截图的问题应该能在这里立刻看到：

```text
UI: ses-1778565225685
PTY: null 或 pty-xxx
Backend exists: false
```

---

# 5. 后端 runtime_write 必须用 ptySessionId

后端 write 命令必须明确只接受 `ptySessionId`：

```rust
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWriteRequest {
    pub pty_session_id: String,
    pub data: String,
}

#[tauri::command]
pub fn runtime_write(
    manager: tauri::State<PtyManager>,
    request: RuntimeWriteRequest,
) -> Result<(), String> {
    manager.write(&request.pty_session_id, request.data.as_bytes())
}
```

`manager.write`：

```rust
pub fn write(&self, pty_session_id: &str, data: &[u8]) -> Result<(), String> {
    let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

    let handle = sessions.get_mut(pty_session_id).ok_or_else(|| {
        format!("PTY session not found: {}", pty_session_id)
    })?;

    if !handle.has_writer() {
        return Err(format!("PTY writer missing: {}", pty_session_id));
    }

    handle
        .writer
        .write_all(data)
        .map_err(|e| format!("PTY write failed: {}", e))?;

    handle
        .writer
        .flush()
        .map_err(|e| format!("PTY flush failed: {}", e))?;

    Ok(())
}
```

不要再返回：

```text
Session not found: ses-xxx
```

而应该返回：

```text
PTY session not found: pty-xxx
```

如果仍出现 `ses-xxx`，说明前端仍然绕过 RuntimeBridge 直接写后端。

---

# 6. 后端 start 成功规则必须严格

当前很可能出现了“UI session 创建成功，但后端启动失败”的半成功状态。

必须改为：

```text
只有以下全部完成，才允许 session.status = pty-ready：
1. openpty ok
2. shell/command spawn ok
3. writer acquired ok
4. reader thread started ok
5. sessions.insert(ptySessionId, handle) ok
```

伪代码：

```rust
pub fn start_pty(&self, req: StartPtyRequest) -> Result<StartPtyResponse, String> {
    validate_cwd(&req.cwd)?;

    let pair = openpty(...) ?;

    let child = pair.slave.spawn_command(cmd)
        .map_err(|e| format!("pty spawn failed: {}", e))?;

    let writer = pair.master.take_writer()
        .map_err(|e| format!("take writer failed: {}", e))?;

    let reader = pair.master.try_clone_reader()
        .map_err(|e| format!("clone reader failed: {}", e))?;

    {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(req.pty_session_id.clone(), PtySessionHandle {
            ui_session_id: req.ui_session_id.clone(),
            writer,
            child,
            cwd: req.cwd.clone(),
            status: "pty-ready".to_string(),
            ...
        });
    }

    spawn_reader_thread(reader, req.pty_session_id.clone(), req.ui_session_id.clone());

    Ok(StartPtyResponse {
        ui_session_id: req.ui_session_id,
        pty_session_id: req.pty_session_id,
        status: "pty-ready".to_string(),
        backend_registered: true,
    })
}
```

绝对禁止：

```text
spawn failed 但仍 emit pty-process-created
writer 未注册但前端 status=starting/ready
backend_registered=false 但 composer enabled
```

---

# 7. New Session 创建时必须同时生成两个 ID

前端启动时：

```ts
const uiSessionId = `ses-${Date.now()}`;
const ptySessionId = `pty-${crypto.randomUUID()}`;

const session: RuntimeSession = {
  id: uiSessionId,
  ptySessionId,
  status: "workspace-opened",
  ...
};
```

启动后端时必须传：

```ts
await invoke("runtime_start_pty", {
  request: {
    uiSessionId,
    ptySessionId,
    projectId,
    cwd,
    shellStrategy,
  },
});
```

后端必须用 `ptySessionId` 注册 registry，同时保存 `uiSessionId` 用于事件回传。

---

# 8. App 启动时必须清理 stale session

如果前端把 session 持久化到 localStorage，而后端进程重启后 registry 为空，就会必然出现：

```text
Session not found: ses-xxx
```

启动时必须：

```ts
rehydrateSessions() {
  for each persisted session:
    status = "exited" 或 "disconnected"
    ptySessionId = null
    error = "Backend runtime was restarted. Start a new session or resume."
}
```

绝不允许：

```text
App 重启后旧 session 仍显示 starting/ready
Composer 仍可发送
```

---

# 9. “新建会话”不能复用旧失败 session

点击 `+ 新建会话` 时必须总是创建新的：

```text
uiSessionId
ptySessionId
```

不要复用上一次失败的 `ses-xxx`。

对于旧失败会话，只允许：

```text
Retry：重新生成 ptySessionId，保留 uiSessionId 或创建新 uiSessionId
Resume：创建新 RuntimeSession，使用 Claude --resume
```

---

# 10. ErrorLog 现在有进步，但还要统一

当前 ErrorLog 已能显示 Send failed，这是进步。  
但下一步要把错误 payload 做完整：

```ts
runtimeStore.addEvent({
  type: "composer.send.failed",
  level: "error",
  sessionId: uiSessionId,
  message: "Session not found",
  payload: {
    uiSessionId,
    ptySessionId: session?.ptySessionId,
    sessionStatus: session?.status,
    backendSessions: await RuntimeBridge.listPtySessions(),
  },
});
```

这样以后不需要猜。

---

# 11. Diagnostics 必须新增“Session Mapping”面板

新增一块：

```text
Diagnostics -> Runtime -> Session Mapping
```

表格：

```text
UI Session ID | PTY Session ID | Backend Exists | Status | PID | CWD | Has Writer | Last Error
```

当前这个问题，表格应该直接显示：

```text
ses-1778565225685 | null/pty-xxx | false | starting | - | G:\Claude Code\Test | false | ...
```

---

# 12. 直接发给 Claude CLI 的修复 Prompt

```text
当前 Workspace/Chat 已能打开，ErrorLog 也能记录 Send failed，但核心 Runtime 仍未打通。

截图错误：
Send failed
Session not found: ses-1778565225685

这说明 ChatComposer 正在把 UI session id ses-xxx 写入后端，但后端 PTY registry 没有这个 session，或者后端 registry 使用的是 pty-xxx，或者后端启动失败后没有注册 writer。

请定点修复 Runtime session mapping 和 write path。

必须完成：

1. 统一 ID 合约
- RuntimeSession.id = UiSessionId，例如 ses-xxx。
- RuntimeSession.ptySessionId = PtySessionId，例如 pty-xxx。
- Backend PTY registry key = ptySessionId。
- Backend event payload 同时带 uiSessionId 和 ptySessionId。

2. 修 RuntimeBridge.write
- ChatComposer 只能调用 RuntimeBridge.write(uiSessionId, data)。
- RuntimeBridge.write 必须查 RuntimeSession。
- 如果 session 不存在，记录 runtime.write.ui_session_missing。
- 如果 ptySessionId 不存在，记录 runtime.write.pty_session_missing。
- 如果 session.status 未 ready，记录 runtime.write.not_ready。
- 只有 ready 且 ptySessionId 存在，才调用 backend write。
- backend write 参数必须是 ptySessionId，不是 uiSessionId。

3. 修 ChatComposer ready gate
- status 不在 pty-ready/claude-launching/claude-active/idle/waiting-permission 时，输入框禁用。
- 未 ready 时不要创建 user bubble。
- 发送失败时 bubble 状态 failed，并提供 retry。

4. 修 New Session 创建
- New Session 同时生成 uiSessionId 和 ptySessionId。
- open Workspace tab 后，后台启动 runtime_start_pty。
- runtime_start_pty 必须接收 uiSessionId + ptySessionId。
- 后端 registry 用 ptySessionId insert。
- writer 注册成功后才返回 pty-ready。

5. 修 backend start
- openpty/spawn/writer/reader/registry insert 全成功后才 emit pty-ready。
- spawn 失败必须 return Err + RuntimeEvent error。
- 不允许 fake pty-process-created。
- sessions map key 必须是 ptySessionId。
- write 找不到 session 时错误应显示 PTY session not found: pty-xxx。

6. 新增 runtime_list_pty_sessions
- 返回后端 registry 中所有 PTY session。
- 包括 ptySessionId, uiSessionId, cwd, pid, status, hasWriter。
- Diagnostics 增加 Session Mapping 面板。

7. 清理 stale session
- App 启动时，持久化的旧 session 必须标记 disconnected/exited。
- Composer disabled。
- 不能向旧 ses-xxx 写入。

8. ErrorLog payload 补全
- Send failed 必须记录 uiSessionId、ptySessionId、status、backend session list。
- ErrorLog 从 RuntimeEventStore 读取。

验收：
- 发送时不再出现 Session not found: ses-xxx。
- 如果后端 session 不存在，Composer 必须禁用或错误中显示 ptySessionId 缺失。
- Diagnostics Session Mapping 能显示 UI session 与 backend PTY session 是否匹配。
- backend registry 中能看到 ptySessionId。
- Runtime 未 ready 时不能发送。
- Runtime ready 后发送“你好”能写入同一个 PTY。
- npm run typecheck 通过。
- npm run build 通过。
- cargo check --manifest-path src-tauri/Cargo.toml 通过。
```

---

# 13. 这一轮验收只看这 6 条

```text
[ ] ChatComposer 发送时不再出现 Session not found: ses-xxx。
[ ] Runtime 未 ready 时输入框禁用。
[ ] Diagnostics 能显示 uiSessionId -> ptySessionId -> backend exists。
[ ] Backend sessions map 能看到 ptySessionId。
[ ] ErrorLog 能显示完整 mapping payload。
[ ] 发送失败不会显示为成功消息。
```

等这 6 条过了，再继续修 `claude spawn failed / cmd 0xc0000142`。  
现在不要继续盲目改 UI。

# 12 Eight Honors and Eight Shames — 软件编程八荣八耻

> 每次代码修改前必须对照检查。违反任何一条的代码不得合入。

---

## 1. 以单一事实源为荣，以多头状态为耻

- Runtime 状态只能由 RuntimeKernel/RuntimeBridge 维护。
- 页面不直接创建、启动、停止 PTY。
- Session 状态变更只能通过 RuntimeBridge。

**检查**: grep 所有 Surface 文件，确保没有直接 import `startPtyV2ClaudeSession`, `stopPtyV2`, `writePtyV2`。

---

## 2. 以证据优先为荣，以猜测修复为耻

- 任何修复前必须给出 trace、probe、log、contract test。
- 不允许"我觉得应该是"。
- 修改前先读 `docs/engineering/00_READ_FIRST.md`。

**检查**: 每个 PR/commit 必须包含 trace 证据或 contract test 结果。

---

## 3. 以清晰契约为荣，以隐式耦合为耻

- UiSessionId、PtySessionId、ClaudeSessionId、TraceId 必须分离。
- 任何函数参数必须写清楚 ID 类型。
- 后端 registry key = PtySessionId（pty-uuid），不是 UiSessionId（ses-xxx）。

**检查**: `grep "session_id" src-tauri/src/` 必须全部引用 pty_session_id 或 ui_session_id，不允许裸 `session_id`。

---

## 4. 以可恢复失败为荣，以假成功为耻

- 失败必须进入 RuntimeEventStore、ErrorLog、SessionTimeline、DiagnosticBundle。
- 不允许 spawn 失败后仍显示 ready。
- 不允许 catch 空块静默吞错。

**检查**: `grep "catch\s*\(\s*\)" src/` 返回空。

---

## 5. 以后台异步为荣，以阻塞 UI 为耻

- UI 不等待 Claude ready。
- Tauri command 不 child.wait()、不长时间持锁、不阻塞 reader loop。
- 新建 Session 1 秒内打开 Workspace。

**检查**: 所有 Tauri command 必须有 timeout 意识；前端不得 `await` PTY 启动完成。

---

## 6. 以有界数据为荣，以无限堆积为耻

- RuntimeEvent max 200/500。
- PTY raw output 不进 React 全量状态（只进 xterm + raw log + bounded tail 32KB）。
- ErrorLog max 200。
- 大列表必须虚拟化。

**检查**: `grep "useState.*\[\]" src/` 确认没有无界事件数组。

---

## 7. 以幂等副作用为荣，以循环更新为耻

- store action 无变化必须 return state（不可变，不创建新引用）。
- useEffect 不能更新自身依赖。
- 所有 Zustand store action 必须 idempotent。

**检查**: 每个 store 文件必须有 `if (state.x === next) return state` 守卫。

---

## 8. 以可验证交付为荣，以口头完成为耻

- 每次修改必须跑 `npm run typecheck` + `cargo check`。
- Runtime contract test 必须给出 pass/fail 证据。
- 不通过构建验证不声称完成。

**检查**: 任何代码修改后必须输出 typecheck 和 cargo check 结果。

---

## 对照检查清单 (Pre-Commit)

```
[ ] 1. 单一事实源 — 没有 Surface 直接调 PTY/Claude
[ ] 2. 证据优先 — 有 trace/log/contract test 支持本次修改
[ ] 3. 清晰契约 — ID 类型明确，后端 key = ptySessionId
[ ] 4. 可恢复失败 — 所有 catch 有处理，失败进入 ErrorStore
[ ] 5. 后台异步 — 无 UI 阻塞，1s 内打开 Workspace
[ ] 6. 有界数据 — 无无界数组，PTY 不进 React state
[ ] 7. 幂等副作用 — store action 有 idempotent guard
[ ] 8. 可验证交付 — typecheck + cargo check 通过
```

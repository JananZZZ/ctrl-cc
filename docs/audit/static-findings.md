# Static Findings

Total findings: 641

| File | Line | Rule | Text |
|---|---:|---|---|
| .claude/rules/tauri-rust.md | 3 | child-wait | `- No child.wait() / reader loop / Mutex-hold-read in commands` |
| docs/Ctrl-CC_Ultimate_Fix_Plan.md | 235 | direct-pty-invoke | `→ invokeCommand('pty_start_claude_session', { sessionId, projectId, cliPath: 'claude', cwd, extraArgs: [] })` |
| docs/Ctrl-CC_Ultimate_Fix_Plan.md | 240 | raw-pty-event | `→ emit pty://data 事件` |
| docs/Ctrl-CC_Ultimate_Fix_Plan.md | 243 | runtime-write-bypass | `→ 在 xterm 中直接输入 → xterm.onData → pty_write` |
| docs/Ctrl-CC_Ultimate_Fix_Plan.md | 244 | runtime-write-bypass | `→ 或在 ComposerBar 输入 → pty_write` |
| docs/Ctrl-CC_Ultimate_Fix_Plan.md | 252 | direct-pty-invoke | `await invokeCommand('pty_start_claude_session', {` |
| docs/Ctrl-CC_Ultimate_Fix_Plan.md | 263 | direct-pty-invoke | `await invokeCommand('pty_start_claude_session', {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/03_Part3_Workspace_Chat_Terminal_Top_Experience.md | 123 | runtime-write-bypass | `ChatComposer 输入：runtimeMode = pty-interactive → pty_write(text + Enter)；runtimeMode = structured-print → claude -p task。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/03_Part3_Workspace_Chat_Terminal_Top_Experience.md | 125 | runtime-write-bypass | `Terminal 中直接输入：xterm.onData → pty_write。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/04_Part4_PTY_Runtime_ClaudeCode_Real_Connection.md | 44 | runtime-write-bypass | `pty_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/04_Part4_PTY_Runtime_ClaudeCode_Real_Connection.md | 57 | raw-pty-event | `pty://data` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/04_Part4_PTY_Runtime_ClaudeCode_Real_Connection.md | 58 | raw-pty-event | `pty://exit` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/04_Part4_PTY_Runtime_ClaudeCode_Real_Connection.md | 59 | raw-pty-event | `pty://error` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/04_Part4_PTY_Runtime_ClaudeCode_Real_Connection.md | 60 | raw-pty-event | `pty://status` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/04_Part4_PTY_Runtime_ClaudeCode_Real_Connection.md | 103 | runtime-write-bypass | `→ pty_write(sessionId, text + "\r")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/04_Part4_PTY_Runtime_ClaudeCode_Real_Connection.md | 162 | runtime-write-bypass | `3. 实现 pty_start_claude_session、pty_write、pty_resize、pty_send_ctrl_c、pty_stop 等 commands。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 75 | tauri-listen | `└── listen("dock.snapshot")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 76 | react-setstate | `└── dockStore.setSnapshot(snapshot)` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 102 | runtime-write-bypass | `-> pty_write / pty_kill / openSessionTab` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 538 | react-setstate | `export async function setDockAlwaysOnTop(enabled: boolean) {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 546 | react-setstate | `export async function setDockMode(mode: DockMode) {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 587 | zustand-create | `export const useDockStore = create<DockState>((set, get) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 784 | react-setstate | `publisherTimer = window.setInterval(async () => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 840 | tauri-listen | `const unlisten = await listen("dock.action", async (event) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 855 | react-setstate | `useDockStore.getState().setMode(action.mode);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 860 | react-setstate | `useDockStore.getState().setVisible(true);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 864 | react-setstate | `useDockStore.getState().setVisible(false);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 932 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 934 | react-setstate | `listen("dock.snapshot", (event) => setSnapshot(event.payload as AIDockSnapshot)).then((fn) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 934 | tauri-listen | `listen("dock.snapshot", (event) => setSnapshot(event.payload as AIDockSnapshot)).then((fn) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 1110 | react-setstate | `<button key={s.sessionId} className={s.sessionId === selected?.sessionId ? "selected" : ""} onClick={() => setSelectedSessionId(s.sessionId)}>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 1204 | react-setstate | `setValue("");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 1209 | react-setstate | `<textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={`发送到当前 Claude PTY：${session.sessionName}`} onKeyDown={(e) => { if ((e.ctrlKey \|\| e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }} />` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 1430 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 1615 | runtime-write-bypass | `[ ] Dock Ctrl+C 调用 pty_write("\x03")。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_AI_Dock_Workspace_Chat_Runtime_Integrated_Supreme_Plan.md | 1697 | runtime-write-bypass | `6. Dock Ctrl+C 调用 pty_write("\x03")。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 529 | zustand-create | `export const useConsoleStore = create<ConsoleState>((set) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 577 | zustand-create | `export const useRuntimeStore = create<RuntimeState>((set) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1086 | react-setstate | `d.setDate(now.getDate() - i);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1102 | react-setstate | `y.setDate(end.getDate() - 1);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1109 | react-setstate | `if (range === "1m") start.setDate(end.getDate() - 30);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1110 | react-setstate | `else if (range === "6m") start.setDate(end.getDate() - 180);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1111 | react-setstate | `else if (range === "1y") start.setDate(end.getDate() - 365);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1113 | react-setstate | `else start.setDate(end.getDate() - 7);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1468 | react-setstate | `<button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")}>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 1471 | react-setstate | `<button className={mode === "pro" ? "active" : ""} onClick={() => setMode("pro")}>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 2069 | react-setstate | `<button key={r.value} className={range === r.value ? "active" : ""} onClick={() => setRange(r.value)}>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 2900 | runtime-write-bypass | `2. pty_write(ptySessionId, "\x03")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 3141 | runtime-write-bypass | `9. ActiveWorkPanel 接 openExistingSessionInWorkspace / pty_write Ctrl+C / pty_kill stop。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Console_Workspace_Chat_Runtime_Integrated_Execution_Plan.md | 3190 | runtime-write-bypass | `[ ] ActiveWorkPanel 的 Ctrl+C 调用 pty_write("\x03")，不只是改 UI。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 589 | mutex-lock | `self.sessions.lock().insert(session_id.clone(), session);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 595 | mutex-lock | `let sessions = self.sessions.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 600 | mutex-lock | `let mut writer = session.writer.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 610 | mutex-lock | `let sessions = self.sessions.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 629 | mutex-lock | `let mut sessions = self.sessions.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 636 | mutex-lock | `let mut writer = session.writer.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 776 | child-wait | `let _ = child.wait();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 847 | runtime-write-bypass | `fn pty_write(` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 885 | runtime-write-bypass | `pty_write,` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 991 | runtime-write-bypass | `return invoke<void>("pty_write", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1028 | tauri-listen | `return listen<PtyOutputPayload>("ctrlcc://pty-output", (event) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1036 | tauri-listen | `return listen<PtyExitPayload>("ctrlcc://pty-exit", (event) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1044 | tauri-listen | `return listen<PtyErrorPayload>("ctrlcc://pty-error", (event) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1202 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1204 | react-setstate | `setSessionId(sessionIdRef.current);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1207 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1275 | react-setstate | `setStatus("stopped");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1284 | react-setstate | `setStatus("error");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1303 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1312 | react-setstate | `setStatus("starting");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1327 | react-setstate | `setSessionId(res.session_id);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1328 | react-setstate | `setStatus("running");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1333 | react-setstate | `setStatus("error");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1343 | react-setstate | `setStatus("stopped");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1419 | react-setstate | `setValue("");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1441 | react-setstate | `onChange={(event) => setValue(event.target.value)}` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1504 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1506 | react-setstate | `setCapability({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 1983 | runtime-write-bypass | `- pty_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Final_Executable_Runtime_Rebuild_Plan-final plan.md | 2004 | runtime-write-bypass | `- xterm onData 必须调用 pty_write。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 49 | direct-interaction-adapter | `import { startPtyV2ClaudeSession, stopPtyV2 } from '../../features/runtime/services/interactionAdapter';` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 58 | direct-interaction-adapter | `终端路径：usePtyTerminal -> interactionAdapter.writePtyV2` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 68 | direct-interaction-adapter | `import { startPtyV2ClaudeSession } from '../../features/runtime/services/interactionAdapter';` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 77 | direct-interaction-adapter | `startPtyV2ClaudeSession` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 95 | direct-interaction-adapter | `await adapter.startPtyV2ClaudeSession({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 105 | direct-interaction-adapter | `await adapter.writePtyV2(uiSessionId, data, session.traceId);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 144 | direct-interaction-adapter | `writePtyV2(sessionId, data)` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 375 | direct-interaction-adapter | `{ id: "direct-interaction-adapter", re: /startPtyV2ClaudeSession\|writePtyV2\|stopPtyV2\|resizePtyV2/ },` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 376 | runtime-write-bypass | `{ id: "runtime-write-bypass", re: /pty_v2_write\|pty_write/ },` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 380 | tauri-listen | `{ id: "tauri-listen", re: /listen<\|listen\(/ },` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 514 | runtime-write-bypass | `pty_v2_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 550 | direct-interaction-adapter | `import { startPtyV2ClaudeSession, stopPtyV2, writePtyV2 } from ...` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 766 | raw-pty-event | `app.emit("pty://status", json!({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 775 | raw-pty-event | ``pty://data` 也必须同时包含：` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 1075 | direct-interaction-adapter | `startPtyV2ClaudeSession` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 1109 | direct-interaction-adapter | `startPtyV2ClaudeSession` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 1110 | direct-interaction-adapter | `stopPtyV2` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 1128 | direct-interaction-adapter | `不再 import `writePtyV2`。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Industrial_Runtime_Rebuild_9_Full_Audit_and_Final_Plan.md | 1157 | react-setstate | `if result.ok setText("")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 802 | mutex-lock | `if self.sessions.lock().contains_key(&req.session_id) {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 861 | mutex-lock | `self.sessions.lock().insert(` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 876 | mutex-lock | `let mut sessions = self.sessions.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 887 | mutex-lock | `let mut sessions = self.sessions.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 904 | mutex-lock | `let mut sessions = self.sessions.lock();` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 941 | runtime-write-bypass | `pub fn pty_write(` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 993 | runtime-write-bypass | `use commands::pty_runtime::{pty_kill, pty_resize, pty_start_claude, pty_write};` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1003 | runtime-write-bypass | `pty_write,` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1081 | direct-pty-invoke | `await invoke("pty_start_claude", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1094 | direct-pty-invoke | `await invoke("pty_write", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1094 | runtime-write-bypass | `await invoke("pty_write", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1130 | direct-pty-invoke | `return invoke("pty_write", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1130 | runtime-write-bypass | `return invoke("pty_write", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1137 | direct-pty-invoke | `return invoke("pty_kill", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1143 | direct-pty-invoke | `return invoke("pty_resize", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1179 | tauri-listen | `const unlistenOutput = await listen("pty.output", (event) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1194 | tauri-listen | `const unlistenExit = await listen("pty.exit", (event) => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1212 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1257 | zustand-create | `export const useProjectsStore = create<ProjectsState>((set, get) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1343 | zustand-create | `export const useWorkspaceStore = create<WorkspaceState>((set) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1605 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1652 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1697 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1754 | react-setstate | `setValue("");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 1761 | react-setstate | `onChange={(e) => setValue(e.target.value)}` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Projects_Surface_Supreme_Redesign_Execution_Plan.md | 2057 | react-setstate | `<button onClick={() => setError(null)}>关闭</button>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 115 | react-setstate | `localStorage.setItem("ctrlcc:last-react-error", JSON.stringify(payload, null, 2));` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 172 | react-setstate | `localStorage.setItem(` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 192 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 328 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 336 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 350 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 358 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 401 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 402 | react-setstate | `const timer = setInterval(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 403 | react-setstate | `setSnapshot(buildSnapshot());` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 411 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 412 | react-setstate | `const timer = window.setInterval(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 528 | react-setstate | `setRunning(true);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 530 | react-setstate | `setResult(await invoke("runtime_smoke_test"));` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 532 | react-setstate | `setResult({ error: String(e) });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 534 | react-setstate | `setRunning(false);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_React185_Surgical_Fix_and_Runtime_Recovery.md | 649 | react-setstate | `resizeTimer = window.setTimeout(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_Deep_Audit_Supreme_Fix_8.md | 238 | zustand-create | `export const useRuntimeTraceStore = create<RuntimeTraceState>((set, get) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_Deep_Audit_Supreme_Fix_8.md | 632 | mutex-lock | `let mut sessions = self.sessions.lock().map_err(\|e\| e.to_string())?;` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_Next_Fix_After_Chat_Opened.md | 343 | runtime-write-bypass | `- 禁止 ChatComposer 直接 pty_v2_write(ses-xxx)。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 12 | runtime-write-bypass | `1. `src/features/runtime` 和 `workspace` 为空，但 `main.rs` 已经注册了新的 runtime PTY 命令：`pty_start_claude / pty_write / pty_resize / pty_stop / structured_run`。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 13 | runtime-write-bypass | `2. 同一个 `main.rs` 里又注册了旧 PTY 命令：`pty_start_claude_session / pty_v2_write / pty_v2_resize / pty_send_ctrl_c / pty_send_ctrl_d / pty_v2_stop / pty_get_status / pty_get_raw_log / pty_list_sessions`。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 14 | runtime-write-bypass | `3. 当前前端 `usePtyTerminal` 监听的是旧事件：`pty://data / pty://status / pty://exit / pty://error`，并写入旧命令：`pty_v2_write / pty_v2_resize / pty_send_ctrl_c / pty_send_ctrl_d`。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 14 | raw-pty-event | `3. 当前前端 `usePtyTerminal` 监听的是旧事件：`pty://data / pty://status / pty://exit / pty://error`，并写入旧命令：`pty_v2_write / pty_v2_resize / pty_send_ctrl_c / pty_send_ctrl_d`。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 15 | raw-pty-event | `4. 因此如果 Projects 页面调用了新的 `pty_start_claude`，而 Workspace Terminal 监听旧事件 `pty://data`，Terminal 永远收不到输出；如果 Projects 仍调用旧命令但流程里阻塞等待，就会未响应。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 48 | runtime-write-bypass | `- pty_v2_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 53 | raw-pty-event | `- event: pty://data / pty://status / pty://exit / pty://error` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 70 | runtime-write-bypass | `pty_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 139 | direct-pty-invoke | `return invokeCommand('pty_start_claude_session', {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 150 | direct-pty-invoke | `return invokeCommand('pty_v2_write', { sessionId, data });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 150 | runtime-write-bypass | `return invokeCommand('pty_v2_write', { sessionId, data });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 154 | direct-pty-invoke | `return invokeCommand('pty_v2_resize', { sessionId, cols, rows });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 158 | direct-pty-invoke | `return invokeCommand('pty_send_ctrl_c', { sessionId });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 162 | direct-pty-invoke | `return invokeCommand('pty_send_ctrl_d', { sessionId });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 166 | direct-pty-invoke | `return invokeCommand('pty_v2_stop', { sessionId });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 221 | zustand-create | `export const useWorkspaceStore = create<WorkspaceState>((set) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 264 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 304 | react-setstate | `setBusy(true);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 307 | react-setstate | `setText('');` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 309 | react-setstate | `setBusy(false);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 317 | react-setstate | `onChange={(e) => setText(e.target.value)}` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 519 | raw-pty-event | `你当前 `usePtyTerminal` 基本方向是对的：它直接监听 `pty://data` 并 `term.write`，没有把 PTY raw output 送进 React 大状态，这是正确的。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 536 | error-swallow | `} catch {}` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 548 | react-setstate | `resizeTimer = window.setTimeout(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 552 | direct-pty-invoke | `invokeCommand('pty_v2_resize', { sessionId, rows: dims.rows, cols: dims.cols })` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 587 | runtime-write-bypass | `// pty::pty_commands::pty_v2_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 594 | runtime-write-bypass | `// pty_start_claude / pty_write / pty_resize / pty_stop` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 648 | runtime-write-bypass | `当前 src/features/runtime 和 src/features/workspace 基本为空，但 main.rs 同时注册了两套 PTY/runtime 命令。前端 usePtyTerminal 实际监听旧 PTY 事件 pty://data/status/exit/error，并使用旧命令 pty_v2_write/resize/ctrl_c/ctrl_d。因此 P0 必须统一到旧 pty data plane。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 648 | raw-pty-event | `当前 src/features/runtime 和 src/features/workspace 基本为空，但 main.rs 同时注册了两套 PTY/runtime 命令。前端 usePtyTerminal 实际监听旧 PTY 事件 pty://data/status/exit/error，并使用旧命令 pty_v2_write/resize/ctrl_c/ctrl_d。因此 P0 必须统一到旧 pty data plane。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 652 | runtime-write-bypass | `1. 不再从 Projects 调用新的 pty_start_claude / pty_write / runtime structured chat 作为 interactive 会话路径。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 653 | runtime-write-bypass | `2. 新建 src/features/runtime/services/ptyClient.ts，统一封装旧命令：pty_start_claude_session、pty_v2_write、pty_v2_resize、pty_send_ctrl_c、pty_send_ctrl_d、pty_v2_stop。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Runtime_PTY_Rescue_Audit_and_Fix_Plan.md | 660 | runtime-write-bypass | `9. ChatComposer 只调用 pty_v2_write，不调用 claude -p。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 18 | runtime-write-bypass | `- `pty_v2_write`` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 23 | raw-pty-event | `- `pty://data / pty://status / pty://exit / pty://error`` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 27 | runtime-write-bypass | `- `pty_write`` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 33 | raw-pty-event | `- 监听 `pty://data`` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 34 | runtime-write-bypass | `- 写入 `pty_v2_write`` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 83 | runtime-write-bypass | `当前已经存在可用前端 hook：`usePtyTerminal` 使用 `pty://data` 和 `pty_v2_write`。因此 P0 不再让前端调用 `pty_start_claude / pty_write` 新命令，而是建立：` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 83 | raw-pty-event | `当前已经存在可用前端 hook：`usePtyTerminal` 使用 `pty://data` 和 `pty_v2_write`。因此 P0 不再让前端调用 `pty_start_claude / pty_write` 新命令，而是建立：` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 91 | runtime-write-bypass | `-> ChatComposer.pty_v2_write(sessionId, text + "\r")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 234 | direct-interaction-adapter | `export async function startPtyV2ClaudeSession(input: {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 242 | direct-pty-invoke | `return invokeCommand("pty_start_claude_session", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 252 | direct-interaction-adapter | `export async function writePtyV2(sessionId: string, data: string) {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 253 | direct-pty-invoke | `return invokeCommand("pty_v2_write", { sessionId, data });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 253 | runtime-write-bypass | `return invokeCommand("pty_v2_write", { sessionId, data });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 256 | direct-interaction-adapter | `export async function resizePtyV2(sessionId: string, rows: number, cols: number) {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 257 | direct-pty-invoke | `return invokeCommand("pty_v2_resize", { sessionId, rows, cols });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 261 | direct-pty-invoke | `return invokeCommand("pty_send_ctrl_c", { sessionId });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 264 | direct-interaction-adapter | `export async function stopPtyV2(sessionId: string) {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 265 | direct-pty-invoke | `return invokeCommand("pty_v2_stop", { sessionId });` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 321 | zustand-create | `export const useRuntimeStore = create<RuntimeState>((set) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 398 | zustand-create | `export const useWorkspaceStore = create<WorkspaceState>((set) => ({` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 557 | react-setstate | `setComposerDraft(sessionId, "");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 565 | react-setstate | `onChange={(e) => setComposerDraft(sessionId, e.target.value)}` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 614 | raw-pty-event | `不能把 `pty://data` 原始 chunk 转成 `assistant_delta`。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 651 | error-swallow | `} catch {}` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 662 | react-setstate | `resizeTimer = window.setTimeout(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 666 | direct-pty-invoke | `invokeCommand("pty_v2_resize", { sessionId, rows: dims.rows, cols: dims.cols })` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 694 | runtime-write-bypass | `pty_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 703 | runtime-write-bypass | `pty_v2_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 779 | runtime-write-bypass | `2. usePtyTerminal 使用旧 PTY 通道：pty://data + pty_v2_write。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 779 | raw-pty-event | `2. usePtyTerminal 使用旧 PTY 通道：pty://data + pty_v2_write。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 787 | runtime-write-bypass | `3. P0 只使用一套 PTY 通道：pty_start_claude_session + pty_v2_write + pty_v2_resize + pty_send_ctrl_c + pty_v2_stop + pty://data。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 787 | raw-pty-event | `3. P0 只使用一套 PTY 通道：pty_start_claude_session + pty_v2_write + pty_v2_resize + pty_send_ctrl_c + pty_v2_stop + pty://data。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 788 | runtime-write-bypass | `4. 前端禁止调用 pty_start_claude / pty_write / pty_resize / pty_stop。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 797 | runtime-write-bypass | `1. rg 搜索 pty_start_claude、pty_write、pty_resize、pty_stop、pty_start_claude_session、pty_v2_write、usePtyTerminal、ChatBlockRenderer。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_RuntimeBridge_4_Supreme_OneStep_Execution_Plan.md | 830 | runtime-write-bypass | `4. Workspace ChatComposer -> pty_v2_write 的证明` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 145 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 167 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 169 | react-setstate | `setTab("errors");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 171 | react-setstate | `setTab("overview");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 184 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 185 | react-setstate | `setTab("overview");` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 230 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 231 | react-setstate | `setActions(actions);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 252 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 338 | react-setstate | `<button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 339 | react-setstate | `<button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>Events</button>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 340 | react-setstate | `<button className={tab === "diagnostics" ? "active" : ""} onClick={() => setTab("diagnostics")}>Diagnostics</button>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 341 | react-setstate | `<button className={tab === "resources" ? "active" : ""} onClick={() => setTab("resources")}>Resources</button>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 342 | react-setstate | `<button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Audit</button>` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 471 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 528 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionInspector_React185_Fix.md | 529 | react-setstate | `setSurface(route.surface);` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionNotFound_RuntimeMapping_Fix.md | 75 | direct-pty-invoke | `invoke("pty_v2_write", { sessionId: uiSessionId, data })` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionNotFound_RuntimeMapping_Fix.md | 75 | runtime-write-bypass | `invoke("pty_v2_write", { sessionId: uiSessionId, data })` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionNotFound_RuntimeMapping_Fix.md | 212 | runtime-write-bypass | `如果当前后端命令还叫 `pty_v2_write`，也必须由 Adapter 包装：` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionNotFound_RuntimeMapping_Fix.md | 215 | direct-pty-invoke | `await invoke("pty_v2_write", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionNotFound_RuntimeMapping_Fix.md | 215 | runtime-write-bypass | `await invoke("pty_v2_write", {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionNotFound_RuntimeMapping_Fix.md | 300 | mutex-lock | `let mut sessions = self.sessions.lock().map_err(\|e\| e.to_string())?;` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_SessionNotFound_RuntimeMapping_Fix.md | 373 | mutex-lock | `let mut sessions = self.sessions.lock().map_err(\|e\| e.to_string())?;` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 254 | direct-pty-invoke | `invoke("pty_start_claude")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 255 | direct-pty-invoke | `invoke("pty_v2_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 255 | runtime-write-bypass | `invoke("pty_v2_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 256 | direct-pty-invoke | `invoke("pty_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 256 | runtime-write-bypass | `invoke("pty_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 257 | direct-pty-invoke | `invoke("structured_run")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 577 | react-useeffect | `useEffect(() => {` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_6.md | 579 | tauri-listen | `listen("runtime:event", handler).then((fn) => (dispose = fn));` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 296 | direct-pty-invoke | `invoke("pty_start_claude")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 297 | direct-pty-invoke | `invoke("pty_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 297 | runtime-write-bypass | `invoke("pty_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 298 | direct-pty-invoke | `invoke("pty_resize")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 299 | direct-pty-invoke | `invoke("pty_stop")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 300 | direct-pty-invoke | `invoke("pty_start_claude_session")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 301 | direct-pty-invoke | `invoke("pty_v2_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 301 | runtime-write-bypass | `invoke("pty_v2_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 302 | direct-pty-invoke | `invoke("pty_v2_resize")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 303 | direct-pty-invoke | `invoke("pty_send_ctrl_c")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 304 | direct-pty-invoke | `invoke("pty_v2_stop")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 305 | direct-pty-invoke | `invoke("structured_run")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 429 | child-wait | `1. child.wait()` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 1041 | direct-pty-invoke | `[ ] 前端 surface 内没有 invoke("pty_*")。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 1042 | runtime-write-bypass | `[ ] ChatComposer 不直接调用 pty_v2_write。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Stability_First_Supreme_Architecture_7_ProjectMemory_Execution_Plan.md | 1307 | runtime-write-bypass | `3. 不让 ChatComposer 直接调用 pty_v2_write。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_100_200_500_Architecture.md | 257 | direct-pty-invoke | `→ invoke("pty_resize", { sessionId, cols, rows, pixelWidth, pixelHeight })` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 30 | runtime-write-bypass | `pty_v2_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 34 | raw-pty-event | `pty://data` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 35 | raw-pty-event | `pty://status` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 36 | raw-pty-event | `pty://exit` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 37 | raw-pty-event | `pty://error` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 41 | runtime-write-bypass | `pty_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 253 | runtime-write-bypass | `rg "pty_write"` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 257 | runtime-write-bypass | `rg "pty_v2_write"` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 258 | raw-pty-event | `rg "pty://data"` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 272 | direct-pty-invoke | `invoke("pty_start_claude")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 273 | direct-pty-invoke | `invoke("pty_start_claude_session")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 274 | direct-pty-invoke | `invoke("pty_v2_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 274 | runtime-write-bypass | `invoke("pty_v2_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 275 | direct-pty-invoke | `invoke("pty_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_Supreme_RuntimeBridge_5_Final_No_Compromise_Plan.md | 275 | runtime-write-bypass | `invoke("pty_write")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1250 | runtime-write-bypass | `ChatComposer 输入：runtimeMode = pty-interactive → pty_write(text + Enter)；runtimeMode = structured-print → claude -p task。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1252 | runtime-write-bypass | `Terminal 中直接输入：xterm.onData → pty_write。` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1370 | runtime-write-bypass | `pty_write` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1383 | raw-pty-event | `pty://data` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1384 | raw-pty-event | `pty://exit` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1385 | raw-pty-event | `pty://error` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1386 | raw-pty-event | `pty://status` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1429 | runtime-write-bypass | `→ pty_write(sessionId, text + "\r")` |
| docs/Ctrl-CC_vNext_Complete_Rebuild_Execution_Pack/Ctrl-CC_vNext_Complete_Rebuild_Execution_FULL.md | 1488 | runtime-write-bypass | `3. 实现 pty_start_claude_session、pty_write、pty_resize、pty_send_ctrl_c、pty_stop 等 commands。` |
| docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md | 21 | direct-pty-invoke | `invoke("pty_start_claude") / invoke("pty_write") / invoke("pty_resize") / invoke("pty_stop")` |
| docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md | 21 | runtime-write-bypass | `invoke("pty_start_claude") / invoke("pty_write") / invoke("pty_resize") / invoke("pty_stop")` |
| docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md | 22 | direct-pty-invoke | `invoke("pty_start_claude_session") / invoke("pty_v2_write") / invoke("pty_v2_resize")` |
| docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md | 22 | runtime-write-bypass | `invoke("pty_start_claude_session") / invoke("pty_v2_write") / invoke("pty_v2_resize")` |
| docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md | 23 | direct-pty-invoke | `invoke("pty_send_ctrl_c") / invoke("pty_v2_stop") / invoke("structured_run")` |
| docs/engineering/04_TAURI_RUST_BACKEND_RULES.md | 5 | child-wait | `1. `child.wait()`` |
| docs/runtime-audit.md | 57 | runtime-write-bypass | `**修复**: 添加 `runtimeMode === 'pty-interactive'` 分支调用 `pty_v2_write`。` |
| docs/runtime-audit.md | 81 | raw-pty-event | `- PTY 事件 `pty://data`/`pty://status`/`pty://exit`/`pty://error` 正确使用 snake_case ✅` |
| docs/runtime-audit.md | 90 | direct-pty-invoke | `→ invokeCommand('pty_start_claude_session', { sessionId, projectId, cliPath, cwd, extraArgs })` |
| docs/runtime-audit.md | 97 | raw-pty-event | `→ 监听 pty://data → xterm.write(data)` |
| docs/runtime-audit.md | 98 | runtime-write-bypass | `→ xterm.onData → pty_v2_write(sessionId, data)` |
| docs/runtime-pty-first.md | 45 | runtime-write-bypass | `→ Tauri Command (pty_write / pty_resize / pty_send_ctrl_c ...)` |
| docs/runtime-pty-first.md | 74 | runtime-write-bypass | `3. `pty_write` — 写入 stdin` |
| docs/runtime-pty-first.md | 85 | raw-pty-event | `- `pty://data` — 原始字节输出` |
| docs/runtime-pty-first.md | 86 | raw-pty-event | `- `pty://exit` — 会话退出` |
| docs/runtime-pty-first.md | 87 | raw-pty-event | `- `pty://error` — 错误` |
| docs/runtime-pty-first.md | 88 | raw-pty-event | `- `pty://status` — 状态变更` |
| src-tauri/src/commands/file_lock.rs | 23 | mutex-lock | `let mut locks = self.locks.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/file_lock.rs | 37 | mutex-lock | `let mut locks = self.locks.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/file_lock.rs | 43 | mutex-lock | `pub fn list(&self) -> Vec<FileLock> { self.locks.lock().expect("mutex poisoned").values().cloned().collect() }` |
| src-tauri/src/commands/hooks_collector.rs | 25 | mutex-lock | `let mut events = self.events.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/hooks_collector.rs | 37 | mutex-lock | `let events = self.events.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/permission_center.rs | 32 | mutex-lock | `let allowlist = self.allowlist.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/permission_center.rs | 33 | mutex-lock | `let denylist = self.denylist.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/permission_center.rs | 34 | mutex-lock | `let level = *self.auto_trust_level.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/permission_center.rs | 57 | mutex-lock | `pub fn add_rule(&self, rule: PermissionRule) { self.rules.lock().expect("mutex poisoned").insert(rule.id.clone(), rule); }` |
| src-tauri/src/commands/permission_center.rs | 59 | mutex-lock | `pub fn remove_rule(&self, id: &str) { self.rules.lock().expect("mutex poisoned").remove(id); }` |
| src-tauri/src/commands/permission_center.rs | 60 | mutex-lock | `pub fn list_rules(&self) -> Vec<PermissionRule> { self.rules.lock().expect("mutex poisoned").values().cloned().collect() }` |
| src-tauri/src/commands/permission_center.rs | 61 | mutex-lock | `pub fn set_auto_trust(&self, level: u32) { *self.auto_trust_level.lock().expect("mutex poisoned") = level.min(5); }` |
| src-tauri/src/commands/permission_center.rs | 62 | mutex-lock | `pub fn add_allow(&self, tool: String) { self.allowlist.lock().expect("mutex poisoned").push(tool); }` |
| src-tauri/src/commands/permission_center.rs | 63 | mutex-lock | `pub fn add_deny(&self, pattern: String) { self.denylist.lock().expect("mutex poisoned").push(pattern); }` |
| src-tauri/src/commands/process_watcher.rs | 29 | mutex-lock | `*self.running.lock().expect("mutex poisoned") = true;` |
| src-tauri/src/commands/process_watcher.rs | 30 | mutex-lock | `let _running = self.running.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/process_watcher.rs | 67 | mutex-lock | `*self.handle.lock().expect("mutex poisoned") = Some(handle);` |
| src-tauri/src/commands/process_watcher.rs | 71 | mutex-lock | `*self.running.lock().expect("mutex poisoned") = false;` |
| src-tauri/src/commands/session_replay.rs | 19 | mutex-lock | `let db_conn = db.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/commands/session_replay.rs | 54 | mutex-lock | `let db_conn = db.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/commands/statusline.rs | 39 | mutex-lock | `*running.lock().expect("mutex poisoned") = true;` |
| src-tauri/src/commands/statusline.rs | 44 | mutex-lock | `while *r.lock().expect("mutex poisoned") {` |
| src-tauri/src/commands/statusline.rs | 78 | mutex-lock | `*self.handle.lock().expect("mutex poisoned") = Some(handle);` |
| src-tauri/src/commands/statusline.rs | 82 | mutex-lock | `*self.running.lock().expect("mutex poisoned") = false;` |
| src-tauri/src/commands/watchdog.rs | 43 | mutex-lock | `let max_total = *self.max_total.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/watchdog.rs | 44 | mutex-lock | `let max_claude = *self.max_claude.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/watcher.rs | 25 | mutex-lock | `let _running_map = self.running.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/watcher.rs | 27 | mutex-lock | `let mut handles = self.handles.lock().expect("mutex poisoned");` |
| src-tauri/src/commands/watcher.rs | 55 | mutex-lock | `let mut handles = self.handles.lock().expect("mutex poisoned");` |
| src-tauri/src/database/mod.rs | 94 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/database/mod.rs | 108 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/database/mod.rs | 125 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/database/mod.rs | 145 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/database/mod.rs | 164 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/database/mod.rs | 172 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/database/mod.rs | 193 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/database/mod.rs | 216 | mutex-lock | `let db = conn.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/main.rs | 36 | runtime-write-bypass | `fn pty_write(` |
| src-tauri/src/main.rs | 180 | runtime-write-bypass | `pty::pty_commands::pty_v2_write,` |
| src-tauri/src/main.rs | 196 | runtime-write-bypass | `// 前端禁止调用: pty_start_claude / pty_write / pty_resize / pty_stop` |
| src-tauri/src/main.rs | 199 | runtime-write-bypass | `pty_write,` |
| src-tauri/src/pty/pty_commands.rs | 39 | runtime-write-bypass | `pub fn pty_v2_write(` |
| src-tauri/src/pty/pty_commands.rs | 50 | runtime-write-bypass | `"pty_v2_write", "start", ""` |
| src-tauri/src/pty/pty_commands.rs | 57 | runtime-write-bypass | `"pty_v2_write", "success", ""` |
| src-tauri/src/pty/pty_commands.rs | 62 | runtime-write-bypass | `"pty_v2_write", "failed", &e.to_string()` |
| src-tauri/src/pty/pty_log.rs | 14 | mutex-lock | `if w.lock().is_err() {` |
| src-tauri/src/pty/pty_manager.rs | 20 | mutex-lock | `self.sessions.lock()` |
| src-tauri/src/pty/pty_manager.rs | 28 | mutex-lock | `let sessions = self.sessions.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/pty/pty_manager.rs | 33 | mutex-lock | `let status = h.status.lock().map(\|s\| format!("{:?}", s)).unwrap_or_else(\|_\| "unknown".into());` |
| src-tauri/src/pty/pty_manager.rs | 51 | mutex-lock | `let sessions = self.sessions.lock()` |
| src-tauri/src/pty/pty_manager.rs | 62 | mutex-lock | `let sessions = self.sessions.lock()` |
| src-tauri/src/pty/pty_manager.rs | 88 | mutex-lock | `let mut sessions = self.sessions.lock()` |
| src-tauri/src/pty/pty_manager.rs | 97 | mutex-lock | `let sessions = self.sessions.lock().ok()?;` |
| src-tauri/src/pty/pty_manager.rs | 99 | mutex-lock | `.and_then(\|h\| h.status.lock().ok().map(\|s\| s.clone()))` |
| src-tauri/src/pty/pty_manager.rs | 103 | mutex-lock | `let sessions = self.sessions.lock().ok()?;` |
| src-tauri/src/pty/pty_manager.rs | 113 | mutex-lock | `match self.sessions.lock() {` |
| src-tauri/src/pty/pty_manager.rs | 121 | mutex-lock | `if let Ok(mut sessions) = self.sessions.lock() { sessions.remove(id); }` |
| src-tauri/src/pty/pty_session.rs | 222 | child-wait | `/// 不阻塞读取、不等待握手、不调用 child.wait()、无 sleep。` |
| src-tauri/src/pty/pty_session.rs | 306 | raw-pty-event | `let _ = app.emit("pty://status", serde_json::json!({` |
| src-tauri/src/pty/pty_session.rs | 315 | mutex-lock | `let mut w = self.writer.lock().map_err(\|e\| AppError::Process(format!("PTY writer lock: {}", e)))?;` |
| src-tauri/src/pty/pty_session.rs | 320 | mutex-lock | `let master = self.master.lock().map_err(\|e\| AppError::Process(format!("PTY master lock: {}", e)))?;` |
| src-tauri/src/pty/pty_session.rs | 330 | mutex-lock | `if let Ok(mut r) = self.running.lock() { *r = false; }` |
| src-tauri/src/pty/pty_session.rs | 331 | mutex-lock | `if let Ok(mut s) = self.status.lock() { *s = PtySessionStatus::Killed; }` |
| src-tauri/src/pty/pty_session.rs | 339 | raw-pty-event | `// PTY raw output → pty://data → usePtyTerminal → term.write()` |
| src-tauri/src/pty/pty_session.rs | 352 | mutex-lock | `if let Ok(mut s) = status.lock() { *s = PtySessionStatus::Running; }` |
| src-tauri/src/pty/pty_session.rs | 353 | raw-pty-event | `let _ = app.emit("pty://status", serde_json::json!({` |
| src-tauri/src/pty/pty_session.rs | 359 | mutex-lock | `if !running.lock().map(\|r\| *r).unwrap_or(false) { break; }` |
| src-tauri/src/pty/pty_session.rs | 375 | raw-pty-event | `let _ = app.emit("pty://data", serde_json::json!({` |
| src-tauri/src/pty/pty_session.rs | 389 | raw-pty-event | `let _ = app.emit("pty://error", serde_json::json!({` |
| src-tauri/src/pty/pty_session.rs | 397 | child-wait | `let exit_code = pty_child.wait().ok().map(\|s\| if s.success() { 0 } else { 1 });` |
| src-tauri/src/pty/pty_session.rs | 399 | mutex-lock | `if let Ok(mut s) = status.lock() { *s = PtySessionStatus::Exited { code: exit_code.unwrap_or(0) }; }` |
| src-tauri/src/pty/pty_session.rs | 400 | raw-pty-event | `let _ = app.emit("pty://exit", serde_json::json!({` |
| src-tauri/src/runtime/claude_runner.rs | 91 | mutex-lock | `if !*running_clone.lock().expect("mutex poisoned") { break; }` |
| src-tauri/src/runtime/claude_runner.rs | 137 | mutex-lock | `let mut stdin = self.stdin.lock().map_err(\|e\| AppError::Process(e.to_string()))?;` |
| src-tauri/src/runtime/claude_runner.rs | 146 | mutex-lock | `*self.running.lock().expect("mutex poisoned") = false;` |
| src-tauri/src/runtime/commands.rs | 51 | mutex-lock | `let mut sessions = manager.sessions.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/runtime/commands.rs | 70 | mutex-lock | `let mut sessions = manager.sessions.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/runtime/commands.rs | 177 | mutex-lock | `let sessions = manager.sessions.lock().map_err(\|e\| e.to_string())?;` |
| src-tauri/src/runtime/pty_session.rs | 130 | mutex-lock | `self.sessions.lock().insert(session_id.clone(), session);` |
| src-tauri/src/runtime/pty_session.rs | 136 | mutex-lock | `let sessions = self.sessions.lock();` |
| src-tauri/src/runtime/pty_session.rs | 141 | mutex-lock | `let mut writer = session.writer.lock();` |
| src-tauri/src/runtime/pty_session.rs | 151 | mutex-lock | `let sessions = self.sessions.lock();` |
| src-tauri/src/runtime/pty_session.rs | 172 | mutex-lock | `let mut sessions = self.sessions.lock();` |
| src-tauri/src/runtime/pty_session.rs | 181 | mutex-lock | `let mut writer = session.writer.lock();` |
| src-tauri/src/runtime/structured_runtime.rs | 82 | child-wait | `let exit_status = child.wait();` |
| src/app/App.tsx | 20 | react-useeffect | `useEffect(() => {` |
| src/app/App.tsx | 23 | react-setstate | `document.documentElement.setAttribute('data-theme', savedTheme);` |
| src/app/App.tsx | 27 | react-setstate | `if (savedScale) document.documentElement.style.setProperty('--cc-font-scale', savedScale);` |
| src/app/App.tsx | 37 | react-setstate | `setProjects(rows as unknown as Project[]);` |
| src/app/App.tsx | 74 | react-useeffect | `useEffect(() => {` |
| src/app/App.tsx | 111 | react-setstate | `if (cleaned.length > 0) setSessions(cleaned);` |
| src/app/App.tsx | 116 | react-useeffect | `useEffect(() => {` |
| src/app/App.tsx | 126 | error-swallow | `} catch {}` |
| src/app/App.tsx | 133 | react-useeffect | `useEffect(() => {` |
| src/app/App.tsx | 134 | tauri-listen | `const unlisten = listen<Record<string, unknown>>('ctrlcc://log', (event) => {` |
| src/app/AppShell.tsx | 20 | react-setstate | `<AIDock onOpenErrorLog={() => setShowLogPanel(true)} errorCount={unresolvedCount} />` |
| src/app/AppShell.tsx | 21 | react-setstate | `<ErrorToast onOpenLog={() => setShowLogPanel(true)} />` |
| src/app/AppShell.tsx | 23 | react-setstate | `<ErrorLogPanel open={showLogPanel} onClose={() => setShowLogPanel(false)} />` |
| src/components/dock/AIDock.tsx | 20 | react-useeffect | `useEffect(() => {` |
| src/components/dock/AIDock.tsx | 21 | react-setstate | `if (running.length === 0) setMode('quiet');` |
| src/components/dock/AIDock.tsx | 30 | react-setstate | `<button onClick={() => setMode(mode === 'quiet' ? 'calm' : mode === 'calm' ? 'focus' : 'quiet')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-2xs)', color: 'var(--cc-text-muted)', padding: 2, widt` |
| src/components/error/ErrorBoundary.tsx | 22 | react-setstate | `this.setState({ stack });` |
| src/components/error/ErrorBoundary.tsx | 26 | react-setstate | `localStorage.setItem('ctrlcc:last-react-error', JSON.stringify({` |
| src/components/error/ErrorBoundary.tsx | 32 | error-swallow | `} catch {}` |
| src/components/error/ErrorBoundary.tsx | 42 | error-swallow | `} catch {}` |
| src/components/error/ErrorLogPanel.tsx | 53 | react-setstate | `<button key={tabId} onClick={() => setTab(tabId)} style={{ flex: 1, padding: '6px 12px', border: 'none', background: tab === tabId ? 'var(--cc-brand-soft)' : 'transparent', color: tab === tabId ? 'var(--cc-brand-strong)' : 'var(--cc-text-mu` |
| src/components/error/ErrorLogPanel.tsx | 61 | react-setstate | `<FilterBtn active={filterSeverity === 'all'} onClick={() => setFilterSeverity('all')} label={t('errorLog.all')} />` |
| src/components/error/ErrorLogPanel.tsx | 63 | react-setstate | `<FilterBtn key={s} active={filterSeverity === s} onClick={() => setFilterSeverity(s)} label={t(`errorLog.severity`, { context: s }) \|\| s} color={SEVERITY_COLORS[s]} />` |
| src/components/error/ErrorLogPanel.tsx | 88 | react-setstate | `}} onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>` |
| src/components/error/ErrorToast.tsx | 37 | react-setstate | `onExpand={() => { setExpandedId(expandedId === e.id ? null : e.id); if (onOpenLog) onOpenLog(); }}` |
| src/components/error/ErrorToast.tsx | 38 | react-setstate | `onDismiss={() => { dismissError(e.id); setExpandedId(null); }}` |
| src/components/error/ErrorToast.tsx | 50 | react-useeffect | `useEffect(() => {` |
| src/components/error/ErrorToast.tsx | 52 | react-setstate | `const t = setTimeout(onDismiss, autoDismiss);` |
| src/debug/useRenderLoopGuard.ts | 20 | react-setstate | `localStorage.setItem('ctrlcc:render-loop', JSON.stringify({` |
| src/debug/useRenderLoopGuard.ts | 24 | error-swallow | `} catch {}` |
| src/debug/useRenderLoopGuard.ts | 32 | react-useeffect | `useEffect(() => {` |
| src/features/composer/CommandPalette.tsx | 51 | react-setstate | `else if (e.key === 'ArrowDown') { setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); e.preventDefault(); }` |
| src/features/composer/CommandPalette.tsx | 52 | react-setstate | `else if (e.key === 'ArrowUp') { setSelectedIdx((i) => Math.max(i - 1, 0)); e.preventDefault(); }` |
| src/features/composer/CommandPalette.tsx | 61 | react-setstate | `<input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedIdx(0); }}` |
| src/features/composer/ResourcePicker.tsx | 24 | react-useeffect | `useEffect(() => {` |
| src/features/composer/ResourcePicker.tsx | 26 | react-setstate | `setLoading(true);` |
| src/features/composer/ResourcePicker.tsx | 30 | react-setstate | `.catch(() => setItems([]))` |
| src/features/composer/ResourcePicker.tsx | 31 | react-setstate | `.finally(() => setLoading(false));` |
| src/features/composer/ResourcePicker.tsx | 42 | react-setstate | `<input type="text" value={search} onChange={(e) => setSearch(e.target.value)}` |
| src/features/runtime/components/RuntimeDiagnosticsPanel.tsx | 23 | react-setstate | `setLoading(true);` |
| src/features/runtime/components/RuntimeDiagnosticsPanel.tsx | 24 | react-setstate | `setError(null);` |
| src/features/runtime/components/RuntimeDiagnosticsPanel.tsx | 30 | react-setstate | `setProbe(probeResult);` |
| src/features/runtime/components/RuntimeDiagnosticsPanel.tsx | 31 | react-setstate | `setDiscovery(discoveryResult);` |
| src/features/runtime/components/RuntimeDiagnosticsPanel.tsx | 33 | react-setstate | `setError(String(e));` |
| src/features/runtime/components/RuntimeDiagnosticsPanel.tsx | 35 | react-setstate | `setLoading(false);` |
| src/features/runtime/services/interactionAdapter.ts | 4 | runtime-write-bypass | `*  Only this file calls pty_start_claude_session / pty_v2_write / etc.` |
| src/features/runtime/services/interactionAdapter.ts | 7 | direct-interaction-adapter | `export async function startPtyV2ClaudeSession(input: {` |
| src/features/runtime/services/interactionAdapter.ts | 20 | direct-interaction-adapter | `export async function writePtyV2(sessionId: string, data: string, traceId?: string \| null) {` |
| src/features/runtime/services/interactionAdapter.ts | 21 | direct-pty-invoke | `return invokeCommand('pty_v2_write', { sessionId, data, traceId: traceId ?? null });` |
| src/features/runtime/services/interactionAdapter.ts | 21 | runtime-write-bypass | `return invokeCommand('pty_v2_write', { sessionId, data, traceId: traceId ?? null });` |
| src/features/runtime/services/interactionAdapter.ts | 24 | direct-interaction-adapter | `export async function resizePtyV2(sessionId: string, cols: number, rows: number) {` |
| src/features/runtime/services/interactionAdapter.ts | 25 | direct-pty-invoke | `return invokeCommand('pty_v2_resize', { sessionId, cols, rows });` |
| src/features/runtime/services/interactionAdapter.ts | 29 | direct-pty-invoke | `return invokeCommand('pty_send_ctrl_c', { sessionId });` |
| src/features/runtime/services/interactionAdapter.ts | 33 | direct-pty-invoke | `return invokeCommand('pty_send_ctrl_d', { sessionId });` |
| src/features/runtime/services/interactionAdapter.ts | 36 | direct-interaction-adapter | `export async function stopPtyV2(sessionId: string) {` |
| src/features/runtime/services/interactionAdapter.ts | 37 | direct-pty-invoke | `return invokeCommand('pty_v2_stop', { sessionId });` |
| src/features/runtime/services/runtimeBridge.ts | 101 | direct-interaction-adapter | `await adapter.writePtyV2(uiSessionId, data, session.traceId);` |
| src/features/runtime/services/runtimeBridge.ts | 128 | direct-interaction-adapter | `await adapter.stopPtyV2(sessionId);` |
| src/features/runtime/services/runtimeBridge.ts | 134 | direct-interaction-adapter | `await adapter.resizePtyV2(sessionId, cols, rows);` |
| src/features/runtime/services/runtimeBridge.ts | 157 | direct-interaction-adapter | `await adapter.startPtyV2ClaudeSession({` |
| src/features/runtime/services/runtimeDiagnostics.ts | 21 | error-swallow | `} catch {}` |
| src/features/runtime/services/runtimeKernel.ts | 19 | react-setstate | `setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)` |
| src/features/runtime/services/runtimeKernel.ts | 47 | direct-interaction-adapter | `adapter.startPtyV2ClaudeSession({ sessionId, projectId, cwd }),` |
| src/features/runtime/stores/runtimeStore.ts | 17 | zustand-create | `export const useRuntimeStore = create<RuntimeState>((set) => ({` |
| src/features/runtime/stores/runtimeTraceStore.ts | 11 | zustand-create | `export const useRuntimeTraceStore = create<RuntimeTraceState>((set, get) => ({` |
| src/features/terminal/usePtyTerminal.ts | 9 | direct-interaction-adapter | `import { writePtyV2, resizePtyV2, sendCtrlCPtyV2, sendCtrlDPtyV2 } from '../runtime/services/interactionAdapter';` |
| src/features/terminal/usePtyTerminal.ts | 68 | react-useeffect | `useEffect(() => {` |
| src/features/terminal/usePtyTerminal.ts | 101 | error-swallow | `try { const wgl = new WebglAddon(); term.loadAddon(wgl); wgl.onContextLoss(() => wgl.dispose()); } catch {}` |
| src/features/terminal/usePtyTerminal.ts | 110 | tauri-listen | `listen<PtyDataPayload>('pty://data', (e) => {` |
| src/features/terminal/usePtyTerminal.ts | 110 | raw-pty-event | `listen<PtyDataPayload>('pty://data', (e) => {` |
| src/features/terminal/usePtyTerminal.ts | 115 | tauri-listen | `listen<PtyStatusPayload>('pty://status', (e) => {` |
| src/features/terminal/usePtyTerminal.ts | 115 | raw-pty-event | `listen<PtyStatusPayload>('pty://status', (e) => {` |
| src/features/terminal/usePtyTerminal.ts | 119 | react-setstate | `setStatus(newStatus);` |
| src/features/terminal/usePtyTerminal.ts | 122 | react-setstate | `listen<PtyExitPayload>('pty://exit', () => { setStatus('exited'); }).then((fn) => unlisteners.push(fn));` |
| src/features/terminal/usePtyTerminal.ts | 122 | tauri-listen | `listen<PtyExitPayload>('pty://exit', () => { setStatus('exited'); }).then((fn) => unlisteners.push(fn));` |
| src/features/terminal/usePtyTerminal.ts | 122 | raw-pty-event | `listen<PtyExitPayload>('pty://exit', () => { setStatus('exited'); }).then((fn) => unlisteners.push(fn));` |
| src/features/terminal/usePtyTerminal.ts | 123 | react-setstate | `listen<PtyErrorPayload>('pty://error', () => { setStatus('failed'); }).then((fn) => unlisteners.push(fn));` |
| src/features/terminal/usePtyTerminal.ts | 123 | tauri-listen | `listen<PtyErrorPayload>('pty://error', () => { setStatus('failed'); }).then((fn) => unlisteners.push(fn));` |
| src/features/terminal/usePtyTerminal.ts | 123 | raw-pty-event | `listen<PtyErrorPayload>('pty://error', () => { setStatus('failed'); }).then((fn) => unlisteners.push(fn));` |
| src/features/terminal/usePtyTerminal.ts | 126 | direct-interaction-adapter | `writePtyV2(sessionId, data).catch((e) => {` |
| src/features/terminal/usePtyTerminal.ts | 135 | react-setstate | `resizeTimer = setTimeout(() => {` |
| src/features/terminal/usePtyTerminal.ts | 139 | direct-interaction-adapter | `resizePtyV2(sessionId, dims.cols, dims.rows).catch((e) => warnLog('pty', 'PTY resize failed', String(e)));` |
| src/features/terminal/usePtyTerminal.ts | 145 | react-setstate | `setReady(true);` |
| src/features/terminal/usePtyTerminal.ts | 153 | react-setstate | `setReady(false);` |
| src/features/terminal/usePtyTerminal.ts | 157 | direct-interaction-adapter | `const write = useCallback((data: string) => { writePtyV2(sessionId!, data).catch((e) => warnLog('pty', 'PTY write failed', String(e))); }, [sessionId]);` |
| src/features/workspace/stores/workspaceStore.ts | 17 | zustand-create | `export const useWorkspaceStore = create<WorkspaceState>((set) => ({` |
| src/services/invokeCommand.ts | 13 | error-swallow | `} catch {}` |
| src/services/invokeCommand.ts | 22 | react-setstate | `setTimeout(() => reject(new Error(`Command "${cmd}" timed out`)), TIMEOUT_MS),` |
| src/services/invokeCommand.ts | 50 | error-swallow | `} catch {}` |
| src/stores/appStore.ts | 26 | zustand-create | `export const useAppStore = create<AppState>((set) => ({` |
| src/stores/auditStore.ts | 22 | zustand-create | `export const useAuditStore = create<AuditState>((set, get) => ({` |
| src/stores/errorStore.ts | 26 | zustand-create | `export const useErrorStore = create<ErrorState>((set, get) => ({` |
| src/stores/openSessionStore.ts | 14 | zustand-create | `export const useOpenSessionStore = create<OpenSessionState>((set) => ({` |
| src/stores/projectStore.ts | 17 | zustand-create | `export const useProjectStore = create<ProjectState>((set) => ({` |
| src/stores/sessionStore.ts | 13 | zustand-create | `export const useSessionStore = create<SessionState>((set, get) => ({` |
| src/stores/surfaceStore.ts | 10 | zustand-create | `export const useSurfaceStore = create<SurfaceState>((set) => ({` |
| src/surfaces/canvas/CanvasSurface.tsx | 48 | react-useeffect | `useEffect(() => {` |
| src/surfaces/canvas/CanvasSurface.tsx | 79 | react-setstate | `const hWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); setScale((s)=>Math.max(0.08,Math.min(5,s-e.deltaY*0.0008))); }, []);` |
| src/surfaces/canvas/CanvasSurface.tsx | 80 | react-setstate | `const hDown = useCallback((e: React.MouseEvent) => { const p=getPos(e); const hit=nodes.find((n)=>Math.hypot(n.x-p.x,n.y-p.y)<n.size+10); if(hit){setSelectedNode(hit.id);setDragging('node');setDragStart(p);}else{setDragging('pan');setDragSt` |
| src/surfaces/canvas/CanvasSurface.tsx | 81 | react-setstate | `const hMove = useCallback((e: React.MouseEvent) => { if(dragging==='pan'){setOffset({x:e.clientX-dragStart.x,y:e.clientY-dragStart.y});}else if(dragging==='node'&&selectedNode){const p=getPos(e);setNodePos((prev)=>({...prev,[selectedNode]:{` |
| src/surfaces/canvas/CanvasSurface.tsx | 82 | react-setstate | `const hUp = useCallback(() => setDragging(null), []);` |
| src/surfaces/canvas/CanvasSurface.tsx | 95 | react-setstate | `<button onClick={()=>{setScale(1);setOffset({x:0,y:0});}} style={bs}>{t('canvas.resetView')}</button>` |
| src/surfaces/canvas/CanvasSurface.tsx | 96 | react-setstate | `<button onClick={()=>setScale((s)=>s+0.25)} style={bs}>+</button>` |
| src/surfaces/canvas/CanvasSurface.tsx | 97 | react-setstate | `<button onClick={()=>setScale((s)=>Math.max(0.08,s-0.25))} style={bs}>-</button>` |
| src/surfaces/console/ConsoleSurface.tsx | 33 | react-useeffect | `useEffect(() => {` |
| src/surfaces/console/ConsoleSurface.tsx | 38 | react-setstate | `if (parsed.data) { setCap(parsed.data); setCapLoading(false); return; }` |
| src/surfaces/console/ConsoleSurface.tsx | 39 | error-swallow | `} catch {}` |
| src/surfaces/console/ConsoleSurface.tsx | 42 | react-setstate | `.then((c) => { setCap(c); localStorage.setItem('ctrl-cc-capability', JSON.stringify({ data: c, checkedAt: new Date().toISOString() })); })` |
| src/surfaces/console/ConsoleSurface.tsx | 43 | react-setstate | `.catch(() => setCap({ version: null, exists: false, authStatus: null, supportsStreamJson: false, checkedAt: new Date().toISOString(), errors: ['Detection failed'] }))` |
| src/surfaces/console/ConsoleSurface.tsx | 44 | react-setstate | `.finally(() => setCapLoading(false));` |
| src/surfaces/github/GitHubSurface.tsx | 17 | react-setstate | `onChange={(e) => setInputUrl(e.target.value)}` |
| src/surfaces/github/GitHubSurface.tsx | 18 | react-setstate | `onKeyDown={(e) => { if (e.key === 'Enter') setUrl(inputUrl); }}` |
| src/surfaces/github/GitHubSurface.tsx | 23 | react-setstate | `onClick={() => setUrl(inputUrl)}` |
| src/surfaces/github/GitHubSurface.tsx | 29 | react-setstate | `onClick={() => { setUrl('https://github.com'); setInputUrl('https://github.com'); }}` |
| src/surfaces/projects/ImportSessionDialog.tsx | 32 | react-setstate | `setSelected(next);` |
| src/surfaces/projects/ImportSessionDialog.tsx | 38 | react-setstate | `setSelected(new Set());` |
| src/surfaces/projects/NewProjectDialog.tsx | 23 | react-setstate | `setPicking(true);` |
| src/surfaces/projects/NewProjectDialog.tsx | 24 | react-setstate | `setError(null);` |
| src/surfaces/projects/NewProjectDialog.tsx | 28 | react-setstate | `setFolderPath(selected);` |
| src/surfaces/projects/NewProjectDialog.tsx | 31 | react-setstate | `setName(folderName);` |
| src/surfaces/projects/NewProjectDialog.tsx | 36 | react-setstate | `if (branch) setGitBranch(branch);` |
| src/surfaces/projects/NewProjectDialog.tsx | 40 | react-setstate | `setError(`${t('projects.folderSelectFailed')}: ${String(e)}`);` |
| src/surfaces/projects/NewProjectDialog.tsx | 42 | react-setstate | `setPicking(false);` |
| src/surfaces/projects/NewProjectDialog.tsx | 47 | react-setstate | `if (!name.trim()) { setError(t('projects.pleaseEnterName')); return; }` |
| src/surfaces/projects/NewProjectDialog.tsx | 48 | react-setstate | `if (!folderPath.trim()) { setError(t('projects.pleaseSelectFolder')); return; }` |
| src/surfaces/projects/NewProjectDialog.tsx | 50 | react-setstate | `setName('');` |
| src/surfaces/projects/NewProjectDialog.tsx | 51 | react-setstate | `setFolderPath('');` |
| src/surfaces/projects/NewProjectDialog.tsx | 52 | react-setstate | `setGitBranch(undefined);` |
| src/surfaces/projects/NewProjectDialog.tsx | 53 | react-setstate | `setError(null);` |
| src/surfaces/projects/NewProjectDialog.tsx | 57 | react-setstate | `setName('');` |
| src/surfaces/projects/NewProjectDialog.tsx | 58 | react-setstate | `setFolderPath('');` |
| src/surfaces/projects/NewProjectDialog.tsx | 59 | react-setstate | `setGitBranch(undefined);` |
| src/surfaces/projects/NewProjectDialog.tsx | 60 | react-setstate | `setError(null);` |
| src/surfaces/projects/NewProjectDialog.tsx | 74 | react-setstate | `onChange={(e) => setName(e.target.value)}` |
| src/surfaces/projects/NewProjectDialog.tsx | 88 | react-setstate | `onChange={(e) => setFolderPath(e.target.value)}` |
| src/surfaces/projects/ProjectsSurface.tsx | 9 | direct-interaction-adapter | `import { startPtyV2ClaudeSession } from '../../features/runtime/services/interactionAdapter';` |
| src/surfaces/projects/ProjectsSurface.tsx | 38 | react-setstate | `setSelectedProjectId(id);` |
| src/surfaces/projects/ProjectsSurface.tsx | 39 | react-setstate | `setSelectedSessionId(null);` |
| src/surfaces/projects/ProjectsSurface.tsx | 44 | react-setstate | `setScanning(true);` |
| src/surfaces/projects/ProjectsSurface.tsx | 45 | react-setstate | `setShowImportDialog(true);` |
| src/surfaces/projects/ProjectsSurface.tsx | 48 | react-setstate | `.catch(() => setScannedSessions([]))` |
| src/surfaces/projects/ProjectsSurface.tsx | 49 | react-setstate | `.finally(() => setScanning(false));` |
| src/surfaces/projects/ProjectsSurface.tsx | 69 | react-setstate | `setShowNewProjectDialog(true);` |
| src/surfaces/projects/ProjectsSurface.tsx | 83 | react-setstate | `setShowNewProjectDialog(false);` |
| src/surfaces/projects/ProjectsSurface.tsx | 91 | react-setstate | `setCreatingSession(true);` |
| src/surfaces/projects/ProjectsSurface.tsx | 114 | direct-interaction-adapter | `startPtyV2ClaudeSession({` |
| src/surfaces/projects/ProjectsSurface.tsx | 118 | error-swallow | `try { useSessionStore.getState().updateSession(sessionId, { status: 'running' as const }); } catch {}` |
| src/surfaces/projects/ProjectsSurface.tsx | 124 | error-swallow | `} catch {}` |
| src/surfaces/projects/ProjectsSurface.tsx | 125 | react-setstate | `}).finally(() => setCreatingSession(false));` |
| src/surfaces/projects/ProjectsSurface.tsx | 137 | direct-interaction-adapter | `startPtyV2ClaudeSession({` |
| src/surfaces/projects/ProjectsSurface.tsx | 140 | error-swallow | `try { useSessionStore.getState().updateSession(newId, { status: 'running' as const }); } catch {}` |
| src/surfaces/projects/ProjectsSurface.tsx | 142 | error-swallow | `try { useErrorStore.getState().addError({ severity: 'error', source: 'session', title: t('error.resumeSessionFailed'), detail: String(e) }); } catch {}` |
| src/surfaces/projects/ProjectsSurface.tsx | 166 | react-setstate | `onToggleCollapse={() => setProjectRailCollapsed((v) => !v)}` |
| src/surfaces/projects/ProjectsSurface.tsx | 173 | react-setstate | `onToggleCollapse={() => setSessionRailCollapsed((v) => !v)}` |
| src/surfaces/projects/ProjectsSurface.tsx | 189 | react-setstate | `onClose={() => setShowNewProjectDialog(false)}` |
| src/surfaces/projects/ProjectsSurface.tsx | 194 | react-setstate | `onClose={() => setShowImportDialog(false)}` |
| src/surfaces/resources/ResourcesSurface.tsx | 37 | react-useeffect | `useEffect(() => { invokeCommand<string>('get_home_dir').then(setHomeDir).catch(() => setHomeDir('')); }, []);` |
| src/surfaces/resources/ResourcesSurface.tsx | 37 | react-setstate | `useEffect(() => { invokeCommand<string>('get_home_dir').then(setHomeDir).catch(() => setHomeDir('')); }, []);` |
| src/surfaces/resources/ResourcesSurface.tsx | 44 | react-setstate | `setLoading(true); setError(null);` |
| src/surfaces/resources/ResourcesSurface.tsx | 45 | react-setstate | `try { setItems(await invokeCommand<ResourceItem[]>('list_directory', { path: basePath, maxDepth: 1 })); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 46 | react-setstate | `catch (e) { setError(String(e)); setItems([]); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 47 | react-setstate | `finally { setLoading(false); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 49 | react-useeffect | `useEffect(() => { loadItems(); }, [activeTab, homeDir]);` |
| src/surfaces/resources/ResourcesSurface.tsx | 52 | react-setstate | `setSelected(item); setEditing(false);` |
| src/surfaces/resources/ResourcesSurface.tsx | 54 | react-setstate | `try { setContent(await invokeCommand<string>('read_file_content', { path: item.path })); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 55 | react-setstate | `catch { setContent(t('resources.cannotRead')); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 56 | react-setstate | `} else { setContent(null); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 61 | react-setstate | `try { await invokeCommand('write_file_content', { path: selected.path, content: editContent }); setContent(editContent); setEditing(false); setStatusMsg(t('common.save')); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 62 | react-setstate | `catch (e) { setError(String(e)); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 67 | react-setstate | `try { await invokeCommand('delete_file', { path: selected.path }); setSelected(null); setContent(null); loadItems(); setStatusMsg(t('common.delete')); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 68 | react-setstate | `catch (e) { setError(String(e)); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 74 | react-setstate | `try { await invokeCommand('write_file_content', { path: newPath, content: newContent }); setShowNewForm(false); setNewName(''); setNewContent(''); loadItems(); setStatusMsg(t('common.create')); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 75 | react-setstate | `catch (e) { setError(String(e)); }` |
| src/surfaces/resources/ResourcesSurface.tsx | 78 | react-setstate | `const startEdit = () => { setEditContent(content \|\| ''); setEditing(true); };` |
| src/surfaces/resources/ResourcesSurface.tsx | 79 | react-setstate | `const cancelEdit = () => { setEditing(false); };` |
| src/surfaces/resources/ResourcesSurface.tsx | 88 | react-setstate | `<CcButton size="sm" onClick={() => setShowNewForm(true)}>+ {t('common.new')}</CcButton>` |
| src/surfaces/resources/ResourcesSurface.tsx | 94 | react-setstate | `<button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelected(null); setContent(null); }}` |
| src/surfaces/resources/ResourcesSurface.tsx | 148 | react-setstate | `<textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}` |
| src/surfaces/resources/ResourcesSurface.tsx | 171 | react-setstate | `<div style={{ marginBottom: 12 }}><label style={lbl}>{t('resources.name')}</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('resources.fileNamePlaceholder')} autoFocus style={inp} /></div` |
| src/surfaces/resources/ResourcesSurface.tsx | 172 | react-setstate | `<div style={{ marginBottom: 12 }}><label style={lbl}>{t('resources.content')}</label><textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder={t('resources.fileContentPlaceholder')} rows={6} style={{ ...inp, ` |
| src/surfaces/resources/ResourcesSurface.tsx | 174 | react-setstate | `<CcButton variant="ghost" onClick={() => setShowNewForm(false)}>{t('common.cancel')}</CcButton>` |
| src/surfaces/settings/SettingsSurface.tsx | 51 | react-setstate | `setCapLoading(true);` |
| src/surfaces/settings/SettingsSurface.tsx | 54 | react-setstate | `setCap(c);` |
| src/surfaces/settings/SettingsSurface.tsx | 55 | react-setstate | `localStorage.setItem('ctrl-cc-capability', JSON.stringify({ data: c, checkedAt: new Date().toISOString() }));` |
| src/surfaces/settings/SettingsSurface.tsx | 56 | react-setstate | `setStatusMsg(t('settings.envCheckComplete'));` |
| src/surfaces/settings/SettingsSurface.tsx | 58 | react-setstate | `.catch(() => setCap({ version: null, exists: false, authStatus: null, supportsStreamJson: false, supportsMCP: false, supportsAgents: false, checkedAt: new Date().toISOString(), errors: ['Detection failed'] }))` |
| src/surfaces/settings/SettingsSurface.tsx | 59 | react-setstate | `.finally(() => setCapLoading(false));` |
| src/surfaces/settings/SettingsSurface.tsx | 62 | react-useeffect | `useEffect(() => {` |
| src/surfaces/settings/SettingsSurface.tsx | 70 | react-setstate | `if (age < 5 * 60 * 1000) { setCap(parsed.data); setCapLoading(false); return; }` |
| src/surfaces/settings/SettingsSurface.tsx | 72 | error-swallow | `} catch {}` |
| src/surfaces/settings/SettingsSurface.tsx | 77 | react-useeffect | `useEffect(() => { localStorage.setItem('ctrl-cc-model', model); }, [model]);` |
| src/surfaces/settings/SettingsSurface.tsx | 77 | react-setstate | `useEffect(() => { localStorage.setItem('ctrl-cc-model', model); }, [model]);` |
| src/surfaces/settings/SettingsSurface.tsx | 78 | react-useeffect | `useEffect(() => { localStorage.setItem('ctrl-cc-effort', effort); }, [effort]);` |
| src/surfaces/settings/SettingsSurface.tsx | 78 | react-setstate | `useEffect(() => { localStorage.setItem('ctrl-cc-effort', effort); }, [effort]);` |
| src/surfaces/settings/SettingsSurface.tsx | 79 | react-useeffect | `useEffect(() => { localStorage.setItem('ctrl-cc-permMode', permMode); }, [permMode]);` |
| src/surfaces/settings/SettingsSurface.tsx | 79 | react-setstate | `useEffect(() => { localStorage.setItem('ctrl-cc-permMode', permMode); }, [permMode]);` |
| src/surfaces/settings/SettingsSurface.tsx | 80 | react-useeffect | `useEffect(() => { localStorage.setItem('ctrl-cc-autoTrust', String(autoTrust)); }, [autoTrust]);` |
| src/surfaces/settings/SettingsSurface.tsx | 80 | react-setstate | `useEffect(() => { localStorage.setItem('ctrl-cc-autoTrust', String(autoTrust)); }, [autoTrust]);` |
| src/surfaces/settings/SettingsSurface.tsx | 83 | react-setstate | `setCurrentTheme(themeId);` |
| src/surfaces/settings/SettingsSurface.tsx | 84 | react-setstate | `localStorage.setItem('ctrl-cc-theme', themeId);` |
| src/surfaces/settings/SettingsSurface.tsx | 90 | react-setstate | `localStorage.setItem('ctrlcc_lang', lang);` |
| src/surfaces/settings/SettingsSurface.tsx | 99 | react-setstate | `setStatusMsg(t('settings.diagExported'));` |
| src/surfaces/settings/SettingsSurface.tsx | 103 | react-setstate | `try { localStorage.clear(); setStatusMsg(t('settings.cacheCleared')); }` |
| src/surfaces/settings/SettingsSurface.tsx | 104 | react-setstate | `catch { setStatusMsg(t('settings.cacheClearFailed')); }` |
| src/surfaces/settings/SettingsSurface.tsx | 210 | react-setstate | `<input type="range" min={10} max={24} value={fontSize} onChange={(e) => { const v = parseInt(e.target.value); setFontSize(v); const scale = v / 14; document.documentElement.style.setProperty('--cc-font-scale', String(scale)); localStorage.s` |
| src/surfaces/settings/SettingsSurface.tsx | 257 | react-setstate | `<CcButton size="sm" variant="ghost" onClick={() => setStatusMsg('Permission Center active')}>{t('settings.manageRules')}</CcButton>` |
| src/surfaces/settings/SettingsSurface.tsx | 264 | react-setstate | `<S label={t('settings.autoTrust')} value={String(autoTrust)} onChange={(v) => setAutoTrust(parseInt(v))} opts={['0', '1', '2', '3', '4', '5']} />` |
| src/surfaces/settings/SettingsSurface.tsx | 276 | error-swallow | `<CcButton size="sm" variant="ghost" onClick={() => { try { const el = document.querySelector('[data-error-log]'); if (el) (el as HTMLElement).click(); } catch {} }}>{t('settings.viewErrorLog')}</CcButton>` |
| src/surfaces/workspace/ChatView.tsx | 12 | react-useeffect | `useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events.length]);` |
| src/surfaces/workspace/ComposerBar.tsx | 37 | react-setstate | `setText('');` |
| src/surfaces/workspace/ComposerBar.tsx | 47 | react-useeffect | `useEffect(() => {` |
| src/surfaces/workspace/ComposerBar.tsx | 60 | react-setstate | `<select value={runtimeMode} onChange={(e) => setRuntimeMode(e.target.value as RuntimeMode)} style={selectStyle} title={t('composerBar.pty')}>` |
| src/surfaces/workspace/ComposerBar.tsx | 64 | react-setstate | `<select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle} title={t('composerBar.model')}>` |
| src/surfaces/workspace/ComposerBar.tsx | 67 | react-setstate | `<select value={effort} onChange={(e) => setEffort(e.target.value)} style={selectStyle} title={t('composerBar.effort')}>` |
| src/surfaces/workspace/ComposerBar.tsx | 70 | react-setstate | `<select value={permissionMode} onChange={(e) => setPermissionMode(e.target.value as PermissionMode)} style={selectStyle} title={t('composerBar.permission')}>` |
| src/surfaces/workspace/ComposerBar.tsx | 74 | react-setstate | `<button style={hintBtnStyle} title={t('composerBar.resourcePicker')} onClick={() => setShowResourcePicker(!showResourcePicker)}>@</button>` |
| src/surfaces/workspace/ComposerBar.tsx | 75 | react-setstate | `<ResourcePicker open={showResourcePicker} onClose={() => setShowResourcePicker(false)} onSelect={(r) => { setText((t) => t + ' ' + r + ' '); inputRef.current?.focus(); }} />` |
| src/surfaces/workspace/ComposerBar.tsx | 78 | react-setstate | `<button style={hintBtnStyle} title={t('composerBar.commandPalette')} onClick={() => setShowCommandPalette(!showCommandPalette)}>/</button>` |
| src/surfaces/workspace/ComposerBar.tsx | 79 | react-setstate | `<CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} onSelect={(c) => { setText((t) => t + ' ' + c + ' '); inputRef.current?.focus(); }} />` |
| src/surfaces/workspace/ComposerBar.tsx | 86 | react-setstate | `onChange={(e) => setText(e.target.value)}` |
| src/surfaces/workspace/TerminalView.tsx | 10 | react-setstate | `const containerCb = useCallback((node: HTMLDivElement \| null) => setContainer(node), []);` |
| src/surfaces/workspace/TerminalView.tsx | 15 | react-useeffect | `useEffect(() => {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 7 | direct-interaction-adapter | `import { startPtyV2ClaudeSession, stopPtyV2 } from '../../features/runtime/services/interactionAdapter';` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 80 | react-useeffect | `useEffect(() => {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 82 | react-setstate | `if (tab?.viewMode) setViewMode(tab.viewMode);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 85 | react-useeffect | `useEffect(() => {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 86 | tauri-listen | `listen<RuntimeEvent>('runtime:event', (e) => {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 88 | react-setstate | `setRawEvents((prev) => {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 107 | react-setstate | `setError(`${t('workspace.sendFailed')}: Runtime not ready (status=${status}, ptySessionId=${ptyId})`);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 118 | react-setstate | `setRawEvents((prev) => [...prev, {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 126 | react-setstate | `setError(`${t('workspace.sendFailed')}: ${msg}`);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 127 | error-swallow | `try { useErrorStore.getState().addError({ severity: 'error', source: 'session', title: 'Send failed', detail: msg }); } catch {}` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 134 | react-setstate | `setRawEvents((prev) => [...prev, {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 142 | react-setstate | `setError(`${t('workspace.sendFailed')}: ${msg}`);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 143 | error-swallow | `try { useErrorStore.getState().addError({ severity: 'error', source: 'session', title: 'Send failed', detail: msg }); } catch {}` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 151 | react-setstate | `setError(null);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 180 | react-setstate | `setShowNewSessionDialog(false);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 181 | react-setstate | `setShowNewProjectFromSession(false);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 182 | react-setstate | `setStarting(true);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 185 | direct-interaction-adapter | `startPtyV2ClaudeSession({ sessionId, projectId, cwd, cliPath: 'claude', extraArgs: [] }).then((info) => {` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 186 | error-swallow | `try { useErrorStore.getState().addError({ severity: 'info', source: 'session', title: `${t('error.ptySessionCreated')}: ${info.sessionId?.slice(0, 8)}...`, detail: `CWD: ${cwd}` }); } catch {}` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 190 | error-swallow | `} catch {}` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 192 | react-setstate | `setError(`${t('workspace.startFailed')}: ${String(err)}`);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 196 | error-swallow | `} catch {}` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 197 | react-setstate | `}).finally(() => setStarting(false));` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 201 | direct-interaction-adapter | `stopPtyV2(sessionId).catch((e) => console.warn('pty_v2_stop failed:', e));` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 206 | react-setstate | `setShowNewSessionDialog(true);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 214 | react-setstate | `setShowNewSessionDialog(false);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 215 | react-setstate | `setShowNewProjectFromSession(true);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 226 | react-setstate | `setShowNewProjectFromSession(false);` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 250 | react-setstate | `return <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '4px 14px', fontSize: 'var(--cc-font-xs)', fontWeight: a ? 600 : 400, border: 'none', borderBottom: a ? '2px solid var(--cc-navy)' : '2px solid transparent', back` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 261 | react-setstate | `<SessionInspector session={activeSession} events={rawEvents.slice(0, 200)} collapsed={inspectorCollapsed} expanded={inspectorExpanded} onToggleCollapse={() => setInspectorCollapsed((v) => !v)} onToggleExpand={() => setInspectorExpanded((v) ` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 267 | react-setstate | `<NewSessionDialog open={showNewSessionDialog} onClose={() => setShowNewSessionDialog(false)} onSelectProject={handleSelectProject} onCreateNew={handleCreateNewProject} />` |
| src/surfaces/workspace/WorkspaceSurface.tsx | 268 | react-setstate | `<NewProjectDialog open={showNewProjectFromSession} onClose={() => setShowNewProjectFromSession(false)} onConfirm={handleConfirmNewProject} />` |
# Part 4：PTY Runtime 与 Claude Code CLI 真连接执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：让 Ctrl-CC 在应用内部直接打开真实 Claude Code CLI，Terminal View 尽可能等价于 PowerShell / Windows Terminal 中的 Claude Code 体验。

---

## 1. 阶段目标

实现 PTY-first Runtime：

```text
Rust backend：portable-pty / Windows ConPTY
Frontend：xterm.js
Claude Code：真实 interactive CLI
ChatComposer：向 PTY 写入输入
TerminalPanel：显示原始终端
Semantic Parser：生成 RuntimeEvent
RawLog：保存原始输出
```

---

## 2. 后端模块

创建：

```text
src-tauri/src/pty/
├── mod.rs
├── pty_session.rs
├── pty_manager.rs
├── pty_commands.rs
├── pty_types.rs
├── pty_log.rs
└── pty_parser.rs
```

### 2.1 Tauri Commands

```text
pty_check_support
pty_start_claude_session
pty_write
pty_resize
pty_send_ctrl_c
pty_send_ctrl_d
pty_stop
pty_get_status
pty_get_raw_log
pty_export_log_bundle
```

### 2.2 事件

```text
pty://data
pty://exit
pty://error
pty://status
pty://semantic-event
```

---

## 3. 前端集成

TerminalPanel 使用：

```text
@xterm/xterm
@xterm/addon-fit
@xterm/addon-search
@xterm/addon-web-links
@xterm/addon-serialize
```

支持：输入、输出、Ctrl+C、Ctrl+D、resize、复制粘贴、搜索、打开 raw log、导出 bundle。

---

## 4. Session 启动流程

```text
用户在 Projects 或 Workspace 点击新建会话
→ 选择 project cwd
→ 选择 runtimeMode = pty-interactive
→ 选择 model / permission / resources
→ 生成 command preview
→ 调用 pty_start_claude_session
→ 后端启动 Claude Code CLI
→ 前端 Terminal View 显示真实输出
→ Session 状态变为 running/waiting
→ 写 AuditLog(session_started)
```

---

## 5. Chat 输入到 PTY

```text
ChatComposer.send(text)
→ pty_write(sessionId, text + "\r")
→ 终端输出变化
→ raw log 保存
→ semantic parser 尽力解析
→ RuntimeEvent
→ Chat View 卡片显示
```

---

## 6. Raw Log

每个会话保存：pty_raw.bin、pty_utf8.log、pty_ansi.log、pty_events.jsonl、pty_command.json、pty_size_events.jsonl。

---

## 7. Semantic Parser

尽力识别 user input、assistant output、permission prompt、tool use、bash command、file read、file edit、diff、error、done、risk pattern、agent event、mcp event。识别不了就保留 raw，不得丢弃。

---

## 8. 风险规则

检测但不强行干预用户手动终端输入：rm -rf、del /s、rmdir、git reset --hard、git clean -fd、git push --force、.env、token、key、secret、bypassPermissions。

如果输入来自 GUI AutoTrust 自动操作，则必须阻断高风险。

---

## 9. 验收标准

```text
[ ] 可以在 Terminal View 中真实启动 Claude Code CLI
[ ] 键盘输入可进入 Claude CLI
[ ] ChatComposer 输入可进入 Claude CLI
[ ] Ctrl+C 可中断
[ ] resize 可同步
[ ] raw log 保存
[ ] RuntimeEvent 生成
[ ] Chat View 能显示语义卡片
[ ] Inspector 能查看 raw log / audit / risk
[ ] 停止会话后无残留进程
[ ] build/typecheck/cargo check 通过
```

---

## 10. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 4：PTY Runtime 与 Claude Code CLI 真连接。

目标：
在应用内部通过 PTY 真实运行 Claude Code CLI，让 Terminal View 尽可能等价于 PowerShell / Windows Terminal 中运行 claude 的体验。

要求：
1. 使用 portable-pty / Windows ConPTY。
2. 前端使用 xterm.js。
3. 实现 pty_start_claude_session、pty_write、pty_resize、pty_send_ctrl_c、pty_stop 等 commands。
4. raw output 必须保存。
5. output 必须通过 event 推送到前端。
6. ChatComposer 必须能向 PTY 写入用户输入。
7. Semantic Parser 只做 best effort，不能伪造 Claude 内部状态。
8. 所有操作写 AuditLog。
9. 高风险操作必须进入 RiskItem。
10. 停止会话后不得残留进程。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

并手动测试：
1. 新建项目
2. 新建 PTY 会话
3. Terminal View 看到 Claude CLI
4. Chat 输入一句话
5. Claude 有响应
6. Ctrl+C 生效
7. 停止会话
8. 无残留进程

输出测试报告。
```

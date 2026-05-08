# Ctrl-CC PTY-first Runtime 设计

## 核心理念

Claude Code 是交互式 CLI。要完整承载其功能，GUI 不能只通过 pipe/stdout 调用它。必须使用 PTY，因为 PTY 能提供真实终端语义。

PTY 能提供：
- Ctrl+C / Ctrl+D 信号
- 方向键 / 终端 resize
- ANSI 输出 / 终端 title
- 交互式 picker (模型选择、会话恢复)
- permission prompt / slash command
- Shift+Tab 模式切换 / Alt+P 模型切换

## Runtime 架构

```
RuntimeBridge
├── PtyInteractiveRuntime       ← 默认主路径
│   ├── portable-pty / Windows ConPTY
│   ├── xterm.js render
│   ├── raw byte log
│   ├── ANSI / OSC pass-through
│   ├── semantic event extractor
│   └── terminal replay
├── StructuredPrintRuntime      ← 辅助路径
│   ├── claude -p
│   ├── output-format stream-json
│   ├── event normalizer
│   └── strict JSON task
└── RuntimeCoordinator
    ├── session lifecycle
    ├── risk engine
    ├── audit writer
    ├── capability matrix
    └── fallback policy
```

## PTY 主链路

```
用户输入
→ ChatComposer / TerminalPanel
→ ptyRuntimeStore
→ Tauri Command (pty_write / pty_resize / pty_send_ctrl_c ...)
→ Rust PtySessionManager
→ portable-pty / Windows ConPTY
→ Claude Code interactive CLI
→ raw bytes / ANSI / stderr / OSC title
→ 三路并行:
   ├── xterm.js 显示 (原始终端渲染)
   ├── raw log 保存 (pty_raw.bin / utf8.log / ansi.log / events.jsonl)
   └── semantic parser → RuntimeEvent → AuditLog / RiskItem
→ Chat / Inspector / Console / Dock / Canvas 更新
```

## PTY 后端模块

```
src-tauri/src/pty/
├── mod.rs
├── pty_session.rs      # PtySessionHandle — spawn/write/resize/kill
├── pty_manager.rs      # PtyManager — 会话注册表
├── pty_commands.rs     # 10 个 Tauri Commands
├── pty_types.rs        # 类型定义
├── pty_log.rs          # 原始日志写入 (6 文件/会话)
└── pty_parser.rs       # 语义解析器 MVP
```

## Tauri Commands (10 个)

1. `pty_check_support` — 检查系统 PTY 支持
2. `pty_start_claude_session` — 启动 Claude PTY 会话
3. `pty_write` — 写入 stdin
4. `pty_resize` — 调整窗口大小
5. `pty_send_ctrl_c` — 发送 SIGINT
6. `pty_send_ctrl_d` — 发送 EOF
7. `pty_stop` — 停止/终止
8. `pty_get_status` — 获取状态
9. `pty_get_raw_log` — 检索原始日志
10. `pty_export_log_bundle` — 导出日志包

## Tauri Events (5 个)

- `pty://data` — 原始字节输出
- `pty://exit` — 会话退出
- `pty://error` — 错误
- `pty://status` — 状态变更
- `pty://semantic-event` — 语义事件

## 原始日志 (6 文件/会话)

- `pty_raw.bin` — 原始二进制
- `pty_utf8.log` — UTF-8 文本
- `pty_ansi.log` — 带 ANSI 转义码
- `pty_events.jsonl` — JSONL 语义事件
- `pty_command.json` — 启动命令元数据
- `pty_size_events.jsonl` — resize 事件

# Claude CLI Capability Probe

**日期**: 2026-05-11
**环境**: Windows 10 Home China 10.0.19045

---

## 检测结果

| 项目 | 结果 |
|------|------|
| **PATH 位置** | `C:\Users\48304\AppData\Roaming\npm\claude` |
| **版本** | 2.1.138 (Claude Code) |
| **认证状态** | ✅ authenticated (oauth_token, firstParty) |
| **Stream-JSON** | ✅ 支持 (`--output-format stream-json --include-partial-messages`) |
| **MCP** | ✅ 支持 |
| **Agents** | ✅ 支持 |

## 命令输出

```
$ claude --version
2.1.138 (Claude Code)

$ claude auth status
{
  "loggedIn": true,
  "authMethod": "oauth_token",
  "apiProvider": "firstParty"
}
```

## PTY 兼容性

| 项目 | 状态 |
|------|------|
| portable-pty | ✅ v0.9 |
| Windows ConPTY | ✅ 原生支持 |
| tokio async | ✅ `spawn_blocking` 包装 |
| xterm-256color | ✅ TERM 环境变量已设置 |
| truecolor | ✅ COLORTERM + FORCE_COLOR 已设置 |

## 结论

Claude Code CLI 已完整安装、认证并就绪。Ctrl-CC 的 PTY 后端可以正常启动交互式 Claude CLI 会话。

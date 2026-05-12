# Ctrl-CC 终极修复方案 — Claude CLI 启动 + Chat 全功能

**日期**: 2026-05-11
**依据**: 官方方案文档 + Gemini 建议 + ChatGPT 建议 三方综合
**核心结论**: 在 PTY 中通过 Shell Adapter 启动 Claude CLI，使用 `which` + `npx` 双保险路径检测

---

## 0. 核心原则

### 0.1 路径检测：永不硬编码

每个用户的 Claude CLI 安装位置不同。必须通过以下优先级链动态检测：

```
1. which::which("claude")           → 系统 PATH 中的 claude
2. %APPDATA%/npm/claude.cmd        → Windows npm 全局安装
3. %LOCALAPPDATA%/npm/claude.cmd   → Windows npm 本地安装  
4. npx -y @anthropic-ai/claude-code → 终极兜底：直接通过 npx 运行
```

检测结果缓存到 `localStorage`，每天首次启动时刷新。

### 0.2 PTY 启动：Shell Adapter 模式

```
Windows:   cmd /d /s /c "claude --permission-mode default"
macOS/Linux: bash -lc "exec claude --permission-mode default"
```

不使用 `/c claude.cmd` 的直接路径（避免 CreateProcess 路径问题）。
让 Shell 自己通过 PATH 解析 `claude` 命令。

### 0.3 架构：三合一

```
Terminal View (xterm.js)  = 事实来源 —— 用户看到真实 Claude CLI
Chat View (React)         = 语义增强 —— 解析输出生成卡片
Composer Bar              = 友好输入 —— 文本写入当前 PTY stdin
```

---

## 1. 路径检测：动态发现 Claude CLI

### 1.1 Rust 后端代码

**文件**: `src-tauri/src/runtime/claude_discovery.rs`（重写）

```rust
use crate::runtime::event_payloads::ClaudeCapabilityPayload;
use std::process::Command;

/// 多策略发现 Claude CLI 路径（跨平台、跨安装方式）
pub fn discover_claude_path() -> Option<String> {
    // Strategy 1: which (系统 PATH)
    if let Ok(path) = which::which("claude") {
        let p = path.to_string_lossy().to_string();
        log::info!("Claude CLI found via which: {}", p);
        return Some(p);
    }
    
    // Strategy 2: 已知安装路径
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            std::env::var("APPDATA").map(|d| format!("{}\\npm\\claude.cmd", d)),
            std::env::var("LOCALAPPDATA").map(|d| format!("{}\\npm\\claude.cmd", d)),
            std::env::var("USERPROFILE").map(|d| format!("{}\\AppData\\Roaming\\npm\\claude.cmd", d)),
            std::env::var("ProgramFiles").map(|d| format!("{}\\nodejs\\claude.cmd", d)),
        ];
        for cand in candidates.iter().flatten() {
            if std::path::Path::new(cand).exists() {
                log::info!("Claude CLI found at known path: {}", cand);
                return Some(cand.clone());
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let candidates = [
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude",
            format!("{}/.local/bin/claude", std::env::var("HOME").unwrap_or_default()),
        ];
        for cand in &candidates {
            if std::path::Path::new(cand).exists() {
                return Some(cand.to_string());
            }
        }
    }
    
    // Strategy 3: npx (终极兜底)
    if npx_available() {
        log::info!("Claude CLI not found; will use npx @anthropic-ai/claude-code");
        return Some("npx".to_string());  // 标记使用 npx 模式
    }
    
    log::warn!("Claude CLI not found by any strategy");
    None
}

fn npx_available() -> bool {
    Command::new("npx").arg("--version").output().is_ok()
}

pub fn get_claude_command() -> Vec<String> {
    match discover_claude_path() {
        Some(ref path) if path == "npx" => {
            vec!["npx".to_string(), "-y".to_string(), "@anthropic-ai/claude-code".to_string()]
        }
        Some(path) => vec![path],
        None => vec!["claude".to_string()],
    }
}
```

### 1.2 前端缓存

**文件**: `src/stores/appStore.ts`

```typescript
interface CapabilityCache {
  claudePath: string | null;
  version: string | null;
  authOk: boolean;
  checkedAt: string;  // ISO timestamp
}

// 读取缓存时检查是否在 24 小时内
function isCacheValid(): boolean {
  const raw = localStorage.getItem('ctrl-cc-capability');
  if (!raw) return false;
  try {
    const cache: CapabilityCache = JSON.parse(raw);
    const age = Date.now() - new Date(cache.checkedAt).getTime();
    return age < 24 * 60 * 60 * 1000;  // 24 小时
  } catch { return false; }
}
```

---

## 2. PTY 启动：Shell Adapter 模式

### 2.1 Rust PTY 生成代码

**文件**: `src-tauri/src/pty/pty_session.rs`（核心修改）

```rust
pub fn spawn(options: PtyStartOptions, app: AppHandle) -> Result<Self, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let log_writer = PtyLogWriter::new(&id)?;
    let valid_cwd = resolve_cwd(&options.cwd);
    
    let pty_system = native_pty_system();
    
    // === 核心：构建 Claude CLI 命令 ===
    // 使用 cmd /d /s /c "claude ..." 模式（Windows）
    // 使用 bash -lc "exec claude ..." 模式（Unix）
    
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = CommandBuilder::new("cmd");
        // /d: 禁用 AutoRun
        // /s: 修改引号处理
        // /c: 执行命令后退出
        // 注意：不传完整路径，让 cmd 通过 PATH 解析 claude
        c.args(["/d", "/s", "/c", "claude --permission-mode default"]);
        c
    };
    
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = CommandBuilder::new("bash");
        c.args(["-lc", "exec claude --permission-mode default"]);
        c
    };
    
    cmd.cwd(&valid_cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("FORCE_COLOR", "1");
    cmd.env("CLICOLOR_FORCE", "1");
    cmd.env("CI", "false");  // 确保 CLI 进入交互模式
    
    // ... 其余 PTY 创建逻辑不变 ...
}
```

### 2.2 为什么这样能工作

```
cmd /d /s /c "claude --permission-mode default"
```

1. `cmd` 是 Windows 自带命令解释器，Tauri 进程一定能找到
2. `/d /s /c` 是标准 Windows shell adapter 参数
3. `"claude --permission-mode default"` 作为整体传给 cmd
4. cmd 通过自己的 PATH 解析 `claude`（npm 全局路径在用户 PATH 中）
5. 用户登录时的 PATH 包含 `%APPDATA%\npm`，cmd 继承这个 PATH

与之前失败方式的区别：
- ❌ `cmd /c "C:\Users\...\claude.cmd"` — 完整路径导致 portable-pty 引号问题
- ✅ `cmd /d /s /c "claude ..."` — 让 shell 自己解析命令名

---

## 3. 前端集成：完整的 WorkspaceSurface

### 3.1 架构

```
WorkspaceSurface
├── OpenSessionTabs          ← 多标签管理
├── 视图切换 (chat/terminal/split)
├── TerminalView             ← xterm.js 真实终端（事实来源）
├── ChatView                 ← 聊天语义视图（用户气泡 + AI 卡片）
├── ComposerBar              ← 输入框（写入 PTY）
├── SessionInspector         ← 侧边监控面板
├── NewSessionDialog         ← 新建会话弹窗
└── NewProjectDialog         ← 新建项目弹窗
```

### 3.2 会话创建完整流程

```
用户点击 "新建会话"
  → NewSessionDialog 弹出
  → 用户选择项目
  → startSessionWithProject(projectId, projectPath)
  → 从 projectStore 获取 CWD
  → invokeCommand('pty_start_claude_session', { sessionId, projectId, cliPath: 'claude', cwd, extraArgs: [] })
  → Rust PtySessionHandle::spawn()
  → portable-pty 创建 PTY
  → cmd /d /s /c "claude --permission-mode default"
  → PTY reader thread 开始读取
  → emit pty://data 事件
  → 前端 TerminalView 收到事件 → xterm.write(data)
  → 用户看到 Claude CLI 界面
  → 在 xterm 中直接输入 → xterm.onData → pty_write
  → 或在 ComposerBar 输入 → pty_write
```

### 3.3 会话恢复/继续

```typescript
// 继续最近会话
const handleContinue = async (projectId: string) => {
  await invokeCommand('pty_start_claude_session', {
    sessionId: `ses-${Date.now()}`,
    projectId,
    cliPath: 'claude',
    cwd: projectPath,
    extraArgs: ['--continue'],  // Claude CLI 的 --continue 参数
  });
};

// 恢复指定会话
const handleResume = async (claudeSessionId: string) => {
  await invokeCommand('pty_start_claude_session', {
    sessionId: `ses-${Date.now()}`,
    projectId,
    cliPath: 'claude',
    cwd: projectPath,
    extraArgs: ['--resume', claudeSessionId],
  });
};
```

---

## 4. Chat View 语义增强

### 4.1 数据流

```
PTY raw bytes
  → xterm.js 渲染（用户可见）
  → raw log 保存
  → RuntimeEvent 标准化
    → ChatBlockRenderer 渲染卡片
      ├── UserBubble       (来自 ComposerBar 输入)
      ├── AssistantBubble  (AI 文本回复)
      ├── ToolCard         (工具调用)
      ├── FileChangeCard   (文件变更)
      ├── PermissionCard   (权限请求)
      ├── ErrorCard        (错误信息)
      └── ... 等
```

### 4.2 RuntimeEvent 类型扩展

```typescript
export type RuntimeEventType =
  | 'user_message'           // ComposerBar 输入
  | 'assistant_message'      // AI 文本回复
  | 'assistant_delta'        // 流式增量
  | 'tool_use'               // 工具调用
  | 'tool_result'            // 工具结果
  | 'thinking'               // 思考过程
  | 'thinking_delta'         // 思考增量
  | 'permission_requested'   // 权限请求
  | 'permission_resolved'    // 权限结果
  | 'file_created'           // 文件创建
  | 'file_edited'            // 文件编辑
  | 'file_deleted'           // 文件删除
  | 'command_started'        // Bash 命令开始
  | 'command_completed'      // Bash 命令完成
  | 'error'                  // 错误
  | 'summary'                // 总结
  | 'token_usage'            // Token 使用
  | 'cost_update'            // 费用更新
  | 'system_init'            // 系统初始化
  | 'terminal_raw_output';   // 原始终端输出
```

---

## 5. 执行清单

### Phase 1: 修复路径检测 (1 文件)
- [ ] `src-tauri/src/runtime/claude_discovery.rs`: 重写 `discover_claude_path` 多策略检测
- [ ] `src-tauri/src/runtime/commands.rs`: `claude_check_capability` 使用新的发现函数

### Phase 2: 修复 PTY 启动 (2 文件)
- [ ] `src-tauri/src/pty/pty_session.rs`: 使用 `cmd /d /s /c "claude ..."` Shell Adapter 模式
- [ ] `src-tauri/src/runtime/pty_session.rs`: 同步修复新 PTY 系统

### Phase 3: 前端路径缓存 + 设置页 (2 文件)
- [ ] `src/stores/appStore.ts`: 添加 `claudePath` 缓存到 localStorage
- [ ] `src/surfaces/settings/SettingsSurface.tsx`: "重新检测"按钮放入环境卡片内

### Phase 4: 会话操作完善 (2 文件)
- [ ] `src/surfaces/workspace/WorkspaceSurface.tsx`: 添加 --continue/--resume 支持
- [ ] `src/surfaces/projects/ProjectsSurface.tsx`: 按钮支持继续/恢复操作

### Phase 5: 构建验证
- [ ] `tsc --noEmit` → 0 errors
- [ ] `cargo check` → 0 errors, 0 warnings
- [ ] `npm run tauri:build` → NSIS 安装程序

---

## 6. 验证标准

```text
[ ] GUI 设置页自动检测到 Claude CLI（不需手动配置路径）
[ ] 新建会话 → Terminal 真实出现 Claude Code CLI 界面
[ ] 键盘输入、中文、Ctrl+C、Ctrl+D 正常工作
[ ] Chat Composer 输入进入同一 PTY 会话
[ ] --continue / --resume 正常工作
[ ] 关闭 App 重启 → 环境检测缓存有效（不重复检测）
[ ] NSIS 打包成功
```

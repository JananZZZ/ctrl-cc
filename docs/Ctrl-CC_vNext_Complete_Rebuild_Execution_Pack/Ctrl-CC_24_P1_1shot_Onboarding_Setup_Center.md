# Ctrl-CC 24.0 / PLAN-P1：复刻 1shot-CC 功能的首次启动引导与环境配置中心

目标：把 1shot-CC 的小白友好环境部署能力完整迁移到 Ctrl-CC，但 UI、视觉、交互必须符合 Ctrl-CC 当前四主题设计规范。

---

## 0. 产品定位

Ctrl-CC 的首次引导不是“诊断页”，而是一个完整的部署向导：

```text
欢迎 → 检测已有环境 → 安装缺失依赖 → 配置 Claude Code CLI → 配置 API Provider → 验证 → 进入主程序
```

部署对象：

```text
Claude Code CLI
```

不是：

```text
Claude Desktop App
```

---

## 1. 必须复刻 1shot-CC 的功能清单

完整迁移功能：

```text
1. Node.js 检测
2. npm 检测
3. Git 检测
4. Git Bash 检测
5. Claude Code CLI 检测
6. PowerShell 执行策略检测与修复
7. npm registry 检测与镜像配置
8. Windows Terminal 检测
9. PATH 解析检测
10. 中文路径 / APPDATA 路径风险检测
11. Claude settings.json 检测
12. .claude.json onboarding 检测
13. API Provider 配置
14. settings.json 备份
15. API Key 脱敏读取
16. 安装任务进度推送
17. 错误诊断知识库
18. 完成页
19. 非首次启动环境不完整提醒
20. 诊断包导出
```

---

## 2. 新建 Setup Domain

新建目录：

```text
src/features/setup/
src/features/setup/types/
src/features/setup/stores/
src/features/setup/services/
src/features/setup/components/
src/features/setup/styles/

src-tauri/src/setup/
```

Rust：

```text
src-tauri/src/setup/mod.rs
src-tauri/src/setup/types.rs
src-tauri/src/setup/detector.rs
src-tauri/src/setup/installer.rs
src-tauri/src/setup/config_writer.rs
src-tauri/src/setup/error_resolver.rs
src-tauri/src/setup/path_helper.rs
src-tauri/src/setup/subprocess_runner.rs
src-tauri/src/setup/task_manager.rs
src-tauri/src/setup/commands.rs
```

---

## 3. SetupSnapshot 标准数据结构

前后端统一：

```ts
export type SetupItemId =
  | 'nodejs'
  | 'npm'
  | 'git'
  | 'gitBash'
  | 'claudeCode'
  | 'claudeCommand'
  | 'claudeAuth'
  | 'claudeConfig'
  | 'windowsTerminal'
  | 'powershellPolicy'
  | 'npmRegistry'
  | 'pathEnv'
  | 'pathIssues'
  | 'workspace'
  | 'apiProvider';

export interface SetupCheckResult {
  id: SetupItemId;
  label: string;
  status: 'ok' | 'warning' | 'missing' | 'error' | 'checking' | 'installing';
  installed: boolean;
  ok: boolean;
  required: boolean;
  version?: string;
  latestVersion?: string;
  outdated?: boolean;
  paths: string[];
  method?: string;
  message?: string;
  error?: string;
  fixHint?: string;
  details?: Record<string, unknown>;
}

export interface SetupSnapshot {
  generatedAt: string;
  ready: boolean;
  severity: 'ok' | 'warning' | 'error';
  summary: string;
  checks: Record<SetupItemId, SetupCheckResult>;
  claudeCommands: ClaudeCommandCapability[];
  selectedChatCommandId: string | null;
  selectedTerminalCommandId: string | null;
}
```

---

## 4. 首次启动 Wizard 设计

组件：

```text
src/features/setup/components/FirstRunSetupWizard.tsx
```

步骤：

```text
Step 1 欢迎
Step 2 环境检测
Step 3 依赖安装 / 修复
Step 4 Claude Code CLI 配置
Step 5 API Provider 配置
Step 6 最终验证
Step 7 完成
```

### 4.1 欢迎页文案

```text
欢迎使用 Ctrl-CC
我们将帮助你部署 Claude Code CLI 环境。
这不是 Claude 桌面端应用，而是用于项目开发的命令行工具。
```

按钮：

```text
开始检测
稍后再配置
```

### 4.2 检测页

布局：

```text
左侧：步骤条
右侧：检测卡片网格
底部：重新检测 / 下一步
```

每项显示：

```text
图标
名称
状态
版本
路径
修复建议
```

### 4.3 修复页

按风险分区：

```text
安全配置：
- npm 镜像源
- PowerShell 执行策略
- .claude.json onboarding

需要安装：
- Node.js LTS
- Git for Windows
- Claude Code CLI

手动确认：
- 安装命令预览
- 复制命令
- 执行安装
```

### 4.4 API Provider 配置页

Provider：

```text
官方 Claude 登录
DeepSeek
智谱 GLM
MiniMax
小米 MiMo
通义千问
自定义 Anthropic-compatible API
```

字段：

```text
Provider
Base URL
API Key
Haiku Model
Sonnet Model
Opus Model
```

功能：

```text
测试连接
保存配置
备份原配置
显示脱敏信息
```

### 4.5 最终验证

执行：

```text
claude --version
claude doctor
Chat print smoke test
Workspace write permission check
```

但 smoke test 默认只检测可启动，不自动消耗 API。需要用户点击“运行联网验证”才真正请求模型。

---

## 5. 非首次启动逻辑

### 5.1 App 启动不自动检测

不要首次启动主程序就后台跑一堆检测。改为：

```text
首次启动：进入 Wizard 时检测。
非首次启动：Console 环境卡显示缓存结果；用户点击按钮刷新。
```

### 5.2 Console 环境卡按钮

无缓存时：

```text
检测环境配置
```

已有缓存时：

```text
刷新环境配置
```

环境不完整：

```text
进入配置向导
```

### 5.3 Workspace 中环境不完整

Chat 输入框 placeholder：

```text
Claude Code CLI 尚未配置完成，请先完成环境配置
```

点击输入框：

```text
打开 Setup Center
```

不允许无限写错误日志。

---

## 6. 安装任务系统

Rust 后端通过 Tauri event 推送：

```text
setup://task-progress
setup://task-log
setup://task-error
setup://task-complete
```

任务结构：

```ts
export interface SetupTaskProgress {
  taskId: string;
  actionId: string;
  status: 'queued' | 'running' | 'complete' | 'error' | 'cancelled';
  step: string;
  progress: number;
  message: string;
  error?: string;
  updatedAt: string;
}
```

安装动作：

```text
setup_install_nodejs_lts
setup_install_git_for_windows
setup_install_claude_code_cli
setup_fix_powershell_policy
setup_set_npm_mirror
setup_write_provider_config
setup_verify_claude_cli
```

---

## 7. 安装 Claude Code CLI 的正确策略

优先提供官方推荐方式：

```powershell
irm https://claude.ai/install.ps1 | iex
```

备用：

```powershell
winget install Anthropic.ClaudeCode
```

npm fallback：

```powershell
npm install -g @anthropic-ai/claude-code@latest
```

界面上必须解释：

```text
推荐 native installer。
npm 是兼容 fallback。
不要安装 Claude Desktop App，它不是本项目需要的 CLI。
```

---

## 8. 检测 Claude Code CLI 的正确策略

检测顺序：

```text
1. where.exe claude.exe
2. %USERPROFILE%\.local\bin\claude.exe
3. npm root -g + @anthropic-ai\claude-code\cli-wrapper.cjs
4. npm root -g + @anthropic-ai\claude-code\cli.js / cli.cjs / cli.mjs legacy fallback
5. where.exe claude.cmd only fallback
6. npx only diagnostic，不作为默认运行入口
```

绝对禁止：

```text
直接运行 C:\Users\xxx\AppData\Roaming\npm\claude
```

因为这是 extensionless 文件，Windows GUI 子进程下会出现：

```text
%1 不是有效的 Win32 应用程序 (os error 193)
```

---

## 9. 设置页重构

Settings 页面分组：

```text
1. 环境配置
2. API Provider
3. Runtime
4. 权限中心
5. 外观主题
6. 诊断与日志
```

环境配置页：

```text
顶部：当前状态 summary
中部：检测项卡片
底部：修复动作
右侧：最近任务进度
```

权限中心：

```text
AutoTrust Level
允许工具白名单
禁止命令黑名单
危险路径
自动审批规则
规则导入导出
恢复默认
```

---

## 10. 视觉规范

Wizard：

```text
最大宽度 1080px
最小高度 680px
左右布局：左 stepper 260px，右主内容自适应
卡片圆角 20px
阴影柔和
按钮明确：主按钮 / 次按钮 / 危险按钮
所有表单控件统一高度 38px
```

字体：

```text
页面标题 32px / 760
区块标题 18px / 700
卡片标题 15px / 680
正文 14px / 400
说明 12px / 400
代码 12px / mono
```

---

## 11. 验收标准

```text
[ ] 首次打开显示 Setup Wizard。
[ ] 用户明确知道部署的是 Claude Code CLI。
[ ] 检测项不误判 Windows Terminal。
[ ] 检测项不误判 PATH。
[ ] 能识别 native claude.exe。
[ ] 能识别 npm cli-wrapper.cjs。
[ ] 不再直接运行 extensionless claude。
[ ] API Provider 能写入 settings.json。
[ ] 原 settings.json 自动备份。
[ ] 非首次启动不自动乱检测。
[ ] Console 环境卡有检测/刷新按钮。
[ ] 环境不完整时 Workspace 给出友好入口。
[ ] Chat 不再因环境失败刷屏。
```

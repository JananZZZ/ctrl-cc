# Ctrl-CC v25 Architecture

## Core Rule: Runtime Kernel Drives UI

```
旧: UI 驱动 Runtime
新: Runtime Kernel 驱动 UI
```

UI 只发 Intent. Runtime Kernel 负责执行、状态机、错误归类、事件归一化、会话生命周期。UI 只订阅投影后的 ViewModel。

## Architecture Layers

```
src/
├── app/           # App root (App, AppShell, SurfaceHost)
├── core/          # Non-UI engine (runtime, providers, session, project, setup, diagnostics, permissions, resources)
├── providers/     # Provider implementations (claude-code, codex, opencode)
├── features/      # Feature modules (composer, terminal, chat, dock)
├── surfaces/      # UI pages (console, projects, workspace, resources, github, settings)
├── stores/        # Zustand state management
├── components/    # Shared UI components
├── styles/        # Design system CSS
└── types/         # Shared TypeScript types
```

## Channel Isolation

- Chat channel: headless stream-json (claude -p)
- Terminal channel: PTY (portable-pty)
- Background channel: automatic tasks
- Activity channel: file changes, tool calls, permissions

Chat failure → channel.status = failed, session.status = idle. Terminal failure → terminalChannel.status = failed, chat still available.

## Hard Rules

1. Do not let UI call Tauri invoke directly for runtime operations.
2. Do not let Chat and Terminal share lifecycle status.
3. Do not execute extensionless npm shims on Windows.
4. Do not fake Claude session IDs.
5. Do not mutate stores from React render phase.
6. Do not expose raw diagnostics to normal users by default.
7. Every runtime behavior change must have tests.

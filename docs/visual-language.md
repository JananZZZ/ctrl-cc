# Ctrl-CC 视觉语言: Neo Calm Industrial 2.0

## 核心关键词

新极简主义 / 舒缓界面 / 轻工业级秩序感 / 轻复古编辑感 / Windows 桌面原生感 / 图标优先 / 文字按需浮现 / 信息清楚但不压迫 / 小白友好 / 长时间使用不累

## 色彩系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--cc-bg` | `#f7f4ee` | 主背景 — Claude Sand 浅卡其 |
| `--cc-surface` | `rgba(255,255,255,0.88)` | 半透明面板 |
| `--cc-surface-solid` | `#ffffff` | 实色卡片 |
| `--cc-border` | `#e8ded1` | 弱边框 |
| `--cc-text` | `#243044` | 主文字 — 深海军蓝 |
| `--cc-text-muted` | `#7b6f62` | 次级文字 |
| `--cc-brand` | `#d8c29b` | 品牌色 — 浅卡其 |
| `--cc-navy` | `#223047` | CTA / 强调 |
| `--cc-blue` | `#82afff` | 信息 / 链接 |
| `--cc-green` | `#63c59b` | 成功 / 运行中 |
| `--cc-amber` | `#f0a54a` | 警告 / 待确认 |
| `--cc-red` | `#e66b6b` | 错误 / 高风险 |
| `--cc-purple` | `#9a8cff` | Agent / 特殊 |

## 间距与圆角

- 圆角: xs 8px / sm 12px / md 16px / lg 20px / xl 24px / full 999px
- 阴影: soft `0 10px 30px rgba(36,48,68,0.08)` / card `0 6px 18px rgba(36,48,68,0.06)`

## 字体

- Sans: Inter, Segoe UI Variable, Microsoft YaHei UI, PingFang SC
- Mono: JetBrains Mono, Cascadia Code, Consolas
- 字号: xs 12 / sm 13 / md 14 / lg 16 / xl 20 / 2xl 24 / 3xl 28

## 动效

- 新消息: fade + translateY 6px
- 流式输出: 平滑追加
- 工具卡片: scale 0.98 → 1
- 权限卡: amber 边框 pulse 一次
- 风险卡: 静态强调，不持续闪烁
- 视图切换: 120-180ms fade
- 时长: fast 120ms / normal 220ms / slow 360ms
- 缓动: ease-out `cubic-bezier(0.22,1,0.36,1)`

## Cc* 统一组件

所有 Surface 必须使用统一组件，禁止各自实现不同样式的卡片:

CcCard, CcPanel, CcButton, CcIconButton, CcBadge, CcStatusDot, CcTabs, CcTooltip, CcDropdown, CcSearchInput, CcEmptyState, CcLoadingState, CcErrorState, CcConfirmDialog, CcModal, CcDrawer, CcSplitPane, CcCodeBlock, CcCollapsible, CcProgressBar, CcTimeline, CcTree

## 禁止

- 硬编码颜色
- 自定义非标准圆角/阴影
- 各 Surface 各自实现不同卡片样式
- 用 div 模拟终端

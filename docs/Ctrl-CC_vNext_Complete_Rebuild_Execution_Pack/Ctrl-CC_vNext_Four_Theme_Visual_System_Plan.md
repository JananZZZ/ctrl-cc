# Ctrl-CC vNext 四主题视觉设计系统执行 Plan

> **可直接发送给 Claude Code CLI 执行。**  
> 目标：重新固化 Ctrl-CC vNext 的四套主题视觉系统：**浅色 Light、深色 Dark、浅蓝 Pale Blue、暖沙 Warm Sand / Claude 色**。  
> 本文档用于恢复此前制定过的主题颜色体系，并将其整理为可执行的 UI Design System 方案。  
> 注意：本文档只负责主题色、视觉语言、CSS Variables、主题切换、组件适配和验收标准，不负责 PTY Runtime、Claude Code CLI 集成、项目管理业务逻辑。

---

## 0. 总体视觉定位

Ctrl-CC 的整体视觉语言仍然是：

```text
Neo Calm Industrial
```

中文可以理解为：

```text
新静谧工业风 / 温和工业感 AI 工作台
```

它的核心不是单一颜色，而是一套可以在四种主题中保持统一气质的视觉系统：

```text
1. Light：浅色主题，干净、通透、默认大众友好。
2. Dark：深色主题，沉稳、专业、适合长时间夜间工作。
3. Pale Blue：浅蓝主题，清爽、科技、理性、轻盈。
4. Warm Sand / Claude：暖沙主题，浅卡其、温和、亲切、最贴近 Claude 色系。
```

四个主题必须共享同一套组件语言：

```text
大圆角
低对比边框
轻阴影
卡片化布局
温柔状态色
细线图标
高可读数字
克制动效
```

禁止四个主题变成四套完全不同的 UI。  
主题只改变色彩、背景气质和局部强调，不改变组件结构、布局逻辑和交互模式。

---

## 1. 四主题定位

### 1.1 Light Theme：浅色主题

定位：

```text
默认通用主题
适合大众用户
清爽、明亮、干净
```

适用场景：

```text
日常控制台
项目管理
新手首次启动
白天办公
普通用户默认设置
```

视觉关键词：

```text
清爽
简洁
通透
轻盈
低压力
```

---

### 1.2 Dark Theme：深色主题

定位：

```text
专业夜间主题
适合长时间编程和深度工作
```

适用场景：

```text
夜间使用
Workspace
Terminal View
专业控制台
高级用户
```

视觉关键词：

```text
沉稳
安静
专注
专业
低眩光
```

注意：

```text
深色不是纯黑。
不要做黑客风。
不要做荧光赛博风。
```

---

### 1.3 Pale Blue Theme：浅蓝主题

定位：

```text
清爽科技主题
介于浅色和专业之间
```

适用场景：

```text
数据仪表盘
Pro Console
Session Monitor
系统监视器
偏理性的工作界面
```

视觉关键词：

```text
清澈
理性
科技
轻盈
冷静
```

注意：

```text
浅蓝主题不能变成医院蓝或儿童蓝。
蓝色要克制，背景仍然柔和。
```

---

### 1.4 Warm Sand / Claude Theme：暖沙主题

定位：

```text
Ctrl-CC 的品牌主主题
浅卡其 / Claude 色系
最符合 Claude Code 工具感和 Ctrl-CC 猫猫 IP
```

适用场景：

```text
默认推荐主题
Daily Console
欢迎页
AI 工作坞
猫猫 IP 搭配
普通用户最友好主题
```

视觉关键词：

```text
温暖
亲切
高级
柔和
Claude 感
```

注意：

```text
暖沙主题是品牌主视觉。
不等于黄色主题。
不应过黄、不应土气。
应该是浅卡其、米白、温润的沙色体系。
```

---

## 2. 主题命名与枚举

前端必须统一使用主题枚举，不要散乱字符串。

```ts
export type CtrlCcTheme =
  | "light"
  | "dark"
  | "pale-blue"
  | "warm-sand";
```

用户可见名称：

```ts
export const THEME_LABELS: Record<CtrlCcTheme, string> = {
  "light": "浅色",
  "dark": "深色",
  "pale-blue": "浅蓝",
  "warm-sand": "暖沙 Claude"
};
```

默认主题建议：

```text
warm-sand
```

原因：

```text
1. 最贴近 Ctrl-CC 猫猫浅卡其 IP。
2. 最贴近 Claude 工具色感。
3. 亲切、温和、辨识度最高。
```

也可以在首次启动向导里提供选择：

```text
推荐：暖沙 Claude
备选：浅色 / 深色 / 浅蓝
```

---

## 3. 主题 CSS Variables 总体结构

必须使用 `data-theme` 控制主题。

```html
<html data-theme="warm-sand">
```

或：

```tsx
document.documentElement.dataset.theme = selectedTheme;
```

统一变量层级：

```css
:root {
  /* base tokens */
}

[data-theme="light"] {
  /* light theme */
}

[data-theme="dark"] {
  /* dark theme */
}

[data-theme="pale-blue"] {
  /* pale blue theme */
}

[data-theme="warm-sand"] {
  /* warm sand / Claude theme */
}
```

所有组件必须使用语义变量，而不是直接写死具体颜色。

---

## 4. 统一语义变量

所有主题都必须提供以下变量。

```css
:root {
  /* Background */
  --cc-bg: #f7f4ee;
  --cc-bg-subtle: #fbf8f2;
  --cc-bg-elevated: #fffdf8;

  /* Surface */
  --cc-surface: rgba(255, 255, 255, 0.88);
  --cc-surface-solid: #ffffff;
  --cc-surface-muted: #fbf8f2;
  --cc-surface-hover: rgba(255, 255, 255, 0.96);

  /* Border */
  --cc-border: #e8ded1;
  --cc-border-soft: rgba(232, 222, 209, 0.65);
  --cc-border-strong: #d7c7b4;

  /* Text */
  --cc-text: #243044;
  --cc-text-muted: #7b6f62;
  --cc-text-soft: #9a8f83;
  --cc-text-inverse: #ffffff;

  /* Brand */
  --cc-brand: #d8c29b;
  --cc-brand-soft: #f1e7d2;
  --cc-brand-strong: #b99862;

  /* Semantic */
  --cc-green: #63c59b;
  --cc-green-soft: #e7f7ef;
  --cc-blue: #82afff;
  --cc-blue-soft: #eaf2ff;
  --cc-amber: #f0a54a;
  --cc-amber-soft: #fff1dc;
  --cc-red: #e66b6b;
  --cc-red-soft: #fdecec;
  --cc-purple: #9a8cff;
  --cc-purple-soft: #f0edff;

  /* Layout */
  --cc-radius-xs: 8px;
  --cc-radius-sm: 12px;
  --cc-radius-md: 16px;
  --cc-radius-lg: 20px;
  --cc-radius-xl: 24px;
  --cc-radius-2xl: 28px;

  /* Shadow */
  --cc-shadow-soft: 0 10px 30px rgba(36, 48, 68, 0.08);
  --cc-shadow-card: 0 6px 18px rgba(36, 48, 68, 0.06);
  --cc-shadow-popover: 0 16px 40px rgba(36, 48, 68, 0.14);

  /* Motion */
  --cc-ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --cc-ease-soft: cubic-bezier(0.16, 1, 0.3, 1);
  --cc-duration-fast: 120ms;
  --cc-duration-normal: 180ms;
  --cc-duration-slow: 260ms;
}
```

---

## 5. 四主题完整色彩 Token

---

## 5.1 Light Theme：浅色主题

```css
[data-theme="light"] {
  /* Background */
  --cc-bg: #f7f8fb;
  --cc-bg-subtle: #fbfcfe;
  --cc-bg-elevated: #ffffff;

  /* Surface */
  --cc-surface: rgba(255, 255, 255, 0.9);
  --cc-surface-solid: #ffffff;
  --cc-surface-muted: #f3f5f8;
  --cc-surface-hover: #ffffff;

  /* Border */
  --cc-border: #e4e8ef;
  --cc-border-soft: rgba(228, 232, 239, 0.7);
  --cc-border-strong: #cbd3df;

  /* Text */
  --cc-text: #243044;
  --cc-text-muted: #667085;
  --cc-text-soft: #98a2b3;
  --cc-text-inverse: #ffffff;

  /* Brand */
  --cc-brand: #d6b98c;
  --cc-brand-soft: #f4ead9;
  --cc-brand-strong: #ad8655;

  /* Semantic */
  --cc-green: #48b083;
  --cc-green-soft: #e8f7ef;
  --cc-blue: #5b8def;
  --cc-blue-soft: #eaf2ff;
  --cc-amber: #e9a23b;
  --cc-amber-soft: #fff4df;
  --cc-red: #df5f5f;
  --cc-red-soft: #fdecec;
  --cc-purple: #8b7cf6;
  --cc-purple-soft: #f0edff;

  /* Shadow */
  --cc-shadow-soft: 0 10px 30px rgba(36, 48, 68, 0.08);
  --cc-shadow-card: 0 6px 18px rgba(36, 48, 68, 0.06);
  --cc-shadow-popover: 0 16px 40px rgba(36, 48, 68, 0.14);
}
```

视觉说明：

```text
浅色主题要偏中性白，不要过暖，也不要偏冷灰。
适合作为大众通用主题。
```

---

## 5.2 Dark Theme：深色主题

```css
[data-theme="dark"] {
  /* Background */
  --cc-bg: #1f2329;
  --cc-bg-subtle: #252a31;
  --cc-bg-elevated: #2b3038;

  /* Surface */
  --cc-surface: rgba(43, 48, 56, 0.92);
  --cc-surface-solid: #2b3038;
  --cc-surface-muted: #252a31;
  --cc-surface-hover: #333944;

  /* Border */
  --cc-border: #3c424c;
  --cc-border-soft: rgba(60, 66, 76, 0.72);
  --cc-border-strong: #555d69;

  /* Text */
  --cc-text: #edf0f5;
  --cc-text-muted: #b9b2a8;
  --cc-text-soft: #8d867c;
  --cc-text-inverse: #1f2329;

  /* Brand */
  --cc-brand: #d8c29b;
  --cc-brand-soft: rgba(216, 194, 155, 0.16);
  --cc-brand-strong: #e4c985;

  /* Semantic */
  --cc-green: #72d6a4;
  --cc-green-soft: rgba(114, 214, 164, 0.14);
  --cc-blue: #8eb7ff;
  --cc-blue-soft: rgba(142, 183, 255, 0.15);
  --cc-amber: #f2b35f;
  --cc-amber-soft: rgba(242, 179, 95, 0.15);
  --cc-red: #f07d7d;
  --cc-red-soft: rgba(240, 125, 125, 0.14);
  --cc-purple: #a99dff;
  --cc-purple-soft: rgba(169, 157, 255, 0.15);

  /* Shadow */
  --cc-shadow-soft: 0 10px 30px rgba(0, 0, 0, 0.22);
  --cc-shadow-card: 0 6px 18px rgba(0, 0, 0, 0.18);
  --cc-shadow-popover: 0 18px 48px rgba(0, 0, 0, 0.34);
}
```

视觉说明：

```text
深色主题必须沉稳、低眩光。
不要纯黑。
不要绿色黑客风。
不要高饱和霓虹。
品牌浅卡其仍然作为高亮色保留。
```

---

## 5.3 Pale Blue Theme：浅蓝主题

```css
[data-theme="pale-blue"] {
  /* Background */
  --cc-bg: #eef5fb;
  --cc-bg-subtle: #f5f9fd;
  --cc-bg-elevated: #ffffff;

  /* Surface */
  --cc-surface: rgba(255, 255, 255, 0.88);
  --cc-surface-solid: #ffffff;
  --cc-surface-muted: #e8f1f9;
  --cc-surface-hover: #ffffff;

  /* Border */
  --cc-border: #d8e5f1;
  --cc-border-soft: rgba(216, 229, 241, 0.75);
  --cc-border-strong: #b9cede;

  /* Text */
  --cc-text: #22364c;
  --cc-text-muted: #60758a;
  --cc-text-soft: #8ca0b1;
  --cc-text-inverse: #ffffff;

  /* Brand */
  --cc-brand: #9fc4e8;
  --cc-brand-soft: #dcecf8;
  --cc-brand-strong: #5f93c0;

  /* Semantic */
  --cc-green: #56b99a;
  --cc-green-soft: #e5f6f0;
  --cc-blue: #4f8eea;
  --cc-blue-soft: #e6f1ff;
  --cc-amber: #e6a047;
  --cc-amber-soft: #fff2df;
  --cc-red: #e16a6a;
  --cc-red-soft: #fdeeee;
  --cc-purple: #9185f4;
  --cc-purple-soft: #f0edff;

  /* Shadow */
  --cc-shadow-soft: 0 10px 30px rgba(34, 54, 76, 0.08);
  --cc-shadow-card: 0 6px 18px rgba(34, 54, 76, 0.06);
  --cc-shadow-popover: 0 16px 40px rgba(34, 54, 76, 0.14);
}
```

视觉说明：

```text
浅蓝主题适合监视器、仪表盘、专业控制台。
蓝色要淡雅，不要高饱和。
背景应有清爽科技感，但仍保持温和。
```

---

## 5.4 Warm Sand / Claude Theme：暖沙 Claude 主题

```css
[data-theme="warm-sand"] {
  /* Background */
  --cc-bg: #f7f4ee;
  --cc-bg-subtle: #fbf8f2;
  --cc-bg-elevated: #fffdf8;

  /* Surface */
  --cc-surface: rgba(255, 255, 255, 0.88);
  --cc-surface-solid: #ffffff;
  --cc-surface-muted: #f4ecdc;
  --cc-surface-hover: #fffaf2;

  /* Border */
  --cc-border: #e8ded1;
  --cc-border-soft: rgba(232, 222, 209, 0.68);
  --cc-border-strong: #d7c7b4;

  /* Text */
  --cc-text: #243044;
  --cc-text-muted: #7b6f62;
  --cc-text-soft: #9a8f83;
  --cc-text-inverse: #ffffff;

  /* Brand */
  --cc-brand: #d8c29b;
  --cc-brand-soft: #f1e7d2;
  --cc-brand-strong: #b99862;

  /* Semantic */
  --cc-green: #63c59b;
  --cc-green-soft: #e7f7ef;
  --cc-blue: #82afff;
  --cc-blue-soft: #eaf2ff;
  --cc-amber: #f0a54a;
  --cc-amber-soft: #fff1dc;
  --cc-red: #e66b6b;
  --cc-red-soft: #fdecec;
  --cc-purple: #9a8cff;
  --cc-purple-soft: #f0edff;

  /* Shadow */
  --cc-shadow-soft: 0 10px 30px rgba(36, 48, 68, 0.08);
  --cc-shadow-card: 0 6px 18px rgba(36, 48, 68, 0.06);
  --cc-shadow-popover: 0 16px 40px rgba(36, 48, 68, 0.14);
}
```

视觉说明：

```text
暖沙主题是 Ctrl-CC 推荐主主题。
它对应 Claude 色系、猫猫 IP、亲切感和品牌识别。
整体应温暖但不发黄，高级但不冷淡。
```

---

## 6. 主题切换 UI 设计

主题切换入口位于：

```text
Settings → Appearance
```

也可在首次启动引导中出现。

### 6.1 Appearance 设置页结构

```text
AppearanceSettings
├── ThemeSelector
│   ├── LightThemeCard
│   ├── DarkThemeCard
│   ├── PaleBlueThemeCard
│   └── WarmSandThemeCard
├── FollowSystemToggle
├── AccentPreview
├── DensitySelector
└── MotionPreference
```

### 6.2 主题卡片展示

每个主题卡片必须包含：

```text
主题名称
一句描述
小型界面预览
选中状态
```

示例：

```text
暖沙 Claude
温柔、亲切、最适合日常使用的 Ctrl-CC 默认主题。
```

```text
浅蓝
清爽、理性，适合仪表盘和专业监视器。
```

```text
深色
沉稳、低眩光，适合夜间深度工作。
```

```text
浅色
干净、通透，适合普通办公环境。
```

### 6.3 主题预览卡

每个主题预览至少展示：

```text
小背景
小卡片
小按钮
状态点
文字层级
```

用户点击即预览，确认后保存。

### 6.4 保存逻辑

```ts
interface AppearanceSettings {
  theme: CtrlCcTheme;
  followSystem: boolean;
  density: "comfortable" | "compact";
  reduceMotion: boolean;
}
```

保存位置：

```text
settingsStore
SQLite settings table
local config file
```

要求：

```text
切换主题立即生效。
重启后保持。
首次安装默认 warm-sand。
如果 followSystem = true，则根据系统 light/dark 切换，但仍保留用户选择的 preferred light/dark variant。
```

---

## 7. 四主题下组件适配

### 7.1 CcCard

所有主题统一：

```css
.cc-card {
  background: var(--cc-surface);
  border: 1px solid var(--cc-border-soft);
  border-radius: var(--cc-radius-lg);
  box-shadow: var(--cc-shadow-card);
  color: var(--cc-text);
}
```

Interactive hover：

```css
.cc-card[data-interactive="true"]:hover {
  background: var(--cc-surface-hover);
  border-color: var(--cc-border);
  transform: translateY(-2px);
}
```

---

### 7.2 CcButton

Primary：

```css
.cc-button-primary {
  background: var(--cc-brand);
  color: var(--cc-text);
  border: 1px solid var(--cc-brand-strong);
}
```

Soft：

```css
.cc-button-soft {
  background: var(--cc-brand-soft);
  color: var(--cc-text);
  border: 1px solid var(--cc-border-soft);
}
```

Ghost：

```css
.cc-button-ghost {
  background: transparent;
  color: var(--cc-text-muted);
}
```

Danger：

```css
.cc-button-danger {
  background: var(--cc-red-soft);
  color: var(--cc-red);
  border: 1px solid color-mix(in srgb, var(--cc-red) 30%, transparent);
}
```

---

### 7.3 CcBadge

```css
.cc-badge-success {
  background: var(--cc-green-soft);
  color: var(--cc-green);
}

.cc-badge-info {
  background: var(--cc-blue-soft);
  color: var(--cc-blue);
}

.cc-badge-warning {
  background: var(--cc-amber-soft);
  color: var(--cc-amber);
}

.cc-badge-danger {
  background: var(--cc-red-soft);
  color: var(--cc-red);
}

.cc-badge-purple {
  background: var(--cc-purple-soft);
  color: var(--cc-purple);
}
```

---

### 7.4 CcStatusDot

```css
.cc-status-ready {
  background: var(--cc-green);
}

.cc-status-running {
  background: var(--cc-blue);
}

.cc-status-waiting {
  background: var(--cc-amber);
}

.cc-status-risk {
  background: var(--cc-red);
}

.cc-status-agent {
  background: var(--cc-purple);
}
```

状态动效：

```text
running：柔和 pulse
thinking：breathing
waiting：amber pulse
risk：短闪后静止
```

---

### 7.5 CcTabs

```css
.cc-tabs {
  background: var(--cc-surface-muted);
  border: 1px solid var(--cc-border-soft);
  border-radius: var(--cc-radius-md);
}

.cc-tab[data-active="true"] {
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  box-shadow: var(--cc-shadow-card);
}
```

---

## 8. Surface 在四主题中的差异化建议

### 8.1 Daily Console

推荐默认：

```text
warm-sand
```

原因：

```text
最亲切、最有品牌感。
```

在其他主题下：

```text
Light：更清爽
Dark：更克制
Pale Blue：更理性
Warm Sand：更温暖
```

### 8.2 Pro Console / Analytics

推荐适配：

```text
pale-blue 或 warm-sand
```

浅蓝主题下，图表和卡片会更有仪表盘感。  
暖沙主题下，会更亲切。

### 8.3 Workspace

深度工作时推荐：

```text
dark
```

但 Chat View 在 warm-sand 下也必须舒适可用。

### 8.4 Terminal View

Terminal 允许单独选择 terminal theme，但默认应跟随 app theme。

建议：

```text
Light → xterm light
Dark → xterm dark
Pale Blue → xterm light blue-tinted
Warm Sand → xterm warm light
```

### 8.5 AI Floating Dock

默认跟随 app theme。  
但 Dock 可以允许“自动根据系统主题”独立设置。

---

## 9. Terminal 主题映射

xterm.js 主题需要单独映射。

```ts
export const XTERM_THEMES: Record<CtrlCcTheme, ITheme> = {
  light: {
    background: "#fbfcfe",
    foreground: "#243044",
    cursor: "#d6b98c",
    selectionBackground: "#f4ead9"
  },
  dark: {
    background: "#1f2329",
    foreground: "#edf0f5",
    cursor: "#d8c29b",
    selectionBackground: "#3c424c"
  },
  "pale-blue": {
    background: "#f5f9fd",
    foreground: "#22364c",
    cursor: "#5f93c0",
    selectionBackground: "#dcecf8"
  },
  "warm-sand": {
    background: "#fffdf8",
    foreground: "#243044",
    cursor: "#b99862",
    selectionBackground: "#f1e7d2"
  }
};
```

要求：

```text
Terminal View 保持可读性优先。
不要因为主题美观牺牲 ANSI 可读性。
```

---

## 10. IP 形象颜色与主题对应

Ctrl-CC 猫猫 IP 有四个颜色版本，建议与主题对应：

```text
Warm Sand → 浅卡其猫猫
Light → 白色猫猫
Dark → 深黑色猫猫
Pale Blue → 极浅蓝猫猫
```

猫猫状态动画在不同主题下：

```text
Warm Sand：默认品牌 IP
Light：更干净
Dark：更像夜间守护状态
Pale Blue：更科技、清爽
```

猫猫不能改变模型结构，只换颜色和轻微主题阴影。

---

## 11. 主题切换动效

切换主题时：

```text
duration: 180–240ms
background / surface / border / text 平滑过渡
不要整页闪白
不要重新挂载所有组件
不要导致 terminal 会话重启
```

CSS：

```css
html,
body,
.cc-card,
.cc-button,
.cc-panel,
.cc-badge {
  transition:
    background-color 180ms var(--cc-ease-standard),
    border-color 180ms var(--cc-ease-standard),
    color 180ms var(--cc-ease-standard),
    box-shadow 180ms var(--cc-ease-standard);
}
```

注意：

```text
xterm 主题切换需要调用 terminal.options.theme = ...
不要重启 PTY。
```

---

## 12. 主题可访问性要求

必须检查：

```text
1. 正文文本对比度。
2. 弱文本可读性。
3. 状态色不能只靠颜色表达，必须有文字或图标。
4. 深色主题下红/蓝/紫不能过亮刺眼。
5. 浅蓝主题下边框不能太浅导致看不清。
6. 暖沙主题下黄色/琥珀风险色必须和品牌卡其区分。
```

Focus ring：

```css
:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cc-brand) 70%, white 30%);
  outline-offset: 2px;
}
```

---

## 13. 主题实现文件建议

建议目录：

```text
src/styles/
├── tokens.css
├── themes/
│   ├── light.css
│   ├── dark.css
│   ├── pale-blue.css
│   └── warm-sand.css
├── components.css
├── motion.css
└── index.css
```

或：

```text
src/theme/
├── theme-types.ts
├── theme-registry.ts
├── theme-provider.tsx
├── xterm-themes.ts
└── theme-preview.tsx
```

### 13.1 theme-types.ts

```ts
export type CtrlCcTheme = "light" | "dark" | "pale-blue" | "warm-sand";

export interface ThemeMeta {
  id: CtrlCcTheme;
  label: string;
  description: string;
  previewColors: {
    bg: string;
    surface: string;
    brand: string;
    text: string;
  };
}
```

### 13.2 theme-registry.ts

```ts
export const CTRL_CC_THEMES: ThemeMeta[] = [
  {
    id: "warm-sand",
    label: "暖沙 Claude",
    description: "温柔、亲切、最适合日常使用的 Ctrl-CC 推荐主题。",
    previewColors: {
      bg: "#f7f4ee",
      surface: "#ffffff",
      brand: "#d8c29b",
      text: "#243044"
    }
  },
  {
    id: "light",
    label: "浅色",
    description: "干净、通透，适合普通办公环境。",
    previewColors: {
      bg: "#f7f8fb",
      surface: "#ffffff",
      brand: "#d6b98c",
      text: "#243044"
    }
  },
  {
    id: "pale-blue",
    label: "浅蓝",
    description: "清爽、理性，适合仪表盘和专业监视器。",
    previewColors: {
      bg: "#eef5fb",
      surface: "#ffffff",
      brand: "#9fc4e8",
      text: "#22364c"
    }
  },
  {
    id: "dark",
    label: "深色",
    description: "沉稳、低眩光，适合夜间深度工作。",
    previewColors: {
      bg: "#1f2329",
      surface: "#2b3038",
      brand: "#d8c29b",
      text: "#edf0f5"
    }
  }
];
```

---

## 14. 与 Settings / Onboarding 的集成

### 14.1 首次启动引导

主题选择步骤：

```text
选择你喜欢的界面风格
[暖沙 Claude] 推荐
[浅色]
[浅蓝]
[深色]
```

默认选中：

```text
暖沙 Claude
```

文案：

```text
推荐使用暖沙 Claude：这是 Ctrl-CC 的默认主题，温和、亲切，适合长时间使用。
```

### 14.2 Settings 外观页

必须包含：

```text
主题选择
跟随系统
界面密度
减少动画
猫猫主题颜色是否跟随主题
Terminal 主题是否跟随应用主题
```

---

## 15. Claude Code 执行 Prompt

```text
请根据本文档重新实现 Ctrl-CC vNext 的四主题视觉系统。

目标：
恢复并固化四个主题：
1. light：浅色
2. dark：深色
3. pale-blue：浅蓝
4. warm-sand：暖沙 Claude 色

注意：
这不是单一 Neo Calm Industrial 文档，而是四套主题颜色系统。
整体视觉语言仍然是 Neo Calm Industrial，但必须支持四种主题切换。

执行要求：
1. 建立 CtrlCcTheme 类型：
   "light" | "dark" | "pale-blue" | "warm-sand"

2. 建立完整 CSS Variables：
   --cc-bg
   --cc-bg-subtle
   --cc-bg-elevated
   --cc-surface
   --cc-surface-solid
   --cc-surface-muted
   --cc-surface-hover
   --cc-border
   --cc-border-soft
   --cc-border-strong
   --cc-text
   --cc-text-muted
   --cc-text-soft
   --cc-text-inverse
   --cc-brand
   --cc-brand-soft
   --cc-brand-strong
   --cc-green
   --cc-green-soft
   --cc-blue
   --cc-blue-soft
   --cc-amber
   --cc-amber-soft
   --cc-red
   --cc-red-soft
   --cc-purple
   --cc-purple-soft
   radius / shadow / motion tokens

3. 四个主题的颜色必须按照本文档定义：
   - Light Theme
   - Dark Theme
   - Pale Blue Theme
   - Warm Sand / Claude Theme

4. 默认主题设为 warm-sand。

5. 实现主题切换：
   - html[data-theme="..."]
   - settingsStore 持久化
   - 重启后保持
   - 首次安装默认 warm-sand
   - 支持 followSystem，但不要覆盖用户偏好

6. 建立 AppearanceSettings：
   - theme
   - followSystem
   - density
   - reduceMotion
   - terminalFollowsAppTheme
   - mascotFollowsTheme

7. 建立 Settings → Appearance 页面：
   - 四个主题卡片
   - 小型主题预览
   - 主题说明
   - 选中状态
   - 即时预览
   - 保存设置

8. 建立 xterm theme 映射：
   - light
   - dark
   - pale-blue
   - warm-sand
   切换应用主题时更新 terminal.options.theme，但不要重启 PTY。

9. 组件适配：
   - CcCard
   - CcButton
   - CcBadge
   - CcStatusDot
   - CcTabs
   - CcDrawer
   - CcMetricCard
   必须全部使用主题变量，不允许硬编码颜色。

10. IP 形象主题映射：
   - warm-sand → 浅卡其猫猫
   - light → 白色猫猫
   - dark → 深黑色猫猫
   - pale-blue → 极浅蓝猫猫
   仅做主题资源映射，不要改变猫猫模型结构。

11. 输出 docs/theme-system-audit.md：
   - 当前已有主题实现
   - 缺失 token
   - 硬编码颜色位置
   - 需要迁移的组件
   - 已完成内容
   - 未完成内容

12. 不要修改 PTY Runtime、Claude Code CLI 集成、项目管理业务逻辑。

13. 运行：
   npm run typecheck
   npm run build
   cargo check

14. 输出：
   - 修改文件清单
   - 构建结果
   - 当前主题切换效果
   - 未接入组件清单
   - 下一步视觉系统迁移计划
```

---

## 16. 验收标准

```text
[ ] 支持四个主题：light / dark / pale-blue / warm-sand。
[ ] 默认主题为 warm-sand。
[ ] 主题切换即时生效。
[ ] 重启后主题保持。
[ ] Settings → Appearance 中可以选择四个主题。
[ ] 每个主题有预览卡片。
[ ] Terminal 主题可以跟随应用主题。
[ ] 猫猫颜色可以跟随主题。
[ ] 所有核心 Cc* 组件使用 CSS Variables。
[ ] 无大面积硬编码颜色。
[ ] 深色主题不是纯黑，不是黑客风。
[ ] 浅蓝主题清爽但不刺眼。
[ ] 暖沙主题符合 Claude 色系和 Ctrl-CC 品牌感。
[ ] 浅色主题通用、干净、明亮。
[ ] npm run typecheck 通过。
[ ] npm run build 通过。
[ ] cargo check 通过。
```

---

## 17. 最终说明

这四套主题的关系是：

```text
Warm Sand / Claude：
  品牌默认主题，最推荐。

Light：
  通用办公主题，最稳妥。

Pale Blue：
  清爽科技主题，适合专业统计和监视器。

Dark：
  夜间深度工作主题，适合长时间编程。
```

四个主题共同服务于同一个视觉语言：

```text
Neo Calm Industrial
```

也就是说：

```text
主题可以换，
但 Ctrl-CC 的高级、温和、亲切、专业气质不能变。
```

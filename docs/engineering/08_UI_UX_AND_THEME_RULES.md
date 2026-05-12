# 08 UI UX and Theme Rules — UI/UX与主题规则

## Visual System
Neo Calm Industrial — four themes: light, dark, pale-blue, warm-sand. Use design tokens ONLY. No hard-coded colors.

## Required Theme Variables
`--cc-bg`, `--cc-surface`, `--cc-border-soft`, `--cc-text`, `--cc-text-muted`, `--cc-brand`, `--cc-red`, `--cc-amber`, `--cc-green`, `--cc-blue`, `--cc-shadow`, `--cc-radius`

## UX Error Rule
Never show only "创建失败". Show: what failed, which layer, why, what was attempted, what user can do, copy diagnostics button.

## Loading Rule
Every async action: immediate feedback, current phase, timeout, cancel/stop when possible, failure reason.

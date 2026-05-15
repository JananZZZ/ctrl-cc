# Ctrl-CC UI Design System v25

## Typography Tokens

| Token | Value |
|-------|-------|
| --cc-text-display | clamp(28px, 2.2vw, 36px) |
| --cc-text-title | clamp(22px, 1.7vw, 28px) |
| --cc-text-section | 18px |
| --cc-text-card | 15px |
| --cc-text-body | 14px |
| --cc-text-caption | 12px |
| --cc-text-micro | 11px |

## Layout

- .cc-surface: full page container with overflow auto
- .cc-surface-inner: max-width 1440px centered
- .cc-grid-auto: responsive grid with min 280px columns

## Card Density

- .cc-card-compact: 12px 14px
- .cc-card-comfortable: 16px 18px
- .cc-card-dense: 10px 12px

## Breakpoints

- ≤900px: single column, compact
- 901-1399px: two columns
- ≥1400px: three columns (1.2fr 1fr 0.9fr)

## Themes

Four themes: warm-sand (default), light, pale-blue, dark. All colors via --cc-* CSS custom properties. No hard-coded colors.

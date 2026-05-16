# UI Design System

Ctrl-CC uses a unified visual system.

## Layout

- All main pages use SurfacePage + PageContainer.
- Page content must be centered with max-width.
- Wide screens use 2-3 columns.
- Narrow screens collapse to 1 column.
- Cards must not be empty huge blocks.
- Typography must use semantic classes.

## Required Page Quality

- Console: dashboard-quality, no overlap, no squeezed cards.
- Projects: project/session management as central commercial feature.
- Workspace: chat-first, terminal optional, split view supported.
- Resources: resource library with categories and status.
- Canvas: node graph with fit/zoom/pan.
- GitHub: dashboard, not iframe.

## AI Dock

AI Dock is an independent Tauri window, not an in-app floating rail.

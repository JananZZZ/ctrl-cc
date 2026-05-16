# v28 Acceptance Tests

## Runtime

- New session creates exactly one process.
- Sending 20 messages keeps same PID.
- Closing tab does not kill process.
- Stop button kills process.
- Chat and Terminal show same runtime output.

## Setup

- Detection does not auto-run on startup.
- Console/Settings/FirstRun share one setup snapshot.
- Detection failure shows retry, copy diagnostics, open logs, skip.
- No external terminal windows appear.

## React

- No React #185 after switching pages 100 times.
- No render-loop localStorage writes.
- No store writes inside render.

## UI

- All pages responsive.
- No text size chaos.
- No squeezed cards.
- No blank iframe GitHub page.

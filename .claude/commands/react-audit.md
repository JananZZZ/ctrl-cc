# /react-audit — React 审计

Run: `rg "useEffect\(" src; rg "navigate\|openSessionTab\|focusSession\|selectProject\|patchSession\|updateSession" src; rg "subscribe\(" src`

Report: render-time side effects, effects that update their own dependencies, unstable selectors, non-idempotent store actions, missing cleanup, unbounded state arrays.

# 11 Agent Operating Protocol — Agent 操作协议

## Before Every Task
Claude Code must:
1. Read CLAUDE.md → 2. Read docs/engineering/00_READ_FIRST.md
3. Read relevant engineering docs for touched layer
4. Run `rg` to inspect existing implementation before coding
5. State current architecture as found
6. State intended minimal modification path
7. Avoid creating duplicate systems if existing system exists

## During Implementation
1. Prefer small coherent patches
2. Do NOT create second RuntimeBridge
3. Do NOT create second PTY manager unless explicitly requested
4. Do NOT bypass stores/contracts
5. Do NOT add unbounded event arrays
6. Do NOT add render-time side effects
7. Do NOT swallow errors
8. Do NOT fake successful state

## After Implementation
Output: modified files, contracts changed, invariants preserved, tests run, failed checks, manual testing steps, unresolved risks

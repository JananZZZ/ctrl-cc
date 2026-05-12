# 00 Read First — 开发前必读

This repository must be developed as a stability-first desktop runtime platform.

Every task must begin with:
1. Read CLAUDE.md.
2. Read all docs/engineering files imported by CLAUDE.md.
3. Identify which layer is touched:
   - App Shell / RuntimeBridge / RuntimeKernel
   - Interaction Plane / Structured Plane
   - Telemetry Plane / Governance Plane
   - Observability Plane / Performance Plane / Recovery Plane
4. State the allowed files to modify.
5. State the forbidden files to modify.
6. Check if the change violates RuntimeBridge isolation.
7. Check if it can create React update loops.
8. Check if it can block the UI thread.
9. Check if it can flood React state with raw PTY output.
10. Check if it can leave orphan processes.

**Never start coding before completing this preflight.**

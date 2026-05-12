# Observability Rules
- All errors → RuntimeEventStore + ErrorLog + Session Timeline + Diagnostic Bundle
- RuntimeEvent max 200, ErrorLog max 200, PTY tail max 32KB/session
- No hidden errors. No top-only errors.
- Diagnostic Bundle: React error + sessions + shell matrix + discovery + events + PTY tail + orphans

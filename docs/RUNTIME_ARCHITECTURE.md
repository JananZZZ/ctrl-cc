# Runtime Architecture

Ctrl-CC v28 使用唯一 RuntimeKernel。

## Runtime 生命周期

New Session:
GUI Session -> RuntimeKernel.startSession -> Claude CLI PTY process -> Event Ledger

Send Message:
GUI Session -> RuntimeKernel.submitUserMessage -> writer.write -> same Claude process

Close Tab:
GUI tab removed only; Runtime continues detached.

Stop Runtime:
User explicit action -> RuntimeKernel.stopSession -> kill child.

Resume:
GUI tab reattached to existing Runtime or starts Claude CLI with resume/session recovery when supported.

## Event Model

Raw PTY data is never lost.

Backend emits:
- lifecycle
- status
- raw
- error

Frontend projects:
- terminalBuffers
- chatBlocks
- inspector telemetry

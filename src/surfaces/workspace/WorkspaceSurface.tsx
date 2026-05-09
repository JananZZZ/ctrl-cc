import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSessionStore } from '../../stores/sessionStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { invokeCommand } from '../../services/invokeCommand';
import { StreamCoalescer } from '../../features/chat/StreamCoalescer';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { CcButton } from '../../components/ui/CcButton';
import { OpenSessionTabs } from './OpenSessionTabs';
import { ChatView } from './ChatView';
import { TerminalView } from './TerminalView';
import { ComposerBar } from './ComposerBar';
import { SessionInspector } from './SessionInspector';
import type { RuntimeEvent, Session } from '../../types';

type ViewMode = 'chat' | 'terminal' | 'split';

export function WorkspaceSurface() {
  const tabs = useOpenSessionStore((s) => s.tabs);
  const activeTabId = useOpenSessionStore((s) => s.activeTabId);
  const setActiveTab = useOpenSessionStore((s) => s.setActiveTab);
  const closeTab = useOpenSessionStore((s) => s.closeTab);
  const openSession = useOpenSessionStore((s) => s.openSession);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [rawEvents, setRawEvents] = useState<RuntimeEvent[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessions = useSessionStore((s) => s.sessions);
  const addSession = useSessionStore((s) => s.addSession);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const coalescerRef = useRef(new StreamCoalescer());

  const activeSession: Session | null = activeTabId ? sessions.find((s) => s.id === activeTabId) ?? null : null;

  // Coalesce streaming deltas into single messages
  const events = useMemo(() => {
    const result: RuntimeEvent[] = [];
    const seenIds = new Set<string>();
    for (const evt of rawEvents) {
      const coalesced = coalescerRef.current.feed(evt);
      if (coalesced) {
        // For streaming updates, replace the last delta with the coalesced version
        if (evt.type === 'assistant_delta') {
          // Remove previous coalesced entry for this stream block
          const filtered = result.filter(r => !(r.id === coalesced.id && r.type === 'assistant_message'));
          result.length = 0;
          result.push(...filtered);
        }
        if (!seenIds.has(coalesced.id)) {
          seenIds.add(coalesced.id);
          result.push(coalesced);
        }
      }
    }
    return result;
  }, [rawEvents]);

  // Subscribe to runtime:event (stream-json control plane)
  useEffect(() => {
    listen<RuntimeEvent>('runtime:event', (e) => {
      if (activeTabId && e.payload.sessionId === activeTabId) {
        setRawEvents((prev) => [...prev, e.payload]);
      }
    }).then((fn) => { unlistenRef.current = fn; });
    return () => { unlistenRef.current?.(); };
  }, [activeTabId]);

  const handleSend = useCallback((text: string) => {
    if (!activeTabId) return;
    invokeCommand('create_claude_chat', { options: {
      sessionId: activeTabId, projectId: activeSession?.projectId ?? 'default',
      cwd: activeSession?.cwd ?? '.', model: 'sonnet', prompt: text,
    } }).catch((err) => setError(`发送失败: ${String(err)}`));
    setRawEvents((prev) => [...prev, {
      id: `usr-${Date.now()}`, sessionId: activeTabId,
      projectId: activeSession?.projectId ?? '',
      type: 'user_message', content: text, severity: 'low',
      createdAt: new Date().toISOString(),
    }]);
  }, [activeTabId, activeSession]);

  const handleStartPtySession = useCallback(async () => {
    setStarting(true); setError(null);
    const sessionId = `pty-${Date.now()}`;
    try {
      const info = await invokeCommand<{ sessionId: string }>('pty_start_claude_session', {
        sessionId, projectId: 'default', cliPath: 'claude', cwd: '.', extraArgs: [],
      });
      addSession({
        id: info.sessionId, projectId: 'default', title: 'PTY 会话',
        runtimeMode: 'pty-interactive', status: 'running', model: 'sonnet',
        permissionMode: 'default', cwd: '.',
        inputTokens: 0, outputTokens: 0, totalCostUsd: 0,
        fileChangeCount: 0, riskCount: 0, auditCount: 0, isPinned: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), startedAt: new Date().toISOString(),
      });
      openSession({
        sessionId: info.sessionId, projectId: 'default', projectName: 'Demo', title: 'PTY 会话',
        status: 'running', viewMode: 'terminal', pendingConfirms: 0, riskCount: 0, isPinned: false,
      });
    } catch (err) { setError(`PTY 启动失败: ${String(err)}`); }
    finally { setStarting(false); }
  }, [addSession, openSession]);

  if (tabs.length === 0) {
    return (
      <div data-testid="surface-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <CcEmptyState icon="💬" title="工作区" description="新建会话开始与 Claude Code 对话" />
          <CcButton variant="primary" onClick={handleStartPtySession} disabled={starting}>{starting ? '启动中...' : '+ 新建会话'}</CcButton>
          {error && <div style={{ color: 'var(--cc-red)', fontSize: 'var(--cc-font-xs)' }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="surface-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <OpenSessionTabs tabs={tabs} activeTabId={activeTabId} onSelectTab={setActiveTab} onCloseTab={closeTab} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid var(--cc-border)', background: 'var(--cc-bg-muted)', flexShrink: 0, gap: 0 }}>
        {(['chat', 'terminal', 'split'] as ViewMode[]).map((mode) => {
          const labels: Record<ViewMode, string> = { chat: '💬 聊天', terminal: '⌨️ 终端', split: '📐 分屏' };
          const a = viewMode === mode;
          return <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '4px 14px', fontSize: 'var(--cc-font-xs)', fontWeight: a ? 600 : 400, border: 'none', borderBottom: a ? '2px solid var(--cc-navy)' : '2px solid transparent', background: a ? 'var(--cc-surface-solid)' : 'transparent', color: a ? 'var(--cc-text)' : 'var(--cc-text-muted)', cursor: 'pointer' }}>{labels[mode]}</button>;
        })}
        {error && <span style={{ marginLeft: 12, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-red)' }}>{error}</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {viewMode === 'chat' && <><ChatView events={events} /><ComposerBar viewMode="chat" runtimeMode="structured-print" model="sonnet" permissionMode="default" onSend={handleSend} onRuntimeModeChange={() => {}} /></>}
          {viewMode === 'terminal' && <TerminalView sessionId={activeTabId} />}
          {viewMode === 'split' && (<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}><div style={{ flex: '0 0 50%', borderRight: '1px solid var(--cc-border-strong)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><TerminalView sessionId={activeTabId} /></div><div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}><ChatView events={events} /><ComposerBar viewMode="split" runtimeMode="structured-print" model="sonnet" permissionMode="default" onSend={handleSend} onRuntimeModeChange={() => {}} /></div></div>)}
        </div>
        <SessionInspector session={activeSession} collapsed={inspectorCollapsed} expanded={inspectorExpanded} onToggleCollapse={() => setInspectorCollapsed((v) => !v)} onToggleExpand={() => setInspectorExpanded((v) => !v)} />
      </div>
    </div>
  );
}

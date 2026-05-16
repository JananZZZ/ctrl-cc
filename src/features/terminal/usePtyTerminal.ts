import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { RuntimeKernelBridge } from '../../runtime-kernel/runtimeKernelBridge';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
import type { RuntimeKernelEvent } from '../../runtime-kernel/types';
import { warnLog } from '../../services/invokeCommand';
import '@xterm/xterm/css/xterm.css';

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildXtermTheme() {
  return {
    background: readCssVar('--cc-bg') || '#1a1b1e',
    foreground: readCssVar('--cc-text') || '#d4d4d8',
    cursor: readCssVar('--cc-brand') || '#4c8dff',
    selectionBackground: (readCssVar('--cc-brand-soft') || '#3b82f6') + '40',
    black: readCssVar('--cc-bg-subtle') || '#1a1b1e',
    red: readCssVar('--cc-red') || '#f35b5b',
    green: readCssVar('--cc-green') || '#21c17a',
    yellow: readCssVar('--cc-amber') || '#f5a524',
    blue: readCssVar('--cc-blue') || '#4c8dff',
    magenta: readCssVar('--cc-purple') || '#8b7cff',
    cyan: '#06b6d4',
    white: readCssVar('--cc-text') || '#d4d4d8',
    brightBlack: readCssVar('--cc-text-soft') || '#52525b',
    brightRed: readCssVar('--cc-red') || '#f87171',
    brightGreen: readCssVar('--cc-green') || '#4ade80',
    brightYellow: readCssVar('--cc-amber') || '#facc15',
    brightBlue: readCssVar('--cc-blue') || '#60a5fa',
    brightMagenta: readCssVar('--cc-purple') || '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: readCssVar('--cc-text-inverse') || '#fafafa',
  };
}

export type PtyStatus = 'idle' | 'starting' | 'running' | 'waiting' | 'exited' | 'failed' | 'killed';

interface PtyTerminalHandle {
  status: PtyStatus;
  write: (data: string) => void;
  sendCtrlC: () => void;
  sendCtrlD: () => void;
  clear: () => void;
  search: (query: string) => void;
  serialize: () => string;
  fit: () => void;
}

export function usePtyTerminal(sessionId: string | null, container: HTMLDivElement | null): PtyTerminalHandle | null {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const serializeRef = useRef<SerializeAddon | null>(null);
  const deadRef = useRef(false);
  const lastBlockedInputAtRef = useRef(0);
  const runtimeStatus = useRuntimeKernelStore((s) =>
    sessionId ? s.sessions[sessionId]?.status : undefined
  );
  const runtimeError = useRuntimeKernelStore((s) =>
    sessionId ? s.sessions[sessionId]?.lastError : undefined
  );
  const [status, setStatus] = useState<PtyStatus>('idle');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container || !sessionId) return;
    if (termRef.current) return;

    deadRef.current = false;
    lastBlockedInputAtRef.current = 0;

    // Check initial status from kernel store
    const session = useRuntimeKernelStore.getState().sessions[sessionId];
    if (session && ['failed', 'exited', 'stopped'].includes(String(session.status))) {
      deadRef.current = true;
      setStatus(session.status === 'failed' ? 'failed' : 'exited');
    }

    const fit = new FitAddon();
    const search = new SearchAddon();
    const webLinks = new WebLinksAddon();
    const serialize = new SerializeAddon();
    fitRef.current = fit;
    searchRef.current = search;
    serializeRef.current = serialize;

    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cc-font-scale').trim()) || 1;
    const termFontSize = Math.round(13 * scale);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: termFontSize,
      fontFamily: 'var(--cc-font-mono), "JetBrains Mono", "Cascadia Code", Consolas, monospace',
      lineHeight: 1.35,
      scrollback: 10000,
      theme: buildXtermTheme(),
      allowProposedApi: true,
    });

    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(webLinks);
    term.loadAddon(serialize);

    // WebGL disabled by default on Windows WebView2 — causes GPU lag
    // v29: WebGL renderer removed — not needed, saves ~15KB gzipped

    term.open(container);
    fit.fit();
    termRef.current = term;

    const unlisteners: UnlistenFn[] = [];

    // v26.0: Single kernel event listener instead of pty://data, pty://status, pty://exit, pty://error
    listen<RuntimeKernelEvent>('runtime-kernel://event', (e) => {
      const payload = e.payload;
      if (payload.guiSessionId !== sessionId) return;

      if (payload.eventType === 'pty.data' && payload.data && !deadRef.current) {
        term.write(payload.data);
      }
      if (payload.status) {
        const map: Record<string, PtyStatus> = {
          starting: 'starting',
          ready: 'running',
          streaming: 'running',
          thinking: 'running',
          idle: 'running',
          exited: 'exited',
          failed: 'failed',
          stopped: 'killed',
        };
        setStatus(map[payload.status] ?? 'running');
      }
      if (payload.eventType === 'session.exited') {
        deadRef.current = true;
        setStatus('exited');
      }
      if (payload.eventType.includes('error')) {
        deadRef.current = true;
        setStatus('failed');
      }
    }).then((fn) => unlisteners.push(fn));

    term.onData((data) => {
      const current = useRuntimeKernelStore.getState().sessions[sessionId];

      if (deadRef.current) return;

      if (
        !current ||
        ['failed', 'exited', 'stopped'].includes(String(current.status)) ||
        !current.hasWriter ||
        !current.readerAlive
      ) {
        const now = Date.now();
        if (now - lastBlockedInputAtRef.current > 3000) {
          lastBlockedInputAtRef.current = now;
          term.writeln(
            `\x1b[33m[Ctrl-CC] Claude Runtime is not writable (${current?.status ?? 'missing'}). Start or recover runtime first.\x1b[0m`
          );
        }
        return;
      }

      RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data }).catch((e: unknown) => {
        const msg = String(e);
        warnLog('pty', 'RuntimeKernel terminal write failed', msg);
        term.writeln(`\x1b[31m[Ctrl-CC] Write failed: ${msg}\x1b[0m`);
      });
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer != null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fit.fit();
        const dims = fit.proposeDimensions();
        if (dims?.rows && dims?.cols) {
          // PTY resize not yet wired to RuntimeKernel v27 — fits xterm locally only
        }
      }, 120);
    });
    resizeObserver.observe(container);

    setReady(true);

    return () => {
      if (resizeTimer != null) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      unlisteners.forEach((fn) => fn());
      term.dispose();
      termRef.current = null;
      setReady(false);
    };
  }, [sessionId, container]);

  useEffect(() => {
    if (!runtimeStatus) return;

    if (['failed', 'exited', 'stopped'].includes(String(runtimeStatus))) {
      deadRef.current = true;
      setStatus('failed');

      const term = termRef.current;
      if (term) {
        const now = Date.now();
        if (now - lastBlockedInputAtRef.current > 3000) {
          lastBlockedInputAtRef.current = now;
          term.writeln(
            `\x1b[33m[Ctrl-CC] Claude Runtime is not writable (${runtimeStatus}). ${runtimeError ?? 'Open diagnostics and start a new session.'}\x1b[0m`
          );
        }
      }
    }
  }, [runtimeStatus, runtimeError]);

  const write = useCallback((data: string) => {
    if (!sessionId) return;
    RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data })
      .catch((e: unknown) => warnLog('pty', 'RuntimeKernel write failed', String(e)));
  }, [sessionId]);

  const sendCtrlC = useCallback(() => {
    if (!sessionId) return;
    RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data: '\x03' })
      .catch((e: unknown) => warnLog('pty', 'Ctrl+C failed', String(e)));
  }, [sessionId]);

  const sendCtrlD = useCallback(() => {
    if (!sessionId) return;
    RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data: '\x04' })
      .catch((e: unknown) => warnLog('pty', 'Ctrl+D failed', String(e)));
  }, [sessionId]);

  const clear = useCallback(() => { termRef.current?.clear(); }, []);
  const searchFn = useCallback((query: string) => { searchRef.current?.findNext(query); }, []);
  const serializeFn = useCallback(() => serializeRef.current?.serialize() ?? '', []);
  const fitFn = useCallback(() => { fitRef.current?.fit(); }, []);

  if (!ready) return null;
  return { status, write, sendCtrlC, sendCtrlD, clear, search: searchFn, serialize: serializeFn, fit: fitFn };
}

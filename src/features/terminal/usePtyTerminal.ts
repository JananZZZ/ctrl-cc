import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { RuntimeBridge } from '../runtime/services/runtimeBridge';
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

interface PtyDataPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  data: string;
}

interface PtyStatusPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  status: string;
}

interface PtyExitPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  exit_code?: number | null;
}

interface PtyErrorPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  message?: string;
  error?: string;
}

function sameUiSession(payload: { session_id?: string; uiSessionId?: string }, sessionId: string) {
  return payload.uiSessionId === sessionId || payload.session_id === sessionId;
}

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
  const [status, setStatus] = useState<PtyStatus>('idle');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container || !sessionId) return;
    if (termRef.current) return;

    deadRef.current = false;

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
    const enableWebgl = false;
    if (enableWebgl) {
      try { const wgl = new WebglAddon(); term.loadAddon(wgl); wgl.onContextLoss(() => wgl.dispose()); } catch {}
    }

    term.open(container);
    fit.fit();
    termRef.current = term;

    const unlisteners: UnlistenFn[] = [];

    listen<PtyDataPayload>('pty://data', (e) => {
      if (!sameUiSession(e.payload, sessionId)) return;
      if (deadRef.current) return;
      term.write(e.payload.data);
    }).then((fn) => unlisteners.push(fn));

    listen<PtyStatusPayload>('pty://status', (e) => {
      if (!sameUiSession(e.payload, sessionId)) return;
      const map: Record<string, PtyStatus> = { starting: 'starting', running: 'running', exited: 'exited', failed: 'failed', killed: 'killed' };
      const newStatus = map[e.payload.status] ?? 'idle';
      setStatus(newStatus);
    }).then((fn) => unlisteners.push(fn));

    listen<PtyExitPayload>('pty://exit', (e) => {
      if (!sameUiSession(e.payload, sessionId)) return;
      deadRef.current = true;
      setStatus('exited');
    }).then((fn) => unlisteners.push(fn));

    listen<PtyErrorPayload>('pty://error', (e) => {
      if (!sameUiSession(e.payload, sessionId)) return;
      deadRef.current = true;
      setStatus('failed');
    }).then((fn) => unlisteners.push(fn));

    term.onData((data) => {
      if (deadRef.current) {
        term.writeln('\x1b[33m[Ctrl-CC] This PTY session has exited. Start or resume a session before typing.\x1b[0m');
        return;
      }

      RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
        const msg = String(e);
        warnLog('pty', 'PTY write failed', msg);
        if (msg.includes('not writable') || msg.includes('exited') || msg.includes('os error 232') || msg.includes('管道')) {
          deadRef.current = true;
          setStatus('exited');
        }
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
          RuntimeBridge.resize(sessionId, dims.cols, dims.rows).catch((e: unknown) => warnLog('pty', 'PTY resize failed', String(e)));
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

  const write = useCallback((data: string) => { RuntimeBridge.write(sessionId!, data).catch((e: unknown) => warnLog('pty', 'PTY write failed', String(e))); }, [sessionId]);
  const sendCtrlC = useCallback(() => { RuntimeBridge.ctrlC(sessionId!).catch((e: unknown) => warnLog('pty', 'Ctrl+C failed', String(e))); }, [sessionId]);
  const sendCtrlD = useCallback(() => { RuntimeBridge.ctrlD(sessionId!).catch((e: unknown) => warnLog('pty', 'Ctrl+D failed', String(e))); }, [sessionId]);
  const clear = useCallback(() => { termRef.current?.clear(); }, []);
  const searchFn = useCallback((query: string) => { searchRef.current?.findNext(query); }, []);
  const serializeFn = useCallback(() => serializeRef.current?.serialize() ?? '', []);
  const fitFn = useCallback(() => { fitRef.current?.fit(); }, []);

  if (!ready) return null;
  return { status, write, sendCtrlC, sendCtrlD, clear, search: searchFn, serialize: serializeFn, fit: fitFn };
}

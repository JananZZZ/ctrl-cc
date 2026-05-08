import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invokeCommand } from '../../services/invokeCommand';
import '@xterm/xterm/css/xterm.css';

export type PtyStatus = 'idle' | 'starting' | 'running' | 'waiting' | 'exited' | 'failed' | 'killed';

interface PtyDataPayload { session_id: string; pty_id: string; data: string; }
interface PtyStatusPayload { session_id: string; pty_id: string; status: string; }
interface PtyExitPayload { session_id: string; pty_id: string; exit_code: number | null; }
interface PtyErrorPayload { session_id: string; pty_id: string; message: string; }

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
  const [status, setStatus] = useState<PtyStatus>('idle');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container || !sessionId) return;
    if (termRef.current) return;

    const fit = new FitAddon();
    const search = new SearchAddon();
    const webLinks = new WebLinksAddon();
    const serialize = new SerializeAddon();
    fitRef.current = fit;
    searchRef.current = search;
    serializeRef.current = serialize;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--cc-font-mono), "JetBrains Mono", "Cascadia Code", Consolas, monospace',
      lineHeight: 1.35,
      scrollback: 10000,
      theme: {
        background: '#1a1b1e', foreground: '#d4d4d8',
        cursor: '#4c8dff', selectionBackground: '#3b82f640',
        black: '#1a1b1e', red: '#f35b5b', green: '#21c17a', yellow: '#f5a524',
        blue: '#4c8dff', magenta: '#8b7cff', cyan: '#06b6d4', white: '#d4d4d8',
        brightBlack: '#52525b', brightRed: '#f87171', brightGreen: '#4ade80',
        brightYellow: '#facc15', brightBlue: '#60a5fa', brightMagenta: '#c084fc',
        brightCyan: '#22d3ee', brightWhite: '#fafafa',
      },
      allowProposedApi: true,
    });

    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(webLinks);
    term.loadAddon(serialize);

    try { const wgl = new WebglAddon(); term.loadAddon(wgl); wgl.onContextLoss(() => wgl.dispose()); } catch {}

    term.open(container);
    fit.fit();
    termRef.current = term;

    const unlisteners: UnlistenFn[] = [];

    listen<PtyDataPayload>('pty://data', (e) => {
      if (e.payload.session_id !== sessionId) return;
      term.write(e.payload.data);
    }).then((fn) => unlisteners.push(fn));

    listen<PtyStatusPayload>('pty://status', (e) => {
      if (e.payload.session_id !== sessionId) return;
      const map: Record<string, PtyStatus> = { starting: 'starting', running: 'running', exited: 'exited', failed: 'failed', killed: 'killed' };
      setStatus(map[e.payload.status] ?? 'idle');
    }).then((fn) => unlisteners.push(fn));

    listen<PtyExitPayload>('pty://exit', () => { setStatus('exited'); }).then((fn) => unlisteners.push(fn));
    listen<PtyErrorPayload>('pty://error', () => { setStatus('failed'); }).then((fn) => unlisteners.push(fn));

    term.onData((data) => {
      invokeCommand('pty_v2_write', { sessionId, data }).catch(() => {});
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      const dims = fit.proposeDimensions();
      if (dims && dims.rows && dims.cols) {
        invokeCommand('pty_v2_resize', { sessionId, rows: dims.rows, cols: dims.cols }).catch(() => {});
      }
    });
    resizeObserver.observe(container);

    setReady(true);

    return () => {
      resizeObserver.disconnect();
      unlisteners.forEach((fn) => fn());
      term.dispose();
      termRef.current = null;
      setReady(false);
    };
  }, [sessionId, container]);

  const write = useCallback((data: string) => { invokeCommand('pty_v2_write', { sessionId, data }).catch(() => {}); }, [sessionId]);
  const sendCtrlC = useCallback(() => { invokeCommand('pty_send_ctrl_c', { sessionId }).catch(() => {}); }, [sessionId]);
  const sendCtrlD = useCallback(() => { invokeCommand('pty_send_ctrl_d', { sessionId }).catch(() => {}); }, [sessionId]);
  const clear = useCallback(() => { termRef.current?.clear(); }, []);
  const searchFn = useCallback((query: string) => { searchRef.current?.findNext(query); }, []);
  const serializeFn = useCallback(() => serializeRef.current?.serialize() ?? '', []);
  const fitFn = useCallback(() => { fitRef.current?.fit(); }, []);

  if (!ready) return null;
  return { status, write, sendCtrlC, sendCtrlD, clear, search: searchFn, serialize: serializeFn, fit: fitFn };
}

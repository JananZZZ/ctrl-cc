import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { probeRuntimeContract } from '../services/runtimeContractProbe';
import { useRuntimeTraceStore } from '../stores/runtimeTraceStore';
import { useRuntimeStore } from '../stores/runtimeStore';
import { RuntimeBridge } from '../services/runtimeBridge';
import type { RuntimeContractProbeResult } from '../services/runtimeContractProbe';
import { formatTraceTime } from '../utils/traceTime';

interface DiscoveryMatrix {
  shellStrategies: Array<{name:string;path:string;available:boolean;note:string}>;
  claudeCandidates: Array<{name:string;path:string;found:boolean;versionOk:boolean;versionText?:string|null;error?:string|null;runnableBy:string}>;
  selectedStrategy?: string|null; selectedCandidate?: string|null; overallStatus: string;
}

export function RuntimeDiagnosticsPanel() {
  const [probe, setProbe] = useState<RuntimeContractProbeResult | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractTestRunning, setContractTestRunning] = useState(false);
  const [contractTestResult, setContractTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [jsCandidates, setJsCandidates] = useState<Array<{ path: string; exists: boolean; source: string }>>([]);
  const [nativeClaude, setNativeClaude] = useState<Array<{ path: string; source: string; exists: boolean; executable: boolean; versionOk: boolean; versionText: string | null; printOk: boolean; interactiveAllowed: boolean; error: string | null }>>([]);
  const traceEvents = useRuntimeTraceStore((s) => s.events);
  const rtSessions = useRuntimeStore((s) => s.sessions);

  const runActiveContractTest = async () => {
    setContractTestRunning(true);
    setContractTestResult(null);
    try {
      const result = await RuntimeBridge.runContractTest({
        projectId: 'diagnostic',
        projectName: 'Runtime Diagnostic',
        cwd: String(await invoke('get_current_dir').catch(() => '.')),
      });
      setContractTestResult({ ok: true });
      void result;
      await refreshProbe();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setContractTestResult({ ok: false, error: message });
    } finally {
      setContractTestRunning(false);
    }
  };

  const refreshProbe = async () => {
    setLoading(true);
    try {
      const [probeResult, discoveryResult] = await Promise.all([
        probeRuntimeContract(),
        invoke<DiscoveryMatrix>('runtime_discover_claude_v2').catch(() => null),
      ]);
      setProbe(probeResult);
      setDiscovery(discoveryResult);
      invoke<Array<{ path: string; exists: boolean; source: string }>>('runtime_find_claude_js_candidates')
        .then(setJsCandidates)
        .catch(() => setJsCandidates([]));
      invoke<Array<{ path: string; source: string; exists: boolean; executable: boolean; versionOk: boolean; versionText: string | null; printOk: boolean; interactiveAllowed: boolean; error: string | null }>>('runtime_discover_native_claude')
        .then(setNativeClaude)
        .catch(() => setNativeClaude([]));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const runProbe = async () => {
    setLoading(true);
    setError(null);
    try {
      const [probeResult, discoveryResult] = await Promise.all([
        probeRuntimeContract(),
        invoke<DiscoveryMatrix>('runtime_discover_claude_v2').catch(() => null),
      ]);
      setProbe(probeResult);
      setDiscovery(discoveryResult);
      invoke<Array<{ path: string; exists: boolean; source: string }>>('runtime_find_claude_js_candidates')
        .then(setJsCandidates)
        .catch(() => setJsCandidates([]));
      invoke<Array<{ path: string; source: string; exists: boolean; executable: boolean; versionOk: boolean; versionText: string | null; printOk: boolean; interactiveAllowed: boolean; error: string | null }>>('runtime_discover_native_claude')
        .then(setNativeClaude)
        .catch(() => setNativeClaude([]));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, margin: 0 }}>Runtime Diagnostics</h3>
        <button onClick={runProbe} disabled={loading} style={btnStyle}>
          {loading ? 'Probing...' : 'Run Runtime Contract Test'}
        </button>
        <button onClick={() => void runActiveContractTest()} disabled={contractTestRunning} style={btnStyle}>
          {contractTestRunning ? 'Running Contract Test...' : 'Run Active Runtime Contract Test'}
        </button>
        {probe && <ContractStatusBadge probe={probe} />}
        {contractTestResult && (
          <span style={{ color: contractTestResult.ok ? 'var(--cc-green)' : 'var(--cc-red)', fontSize: 'var(--cc-font-xs)' }}>
            {contractTestResult.ok ? 'Test passed' : `Test failed: ${contractTestResult.error}`}
          </span>
        )}
        {error && <span style={{ color: 'var(--cc-red)' }}>{error}</span>}
      </div>

      {/* Legacy Launch Plan Matrix (v2 discovery) */}
      {discovery && Array.isArray((discovery as any).plans) && (
        <Section title="Legacy Launch Plan Matrix">
          <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--cc-radius-sm)' }}>
          <table style={{ ...tableStyle, minWidth: 980 }}>
            <thead>
              <tr>
                {['Plan', 'Program', 'Args Prefix', 'Policy', 'Canary', 'Selected', 'Error'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(discovery as any).plans.map((p: any) => (
                <tr key={p.id}>
                  <td style={tdStyle}>{p.id}</td>
                  <td style={tdStyle}>{p.program}</td>
                  <td style={tdStyle}>{(p.argsPrefix ?? p.args_prefix ?? []).join(' ')}</td>
                  <td style={tdStyle}>{p.id?.includes?.("powershell") || p.id?.includes?.("pwsh") || p.id?.includes?.("cmd") ? "blocked (shell wrapper)" : "allowed"}</td>
                  <td style={tdStyle}>{p.canaryOk ? 'PASS' : (p.canaryOk === false ? 'FAIL' : 'NOT RUN')}</td>
                  <td style={tdStyle}>{p.versionOk ? (p.versionText ?? 'OK') : 'FAIL'}</td>
                  <td style={tdStyle}>{p.selected ? 'SELECTED' : '-'}</td>
                  <td style={tdStyle}>{p.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Section>
      )}
      {/* Claude JS Candidates */}
      <Section title="Claude JS Candidates">
        {jsCandidates.length === 0 ? (
          <p style={{ color: 'var(--cc-text-muted)' }}>No JS candidates found. Set CTRL_CC_CLAUDE_JS manually.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...tableStyle, minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Exists</th>
                  <th style={thStyle}>Path</th>
                  <th style={thStyle}>Source</th>
                </tr>
              </thead>
              <tbody>
                {jsCandidates.map((c) => (
                  <tr key={c.path}>
                    <td style={tdStyle}>{c.exists ? '✅' : '❌'}</td>
                    <td style={tdStyle}><code>{c.path}</code></td>
                    <td style={tdStyle}>{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Native Claude Executable Candidates */}
      <Section title="Native Claude Executable Candidates">
        {nativeClaude.length === 0 ? (
          <p style={{ color: 'var(--cc-text-muted)' }}>No native Claude candidates found. Run diagnostics to scan for claude.exe.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...tableStyle, minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Path</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>Exists</th>
                  <th style={thStyle}>Version</th>
                  <th style={thStyle}>Interactive</th>
                  <th style={thStyle}>Error</th>
                </tr>
              </thead>
              <tbody>
                {nativeClaude.map((c) => (
                  <tr key={c.path}>
                    <td style={tdStyle}><code>{c.path}</code></td>
                    <td style={tdStyle}>{c.source}</td>
                    <td style={tdStyle}>{c.exists ? '✅' : '❌'}</td>
                    <td style={tdStyle}>{c.versionOk ? (c.versionText ?? 'OK') : 'FAIL'}</td>
                    <td style={tdStyle}>{c.interactiveAllowed ? '✅ Allowed' : '❌ Blocked'}</td>
                    <td style={tdStyle}>{c.error ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Runtime Fabric Ledger (v19.0) */}
      <Section title="Runtime Fabric Ledger">
        <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
          Runtime Fabric Store tracks Chat / Terminal / Background channels via Event Ledger.
          New sessions default to Chat (stream-json). Terminal starts native claude.exe on demand.
        </div>
      </Section>

      {/* Legacy discovery: only show if old format */}
      {discovery && (discovery as any).shellStrategies && (
        <Section title={`Legacy Discovery — ${(discovery as any).overallStatus}`}>
          <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>Old discovery format deprecated. Use Launch Plan Matrix above.</div>
        </Section>
      )}

      {probe && (
        <>
          {/* Session Mapping */}
          <Section title="Session Mapping">
            <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--cc-radius-sm)' }}>
            <table style={{ ...tableStyle, minWidth: 980 }}>
              <thead><tr>{['UI Session ID','PTY Session ID','Claude Sess ID','Frontend Status','Backend Exists','CWD','Error'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {probe.frontendSessions.map((fs) => {
                  const backend = probe.backendPtySessions.find(b => b.ptySessionId === fs.ptySessionId);
                  return (
                    <tr key={fs.uiSessionId}>
                      <td style={tdStyle}>{fs.uiSessionId.slice(0,16)}...</td>
                      <td style={tdStyle}>{fs.ptySessionId ? fs.ptySessionId.slice(0,16)+'...' : <span style={{color:'var(--cc-red)'}}>NULL</span>}</td>
                      <td style={tdStyle}>{fs.claudeSessionId ? fs.claudeSessionId.slice(0,12)+'...' : '-'}</td>
                      <td style={tdStyle}><StatusBadge status={fs.status} /></td>
                      <td style={tdStyle}>{backend ? <span style={{color:'var(--cc-green)'}}>Yes (PID:{backend.pid ?? '?'})</span> : <span style={{color:'var(--cc-red)'}}>No</span>}</td>
                      <td style={tdStyle}>{fs.cwd}</td>
                      <td style={tdStyle}>{fs.error || '-'}</td>
                    </tr>
                  );
                })}
                {probe.frontendSessions.length === 0 && <tr><td colSpan={7} style={tdStyle}>No frontend sessions</td></tr>}
              </tbody>
            </table>
            </div>
          </Section>

          {/* Mismatches */}
          {probe.mismatches.length > 0 && (
            <Section title="Contract Mismatches">
              {probe.mismatches.map((m, i) => (
                <div key={i} style={{ padding: '4px 8px', borderLeft: '3px solid var(--cc-red)', marginBottom: 4, background: 'var(--cc-red-soft)', borderRadius: 4 }}>
                  <strong>{m.uiSessionId}</strong> → pty: <code>{m.ptySessionId ?? 'null'}</code>: {m.reason}
                </div>
              ))}
            </Section>
          )}

          {/* Backend PTY Registry */}
          <Section title={`PTY Registry (${probe.backendPtySessions.length})`}>
            <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--cc-radius-sm)' }}>
            <table style={{ ...tableStyle, minWidth: 980 }}>
              <thead><tr>{['PTY Session ID','UI Session ID','CWD','PID','Status','Has Writer','Created'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {probe.backendPtySessions.map((b) => (
                  <tr key={b.ptySessionId}>
                    <td style={tdStyle}>{b.ptySessionId.slice(0,20)}...</td>
                    <td style={tdStyle}>{b.uiSessionId?.slice(0,16) ?? '-'}...</td>
                    <td style={tdStyle}>{b.cwd}</td>
                    <td style={tdStyle}>{b.pid ?? '-'}</td>
                    <td style={tdStyle}><StatusBadge status={b.status} /></td>
                    <td style={tdStyle}>{b.hasWriter ? '✅' : '❌'}</td>
                    <td style={tdStyle}>{b.createdAt ? new Date(b.createdAt).toLocaleTimeString() : '-'}</td>
                  </tr>
                ))}
                {probe.backendPtySessions.length === 0 && <tr><td colSpan={7} style={tdStyle}>Empty — no PTY sessions in backend registry</td></tr>}
              </tbody>
            </table>
            </div>
          </Section>
        </>
      )}

      {/* Trace Timeline */}
      <Section title={`Trace Timeline (${traceEvents.length})`}>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {traceEvents.slice(0, 50).map((e) => (
            <div key={e.id} style={{ padding: '2px 8px', borderLeft: `3px solid ${e.level === 'error' ? 'var(--cc-red)' : e.level === 'warning' ? 'var(--cc-amber)' : 'var(--cc-border)'}`, marginBottom: 2, fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              <span style={{ color: 'var(--cc-text-soft)' }}>{formatTraceTime(e.ts)}</span>
              <span style={{ marginLeft: 6, color: 'var(--cc-text-muted)' }}>[{e.source}]</span>
              <span style={{ marginLeft: 6, fontWeight: 600 }}>{e.type}</span>
              <span style={{ marginLeft: 6, color: 'var(--cc-text-soft)' }}>{e.message}</span>
              {(e.uiSessionId || e.ptySessionId) && <span style={{ marginLeft: 6, color: 'var(--cc-blue)' }}>ui:{e.uiSessionId?.slice(0,10) ?? '-'} pty:{e.ptySessionId?.slice(0,10) ?? '-'}</span>}
            </div>
          ))}
        </div>
      </Section>

      {/* Raw Log Paths */}
      <Section title="Raw Log Paths">
        <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div>Rust debug: <code style={{ color: 'var(--cc-blue)' }}>%TEMP%/ctrl-cc-runtime-debug.log</code></div>
          <div>Rust trace: <code style={{ color: 'var(--cc-blue)' }}>%TEMP%/ctrl-cc-runtime-trace.log</code></div>
          <div>React error: <code style={{ color: 'var(--cc-blue)' }}>localStorage['ctrlcc:last-react-error']</code></div>
          <div>Render loop: <code style={{ color: 'var(--cc-blue)' }}>localStorage['ctrlcc:render-loop']</code></div>
        </div>
      </Section>

      {/* Orphan Processes */}
      <Section title="Orphan Processes">
        <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
          Orphan detection via backend watchdog. Run diagnostics to check for dangling PTY child processes.
        </div>
      </Section>

      {/* Copy Diagnostic Bundle */}
      <Section title="Diagnostic Bundle">
        <button style={btnStyle} onClick={() => {
          const bundle = {
            generatedAt: new Date().toISOString(),
            frontendSessionCount: Object.keys(rtSessions).length,
            backendPtyCount: probe?.backendPtySessions?.length ?? 0,
            mismatchCount: probe?.mismatches?.length ?? 0,
            traceCount: traceEvents.length,
            sessions: Object.values(rtSessions).map(s => ({ id: s.id, ptySessionId: s.ptySessionId, status: s.status, cwd: s.cwd, error: s.error })),
            backendPtySessions: probe?.backendPtySessions ?? [],
            mismatches: probe?.mismatches ?? [],
            recentTraces: traceEvents.slice(-50),
          };
          const json = JSON.stringify(bundle, null, 2);
          navigator.clipboard.writeText(json).then(() => alert('Diagnostic bundle copied to clipboard')).catch(() => alert('Failed to copy: ' + json.slice(0, 200)));
        }}>
          Copy Diagnostic Bundle
        </button>
      </Section>

      {/* Frontend Runtime Store */}
      <Section title={`Frontend RuntimeStore (${Object.keys(rtSessions).length} sessions)`}>
        {Object.values(rtSessions).map((s) => (
          <div key={s.id} style={{ padding: '4px 8px', marginBottom: 4, background: 'var(--cc-bg-subtle)', borderRadius: 4, fontSize: 'var(--cc-font-xs)' }}>
            <strong>{s.id}</strong> → pty:<code>{s.ptySessionId?.slice(0,12) ?? 'null'}...</code> trace:<code>{s.traceId.slice(0,16)}...</code><br/>
            status:<StatusBadge status={s.status} /> cwd:{s.cwd}
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, color: 'var(--cc-text)', margin: '0 0 8px', borderBottom: '1px solid var(--cc-border)', paddingBottom: 4 }}>{title}</h4>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'claude-active' || status === 'pty-ready' ? 'var(--cc-green)' :
    status === 'failed' || status === 'discovery-failed' || status === 'disconnected' ? 'var(--cc-red)' :
    status === 'pty-starting' || status === 'discovering' ? 'var(--cc-amber)' : 'var(--cc-text-muted)';
  return <span style={{ color, fontWeight: 600 }}>{status}</span>;
}

/** Phase A: Correct contract status — NOT TESTED when 0 sessions. */
function getContractStatus(probe: RuntimeContractProbeResult | null) {
  if (!probe) {
    return { label: 'NOT RUN', tone: 'muted' as const, detail: 'Runtime contract probe has not been executed.' };
  }
  const frontendCount = probe.frontendSessions?.length ?? 0;
  const backendCount = probe.backendPtySessions?.length ?? 0;
  const mismatchCount = probe.mismatches?.length ?? 0;

  if (frontendCount === 0 && backendCount === 0) {
    return { label: 'NOT TESTED — NO SESSIONS', tone: 'warning' as const, detail: 'No frontend RuntimeSession and no backend PTY session exist. Run an active Runtime Contract Test.' };
  }
  const failedFrontendCount = probe.frontendSessions.filter((s) =>
    ['failed', 'discovery-failed'].includes(s.status)
  ).length;
  if (failedFrontendCount > 0) {
    return {
      label: `${failedFrontendCount} STARTUP FAILED`,
      tone: 'error' as const,
      detail: 'One or more RuntimeSessions failed before backend PTY creation.',
    };
  }
  if (mismatchCount > 0) {
    return { label: `${mismatchCount} CONTRACT MISMATCHES`, tone: 'error' as const, detail: 'Frontend RuntimeStore and backend PTY registry are inconsistent.' };
  }
  return { label: 'CONTRACTS PASSED', tone: 'success' as const, detail: 'RuntimeSession mappings match backend PTY registry.' };
}

const toneColors: Record<string, string> = {
  success: 'var(--cc-green)', warning: 'var(--cc-amber)', error: 'var(--cc-red)', muted: 'var(--cc-text-muted)',
};

function ContractStatusBadge({ probe }: { probe: RuntimeContractProbeResult | null }) {
  const status = getContractStatus(probe);
  return (
    <span style={{ color: toneColors[status.tone], fontWeight: 600, fontSize: 'var(--cc-font-sm)' }} title={status.detail}>
      {status.label}
    </span>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 16px', fontSize: 'var(--cc-font-sm)', fontWeight: 600,
  border: '1px solid var(--cc-brand)', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-brand)', color: 'var(--cc-text-on-accent)', cursor: 'pointer',
};
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--cc-font-xs)' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--cc-border)', color: 'var(--cc-text-muted)', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '3px 8px', borderBottom: '1px solid var(--cc-border-soft)', color: 'var(--cc-text)' };

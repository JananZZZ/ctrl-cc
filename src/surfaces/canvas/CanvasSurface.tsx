import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/sessionStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';

interface Node { id: string; label: string; x: number; y: number; color: string; size: number; type: string; connections: string[]; }

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function CanvasSurface() {
  useRenderLoopGuard('CanvasSurface');
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projects = useProjectStore((s) => s.projects);
  const sessions = useSessionStore((s) => s.sessions);
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [nodePos, setNodePos] = useState<Record<string,{x:number;y:number}>>({});

  const colors = useMemo(() => ({
    project: getCssVar('--cc-brand') || '#3b82f6',
    running: getCssVar('--cc-green') || '#22c55e',
    failed: getCssVar('--cc-red') || '#ef4444',
    idle: getCssVar('--cc-text-muted') || '#6b7280',
    connector: getCssVar('--cc-border') || 'rgba(156,163,175,0.2)',
    selectionGlow: 'rgba(255,255,255,0.3)',
    selectedFill: getCssVar('--cc-text-inverse') || '#fff',
    text: getCssVar('--cc-text-muted') || '#d1d5db',
    bg: getCssVar('--cc-bg') || '#0d1117',
    btnText: getCssVar('--cc-text-on-accent') || '#fff',
  }), []);

  const nodes: Node[] = useMemo(() => [
    ...projects.map((p, i) => ({ id: p.id, label: p.name, x: nodePos[p.id]?.x ?? 80 + i * 240, y: nodePos[p.id]?.y ?? 80, color: colors.project, size: 22, type: 'project', connections: sessions.filter((s) => s.projectId === p.id).map((s) => s.id) })),
    ...sessions.slice(0, 20).map((s, i) => ({ id: s.id, label: s.title, x: nodePos[s.id]?.x ?? 100 + (i % 6) * 150, y: nodePos[s.id]?.y ?? 200 + Math.floor(i / 6) * 140, color: s.status === 'running' ? colors.running : s.status === 'failed' ? colors.failed : colors.idle, size: 13, type: 'session', connections: [s.projectId] })),
  ], [projects, sessions, nodePos, colors]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; const r = c.getBoundingClientRect();
    c.width = r.width * dpr; c.height = r.height * dpr; ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.save(); ctx.translate(offset.x, offset.y); ctx.scale(scale, scale);
    ctx.strokeStyle = colors.connector; ctx.lineWidth = 1;
    nodes.forEach((n) => n.connections.forEach((tid) => { const t2 = nodes.find((x) => x.id === tid); if (t2) { ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(t2.x, t2.y); ctx.stroke(); } }));
    nodes.forEach((n) => {
      ctx.beginPath(); ctx.arc(n.x, n.y, n.size+4, 0, Math.PI*2); ctx.fillStyle = n.id===selectedNode ? colors.selectionGlow : n.color+'30'; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, n.size, 0, Math.PI*2); ctx.fillStyle = n.id===selectedNode ? colors.selectedFill : n.color; ctx.fill();
      if (n.id===selectedNode) { ctx.strokeStyle=n.color; ctx.lineWidth=2.5; ctx.stroke(); }
      ctx.fillStyle=colors.text; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.fillText(n.label.slice(0,22), n.x, n.y+n.size+14);
    });
    ctx.restore();
    const legends = [
      { c: colors.project, l: t('canvas.projectLegend') },
      { c: colors.running, l: t('canvas.runningLegend') },
      { c: colors.idle, l: t('canvas.idleLegend') },
      { c: colors.failed, l: t('canvas.failedLegend') },
    ];
    let ly = r.height - 80;
    legends.forEach(({ c: col, l: label }) => {
      ctx.beginPath(); ctx.arc(16 + 5, ly + 5, 6, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = colors.text; ctx.font = '11px sans-serif'; ctx.textAlign = 'start'; ctx.fillText(label, 16 + 18, ly + 9);
      ly += 18;
    });
  }, [nodes, selectedNode, scale, offset, t, colors]);

  const getPos = useCallback((e: React.MouseEvent) => { const r = canvasRef.current?.getBoundingClientRect(); if (!r) return {x:0,y:0}; return {x:(e.clientX-r.left-offset.x)/scale, y:(e.clientY-r.top-offset.y)/scale}; }, [offset,scale]);
  const hWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); setScale((s)=>Math.max(0.08,Math.min(5,s-e.deltaY*0.0008))); }, []);
  const hDown = useCallback((e: React.MouseEvent) => { const p=getPos(e); const hit=nodes.find((n)=>Math.hypot(n.x-p.x,n.y-p.y)<n.size+10); if(hit){setSelectedNode(hit.id);setDragging('node');setDragStart(p);}else{setDragging('pan');setDragStart({x:e.clientX-offset.x,y:e.clientY-offset.y});} }, [nodes,offset,getPos]);
  const hMove = useCallback((e: React.MouseEvent) => { if(dragging==='pan'){setOffset({x:e.clientX-dragStart.x,y:e.clientY-dragStart.y});}else if(dragging==='node'&&selectedNode){const p=getPos(e);setNodePos((prev)=>({...prev,[selectedNode]:{x:p.x,y:p.y}}));} }, [dragging,dragStart,selectedNode,getPos]);
  const hUp = useCallback(() => setDragging(null), []);

  const sel = nodes.find((n)=>n.id===selectedNode);
  const openSel = () => { if(sel&&sel.type==='session'){const s=sessions.find((x)=>x.id===sel.id);if(s){openSession({sessionId:s.id,projectId:s.projectId,projectName:s.title,title:s.title,status:s.status,viewMode:'chat',pendingConfirms:0,riskCount:s.riskCount,isPinned:false});navigateTo('workspace');}}};

  return (
    <div data-testid="surface-canvas" style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{padding:'10px 20px',borderBottom:'1px solid var(--cc-border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,background:'var(--cc-surface-solid)'}}>
        <div>
          <h1 style={{fontSize:'var(--cc-font-xl)',fontWeight:600,color:'var(--cc-text)',margin:0}}>{t('canvas.title')}</h1>
          <span style={{fontSize:'var(--cc-font-xs)',color:'var(--cc-text-muted)'}}>{nodes.length} {t('canvas.nodes')}, {projects.length} {t('canvas.projectLegend')}, {t('canvas.zoom')} {Math.round(scale*100)}%</span>
        </div>
        <div style={{display:'flex',gap:4}}>
          <button onClick={()=>{setScale(1);setOffset({x:0,y:0});}} style={bs}>{t('canvas.resetView')}</button>
          <button onClick={()=>setScale((s)=>s+0.25)} style={bs}>+</button>
          <button onClick={()=>setScale((s)=>Math.max(0.08,s-0.25))} style={bs}>-</button>
        </div>
      </div>
      <div style={{flex:1,position:'relative',overflow:'hidden',background:'var(--cc-bg)'}}>
        <canvas ref={canvasRef} style={{width:'100%',height:'100%',cursor:dragging?'grabbing':'grab'}} onWheel={hWheel} onMouseDown={hDown} onMouseMove={hMove} onMouseUp={hUp} />
      </div>
      {sel && (
        <div style={{padding:'8px 20px',borderTop:'1px solid var(--cc-border)',background:'var(--cc-surface-solid)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'var(--cc-font-sm)'}}>
          <div>
            <span style={{fontWeight:600,color:sel.color}}>{sel.type.toUpperCase()}</span>
            <span style={{marginLeft:10,color:'var(--cc-text)'}}>{sel.label}</span>
            <span style={{marginLeft:10,color:'var(--cc-text-muted)'}}>{sel.connections.length} {t('canvas.connections')}</span>
          </div>
          {sel.type==='session'&&<button onClick={openSel} style={{padding:'4px 12px',fontSize:'var(--cc-font-xs)',border:'1px solid var(--cc-navy)',borderRadius:'var(--cc-radius-sm)',background:'var(--cc-navy)',color:'var(--cc-text-on-accent)',cursor:'pointer',fontWeight:500}}>{t('canvas.openInWorkspace')}</button>}
        </div>
      )}
    </div>
  );
}
const bs: React.CSSProperties = {padding:'4px 10px',fontSize:'var(--cc-font-xs)',border:'1px solid var(--cc-border)',borderRadius:'var(--cc-radius-xs)',background:'var(--cc-surface-solid)',color:'var(--cc-text)',cursor:'pointer'};

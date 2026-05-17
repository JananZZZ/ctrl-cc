import React, { useState, useCallback } from 'react';

export interface ProjectNavItem {
  id: string;
  name: string;
  pathTail: string;
  status: 'active' | 'idle' | 'needs-attention' | 'archived' | 'missing-path';
  runningCount: number;
  riskCount: number;
  gitBranch?: string;
}

export interface ProjectNavSection {
  id: string;
  label: string;
  filter: (p: ProjectNavItem) => boolean;
}

interface ProjectNavProps {
  projects: ProjectNavItem[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  sections: ProjectNavSection[];
}

const STATUS_VALUES: Record<ProjectNavItem['status'], number> = {
  'active': 4, 'needs-attention': 3, 'idle': 2, 'archived': 1, 'missing-path': 0,
};

const STATUS_COLORS: Record<ProjectNavItem['status'], string> = {
  'active': 'var(--cc-green)', 'idle': 'var(--cc-text-soft)',
  'needs-attention': 'var(--cc-amber)', 'archived': 'var(--cc-text-muted)',
  'missing-path': 'var(--cc-red)',
};

const SECTION_SORT = ['favorites','running','needs-attention','all','archived','missing-path'];

function sortSections(s: ProjectNavSection[]): ProjectNavSection[] {
  return [...s].sort((a,b)=>{const ai=SECTION_SORT.indexOf(a.id),bi=SECTION_SORT.indexOf(b.id);if(ai!==-1&&bi!==-1)return ai-bi;if(ai!==-1)return-1;if(bi!==-1)return 1;return 0});
}

function sortProjects(p: ProjectNavItem[]): ProjectNavItem[] {
  return [...p].sort((a,b)=>STATUS_VALUES[b.status]-STATUS_VALUES[a.status]||a.name.localeCompare(b.name));
}

export function ProjectNav({projects,activeProjectId,onSelectProject,sections}:ProjectNavProps){
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const toggle=useCallback((id:string)=>{setCollapsed(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n})},[]);
  const sorted=sortSections(sections);
  return(
    <nav style={N} aria-label="Project Navigation">
      <div style={NI}>
        {sorted.map(sec=>{
          const items=sortProjects(projects.filter(sec.filter));
          const isCol=collapsed.has(sec.id);
          return(
            <div key={sec.id} style={SG}>
              <button onClick={()=>toggle(sec.id)} style={SH} aria-expanded={!isCol}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{...CH,transform:isCol?'rotate(-90deg)':'rotate(0deg)'}}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                <span style={SL}>{sec.label}</span>
                <span style={SC}>{items.length}</span>
              </button>
              {!isCol&&(
                <div style={IL}>
                  {items.length===0?<div style={EM}>empty</div>:items.map(p=>(
                    <button key={p.id} onClick={()=>onSelectProject(p.id)} style={p.id===activeProjectId?{...RS,...RA}:RS} title={p.name}>
                      <span style={{...SD,background:STATUS_COLORS[p.status]}}/>
                      <div style={RT}>
                        <span style={PN}>{p.name}</span>
                        <span style={PT}>{p.pathTail}</span>
                      </div>
                      <div style={RB}>
                        {p.runningCount>0&&<span style={RN}>{p.runningCount}</span>}
                        {p.riskCount>0&&<span style={RK}>{p.riskCount}</span>}
                        {p.gitBranch&&<span style={GC}>{p.gitBranch}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

const N:React.CSSProperties={width:280,minWidth:240,height:'100%',borderRight:'1px solid var(--cc-border)',background:'var(--cc-surface)',display:'flex',flexDirection:'column',overflow:'hidden'};
const NI:React.CSSProperties={flex:1,overflowY:'auto',padding:'var(--cc-space-2) 0'};
const SG:React.CSSProperties={marginBottom:2};
const SH:React.CSSProperties={display:'flex',alignItems:'center',gap:6,width:'100%',height:32,padding:'0 var(--cc-space-3)',border:'none',background:'transparent',color:'var(--cc-text-muted)',fontSize:'var(--cc-font-xs)',fontWeight:600,fontFamily:'var(--cc-font-sans)',cursor:'pointer',textAlign:'left',userSelect:'none'};
const CH:React.CSSProperties={flexShrink:0,color:'var(--cc-text-soft)',transition:'transform var(--cc-duration-fast) var(--cc-ease-standard)'};
const SL:React.CSSProperties={flex:1};
const SC:React.CSSProperties={fontSize:'var(--cc-font-xs)',fontWeight:400,color:'var(--cc-text-soft)'};
const IL:React.CSSProperties={padding:'2px 0'};
const EM:React.CSSProperties={padding:'4px var(--cc-space-3) 4px 36px',fontSize:'var(--cc-font-xs)',color:'var(--cc-text-muted)',fontStyle:'italic'};
const RS:React.CSSProperties={display:'flex',alignItems:'center',gap:'var(--cc-space-2)',width:'100%',minHeight:36,padding:'4px var(--cc-space-3) 4px var(--cc-space-4)',border:'none',background:'transparent',cursor:'pointer',textAlign:'left',color:'var(--cc-text)',fontSize:'var(--cc-font-sm)',fontFamily:'var(--cc-font-sans)'};
const RA:React.CSSProperties={background:'var(--cc-brand-soft)'};
const SD:React.CSSProperties={flexShrink:0,width:7,height:7,borderRadius:'50%',marginLeft:4};
const RT:React.CSSProperties={flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:1};
const PN:React.CSSProperties={fontSize:'var(--cc-font-sm)',fontWeight:500,color:'var(--cc-text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'};
const PT:React.CSSProperties={fontSize:'var(--cc-font-xs)',color:'var(--cc-text-muted)',fontFamily:'var(--cc-font-mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'};
const RB:React.CSSProperties={display:'flex',alignItems:'center',gap:4,flexShrink:0};
const RN:React.CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 5px',borderRadius:'var(--cc-radius-full)',background:'var(--cc-green-soft)',color:'var(--cc-green)',fontSize:'var(--cc-font-xs)',fontWeight:600};
const RK:React.CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 5px',borderRadius:'var(--cc-radius-full)',background:'var(--cc-amber-soft)',color:'var(--cc-amber)',fontSize:'var(--cc-font-xs)',fontWeight:600};
const GC:React.CSSProperties={display:'inline-flex',alignItems:'center',height:18,padding:'0 5px',borderRadius:'var(--cc-radius-xs)',background:'var(--cc-blue-soft)',color:'var(--cc-blue)',fontSize:'var(--cc-font-xs)',fontWeight:500,fontFamily:'var(--cc-font-mono)',maxWidth:72,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'};

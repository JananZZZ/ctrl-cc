import { useMemo } from 'react';

interface Props { content: string }

export function MarkdownRenderer({ content }: Props) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div style={{ lineHeight: 1.6 }}>
      {blocks.map((block, i) => {
        if (block.type === 'code') return <CodeBlock key={i} lang={block.lang ?? 'text'} code={block.content} />;
        if (block.type === 'h1') return <h3 key={i} style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 700, margin: '8px 0 4px', color: 'var(--cc-text)' }}>{block.content}</h3>;
        if (block.type === 'h2') return <h4 key={i} style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, margin: '6px 0 3px', color: 'var(--cc-text)' }}>{block.content}</h4>;
        if (block.type === 'h3') return <h5 key={i} style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, margin: '4px 0 2px', color: 'var(--cc-text)' }}>{block.content}</h5>;
        if (block.type === 'ul') return <ul key={i} style={{ margin: '4px 0', paddingLeft: 20 }}>{block.items!.map((item, j) => <li key={j} style={textStyle}>{renderInline(item)}</li>)}</ul>;
        if (block.type === 'ol') return <ol key={i} style={{ margin: '4px 0', paddingLeft: 20 }}>{block.items!.map((item, j) => <li key={j} style={textStyle}>{renderInline(item)}</li>)}</ol>;
        return <p key={i} style={{ margin: '4px 0', ...textStyle }}>{renderInline(block.content)}</p>;
      })}
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <pre style={{ margin: '6px 0', padding: '8px 12px', borderRadius: 'var(--cc-radius-sm)', background: '#1a1b1e', color: '#d4d4d8', fontSize: 11, fontFamily: 'var(--cc-font-mono)', overflow: 'auto', maxHeight: 400 }}>
      {lang && <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{lang}</div>}
      <code>{code}</code>
    </pre>
  );
}

const textStyle: React.CSSProperties = { fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)' };

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: 'var(--cc-bg-muted)', padding: '1px 4px', borderRadius: 3, fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)' }}>{part.slice(1, -1)}</code>;
    if (part.startsWith('[')) {
      const m = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (m) return <a key={i} href={m[2]} target="_blank" style={{ color: 'var(--cc-blue)', textDecoration: 'underline' }}>{m[1]}</a>;
    }
    return part;
  });
}

interface MdBlock { type: string; content: string; lang?: string; items?: string[] }

function parseMarkdown(text: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      blocks.push({ type: 'code', content: codeLines.join('\n'), lang });
      i++;
    } else if (/^#{1,3}\s/.test(line)) {
      const depth = line.match(/^(#{1,3})/)![1].length;
      blocks.push({ type: `h${depth}`, content: line.replace(/^#{1,3}\s*/, '') });
      i++;
    } else if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s*/, '')); i++; }
      blocks.push({ type: 'ul', content: '', items });
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s*/, '')); i++; }
      blocks.push({ type: 'ol', content: '', items });
    } else {
      const paras: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !/^#{1,3}\s/.test(lines[i]) && !/^[-*]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i])) { paras.push(lines[i]); i++; }
      if (paras.length > 0) blocks.push({ type: 'p', content: paras.join(' ') });
      else i++;
    }
  }
  return blocks;
}

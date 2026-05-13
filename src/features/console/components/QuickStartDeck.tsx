import React from 'react';

interface QuickStartCard {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}

interface QuickStartDeckProps {
  cards: QuickStartCard[];
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 'var(--cc-space-4)',
  marginBottom: 'var(--cc-space-6)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--cc-surface)',
  border: '1px solid var(--cc-border-soft)',
  borderRadius: 'var(--cc-radius-md)',
  padding: 'var(--cc-space-4)',
  cursor: 'pointer',
  transition:
    'transform var(--cc-duration-fast) var(--cc-ease-spring), box-shadow var(--cc-duration-fast) var(--cc-ease-standard), border-color var(--cc-duration-fast) var(--cc-ease-standard)',
  minHeight: '110px',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--cc-space-2)',
};

const disabledCardStyle: React.CSSProperties = {
  ...cardStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const iconAreaStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-brand-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--cc-font-md)',
  color: 'var(--cc-brand)',
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--cc-font-sans)',
  fontSize: 'var(--cc-font-md)',
  fontWeight: 'var(--cc-font-semibold)',
  color: 'var(--cc-text)',
  lineHeight: 'var(--cc-leading-tight)',
};

const disabledLabelStyle: React.CSSProperties = {
  ...labelStyle,
  color: 'var(--cc-text-soft)',
};

const descStyle: React.CSSProperties = {
  fontFamily: 'var(--cc-font-sans)',
  fontSize: 'var(--cc-font-xs)',
  color: 'var(--cc-text-muted)',
  lineHeight: 'var(--cc-leading-normal)',
};

function ensureVisibleCards(cards: QuickStartCard[]): QuickStartCard[] {
  if (cards.length >= 6) return cards.slice(0, 6);
  const padded = [...cards];
  while (padded.length < 6) {
    padded.push({
      id: `placeholder-${padded.length}`,
      label: `——`,
      description: '即将推出',
      enabled: false,
      disabledReason: '功能尚未实现',
      onClick: () => {},
    });
  }
  return padded;
}

export function QuickStartDeck({ cards }: QuickStartDeckProps) {
  const visible = ensureVisibleCards(cards);

  return (
    <section
      style={{
        marginBottom: 'var(--cc-space-6)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--cc-font-sans)',
          fontSize: 'var(--cc-font-lg)',
          fontWeight: 'var(--cc-font-semibold)',
          color: 'var(--cc-text)',
          marginBottom: 'var(--cc-space-4)',
        }}
      >
        快速开始
      </h3>
      <style>{`
        @media (max-width: 900px) {
          .qs-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .qs-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="qs-grid" style={gridStyle}>
        {visible.map((card) => (
          <div
            key={card.id}
            className="cc-card"
            style={card.enabled ? cardStyle : disabledCardStyle}
            data-interactive={card.enabled ? 'true' : 'false'}
            title={card.enabled ? undefined : card.disabledReason}
            onClick={card.enabled ? card.onClick : undefined}
            onKeyDown={
              card.enabled
                ? (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      card.onClick();
                    }
                  }
                : undefined
            }
            role={card.enabled ? 'button' : undefined}
            tabIndex={card.enabled ? 0 : -1}
            aria-disabled={card.enabled ? undefined : 'true'}
          >
            <div style={iconAreaStyle}>
              {card.enabled ? '▶' : '⏸'}
            </div>
            <span style={card.enabled ? labelStyle : disabledLabelStyle}>
              {card.label}
            </span>
            <span style={descStyle}>{card.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

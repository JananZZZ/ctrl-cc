interface Props {
  icon?: string;
  title: string;
  description?: string;
}

export function CcEmptyState({ icon = '📋', title, description }: Props) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', gap: 8, textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 32, opacity: 0.6 }}>{icon}</span>
      <span style={{ fontSize: 'var(--cc-font-md)', fontWeight: 500, color: 'var(--cc-text-muted)' }}>{title}</span>
      {description && <span style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-soft)' }}>{description}</span>}
    </div>
  );
}

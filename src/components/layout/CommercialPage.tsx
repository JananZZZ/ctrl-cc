import type { ReactNode } from 'react';
import { SurfacePage } from './SurfacePage';

interface CommercialPageProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: 'dashboard' | 'management' | 'workspace' | 'diagnostics';
  testId?: string;
}

export function CommercialPage({ title, eyebrow, description, actions, children, variant = 'dashboard', testId }: CommercialPageProps) {
  return (
    <SurfacePage variant={variant} testId={testId}>
      <div className="cc-commercial-page">
        <header className="cc-page-header">
          <div className="cc-page-title-block">
            {eyebrow && <div className="cc-page-eyebrow">{eyebrow}</div>}
            <h1 className="cc-page-title">{title}</h1>
            {description && <p className="cc-page-description">{description}</p>}
          </div>
          {actions && <div className="cc-page-actions">{actions}</div>}
        </header>
        {children}
      </div>
    </SurfacePage>
  );
}

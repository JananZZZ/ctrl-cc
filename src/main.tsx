import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';
import './styles/surface-responsive.css';
import './styles/typography.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

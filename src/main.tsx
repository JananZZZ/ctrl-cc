import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

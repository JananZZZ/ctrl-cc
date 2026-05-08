import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

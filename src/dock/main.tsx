import { createRoot } from 'react-dom/client';
import { AiDockWindow } from './AiDockWindow';
import '../styles/tokens.css';
import '../styles/global.css';

const root = createRoot(document.getElementById('root')!);
root.render(<AiDockWindow />);

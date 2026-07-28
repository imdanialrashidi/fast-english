import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing in landing/index.html');
}

createRoot(container).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);

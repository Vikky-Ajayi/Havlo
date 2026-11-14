import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { captureAttribution } from './lib/attribution';

// Before any page can rewrite its address: the UTM tags of the visit.
captureAttribution();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

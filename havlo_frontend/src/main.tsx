import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { captureAttribution } from './lib/attribution';
import { captureMetaClickId } from './lib/metaPixel';

// Before any page can rewrite its address: the UTM tags of the visit.
captureAttribution();
// And the ad click's fbclid, for Meta (held until cookies are accepted).
captureMetaClickId();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

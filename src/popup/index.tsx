import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import Popup from './Popup';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}

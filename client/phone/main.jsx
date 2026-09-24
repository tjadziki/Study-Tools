import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/deck.css';
import PhoneApp from './PhoneApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PhoneApp />
  </React.StrictMode>
);

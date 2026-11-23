import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/open-sauce-one/latin-400.css';
import '@fontsource/open-sauce-one/latin-500.css';
import '@fontsource/open-sauce-one/latin-600.css';
import '@fontsource/open-sauce-one/latin-700.css';
import './styles/index.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

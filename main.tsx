import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error logger for debugging runtime issues
window.addEventListener('error', (event) => {
  const errorContainer = document.createElement('div');
  errorContainer.style.position = 'fixed';
  errorContainer.style.top = '10px';
  errorContainer.style.left = '10px';
  errorContainer.style.right = '10px';
  errorContainer.style.backgroundColor = 'rgba(220, 38, 38, 0.95)';
  errorContainer.style.color = 'white';
  errorContainer.style.padding = '20px';
  errorContainer.style.borderRadius = '8px';
  errorContainer.style.zIndex = '999999';
  errorContainer.style.fontFamily = 'monospace';
  errorContainer.style.whiteSpace = 'pre-wrap';
  errorContainer.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
  
  errorContainer.innerHTML = `
    <h3 style="margin-top:0;font-size:16px;">⚠️ Runtime Exception Caught:</h3>
    <div>${event.message}</div>
    <div style="font-size:12px;opacity:0.8;margin-top:10px;">At: ${event.filename}:${event.lineno}:${event.colno}</div>
    <pre style="margin:10px 0 0;font-size:11px;background:rgba(0,0,0,0.2);padding:10px;border-radius:4px;overflow:auto;max-height:200px;">${event.error ? event.error.stack : 'No stack trace available.'}</pre>
  `;
  document.body.appendChild(errorContainer);
});

window.addEventListener('unhandledrejection', (event) => {
  const errorContainer = document.createElement('div');
  errorContainer.style.position = 'fixed';
  errorContainer.style.bottom = '10px';
  errorContainer.style.left = '10px';
  errorContainer.style.right = '10px';
  errorContainer.style.backgroundColor = 'rgba(217, 119, 6, 0.95)';
  errorContainer.style.color = 'white';
  errorContainer.style.padding = '15px';
  errorContainer.style.borderRadius = '8px';
  errorContainer.style.zIndex = '999998';
  errorContainer.style.fontFamily = 'monospace';
  errorContainer.style.whiteSpace = 'pre-wrap';
  
  errorContainer.innerHTML = `
    <h3 style="margin-top:0;font-size:14px;">⚠️ Unhandled Promise Rejection:</h3>
    <div>${event.reason}</div>
  `;
  document.body.appendChild(errorContainer);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


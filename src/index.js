import React from 'react';
import ReactDOM from 'react-dom';
import App from './App'; // Main App component
import './index.css'; // Global styles (optional)

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root') // Renders the app to the root element in public/index.html
);

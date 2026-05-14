import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import './styles.css';

import { MantineProvider, createTheme } from '@mantine/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'sm',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </React.StrictMode>
);


// Entry point: mounts the React app into the page.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Fonts are installed with npm and bundled with the site (no external requests).
import '@fontsource/michroma';
import '@fontsource/silkscreen';
import '@fontsource-variable/space-grotesk';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { MoodProfileProvider } from './context/MoodProfileContext.jsx';
import { FeedbackProvider } from './context/FeedbackContext.jsx';
import { AssistantProvider } from './context/AssistantContext.jsx';
import { PlayerProvider } from './context/PlayerContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MoodProfileProvider>
          <FeedbackProvider>
            <AssistantProvider>
              <PlayerProvider>
                <App />
              </PlayerProvider>
            </AssistantProvider>
          </FeedbackProvider>
        </MoodProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/smrt-tokens.css';
import './ui/app.css';
import './ui/theme.css';
import { App } from './app/App';
import { useApp } from './app/store';
import { initSpeech, primeSpeech } from './platform/speech';
import { unlockAudio } from './platform/audio';
import { initTheme } from './ui/theme';

initTheme();
initSpeech();

// Speech and sound must be unlocked from a user gesture on iOS: do it on the first touch.
const prime = () => {
  primeSpeech();
  unlockAudio();
};
window.addEventListener('pointerdown', prime, { once: true, capture: true });
window.addEventListener('keydown', prime, { once: true, capture: true });

// Block double-tap zoom and pinch gestures, which get in the way during activities.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

void useApp.getState().load();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

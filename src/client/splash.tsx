import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';

const Splash = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6" style={{background:'#030712'}}>
      <div className="text-center px-6">
        <div className="inline-block px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider bg-orange-600 mb-4">
          Verdict
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Mod Decision Assistant</h1>
        <p className="text-sm text-gray-400">Tap to view full context on this user</p>
      </div>
      <button
        className="px-8 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-full transition-colors text-sm"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        Open Verdict
      </button>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);

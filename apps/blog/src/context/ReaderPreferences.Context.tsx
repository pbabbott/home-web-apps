'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

const HIGHLIGHT_AI_KEY = 'reader:highlight-ai';
const CHANGE_EVENT = 'reader-preferences-change';

// Shape is intentionally an object (not a lone boolean) so future reader
// tools (font scaling, reduced motion, etc. — see issue #136) can be added
// here without changing the context's public shape.
type ReaderPreferencesContextValue = {
  highlightAiEnabled: boolean;
};

const ReaderPreferencesContext = createContext<ReaderPreferencesContextValue>({
  highlightAiEnabled: false,
});

export function useReaderPreferences() {
  return useContext(ReaderPreferencesContext);
}

export function getHighlightAiEnabled(): boolean {
  return window.localStorage.getItem(HIGHLIGHT_AI_KEY) === 'true';
}

export function setHighlightAiEnabled(enabled: boolean) {
  window.localStorage.setItem(HIGHLIGHT_AI_KEY, String(enabled));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToReaderPreferencesChange(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export default function ReaderPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const highlightAiEnabled = useSyncExternalStore(
    subscribeToReaderPreferencesChange,
    getHighlightAiEnabled,
    () => false,
  );

  return (
    <ReaderPreferencesContext.Provider value={{ highlightAiEnabled }}>
      {children}
    </ReaderPreferencesContext.Provider>
  );
}

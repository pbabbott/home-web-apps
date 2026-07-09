'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

const OVERRIDE_KEY = 'debug:disable-animations';
const CHANGE_EVENT = 'debug-animations-change';

type AnimationsContextValue = {
  animationsEnabled: boolean;
};

const AnimationsContext = createContext<AnimationsContextValue>({
  animationsEnabled: true,
});

export function useAnimationsContext() {
  return useContext(AnimationsContext);
}

// null = no explicit override, fall back to bot detection
export function getAnimationsOverride(): boolean | null {
  const raw = window.localStorage.getItem(OVERRIDE_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function setAnimationsDisabledOverride(disabled: boolean) {
  window.localStorage.setItem(OVERRIDE_KEY, String(disabled));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearAnimationsDisabledOverride() {
  window.localStorage.removeItem(OVERRIDE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function getIsBot() {
  const match = document.cookie.match(/(?:^|; )is-bot=([^;]*)/);
  return match?.[1] === '1';
}

export function getAnimationsEnabled() {
  const override = getAnimationsOverride();
  if (override !== null) return !override;
  return !getIsBot();
}

export function subscribeToAnimationsChange(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export default function AnimationsContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const animationsEnabled = useSyncExternalStore(
    subscribeToAnimationsChange,
    getAnimationsEnabled,
    () => true,
  );

  return (
    <AnimationsContext.Provider value={{ animationsEnabled }}>
      {children}
    </AnimationsContext.Provider>
  );
}

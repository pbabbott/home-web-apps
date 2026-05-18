'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

type HomeContextValue = {
  animationsEnabled: boolean;
};

const HomeContext = createContext<HomeContextValue>({
  animationsEnabled: false,
});

export function useHomeContext() {
  return useContext(HomeContext);
}

function getAnimationsEnabled() {
  const match = document.cookie.match(/(?:^|; )is-bot=([^;]*)/);
  return match?.[1] !== '1';
}

export default function HomeContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const animationsEnabled = useSyncExternalStore(
    () => () => {},
    getAnimationsEnabled,
    () => true,
  );

  return (
    <HomeContext.Provider value={{ animationsEnabled }}>
      {children}
    </HomeContext.Provider>
  );
}

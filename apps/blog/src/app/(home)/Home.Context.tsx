'use client';

import { createContext, useContext } from 'react';

type HomeContextValue = {
  animationsEnabled: boolean;
};

const HomeContext = createContext<HomeContextValue>({
  animationsEnabled: false,
});

export function useHomeContext() {
  return useContext(HomeContext);
}

export default function HomeContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HomeContext.Provider value={{ animationsEnabled: true }}>
      {children}
    </HomeContext.Provider>
  );
}

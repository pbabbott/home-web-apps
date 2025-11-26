import { createContext, useEffect, useState } from 'react';
import { TerminalEvent } from './TerminalEvent';

export interface LandingSectionContextType {
  showBackgroundColors: boolean;
  showParticles: boolean;
  onTerminalEventFinished: (event: TerminalEvent) => void;
  onTerminalEventStarted: (event: TerminalEvent) => void;
}

export const LandingSectionContext = createContext<LandingSectionContextType>({
  showBackgroundColors: false,
  showParticles: false,
  onTerminalEventFinished: () => {},
  onTerminalEventStarted: () => {},
});

export default function LandingSectionContextProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [showBackgroundColors, setShowBackgroundColors] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  const onTerminalEventFinished = (event: TerminalEvent) => {};

  const onTerminalEventStarted = (event: TerminalEvent) => {
    if (event === TerminalEvent.INITIALIZING_BACKGROUND_COLORS) {
      setShowBackgroundColors(true);
    }

    if (event === TerminalEvent.RENDERING_INTERACTIVE_BACKGROUND_EXPERIENCE) {
      setShowParticles(true);
    }
  };

  return (
    <LandingSectionContext.Provider
      value={{
        showBackgroundColors,
        showParticles,
        onTerminalEventFinished,
        onTerminalEventStarted,
      }}
    >
      {children}
    </LandingSectionContext.Provider>
  );
}

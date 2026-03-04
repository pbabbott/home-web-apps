import { createContext, useCallback, useState } from 'react';
import { TerminalEvent } from './TerminalEvent';

export interface LandingSectionContextType {
  showBackgroundExperience: boolean;
  /** True when INITIALIZING_WEBSITE_TITLE terminal line starts; use to trigger title mask reveal. */
  revealTitle: boolean;
  onTerminalEventFinished: (event: TerminalEvent) => void;
  onTerminalEventStarted: (event: TerminalEvent) => void;
}

export const LandingSectionContext = createContext<LandingSectionContextType>({
  showBackgroundExperience: false,
  revealTitle: false,
  onTerminalEventFinished: () => {},
  onTerminalEventStarted: () => {},
});

export default function LandingSectionContextProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [showBackgroundExperience, setShowBackgroundExperience] =
    useState(false);
  const [revealTitle, setRevealTitle] = useState(false);

  const onTerminalEventFinished = useCallback(() => {}, []);

  const onTerminalEventStarted = useCallback((event: TerminalEvent) => {
    if (event === TerminalEvent.INITIALIZING_WEBSITE_TITLE) {
      setRevealTitle(true);
    }
    if (event === TerminalEvent.RENDERING_BACKGROUND_EXPERIENCE) {
      setShowBackgroundExperience(true);
    }
  }, []);

  return (
    <LandingSectionContext.Provider
      value={{
        showBackgroundExperience,
        revealTitle,
        onTerminalEventFinished,
        onTerminalEventStarted,
      }}
    >
      {children}
    </LandingSectionContext.Provider>
  );
}

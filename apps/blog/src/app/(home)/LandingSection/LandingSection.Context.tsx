import { createContext, useCallback, useState } from 'react';
import { TerminalEvent } from './TerminalEvent';

export interface LandingSectionContextType {
  showBackgroundExperience: boolean;
  revealTitle: boolean;
  showControlDevices: boolean;
  isTerminalPaused: boolean;
  startTitleReveal: () => void;
  startControlDevicesReveal: () => void;
  startBackgroundReveal: () => void;
  pauseTerminal: () => void;
  resumeTerminal: () => void;
  onTerminalEventFinished: (event: TerminalEvent) => void;
  onTerminalEventStarted: (event: TerminalEvent) => void;
}

export const LandingSectionContext = createContext<LandingSectionContextType>({
  showBackgroundExperience: false,
  revealTitle: false,
  showControlDevices: false,
  isTerminalPaused: false,
  startTitleReveal: () => {},
  startControlDevicesReveal: () => {},
  startBackgroundReveal: () => {},
  pauseTerminal: () => {},
  resumeTerminal: () => {},
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
  const [showControlDevices, setShowControlDevices] = useState(false);
  const [isTerminalPaused, setIsTerminalPaused] = useState(false);

  const startTitleReveal = useCallback(() => setRevealTitle(true), []);
  const startControlDevicesReveal = useCallback(
    () => setShowControlDevices(true),
    [],
  );
  const startBackgroundReveal = useCallback(
    () => setShowBackgroundExperience(true),
    [],
  );
  const pauseTerminal = useCallback(() => setIsTerminalPaused(true), []);
  const resumeTerminal = useCallback(() => setIsTerminalPaused(false), []);

  const onTerminalEventFinished = useCallback(() => {}, []);
  const onTerminalEventStarted = useCallback(() => {}, []);

  return (
    <LandingSectionContext.Provider
      value={{
        showBackgroundExperience,
        revealTitle,
        showControlDevices,
        isTerminalPaused,
        startTitleReveal,
        startControlDevicesReveal,
        startBackgroundReveal,
        pauseTerminal,
        resumeTerminal,
        onTerminalEventFinished,
        onTerminalEventStarted,
      }}
    >
      {children}
    </LandingSectionContext.Provider>
  );
}

'use client';
import { useContext, useMemo } from 'react';
import { LandingSectionContext } from './LandingSection.Context';
import ProgressiveTerminal, {
  type TerminalLine,
} from '@/components/ProgressiveTerminal/ProgressiveTerminal';

export default function LandingTerminal({ animated }: { animated: boolean }) {
  const {
    isTerminalPaused,
    startTitleReveal,
    startControlDevicesReveal,
    startBackgroundReveal,
    pauseTerminal,
  } = useContext(LandingSectionContext);

  const lines = useMemo<TerminalLine[]>(
    () => [
      {
        text: 'Welcoming user to website... ',
        endOfLineComponent: <span className="text-success-500">DONE</span>,
      },
      {
        text: 'Initializing website title... ',
        endOfLineComponent: <span className="text-success-500">DONE</span>,
        onAfterText: () => {
          startTitleReveal();
          pauseTerminal();
        },
      },
      {
        text: 'Rendering human-required control devices... ',
        endOfLineComponent: <span className="text-success-500">DONE</span>,
        onAfterText: () => {
          startControlDevicesReveal();
          pauseTerminal();
        },
      },
      {
        text: 'Generating non-essential visual layer... ',
        endOfLineComponent: <span className="text-success-500">DONE</span>,
        onAfterText: () => {
          startBackgroundReveal();
          pauseTerminal();
        },
      },
      {
        text: 'Awaiting user action...',
      },
      {
        text: '...',
      },
      {
        text: '... ... ... ',
      },
      {
        text: 'User action pending... ',
        endOfLineComponent: (
          <span className="text-warning-500">
            TIME ELAPSED EXCEEDS EXPECTATION
          </span>
        ),
      },
      {
        text: '...',
      },
      {
        text: 'Click a button above to continue',
      },
      {
        text: 'or scroll down the page.',
      },
    ],
    [
      startTitleReveal,
      startControlDevicesReveal,
      startBackgroundReveal,
      pauseTerminal,
    ],
  );

  return (
    <ProgressiveTerminal
      lines={lines}
      isPaused={isTerminalPaused}
      animated={animated}
    />
  );
}

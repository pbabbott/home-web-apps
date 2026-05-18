'use client';
import { useContext, useEffect, useMemo, useReducer } from 'react';
import {
  extendedTwMerge,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import { ReactTyped } from 'react-typed';
import { ReactNode } from 'react';
import { TerminalEvent } from './TerminalEvent';
import { LandingSectionContext } from './LandingSection.Context';

interface TerminalLine {
  text: string;
  event_name: TerminalEvent;
  endOfLineComponent: ReactNode;
  /** Fires after text is typed, before endOfLineComponent renders. */
  onAfterText?: () => void;
}

type TerminalState = {
  renderedLines: TerminalLine[];
  currentIndex: number;
  endComponentsShown: Set<number>;
  pendingCompletion: { line: TerminalLine; eventName: TerminalEvent } | null;
};

type TerminalAction =
  | { type: 'LINE_TYPED'; line: TerminalLine; eventName: TerminalEvent }
  | { type: 'FLUSH' };

function terminalReducer(
  state: TerminalState,
  action: TerminalAction,
): TerminalState {
  switch (action.type) {
    case 'LINE_TYPED':
      return {
        ...state,
        pendingCompletion: { line: action.line, eventName: action.eventName },
      };
    case 'FLUSH': {
      if (!state.pendingCompletion) return state;
      const newIndex = state.renderedLines.length;
      return {
        renderedLines: [...state.renderedLines, state.pendingCompletion.line],
        currentIndex: state.currentIndex + 1,
        endComponentsShown: new Set([...state.endComponentsShown, newIndex]),
        pendingCompletion: null,
      };
    }
    default:
      return state;
  }
}

export default function ProgressiveTerminal({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  const {
    onTerminalEventFinished,
    onTerminalEventStarted,
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
        event_name: TerminalEvent.WELCOMING_USER,
        endOfLineComponent: <span className="text-success-500">DONE</span>,
      },
      {
        text: 'Initializing website title... ',
        event_name: TerminalEvent.INITIALIZING_WEBSITE_TITLE,
        endOfLineComponent: <span className="text-success-500">DONE</span>,
        onAfterText: () => {
          startTitleReveal();
          pauseTerminal();
        },
      },
      {
        text: 'Rendering human-required control devices... ',
        event_name: TerminalEvent.RENDERING_CONTROL_DEVICES,
        endOfLineComponent: <span className="text-success-500">DONE</span>,
        onAfterText: () => {
          startControlDevicesReveal();
          pauseTerminal();
        },
      },
      {
        text: 'Generating non-essential visual layer... ',
        event_name: TerminalEvent.GENERATING_NON_ESSENTIAL_VISUAL_LAYER,
        endOfLineComponent: <span className="text-success-500">DONE</span>,
        onAfterText: () => {
          startBackgroundReveal();
          pauseTerminal();
        },
      },
      {
        text: 'Awaiting user action...',
        event_name: TerminalEvent.AWAITING_USER_ACTION,
        endOfLineComponent: null,
      },
      {
        text: '...',
        event_name: TerminalEvent.IDLE,
        endOfLineComponent: null,
      },
      {
        text: '... ... ... ',
        event_name: TerminalEvent.PROCESS_DELAYED,
        endOfLineComponent: null,
      },
      {
        text: 'User action pending... ',
        event_name: TerminalEvent.TIME_ELAPSED_EXCEEDS_EXPECTATION,
        endOfLineComponent: (
          <span className="text-warning-500">
            TIME ELAPSED EXCEEDS EXPECTATION
          </span>
        ),
      },
      {
        text: '...',
        event_name: TerminalEvent.IDLE,
        endOfLineComponent: null,
      },
      {
        text: 'Click a button above to continue',
        event_name: TerminalEvent.CLICK_BUTTON_TO_CONTINUE,
        endOfLineComponent: null,
      },
      {
        text: 'or scroll down the page.',
        event_name: TerminalEvent.SCROLL_DOWN_PAGE,
        endOfLineComponent: null,
      },
    ],
    [
      startTitleReveal,
      startControlDevicesReveal,
      startBackgroundReveal,
      pauseTerminal,
    ],
  );

  const [state, dispatch] = useReducer(
    terminalReducer,
    undefined,
    (): TerminalState => ({
      renderedLines: animated ? [] : lines,
      currentIndex: animated ? 0 : lines.length,
      endComponentsShown: new Set(animated ? [] : lines.map((_, i) => i)),
      pendingCompletion: null,
    }),
  );

  useEffect(() => {
    if (isTerminalPaused || !state.pendingCompletion) return;
    const eventName = state.pendingCompletion.eventName;
    dispatch({ type: 'FLUSH' });
    onTerminalEventFinished(eventName);
  }, [isTerminalPaused, state.pendingCompletion, onTerminalEventFinished]);

  const handleLineFinished = () => {
    const finishedLine = lines[state.currentIndex];
    finishedLine.onAfterText?.();
    dispatch({
      type: 'LINE_TYPED',
      line: finishedLine,
      eventName: finishedLine.event_name,
    });
  };

  const handleLineBegin = () => {
    const startingLine = lines[state.currentIndex];
    onTerminalEventStarted(startingLine.event_name);
    console.log(
      'Line started:',
      startingLine.text,
      'Event:',
      startingLine.event_name,
    );
  };

  return (
    <TransparentPanel
      color="dark"
      className={extendedTwMerge('w-full h-56 overflow-hidden', className)}
    >
      <div className="flex flex-col justify-end h-full">
        {/* Render accumulated lines */}
        {state.renderedLines.map((line, i) => (
          <Typography variant="body1" component="p" key={i}>
            {line.text}{' '}
            {state.endComponentsShown.has(i) && line.endOfLineComponent}
          </Typography>
        ))}

        {/* Typed for the current line */}
        {state.currentIndex < lines.length && (
          <Typography variant="body1" component="p">
            <ReactTyped
              strings={[' > ' + lines[state.currentIndex].text]}
              startDelay={500}
              typeSpeed={50}
              showCursor={true}
              cursorChar="_"
              onComplete={handleLineFinished}
              onBegin={handleLineBegin}
            />
          </Typography>
        )}
      </div>
    </TransparentPanel>
  );
}

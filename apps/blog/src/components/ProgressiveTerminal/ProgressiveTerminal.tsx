'use client';
import { useEffect, useReducer, ReactNode } from 'react';
import {
  extendedTwMerge,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import { ReactTyped } from 'react-typed';

export interface TerminalLine {
  text: string;
  endOfLineComponent?: ReactNode;
  /** Fires after text is typed, before endOfLineComponent renders. */
  onAfterText?: () => void;
}

type TerminalState = {
  renderedLines: TerminalLine[];
  currentIndex: number;
  endComponentsShown: Set<number>;
  pendingCompletion: TerminalLine | null;
};

type TerminalAction =
  | { type: 'LINE_TYPED'; line: TerminalLine }
  | { type: 'FLUSH' }
  | { type: 'SKIP_TO_END'; lines: TerminalLine[] };

function terminalReducer(
  state: TerminalState,
  action: TerminalAction,
): TerminalState {
  switch (action.type) {
    case 'LINE_TYPED':
      return { ...state, pendingCompletion: action.line };
    case 'FLUSH': {
      if (!state.pendingCompletion) return state;
      const newIndex = state.renderedLines.length;
      return {
        renderedLines: [...state.renderedLines, state.pendingCompletion],
        currentIndex: state.currentIndex + 1,
        endComponentsShown: new Set([...state.endComponentsShown, newIndex]),
        pendingCompletion: null,
      };
    }
    case 'SKIP_TO_END':
      return {
        renderedLines: action.lines,
        currentIndex: action.lines.length,
        endComponentsShown: new Set(action.lines.map((_, i) => i)),
        pendingCompletion: null,
      };
    default:
      return state;
  }
}

export default function ProgressiveTerminal({
  lines,
  className,
  animated = true,
  isPaused = false,
}: {
  lines: TerminalLine[];
  className?: string;
  animated?: boolean;
  isPaused?: boolean;
}) {
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
    if (animated) return;
    dispatch({ type: 'SKIP_TO_END', lines });
  }, [animated, lines]);

  useEffect(() => {
    if (isPaused || !state.pendingCompletion) return;
    dispatch({ type: 'FLUSH' });
  }, [isPaused, state.pendingCompletion]);

  const handleLineFinished = () => {
    const finishedLine = lines[state.currentIndex];
    finishedLine.onAfterText?.();
    dispatch({ type: 'LINE_TYPED', line: finishedLine });
  };

  return (
    <TransparentPanel
      color="dark"
      className={extendedTwMerge(
        'w-full h-56 overflow-hidden bg-neutral-1000 border border-primary-300',
        className,
      )}
    >
      <div className="flex flex-col justify-end h-full">
        {state.renderedLines.map((line, i) => (
          <Typography variant="body1" component="p" key={i}>
            {line.text}{' '}
            {state.endComponentsShown.has(i) && line.endOfLineComponent}
          </Typography>
        ))}

        {state.currentIndex < lines.length && (
          <Typography variant="body1" component="p">
            <ReactTyped
              strings={[' > ' + lines[state.currentIndex].text]}
              startDelay={500}
              typeSpeed={50}
              showCursor={true}
              cursorChar="_"
              onComplete={handleLineFinished}
            />
          </Typography>
        )}
      </div>
    </TransparentPanel>
  );
}

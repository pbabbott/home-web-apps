'use client';
import { useContext, useState } from 'react';
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
}

const lines: TerminalLine[] = [
  {
    text: 'Welcoming user to website... ',
    event_name: TerminalEvent.WELCOMING_USER,
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Initializing website title... ',
    event_name: TerminalEvent.INITIALIZING_WEBSITE_TITLE,
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Rendering background experience... ',
    event_name: TerminalEvent.RENDERING_BACKGROUND_EXPERIENCE,
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Awaiting user action...',
    event_name: TerminalEvent.AWAITING_USER_ACTION,
    endOfLineComponent: null,
  },
  {
    text: 'Still waiting for user action...',
    event_name: TerminalEvent.STILL_WAITING_FOR_USER_ACTION,
    endOfLineComponent: (
      <span className="text-warning-500">PROCESS DELAYED</span>
    ),
  },
  {
    text: '... ...',
    event_name: TerminalEvent.PROCESS_DELAYED,
    endOfLineComponent: null,
  },
  {
    text: '(click a button above to continue)',
    event_name: TerminalEvent.CLICK_BUTTON_TO_CONTINUE,
    endOfLineComponent: null,
  },
  {
    text: '(or scroll down the page)',
    event_name: TerminalEvent.SCROLL_DOWN_PAGE,
    endOfLineComponent: null,
  },
];

export default function ProgressiveTerminal({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  const [renderedLines, setRenderedLines] = useState<TerminalLine[]>(
    animated ? [] : lines,
  );
  const [currentIndex, setCurrentIndex] = useState(animated ? 0 : lines.length);
  const { onTerminalEventFinished, onTerminalEventStarted } = useContext(
    LandingSectionContext,
  );

  const handleLineFinished = () => {
    const finishedLine = lines[currentIndex];

    // add finished line to the growing log
    setRenderedLines((prev) => [...prev, finishedLine]);

    // fire your page event here
    onTerminalEventFinished(finishedLine.event_name);

    // move to next line
    setCurrentIndex((i) => i + 1);
  };

  const handleLineBegin = () => {
    const startingLine = lines[currentIndex];
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
        {renderedLines.map((line, i) => (
          <Typography variant="body1" component="p" key={i}>
            {line.text} {line.endOfLineComponent}
          </Typography>
        ))}

        {/* Typed for the current line */}
        {currentIndex < lines.length && (
          <Typography variant="body1" component="p">
            <ReactTyped
              strings={[' > ' + lines[currentIndex].text]}
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

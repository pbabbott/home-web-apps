'use client';
import { useContext, useState } from 'react';
import { TransparentPanel, Typography } from '@abbottland/fui-components';
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
    text: 'Initializing background colors... ',
    event_name: TerminalEvent.INITIALIZING_BACKGROUND_COLORS,
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Rendering interactive background experience... ',
    event_name: TerminalEvent.RENDERING_INTERACTIVE_BACKGROUND_EXPERIENCE,
    endOfLineComponent: <span className="text-success-500">DONE</span>,
  },
  {
    text: 'Awaiting user action...',
    event_name: TerminalEvent.AWAITING_USER_INPUT,
    endOfLineComponent: (
      <span className="text-warning-500">PROCESS DELAYED</span>
    ),
  },
  {
    text: '(click a button above to continue)',
    event_name: TerminalEvent.AWAITING_USER_INPUT,
    endOfLineComponent: null,
  },
];

export default function ProgressiveTerminal() {
  const [renderedLines, setRenderedLines] = useState<TerminalLine[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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
    <TransparentPanel color="dark" className="w-full h-48">
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
    </TransparentPanel>
  );
}

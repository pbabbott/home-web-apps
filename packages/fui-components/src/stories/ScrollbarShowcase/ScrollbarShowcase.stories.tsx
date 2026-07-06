import { useEffect, useRef, useState } from 'react';
import type { StoryObj } from '@storybook/react-vite';
import { Panel } from '../../components/Panel/Panel';
import { Scrollbar } from '../../components/Scrollbar/Scrollbar';
import { Typography } from '../../components/Typography/Typography';

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus magna. Cras in mi at felis aliquet congue. Ut a est eget ligula molestie gravida. Curabitur massa. Donec eleifend, libero at sagittis mollis, tellus est malesuada tellus, at luctus turpis elit sit amet quam. Vivamus pretium ornare est. ';

const CONTENT_HEIGHT = 360;

const hideNativeScrollbar = `
.fui-scrollbar-demo-content::-webkit-scrollbar { display: none; }
`;

const ScrollableDemo = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [thumbPosition, setThumbPosition] = useState(0);
  const [thumbSize, setThumbSize] = useState(1);

  const syncThumb = () => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const size = Math.min(clientHeight / scrollHeight, 1);
    const scrollable = scrollHeight - clientHeight;
    const position = scrollable > 0 ? scrollTop / scrollable : 0;
    setThumbSize(size);
    setThumbPosition(position * (1 - size));
  };

  useEffect(syncThumb, []);

  return (
    <Panel color="primary" className="flex flex-row gap-2 w-[420px]">
      <style>{hideNativeScrollbar}</style>
      <div
        ref={contentRef}
        onScroll={syncThumb}
        className="fui-scrollbar-demo-content"
        style={{
          height: CONTENT_HEIGHT,
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        <Typography variant="body2" className="text-neutral-200">
          {LOREM.repeat(15)}
        </Typography>
      </div>
      <Scrollbar
        height={CONTENT_HEIGHT}
        thumbPosition={thumbPosition}
        thumbSize={thumbSize}
      />
    </Panel>
  );
};

const meta = {
  title: 'Showcase/Scrollbar',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ReplacingNativeScrollbar: Story = {
  render: () => <ScrollableDemo />,
};

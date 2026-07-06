'use client';
import { useEffect, useState } from 'react';
import { Scrollbar } from '@abbottland/fui-components';
import { useWindowScrollProgress } from '@/hooks/useScrollProgress';

const HIDE_NATIVE_SCROLLBAR_CLASS = 'fui-hide-native-scrollbar';

// Matches Tailwind's default `md` breakpoint.
const MD_BREAKPOINT_QUERY = '(min-width: 768px)';

function useHeaderHeight(): number {
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const update = () => {
      const header = document.getElementById('site-header');
      setHeaderHeight(header?.getBoundingClientRect().height ?? 0);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return headerHeight;
}

function useIsMdUp(): boolean {
  const [isMdUp, setIsMdUp] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MD_BREAKPOINT_QUERY);
    const update = () => setIsMdUp(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMdUp;
}

export default function PageScrollbar({
  className = '',
}: {
  className?: string;
}) {
  const { thumbPosition, thumbSize, height, scrollToThumbPosition, pageStep } =
    useWindowScrollProgress();
  const headerHeight = useHeaderHeight();
  const isMdUp = useIsMdUp();

  useEffect(() => {
    document.documentElement.classList.add(HIDE_NATIVE_SCROLLBAR_CLASS);
    return () => {
      document.documentElement.classList.remove(HIDE_NATIVE_SCROLLBAR_CLASS);
    };
  }, []);

  const barHeight = height - headerHeight;

  return (
    <div
      className={`fixed top-0 right-0 bottom-0 z-20 flex w-4 md:w-6 justify-center bg-neutral-950 ${className}`}
      style={{ paddingTop: headerHeight }}
    >
      {barHeight > 0 && (
        <Scrollbar
          height={barHeight}
          thumbPosition={thumbPosition}
          thumbSize={thumbSize}
          showDots={isMdUp}
          onThumbPositionChange={scrollToThumbPosition}
          onPageStep={pageStep}
        />
      )}
    </div>
  );
}

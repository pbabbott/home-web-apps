'use client';
import { useEffect, useState, type RefObject } from 'react';

export interface ScrollProgress {
  thumbPosition: number;
  thumbSize: number;
  height: number;
  isScrollable: boolean;
}

const INITIAL_PROGRESS: ScrollProgress = {
  thumbPosition: 0,
  thumbSize: 1,
  height: 0,
  isScrollable: false,
};

function computeProgress(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): ScrollProgress {
  const size = scrollHeight > 0 ? Math.min(clientHeight / scrollHeight, 1) : 1;
  const scrollable = scrollHeight - clientHeight;
  const position = scrollable > 0 ? scrollTop / scrollable : 0;
  return {
    thumbPosition: position * (1 - size),
    thumbSize: size,
    height: clientHeight,
    isScrollable: scrollable > 0,
  };
}

export function useElementScrollProgress(
  ref: RefObject<HTMLElement | null>,
): ScrollProgress {
  const [progress, setProgress] = useState<ScrollProgress>(INITIAL_PROGRESS);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setProgress(
        computeProgress(el.scrollTop, el.scrollHeight, el.clientHeight),
      );
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      resizeObserver.disconnect();
    };
  }, [ref]);

  return progress;
}

export function useWindowScrollProgress(): ScrollProgress {
  const [progress, setProgress] = useState<ScrollProgress>(INITIAL_PROGRESS);

  useEffect(() => {
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        document.documentElement;
      setProgress(computeProgress(scrollTop, scrollHeight, clientHeight));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return progress;
}

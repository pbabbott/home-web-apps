'use client';
import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface ScrollProgress {
  thumbPosition: number;
  thumbSize: number;
  height: number;
  isScrollable: boolean;
}

export interface ScrollController extends ScrollProgress {
  scrollToThumbPosition: (thumbPosition: number) => void;
  pageStep: (direction: 'up' | 'down') => void;
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

function scrollTopFromThumbPosition(
  thumbPosition: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const size = scrollHeight > 0 ? Math.min(clientHeight / scrollHeight, 1) : 1;
  const scrollable = scrollHeight - clientHeight;
  if (scrollable <= 0 || size >= 1) return 0;
  return (thumbPosition / (1 - size)) * scrollable;
}

export function useElementScrollProgress(
  ref: RefObject<HTMLElement | null>,
): ScrollController {
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

  const scrollToThumbPosition = useCallback(
    (thumbPosition: number) => {
      const el = ref.current;
      if (!el) return;
      el.scrollTop = scrollTopFromThumbPosition(
        thumbPosition,
        el.scrollHeight,
        el.clientHeight,
      );
    },
    [ref],
  );

  const pageStep = useCallback(
    (direction: 'up' | 'down') => {
      const el = ref.current;
      if (!el) return;
      el.scrollBy({
        top: direction === 'down' ? el.clientHeight : -el.clientHeight,
        behavior: 'smooth',
      });
    },
    [ref],
  );

  return { ...progress, scrollToThumbPosition, pageStep };
}

export function useWindowScrollProgress(): ScrollController {
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

  const scrollToThumbPosition = useCallback((thumbPosition: number) => {
    const { scrollHeight, clientHeight } = document.documentElement;
    window.scrollTo({
      top: scrollTopFromThumbPosition(
        thumbPosition,
        scrollHeight,
        clientHeight,
      ),
    });
  }, []);

  const pageStep = useCallback((direction: 'up' | 'down') => {
    const { clientHeight } = document.documentElement;
    window.scrollBy({
      top: direction === 'down' ? clientHeight : -clientHeight,
      behavior: 'smooth',
    });
  }, []);

  return { ...progress, scrollToThumbPosition, pageStep };
}

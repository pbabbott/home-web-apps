import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface IdleRotationControls {
  /** Pass straight through to OrbitControls' autoRotate prop. */
  autoRotate: boolean;
  autoRotateSpeed: number;
  /** Wire to OrbitControls' onStart. */
  onInteractionStart: () => void;
  /** Wire to OrbitControls' onEnd. */
  onInteractionEnd: () => void;
}

const DEFAULT_IDLE_DELAY_MS = 2500;
const DEFAULT_SPEED = 0.6;

/**
 * Drives idle auto-rotation: on by default, pauses the instant the user
 * starts dragging/zooming, and resumes after idleDelayMs of no
 * interaction. Permanently off when the user prefers reduced motion.
 */
export function useIdleRotation(
  idleDelayMs: number = DEFAULT_IDLE_DELAY_MS,
  speed: number = DEFAULT_SPEED,
): IdleRotationControls {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isIdle, setIsIdle] = useState(true);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const onInteractionStart = useCallback(() => {
    clearResumeTimer();
    setIsIdle(false);
  }, [clearResumeTimer]);

  const onInteractionEnd = useCallback(() => {
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => setIsIdle(true), idleDelayMs);
  }, [clearResumeTimer, idleDelayMs]);

  useEffect(() => clearResumeTimer, [clearResumeTimer]);

  return {
    autoRotate: isIdle && !prefersReducedMotion,
    autoRotateSpeed: speed,
    onInteractionStart,
    onInteractionEnd,
  };
}

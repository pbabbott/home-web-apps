import React, { useState, useEffect, useRef } from 'react';

export default function ScrollProgressTransition({
  loadingMessages = [
    'Getting things ready...',
    'Almost there...',
    'Just a moment...',
    'Welcome!',
  ],
  barColor = 'from-primary-500 to-success-500',
  textColor = 'text-secondary-500',
  backgroundColor = 'bg-secondary-900',
}) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const transitionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!transitionRef.current) return;

      const rect = transitionRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate progress based on element position in viewport
      if (rect.top <= viewportHeight && rect.bottom >= 0) {
        const visible = Math.min(viewportHeight - rect.top, rect.height);
        const progress = Math.max(
          0,
          Math.min(100, (visible / rect.height) * 100),
        );
        setScrollProgress(progress);
      } else if (rect.bottom < 0) {
        setScrollProgress(100);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getLoadingText = (progress: number) => {
    if (progress < 30) return loadingMessages[0];
    if (progress < 70) return loadingMessages[1];
    if (progress < 100) return loadingMessages[2];
    return loadingMessages[3];
  };

  return (
    <section
      ref={transitionRef}
      className={`h-screen flex items-center justify-center ${backgroundColor}`}
    >
      <div className="w-full max-w-2xl px-8">
        <div className="text-center mb-8">
          <p className={`${textColor} text-xl mb-4 font-mono`}>
            {getLoadingText(scrollProgress)}
          </p>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${barColor} transition-all duration-300 ease-out rounded-full`}
            style={{ width: `${scrollProgress}%` }}
          ></div>
        </div>
        <div className="text-center mt-4">
          <p className="text-gray-500 text-sm font-mono">
            {Math.round(scrollProgress)}%
          </p>
        </div>
      </div>
    </section>
  );
}

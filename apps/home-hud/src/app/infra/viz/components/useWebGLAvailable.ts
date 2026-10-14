import { useState } from 'react';

function probeWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return context !== null;
  } catch {
    return false;
  }
}

/**
 * Probes for WebGL2 support once, lazily on first render. Only ever
 * mounted client-side (this app's R3F tree is dynamic-imported with
 * `ssr: false`), so reading from the DOM in the lazy initializer is safe —
 * no effect needed since the probe result never changes after mount.
 */
export function useWebGLAvailable(): boolean {
  const [available] = useState(probeWebGLSupport);
  return available;
}

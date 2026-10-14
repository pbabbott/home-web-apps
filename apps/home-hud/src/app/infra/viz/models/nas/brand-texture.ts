import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Renders a brand wordmark to a canvas and wraps it as a THREE.CanvasTexture
 * — cheaper than loading a font/glyph library for a single short label, and
 * good enough now that a real front photo confirms the wordmark exists.
 */
function createBrandTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Thin stroke-only text — reads as line art, not a solid filled logo.
    // lineWidth is tuned against the plane size this texture gets mapped
    // onto (see config.ts header.brandWidth/brandHeight) — a thin canvas
    // stroke on a small real-world plane can work out to a sub-millimeter
    // line that's effectively invisible at render distance. If the brand
    // plane size changes, re-check this still reads clearly.
    ctx.strokeStyle = '#02FBFF';
    ctx.lineWidth = 9;
    ctx.font = '400 72px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, 8, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function useBrandTexture(text: string): THREE.CanvasTexture {
  const texture = useMemo(() => createBrandTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

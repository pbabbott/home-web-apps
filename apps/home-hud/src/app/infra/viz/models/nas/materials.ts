import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { MaterialColors } from './config';

export interface NasMaterials {
  /** Near-black unlit fill, shared by every solid part — keeps hidden-line depth-sorting correct while staying visually void. */
  void: THREE.MeshBasicMaterial;
  /** Same void fill, slightly lifted so a hovered/selected tray still reads as "void" but distinguishable up close. */
  voidActive: THREE.MeshBasicMaterial;
  voidSelected: THREE.MeshBasicMaterial;
  /** The primary line-art color — nearly everything outlines in this one color. */
  edge: THREE.LineBasicMaterial;
  edgeDim: THREE.LineBasicMaterial;
  edgeSelected: THREE.LineBasicMaterial;
  /** The one secondary accent color (status/health), used sparingly. */
  edgeAccent: THREE.LineBasicMaterial;
  ledPrimary: THREE.MeshBasicMaterial;
  ledAccent: THREE.MeshBasicMaterial;
}

/**
 * Builds the shared material set once per mount and disposes it on unmount.
 * Tron-style line-art rendering: every fill is unlit near-black (MeshBasic,
 * ignores scene lighting entirely), and color only ever comes from line
 * materials or small flat-color LED accents — one dominant line color
 * (cyan) plus one secondary accent, per the target "series of lines, one
 * or two colors" look.
 */
export function useNasMaterials(colors: MaterialColors): NasMaterials {
  const materials = useMemo<NasMaterials>(() => {
    const voidColor = new THREE.Color(colors.void);
    const voidMat = new THREE.MeshBasicMaterial({ color: voidColor });
    const voidActive = new THREE.MeshBasicMaterial({
      color: voidColor
        .clone()
        .lerp(new THREE.Color(colors.edgeHighlight), 0.08),
    });
    const voidSelected = new THREE.MeshBasicMaterial({
      color: voidColor.clone().lerp(new THREE.Color(colors.edgeHighlight), 0.2),
    });

    const edge = new THREE.LineBasicMaterial({
      color: colors.edgeHighlight,
      transparent: true,
      opacity: 0.85,
    });
    const edgeDim = new THREE.LineBasicMaterial({
      color: colors.edgeHighlight,
      transparent: true,
      opacity: 0.45,
    });
    const edgeSelected = new THREE.LineBasicMaterial({
      color: colors.edgeHighlight,
      transparent: true,
      opacity: 1,
    });
    const edgeAccent = new THREE.LineBasicMaterial({
      color: colors.ledActivity,
      transparent: true,
      opacity: 0.9,
    });

    const ledPrimary = new THREE.MeshBasicMaterial({ color: colors.ledPower });
    const ledAccent = new THREE.MeshBasicMaterial({
      color: colors.ledActivity,
    });

    return {
      void: voidMat,
      voidActive,
      voidSelected,
      edge,
      edgeDim,
      edgeSelected,
      edgeAccent,
      ledPrimary,
      ledAccent,
    };
  }, [colors]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, [materials]);

  return materials;
}

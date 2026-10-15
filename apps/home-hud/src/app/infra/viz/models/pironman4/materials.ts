import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { MaterialColors } from './config';

export interface Pironman4Materials {
  void: THREE.MeshBasicMaterial;
  /** Void lifted slightly toward the line color — for dense repeated detail (grille holes) that needs to read without a full outline per hole, same technique as the NAS's vent dots. */
  voidActive: THREE.MeshBasicMaterial;
  edge: THREE.LineBasicMaterial;
  edgeDim: THREE.LineBasicMaterial;
  /** The illuminated power button's glow dot — the one flat accent fill, matching the real button's lit ring. */
  accent: THREE.MeshBasicMaterial;
}

/**
 * Same Tron-style material set as every model in this collection (see
 * docs/home-hud-3d-model-guide.md) — unlit void fills + line-art edges,
 * one dominant line color plus one small accent. Built once, disposed on
 * unmount.
 */
export function usePironman4Materials(
  colors: MaterialColors,
): Pironman4Materials {
  const materials = useMemo<Pironman4Materials>(() => {
    const voidColor = new THREE.Color(colors.void);
    const voidMat = new THREE.MeshBasicMaterial({ color: voidColor });
    const voidActive = new THREE.MeshBasicMaterial({
      color: voidColor.clone().lerp(new THREE.Color(colors.edgeHighlight), 0.1),
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
    const accent = new THREE.MeshBasicMaterial({ color: colors.ledActivity });

    return { void: voidMat, voidActive, edge, edgeDim, accent };
  }, [colors]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, [materials]);

  return materials;
}

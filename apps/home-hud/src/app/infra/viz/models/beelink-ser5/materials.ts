import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { MaterialColors } from './config';

export interface BeelinkSer5Materials {
  void: THREE.MeshBasicMaterial;
  /** Void lifted slightly toward the line color — for dense repeated detail (vent dots) that needs to read without a full outline per hole, same technique as the NAS's vent dots and Pironman4's grille holes. */
  voidActive: THREE.MeshBasicMaterial;
  edge: THREE.LineBasicMaterial;
  edgeDim: THREE.LineBasicMaterial;
  /** The illuminated power button's glow dot — red here (not the usual blue/green accent), matching the real hardware's signature red button. See REFERENCES.md. */
  accent: THREE.MeshBasicMaterial;
  /** The power-symbol icon drawn over the red button — neutral-300 (near-white). */
  powerIcon: THREE.MeshBasicMaterial;
}

/**
 * Same Tron-style material set as every model in this collection (see
 * docs/home-hud-3d-model-guide.md) — unlit void fills + line-art edges,
 * one dominant line color plus one small accent. Built once, disposed on
 * unmount.
 */
export function useBeelinkSer5Materials(
  colors: MaterialColors,
): BeelinkSer5Materials {
  const materials = useMemo<BeelinkSer5Materials>(() => {
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
    const powerIcon = new THREE.MeshBasicMaterial({ color: colors.powerIcon });

    return { void: voidMat, voidActive, edge, edgeDim, accent, powerIcon };
  }, [colors]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, [materials]);

  return materials;
}

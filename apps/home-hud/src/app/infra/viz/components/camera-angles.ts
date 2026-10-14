/**
 * Named camera angles shared by every model in the viz collection. A model
 * supplies only a radius (how far back the camera should sit to frame it);
 * this module turns an angle name into a concrete [x, y, z] position via
 * spherical coordinates around the origin.
 *
 * Azimuth 0 looks at the model's +Z (front) face, increasing azimuth
 * sweeps toward +X (right), matching the model coordinate system documented
 * in models/nas/config.ts.
 */

export type CameraAngle =
  | 'front'
  | 'rear'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'threeQuarter';

interface SphericalAngle {
  /** Degrees, 0 = looking at +Z. */
  azimuthDeg: number;
  /** Degrees, 0 = level, 90 = straight down from above. */
  elevationDeg: number;
}

const CAMERA_ANGLES: Record<CameraAngle, SphericalAngle> = {
  front: { azimuthDeg: 0, elevationDeg: 0 },
  rear: { azimuthDeg: 180, elevationDeg: 0 },
  left: { azimuthDeg: -90, elevationDeg: 0 },
  right: { azimuthDeg: 90, elevationDeg: 0 },
  top: { azimuthDeg: 0, elevationDeg: 89 },
  bottom: { azimuthDeg: 0, elevationDeg: -89 },
  threeQuarter: { azimuthDeg: 40, elevationDeg: 22 },
};

export const CAMERA_ANGLE_NAMES = Object.keys(CAMERA_ANGLES) as CameraAngle[];

export function cameraPositionForAngle(
  angle: CameraAngle,
  radius: number,
): [number, number, number] {
  const { azimuthDeg, elevationDeg } = CAMERA_ANGLES[angle];
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const elevation = (elevationDeg * Math.PI) / 180;

  const horizontalRadius = radius * Math.cos(elevation);
  const x = horizontalRadius * Math.sin(azimuth);
  const y = radius * Math.sin(elevation);
  const z = horizontalRadius * Math.cos(azimuth);

  return [x, y, z];
}

export function isCameraAngle(value: string): value is CameraAngle {
  return (CAMERA_ANGLE_NAMES as string[]).includes(value);
}

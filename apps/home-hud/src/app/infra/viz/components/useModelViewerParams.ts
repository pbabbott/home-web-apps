import { useSearchParams } from 'next/navigation';
import { isCameraAngle, type CameraAngle } from './camera-angles';

export interface ModelViewerParams {
  /** From `?angle=`; undefined when absent or not a valid CameraAngle. */
  initialAngle: CameraAngle | undefined;
  /** From `?ref=`; null when absent or not a valid CameraAngle. */
  referenceAngle: CameraAngle | null;
  /** Public URL of the reference photo for `referenceAngle`, if any. */
  referenceImageSrc: string | null;
}

/**
 * Parses the `?angle=` / `?ref=` query params shared by every model
 * viewer panel. `photoSlug` is the directory under `public/` holding that
 * model's `photos/<angle>.jpg` reference images.
 */
export function useModelViewerParams(photoSlug: string): ModelViewerParams {
  const searchParams = useSearchParams();

  const angleParam = searchParams.get('angle');
  const initialAngle =
    angleParam && isCameraAngle(angleParam) ? angleParam : undefined;

  const refParam = searchParams.get('ref');
  const referenceAngle = refParam && isCameraAngle(refParam) ? refParam : null;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const referenceImageSrc = referenceAngle
    ? `${basePath}/${photoSlug}/photos/${referenceAngle}.jpg`
    : null;

  return { initialAngle, referenceAngle, referenceImageSrc };
}

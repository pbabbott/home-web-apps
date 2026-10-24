export type PreviewKind = 'image' | 'pdf' | 'text';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const TEXT_EXTENSIONS = [
  'txt',
  'xml',
  'log',
  'json',
  'csv',
  'md',
  'ini',
  'cfg',
  'conf',
  'yaml',
  'yml',
];

/**
 * What a path can be previewed as, by extension, or null. Mirrors the list
 * in homelab-api (`src/lib/preview-types.ts`), which is what actually
 * enforces it; this only decides whether to offer the button.
 */
export function previewKind(path: string): PreviewKind | null {
  const name = path.slice(path.lastIndexOf('\\') + 1);
  const dot = name.lastIndexOf('.');

  if (dot <= 0) return null;

  const extension = name.slice(dot + 1).toLowerCase();

  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  if (TEXT_EXTENSIONS.includes(extension)) return 'text';

  return null;
}

/** Same-origin URL of the preview proxy for a source's file. */
export function previewUrl(sourceId: string, path: string): string {
  return `/exodus/preview?${new URLSearchParams({ sourceId, path })}`;
}

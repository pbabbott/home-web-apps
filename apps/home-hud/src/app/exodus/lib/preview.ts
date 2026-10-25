export type PreviewKind = 'image' | 'pdf' | 'text' | 'zip';

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
  if (extension === 'zip') return 'zip';
  if (TEXT_EXTENSIONS.includes(extension)) return 'text';

  return null;
}

/** What homelab-api returns for a zip: its entries, not its contents. Mirrors `ZipListing` there. */
export interface ZipListing {
  /** Entries the archive declares, before the cap. */
  total: number;
  truncated: boolean;
  /** Uncompressed size of the listed entries. */
  totalSize: number;
  entries: {
    path: string;
    size: number;
    compressedSize: number;
    modifiedAt: string | null;
    isDirectory: boolean;
    encrypted: boolean;
  }[];
}

/** Same-origin URL of the preview proxy for a source's file. */
export function previewUrl(sourceId: string, path: string): string {
  return `/exodus/preview?${new URLSearchParams({ sourceId, path })}`;
}

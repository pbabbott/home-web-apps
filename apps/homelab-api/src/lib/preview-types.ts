export type PreviewKind = 'image' | 'pdf' | 'text';

export type PreviewType = {
  kind: PreviewKind;
  contentType: string;
  /** Largest file that will be streamed (text is truncated instead). */
  maxBytes: number;
};

const MB = 1024 * 1024;

/**
 * What can be previewed, by extension. SVG is deliberately absent: an SVG
 * can carry script, and previews are served from the API's own origin.
 * Text is always served as `text/plain` so a `.xml` or `.html`-like file is
 * displayed, never interpreted.
 */
const IMAGE = (contentType: string): PreviewType => ({
  kind: 'image',
  contentType,
  maxBytes: 25 * MB,
});
const TEXT: PreviewType = {
  kind: 'text',
  contentType: 'text/plain; charset=utf-8',
  maxBytes: 1 * MB,
};

const BY_EXTENSION: Record<string, PreviewType> = {
  jpg: IMAGE('image/jpeg'),
  jpeg: IMAGE('image/jpeg'),
  png: IMAGE('image/png'),
  gif: IMAGE('image/gif'),
  webp: IMAGE('image/webp'),
  bmp: IMAGE('image/bmp'),
  pdf: { kind: 'pdf', contentType: 'application/pdf', maxBytes: 25 * MB },
  txt: TEXT,
  xml: TEXT,
  log: TEXT,
  json: TEXT,
  csv: TEXT,
  md: TEXT,
  ini: TEXT,
  cfg: TEXT,
  conf: TEXT,
  yaml: TEXT,
  yml: TEXT,
};

/** The preview type for a path, or null if its extension is not previewable. */
export const previewTypeOf = (path: string): PreviewType | null => {
  const name = path.slice(path.lastIndexOf('\\') + 1);
  const dot = name.lastIndexOf('.');

  if (dot <= 0) return null;

  return BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null;
};

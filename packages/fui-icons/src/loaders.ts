import type { SimpleIcon } from 'simple-icons';

type IconIndex = Map<string, SimpleIcon>;

let indexPromise: Promise<IconIndex> | null = null;

function isSimpleIcon(value: unknown): value is SimpleIcon {
  return (
    typeof value === 'object' &&
    value !== null &&
    'slug' in value &&
    'path' in value &&
    'hex' in value
  );
}

function getIndex(): Promise<IconIndex> {
  if (!indexPromise) {
    indexPromise = import('simple-icons').then((m) => {
      const map = new Map<string, SimpleIcon>();
      for (const value of Object.values(m)) {
        if (isSimpleIcon(value)) {
          map.set(value.slug, value);
        }
      }
      return map;
    });
  }
  return indexPromise;
}

const cache = new Map<string, Promise<SimpleIcon | null>>();

export function loadIcon(slug: string): Promise<SimpleIcon | null> {
  if (!cache.has(slug)) {
    cache.set(
      slug,
      getIndex().then((index) => index.get(slug) ?? null),
    );
  }
  return cache.get(slug)!;
}

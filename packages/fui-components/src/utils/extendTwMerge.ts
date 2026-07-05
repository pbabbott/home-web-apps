import { extendTailwindMerge } from 'tailwind-merge';

export const extendedTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-h1',
        'text-h2',
        'text-h3',
        'text-h4',
        'text-h5',
        'text-h6',
        'text-body1',
        'text-body2',
        'text-button',
        'text-small',
        'text-caption',
      ],
    },
    // Without this, tailwind-merge only recognizes Tailwind's built-in
    // palette for color conflicts — e.g. `border-accent-falcon-400` isn't
    // seen as conflicting with `border-neutral-700`, so both survive the
    // merge and whichever the browser applies last silently wins instead of
    // the caller's override.
    theme: {
      colors: [
        'primary',
        'secondary',
        'success',
        'warning',
        'error',
        'accent-purple',
        'accent-falcon',
      ],
    },
  },
});

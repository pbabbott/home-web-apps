/**
 * An error the copy already describes. The destination layer wraps whatever
 * a filesystem call throws, except these, which pass through untouched: a
 * new error class of the copy extends this one and is never mistaken for an
 * errno failure.
 */
export class CopyError extends Error {}

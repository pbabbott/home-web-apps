import { neutral, secondary } from '@abbottland/fui-components';

/**
 * The 3 states every procedural model's appearance can be in — deliberately
 * identical to `HostStatus` (`hosts/lib/homelab-api.ts`) so the host-detail
 * embed (`Host3DModel.tsx`) can pass a real host's status straight through
 * with zero translation. `'online'` is itself one of the three named
 * states (the existing default behavior — respects a custom `edgeColor`,
 * else each model's own default), not "absence of a status."
 */
export type ModelStatus = 'online' | 'offline' | 'unknown';

// 'offline' -> neutral (gray); 'unknown' -> a darker shade of the brand
// secondary blue. Same two-tier brighter-line/dimmer-accent relationship
// in both, just a different hue family per state, so they read as
// distinct from each other and from the default cyan at a glance.
// Exported (not just used internally) so NAS's 2D bay-status dots — a
// separate, independent color lookup — can reuse the same two tones
// instead of defining their own copies.
export const OFFLINE_EDGE_COLOR = neutral[500];
export const OFFLINE_ACCENT_COLOR = neutral[700];
export const UNKNOWN_EDGE_COLOR = secondary[700];
export const UNKNOWN_ACCENT_COLOR = secondary[900];

/**
 * Resolves a model's final material colors from its configured defaults
 * plus the caller's `edgeColor`/`status` choices. Shared across every
 * model (NAS/Pironman4/Beelink) instead of each hand-rolling its own
 * override memo — generic over `T` since each model's own `MaterialColors`
 * shape differs (field count, extra accents like NAS's `ledPower` or
 * Beelink's `powerIcon`), so this file never needs to import any
 * model-specific type.
 *
 * `status` wins over `edgeColor` — offline/unknown "override any other
 * color setting" per the house rule this was built for. `void` (the
 * near-black fill every model uses) is never touched by either state;
 * only the line/accent colors change.
 */
export function resolveMaterialColors<T extends object>(
  base: T,
  options: { edgeColor?: string; status: ModelStatus },
): T {
  if (options.status === 'offline' || options.status === 'unknown') {
    const edgeValue =
      options.status === 'offline' ? OFFLINE_EDGE_COLOR : UNKNOWN_EDGE_COLOR;
    const accentValue =
      options.status === 'offline'
        ? OFFLINE_ACCENT_COLOR
        : UNKNOWN_ACCENT_COLOR;
    // Each model's own `MaterialColors` is a plain interface (no index
    // signature), so it doesn't structurally satisfy `Record<string,
    // string>` as a generic constraint — cast to iterate generically, then
    // cast back. The public signature (`T` in, `T` out) stays fully typed;
    // only this internal loop is untyped.
    const result = { ...base } as Record<string, string>;
    for (const key of Object.keys(result)) {
      if (key === 'void') continue;
      result[key] = key === 'edgeHighlight' ? edgeValue : accentValue;
    }
    return result as T;
  }

  if (options.edgeColor) {
    return { ...base, edgeHighlight: options.edgeColor } as T;
  }

  return base;
}

import type { ModelStatus } from '../../components/resolve-material-colors';

/**
 * Public prop shape for the Pironman4 model. No real telemetry or
 * selectable sub-components exist yet (unlike the NAS's drive bays) — this
 * is deliberately minimal, extend it when a real data source (host CPU
 * temp, fan state) is wired up.
 */
export interface Pironman4ModelProps {
  deviceName?: string;
  /**
   * Overrides every border/line/glow color (`materials.edgeHighlight`) with
   * this hex value — borders, edge outlines, and the dense-grille "active
   * void" tint all derive from it. Leave unset to use the model's own
   * default (`config.materials.edgeHighlight`, `#02FBFF`). Ignored when
   * `status` is `'offline'`/`'unknown'` — see `status`.
   */
  edgeColor?: string;
  /**
   * `'online'` (default) respects `edgeColor`/the model's own default;
   * `'offline'`/`'unknown'` override every color (including `edgeColor`)
   * with a shared neutral/secondary tone — see
   * `components/resolve-material-colors.ts`.
   */
  status?: ModelStatus;
}

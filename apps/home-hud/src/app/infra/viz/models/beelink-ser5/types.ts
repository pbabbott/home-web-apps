import type { ModelStatus } from '../../components/resolve-material-colors';

/**
 * Public prop shape for the Beelink SER5 model. No real telemetry or
 * selectable sub-components exist yet (unlike the NAS's drive bays) — this
 * is deliberately minimal, extend it when a real data source (host CPU
 * temp, fan state) is wired up.
 */
export interface BeelinkSer5ModelProps {
  deviceName?: string;
  /**
   * Overrides every border/line/glow color (`materials.edgeHighlight`) with
   * this hex value — borders, edge outlines, and the dense-vent "active
   * void" tint all derive from it. Leave unset to use the model's own
   * default (`config.materials.edgeHighlight`, `#02FBFF`). Does NOT affect
   * the power-button accent, which stays red regardless (see config.ts) —
   * unless `status` is `'offline'`/`'unknown'`, which overrides it too
   * (see `status`).
   */
  edgeColor?: string;
  /**
   * `'online'` (default) respects `edgeColor`/the model's own default
   * (including the red power-button accent); `'offline'`/`'unknown'`
   * override every color (including `edgeColor` and the power button)
   * with a shared neutral/secondary tone — see
   * `components/resolve-material-colors.ts`.
   */
  status?: ModelStatus;
}

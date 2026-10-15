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
   * default (`config.materials.edgeHighlight`, `#02FBFF`).
   */
  edgeColor?: string;
}

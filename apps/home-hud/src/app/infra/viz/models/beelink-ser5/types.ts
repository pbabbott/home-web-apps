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
   * the power-button accent, which stays red regardless (see config.ts).
   */
  edgeColor?: string;
}

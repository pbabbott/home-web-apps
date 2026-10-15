/**
 * Public prop shape for the Pironman4 model. No real telemetry or
 * selectable sub-components exist yet (unlike the NAS's drive bays) — this
 * is deliberately minimal, extend it when a real data source (host CPU
 * temp, fan state) is wired up.
 */
export interface Pironman4ModelProps {
  deviceName?: string;
}

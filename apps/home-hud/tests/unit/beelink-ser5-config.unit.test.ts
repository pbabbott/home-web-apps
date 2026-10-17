import { BEELINK_SER5_CONFIG } from '../../src/app/infra/viz/models/beelink-ser5/config';

describe('BEELINK_SER5_CONFIG', () => {
  it('chamfer is smaller than half the chassis width and depth (the ±Y top/bottom faces it cuts)', () => {
    const { width, depth } = BEELINK_SER5_CONFIG.chassis.dimensions;
    const { chamfer } = BEELINK_SER5_CONFIG.chassis;
    expect(chamfer).toBeLessThan(width / 2);
    expect(chamfer).toBeLessThan(depth / 2);
  });

  it('front I/O bezel fits within the chassis width and height', () => {
    const { width, height } = BEELINK_SER5_CONFIG.chassis.dimensions;
    const { bezel } = BEELINK_SER5_CONFIG.frontPanel;
    expect(bezel.width).toBeLessThan(width);
    expect(bezel.height).toBeLessThan(height);
  });

  it('every front port stays within the bezel bounds', () => {
    const { bezel, bezelOffsetY, ports } = BEELINK_SER5_CONFIG.frontPanel;
    for (const port of ports) {
      const [x, y] = port.position;
      expect(Math.abs(x) + port.width / 2).toBeLessThan(bezel.width / 2);
      expect(Math.abs(bezelOffsetY + y) + port.height / 2).toBeLessThan(
        bezel.height / 2,
      );
    }
  });

  it('every rear port stays within the rear face width bounds', () => {
    const { width } = BEELINK_SER5_CONFIG.chassis.dimensions;
    for (const port of BEELINK_SER5_CONFIG.rearPorts) {
      const [x] = port.position;
      expect(Math.abs(x) + port.width / 2).toBeLessThan(width / 2);
    }
  });

  it('every rear vent slot stays within the rear face width bounds', () => {
    const { width } = BEELINK_SER5_CONFIG.chassis.dimensions;
    for (const slot of BEELINK_SER5_CONFIG.rearVentSlots) {
      const [x] = slot.position;
      expect(Math.abs(x) + slot.width / 2).toBeLessThan(width / 2);
    }
  });

  it('every rear vent slot stays within the rear face height bounds', () => {
    const { height } = BEELINK_SER5_CONFIG.chassis.dimensions;
    for (const slot of BEELINK_SER5_CONFIG.rearVentSlots) {
      const [, y] = slot.position;
      expect(Math.abs(y) + slot.height / 2).toBeLessThan(height / 2);
    }
  });

  it('every rear shield plaque stays within the rear face bounds', () => {
    const { width, height } = BEELINK_SER5_CONFIG.chassis.dimensions;
    for (const shield of BEELINK_SER5_CONFIG.rearShields) {
      const [x, y] = shield.position;
      expect(Math.abs(x) + shield.width / 2).toBeLessThan(width / 2);
      expect(Math.abs(y) + shield.height / 2).toBeLessThan(height / 2);
    }
  });

  it('the DP and HDMI ports sit within their shared shield plaque', () => {
    const { rearPorts, rearShields } = BEELINK_SER5_CONFIG;
    const shield = rearShields[0];
    const dp = rearPorts.find((p) => p.id === 'dp')!;
    const hdmi = rearPorts.find((p) => p.id === 'hdmi')!;
    for (const port of [dp, hdmi]) {
      const [x] = port.position;
      const [shieldX] = shield.position;
      expect(Math.abs(x - shieldX) + port.width / 2).toBeLessThan(
        shield.width / 2,
      );
    }
  });

  it('declares at least one front port and one rear port', () => {
    expect(BEELINK_SER5_CONFIG.frontPanel.ports.length).toBeGreaterThan(0);
    expect(BEELINK_SER5_CONFIG.rearPorts.length).toBeGreaterThan(0);
  });

  it('declares a red power-button accent, distinct from the cyan edge color', () => {
    expect(BEELINK_SER5_CONFIG.materials.ledActivity).not.toBe(
      BEELINK_SER5_CONFIG.materials.edgeHighlight,
    );
  });
});

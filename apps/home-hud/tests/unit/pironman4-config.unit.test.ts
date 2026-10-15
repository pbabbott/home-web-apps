import { PIRONMAN4_CONFIG } from '../../src/app/infra/viz/models/pironman4/config';

describe('PIRONMAN4_CONFIG', () => {
  it('chamfer is smaller than half the chassis width and height', () => {
    const { width, height } = PIRONMAN4_CONFIG.chassis.dimensions;
    const { chamfer } = PIRONMAN4_CONFIG.chassis;
    expect(chamfer).toBeLessThan(width / 2);
    expect(chamfer).toBeLessThan(height / 2);
  });

  it('fan grille fits within the top face (narrower chassis dimension)', () => {
    const { width, depth } = PIRONMAN4_CONFIG.chassis.dimensions;
    const { radius } = PIRONMAN4_CONFIG.fanGrille;
    expect(radius * 2).toBeLessThan(Math.min(width, depth));
  });

  it('every port stays within the rear (-Z) ports face bounds', () => {
    const { width, height } = PIRONMAN4_CONFIG.chassis.dimensions;
    for (const port of PIRONMAN4_CONFIG.ports) {
      const [x, y] = port.position;
      expect(Math.abs(x) + port.width / 2).toBeLessThan(width / 2);
      expect(Math.abs(y) + port.height / 2).toBeLessThan(height / 2);
    }
  });

  it('declares at least one port', () => {
    expect(PIRONMAN4_CONFIG.ports.length).toBeGreaterThan(0);
  });
});

import {
  ASUSTOR_NAS_CONFIG,
  computeBayPositionsX,
  computeBayRowWidth,
  computeBayRowY,
  computeBayWidth,
  type NasConfig,
} from '../../src/app/infra/viz/models/nas/config';

function withBayCount(count: number): NasConfig {
  return {
    ...ASUSTOR_NAS_CONFIG,
    bays: { ...ASUSTOR_NAS_CONFIG.bays, count },
  };
}

describe('computeBayPositionsX', () => {
  it('returns one X position per configured bay', () => {
    expect(computeBayPositionsX(ASUSTOR_NAS_CONFIG)).toHaveLength(
      ASUSTOR_NAS_CONFIG.bays.count,
    );
  });

  it('orders bays left-to-right (ascending X)', () => {
    const positions = computeBayPositionsX(ASUSTOR_NAS_CONFIG);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('spaces adjacent bays by exactly bayWidth + gap', () => {
    const bayWidth = computeBayWidth(ASUSTOR_NAS_CONFIG);
    const { gap } = ASUSTOR_NAS_CONFIG.bays;
    const positions = computeBayPositionsX(ASUSTOR_NAS_CONFIG);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] - positions[i - 1]).toBeCloseTo(bayWidth + gap);
    }
  });

  it('starts the row after the header left strip + left margin', () => {
    const bayWidth = computeBayWidth(ASUSTOR_NAS_CONFIG);
    const positions = computeBayPositionsX(ASUSTOR_NAS_CONFIG);
    const { width } = ASUSTOR_NAS_CONFIG.dimensions;
    const { leftStripWidth } = ASUSTOR_NAS_CONFIG.header;
    const { rowLeftMargin } = ASUSTOR_NAS_CONFIG.bays;
    const expectedFirstBayLeftEdge =
      -width / 2 + leftStripWidth + rowLeftMargin;
    expect(positions[0] - bayWidth / 2).toBeCloseTo(expectedFirstBayLeftEdge);
  });

  it('ends the row before the chassis right edge, respecting rowRightMargin', () => {
    const bayWidth = computeBayWidth(ASUSTOR_NAS_CONFIG);
    const positions = computeBayPositionsX(ASUSTOR_NAS_CONFIG);
    const { width } = ASUSTOR_NAS_CONFIG.dimensions;
    const { rowRightMargin } = ASUSTOR_NAS_CONFIG.bays;
    const lastBayRightEdge = positions[positions.length - 1] + bayWidth / 2;
    expect(lastBayRightEdge).toBeCloseTo(width / 2 - rowRightMargin);
  });

  it('scales with a different configured bay count', () => {
    const fourBay = withBayCount(4);
    expect(computeBayPositionsX(fourBay)).toHaveLength(4);
    // computeBayWidth always fills the same available space, so fewer
    // bays means each is wider — row width itself stays ~constant.
    expect(computeBayWidth(fourBay)).toBeGreaterThan(
      computeBayWidth(ASUSTOR_NAS_CONFIG),
    );
    expect(computeBayRowWidth(fourBay)).toBeCloseTo(
      computeBayRowWidth(ASUSTOR_NAS_CONFIG),
    );
  });
});

describe('ASUSTOR_NAS_CONFIG', () => {
  it('fits the bay row within the chassis width', () => {
    const rowWidth = computeBayRowWidth(ASUSTOR_NAS_CONFIG);
    expect(rowWidth).toBeLessThan(ASUSTOR_NAS_CONFIG.dimensions.width);
  });

  it('fits the bay row + header below the chassis height', () => {
    const rowY = computeBayRowY(ASUSTOR_NAS_CONFIG);
    const rowTop = rowY + ASUSTOR_NAS_CONFIG.bays.bayHeight / 2;
    const headerBottom =
      ASUSTOR_NAS_CONFIG.dimensions.height / 2 -
      ASUSTOR_NAS_CONFIG.header.height;
    expect(rowTop).toBeLessThan(
      headerBottom + ASUSTOR_NAS_CONFIG.header.height,
    );
    expect(rowY - ASUSTOR_NAS_CONFIG.bays.bayHeight / 2).toBeGreaterThan(
      -ASUSTOR_NAS_CONFIG.dimensions.height / 2,
    );
  });

  it('declares at least one rear port', () => {
    expect(ASUSTOR_NAS_CONFIG.rear.ports.length).toBeGreaterThan(0);
  });
});

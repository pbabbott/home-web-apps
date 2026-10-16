// resolve-material-colors.ts imports color tokens from
// `@abbottland/fui-components`, whose published bundle pulls in
// `@xyflow/react/dist/style.css` as a side effect — fine in the browser,
// but Jest (no CSS transform configured for this package) can't parse
// that as JS. Mocked here rather than reconfiguring Jest globally, since
// this test only needs internal self-consistency (asserting against the
// module's own exported constants), not the tokens' real hex values.
jest.mock('@abbottland/fui-components', () => ({
  neutral: { 500: '#MOCK-NEUTRAL-500', 700: '#MOCK-NEUTRAL-700' },
  secondary: { 700: '#MOCK-SECONDARY-700', 900: '#MOCK-SECONDARY-900' },
}));

import {
  OFFLINE_ACCENT_COLOR,
  OFFLINE_EDGE_COLOR,
  UNKNOWN_ACCENT_COLOR,
  UNKNOWN_EDGE_COLOR,
  resolveMaterialColors,
} from '../../src/app/infra/viz/components/resolve-material-colors';

const BASE = {
  void: '#05070A',
  edgeHighlight: '#02FBFF',
  ledActivity: '#4FA884',
};

describe('resolveMaterialColors', () => {
  it('returns base unchanged when online with no edgeColor', () => {
    expect(resolveMaterialColors(BASE, { status: 'online' })).toBe(BASE);
  });

  it('online + edgeColor overrides only edgeHighlight', () => {
    const result = resolveMaterialColors(BASE, {
      status: 'online',
      edgeColor: '#FF0000',
    });
    expect(result.edgeHighlight).toBe('#FF0000');
    expect(result.void).toBe(BASE.void);
    expect(result.ledActivity).toBe(BASE.ledActivity);
  });

  it('offline overrides every color except void, ignoring edgeColor', () => {
    const result = resolveMaterialColors(BASE, {
      status: 'offline',
      edgeColor: '#FF0000',
    });
    expect(result.void).toBe(BASE.void);
    expect(result.edgeHighlight).toBe(OFFLINE_EDGE_COLOR);
    expect(result.ledActivity).toBe(OFFLINE_ACCENT_COLOR);
  });

  it('unknown overrides every color except void, ignoring edgeColor', () => {
    const result = resolveMaterialColors(BASE, {
      status: 'unknown',
      edgeColor: '#FF0000',
    });
    expect(result.void).toBe(BASE.void);
    expect(result.edgeHighlight).toBe(UNKNOWN_EDGE_COLOR);
    expect(result.ledActivity).toBe(UNKNOWN_ACCENT_COLOR);
  });

  it('offline and unknown produce distinct colors from each other and from online default', () => {
    const offline = resolveMaterialColors(BASE, { status: 'offline' });
    const unknown = resolveMaterialColors(BASE, { status: 'unknown' });
    expect(offline.edgeHighlight).not.toBe(unknown.edgeHighlight);
    expect(offline.edgeHighlight).not.toBe(BASE.edgeHighlight);
    expect(unknown.edgeHighlight).not.toBe(BASE.edgeHighlight);
  });

  it('works generically across a model with extra fields (e.g. Beelink-style powerIcon)', () => {
    const withExtra = { ...BASE, powerIcon: '#C8D9DE' };
    const result = resolveMaterialColors(withExtra, { status: 'offline' });
    expect(result.powerIcon).toBe(OFFLINE_ACCENT_COLOR);
    expect(result.void).toBe(withExtra.void);
  });
});

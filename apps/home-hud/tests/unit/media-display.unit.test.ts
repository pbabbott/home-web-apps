import {
  formatEta,
  formatRunTime,
  formatSpeed,
} from '../../src/app/media/lib/display';

describe('formatSpeed', () => {
  it('formats bytes per second with a binary unit', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(4 * 1024 * 1024)).toBe('4.0 MiB/s');
  });
});

describe('formatEta', () => {
  it('is a dash when unknown', () => {
    expect(formatEta(null)).toBe('—');
  });

  it('uses the two largest relevant units', () => {
    expect(formatEta(12)).toBe('12s');
    expect(formatEta(243)).toBe('4m 3s');
    expect(formatEta(3900)).toBe('1h 5m');
  });
});

describe('formatRunTime', () => {
  it('shows milliseconds under a second', () => {
    expect(
      formatRunTime('2026-11-16T12:00:00.000Z', '2026-11-16T12:00:00.102Z'),
    ).toBe('102ms');
  });

  it('falls back to the shared duration format from a second up', () => {
    expect(
      formatRunTime('2026-11-16T12:00:00.000Z', '2026-11-16T12:01:05.000Z'),
    ).toBe('1m 5s');
  });

  it('is a dash when either end is missing or the range is negative', () => {
    expect(formatRunTime(undefined, '2026-11-16T12:00:00Z')).toBe('—');
    expect(formatRunTime('2026-11-16T12:00:00Z', undefined)).toBe('—');
    expect(formatRunTime('2026-11-16T12:00:01Z', '2026-11-16T12:00:00Z')).toBe(
      '—',
    );
  });
});

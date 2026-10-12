import {
  parseCpuQuantity,
  parseMemoryQuantity,
} from '../../src/lib/k8s-quantity';

describe('parseCpuQuantity', () => {
  it('parses millicore suffix', () => {
    expect(parseCpuQuantity('250m')).toBe(0.25);
  });

  it('parses bare core counts', () => {
    expect(parseCpuQuantity('1.5')).toBe(1.5);
    expect(parseCpuQuantity('2')).toBe(2);
  });

  it('returns null for missing or unparseable input', () => {
    expect(parseCpuQuantity(undefined)).toBeNull();
    expect(parseCpuQuantity(null)).toBeNull();
    expect(parseCpuQuantity('not-a-number')).toBeNull();
  });
});

describe('parseMemoryQuantity', () => {
  it('parses binary suffixes', () => {
    expect(parseMemoryQuantity('1Ki')).toBe(1024);
    expect(parseMemoryQuantity('512Mi')).toBe(512 * 1024 ** 2);
    expect(parseMemoryQuantity('2Gi')).toBe(2 * 1024 ** 3);
  });

  it('parses decimal SI suffixes', () => {
    expect(parseMemoryQuantity('1k')).toBe(1000);
    expect(parseMemoryQuantity('5M')).toBe(5_000_000);
    expect(parseMemoryQuantity('1G')).toBe(1_000_000_000);
  });

  it('parses bare byte counts', () => {
    expect(parseMemoryQuantity('1048576')).toBe(1048576);
  });

  it('does not mistake "Mi" for a bare "M" match', () => {
    expect(parseMemoryQuantity('10Mi')).toBe(10 * 1024 ** 2);
  });

  it('returns null for missing or unparseable input', () => {
    expect(parseMemoryQuantity(undefined)).toBeNull();
    expect(parseMemoryQuantity(null)).toBeNull();
    expect(parseMemoryQuantity('bogus')).toBeNull();
  });
});

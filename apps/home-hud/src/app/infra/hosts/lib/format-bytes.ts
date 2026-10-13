const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;

/** Binary byte formatting shared by any bytes-unit chart (memory, disk, ...). */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (bytes === 0) return '0 B';

  const exponent = Math.min(
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)),
    UNITS.length - 1,
  );

  return `${(bytes / 1024 ** exponent).toFixed(fractionDigits)} ${UNITS[exponent]}`;
}

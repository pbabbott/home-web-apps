// Parses the subset of Kubernetes "Quantity" suffixes
// (https://kubernetes.io/docs/reference/kubernetes-api/common-definitions/quantity/)
// that show up in container resource requests/limits and node
// capacity/allocatable fields. Binary suffixes are checked before decimal
// ones so "Mi" isn't mistaken for a bare "M" with a stray "i".

const BINARY_MEMORY_SUFFIXES: [string, number][] = [
  ['Ei', 1024 ** 6],
  ['Pi', 1024 ** 5],
  ['Ti', 1024 ** 4],
  ['Gi', 1024 ** 3],
  ['Mi', 1024 ** 2],
  ['Ki', 1024],
];

const DECIMAL_MEMORY_SUFFIXES: [string, number][] = [
  ['E', 1e18],
  ['P', 1e15],
  ['T', 1e12],
  ['G', 1e9],
  ['M', 1e6],
  ['k', 1e3],
];

/** CPU quantity (e.g. `"250m"`, `"1.5"`) to cores. Returns `null` if unparseable. */
export function parseCpuQuantity(
  quantity: string | undefined | null,
): number | null {
  if (!quantity) return null;
  const trimmed = quantity.trim();

  if (trimmed.endsWith('m')) {
    const value = Number(trimmed.slice(0, -1));
    return Number.isFinite(value) ? value / 1000 : null;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Memory quantity (e.g. `"512Mi"`, `"2Gi"`, `"1000000"`) to bytes. Returns `null` if unparseable. */
export function parseMemoryQuantity(
  quantity: string | undefined | null,
): number | null {
  if (!quantity) return null;
  const trimmed = quantity.trim();

  for (const [suffix, multiplier] of BINARY_MEMORY_SUFFIXES) {
    if (trimmed.endsWith(suffix)) {
      const value = Number(trimmed.slice(0, -suffix.length));
      return Number.isFinite(value) ? value * multiplier : null;
    }
  }

  for (const [suffix, multiplier] of DECIMAL_MEMORY_SUFFIXES) {
    if (trimmed.endsWith(suffix)) {
      const value = Number(trimmed.slice(0, -suffix.length));
      return Number.isFinite(value) ? value * multiplier : null;
    }
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

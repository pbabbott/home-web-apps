export type ApplyFilterSelectionsParameters = Record<string, never>;

/** No parameters yet; anything other than an empty object is rejected. */
export const isApplyFilterSelectionsParameters = (
  value: unknown,
): value is ApplyFilterSelectionsParameters =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).length === 0;

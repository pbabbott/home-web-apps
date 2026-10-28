/**
 * Runs `task(0..count-1)` with at most `limit` in flight, starting them in
 * order. After the first failure nothing new starts; the tasks already
 * running are waited for (they share the item's abort signal, which ends
 * them quickly) and the first error is thrown. `onFailure` is called with it
 * at once, so the caller can abort the tasks in flight. With `limit` 1 this is a
 * plain sequential loop.
 */
export const runPool = async (
  limit: number,
  count: number,
  task: (index: number) => Promise<void>,
  onFailure?: (error: unknown) => void,
): Promise<void> => {
  let next = 0;
  let failure: { error: unknown } | undefined;

  const worker = async (): Promise<void> => {
    while (!failure && next < count) {
      const index = next++;

      try {
        await task(index);
      } catch (error) {
        if (!failure) {
          failure = { error };
          onFailure?.(error);
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, count)) }, worker),
  );
  if (failure) throw failure.error;
};

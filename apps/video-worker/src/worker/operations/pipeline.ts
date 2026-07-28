/**
 * One unit of a multi-step operation. Takes the operation's accumulated
 * context and returns the next context — steps run in array order and each
 * sees the previous step's output, so later steps can depend on state
 * earlier ones produced (e.g. a resolved file path, a detected timestamp).
 */
export type Step<Context> = (ctx: Context) => Promise<Context>;

export const runSteps = async <Context>(
  ctx: Context,
  steps: Step<Context>[],
): Promise<Context> => {
  let current = ctx;

  for (const step of steps) {
    current = await step(current);
  }

  return current;
};

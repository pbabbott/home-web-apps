import { PauseTracker } from '../../src/copy/pause-tracker';

describe('PauseTracker', () => {
  let now = 0;
  const tracker = () => new PauseTracker(() => now);

  beforeEach(() => {
    now = 1_000_000;
  });

  it('is due when nothing is known', () => {
    expect(tracker().due('destination')).toBe(true);
  });

  it('waits 30 s after the first failure, then doubles up to 5 minutes', () => {
    const pauses = tracker();
    const waits: number[] = [];

    for (let i = 0; i < 6; i++) {
      waits.push(pauses.fail('destination').getTime() - now);
    }

    expect(waits).toEqual([30_000, 60_000, 120_000, 240_000, 300_000, 300_000]);
  });

  it('is due again when the wait is over', () => {
    const pauses = tracker();

    pauses.fail('destination');
    expect(pauses.due('destination')).toBe(false);
    now += 29_999;
    expect(pauses.due('destination')).toBe(false);
    now += 1;
    expect(pauses.due('destination')).toBe(true);
  });

  it('keys are independent and reset forgets the count', () => {
    const pauses = tracker();

    pauses.fail('source:a');
    pauses.fail('source:a');
    pauses.fail('source:b');
    expect(pauses.due('source:b')).toBe(false);

    pauses.reset('source:a');
    expect(pauses.due('source:a')).toBe(true);
    expect(pauses.fail('source:a').getTime() - now).toBe(30_000);
    expect(pauses.fail('source:b').getTime() - now).toBe(60_000);
  });
});

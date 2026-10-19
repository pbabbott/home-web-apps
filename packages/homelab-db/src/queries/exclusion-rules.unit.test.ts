import { resolveExclusion } from './exclusion-rules';

const rule = (
  id: string,
  scope: 'selective_only' | 'exclude_subtree',
  normalizedPath: string,
) => ({ id, scope, normalizedPath });

describe('resolveExclusion', () => {
  it('is none without rules', () => {
    expect(resolveExclusion([], 'c:\\users\\you')).toEqual({
      state: 'none',
      ruleIds: [],
    });
  });

  it('excludes the path itself and everything beneath an exclude_subtree rule', () => {
    const rules = [rule('r1', 'exclude_subtree', 'c:\\users\\you\\old-client')];

    for (const path of [
      'c:\\users\\you\\old-client',
      'c:\\users\\you\\old-client\\src',
      'c:\\users\\you\\old-client\\src\\a.ts',
    ]) {
      expect(resolveExclusion(rules, path)).toEqual({
        state: 'excluded',
        ruleIds: ['r1'],
      });
    }
  });

  it('respects directory boundaries', () => {
    const rules = [rule('r1', 'exclude_subtree', 'c:\\foo')];

    expect(resolveExclusion(rules, 'c:\\foobar').state).toBe('none');
    expect(resolveExclusion(rules, 'c:\\foo\\bar').state).toBe('excluded');
    expect(resolveExclusion(rules, 'c:\\').state).toBe('none');
  });

  it('treats a drive root rule as covering the whole drive', () => {
    const rules = [rule('r1', 'exclude_subtree', 'c:\\')];

    expect(resolveExclusion(rules, 'c:\\users').state).toBe('excluded');
    expect(resolveExclusion(rules, 'd:\\users').state).toBe('none');
  });

  it('marks only the exact path as selective, not its descendants', () => {
    const rules = [
      rule('r1', 'selective_only', 'c:\\users\\you\\node_modules'),
    ];

    expect(resolveExclusion(rules, 'c:\\users\\you\\node_modules')).toEqual({
      state: 'selective',
      ruleIds: ['r1'],
    });
    expect(
      resolveExclusion(rules, 'c:\\users\\you\\node_modules\\left-pad').state,
    ).toBe('none');
  });

  it('lets exclude_subtree win over selective_only, whichever level owns it', () => {
    const rules = [
      rule('selective', 'selective_only', 'c:\\windows\\temp'),
      rule('global', 'exclude_subtree', 'c:\\windows'),
    ];

    expect(resolveExclusion(rules, 'c:\\windows\\temp')).toEqual({
      state: 'excluded',
      ruleIds: ['global'],
    });
    expect(resolveExclusion([...rules].reverse(), 'c:\\windows\\temp')).toEqual(
      {
        state: 'excluded',
        ruleIds: ['global'],
      },
    );
  });

  it('reports every excluding rule', () => {
    const rules = [
      rule('a', 'exclude_subtree', 'c:\\windows'),
      rule('b', 'exclude_subtree', 'c:\\windows\\system32'),
    ];

    expect(resolveExclusion(rules, 'c:\\windows\\system32\\x').ruleIds).toEqual(
      ['a', 'b'],
    );
  });
});

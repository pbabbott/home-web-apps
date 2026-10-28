import {
  slugifySourceDirName,
  toDestRelPath,
} from '../../src/services/backup/dest-paths';
import {
  planBackup,
  type PlanInput,
  type PlanRule,
} from '../../src/services/backup/planner';
import { destinationFolderWarning } from '../../src/services/backup/planning';

type Item = PlanInput['inventory'][number];

let seq = 0;
const item = (rootPath: string, over: Partial<Item> = {}): Item => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  kind: 'directory',
  rootPath,
  normalizedRootPath: rootPath.toLowerCase(),
  decision: 'approved',
  estimatedSizeBytes: null,
  ...over,
});

const rule = (path: string, scope: PlanRule['scope'] = 'exclude_subtree') => ({
  id: `10000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  scope,
  path,
  normalizedPath: path.toLowerCase(),
});

const plan = (inventory: Item[], over: Partial<PlanInput> = {}) =>
  planBackup({
    selection: {},
    inventory,
    rules: [],
    coveredIds: new Set(),
    priorDestRelPaths: new Map(),
    ...over,
  });

const statusOf = (result: ReturnType<typeof plan>, rootPath: string) =>
  result.items.find((i) => i.rootPath === rootPath);

describe('planBackup', () => {
  it('queues approved items and lists the others as not eligible', () => {
    const a = item('C:\\a');
    const r = item('C:\\r', { decision: 'rejected' });
    const p = item('C:\\p', { decision: 'pending' });

    const result = plan([a, r, p]);

    expect(result.items.map((i) => [i.rootPath, i.status])).toEqual([
      ['C:\\a', 'queued'],
    ]);
    expect(result.notEligible.map((n) => [n.rootPath, n.decision])).toEqual([
      ['C:\\r', 'rejected'],
      ['C:\\p', 'pending'],
    ]);
  });

  it('marks an approved item under an exclude_subtree rule excluded', () => {
    const result = plan([item('C:\\a\\b')], { rules: [rule('C:\\a')] });

    expect(result.items[0]).toMatchObject({
      status: 'excluded',
      statusReason: 'excluded_by_rule',
    });
  });

  it('ignores selective_only rules', () => {
    const result = plan([item('C:\\a')], {
      rules: [rule('C:\\a', 'selective_only')],
    });

    expect(result.items[0].status).toBe('queued');
  });

  it('skips an item nested in an approved directory of the job', () => {
    const outer = item('C:\\a');
    const inner = item('C:\\a\\b\\c', { kind: 'file' });

    const result = plan([inner, outer]);

    expect(statusOf(result, 'C:\\a')?.status).toBe('queued');
    expect(statusOf(result, 'C:\\a\\b\\c')).toMatchObject({
      status: 'skipped',
      statusReason: 'redundant_nested',
      coveredByInventoryItemId: outer.id,
      coveredByRootPath: 'C:\\a',
    });
  });

  it('points a deeply nested item at the nearest queued directory', () => {
    const a = item('C:\\a');
    const b = item('C:\\a\\b');
    const c = item('C:\\a\\b\\c');

    const result = plan([a, b, c]);

    expect(statusOf(result, 'C:\\a\\b')?.coveredByInventoryItemId).toBe(a.id);
    expect(statusOf(result, 'C:\\a\\b\\c')?.coveredByInventoryItemId).toBe(
      a.id,
    );
  });

  it('plans a nested item on its own when a rejected item separates it from the outer one', () => {
    const outer = item('C:\\a');
    const rejected = item('C:\\a\\r', { decision: 'rejected' });
    const inner = item('C:\\a\\r\\keep');

    const result = plan([outer, rejected, inner]);

    expect(statusOf(result, 'C:\\a\\r\\keep')?.status).toBe('queued');
    expect(statusOf(result, 'C:\\a')?.carveOuts).toEqual([
      { path: 'C:\\a\\r', reason: 'rejected_item', refId: rejected.id },
    ]);
  });

  it('does not treat a directory that is not copied as covering what is inside it', () => {
    const outer = item('C:\\a');
    const inner = item('C:\\a\\b');

    const result = plan([outer, inner], { coveredIds: new Set([outer.id]) });

    expect(statusOf(result, 'C:\\a')).toMatchObject({
      status: 'skipped',
      statusReason: 'already_covered',
    });
    expect(statusOf(result, 'C:\\a\\b')?.status).toBe('queued');
  });

  it('skips already covered items unless asked not to', () => {
    const a = item('C:\\a');

    expect(plan([a], { coveredIds: new Set([a.id]) }).items[0]).toMatchObject({
      status: 'skipped',
      statusReason: 'already_covered',
    });
    expect(
      plan([a], {
        coveredIds: new Set([a.id]),
        selection: { skipAlreadyCovered: false },
      }).items[0].status,
    ).toBe('queued');
  });

  it('records rejected nested items and exclusion rules as carve-outs, dropping redundant ones', () => {
    const outer = item('C:\\a');
    const r1 = item('C:\\a\\r1', { decision: 'rejected' });
    const r2 = item('C:\\a\\r1\\deep', { decision: 'rejected' });
    const elsewhere = item('C:\\z\\r', { decision: 'rejected' });
    const ex = rule('C:\\a\\cache');
    const above = rule('C:\\other');

    const result = plan([outer, r1, r2, elsewhere], { rules: [ex, above] });

    expect(statusOf(result, 'C:\\a')?.carveOuts).toEqual([
      { path: 'C:\\a\\cache', reason: 'exclusion_rule', refId: ex.id },
      { path: 'C:\\a\\r1', reason: 'rejected_item', refId: r1.id },
    ]);
  });

  it('gives a file item no carve-outs', () => {
    const result = plan([item('C:\\a.txt', { kind: 'file' })]);

    expect(result.items[0].carveOuts).toBeUndefined();
  });

  it('reuses the destination path of an earlier verified copy', () => {
    const a = item('C:\\Users\\Me');

    expect(plan([a]).items[0].destRelPath).toBe('C/Users/Me');
    expect(
      plan([a], { priorDestRelPaths: new Map([[a.id, 'C/users/me']]) }).items[0]
        .destRelPath,
    ).toBe('C/users/me');
  });

  it('applies the selection: ids, path prefix and kinds', () => {
    const a = item('C:\\a');
    const b = item('C:\\b', { kind: 'file' });
    const c = item('C:\\b\\c');

    expect(
      plan([a, b, c], { selection: { inventoryItemIds: [a.id] } }).items,
    ).toHaveLength(1);
    expect(
      plan([a, b, c], { selection: { pathPrefix: 'c:\\B' } }).items.map(
        (i) => i.rootPath,
      ),
    ).toEqual(['C:\\b', 'C:\\b\\c']);
    expect(
      plan([a, b, c], { selection: { kinds: ['file'] } }).items.map(
        (i) => i.rootPath,
      ),
    ).toEqual(['C:\\b']);
  });

  it('returns an empty plan for an empty inventory', () => {
    expect(plan([])).toEqual({ items: [], notEligible: [] });
  });
});

describe('toDestRelPath', () => {
  it.each([
    ['C:\\Users\\Me\\Pictures', 'C/Users/Me/Pictures'],
    ['C:\\', 'C'],
    ['D:\\x', 'D/x'],
    ['\\\\nas\\share\\a\\b', 'UNC/nas/share/a/b'],
  ])('%s -> %s', (input, expected) => {
    expect(toDestRelPath(input)).toBe(expected);
  });
});

describe('slugifySourceDirName', () => {
  it.each([
    ['alpha-centauri', 'alpha-centauri'],
    ['Alpha Centauri', 'alpha-centauri'],
    ['  --Win 11 / Desktop!  ', 'win-11-desktop'],
    ['..hidden', 'hidden'],
    ['日本語', 'source'],
    ['', 'source'],
  ])('%j -> %s', (input, expected) => {
    expect(slugifySourceDirName(input)).toBe(expected);
  });

  it('caps the length', () => {
    expect(slugifySourceDirName('a'.repeat(300))).toHaveLength(100);
  });
});

describe('destinationFolderWarning', () => {
  it('stays quiet when this source already used the folder', () => {
    expect(destinationFolderWarning('x', undefined, true)).toBeNull();
    expect(destinationFolderWarning('x', ['x'], true)).toBeNull();
  });

  it('says unknown when the destination reported no contents', () => {
    expect(destinationFolderWarning('x', undefined, false)?.code).toBe(
      'destination_folder_unknown',
    );
  });

  it('warns when the folder exists and not otherwise', () => {
    expect(destinationFolderWarning('x', ['x', 'y'], false)?.code).toBe(
      'destination_folder_exists',
    );
    expect(destinationFolderWarning('x', ['y'], false)).toBeNull();
  });
});

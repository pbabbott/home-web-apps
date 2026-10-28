import {
  BackupError,
  captureBackupEntryMetadata,
  claimNextBackupItem,
  completeBackupItem,
  completeBackupJobIfDone,
  createBackupJob,
  failBackupItem,
  getBackupCoverage,
  getBackupEntryCounts,
  listBackupEntries,
  markBackupEnumerationComplete,
  recordBackupEntryResult,
  transitionBackupJob,
  upsertBackupEntries,
  type BackupJobItem,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';
import {
  HUMAN,
  WORKER,
  cleanupBackupFixtures,
  makeDestination,
  makeInventoryItem,
  makeJob,
  makeSource,
  planned,
} from './fixtures/backup';

afterEach(cleanupBackupFixtures);

const claimOne = async (destinationId: string) => {
  const result = await claimNextBackupItem(db, {
    destinationId,
    workerId: WORKER.id,
    leaseSeconds: 300,
  });
  if (!('job' in result)) throw new Error(`nothing to claim: ${result.reason}`);

  return { item: result.item, claimToken: result.item.claimToken as string };
};

const verifyFileItem = async (item: BackupJobItem, claimToken: string) => {
  await upsertBackupEntries(db, item.id, {
    claimToken,
    entries: [
      { relPath: '', normalizedRelPath: '', entryType: 'file', sizeBytes: 3 },
    ],
  });
  const [entry] = await listBackupEntries(db, { jobItemId: item.id });
  await recordBackupEntryResult(db, entry.id, {
    claimToken,
    result: {
      status: 'verified',
      sha256: 'a'.repeat(64),
      destRelPath: 'test-source/C/data/file-0.txt',
    },
  });
  await markBackupEnumerationComplete(db, item.id, { claimToken });
  await completeBackupItem(db, item.id, { claimToken });
};

describe('entries', () => {
  it('upserts idempotently and never duplicates on a re-enumeration', async () => {
    const { destination } = await makeJob(1);
    const { item, claimToken } = await claimOne(destination.id);
    const entries = [
      {
        relPath: 'a.txt',
        normalizedRelPath: 'a.txt',
        entryType: 'file' as const,
      },
      {
        relPath: 'sub',
        normalizedRelPath: 'sub',
        entryType: 'directory' as const,
      },
      {
        relPath: 'sub\\b.txt',
        normalizedRelPath: 'sub\\b.txt',
        entryType: 'file' as const,
      },
    ];

    await upsertBackupEntries(db, item.id, { claimToken, entries });
    await upsertBackupEntries(db, item.id, { claimToken, entries });
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [...entries, ...entries],
    });

    const counts = await getBackupEntryCounts(db, item.id);
    expect(counts.pending).toBe(3);
  });

  it('keeps the first captured metadata through a retry and a re-enumeration', async () => {
    const { destination } = await makeJob(1);
    const { item, claimToken } = await claimOne(destination.id);
    const first = new Date('2019-01-02T03:04:05Z');
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [
        {
          relPath: '',
          normalizedRelPath: '',
          entryType: 'file',
          sizeBytes: 10,
        },
      ],
    });
    const [entry] = await listBackupEntries(db, { jobItemId: item.id });

    await captureBackupEntryMetadata(db, entry.id, {
      claimToken,
      metadata: {
        srcCreatedAt: first,
        srcAttributes: 'A',
        srcStreams: [{ name: ':Zone.Identifier:$DATA', size: 26 }],
        srcZoneIdentifier: 'z'.repeat(5000),
      },
    });
    await captureBackupEntryMetadata(db, entry.id, {
      claimToken,
      metadata: {
        srcCreatedAt: new Date('2030-01-01T00:00:00Z'),
        srcAttributes: 'AH',
        srcAccessedAt: new Date('2031-01-01T00:00:00Z'),
      },
    });
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [
        {
          relPath: '',
          normalizedRelPath: '',
          entryType: 'file',
          srcCreatedAt: new Date('2040-01-01T00:00:00Z'),
        },
      ],
    });

    const [after] = await listBackupEntries(db, { jobItemId: item.id });
    expect(after.srcCreatedAt).toEqual(first);
    expect(after.srcAttributes).toBe('A');
    expect(after.srcAccessedAt).toEqual(new Date('2031-01-01T00:00:00Z'));
    expect(after.srcStreams).toEqual([
      { name: ':Zone.Identifier:$DATA', size: 26 },
    ]);
    expect(after.srcZoneIdentifier).toHaveLength(4096);
  });

  it('leaves a verified entry untouched and makes a failed one pending again', async () => {
    const { destination } = await makeJob(1);
    const { item, claimToken } = await claimOne(destination.id);
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [
        {
          relPath: 'ok.txt',
          normalizedRelPath: 'ok.txt',
          entryType: 'file',
          sizeBytes: 1,
        },
        {
          relPath: 'bad.txt',
          normalizedRelPath: 'bad.txt',
          entryType: 'file',
          sizeBytes: 1,
        },
      ],
    });
    // Rows are written in path order, so look entries up by path, not position.
    const listed = await listBackupEntries(db, { jobItemId: item.id });
    const ok = listed.find((r) => r.relPath === 'ok.txt');
    const bad = listed.find((r) => r.relPath === 'bad.txt');
    await recordBackupEntryResult(db, ok.id, {
      claimToken,
      result: {
        status: 'verified',
        sha256: 'b'.repeat(64),
        destRelPath: 'x/ok.txt',
      },
    });
    await recordBackupEntryResult(db, bad.id, {
      claimToken,
      result: { status: 'failed', issueKind: 'read_failed', message: 'eof' },
    });

    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [
        {
          relPath: 'ok.txt',
          normalizedRelPath: 'ok.txt',
          entryType: 'file',
          sizeBytes: 99,
        },
        {
          relPath: 'bad.txt',
          normalizedRelPath: 'bad.txt',
          entryType: 'file',
          sizeBytes: 1,
        },
      ],
    });

    const rows = await listBackupEntries(db, { jobItemId: item.id });
    const byPath = new Map(rows.map((r) => [r.relPath, r]));
    expect(byPath.get('ok.txt')).toMatchObject({
      status: 'verified',
      sizeBytes: 1,
      sha256: 'b'.repeat(64),
    });
    expect(byPath.get('ok.txt')?.verifiedAt).not.toBeNull();
    expect(byPath.get('bad.txt')).toMatchObject({
      status: 'pending',
      issueKind: null,
      message: null,
    });
  });

  it('answers a repeated verified result and refuses to change a verified entry', async () => {
    const { destination } = await makeJob(1);
    const { item, claimToken } = await claimOne(destination.id);
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [{ relPath: '', normalizedRelPath: '', entryType: 'file' }],
    });
    const [entry] = await listBackupEntries(db, { jobItemId: item.id });
    const verified = {
      status: 'verified' as const,
      sha256: 'c'.repeat(64),
      destRelPath: 'x/a',
    };

    const first = await recordBackupEntryResult(db, entry.id, {
      claimToken,
      result: verified,
    });
    const again = await recordBackupEntryResult(db, entry.id, {
      claimToken,
      result: verified,
    });

    expect(again.verifiedAt).toEqual(first.verifiedAt);
    await expect(
      recordBackupEntryResult(db, entry.id, {
        claimToken,
        result: { status: 'failed', issueKind: 'read_failed' },
      }),
    ).rejects.toBeInstanceOf(BackupError);
  });

  it('refuses entry writes without the live claim', async () => {
    const { destination, job } = await makeJob(1);
    const { item, claimToken } = await claimOne(destination.id);
    await transitionBackupJob(db, job.id, 'cancelled', HUMAN);

    await expect(
      upsertBackupEntries(db, item.id, {
        claimToken,
        entries: [{ relPath: '', normalizedRelPath: '', entryType: 'file' }],
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      upsertBackupEntries(db, item.id, {
        claimToken: '00000000-0000-4000-8000-000000000000',
        entries: [],
      }),
    ).rejects.toBeInstanceOf(BackupError);
  });

  it('pages entries by id and filters by status', async () => {
    const { destination } = await makeJob(1);
    const { item, claimToken } = await claimOne(destination.id);
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: ['c', 'a', 'b'].map((n) => ({
        relPath: n,
        normalizedRelPath: n,
        entryType: 'file' as const,
      })),
    });

    const page1 = await listBackupEntries(db, { jobItemId: item.id, limit: 2 });
    const page2 = await listBackupEntries(db, {
      jobItemId: item.id,
      limit: 2,
      after: page1[1].id,
    });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(1);
    expect(
      await listBackupEntries(db, { jobItemId: item.id, status: 'verified' }),
    ).toHaveLength(0);
  });
});

describe('coverage', () => {
  it('covers an item only at the destination where it verified', async () => {
    const { sourceId, destination: a } = await makeJob(1);
    const b = await makeDestination();
    const { item, claimToken } = await claimOne(a.id);
    await verifyFileItem(item, claimToken);

    const atA = await getBackupCoverage(db, { sourceId, destinationId: a.id });
    const atB = await getBackupCoverage(db, { sourceId, destinationId: b.id });

    expect(atA.counts.covered).toBe(1);
    expect(atA.allAccounted).toBe(true);
    expect(atB.counts.never_attempted).toBe(1);
    expect(atB.allAccounted).toBe(false);
  });

  it('keeps an item covered after a later job fails it, and reports the latest attempt', async () => {
    const { sourceId, destination, job, inventory } = await makeJob(1);
    const { item, claimToken } = await claimOne(destination.id);
    await verifyFileItem(item, claimToken);
    await completeBackupJobIfDone(db, job.id, WORKER);

    const second = await createBackupJob(
      db,
      {
        sourceId,
        destinationId: destination.id,
        selection: { skipAlreadyCovered: false },
        sourceDirName: 'test-source',
        items: inventory.map((i) => planned(i)),
      },
      HUMAN,
    );
    const retry = await claimOne(destination.id);
    await failBackupItem(db, retry.item.id, {
      claimToken: retry.claimToken,
      error: 'write_failed',
      kind: 'permanent',
    });

    const report = await getBackupCoverage(db, {
      sourceId,
      destinationId: destination.id,
    });

    expect(report.counts.covered).toBe(1);
    expect(report.items[0].latestAttempt).toMatchObject({
      jobId: second.id,
      itemStatus: 'blocked',
    });
  });

  it('buckets every inventory item exactly once', async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    const queued = await makeInventoryItem(sourceId, 'C:\\b\\queued.txt');
    const failed = await makeInventoryItem(sourceId, 'C:\\b\\failed.txt');
    const untouched = await makeInventoryItem(sourceId, 'C:\\b\\untouched.txt');
    const excluded = await makeInventoryItem(sourceId, 'C:\\skip\\x.txt');
    await makeInventoryItem(sourceId, 'C:\\b\\rejected.txt', {
      decision: 'rejected',
    });
    await makeInventoryItem(sourceId, 'C:\\b\\undecided.txt', {
      decision: 'pending',
    });
    await db.$client.query(
      "insert into exclusion_rules (source_id, path, normalized_path, scope) values ($1, 'C:\\skip', 'c:\\skip', 'exclude_subtree')",
      [sourceId],
    );
    await createBackupJob(
      db,
      {
        sourceId,
        destinationId: destination.id,
        selection: {},
        sourceDirName: 'test-source',
        items: [
          planned(queued),
          planned(failed),
          planned(excluded, {
            status: 'excluded',
            statusReason: 'excluded_by_rule',
          }),
        ],
      },
      HUMAN,
    );
    // Fail one of the two queued items; the other stays pending.
    const claimedFailed = await claimOne(destination.id);
    expect(claimedFailed.item.normalizedRootPath).toBe('c:\\b\\failed.txt');
    await failBackupItem(db, claimedFailed.item.id, {
      claimToken: claimedFailed.claimToken,
      error: 'unlistable',
      kind: 'permanent',
    });

    const report = await getBackupCoverage(db, {
      sourceId,
      destinationId: destination.id,
    });

    const bucketOf = new Map(report.items.map((i) => [i.rootPath, i.bucket]));
    expect(bucketOf.get(queued.rootPath)).toBe('pending');
    expect(bucketOf.get(failed.rootPath)).toBe('blocked');
    expect(bucketOf.get(untouched.rootPath)).toBe('never_attempted');
    expect(bucketOf.get(excluded.rootPath)).toBe('excluded_rule');
    expect(bucketOf.get('C:\\b\\rejected.txt')).toBe('rejected');
    expect(bucketOf.get('C:\\b\\undecided.txt')).toBe('undecided');
    expect(report.total).toBe(6);
    expect(Object.values(report.counts).reduce((a, n) => a + n, 0)).toBe(6);
    expect(report.allAccounted).toBe(false);
    expect(
      (
        await getBackupCoverage(db, {
          sourceId,
          destinationId: destination.id,
          bucket: 'rejected',
        })
      ).items,
    ).toHaveLength(1);
  });

  it('covers a nested item through the item that verified its path', async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    const dir = await makeInventoryItem(sourceId, 'C:\\proj', {
      kind: 'directory',
    });
    const nested = await makeInventoryItem(sourceId, 'C:\\proj\\docs\\a.txt');
    const unseen = await makeInventoryItem(sourceId, 'C:\\proj\\docs\\b.txt');
    const job = await createBackupJob(
      db,
      {
        sourceId,
        destinationId: destination.id,
        selection: {},
        sourceDirName: 'test-source',
        items: [
          planned(dir),
          planned(nested, {
            status: 'skipped',
            statusReason: 'redundant_nested',
            coveredByInventoryItemId: dir.id,
          }),
          planned(unseen, {
            status: 'skipped',
            statusReason: 'redundant_nested',
            coveredByInventoryItemId: dir.id,
          }),
        ],
      },
      HUMAN,
    );

    const before = await getBackupCoverage(db, {
      sourceId,
      destinationId: destination.id,
    });
    expect(before.counts.pending).toBe(3);

    const { item, claimToken } = await claimOne(destination.id);
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [
        { relPath: '', normalizedRelPath: '', entryType: 'directory' },
        { relPath: 'docs', normalizedRelPath: 'docs', entryType: 'directory' },
        {
          relPath: 'docs\\a.txt',
          normalizedRelPath: 'docs\\a.txt',
          entryType: 'file',
        },
      ],
    });
    for (const entry of await listBackupEntries(db, { jobItemId: item.id })) {
      await recordBackupEntryResult(db, entry.id, {
        claimToken,
        result: {
          status: 'verified',
          sha256: entry.entryType === 'file' ? 'd'.repeat(64) : null,
          destRelPath: `test-source/C/proj/${entry.relPath}`,
        },
      });
    }
    await markBackupEnumerationComplete(db, item.id, { claimToken });
    await completeBackupItem(db, item.id, { claimToken });
    await completeBackupJobIfDone(db, job.id, WORKER);

    const after = await getBackupCoverage(db, {
      sourceId,
      destinationId: destination.id,
    });
    const bucketOf = new Map(after.items.map((i) => [i.rootPath, i.bucket]));

    expect(bucketOf.get('C:\\proj')).toBe('covered');
    expect(bucketOf.get('C:\\proj\\docs\\a.txt')).toBe('redundant_covered');
    expect(bucketOf.get('C:\\proj\\docs\\b.txt')).toBe('never_attempted');
    expect(after.allAccounted).toBe(false);
  });
});

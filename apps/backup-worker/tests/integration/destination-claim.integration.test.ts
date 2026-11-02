import { randomUUID } from 'crypto';
import {
  claimBackupDestination,
  releaseBackupDestinationClaim,
  renewBackupDestinationClaim,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';

// The dev database may hold real destinations, so every claim here is pinned
// to a destination (or an export) this test created itself.
const exportPath = `/test-claim-${randomUUID()}`;
const mount = { server: '10.255.255.1', exportPath };
const ids: string[] = [];
const hostName = `claim-test-host-${randomUUID()}`;
let hostId: string;

const create = async (name: string, path = exportPath): Promise<string> => {
  const { rows } = await db.$client.query(
    `insert into backup_destinations (name, host_id, connection_type, settings)
     values ($1, $2, 'nfs', $3) returning id`,
    [`${name}-${randomUUID()}`, hostId, { exportPath: path }],
  );
  ids.push(rows[0].id);

  return rows[0].id;
};

const lease = { leaseSeconds: 60 };

const claimRow = async (id: string) => {
  const { rows } = await db.$client.query(
    'select claimed_by, claimed_until > now() as live from backup_destinations where id = $1',
    [id],
  );

  return rows[0] as { claimed_by: string | null; live: boolean | null };
};

describe('claiming a destination', () => {
  beforeAll(async () => {
    const { rows } = await db.$client.query(
      'insert into hosts (name, ip_address) values ($1, $2) returning id',
      [hostName, mount.server],
    );
    hostId = rows[0].id;
  });

  afterAll(async () => {
    await db.$client.query('delete from hosts where id = $1', [hostId]);
  });

  afterEach(async () => {
    if (ids.length) {
      await db.$client.query(
        'delete from backup_destinations where id = any($1)',
        [ids.splice(0)],
      );
    }
  });

  it('takes the destination that is the mounted export, and holds it', async () => {
    const id = await create('mounted');
    await create('other-export', `${exportPath}-other`);

    const result = await claimBackupDestination(db, {
      workerId: 'w1',
      mount,
      ...lease,
    });

    expect('destination' in result && result.destination.id).toBe(id);
    expect(await claimRow(id)).toEqual({ claimed_by: 'w1', live: true });
  });

  it('refuses a second worker while the first holds it, and lets the first back in', async () => {
    const id = await create('held');

    await claimBackupDestination(db, { workerId: 'w1', mount, ...lease });

    expect(
      await claimBackupDestination(db, { workerId: 'w2', mount, ...lease }),
    ).toEqual({ reason: 'held_by_other' });

    const again = await claimBackupDestination(db, {
      workerId: 'w1',
      mount,
      ...lease,
    });

    expect('destination' in again && again.destination.id).toBe(id);
  });

  it('lets another worker take over an expired claim', async () => {
    const id = await create('expired');
    await claimBackupDestination(db, { workerId: 'w1', mount, ...lease });
    await db.$client.query(
      "update backup_destinations set claimed_until = now() - interval '1 second' where id = $1",
      [id],
    );

    const result = await claimBackupDestination(db, {
      workerId: 'w2',
      mount,
      ...lease,
    });

    expect('destination' in result && result.destination.id).toBe(id);
    expect((await claimRow(id)).claimed_by).toBe('w2');
  });

  it('cannot renew a claim it lost, and renews one it holds', async () => {
    const id = await create('renew');
    await claimBackupDestination(db, { workerId: 'w1', mount, ...lease });

    expect(
      await renewBackupDestinationClaim(db, id, { workerId: 'w2', ...lease }),
    ).toBe(false);
    expect(
      await renewBackupDestinationClaim(db, id, { workerId: 'w1', ...lease }),
    ).toBe(true);
  });

  it('frees the destination on release, and only for the holder', async () => {
    const id = await create('release');
    await claimBackupDestination(db, { workerId: 'w1', mount, ...lease });

    await releaseBackupDestinationClaim(db, id, 'w2');
    expect((await claimRow(id)).claimed_by).toBe('w1');

    await releaseBackupDestinationClaim(db, id, 'w1');
    expect(await claimRow(id)).toEqual({ claimed_by: null, live: null });
  });

  it('serves a pinned destination whatever is mounted', async () => {
    const id = await create('pinned');

    const result = await claimBackupDestination(db, {
      workerId: 'w1',
      destinationId: id,
      mount: { server: 'elsewhere', exportPath: '/x' },
      ...lease,
    });

    expect('destination' in result && result.destination.id).toBe(id);
  });

  it('serves nothing when no destination is that export', async () => {
    await create('unrelated', `${exportPath}-unrelated`);

    expect(
      await claimBackupDestination(db, { workerId: 'w1', mount, ...lease }),
    ).toEqual({ reason: 'no_match' });
  });

  it('lets two workers starting together take only one destination between them', async () => {
    await create('race');

    const results = await Promise.all(
      ['w1', 'w2', 'w3'].map((workerId) =>
        claimBackupDestination(db, { workerId, mount, ...lease }),
      ),
    );

    expect(results.filter((r) => 'destination' in r)).toHaveLength(1);
  });
});

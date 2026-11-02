import { BackupError } from '@abbottland/homelab-db';
import { ConnectionError } from '@abbottland/source-access';
import { classifyAbandon } from '../../src/copy/abandon-policy';
import {
  ClaimLostError,
  DestinationUnhealthyError,
  FaultInjectedError,
  ShutdownError,
  SourceUnreachableError,
} from '../../src/copy/errors';

describe('classifyAbandon', () => {
  const cases: [
    string,
    unknown,
    boolean,
    ReturnType<typeof classifyAbandon>,
  ][] = [
    [
      'a test crash',
      new FaultInjectedError('item:start'),
      false,
      { action: 'rethrow' },
    ],
    [
      'shutdown',
      new ShutdownError(),
      false,
      { action: 'release', removeStaging: true, reason: 'shutdown' },
    ],
    [
      'a lost claim',
      new ClaimLostError(),
      false,
      { action: 'leave', removeStaging: true, reason: 'claim_lost' },
    ],
    [
      'a conflict from the query layer',
      new BackupError('conflict', 'cancelled'),
      false,
      { action: 'leave', removeStaging: true, reason: 'claim_lost' },
    ],
    [
      'an unhealthy destination',
      new DestinationUnhealthyError('write', 'EIO', 'i/o error'),
      false,
      {
        action: 'release',
        removeStaging: false,
        pause: 'destination',
        reason: 'destination_unhealthy',
      },
    ],
    [
      'an unreachable source that stays silent',
      new SourceUnreachableError('timed out'),
      false,
      {
        action: 'release',
        removeStaging: false,
        pause: 'source',
        reason: 'source_unreachable',
      },
    ],
    [
      'a connection error reporting unreachable, source silent',
      new ConnectionError('unreachable', 'no route'),
      false,
      {
        action: 'release',
        removeStaging: false,
        pause: 'source',
        reason: 'source_unreachable',
      },
    ],
    [
      'an outage report from a source that answers',
      new SourceUnreachableError('timed out'),
      true,
      {
        action: 'fail',
        removeStaging: false,
        note: 'the source answers a connection test, so this attempt counts',
        reason: 'error',
      },
    ],
    [
      'any other error',
      new Error('boom'),
      false,
      { action: 'fail', removeStaging: false, reason: 'error' },
    ],
    [
      'a source answering does not matter for other errors',
      new Error('boom'),
      true,
      { action: 'fail', removeStaging: false, reason: 'error' },
    ],
  ];

  it.each(cases)('%s', (_name, err, sourceAnswers, expected) => {
    expect(classifyAbandon(err, { sourceAnswers })).toEqual(expected);
  });
});

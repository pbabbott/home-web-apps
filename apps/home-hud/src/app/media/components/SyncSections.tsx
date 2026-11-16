import type { SyncStatus } from '../lib/gluetun-sync-api';
import { formatRunTime } from '../lib/display';
import { BAD_CLASS, OK_CLASS, Row, Section } from './Section';
import { TimeValue } from './TimeValue';

interface SyncSectionsProps {
  /** Null when gluetun-sync could not be reached. */
  status: SyncStatus | null;
}

function attemptLabel(status: SyncStatus): string {
  if (status.mostRecentAttemptSuccessful === undefined) return '—';
  return status.mostRecentAttemptSuccessful ? 'Success' : 'Failed';
}

export function SyncSections({ status }: SyncSectionsProps) {
  const available = status !== null;
  const s = status ?? {};
  const ranFor = formatRunTime(s.lastCronStart, s.lastCronEnd);

  return (
    <>
      <Section title="Most Recent Sync Attempt" available={available}>
        <Row
          label="Status"
          className={
            s.mostRecentAttemptSuccessful === undefined
              ? undefined
              : s.mostRecentAttemptSuccessful
                ? OK_CLASS
                : BAD_CLASS
          }
        >
          {attemptLabel(s)}
        </Row>
        <Row label="Source">{s.lastAttemptBy ?? '—'}</Row>
        <Row label="Time">
          <TimeValue iso={s.lastAttempt} />
        </Row>
      </Section>

      <Section title="Most Recent Cron Run" available={available}>
        <Row label="Cron Start">
          <TimeValue iso={s.lastCronStart} />
        </Row>
        <Row label="Cron End">
          <TimeValue iso={s.lastCronEnd} />
          {ranFor !== '—' && (
            <>
              <br />
              Ran for {ranFor}
            </>
          )}
        </Row>
      </Section>

      <Section title="Cron" available={available}>
        <Row label="Cron Schedule">{s.cronExpression ?? '—'}</Row>
        <Row label="Human readable">{s.cronDescription ?? '—'}</Row>
      </Section>

      <Section title="Last Failure" available={available}>
        <Row label="Time">
          <TimeValue iso={s.lastFailure} />
        </Row>
        <Row label="Error">{s.lastFailureMessage ?? '—'}</Row>
      </Section>
    </>
  );
}

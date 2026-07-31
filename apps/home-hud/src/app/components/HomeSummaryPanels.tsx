import Link from 'next/link';
import {
  Badge,
  type BadgeColor,
  Panel,
  SegmentedProgressBar,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import type { AiStatus, VideoJob, VideoJobStatus } from '../jobs/lib/video-api';
import type { TitleCard } from '../title-cards/lib/video-api';
import type {
  FileRename,
  FileRenameStatus,
} from '../file-renames/lib/video-api';

const jobStatusColor: Record<VideoJobStatus, BadgeColor> = {
  pending: 'warning',
  processing: 'secondary',
  completed: 'success',
  failed: 'error',
};

const JOB_STATUSES: VideoJobStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

const operationLabels: Record<string, string> = {
  paw_patrol_title_cards: 'Title Cards',
  paw_patrol_file_suggestions: 'File Suggestions',
  paw_patrol_apply_file_renames: 'Apply Renames',
};

const fileRenameStatusColor: Record<FileRenameStatus, BadgeColor> = {
  pending: 'warning',
  applied: 'success',
  rejected: 'error',
};

const FILE_RENAME_STATUSES: FileRenameStatus[] = [
  'pending',
  'applied',
  'rejected',
];

const FIRST_SEASON = 1;
const LAST_SEASON = 13;

/** Pulls the season number out of a `<Show>/Season <N>/<file>` path. */
function extractSeasonNumber(filePath: string): number | null {
  const match = filePath.match(/Season (\d+)/);
  return match ? Number(match[1]) : null;
}

// Fixed locale/timeZone so server and client render identical text — a
// locale-dependent format (e.g. toLocaleString()) mismatches across the
// SSR/hydration boundary whenever the server and browser timezones differ.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function mostRecentBy<T extends { createdAt: string }>(
  items: T[] | null,
): T | null {
  if (!items || items.length === 0) return null;
  return items.reduce((latest, item) =>
    new Date(item.createdAt) > new Date(latest.createdAt) ? item : latest,
  );
}

interface HomeSummaryPanelsProps {
  jobs: VideoJob[] | null;
  aiStatus: AiStatus | null;
  titleCards: TitleCard[] | null;
  fileRenames: FileRename[] | null;
}

export function HomeSummaryPanels({
  jobs,
  aiStatus,
  titleCards,
  fileRenames,
}: HomeSummaryPanelsProps) {
  const totalJobs = jobs?.length ?? 0;
  const jobCounts = Object.fromEntries(
    JOB_STATUSES.map((status) => [
      status,
      jobs?.filter((job) => job.status === status).length ?? 0,
    ]),
  ) as Record<VideoJobStatus, number>;
  const mostRecentJob = mostRecentBy(jobs);

  const totalTitleCards = titleCards?.length ?? 0;
  const seasonsCovered = new Set(
    (titleCards ?? [])
      .map((titleCard) => extractSeasonNumber(titleCard.filePath))
      .filter((season): season is number => season !== null),
  );
  const highestSeasonCovered = seasonsCovered.size
    ? Math.max(...seasonsCovered)
    : 0;
  const identifiedCount =
    titleCards?.filter((titleCard) => titleCard.title !== null).length ?? 0;
  const mostRecentTitleCard = mostRecentBy(titleCards);

  const totalFileRenames = fileRenames?.length ?? 0;
  const fileRenameCounts = Object.fromEntries(
    FILE_RENAME_STATUSES.map((status) => [
      status,
      fileRenames?.filter((fileRename) => fileRename.status === status)
        .length ?? 0,
    ]),
  ) as Record<FileRenameStatus, number>;
  const mostRecentFileRename = mostRecentBy(fileRenames);

  const aiOnline = aiStatus?.online ?? false;

  return (
    <div className="flex flex-col gap-6">
      <TransparentPanel
        color="dark"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <Typography variant="h6" component="h2" className="text-neutral-400">
          System Status
        </Typography>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge color={aiOnline ? 'success' : 'error'}>
              AI Server:{' '}
              {aiStatus === null ? 'Unknown' : aiOnline ? 'Online' : 'Offline'}
            </Badge>
            {aiStatus?.online && aiStatus.models.length > 0 && (
              <Badge color="dark">
                {aiStatus.models.length} model
                {aiStatus.models.length === 1 ? '' : 's'} loaded
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Badge color="dark">{totalJobs} jobs</Badge>
            <Badge color="dark">{totalTitleCards} title cards</Badge>
            <Badge color="dark">{totalFileRenames} renames</Badge>
          </div>
        </div>
      </TransparentPanel>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Link href="/jobs" className="block">
          <Panel color="primary" className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <Typography variant="h5" component="h2">
                Video Jobs
              </Typography>
              <Typography variant="h3" component="span">
                {totalJobs}
              </Typography>
            </div>

            <div className="flex flex-wrap gap-2">
              {JOB_STATUSES.map((status) => (
                <Badge key={status} color={jobStatusColor[status]}>
                  {status}: {jobCounts[status]}
                </Badge>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-1 border-t border-neutral-50/20 pt-3">
              <Typography variant="small" className="text-neutral-300">
                Most Recent
              </Typography>
              {mostRecentJob ? (
                <>
                  <Typography variant="body2">
                    {operationLabels[mostRecentJob.operation] ??
                      mostRecentJob.operation}
                  </Typography>
                  <Typography variant="caption" className="text-neutral-300">
                    {formatDate(mostRecentJob.createdAt)}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" className="text-neutral-300">
                  No jobs yet
                </Typography>
              )}
            </div>
          </Panel>
        </Link>

        <Link href="/title-cards" className="block">
          <Panel color="secondary" className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <Typography variant="h5" component="h2">
                Title Cards
              </Typography>
              <Typography variant="h3" component="span">
                {totalTitleCards}
              </Typography>
            </div>

            <Typography variant="caption" className="text-neutral-200">
              {identifiedCount} of {totalTitleCards} identified
            </Typography>

            <SegmentedProgressBar
              totalSegments={LAST_SEASON - FIRST_SEASON + 1}
              currentIndex={highestSeasonCovered}
              showLabel
              labelText="Season Coverage"
              showIndex
            />

            <div className="mt-auto flex flex-col gap-1 border-t border-neutral-50/20 pt-3">
              <Typography variant="small" className="text-neutral-300">
                Most Recent
              </Typography>
              {mostRecentTitleCard ? (
                <>
                  <Typography variant="body2">
                    {mostRecentTitleCard.title ?? 'No title detected'}
                  </Typography>
                  <Typography variant="caption" className="text-neutral-300">
                    {formatDate(mostRecentTitleCard.createdAt)}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" className="text-neutral-300">
                  No title cards yet
                </Typography>
              )}
            </div>
          </Panel>
        </Link>

        <Link href="/file-renames" className="block">
          <Panel color="accent-falcon" className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <Typography variant="h5" component="h2">
                File Renames
              </Typography>
              <Typography variant="h3" component="span">
                {totalFileRenames}
              </Typography>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILE_RENAME_STATUSES.map((status) => (
                <Badge key={status} color={fileRenameStatusColor[status]}>
                  {status}: {fileRenameCounts[status]}
                </Badge>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-1 border-t border-neutral-50/20 pt-3">
              <Typography variant="small" className="text-neutral-300">
                Most Recent
              </Typography>
              {mostRecentFileRename ? (
                <>
                  <Typography variant="body2" className="truncate">
                    {mostRecentFileRename.originalFilePath}
                  </Typography>
                  <Typography variant="caption" className="text-neutral-300">
                    {formatDate(mostRecentFileRename.createdAt)}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" className="text-neutral-300">
                  No rename suggestions yet
                </Typography>
              )}
            </div>
          </Panel>
        </Link>
      </div>
    </div>
  );
}

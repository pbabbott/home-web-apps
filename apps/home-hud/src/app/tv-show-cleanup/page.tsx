import { TvShowCleanupClient } from './TvShowCleanupClient';
import { getFileRenames, getJobs } from './lib/video-api';

export default async function TvShowCleanupPage() {
  const [jobsResult, fileRenamesResult] = await Promise.allSettled([
    getJobs(),
    getFileRenames(),
  ]);

  if (jobsResult.status === 'rejected') {
    console.error('Failed to load jobs from video-api:', jobsResult.reason);
  }
  if (fileRenamesResult.status === 'rejected') {
    console.error(
      'Failed to load file-renames from video-api:',
      fileRenamesResult.reason,
    );
  }

  return (
    <TvShowCleanupClient
      jobs={jobsResult.status === 'fulfilled' ? jobsResult.value : null}
      fileRenames={
        fileRenamesResult.status === 'fulfilled'
          ? fileRenamesResult.value
          : null
      }
    />
  );
}

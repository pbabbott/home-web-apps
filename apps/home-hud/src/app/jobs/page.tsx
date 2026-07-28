import { JobsClient } from './JobsClient';
import { getJobs } from './lib/video-api';

export default async function JobsPage() {
  let jobs = null;

  try {
    jobs = await getJobs();
  } catch (err) {
    console.error('Failed to load jobs from video-api:', err);
  }

  return <JobsClient jobs={jobs} />;
}

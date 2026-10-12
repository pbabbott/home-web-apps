import { JobsClient } from './JobsClient';
import { getAiStatus, getJobs, type AiStatus } from './lib/video-api';
import { getSeries, type Series } from '../series/lib/video-api';

export default async function JobsPage() {
  let jobs = null;
  let aiStatus: AiStatus | null = null;
  let series: Series[] = [];

  try {
    jobs = await getJobs();
  } catch (err) {
    console.error('Failed to load jobs from video-api:', err);
  }

  try {
    aiStatus = await getAiStatus();
  } catch (err) {
    console.error('Failed to load AI status from video-api:', err);
  }

  try {
    series = await getSeries();
  } catch (err) {
    console.error('Failed to load series from video-api:', err);
  }

  return <JobsClient jobs={jobs} aiStatus={aiStatus} series={series} />;
}

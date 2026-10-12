import { HomeClient } from './HomeClient';
import {
  getAiStatus,
  getJobs,
  type AiStatus,
  type VideoJob,
} from './jobs/lib/video-api';
import { getFileRenames, type FileRename } from './file-renames/lib/video-api';
import { getSeries, type Series } from './series/lib/video-api';

export default async function Home() {
  let jobs: VideoJob[] | null = null;
  let aiStatus: AiStatus | null = null;
  let fileRenames: FileRename[] | null = null;
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
    fileRenames = await getFileRenames();
  } catch (err) {
    console.error('Failed to load file renames from video-api:', err);
  }

  try {
    series = await getSeries();
  } catch (err) {
    console.error('Failed to load series from video-api:', err);
  }

  return (
    <HomeClient
      jobs={jobs}
      aiStatus={aiStatus}
      fileRenames={fileRenames}
      series={series}
    />
  );
}

import { HomeClient } from './components/HomeClient';
import {
  getAiStatus,
  getJobs,
  type AiStatus,
  type VideoJob,
} from './jobs/lib/video-api';
import { getTitleCards, type TitleCard } from './title-cards/lib/video-api';
import { getFileRenames, type FileRename } from './file-renames/lib/video-api';

export default async function Home() {
  let jobs: VideoJob[] | null = null;
  let aiStatus: AiStatus | null = null;
  let titleCards: TitleCard[] | null = null;
  let fileRenames: FileRename[] | null = null;

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
    titleCards = await getTitleCards();
  } catch (err) {
    console.error('Failed to load title cards from video-api:', err);
  }

  try {
    fileRenames = await getFileRenames();
  } catch (err) {
    console.error('Failed to load file renames from video-api:', err);
  }

  return (
    <HomeClient
      jobs={jobs}
      aiStatus={aiStatus}
      titleCards={titleCards}
      fileRenames={fileRenames}
    />
  );
}

import { FileRenamesClient } from './FileRenamesClient';
import { getFileRenames } from './lib/video-api';

export default async function FileRenamesPage() {
  let fileRenames = null;

  try {
    fileRenames = await getFileRenames();
  } catch (err) {
    console.error('Failed to load file renames from video-api:', err);
  }

  return <FileRenamesClient fileRenames={fileRenames} />;
}

import { FileRenamesClient } from './FileRenamesClient';
import { getFileRenames } from './lib/video-api';
import { getSeries, type Series } from '../series/lib/video-api';

interface FileRenamesPageProps {
  searchParams: Promise<{ series?: string }>;
}

export default async function FileRenamesPage({
  searchParams,
}: FileRenamesPageProps) {
  const { series: seriesParam } = await searchParams;

  let fileRenames = null;
  let series: Series[] = [];

  try {
    fileRenames = await getFileRenames(seriesParam);
  } catch (err) {
    console.error('Failed to load file renames from video-api:', err);
  }

  try {
    series = await getSeries();
  } catch (err) {
    console.error('Failed to load series from video-api:', err);
  }

  return (
    <FileRenamesClient
      fileRenames={fileRenames}
      selectedSeries={seriesParam ?? null}
      series={series}
    />
  );
}

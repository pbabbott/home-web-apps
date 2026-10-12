'use client';

import { Typography } from '@abbottland/fui-components';
import type { AiStatus, VideoJob } from './jobs/lib/video-api';
import type { FileRename } from './file-renames/lib/video-api';
import type { Series } from './series/lib/video-api';
import { Footer } from '../components/Footer';
import { HomeSummaryPanels } from './HomeSummaryPanels';
import { SeriesList } from './SeriesList';

interface HomeClientProps {
  jobs: VideoJob[] | null;
  aiStatus: AiStatus | null;
  fileRenames: FileRename[] | null;
  series: Series[];
}

export function HomeClient({
  jobs,
  aiStatus,
  fileRenames,
  series,
}: HomeClientProps) {
  return (
    <main className="flex min-h-screen flex-col bg-neutral-800">
      <div className="flex flex-1 flex-col gap-10 px-8 py-10">
        <div className="flex flex-col items-center gap-4">
          <Typography variant="h1" component="h1">
            Video Processing
          </Typography>
        </div>

        <HomeSummaryPanels
          jobs={jobs}
          aiStatus={aiStatus}
          fileRenames={fileRenames}
        />

        <SeriesList series={series} />
      </div>
      <Footer />
    </main>
  );
}

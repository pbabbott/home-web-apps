import { redirect } from 'next/navigation';

interface JobsPageProps {
  searchParams: Promise<{ source?: string; attention?: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The all-sources job list was folded into each source's page. Keep old
 * bookmarks working: a `?source=<id>` lands on that source, anything else on
 * the sources list.
 */
export default async function ExodusJobsPage({ searchParams }: JobsPageProps) {
  const { source, attention } = await searchParams;

  if (source && UUID_PATTERN.test(source)) {
    redirect(
      attention === '1'
        ? `/exodus/sources/${source}?attention=1`
        : `/exodus/sources/${source}`,
    );
  }

  redirect('/exodus/sources');
}

import { notFound } from 'next/navigation';
import { JobDetailClient } from './JobDetailClient';
import { getJobById } from '../lib/video-api';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) notFound();

  return <JobDetailClient job={job} />;
}

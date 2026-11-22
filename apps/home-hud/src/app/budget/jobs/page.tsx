import { JobsClient } from './JobsClient';
import { getJobs } from '../lib/budget-api';

export default async function JobsPage() {
  let jobs = null;

  try {
    jobs = await getJobs();
  } catch (err) {
    console.error('Failed to load jobs from budget-api:', err);
  }

  return <JobsClient jobs={jobs} />;
}

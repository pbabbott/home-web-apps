import { versionRoute } from '@abbottland/next-middleware';

// Must be dynamic: IMAGE_TAG is the running pod's env, not a build-time value.
export const dynamic = 'force-dynamic';

export const GET = versionRoute;

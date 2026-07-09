const LOADER_SRC = '/api/analytics-loader';

export interface AnalyticsDiagnostics {
  websiteId: string | null;
  hostUrl: string | null;
  /** 'enabled' = loader redirected to the real umami script, 'disabled' = loader returned 204 (ENABLE_ANALYTICS !== 'true') */
  loaderStatus: 'enabled' | 'disabled' | 'unknown';
  /** window.umami defined = the tracking script actually executed */
  scriptLoaded: boolean;
}

export async function getAnalyticsDiagnostics(): Promise<AnalyticsDiagnostics> {
  const scriptTag = document.querySelector<HTMLScriptElement>(
    `script[src="${LOADER_SRC}"]`,
  );
  const websiteId = scriptTag?.getAttribute('data-website-id') ?? null;
  const hostUrl = scriptTag?.getAttribute('data-host-url') ?? null;
  const scriptLoaded =
    typeof (window as typeof window & { umami?: unknown }).umami !==
    'undefined';

  // A redirect response that fetch is told not to follow comes back opaque
  // (status 0, type 'opaqueredirect') rather than throwing — that opacity is
  // the only signal available cross-origin, but it's enough to distinguish
  // "redirected to the real script" (enabled) from "204 no content" (disabled).
  let loaderStatus: AnalyticsDiagnostics['loaderStatus'] = 'unknown';
  try {
    const res = await fetch(LOADER_SRC, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
    });
    loaderStatus = res.type === 'opaqueredirect' ? 'enabled' : 'disabled';
  } catch {
    loaderStatus = 'unknown';
  }

  return { websiteId, hostUrl, loaderStatus, scriptLoaded };
}

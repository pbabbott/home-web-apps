import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import type { V1Node, V1Pod } from '@kubernetes/client-node';

// Lazily constructed, memoized singleton. `loadFromDefault()` resolves
// either a local kubeconfig (dev) or the in-cluster ServiceAccount
// (deployed) — whichever is present at runtime. If neither is present we
// degrade gracefully (empty results) rather than crash the process, the
// same pattern apps/harbor-cleanup uses for its Kubernetes client.
let coreApi: CoreV1Api | null | undefined;

function getCoreApi(): CoreV1Api | null {
  if (coreApi !== undefined) return coreApi;

  try {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    coreApi = kc.makeApiClient(CoreV1Api);
    console.log('[k8s] Client initialised from default kubeconfig');
  } catch (err) {
    console.warn(
      '[k8s] Could not load kubeconfig — pod data will be empty:',
      err,
    );
    coreApi = null;
  }

  return coreApi;
}

export async function listPods(): Promise<V1Pod[]> {
  const client = getCoreApi();
  if (!client) return [];

  try {
    const res = await client.listPodForAllNamespaces();
    return res.body.items;
  } catch (err) {
    console.warn('[k8s] Failed to list pods:', err);
    return [];
  }
}

/** Used as a node-relative fallback when a pod has neither a resource limit nor a request. */
export async function listNodes(): Promise<V1Node[]> {
  const client = getCoreApi();
  if (!client) return [];

  try {
    const res = await client.listNode();
    return res.body.items;
  } catch (err) {
    console.warn('[k8s] Failed to list nodes:', err);
    return [];
  }
}

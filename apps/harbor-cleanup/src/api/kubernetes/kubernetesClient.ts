import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';

export class KubernetesClient {
  private coreApi: CoreV1Api | null = null;

  constructor() {
    try {
      const kc = new KubeConfig();
      kc.loadFromDefault();
      this.coreApi = kc.makeApiClient(CoreV1Api);
      console.log('[k8s] Client initialised from default kubeconfig');
    } catch (err) {
      console.warn(
        '[k8s] Could not load kubeconfig — deployed-image protection will be skipped:',
        err,
      );
    }
  }

  async getDeployedImageTags(registryHost: string): Promise<Set<string>> {
    if (!this.coreApi) return new Set();

    try {
      const res = await this.coreApi.listPodForAllNamespaces();
      const tags = new Set<string>();

      for (const pod of res.body.items) {
        const containers = [
          ...(pod.spec?.containers ?? []),
          ...(pod.spec?.initContainers ?? []),
        ];
        for (const container of containers) {
          const image = container.image ?? '';
          if (!image.startsWith(registryHost)) continue;

          const colonIdx = image.lastIndexOf(':');
          if (colonIdx !== -1) {
            tags.add(image.substring(colonIdx + 1));
          }
        }
      }

      console.log(
        `[k8s] Found ${tags.size} distinct image tag(s) currently deployed`,
      );
      return tags;
    } catch (err) {
      console.warn(
        '[k8s] Failed to list pods — deployed-image protection will be skipped:',
        err,
      );
      return new Set();
    }
  }
}

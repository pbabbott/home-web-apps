import {
  AppsV1Api,
  BatchV1Api,
  CoreV1Api,
  KubeConfig,
  V1Container,
  V1PodSpec,
} from '@kubernetes/client-node';
import { RequestThrottler } from '../throttle.js';

type PodSpecHolder = { spec?: V1PodSpec };

export class KubernetesClient {
  private coreApi: CoreV1Api | null = null;
  private appsApi: AppsV1Api | null = null;
  private batchApi: BatchV1Api | null = null;
  private readonly throttler = new RequestThrottler(200);

  constructor() {
    try {
      const kc = new KubeConfig();
      kc.loadFromDefault();
      this.coreApi = kc.makeApiClient(CoreV1Api);
      this.appsApi = kc.makeApiClient(AppsV1Api);
      this.batchApi = kc.makeApiClient(BatchV1Api);
      console.log('[k8s] Client initialised from default kubeconfig');
    } catch (err) {
      console.error('[k8s] Could not load kubeconfig:', err);
    }
  }

  /**
   * Returns every tag of an image from `registryHost` that is referenced by a
   * running pod OR by a workload template (Deployment, StatefulSet, DaemonSet,
   * CronJob, Job), so images of scaled-to-zero workloads and CronJobs between
   * runs are protected too.
   *
   * Throws on any failure. Callers must not delete anything without a
   * complete list, so there is deliberately no "skip protection" fallback.
   */
  async getDeployedImageTags(registryHost: string): Promise<Set<string>> {
    if (!this.coreApi || !this.appsApi || !this.batchApi) {
      throw new Error(
        'Kubernetes client unavailable: refusing to run cleanup without deployed-image protection',
      );
    }

    const tags = new Set<string>();
    const collect = (spec?: V1PodSpec) => {
      const containers: V1Container[] = [
        ...(spec?.containers ?? []),
        ...(spec?.initContainers ?? []),
      ];
      for (const container of containers) {
        const image = container.image ?? '';
        if (!image.startsWith(registryHost)) continue;
        const colonIdx = image.lastIndexOf(':');
        if (colonIdx !== -1) tags.add(image.substring(colonIdx + 1));
      }
    };
    const collectTemplates = (
      items: { spec?: { template?: PodSpecHolder } }[],
    ) => items.forEach((i) => collect(i.spec?.template?.spec));

    await this.throttler.wait();
    const pods = await this.coreApi.listPodForAllNamespaces();
    pods.body.items.forEach((pod) => collect(pod.spec));

    await this.throttler.wait();
    collectTemplates(
      (await this.appsApi.listDeploymentForAllNamespaces()).body.items,
    );
    await this.throttler.wait();
    collectTemplates(
      (await this.appsApi.listStatefulSetForAllNamespaces()).body.items,
    );
    await this.throttler.wait();
    collectTemplates(
      (await this.appsApi.listDaemonSetForAllNamespaces()).body.items,
    );
    await this.throttler.wait();
    collectTemplates(
      (await this.batchApi.listJobForAllNamespaces()).body.items,
    );
    await this.throttler.wait();
    (await this.batchApi.listCronJobForAllNamespaces()).body.items.forEach(
      (cj) => collect(cj.spec?.jobTemplate?.spec?.template?.spec),
    );

    console.log(
      `[k8s] Found ${tags.size} distinct image tag(s) in use (pods and workload templates)`,
    );
    return tags;
  }
}

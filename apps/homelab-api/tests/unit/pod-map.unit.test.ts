import type { V1Node, V1Pod } from '@kubernetes/client-node';
import {
  listNodes,
  listPods,
} from '../../src/api/kubernetes/kubernetes-client';
import { getPodCpuUsage, getPodMemoryUsage } from '../../src/api/prometheus';
import { buildPodMap } from '../../src/services/pod-map';

jest.mock('../../src/api/kubernetes/kubernetes-client', () => ({
  listPods: jest.fn(),
  listNodes: jest.fn(),
}));

jest.mock('../../src/api/prometheus', () => ({
  getPodCpuUsage: jest.fn(),
  getPodMemoryUsage: jest.fn(),
}));

function makePod(overrides: {
  namespace?: string;
  name?: string;
  nodeName?: string;
  ownerKind?: string;
  ownerName?: string;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
  restartCount?: number;
  phase?: string;
}): V1Pod {
  return {
    metadata: {
      namespace: overrides.namespace ?? 'default',
      name: overrides.name ?? 'pod-a',
      creationTimestamp: new Date(Date.now() - 60 * 60 * 1000),
      ownerReferences: overrides.ownerKind
        ? [
            {
              kind: overrides.ownerKind,
              name: overrides.ownerName ?? 'owner',
              apiVersion: 'apps/v1',
              uid: 'abc',
            },
          ]
        : undefined,
    },
    spec: {
      nodeName: overrides.nodeName ?? 'node-a',
      containers: [
        {
          name: 'main',
          resources: {
            requests: {
              ...(overrides.cpuRequest ? { cpu: overrides.cpuRequest } : {}),
              ...(overrides.memoryRequest
                ? { memory: overrides.memoryRequest }
                : {}),
            },
            limits: {
              ...(overrides.cpuLimit ? { cpu: overrides.cpuLimit } : {}),
              ...(overrides.memoryLimit
                ? { memory: overrides.memoryLimit }
                : {}),
            },
          },
        },
      ],
    },
    status: {
      phase: overrides.phase ?? 'Running',
      containerStatuses: [
        {
          name: 'main',
          restartCount: overrides.restartCount ?? 0,
        },
      ],
    },
  } as unknown as V1Pod;
}

function makeNode(name: string, cpu: string, memory: string): V1Node {
  return {
    metadata: { name },
    status: { allocatable: { cpu, memory } },
  } as unknown as V1Node;
}

describe('buildPodMap', () => {
  beforeEach(() => {
    (listNodes as jest.Mock).mockResolvedValue([
      makeNode('node-a', '4', '16Gi'),
    ]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('computes ratio = usage / limit and buckets status by threshold', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({
        name: 'healthy-pod',
        cpuLimit: '1',
      }),
      makePod({
        name: 'warning-pod',
        cpuLimit: '1',
      }),
      makePod({
        name: 'error-pod',
        cpuLimit: '1',
      }),
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(
      new Map([
        ['default/healthy-pod', 0.1],
        ['default/warning-pod', 0.75],
        ['default/error-pod', 0.95],
      ]),
    );
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('cpu');

    const byLabel = Object.fromEntries(
      result.items.map((item) => [item.label, item]),
    );
    expect(byLabel['healthy-pod'].status).toBe('healthy');
    expect(byLabel['warning-pod'].status).toBe('warning');
    expect(byLabel['error-pod'].status).toBe('error');
    expect(byLabel['error-pod'].metrics.cpu.ratio).toBeCloseTo(0.95);
  });

  it('falls back to request, then node-relative capacity, when limit is absent', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({ name: 'request-only', cpuRequest: '0.5' }),
      makePod({ name: 'no-declared-resources' }),
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(
      new Map([
        ['default/request-only', 0.45],
        ['default/no-declared-resources', 2], // node-a has 4 allocatable cores
      ]),
    );
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('cpu');
    const byLabel = Object.fromEntries(
      result.items.map((item) => [item.label, item]),
    );

    expect(byLabel['request-only'].metrics.cpu.ratio).toBeCloseTo(0.9);
    expect(byLabel['no-declared-resources'].metrics.cpu.ratio).toBeCloseTo(0.5);
  });

  it('reports unknown status when there is no usage data at all', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({ name: 'no-usage', cpuLimit: '1' }),
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(new Map());
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('cpu');

    expect(result.items[0].status).toBe('unknown');
    expect(result.items[0].metrics.cpu.ratio).toBeNull();
  });

  it('uses the worst of cpu/memory status when metric="both"', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({ name: 'mixed', cpuLimit: '1', memoryLimit: '1Gi' }),
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(
      new Map([['default/mixed', 0.1]]), // healthy
    );
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(
      new Map([['default/mixed', 0.95 * 1024 ** 3]]), // error
    );

    const result = await buildPodMap('both');

    expect(result.items[0].metrics.cpu.status).toBe('healthy');
    expect(result.items[0].metrics.memory.status).toBe('error');
    expect(result.items[0].status).toBe('error');
  });

  it('resolves a ReplicaSet owner to its Deployment name', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({
        name: 'blog-7495dbf5ff-znq59',
        ownerKind: 'ReplicaSet',
        ownerName: 'blog-7495dbf5ff',
      }),
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(new Map());
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('cpu');

    expect(result.items[0].workload).toEqual({
      kind: 'Deployment',
      name: 'blog',
    });
  });

  it('treats fewer than 10 restarts as always healthy, even for the worst pod', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({ name: 'low-a', restartCount: 1 }),
      makePod({ name: 'low-b', restartCount: 9 }),
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(new Map());
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('restarts');
    const byLabel = Object.fromEntries(
      result.items.map((item) => [item.label, item]),
    );

    expect(byLabel['low-a'].status).toBe('healthy');
    expect(byLabel['low-b'].status).toBe('healthy');
    expect(byLabel['low-b'].metrics.restarts).toEqual({
      count: 9,
      maxCount: 9,
      ratio: 1,
      status: 'healthy',
    });
  });

  it('scores restarts relative to the worst pod in the response once past the floor', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({ name: 'worst', restartCount: 20 }), // ratio 1.0 -> error
      makePod({ name: 'mid', restartCount: 15 }), // ratio 0.75 -> warning
      makePod({ name: 'over-floor-low-ratio', restartCount: 11 }), // ratio 0.55 -> healthy (below the 0.6 band, not the floor)
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(new Map());
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('restarts');
    const byLabel = Object.fromEntries(
      result.items.map((item) => [item.label, item]),
    );

    expect(byLabel['worst'].status).toBe('error');
    expect(byLabel['worst'].metrics.restarts.ratio).toBe(1);
    expect(byLabel['mid'].status).toBe('warning');
    expect(byLabel['over-floor-low-ratio'].status).toBe('healthy');
  });

  it('matches the real-world band split: >=0.6 of the worst pod is warning, >=0.9 is error', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({ name: 'worst', restartCount: 157 }), // ratio 1.000 -> error
      makePod({ name: 'near-worst', restartCount: 149 }), // ratio 0.949 -> error
      makePod({ name: 'still-high', restartCount: 144 }), // ratio 0.917 -> error
      makePod({ name: 'elevated', restartCount: 123 }), // ratio 0.783 -> warning
      makePod({ name: 'borderline', restartCount: 103 }), // ratio 0.656 -> warning
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(new Map());
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('restarts');
    const byLabel = Object.fromEntries(
      result.items.map((item) => [item.label, item.status]),
    );

    expect(byLabel).toEqual({
      worst: 'error',
      'near-worst': 'error',
      'still-high': 'error',
      elevated: 'warning',
      borderline: 'warning',
    });
  });

  it('uses restarts status for the overall item status when metric="restarts", ignoring cpu', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({
        name: 'low-restarts-high-cpu',
        restartCount: 2,
        cpuLimit: '1',
      }),
    ]);
    // cpu alone would be "error", but metric=restarts should ignore it.
    (getPodCpuUsage as jest.Mock).mockResolvedValue(
      new Map([['default/low-restarts-high-cpu', 0.95]]),
    );
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('restarts');

    expect(result.items[0].metrics.cpu.status).toBe('error');
    expect(result.items[0].status).toBe('healthy');
  });

  it('returns groups=null when no groupBy is given', async () => {
    (listPods as jest.Mock).mockResolvedValue([makePod({})]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(new Map());
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('cpu');

    expect(result.groups).toBeNull();
  });

  it('groups items by the requested dimension', async () => {
    (listPods as jest.Mock).mockResolvedValue([
      makePod({ name: 'a', namespace: 'blog' }),
      makePod({ name: 'b', namespace: 'blog' }),
      makePod({ name: 'c', namespace: 'video-api' }),
    ]);
    (getPodCpuUsage as jest.Mock).mockResolvedValue(new Map());
    (getPodMemoryUsage as jest.Mock).mockResolvedValue(new Map());

    const result = await buildPodMap('cpu', 'namespace');

    expect(result.groups).toEqual([
      {
        key: 'namespace:blog',
        label: 'blog',
        dimension: 'namespace',
        itemIds: ['blog/a', 'blog/b'],
      },
      {
        key: 'namespace:video-api',
        label: 'video-api',
        dimension: 'namespace',
        itemIds: ['video-api/c'],
      },
    ]);
  });
});

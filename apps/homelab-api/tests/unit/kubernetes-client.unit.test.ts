const mockListPodForAllNamespaces = jest.fn();
const mockListNode = jest.fn();
let shouldThrowOnLoad = false;

jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: () => {
      if (shouldThrowOnLoad) throw new Error('no kubeconfig available');
    },
    makeApiClient: () => ({
      listPodForAllNamespaces: mockListPodForAllNamespaces,
      listNode: mockListNode,
    }),
  })),
  CoreV1Api: class {},
}));

describe('kubernetes-client', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockListPodForAllNamespaces.mockReset();
    mockListNode.mockReset();
    shouldThrowOnLoad = false;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('returns pods from the default kubeconfig', async () => {
    mockListPodForAllNamespaces.mockResolvedValue({
      body: { items: [{ metadata: { name: 'a' } }] },
    });

    const { listPods } = await import(
      '../../src/api/kubernetes/kubernetes-client'
    );

    await expect(listPods()).resolves.toEqual([{ metadata: { name: 'a' } }]);
  });

  it('returns an empty array when no kubeconfig/ServiceAccount is available', async () => {
    shouldThrowOnLoad = true;

    const { listPods } = await import(
      '../../src/api/kubernetes/kubernetes-client'
    );

    await expect(listPods()).resolves.toEqual([]);
  });

  it('returns an empty array when the list call fails', async () => {
    mockListPodForAllNamespaces.mockRejectedValue(new Error('rbac denied'));

    const { listPods } = await import(
      '../../src/api/kubernetes/kubernetes-client'
    );

    await expect(listPods()).resolves.toEqual([]);
  });

  it('returns nodes from the default kubeconfig', async () => {
    mockListNode.mockResolvedValue({
      body: { items: [{ metadata: { name: 'node-a' } }] },
    });

    const { listNodes } = await import(
      '../../src/api/kubernetes/kubernetes-client'
    );

    await expect(listNodes()).resolves.toEqual([
      { metadata: { name: 'node-a' } },
    ]);
  });

  it('returns an empty array of nodes when no kubeconfig is available', async () => {
    shouldThrowOnLoad = true;

    const { listNodes } = await import(
      '../../src/api/kubernetes/kubernetes-client'
    );

    await expect(listNodes()).resolves.toEqual([]);
  });
});

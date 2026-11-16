const mockListPodForAllNamespaces = jest.fn();
const mockListNode = jest.fn();
const mockListNamespacedPod = jest.fn();
const mockReadNamespacedPodLog = jest.fn();
let shouldThrowOnLoad = false;

jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: () => {
      if (shouldThrowOnLoad) throw new Error('no kubeconfig available');
    },
    makeApiClient: () => ({
      listPodForAllNamespaces: mockListPodForAllNamespaces,
      listNode: mockListNode,
      listNamespacedPod: mockListNamespacedPod,
      readNamespacedPodLog: mockReadNamespacedPodLog,
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
    mockListNamespacedPod.mockReset();
    mockReadNamespacedPodLog.mockReset();
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

  describe('readPodLogByLabel', () => {
    it('reads the named container of the first running pod and drops blank lines', async () => {
      mockListNamespacedPod.mockResolvedValue({
        body: {
          items: [
            { metadata: { name: 'pending' }, status: { phase: 'Pending' } },
            { metadata: { name: 'live' }, status: { phase: 'Running' } },
          ],
        },
      });
      mockReadNamespacedPodLog.mockResolvedValue({ body: 'a\nb\n\n' });

      const { readPodLogByLabel } = await import(
        '../../src/api/kubernetes/kubernetes-client'
      );

      await expect(
        readPodLogByLabel('media', 'api=gluetun', 'gluetun-sync', 25),
      ).resolves.toEqual(['a', 'b']);
      expect(mockListNamespacedPod).toHaveBeenCalledWith(
        'media',
        undefined,
        undefined,
        undefined,
        undefined,
        'api=gluetun',
      );
      expect(mockReadNamespacedPodLog.mock.calls[0].slice(0, 3)).toEqual([
        'live',
        'media',
        'gluetun-sync',
      ]);
      expect(mockReadNamespacedPodLog.mock.calls[0][9]).toBe(25);
    });

    it('returns null when no pod is running', async () => {
      mockListNamespacedPod.mockResolvedValue({ body: { items: [] } });

      const { readPodLogByLabel } = await import(
        '../../src/api/kubernetes/kubernetes-client'
      );

      await expect(
        readPodLogByLabel('media', 'api=gluetun', 'gluetun-sync', 25),
      ).resolves.toBeNull();
      expect(mockReadNamespacedPodLog).not.toHaveBeenCalled();
    });

    it('returns null when no kubeconfig is available', async () => {
      shouldThrowOnLoad = true;

      const { readPodLogByLabel } = await import(
        '../../src/api/kubernetes/kubernetes-client'
      );

      await expect(
        readPodLogByLabel('media', 'api=gluetun', 'gluetun-sync', 25),
      ).resolves.toBeNull();
    });
  });
});

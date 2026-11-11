import { runCleanup } from '../../src/services/cleanupService';
import { config } from '../../src/config';

const mockListArtifacts = jest.fn();
const mockDeleteTag = jest.fn();
const mockGetPullRequest = jest.fn();
const mockListOpenPullRequests = jest.fn();
const mockGetDeployedImageTags = jest.fn();

jest.mock('../../src/api/harbor/harborClient', () => ({
  HarborClient: jest.fn().mockImplementation(() => ({
    listArtifacts: mockListArtifacts,
    deleteTag: mockDeleteTag,
  })),
}));
jest.mock('../../src/api/github/githubClient', () => ({
  GitHubClient: jest.fn().mockImplementation(() => ({
    getPullRequest: mockGetPullRequest,
    listOpenPullRequests: mockListOpenPullRequests,
  })),
}));
jest.mock('../../src/api/kubernetes/kubernetesClient', () => ({
  KubernetesClient: jest.fn().mockImplementation(() => ({
    getDeployedImageTags: mockGetDeployedImageTags,
  })),
}));
jest.mock('../../src/config', () => ({
  config: {
    harbor: { host: 'harbor.test', username: 'u', password: 'p' },
    gitHub: { token: 't', owner: 'o', repo: 'r' },
    cleanupRepositories: 'blog',
    prodKeepCount: 2,
    dryRun: false,
  },
}));

const artifacts = (...names: string[]) =>
  names.map((name, i) => ({ digest: `sha256:${i}`, tags: [{ name }] }));

const deletedTags = () => mockDeleteTag.mock.calls.map((c) => c[3]);

describe('runCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.dryRun = false;
    mockGetDeployedImageTags.mockResolvedValue(new Set<string>());
    mockListOpenPullRequests.mockResolvedValue([]);
    mockGetPullRequest.mockResolvedValue(null);
    mockDeleteTag.mockResolvedValue(undefined);
  });

  it('retains the newest prod tags across v1 and v2 and deletes older ones', async () => {
    mockListArtifacts.mockResolvedValue(
      artifacts(
        '20261110-00100-00250-aaaaaaa',
        '20261110-91-bbbbbbb',
        '20261109-88-ccccccc',
      ),
    );
    await runCleanup();
    expect(deletedTags()).toEqual(['20261109-88-ccccccc']);
  });

  it('never deletes latest, and keeps moving pr tag of an open PR', async () => {
    mockGetPullRequest.mockResolvedValue({
      state: 'open',
      headSha: 'abcdef1xx',
    });
    mockListArtifacts.mockResolvedValue(artifacts('latest', 'pr-248'));
    await runCleanup();
    expect(deletedTags()).toEqual([]);
  });

  it('deletes the moving pr tag once the PR is closed', async () => {
    mockGetPullRequest.mockResolvedValue({
      state: 'closed',
      headSha: 'abcdef1xx',
    });
    mockListArtifacts.mockResolvedValue(artifacts('pr-248'));
    await runCleanup();
    expect(deletedTags()).toEqual(['pr-248']);
  });

  it('keeps sha tags referenced by a v2 prod tag', async () => {
    mockListArtifacts.mockResolvedValue(
      artifacts('sha-abcdef1', '20261110-00091-00248-abcdef1'),
    );
    await runCleanup();
    expect(deletedTags()).toEqual([]);
  });

  it('does not delete deployed tags', async () => {
    mockGetDeployedImageTags.mockResolvedValue(new Set(['0.7.0']));
    mockListArtifacts.mockResolvedValue(artifacts('0.7.0', '0.6.0'));
    await runCleanup();
    expect(deletedTags()).toEqual(['0.6.0']);
  });

  it('deletes nothing in dry-run mode but reports what would go', async () => {
    config.dryRun = true;
    mockListArtifacts.mockResolvedValue(artifacts('0.6.0'));
    const result = await runCleanup();
    expect(mockDeleteTag).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.repositories[0].deleted).toEqual(['0.6.0']);
  });

  it('aborts without touching Harbor when the cluster cannot be read', async () => {
    mockGetDeployedImageTags.mockRejectedValue(new Error('forbidden'));
    await expect(runCleanup()).rejects.toThrow('forbidden');
    expect(mockListArtifacts).not.toHaveBeenCalled();
    expect(mockDeleteTag).not.toHaveBeenCalled();
  });
});

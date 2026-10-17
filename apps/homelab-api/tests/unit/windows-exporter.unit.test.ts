import { EXPORTERS } from '../../src/api/prometheus/exporters';
import {
  getWindowsCpuSeries,
  getWindowsDiskIoSeries,
  getWindowsDiskSpace,
  getWindowsMemorySeries,
  getWindowsTemperatureSeries,
  getWindowsUp,
} from '../../src/api/prometheus/windows-exporter';

jest.mock('../../src/config', () => ({
  config: {
    prometheusUrl: 'http://prom.local',
    prometheusQueryWindowSeconds: 300,
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const INSTANCE = '192.168.5.142:9182';

const vector = (result: unknown[]) => ({
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({
      status: 'success',
      data: { resultType: 'vector', result },
    }),
});

const matrix = (result: unknown[]) => ({
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({
      status: 'success',
      data: { resultType: 'matrix', result },
    }),
});

const queriesSent = () =>
  mockFetch.mock.calls.map(
    ([url]) => new URL(url as string).searchParams.get('query') as string,
  );

describe('windows-exporter queries', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keys up by instance using the windows-exporter job', async () => {
    mockFetch.mockResolvedValue(
      vector([{ metric: { instance: INSTANCE }, value: [0, '1'] }]),
    );

    const up = await getWindowsUp();

    expect(up.get(INSTANCE)).toBe(1);
    expect(queriesSent()[0]).toContain('job=~"windows-exporter.*"');
  });

  it('returns cpu series with `core` renamed to `cpu`', async () => {
    mockFetch.mockResolvedValue(
      matrix([{ metric: { core: '0,1' }, values: [[1, '0.25']] }]),
    );

    const [sample] = await getWindowsCpuSeries(INSTANCE, 0, 60, 30);

    expect(queriesSent()[0]).toContain('windows_cpu_time_total');
    expect(queriesSent()[0]).toContain(`instance="${INSTANCE}"`);
    expect(sample.metric).toEqual({ cpu: '0,1' });
    expect(sample.values).toEqual([{ t: 1, value: 0.25 }]);
  });

  it('tags memory used/free and issues no buffers/cached queries', async () => {
    mockFetch.mockResolvedValue(matrix([{ metric: {}, values: [[1, '5']] }]));

    const samples = await getWindowsMemorySeries(INSTANCE, 0, 60, 30);

    expect(samples.map((s) => s.metric.component).sort()).toEqual([
      'free',
      'used',
    ]);
    expect(queriesSent().join()).toContain(
      'windows_memory_physical_free_bytes',
    );
    expect(queriesSent().join()).not.toMatch(/buffers|cached/i);
  });

  it('returns disk io with `disk` renamed to `device`', async () => {
    mockFetch.mockResolvedValue(
      matrix([{ metric: { disk: '0 C:' }, values: [[1, '1']] }]),
    );

    const samples = await getWindowsDiskIoSeries(INSTANCE, 0, 60, 30);

    expect(samples.map((s) => s.metric.component).sort()).toEqual([
      'ioTime',
      'read',
      'written',
    ]);
    expect(samples.every((s) => s.metric.device === '0 C:')).toBe(true);
    expect(samples.every((s) => s.metric.disk === undefined)).toBe(true);
  });

  it('returns disk space with `volume` renamed to `mountpoint`', async () => {
    mockFetch.mockResolvedValue(
      vector([{ metric: { volume: 'C:' }, value: [0, '100'] }]),
    );

    const { size, avail } = await getWindowsDiskSpace(INSTANCE);

    expect(size[0].metric).toEqual({ mountpoint: 'C:' });
    expect(avail[0].metric).toEqual({ mountpoint: 'C:' });
  });

  it('maps thermal zone `name` to chip/sensor/label', async () => {
    mockFetch.mockResolvedValue(
      matrix([{ metric: { name: 'ACPI\\TZ0' }, values: [[1, '40']] }]),
    );

    const [sample] = await getWindowsTemperatureSeries(INSTANCE, 0, 60, 30);

    expect(sample.metric).toMatchObject({
      chip: 'ACPI\\TZ0',
      sensor: 'temp',
      label: 'ACPI\\TZ0',
    });
  });
});

describe('EXPORTERS registry', () => {
  it('has an implementation for every exporter type', () => {
    expect(Object.keys(EXPORTERS).sort()).toEqual([
      'node_exporter',
      'windows_exporter',
    ]);
  });
});

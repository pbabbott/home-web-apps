import { hostSelectSchema } from './hosts';

describe('hostSelectSchema', () => {
  it('accepts a realistic row shape', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'tf-prod-k8s-worker-1',
      hostType: 'virtual',
      exporterType: 'node_exporter',
      ipAddress: '192.168.6.25',
      instance: '192.168.6.25:9100',
      model3d: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('accepts null instance', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'room of requirement',
      hostType: 'physical',
      exporterType: 'node_exporter',
      ipAddress: '192.168.4.124',
      instance: null,
      model3d: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('accepts a model3d slug', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'room of requirement',
      hostType: 'physical',
      exporterType: 'node_exporter',
      ipAddress: '192.168.4.124',
      instance: null,
      model3d: 'nas',
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row missing name', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      hostType: 'physical',
      exporterType: 'node_exporter',
      ipAddress: '192.168.4.124',
      instance: null,
      model3d: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });

  it('accepts a windows_exporter host', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'ELDERWAND',
      hostType: 'physical',
      exporterType: 'windows_exporter',
      ipAddress: '192.168.5.142',
      instance: '192.168.5.142:9182',
      model3d: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid exporterType', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'ELDERWAND',
      hostType: 'physical',
      exporterType: 'imaginary',
      ipAddress: '192.168.5.142',
      instance: null,
      model3d: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid hostType', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'room of requirement',
      hostType: 'imaginary',
      ipAddress: '192.168.4.124',
      instance: null,
      model3d: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });
});

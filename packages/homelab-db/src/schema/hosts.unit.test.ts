import { hostSelectSchema } from './hosts';

describe('hostSelectSchema', () => {
  it('accepts a realistic row shape', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'tf-prod-k8s-worker-1',
      hostType: 'virtual',
      ipAddress: '192.168.6.25',
      instance: '192.168.6.25:9100',
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('accepts null instance', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'room of requirement',
      hostType: 'physical',
      ipAddress: '192.168.4.124',
      instance: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row missing name', () => {
    const result = hostSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      hostType: 'physical',
      ipAddress: '192.168.4.124',
      instance: null,
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
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });
});

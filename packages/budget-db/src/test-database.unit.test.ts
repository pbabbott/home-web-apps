import { assertTestDatabaseName } from './test-database';

describe('assertTestDatabaseName', () => {
  it('accepts *_test names', () => {
    expect(() => assertTestDatabaseName('budget_api_test')).not.toThrow();
    expect(() => assertTestDatabaseName('budget_worker_test')).not.toThrow();
  });

  it.each([
    'budget',
    'postgres',
    'budget_test_backup',
    'Budget_test',
    '_test',
    'x"; drop database budget; --_test',
  ])('refuses %s', (name) => {
    expect(() => assertTestDatabaseName(name)).toThrow(/Refusing/);
  });
});

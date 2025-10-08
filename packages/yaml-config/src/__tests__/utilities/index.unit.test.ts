import { camelToUpperCaseSnakeCase } from '../../lib/utilities/index';

describe('camelToSnakeCase', () => {
  it('Should handle a single word', () => {
    const sut = camelToUpperCaseSnakeCase('section');
    expect(sut).toBe('SECTION');
  });
  it('Should handle two words', () => {
    const sut = camelToUpperCaseSnakeCase('customString');
    expect(sut).toBe('CUSTOM_STRING');
  });
  it('Should handle three words', () => {
    const sut = camelToUpperCaseSnakeCase('oneCoolBoolean');
    expect(sut).toBe('ONE_COOL_BOOLEAN');
  });
});

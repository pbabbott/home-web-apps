import path from 'path';
import { fileExists } from '../lib/file';

describe('Check if file exists', () => {
  it('Should detect a file exists', async () => {
    const configPath = path.resolve('./src/fixtures/simple/index.yml');
    const sut = await fileExists(configPath);
    expect(sut).toBe(true);
  });
  it('Check if file does not exist', async () => {
    const configPath = path.resolve('./src/fixtures/does-not-exist.yml');
    const sut = await fileExists(configPath);
    expect(sut).toBe(false);
  });
});

import path from 'path';
import { loadConfig } from '../lib/config';

export class ProjectConfig {
  oneCoolBoolean: boolean = false;
  oneCoolNumber: number = 4321;
  oneCoolString: string = 'goodbye';
  section = new SectionConfig();
}

export class SectionConfig {
  oneCoolSubType: string = 'bingo';
  anotherCoolSubType: string = 'bango';
  oneMoreSubType: string = 'bongo';
}

const defaultConfig = new ProjectConfig();

describe('Load configuration from file and default', () => {
  let sut: ProjectConfig;

  beforeAll(async () => {
    const configPath = path.resolve('./src/fixtures/simple/index.yml');

    sut = await loadConfig(defaultConfig, configPath);
  });

  it('should parse boolean from file', () => {
    expect(sut.oneCoolBoolean).toEqual(true);
  });
  it('should parse number from file', () => {
    expect(sut.oneCoolNumber).toEqual(1234);
  });
  it('should parse string from file', () => {
    expect(sut.oneCoolString).toEqual('hello world');
  });
  it('should parse sub type 1 from file', () => {
    expect(sut.section.oneCoolSubType).toEqual('foo');
  });
  it('should parse sub type 2 from file', () => {
    expect(sut.section.anotherCoolSubType).toEqual('bar');
  });
  it('should parse sub type 3 from default', () => {
    expect(sut.section.oneMoreSubType).toEqual(
      defaultConfig.section.oneMoreSubType,
    );
  });
});

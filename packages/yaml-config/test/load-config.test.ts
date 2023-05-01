import path from 'path'
import { loadConfig } from 'src/lib/config'

export type ProjectConfig = {
    oneCoolBoolean: boolean
    oneCoolNumber: number
    oneCoolString: string
    config: SectionConfig
}

export type SectionConfig = {
    oneCoolSubType: string
    anotherCoolSubType: string
    oneMoreSubType: string
}

const defaultConfig: ProjectConfig = {
    oneCoolBoolean: false,
    oneCoolNumber: 4321,
    oneCoolString: 'goodbye',
    config: {
        oneCoolSubType: 'bingo',
        anotherCoolSubType: 'bango',
        oneMoreSubType: 'bongo'
    }
}

describe('Load configuration from file and default', () => {
    let sut: ProjectConfig

    beforeAll(async () => {
        const configPath = path.resolve('./packages/yaml-config/test/fixtures/simple.yml')
        sut = await loadConfig(configPath, defaultConfig)
    })

    it('should parse boolean from file', () => {
        expect(sut.oneCoolBoolean).toEqual(true);
    })
    it('should parse number from file', () => {
        expect(sut.oneCoolNumber).toEqual(1234);
    })
    it('should parse string from file', () => {
        expect(sut.oneCoolString).toEqual('hello world')
    })
    it('should parse sub type 1 from file', () => {
        expect(sut.config.oneCoolSubType).toEqual('foo')
    })
    it('should parse sub type 2 from file', () => {
        expect(sut.config.anotherCoolSubType).toEqual('bar')
    })
    it('should parse sub type 3 from default', () => {
        expect(sut.config.oneMoreSubType).toEqual(defaultConfig.config.oneMoreSubType)
    })
})
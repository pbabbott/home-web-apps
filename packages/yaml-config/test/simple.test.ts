import path from 'path'
import { parseConfig } from 'src/index'

export type ProjectConfig = {
    oneCoolBoolean: boolean
    oneCoolNumber: number
    oneCoolString: string
    config: SectionConfig
}

export type SectionConfig = {
    oneCoolSubType: string
    anotherCoolSubType: string
}

describe('A simple config file hydration', () => {
    let sut: ProjectConfig

    beforeAll(() => {
        const configPath = path.resolve('./packages/yaml-config/test/fixtures/simple.yml')
        sut = parseConfig<ProjectConfig>(configPath)
    })
    it('should parse boolean', () => {
        expect(sut.oneCoolBoolean).toEqual(true);
    })
    it('should parse number', () => {
        expect(sut.oneCoolNumber).toEqual(1234);
    })
    it('should parse string', () => {
        expect(sut.oneCoolString).toEqual('hello world')
    })
    it('should parse sub type 1', () => {
        expect(sut.config.oneCoolSubType).toEqual('foo')
    })
    it('should parse sub type 2', () => {
        expect(sut.config.anotherCoolSubType).toEqual('bar')
    })
})

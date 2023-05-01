import path from 'path'
import { parseConfig } from 'src/index'

export type ProjectConfig = {
    oneCoolBoolean: boolean
}

describe('A hydrate a type even if there is extra stuff in the yaml file', () => {
    let sut: ProjectConfig

    beforeAll(() => {
        const configPath = path.resolve('./packages/yaml-config/test/fixtures/simple.yml')
        sut = parseConfig<ProjectConfig>(configPath)
    })
    it('should parse boolean', () => {
        expect(sut.oneCoolBoolean).toEqual(true);
    })
})

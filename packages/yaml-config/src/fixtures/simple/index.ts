import { EnvironmentVariable, ConfigSection, EnvironmentVariableType } from '../../lib/decorators'

export class ProjectConfig {
    @EnvironmentVariable({ variableType: EnvironmentVariableType.BOOLEAN })
    oneCoolBoolean: boolean = false

    @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
    oneCoolNumber: number = 4321

    @EnvironmentVariable()
    oneCoolString: string = 'goodbye'

    @EnvironmentVariable({ variableName: "CUSTOM_CONFIG_VALUE" })
    customString: string = 'start'

    @ConfigSection()
    section = new SectionConfig()
}

export class SectionConfig {
    @EnvironmentVariable()
    oneCoolSubType: string = 'bingo'

    anotherCoolSubType: string = 'bango'

    @EnvironmentVariable()
    oneMoreSubType: string = 'bongo'

    @ConfigSection()
    details = new SubSectionConfig()
}

export class SubSectionConfig {
    @EnvironmentVariable()
    myProperty: string = 'complicated'
}

export const expectedData = {
    expectedNumber: 1234567890 as number,
    expectedString: 'the quick brown fox',
    subTypeString: 'override',
    expectedAnotherCoolSubTypeString: 'bazinga',
    expectedSubSubTypeString: 'easy',
    expectedCustomConfigString: 'stop'
}

export const setEnvironmentVariables = () => {
    process.env['ONE_COOL_NUMBER'] = `${expectedData.expectedNumber}`
    process.env['ONE_COOL_STRING'] = expectedData.expectedString

    process.env['CUSTOM_CONFIG_VALUE'] = expectedData.expectedCustomConfigString

    process.env['SECTION_ONE_COOL_SUB_TYPE'] = expectedData.subTypeString
    process.env['SECTION_ANOTHER_COOL_SUB_TYPE'] = expectedData.expectedAnotherCoolSubTypeString
    process.env['SECTION_DETAILS_MY_PROPERTY'] = expectedData.expectedSubSubTypeString
    
}
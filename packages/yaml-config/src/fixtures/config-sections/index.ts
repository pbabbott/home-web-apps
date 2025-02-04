/* eslint-disable turbo/no-undeclared-env-vars */
import {
  EnvironmentVariable,
  ConfigSection,
  AppConfig,
} from '../../lib/decorators';

@AppConfig({ appPrefix: 'YAML_CONFIG' })
export class ProjectConfig {
  @EnvironmentVariable()
  oneCoolString = 'hello';

  @ConfigSection({ sectionPrefix: 'LOGS' })
  logging = new LoggingConfig();

  @ConfigSection()
  weather = new WeatherConfig();
}

export class LoggingConfig {
  @EnvironmentVariable()
  apiKey = '';

  @EnvironmentVariable()
  level = 'debug';

  format = 'json';
}

export class WeatherConfig {
  @EnvironmentVariable()
  apiKey = '';

  desiredWeather = 'sunny';

  updateFrequency = 'weekly';
}

export const expectedData = {
  oneCoolString: 'AWESOME',
  loggingAPIKey: '62739cc6-2a48-44b9-81fd-8fc11e78cf31',
  loggingLevel: 'info',
  weatherAPIKey: 'und7q7njR94nnP2y',
};

export const setEnvironmentVariables = () => {
  process.env['YAML_CONFIG_ONE_COOL_STRING'] = expectedData.oneCoolString;
  process.env['YAML_CONFIG_LOGS_API_KEY'] = expectedData.loggingAPIKey;
  process.env['YAML_CONFIG_LOGS_LEVEL'] = expectedData.loggingLevel;
  process.env['YAML_CONFIG_WEATHER_API_KEY'] = expectedData.weatherAPIKey;
};

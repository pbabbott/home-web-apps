import { loadConfig } from '@home-web-apps/yaml-config';
import { defaultConfig, setConfig, config } from './config';
import { configureExpressApp } from './express';

const main = async () => {
  // Load configuration
  const config = await loadConfig(defaultConfig)
  setConfig(config)

  // Start the express app
  configureExpressApp()

  // Start monitoring directories via CRON
}

main()
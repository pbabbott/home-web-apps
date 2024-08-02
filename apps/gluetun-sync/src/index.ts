import 'reflect-metadata'
import { initConfig, validateConfig } from './config'
import { startServer } from "./server";
import { showPublicIp } from './services/publicIpService';
import { syncPorts } from './services/syncService';

const start = async () => {
  await initConfig()
  validateConfig();

  // TODO: move this to a route
  showPublicIp();
  startServer();

  const result = await syncPorts();
  console.log(`Success=${result.success} : ${result.validationMessage}`)
    
};

start();

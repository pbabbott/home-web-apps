import 'reflect-metadata'
import { initConfig, validateConfig } from './config'
import { startServer } from "./server";
import { showPublicIp } from './services/publicIpService';
import { getForwardedPort } from './api/gluetun/gluetun';
import { getApplicationPreferences, login } from './api/qbittorrent';

const start = async () => {
  await initConfig()
  validateConfig();

  showPublicIp();
  startServer();
  
  const gluetunPort = await getForwardedPort()
  console.log('gluetunPort', gluetunPort)

  const qbitTorrentLoginResult = await login()
  console.log('qbittorrent login', qbitTorrentLoginResult)

  if (qbitTorrentLoginResult !== null)
    await getApplicationPreferences(qbitTorrentLoginResult)
};

start();

import { Request, Response } from 'express';
import { exec } from 'child_process';

export const parseConfigFile = (stdout: string): { [key: string]: string } => {
  console.log('parsing config file');
  const config: { [key: string]: string } = {};
  const lines = stdout.split('\n');

  lines.forEach((line) => {
    if (line.includes('=')) {
      const equalIndex = line.indexOf('=');
      const key = line.substring(0, equalIndex);
      const value = line.substring(equalIndex + 1);
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    }
  });
  return config;
};

export const getStatus = async (_: Request, res: Response): Promise<void> => {
  const command = 'bash /dumbledore/bin/pironman -c';

  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error.message}`);
        res.status(500).json({ error: error.message });
        return resolve();
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        res.status(500).json({ error: stderr });
        return resolve();
      }
      console.log(`stdout: ${stdout}`);
      const config = parseConfigFile(stdout);
      res.json({ config });
      resolve();
    });
  });
};

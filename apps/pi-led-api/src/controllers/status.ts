import { Request, Response } from 'express';
import { exec } from 'child_process';

const parseConfigFile = (stdout: string) => {
  console.log('parsing config file');
  const config: { [key: string]: string } = {};
  const lines = stdout.split('\n');

  lines.forEach((line) => {
    if (line.includes('=')) {
      const [key, value] = line.split('=');
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    }
  });
  return config;
};

export const getStatus = async (_: Request, res: Response) => {
  const command = 'bash /dumbledore/bin/pironman -c';

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Exec error: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return res.status(500).json({ error: stderr });
    }
    console.log(`stdout: ${stdout}`);
    const config = parseConfigFile(stdout); // omit first 2 lines of stdout
    res.json({ config });
  });
};

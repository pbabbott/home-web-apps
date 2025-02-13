import { Request, Response } from 'express';
import { exec } from 'child_process';

export const postColor = async (req: Request, res: Response) => {
  const color = req.query.color;

  if (!color) {
    res.status(400).json({ error: 'color query param is required' });
  }

  const command = `bash /dumbledore/bin/pironman -rc ${color}`;

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
    res.json({ stdout });
  });
};

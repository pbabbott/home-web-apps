import { Request, Response } from 'express';
import { writeFile } from 'fs/promises';

export const postColor = async (req: Request, res: Response) => {
  const color = req.query.color;

  if (!color) {
    return res.status(400).json({ error: 'color query param is required' });
  }

  try {
    await writeFile('/pironman_monitor/color.txt', color as string, 'utf8');
    res.json({ message: 'Color written to file successfully' });
  } catch (error) {
    console.error(`File write error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

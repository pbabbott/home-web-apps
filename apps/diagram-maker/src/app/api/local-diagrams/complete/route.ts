import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { filePath, isComplete } = body as {
    filePath?: string;
    isComplete?: boolean;
  };
  if (typeof filePath !== 'string' || typeof isComplete !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing filePath or isComplete' },
      { status: 400 },
    );
  }

  const blogSrcDir = path.resolve(process.cwd(), '../blog/src');
  const fullPath = path.resolve(blogSrcDir, filePath);
  if (!fullPath.startsWith(blogSrcDir + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const raw = await readFile(fullPath, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  data.isComplete = isComplete;
  await writeFile(fullPath, JSON.stringify(data, null, 2) + '\n');

  return NextResponse.json({ success: true });
}

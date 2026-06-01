import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
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

  const { filePath, data } = body as { filePath?: string; data?: unknown };
  if (typeof filePath !== 'string' || !data) {
    return NextResponse.json(
      { error: 'Missing filePath or data' },
      { status: 400 },
    );
  }

  const blogSrcDir = path.resolve(process.cwd(), '../blog/src');
  const fullPath = path.resolve(blogSrcDir, filePath);
  if (!fullPath.startsWith(blogSrcDir + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  await writeFile(fullPath, JSON.stringify(data, null, 2) + '\n');
  return NextResponse.json({ success: true });
}

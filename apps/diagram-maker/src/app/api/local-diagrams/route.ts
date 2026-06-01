import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

interface LocalDiagram {
  label: string;
  filePath: string;
  blogPost: string;
  date: string;
  data: { nodes: unknown[]; edges: unknown[] };
}

async function readBlogPostDate(blogPostDir: string): Promise<string> {
  try {
    const mdx = await readFile(path.join(blogPostDir, 'index.mdx'), 'utf-8');
    const match = mdx.match(/^date:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/m);
    return match ? match[1] : '0000-00-00';
  } catch {
    return '0000-00-00';
  }
}

async function walkJsonFiles(
  dir: string,
  srcDir: string,
): Promise<LocalDiagram[]> {
  const results: LocalDiagram[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkJsonFiles(fullPath, srcDir)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const rel = path.relative(srcDir, fullPath);
      const parts = rel.split(path.sep);
      try {
        const raw = await readFile(fullPath, 'utf-8');
        const data = JSON.parse(raw) as { nodes: unknown[]; edges: unknown[] };
        const date = await readBlogPostDate(path.dirname(fullPath));
        results.push({
          label: parts.join(' / '),
          filePath: rel,
          blogPost: parts[0],
          date,
          data,
        });
      } catch {
        // skip files that aren't valid diagram JSON
      }
    }
  }
  return results;
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const blogSrcDir = path.resolve(process.cwd(), '../blog/src');
  const contentDir = path.join(blogSrcDir, 'content/blog');
  const systemArchDir = path.join(blogSrcDir, 'app/system-architecture');

  const [blogDiagrams, archDiagrams] = await Promise.all([
    walkJsonFiles(contentDir, blogSrcDir),
    walkJsonFiles(systemArchDir, blogSrcDir),
  ]);

  blogDiagrams.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    if (a.blogPost !== b.blogPost) return a.blogPost.localeCompare(b.blogPost);
    return a.filePath.localeCompare(b.filePath);
  });

  return NextResponse.json([...archDiagrams, ...blogDiagrams]);
}

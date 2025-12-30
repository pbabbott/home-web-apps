import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BLOG_CONTENT_DIR = path.join(process.cwd(), 'src/content/blog');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; image: string }> },
) {
  const { slug, image } = await params;

  // Security: Prevent directory traversal
  if (slug.includes('..') || image.includes('..')) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  const imagePath = path.join(BLOG_CONTENT_DIR, slug, image);

  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    return new NextResponse('Image not found', { status: 404 });
  }

  // Read the image file
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(image).toLowerCase();

  // Determine content type
  const contentType =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.svg'
              ? 'image/svg+xml'
              : 'application/octet-stream';

  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

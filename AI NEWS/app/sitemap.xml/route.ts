import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const items = await prisma.item.findMany({
    orderBy: [{ publishedAt: 'desc' }],
    take: 200,
    select: { id: true, publishedAt: true }
  });

  const urls: string[] = [];
  urls.push(`<url><loc>${site}</loc><priority>0.9</priority></url>`);
  for (const it of items) {
    urls.push(
      `<url><loc>${site}/items/${it.id}</loc><lastmod>${new Date(it.publishedAt).toISOString()}</lastmod><priority>0.6</priority></url>`
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.join('') +
    `</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
  });
}
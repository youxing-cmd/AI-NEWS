import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Feed } from 'feed';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await prisma.item.findMany({
    orderBy: [{ publishedAt: 'desc' }],
    take: 100,
    select: {
      id: true, url: true, title: true, summary: true, content: true, imageUrl: true,
      sourceName: true, sourceDomain: true, publishedAt: true
    }
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const feed = new Feed({
    id: site,
    link: site,
    title: 'AI News - 每日 AI 资讯聚合',
    description: '自动化采集、去重聚合与评分排序，展示每日 AI 新闻、论文、视频与公告。',
    language: 'zh-CN',
    favicon: `${site}/favicon.ico`,
    updated: new Date()
  });

  items.forEach((it) => {
    feed.addItem({
      id: it.id,
      link: it.url,
      title: it.title,
      description: it.summary || undefined,
      content: it.content || it.summary || undefined,
      date: new Date(it.publishedAt),
      image: it.imageUrl || undefined,
      author: it.sourceName ? [{ name: it.sourceName }] : undefined
    });
  });

  const body = feed.rss2();
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  });
}
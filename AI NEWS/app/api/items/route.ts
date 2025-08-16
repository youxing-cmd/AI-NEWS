import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { env } from '@/lib/env';
import { withRateLimit, applyRateLimitHeaders } from '@/lib/rateLimit';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

function hashKey(s: string) {
  return createHash('sha1').update(s).digest('hex');
}

function parseBlocklist(): string[] {
  return env.BLOCKLIST_PHRASES.split(';').map((s) => s.trim()).filter(Boolean);
}

function containsBlockedText(text: string | null | undefined, phrases: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return phrases.some((p) => p && lower.includes(p.toLowerCase()));
}

export async function GET(req: NextRequest) {
  // 速率限制
  const rl = await withRateLimit(req, { prefix: 'api_items' });
  if (!rl.allowed) {
    const denied = NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    return applyRateLimitHeaders(denied, rl);
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type') || undefined; // NEWS/PAPER/VIDEO/ANNOUNCEMENT
  const source = url.searchParams.get('source') || undefined; // domain
  const date = url.searchParams.get('date') || undefined; // YYYY-MM-DD (dayKey)
  const limit = Math.min(Number(url.searchParams.get('limit') || '30'), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0);

  const cacheKey = `cache:items:${hashKey(url.search)}`;
  const redis = getRedis();

  // 简单缓存
  if (req.method === 'GET') {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const res = new NextResponse(cached, {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=60' }
        });
        return applyRateLimitHeaders(res, rl);
      }
    } catch {
      // 忽略缓存错误
    }
  }

  const where: any = { disabled: false };
  if (date) where.dayKey = date;
  if (type) where.type = type;
  if (source) where.sourceDomain = source;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ score: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        url: true,
        title: true,
        summary: true,
        content: true,
        imageUrl: true,
        sourceName: true,
        sourceDomain: true,
        type: true,
        tags: true,
        publishedAt: true,
        score: true,
        clusterId: true,
        revision: true
      }
    }),
    prisma.item.count({ where })
  ]);

  // 过滤“禁止转载”类短语
  const blocklist = parseBlocklist();
  const filtered = items.filter((it) => {
    const blocked =
      containsBlockedText(it.summary, blocklist) ||
      containsBlockedText(it.content, blocklist) ||
      containsBlockedText(it.title, blocklist);
    return !blocked;
  });

  const payload = JSON.stringify({
    total,
    count: filtered.length,
    items: filtered.map((it) => ({
      id: it.id,
      url: it.url,
      title: it.title,
      summary: it.summary,
      imageUrl: it.imageUrl,
      sourceName: it.sourceName,
      sourceDomain: it.sourceDomain,
      type: it.type,
      tags: it.tags,
      publishedAt: it.publishedAt,
      score: it.score,
      clusterId: it.clusterId,
      revision: it.revision
    }))
  });

  const res = new NextResponse(payload, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=60' }
  });

  // 回写缓存
  try {
    await redis.setex(cacheKey, 60, payload);
  } catch {
    // 忽略缓存错误
  }

  return applyRateLimitHeaders(res, rl);
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { withRateLimit, applyRateLimitHeaders } from '@/lib/rateLimit';

function parseBlocklist(): string[] {
  return env.BLOCKLIST_PHRASES.split(';').map((s) => s.trim()).filter(Boolean);
}
function containsBlockedText(text: string | null | undefined, phrases: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return phrases.some((p) => p && lower.includes(p.toLowerCase()));
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const rl = await withRateLimit(req, { prefix: 'api_item' });
  if (!rl.allowed) {
    const denied = NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    return applyRateLimitHeaders(denied, rl);
  }
  const id = ctx.params.id;
  const it = await prisma.item.findFirst({
    where: { id, disabled: false },
    select: {
      id: true, url: true, title: true, summary: true, content: true, imageUrl: true,
      sourceName: true, sourceDomain: true, type: true, tags: true, publishedAt: true,
      score: true, clusterId: true, revision: true
    }
  });
  if (!it) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const blocklist = parseBlocklist();
  const blocked =
    containsBlockedText(it.summary, blocklist) ||
    containsBlockedText(it.content, blocklist) ||
    containsBlockedText(it.title, blocklist);
  if (blocked) return NextResponse.json({ error: 'not_allowed' }, { status: 403 });

  {
    const res = NextResponse.json(it, { status: 200, headers: { 'Cache-Control': 'public, max-age=60' } });
    return applyRateLimitHeaders(res, rl);
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { env } from '@/lib/env';

function unauthorized() {
  return new NextResponse('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="admin"' } });
}

function checkBasicAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const [user, pass] = decoded.split(':');
    return user === env.BASIC_AUTH_USER && pass === env.BASIC_AUTH_PASS;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!checkBasicAuth(req)) return unauthorized();

  let action: 'crawl' | 'recompute' = 'crawl';
  const ct = (req.headers.get('content-type') || '').toLowerCase();

  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({} as any));
    const a = (body?.action as string) || 'crawl';
    action = a === 'recompute' ? 'recompute' : 'crawl';
  } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await req.formData().catch(() => null);
    const a = (fd?.get('action') as string) || 'crawl';
    action = a === 'recompute' ? 'recompute' : 'crawl';
  } else {
    // 尝试 JSON 回退
    const body = await req.json().catch(() => ({} as any));
    const a = (body?.action as string) || 'crawl';
    action = a === 'recompute' ? 'recompute' : 'crawl';
  }

  const queue = new Queue('crawler', { connection: { url: env.REDIS_URL } });

  if (action === 'crawl') {
    await queue.add('crawl-all-sources', {}, { removeOnComplete: true, removeOnFail: 100 });
  } else {
    await queue.add('recompute-scores', {}, { removeOnComplete: true, removeOnFail: 100 });
  }

  return NextResponse.json({ ok: true, queued: action });
}

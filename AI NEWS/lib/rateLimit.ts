import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from './redis';
import { env } from './env';

type RateLimitOptions = {
  windowSeconds?: number;
  max?: number;
  prefix?: string;
};

export async function withRateLimit(
  req: NextRequest,
  opts: RateLimitOptions = {}
): Promise<{ allowed: boolean; remaining: number; reset: number; key: string }> {
  const windowSeconds = opts.windowSeconds ?? Math.floor(env.RATE_LIMIT_WINDOW_MS / 1000);
  const max = opts.max ?? env.RATE_LIMIT_MAX_NUM;
  const prefix = opts.prefix ?? 'rl';

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';

  const route = new URL(req.url).pathname;
  const key = `${prefix}:${route}:${ip}`;

  const redis = getRedis();
  // 使用固定窗口：INCR + EXPIRE
  const now = Math.floor(Date.now() / 1000);
  const ttlKey = `${key}:ttl:${Math.floor(now / windowSeconds) * windowSeconds}`;
  const multi = redis.multi();
  multi.incr(key);
  multi.expire(key, windowSeconds, 'NX');
  const [countRaw] = (await multi.exec()) ?? [];
  const count = Array.isArray(countRaw) ? Number(countRaw[1]) : Number(countRaw);

  const remaining = Math.max(0, max - count);
  const allowed = count <= max;
  const reset = now + windowSeconds;

  return { allowed, remaining, reset, key: ttlKey };
}

export function applyRateLimitHeaders(
  res: NextResponse,
  limitInfo: { remaining: number; reset: number; key: string; }
) {
  res.headers.set('X-RateLimit-Remaining', String(limitInfo.remaining));
  res.headers.set('X-RateLimit-Reset', String(limitInfo.reset));
  res.headers.set('X-RateLimit-Key', limitInfo.key);
  return res;
}
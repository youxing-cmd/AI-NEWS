import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { env } from '@/lib/env';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true };
  } catch (e: any) {
    checks.db = { ok: false, detail: e?.message || String(e) };
  }

  // Redis
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { ok: true };
  } catch (e: any) {
    checks.redis = { ok: false, detail: e?.message || String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  const body = {
    status: allOk ? 'ok' : 'degraded',
    version: '1.0.0',
    node: process.version,
    timezone: env.TZ,
    time: new Date().toISOString(),
    checks
  };

  const res = NextResponse.json(body, { status: allOk ? 200 : 503 });
  // 基本缓存控制：健康检查不缓存
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
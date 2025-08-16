import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

function unauthorized() {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="admin"' }
  });
}

function checkBasicAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    return user === env.BASIC_AUTH_USER && pass === env.BASIC_AUTH_PASS;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  if (!checkBasicAuth(req)) return unauthorized();

  const id = ctx.params.id;
  const body = await req.json().catch(() => ({} as any));
  let disabled: boolean | undefined = undefined;
  if (typeof body?.disabled === 'boolean') disabled = body.disabled;

  // 如果未传 disabled，则切换
  if (typeof disabled === 'undefined') {
    const it = await prisma.item.findUnique({ where: { id }, select: { disabled: true } });
    if (!it) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    disabled = !it.disabled;
  }

  const updated = await prisma.item.update({
    where: { id },
    data: { disabled }
  });

  return NextResponse.json({ id: updated.id, disabled: updated.disabled });
}
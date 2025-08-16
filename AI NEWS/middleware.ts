import { NextRequest, NextResponse } from 'next/server';

function parseOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS || 'http://localhost:3000';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function matchOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const allow = parseOrigins();
  return allow.includes(origin) ? origin : null;
}

function setCorsHeaders(res: NextResponse, origin: string | null) {
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.headers.set('Access-Control-Max-Age', '600');
  return res;
}

function unauthorizedWWW() {
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
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    const U = process.env.BASIC_AUTH_USER || 'admin';
    const P = process.env.BASIC_AUTH_PASS || 'admin123';
    return user === U && pass === P;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api');
  const isAdmin = pathname.startsWith('/api/admin') || pathname.startsWith('/admin');

  // 预检请求：直接返回并附带 CORS 头（不做鉴权）
  if (isApi && req.method === 'OPTIONS') {
    const origin = matchOrigin(req.headers.get('origin'));
    const res = new NextResponse(null, { status: 204 });
    return setCorsHeaders(res, origin);
  }

  // 管理保护（非预检）
  if (isAdmin) {
    if (!checkBasicAuth(req)) {
      return unauthorizedWWW();
    }
  }

  // API CORS 头（非预检）
  if (isApi) {
    const origin = matchOrigin(req.headers.get('origin'));
    const res = NextResponse.next();
    return setCorsHeaders(res, origin);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*']
};
import { createHash } from 'crypto';

/**
 * 归一化 URL：移除 hash、裁剪 UTM 参数、去掉尾部斜杠、转为小写域名
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    // 去除常见跟踪参数
    const rm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid'];
    rm.forEach((k) => u.searchParams.delete(k));
    // 处理尾部斜杠
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    // 域名小写
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export function urlHash(url: string): string {
  const norm = normalizeUrl(url);
  return createHash('sha1').update(norm).digest('hex');
}

/**
 * 纽约时区当日 dayKey（YYYY-MM-DD）
 */
export function getDayKey(date: Date = new Date(), tz = 'America/New_York'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // en-CA 输出 YYYY-MM-DD
  return fmt.format(date);
}

/**
 * Hamming 距离（基于 64 位二进制字符串）
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    const len = Math.min(a.length, b.length);
    a = a.slice(0, len);
    b = b.slice(0, len);
  }
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    dist += a[i] === b[i] ? 0 : 1;
  }
  return dist;
}
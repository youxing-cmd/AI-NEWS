import { createHash } from 'crypto';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function sha1hex(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}

/**
 * 简易 64-bit simhash：
 * - 对 token 取 sha1 的前 16 hex（64bit），按 bit 位累加/抵消
 * - 返回 64 位二进制字符串
 */
export function simhash64(text: string): string {
  const tokens = tokenize(text);
  if (tokens.length === 0) return ''.padEnd(64, '0');

  const weights = new Map<string, number>();
  for (const t of tokens) {
    weights.set(t, (weights.get(t) || 0) + 1);
  }

  const vec = new Array<number>(64).fill(0);
  for (const [tok, w] of weights.entries()) {
    const h = sha1hex(tok).slice(0, 16); // 64bit
    const bin = BigInt('0x' + h).toString(2).padStart(64, '0');
    for (let i = 0; i < 64; i++) {
      vec[i] += bin[i] === '1' ? w : -w;
    }
  }
  return vec.map((v) => (v >= 0 ? '1' : '0')).join('');
}
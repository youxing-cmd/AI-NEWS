import Redis from 'ioredis';
import { env } from './env';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null
    });
    // 尝试连接（延迟到首次调用处）
    client.on('error', (err) => {
      // 仅记录，不抛出以免在 dev 阶段阻塞
      console.error('[redis] error:', err?.message || err);
    });
    client.on('connect', () => {
      console.log('[redis] connected');
    });
    client.on('close', () => {
      console.warn('[redis] connection closed');
    });
  }
  return client;
}
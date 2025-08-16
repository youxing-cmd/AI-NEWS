import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('America/New_York'),

  // URLs
  DATABASE_URL: z.string().min(1, 'DATABASE_URL required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Security
  BASIC_AUTH_USER: z.string().default('admin'),
  BASIC_AUTH_PASS: z.string().default('admin123'),
  JWT_SERVICE_SECRET: z.string().default('please_change_me'),

  // Rate limit
  RATE_LIMIT_WINDOW: z.string().default('60'),
  RATE_LIMIT_MAX: z.string().default('120'),

  // Cron
  CRON_FETCH: z.string().default('0 2,8,14,20 * * *'),
  CRON_RECOMPUTE: z.string().default('0 3,9,15,21 * * *'),

  // Worker
  FETCH_CONCURRENCY: z.string().default('5'),

  // Blocklist phrases
  BLOCKLIST_PHRASES: z.string().default('未经允许,禁止转载;不得转载;版权所有 未经授权不得转载;禁止转载'),

  // Example sources
  OPENAI_BLOG_RSS: z.string().optional(),
  GOOGLE_AI_BLOG_RSS: z.string().optional(),
  DEEPMIND_RSS: z.string().optional(),
  ARXIV_CS_AI_RSS: z.string().optional(),
  ARXIV_CS_CL_RSS: z.string().optional(),
  ARXIV_CS_LG_RSS: z.string().optional(),
  HACKERNEWS_SEARCH_KEYWORDS: z.string().optional(),
  YOUTUBE_CHANNEL_RSS: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // 只打印一次，避免在多入口环境中刷屏
  console.error('Environment validation error:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = {
  ...parsed.data,
  // 便捷导出已解析的数值类型
  RATE_LIMIT_WINDOW_MS: Number(parsed.data.RATE_LIMIT_WINDOW) * 1000,
  RATE_LIMIT_MAX_NUM: Number(parsed.data.RATE_LIMIT_MAX),
  FETCH_CONCURRENCY_NUM: Number(parsed.data.FETCH_CONCURRENCY)
};
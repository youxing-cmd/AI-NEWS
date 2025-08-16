import { env } from '@/lib/env';

const HALF_LIFE_HOURS = 48;
const LN2 = Math.log(2);

function hoursSince(date: Date): number {
  const now = Date.now();
  return Math.max(0, (now - date.getTime()) / 3600000);
}

function timeDecayFactor(date: Date): number {
  const h = hoursSince(date);
  return Math.exp(-LN2 * (h / HALF_LIFE_HOURS));
}

function keywordBoost(title: string, summary?: string | null): number {
  const keys = (env.HACKERNEWS_SEARCH_KEYWORDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!keys.length) return 0;
  const text = (title + ' ' + (summary || '')).toLowerCase();
  let score = 0;
  for (const k of keys) {
    if (!k) continue;
    const hits = (text.match(new RegExp(`\\b${k.toLowerCase()}\\b`, 'g')) || []).length;
    score += hits * 2.5;
  }
  return score;
}

function socialScore(likes = 0, comments = 0, views = 0): number {
  return likes * 0.5 + comments * 0.7 + views * 0.01;
}

export function computeScore(params: {
  publishedAt: Date;
  sourceCredibility: number;
  title: string;
  summary?: string | null;
  socialLikes?: number;
  socialComments?: number;
  socialViews?: number;
}): number {
  const decay = timeDecayFactor(params.publishedAt);
  const base = Math.max(0, Math.min(100, params.sourceCredibility));
  const k = keywordBoost(params.title, params.summary);
  const s = socialScore(params.socialLikes || 0, params.socialComments || 0, params.socialViews || 0);
  const raw = (base + k + s);
  const final = raw * decay;
  // 归一化上限（可视化方便）
  return Math.min(1000, final);
}
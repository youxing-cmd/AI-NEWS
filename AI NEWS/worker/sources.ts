import { env } from '@/lib/env';

export type SourceCfg = {
  name: string;
  domain: string;
  rssUrl?: string;
  credibility: number; // 0-100
};

export function getDefaultSources(): SourceCfg[] {
  const list: SourceCfg[] = [
    { name: 'OpenAI Blog', domain: 'openai.com', rssUrl: env.OPENAI_BLOG_RSS, credibility: 95 },
    { name: 'Google AI Blog', domain: 'ai.googleblog.com', rssUrl: env.GOOGLE_AI_BLOG_RSS, credibility: 92 },
    { name: 'DeepMind', domain: 'deepmind.google', rssUrl: env.DEEPMIND_RSS, credibility: 92 },
    { name: 'arXiv cs.AI', domain: 'arxiv.org', rssUrl: env.ARXIV_CS_AI_RSS, credibility: 88 },
    { name: 'arXiv cs.CL', domain: 'arxiv.org', rssUrl: env.ARXIV_CS_CL_RSS, credibility: 88 },
    { name: 'arXiv cs.LG', domain: 'arxiv.org', rssUrl: env.ARXIV_CS_LG_RSS, credibility: 88 },
    { name: 'YouTube Channel', domain: 'youtube.com', rssUrl: env.YOUTUBE_CHANNEL_RSS, credibility: 85 }
  ].filter((s) => !!s.rssUrl);

  // 去重按 domain
  const seen = new Set<string>();
  const uniq: SourceCfg[] = [];
  for (const s of list) {
    if (!seen.has(s.domain)) {
      uniq.push(s);
      seen.add(s.domain);
    }
  }
  return uniq;
}
import Parser from 'rss-parser';
import { SourceCfg } from '../sources';

export type NormalizedInput = {
  url: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  publishedAt: Date;
  type: 'NEWS' | 'PAPER' | 'VIDEO' | 'ANNOUNCEMENT';
  sourceName: string;
  sourceDomain: string;
  sourceCredibility: number;
  tags?: string[];
};

const parser = new Parser({
  timeout: 20000,
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent']
    ] as any
  }
});

function inferTypeBySourceDomain(domain: string): NormalizedInput['type'] {
  const d = domain.toLowerCase();
  if (d.includes('arxiv.org')) return 'PAPER';
  if (d.includes('youtube.com') || d.includes('youtu.be')) return 'VIDEO';
  if (d.includes('github.com')) return 'ANNOUNCEMENT';
  return 'NEWS';
}

function pickImage(item: any): string | undefined {
  // 优先 enclosure / media
  const enc = (item.enclosure && item.enclosure.url) || undefined;
  const mediaThumb = (item.mediaThumbnail && item.mediaThumbnail.url) || undefined;
  const mediaContent = (item.mediaContent && item.mediaContent.url) || undefined;
  const it = enc || mediaThumb || mediaContent;
  if (it) return it;
  // 从内容中简单正则找第一张图
  const html = (item['content:encoded'] || item.contentEncoded || item.content || '') as string;
  const m = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : undefined;
}

export async function fetchRssSource(source: SourceCfg): Promise<NormalizedInput[]> {
  if (!source.rssUrl) return [];
  const feed = await parser.parseURL(source.rssUrl);
  const list: NormalizedInput[] = [];
  for (const it of feed.items || []) {
    const link = it.link || it.guid;
    const title = (it.title || '').trim();
    if (!link || !title) continue;

    const iso = (it.isoDate as string) || (it.pubDate as string) || '';
    const publishedAt = iso ? new Date(iso) : new Date();

    const summary = (it.contentSnippet || it.summary || it.content || '').toString().trim();
    const content = ((it['content:encoded'] as string) || (it.content as string) || '').toString().trim();
    const imageUrl = pickImage(it);
    const type = inferTypeBySourceDomain(source.domain);

    list.push({
      url: link,
      title,
      summary: summary || null,
      content: content || null,
      imageUrl: imageUrl || null,
      publishedAt,
      type,
      sourceName: source.name,
      sourceDomain: source.domain,
      sourceCredibility: source.credibility,
      tags: []
    });
  }
  return list;
}
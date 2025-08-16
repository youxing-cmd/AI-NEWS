import { PrismaClient, ItemType } from '@prisma/client';
import { urlHash, getDayKey } from '@/utils/hash';
import { simhash64 } from '@/utils/simhash';
import { computeScore } from '@/worker/pipeline/score';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const dayKey = getDayKey(now, process.env.TZ || 'America/New_York');

  const samples = [
    {
      url: 'https://openai.com/blog/sample-ai-news',
      title: 'OpenAI 发布示例更新：模型推理能力提升',
      summary: '该更新提升了推理与工具调用的稳定性与速度。',
      content: '<p>这是演示内容，用于本地种子数据。</p>',
      imageUrl: null,
      sourceName: 'OpenAI Blog',
      sourceDomain: 'openai.com',
      sourceCredibility: 95,
      type: ItemType.NEWS,
      tags: ['OpenAI', '更新'],
      publishedAt: new Date(now.getTime() - 60 * 60 * 1000)
    },
    {
      url: 'https://arxiv.org/abs/1234.56789',
      title: '示例论文：高效自注意力推理方法',
      summary: '我们提出了一种高效的自注意力推理新方法，在多项基准上获得提升。',
      content: '<p>论文简介与贡献（示例数据）。</p>',
      imageUrl: null,
      sourceName: 'arXiv',
      sourceDomain: 'arxiv.org',
      sourceCredibility: 88,
      type: ItemType.PAPER,
      tags: ['论文', '自注意力'],
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
    },
    {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: '示例视频：AI 工具演示合集',
      summary: '汇总近期常用 AI 工具上手演示与最佳实践。',
      content: '<p>视频摘要（示例数据）。</p>',
      imageUrl: null,
      sourceName: 'YouTube Channel',
      sourceDomain: 'youtube.com',
      sourceCredibility: 85,
      type: ItemType.VIDEO,
      tags: ['视频', '实践'],
      publishedAt: new Date(now.getTime() - 30 * 60 * 1000)
    }
  ];

  // 确保 Source 记录存在
  const sources = [
    { name: 'OpenAI Blog', domain: 'openai.com', credibility: 95 },
    { name: 'arXiv', domain: 'arxiv.org', credibility: 88 },
    { name: 'YouTube Channel', domain: 'youtube.com', credibility: 85 }
  ];
  for (const s of sources) {
    await prisma.source.upsert({
      where: { domain: s.domain },
      update: { name: s.name, credibility: s.credibility },
      create: { name: s.name, domain: s.domain, credibility: s.credibility }
    });
  }

  for (const s of samples) {
    const uhash = urlHash(s.url);
    const text = (s.title + ' ' + (s.summary || '')).slice(0, 1000);
    const simhash = simhash64(text);
    const score = computeScore({
      publishedAt: s.publishedAt,
      sourceCredibility: s.sourceCredibility,
      title: s.title,
      summary: s.summary
    });

    await prisma.item.upsert({
      where: { urlHash: uhash },
      update: {
        title: s.title,
        summary: s.summary,
        content: s.content,
        imageUrl: s.imageUrl,
        sourceName: s.sourceName,
        sourceDomain: s.sourceDomain,
        sourceCredibility: s.sourceCredibility,
        type: s.type,
        tags: s.tags,
        publishedAt: s.publishedAt,
        dayKey,
        simhash,
        score
      },
      create: {
        url: s.url,
        urlHash: uhash,
        title: s.title,
        summary: s.summary,
        content: s.content,
        imageUrl: s.imageUrl,
        sourceName: s.sourceName,
        sourceDomain: s.sourceDomain,
        sourceCredibility: s.sourceCredibility,
        type: s.type,
        tags: s.tags,
        publishedAt: s.publishedAt,
        dayKey,
        simhash,
        score
      }
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { getDefaultSources } from '../sources';
import { fetchRssSource, NormalizedInput } from './fetchers';
import { urlHash, getDayKey, hammingDistance } from '@/utils/hash';
import { simhash64 } from '@/utils/simhash';
import { computeScore } from './score';
import { ItemType } from '@prisma/client';

const SIMHASH_DUP_THRESHOLD = 5; // <= 5 视为重复
const CLUSTER_DISTANCE = 8; // 同簇阈值
const CLUSTER_LOOKBACK_DAYS = 3;

function parseBlocklist(): string[] {
  return env.BLOCKLIST_PHRASES.split(';').map((s) => s.trim()).filter(Boolean);
}

function containsBlockedText(text: string | null | undefined, phrases: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return phrases.some((p) => p && lower.includes(p.toLowerCase()));
}

function toItemType(t: NormalizedInput['type']): ItemType {
  switch (t) {
    case 'PAPER': return 'PAPER';
    case 'VIDEO': return 'VIDEO';
    case 'ANNOUNCEMENT': return 'ANNOUNCEMENT';
    default: return 'NEWS';
  }
}

async function ensureClusterForItem(itemId: string, simhash: string, type: ItemType): Promise<string | undefined> {
  const lookback = new Date(Date.now() - CLUSTER_LOOKBACK_DAYS * 24 * 3600 * 1000);
  const candidates = await prisma.item.findMany({
    where: {
      id: { not: itemId },
      publishedAt: { gte: lookback },
      type
    },
    select: { id: true, simhash: true, clusterId: true, title: true },
    orderBy: { publishedAt: 'desc' },
    take: 50
  });

  for (const c of candidates) {
    if (!c.simhash) continue;
    const dist = hammingDistance(simhash, c.simhash);
    if (dist <= CLUSTER_DISTANCE) {
      if (c.clusterId) {
        await prisma.item.update({ where: { id: itemId }, data: { clusterId: c.clusterId } });
        return c.clusterId;
      }
      // 创建新簇
      const cluster = await prisma.cluster.create({
        data: {
          topic: c.title.slice(0, 120),
          representativeItemId: c.id
        }
      });
      await prisma.item.updateMany({ where: { id: { in: [itemId, c.id] } }, data: { clusterId: cluster.id } });
      return cluster.id;
    }
  }
  // 未找到匹配不创建
  return undefined;
}

export async function crawlAllSourcesPipeline() {
  const sources = getDefaultSources();
  const stats = {
    sources: sources.length,
    fetched: 0,
    normalized: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    clustersLinked: 0
  };
  const blocklist = parseBlocklist();

  // 确保 Source 表存在（幂等 upsert）
  for (const s of sources) {
    try {
      await prisma.source.upsert({
        where: { domain: s.domain },
        update: { name: s.name, rssUrl: s.rssUrl || undefined, credibility: s.credibility },
        create: { name: s.name, domain: s.domain, rssUrl: s.rssUrl || undefined, credibility: s.credibility }
      });
    } catch (e) {
      logger.warn({ err: (e as any)?.message, domain: s.domain }, 'upsert source failed');
    }
  }

  for (const src of sources) {
    try {
      const items = await fetchRssSource(src);
      stats.fetched += items.length;

      for (const raw of items) {
        // 合规过滤
        if (
          containsBlockedText(raw.title, blocklist) ||
          containsBlockedText(raw.summary, blocklist) ||
          containsBlockedText(raw.content, blocklist)
        ) {
          stats.skipped++;
          continue;
        }

        // 规范化与指纹
        const uhash = urlHash(raw.url);
        const dayKey = getDayKey(raw.publishedAt, env.TZ);
        const sim = simhash64([raw.title, raw.summary || ''].join(' ').slice(0, 1000));
        const type = toItemType(raw.type);

        // 去重与替换策略
        const existing = await prisma.item.findUnique({ where: { urlHash: uhash } });

        if (existing) {
          // 如果标题+摘要 simhash 高度相似，丢弃
          if (existing.simhash) {
            const dist = hammingDistance(sim, existing.simhash);
            if (dist <= SIMHASH_DUP_THRESHOLD) {
              stats.skipped++;
              continue;
            }
          }
          // 如果来源相同但内容显著变化且发布时间更新，则视为新版，revision+1
          const textA = (existing.title + ' ' + (existing.summary || '')).slice(0, 1000);
          const textB = (raw.title + ' ' + (raw.summary || '')).slice(0, 1000);
          const changed = textA !== textB || Math.abs((existing.content || '').length - (raw.content || '').length) > 20;
          const newer = raw.publishedAt && existing.publishedAt ? raw.publishedAt > existing.publishedAt : true;

          if (changed && newer) {
            const updated = await prisma.item.update({
              where: { id: existing.id },
              data: {
                url: raw.url,
                title: raw.title,
                summary: raw.summary,
                content: raw.content,
                imageUrl: raw.imageUrl,
                sourceName: raw.sourceName,
                sourceDomain: raw.sourceDomain,
                sourceCredibility: raw.sourceCredibility,
                type,
                tags: raw.tags || [],
                publishedAt: raw.publishedAt,
                dayKey,
                simhash: sim,
                revision: { increment: 1 }
              }
            });
            // 打分与聚类
            const newScore = computeScore({
              publishedAt: updated.publishedAt,
              sourceCredibility: updated.sourceCredibility,
              title: updated.title,
              summary: updated.summary,
              socialLikes: updated.socialLikes,
              socialComments: updated.socialComments,
              socialViews: updated.socialViews
            });
            await prisma.item.update({ where: { id: updated.id }, data: { score: newScore } });
            await ensureClusterForItem(updated.id, sim, updated.type);
            stats.updated++;
          } else {
            stats.skipped++;
          }
          continue;
        }

        // 插入新记录
        const created = await prisma.item.create({
          data: {
            url: raw.url,
            urlHash: uhash,
            title: raw.title,
            summary: raw.summary,
            content: raw.content,
            imageUrl: raw.imageUrl,
            sourceName: raw.sourceName,
            sourceDomain: raw.sourceDomain,
            sourceCredibility: raw.sourceCredibility,
            type,
            tags: raw.tags || [],
            publishedAt: raw.publishedAt,
            dayKey,
            simhash: sim
          }
        });

        // 打分与聚类
        const score = computeScore({
          publishedAt: created.publishedAt,
          sourceCredibility: created.sourceCredibility,
          title: created.title,
          summary: created.summary,
          socialLikes: created.socialLikes,
          socialComments: created.socialComments,
          socialViews: created.socialViews
        });
        await prisma.item.update({ where: { id: created.id }, data: { score } });
        await ensureClusterForItem(created.id, sim, created.type);
        stats.inserted++;
      }
    } catch (e) {
      logger.error({ err: (e as any)?.message, source: src.name }, 'fetch source failed');
    }
  }

  logger.info({ stats }, 'crawl pipeline finished');
  return stats;
}

export async function recomputeScoresPipeline() {
  // 对最近 7 天的数据重算
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const batch = await prisma.item.findMany({
    where: { publishedAt: { gte: since } },
    select: {
      id: true,
      publishedAt: true,
      sourceCredibility: true,
      title: true,
      summary: true,
      socialLikes: true,
      socialComments: true,
      socialViews: true
    },
    orderBy: { publishedAt: 'desc' },
    take: 1000
  });

  let touched = 0;
  for (const it of batch) {
    const score = computeScore({
      publishedAt: it.publishedAt,
      sourceCredibility: it.sourceCredibility,
      title: it.title,
      summary: it.summary,
      socialLikes: it.socialLikes || 0,
      socialComments: it.socialComments || 0,
      socialViews: it.socialViews || 0
    });
    await prisma.item.update({ where: { id: it.id }, data: { score } });
    touched++;
  }

  logger.info({ touched }, 'recompute scores finished');
  return { touched };
}
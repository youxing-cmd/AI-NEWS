import { Queue, Worker } from 'bullmq';
import pino from 'pino';
import { crawlAllSourcesPipeline, recomputeScoresPipeline } from './pipeline/pipeline';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
});

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: redisUrl };

// 队列名称：crawler（固定）
const queue = new Queue('crawler', { connection });

/**
 * 注册重复任务：
 * - crawl-all-sources：每天 02:00、08:00、14:00、20:00
 * - recompute-scores：每天 03:00、09:00、15:00、21:00
 * 时区默认 America/New_York，可用 TZ 覆盖
 */
async function scheduleJobs() {
  const tz = process.env.TZ || 'America/New_York';
  const fetchCron = process.env.CRON_FETCH || '0 2,8,14,20 * * *';
  const recomputeCron = process.env.CRON_RECOMPUTE || '0 3,9,15,21 * * *';

  await queue.add('crawl-all-sources', {}, {
    repeat: { cron: fetchCron, tz },
    removeOnComplete: true, removeOnFail: 100,
  });

  await queue.add('recompute-scores', {}, {
    repeat: { cron: recomputeCron, tz },
    removeOnComplete: true, removeOnFail: 100,
  });

  logger.info({ fetchCron, recomputeCron, tz }, 'repeatable jobs scheduled');
}

/**
 * Worker 处理器：接入完整流水线
 * sources -> fetch -> normalize -> deduplicate/replace -> cluster -> score -> persist -> cache bust
 */
const concurrency = Number(process.env.FETCH_CONCURRENCY || 5);

const worker = new Worker(
  'crawler',
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'job started');

    switch (job.name) {
      case 'crawl-all-sources': {
        const result = await crawlAllSourcesPipeline();
        logger.info({ result }, 'crawl-all-sources finished');
        return result;
      }
      case 'recompute-scores': {
        const result = await recomputeScoresPipeline();
        logger.info({ result }, 'recompute-scores finished');
        return result;
      }
      default:
        logger.warn({ name: job.name }, 'unknown job name, skipped');
        return { skipped: true };
    }
  },
  { connection, concurrency }
);

// 事件日志
worker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, name: job.name, result }, 'job completed');
});
worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, name: job?.name, err }, 'job failed');
});

// 启动入口
(async () => {
  logger.info({ redisUrl, concurrency }, 'worker starting');
  await scheduleJobs();

  // 首次启动立即触发一次抓取，避免等待下一次 cron
  await queue.add('crawl-all-sources', {}, { removeOnComplete: true, removeOnFail: 100 });

  logger.info('worker ready and waiting for jobs');
})().catch((err) => {
  logger.error({ err }, 'worker bootstrap error');
  process.exit(1);
});

// 优雅退出
const shutdown = async (signal: NodeJS.Signals) => {
  logger.warn({ signal }, 'shutting down worker...');
  try {
    await worker.close();
    await queue.close();
    logger.info('worker closed');
  } catch (e) {
    logger.error({ e }, 'error during shutdown');
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
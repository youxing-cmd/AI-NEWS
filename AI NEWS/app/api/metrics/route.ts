import { NextResponse } from 'next/server';
import { getPrometheusText, inc, setGauge } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 进程级指标（近似）
  inc('requests_total', 1);
  setGauge('nodejs_uptime_seconds', process.uptime());
  setGauge('nodejs_memory_rss_bytes', process.memoryUsage().rss);
  setGauge('nodejs_memory_heap_used_bytes', process.memoryUsage().heapUsed);

  const body =
    '# HELP ainews_info Build/runtime info\\n' +
    '# TYPE ainews_info gauge\\n' +
    `ainews_info{version="1.0.0"} 1\\n` +
    getPrometheusText();

  const res = new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
  return res;
}
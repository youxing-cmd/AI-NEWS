'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useMemo } from 'react';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json());

export default function AdminPage() {
  const apiUrl = useMemo(() => `/api/items?limit=50`, []);
  const { data, isLoading, mutate } = useSWR(apiUrl, fetcher, { revalidateOnFocus: false });

  const items = data?.items || [];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">管理后台</h1>
      <p className="text-sm text-gray-600 mt-1">
        受 Basic Auth 保护（默认 admin / admin123，生产务必修改环境变量）。表单提交将在新窗口打开并触发浏览器认证框。
      </p>

      <section className="mt-6 flex flex-wrap gap-3">
        <form method="POST" action="/api/admin/trigger" target="_blank">
          <input type="hidden" name="action" value="crawl" />
          <button type="submit" className="px-4 h-10 rounded bg-blue-600 text-white hover:bg-blue-700">
            立即抓取
          </button>
        </form>
        <form method="POST" action="/api/admin/trigger" target="_blank">
          <input type="hidden" name="action" value="recompute" />
          <button type="submit" className="px-4 h-10 rounded bg-indigo-600 text-white hover:bg-indigo-700">
            重算分
          </button>
        </form>
        <button
          onClick={() => mutate()}
          className="px-4 h-10 rounded border hover:bg-gray-50"
        >
          刷新列表
        </button>
        <Link href="/" className="px-4 h-10 inline-flex items-center rounded border hover:bg-gray-50">
          返回前台
        </Link>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold mb-3">最近 50 条</h2>
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-gray-500">暂无数据</div>
        ) : (
          <div className="grid gap-3">
            {items.map((it: any) => (
              <div key={it.id} className="p-3 border rounded flex gap-3 items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl || `https://www.google.com/s2/favicons?domain=${it.sourceDomain || 'example.com'}&sz=64`}
                  alt=""
                  className="w-14 h-14 object-cover rounded bg-gray-100"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/items/${it.id}`} className="font-medium hover:underline line-clamp-1">
                      {it.title}
                    </Link>
                    <span className="text-xs text-gray-500">({it.type})</span>
                    <span className="text-xs text-gray-500">score {Math.round(it.score)}</span>
                  </div>
                  {it.summary ? (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">{it.summary}</p>
                  ) : null}
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                    <span>{it.sourceName || it.sourceDomain}</span>
                    <span>·</span>
                    <span>{new Date(it.publishedAt).toLocaleString()}</span>
                    {it.revision && it.revision > 1 ? (
                      <>
                        <span>·</span>
                        <span>rev {it.revision}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <form method="POST" action={`/api/admin/items/${it.id}/toggle`} target="_blank">
                    <button
                      type="submit"
                      className="px-3 h-9 rounded bg-rose-600 text-white hover:bg-rose-700"
                      title="在新窗口触发接口（需 Basic Auth），操作完成后点击“刷新列表”"
                    >
                      下线/恢复
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
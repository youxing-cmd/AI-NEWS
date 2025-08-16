'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ItemCard, { type Item } from '@/components/ItemCard';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function useQueryParams() {
  const params = useSearchParams();
  const router = useRouter();

  function setParam(key: string, value?: string | null) {
    const p = new URLSearchParams(params.toString());
    if (value && value.length > 0) p.set(key, value);
    else p.delete(key);
    router.push('?' + p.toString());
  }

  return {
    params,
    setParam
  };
}

export default function HomePage() {
  const { params, setParam } = useQueryParams();
  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const date = params.get('date') || '';
  const source = params.get('source') || '';
  const limit = 30;

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const apiUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (type) p.set('type', type);
    if (date) p.set('date', date);
    if (source) p.set('source', source);
    p.set('limit', String(limit));
    return `/api/items?${p.toString()}`;
  }, [q, type, date, source]);

  const { data, isLoading } = useSWR(apiUrl, fetcher, { revalidateOnFocus: false });
  const items: Item[] = data?.items || [];

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">AI News</h1>
        <p className="text-sm text-gray-600 mt-1">
          每日 4 次自动采集 · 去重聚合 · 评分排序 · 支持日期/类型/来源筛选与搜索（按 "/" 聚焦搜索框）
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end mb-4">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">搜索</label>
          <input
            ref={searchInputRef}
            placeholder="关键词..."
            defaultValue={q}
            onChange={(e) => setParam('q', e.target.value)}
            className="h-9 px-3 border rounded outline-none focus:ring"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">类型</label>
          <select
            value={type}
            onChange={(e) => setParam('type', e.target.value || null)}
            className="h-9 px-3 border rounded"
          >
            <option value="">全部</option>
            <option value="NEWS">新闻</option>
            <option value="PAPER">论文</option>
            <option value="VIDEO">视频</option>
            <option value="ANNOUNCEMENT">公告</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setParam('date', e.target.value || null)}
            className="h-9 px-3 border rounded"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">来源域名</label>
          <input
            placeholder="例如: openai.com"
            defaultValue={source}
            onChange={(e) => setParam('source', e.target.value)}
            className="h-9 px-3 border rounded"
          />
        </div>
      </section>

      {isLoading ? (
        <div className="py-10 text-center text-gray-500">加载中...</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-gray-500">暂无数据</div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <ItemCard key={it.id} item={it} />
          ))}
        </section>
      )}
    </main>
  );
}
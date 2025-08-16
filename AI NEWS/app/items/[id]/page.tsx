import Link from 'next/link';

async function getItem(id: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/items/${id}`, {
    // 每次请求新鲜数据，满足 5 分钟内可展示
    cache: 'no-store'
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const item = await getItem(params.id);
  if (!item) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">未找到该条目或不可展示。</p>
        <Link className="text-blue-600 underline mt-4 inline-block" href="/">返回首页</Link>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link className="text-blue-600 underline" href="/">返回首页</Link>
      <article className="mt-4">
        <h1 className="text-2xl font-bold leading-snug">{item.title}</h1>
        <div className="text-sm text-gray-500 mt-2 flex flex-wrap gap-2">
          <span>{item.sourceName || item.sourceDomain}</span>
          <span>·</span>
          <span>{new Date(item.publishedAt).toLocaleString()}</span>
          <span>·</span>
          <span className="uppercase">{item.type}</span>
          <span>·</span>
          <span>score {Math.round(item.score)}</span>
          {item.revision && item.revision > 1 ? (
            <>
              <span>·</span>
              <span>rev {item.revision}</span>
            </>
          ) : null}
        </div>

        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="mt-4 w-full max-h-[420px] object-cover rounded" />
        ) : null}

        {item.summary ? (
          <p className="mt-4 text-base leading-relaxed">{item.summary}</p>
        ) : null}

        {item.content ? (
          <div
            className="prose max-w-none mt-6"
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
        ) : null}

        <div className="mt-6 flex gap-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 h-10 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            前往原文
          </a>
        </div>
      </article>
    </main>
  );
}
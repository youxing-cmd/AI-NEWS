import Image from 'next/image';
import Link from 'next/link';

export type Item = {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  sourceName: string | null;
  sourceDomain: string | null;
  type: 'NEWS' | 'PAPER' | 'VIDEO' | 'ANNOUNCEMENT';
  tags?: string[];
  publishedAt: string | Date;
  score: number;
  clusterId?: string | null;
  revision?: number;
};

function formatDate(d: string | Date) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString();
}

export default function ItemCard({ item }: { item: Item }) {
  const href = `/items/${item.id}`;
  const img = item.imageUrl || `https://www.google.com/s2/favicons?domain=${item.sourceDomain || 'example.com'}&sz=64`;
  return (
    <article className="rounded-lg border p-4 hover:shadow transition">
      <div className="flex gap-3">
        <div className="relative w-24 h-24 flex-shrink-0 rounded overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug line-clamp-2">
            <Link href={href} className="hover:underline">{item.title}</Link>
          </h3>
          {item.summary ? (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
          ) : null}
          <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
            <span>{item.sourceName || item.sourceDomain}</span>
            <span>·</span>
            <span>{formatDate(item.publishedAt)}</span>
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
        </div>
      </div>
    </article>
  );
}
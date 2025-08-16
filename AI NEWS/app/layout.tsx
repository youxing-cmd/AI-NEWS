import './globals.css';

export const metadata = {
  title: 'AI News - 每日 AI 资讯聚合',
  description: '自动化采集、去重聚合与评分排序，展示每日 AI 新闻、论文、视频与公告。'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
# AI NEWS - 每日自动化收集 AI 资讯

Next.js 14（App Router, TS）+ Prisma(Postgres) + BullMQ(Redis) + RSS/API 抓取 + 去重/聚合 + 评分排序 + 后台管理 + 监控 + Docker 一键启动。

## 快速开始

1) 准备环境变量（可直接使用默认）
```
cp .env.example .env
```

2) 一键构建运行
```
docker-compose up --build
```

启动后：
- Web: http://localhost:3000
- 健康检查: http://localhost:3000/api/health
- 指标: http://localhost:3000/api/metrics
- RSS 输出: http://localhost:3000/rss.xml
- Sitemap: http://localhost:3000/sitemap.xml
- 管理后台: http://localhost:3000/admin （Basic Auth，默认 admin / admin123）

首次启动 Worker 会自动排队一次抓取任务；之后每天 02:00、08:00、14:00、20:00 自动运行抓取；每天 03:00、09:00、15:00、21:00 重算分。

如需示例数据：
```
# 本机安装依赖后执行
npm install
npm run db:deploy
npm run seed
```

## 目录结构（关键）

- app/ 前端页面与 API（Route Handlers）
  - api/health | api/metrics | api/items | api/admin/*
  - items/[id] 详情页 | rss.xml | sitemap.xml | admin 管理页
- worker/ BullMQ 队列与流水线
  - sources.ts 来源定义
  - pipeline/ 抓取（RSS）、评分与入库去重聚合
- prisma/ 数据模型（Postgres）
- lib/ env/prisma/redis/logger/rateLimit/metrics 等通用模块
- utils/ hash 与 simhash
- public/ manifest 与 robots

## 数据模型（Prisma 摘要）

- Source(id, name, domain, credibility, rssUrl?)
- Item(id, url, urlHash unique, title, summary?, content?, imageUrl?, source*, type, tags[], publishedAt, dayKey, simhash, revision, disabled, social*, score, clusterId?, createdAt, updatedAt)
- Cluster(id, topic, representativeItemId?)

核心索引：urlHash unique、(score,publishedAt)、dayKey、publishedAt、sourceDomain

## 抓取与处理流水线

- 调度：BullMQ repeatable jobs
  - fetch: 0 2,8,14,20 * * *（TZ=America/New_York）
  - recompute: 0 3,9,15,21 * * *
- 流程：sources -> fetch(RSS/API) -> normalize -> deduplicate/replace -> cluster -> score -> persist -> cache bust
- 去重：
  - URL 哈希完全相同：跳过
  - 标题+摘要 simhash Hamming 距离 <= 5：跳过
  - 来源相同且文本显著变化且发布时间更新：revision+1 并更新内容
  - 来源不同：插入新记录
- 聚类：近 3 天同类型按 simhash 距离 <= 8 合并到同簇
- 评分：时间衰减（半衰期 48 小时）+ 来源可信度 + 关键词 + 社交信号

## 前端功能

- 首页：标题+图片+摘要卡片瀑布流，筛选（日期/类型/来源），搜索（"/" 聚焦）
- 详情页：完整内容与原文跳转，同源元信息展示
- 归档：RSS、Sitemap
- PWA：next-pwa（生产启用），manifest 已提供
- SEO：sitemap.xml、rss.xml，远程图片白名单

## 管理后台

- 位置：/admin（Basic Auth 或在中间件中自定义）
- 能力：
  - 立即抓取/重算分（/api/admin/trigger）
  - 下线/恢复条目（/api/admin/items/[id]/toggle）
- 公开接口默认过滤 disabled=false

## 安全与合规

- CORS 白名单（middleware.ts）
- Rate Limit（Redis 固定窗口）
- Helmet 等同等安全头（next.config.mjs headers）
- 合规过滤：若摘要/正文/元信息包含“未经允许/不得转载/版权所有 未经授权不得转载/禁止转载”则丢弃
- robots.txt 开放抓取（可按需调整）
- JWT（服务到服务）留作扩展；当前 Admin 走 Basic Auth

## 监控与日志

- /api/health：数据库与 Redis 健康状态
- /api/metrics：Prometheus 兼容文本（简版）
- 日志：pino（本地 pretty）

## 部署指南

- Docker：仓库自带 Dockerfile.web / Dockerfile.worker 与 docker-compose
- Vercel（前端）+ Render/Fly.io（后端/Worker）：
  - 前端仅部署 Next.js 静态/SSR；后端 API 与 Worker 建议在 Render/Fly.io 运行（提供 Postgres/Redis）
  - 环境变量按 .env.example 配置
- 反向代理（可选）：Nginx 前置缓存静态与 /rss.xml

## CI/CD（GitHub Actions）

- .github/workflows/ci.yml：在 PR/Push 执行安装、类型生成与构建

## 自测步骤与验收清单

- [ ] docker-compose up --build 后服务可用，/api/health 正常，Prisma 自动迁移（无迁移回退 db push）
- [ ] Worker 已注册 4 次/日的抓取任务，并首次启动已自动入队一次抓取
- [ ] /admin 可通过 Basic Auth 访问，按钮可触发“立即抓取/重算分”
- [ ] 抓取完成后 5 分钟内首页可展示新数据，列表按 score desc + publishedAt desc 排序
- [ ] 重复数据：URL 相同或 simhash 距离 <= 5 被丢弃；同源显著更新会 revision+1
- [ ] 合规过滤：包含“未经允许/不得转载/版权所有 未经授权不得转载/禁止转载”的条目不展示
- [ ] 日期筛选返回当天数据；多次抓取自然替换列表
- [ ] RSS/sitemap 正常；metrics/health 正常

## 常见问题

- 本地编辑器 TypeScript 报缺少类型（如 node/swr/next 等）：安装依赖后即消失；容器内不受影响
- 首次无迁移：启动脚本回退到 prisma db push
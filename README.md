# VibeWeave 🎵

AI 驱动的音乐情绪编织工具。不是推荐音乐，而是帮你编织情绪。

## 功能

- 🎶 **多平台歌单导入** — 支持网易云音乐、QQ音乐、Spotify
- 🧠 **AI 情绪分析** — 基于歌词和元数据的多维度情绪解析
- 📊 **情绪可视化** — 散点图 + 雷达图展示歌单情绪分布
- 💬 **自然语言控制** — 用日常语言描述你想要的氛围，AI 自动编排
- 🏷️ **自定义标签** — 为歌曲创建和管理自定义情绪标签
- 🔒 **拖拽排序** — 手动或 AI 自动编排歌曲顺序

## 技术栈

- [Astro](https://astro.build) 6 + React 19 (Islands Architecture)
- [TailwindCSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) (Auth, Database, Edge Functions)
- [Chart.js](https://www.chartjs.org/) (情绪可视化)
- OpenAI / NVIDIA (AI 情绪分析)

## 部署

部署在 [GitHub Pages](http://cgartlab.com/vibeweave/)，通过 GitHub Actions 自动构建和部署。

## 本地开发

```bash
npm install
npm run dev
```

## 环境变量

参见 `.env.example` 配置 Supabase 和 AI 服务。

## License

MIT

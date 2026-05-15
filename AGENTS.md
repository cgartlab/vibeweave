# AGENTS.md — vibeweave

**Generated:** 2026-05-14
**Mode:** init
**分层**: 产品 (Products) — 个人产品线

## OVERVIEW

Mood-to-music playlist generator. Users describe a vibe, AI analyzes it, Supabase Edge Functions build playlists from NetEase/wrapped providers. Three AI backends: OpenAI, NVIDIA, Local (Ollama).

## STRUCTURE

```
src/
├── components/         # React components
│   ├── auth/           # Supabase SSR auth UI
│   ├── playlist/       # Playlist display & interaction
│   ├── ui/             # Shared UI primitives
│   └── weave/          # Core weaving interface
├── layouts/            # BaseLayout.astro (shell)
├── lib/                # Business logic
│   ├── ai/             # Providers: openai, nvidia, local (ollama)
│   ├── music/          # Adapter, crypto, netease source
│   └── supabase/       # Client/server client init
├── pages/              # Astro routes
│   ├── auth/           # Auth callback/actions
│   └── weave/          # Weave flow pages
├── styles/global.css   # Tailwind CSS 4 entry
└── types.ts            # Shared TS types
supabase/
├── functions/          # Edge Functions
│   ├── analyze-batch/  # Batch mood analysis
│   ├── analyze-song/   # Single song analysis
│   ├── fetch-playlist/ # Playlist retrieval
│   └── parse-command/  # NL command parsing
└── migrations/         # DB schema (3 migrations)
public/assets/          # Static media (audio, images, videos)
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| AI provider logic | `src/lib/ai/` — provider files + prompt templates |
| Music source integration | `src/lib/music/adapter.ts` + `netease.ts` |
| Crypto / DRM | `src/lib/music/crypto.ts` (crypto-js + node-forge) |
| Supabase Edge Functions | `supabase/functions/*/index.ts` |
| DB schema | `supabase/migrations/` |
| Auth pages | `src/pages/auth/` + `src/components/auth/` |
| Weave UI | `src/components/weave/` — drag-and-drop via @dnd-kit |
| Charts | `src/components/playlist/` — chart.js + react-chartjs-2 |
| Route config | `src/pages/` — Astro file-based routing |
| Env schema | `astro.config.mjs` — Astro 6 env schema |
| Deploy target | `astro.config.mjs` — `DEPLOY_TARGET=netlify` switches adapter |

## CONVENTIONS

- **No pnpm** — npm only (packageManager not set)
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin, not PostCSS config
- **Astro 6 env** — all env vars declared in `astro.config.mjs` schema, not `import.meta.env` directly
- **Edge Functions** — Supabase Functions for server-side work, not Astro API routes
- **React 19** — all interactive UI is React components in `src/components/`
- **Supabase SSR** — `src/lib/supabase/client.ts` (browser) / `server.ts` (server) pattern

## COMMANDS

```bash
npm run dev          # astro dev
npm run build        # astro build
npm run preview      # astro preview
```

## CI/CD

- **GitHub Actions** — `.github/workflows/deploy.yml` (GitHub Pages 部署，备用路径)
- **主要部署**: Vercel（默认）或 Netlify（`DEPLOY_TARGET=netlify`），通过 Git 集成自动部署
- **GitHub Pages 工作流**: push main → `npm install` → `npm run build` → upload dist/ → deploy
- **Node 版本**: 22

## ENV VARS

声明在 `astro.config.mjs` 的 `env.schema` 中（Astro 6 env 模式）：

| 变量 | 类型 | 用途 |
|------|------|------|
| `SITE_URL` | public/server? | 站点 URL |
| `PUBLIC_GA_MEASUREMENT_ID` | public/client | Google Analytics |
| `PUBLIC_GTM_ID` | public/client | Google Tag Manager |
| `RESEND_API_KEY` | secret/server | Resend 邮件 API |
| `RESEND_FROM_EMAIL` | secret/server | 发件邮箱 |
| `NEWSLETTER_API_KEY` | secret/server | 新闻通讯 API |
| `GOOGLE_SITE_VERIFICATION` | public/server | Google Search Console |
| `BING_SITE_VERIFICATION` | public/server | Bing Webmaster |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | public/client | Google Maps |
| `PUBLIC_CONSENT_ENABLED` | boolean/client | Cookie 同意开关 |
| `PUBLIC_PRIVACY_POLICY_URL` | public/client | 隐私政策 URL |

另需 Supabase 环境变量（`.env.local`）:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` 或 `NVIDIA_API_KEY`

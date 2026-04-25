# Git Code Metrics

An engineering productivity dashboard that connects to a self-hosted **Gitea** instance and tracks commits, pull requests, review activity, and delivery flow per engineer and team.

---

## Features

- Per-engineer stats: commits, PRs created/merged, active days, streaks, score
- PR list per engineer with type badge (feature / bug / refactor / chore / docs / test), state, and merge time
- Team dashboard: KPIs, PR type breakdown, activity chart, leaderboard
- Weekly trend arrows — score and rank delta vs the previous week
- AI-assisted PR tracking via configurable label (default: `cs_used`)
- CSV and JSON export
- IndexedDB persistence — last fetch survives page refresh
- Virtualised lists — handles large teams without slowdown

---

## Requirements

- Node.js 18+
- A running [Gitea](https://gitea.io) instance
- A Gitea personal access token with **Read** permissions on `user`, `repository`, and `issue`

---

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173` → **Settings** and configure:

| Field | Description |
|---|---|
| Gitea URL | Base URL, e.g. `https://gitea.example.com` |
| Access Token | From `<gitea-url>/user/settings/applications` |
| Repositories | One or more `owner/repo` values |
| Date Range | 7d · 30d · 90d · 180d · 1y |

---

## Build

```bash
npm run build   # TypeScript check + Vite bundle → dist/
```

Serve `dist/` with nginx, Caddy, or any static host.

> **Production CORS proxy required**
>
> The Vite dev-server proxy (`/gitea-api/*`) only exists in development.
> In production, add a reverse-proxy route to forward `/gitea-api/*` to your Gitea instance.
>
> **nginx**
> ```nginx
> location /gitea-api/ {
>     proxy_pass         https://your-gitea-host/;
>     proxy_set_header   Host              your-gitea-host;
>     proxy_set_header   Authorization     $http_authorization;
>     proxy_ssl_server_name on;
> }
> ```
>
> **Caddy**
> ```caddy
> handle /gitea-api/* {
>     uri strip_prefix /gitea-api
>     reverse_proxy https://your-gitea-host {
>         header_up Host {upstream_hostport}
>         header_up Authorization {http.request.header.Authorization}
>     }
> }
> ```

---

## Project Structure

```
src/
├── api/gitea.ts          # Gitea REST client — pagination, AbortSignal, CORS proxy
├── components/           # Shared UI: charts, leaderboard, skeleton loaders, virtual list
├── hooks/useAnalytics.ts # React Query fetching + derived hooks
├── pages/                # Dashboard · Engineers · EngineerDetail · Activity · Settings
├── store/
│   ├── db.ts             # IndexedDB snapshots + weekly history (idb-keyval)
│   ├── history.ts        # Weekly trend computation
│   └── settings.ts       # localStorage settings
├── types/index.ts        # All TypeScript interfaces
└── utils/scoring.ts      # Metric computation — scoring, PR classification, streaks
```

---

## Tech Stack

- [Vite 8](https://vitejs.dev) + [React 19](https://react.dev) + [TypeScript 6](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [TanStack Query v5](https://tanstack.com/query) — data fetching + localStorage cache
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) — IndexedDB persistence
- [Recharts](https://recharts.org) — activity charts
- [react-window](https://react-window.vercel.app) — virtualised lists

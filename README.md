# Polira

A team task tracker for **Pacwin India** — a political-consulting workspace with a
Kanban board, typed work-items under projects (epics), role-based access
(Admin / Manager / Member), an org-hierarchy tree, per-person performance profiles
(3D figure + charts + AI insight), and a WhatsApp ticket importer.

Built with **React 19 + Vite + TypeScript + framer-motion**, a small **Node/Express**
backend for **Google OAuth + Google Sheets** sync, **three.js** (react-three-fiber) for the
3D profile figure, and **recharts** for analytics.

> **Access requires Google sign-in.** Polira is gated to **@pacwinindia.com** accounts —
> with no session you only see the login screen. Each person's role (Admin / Manager /
> Member) comes from their employee record / email mapping. This applies in local dev too,
> so you must configure Google OAuth (below) to use the app anywhere.

## Local development

```bash
npm install
npm run dev          # frontend only (demo mode) at http://localhost:5173
# or, with the backend (Google login + Sheets):
cp .env.example .env # fill in your Google OAuth + Sheet values
npm run dev:all      # frontend (5173) + API server (3001)
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server (frontend, demo mode) |
| `npm run dev:all` | Frontend + Express API together |
| `npm run build` | Type-check + build the frontend to `dist/` |
| `npm start` | Production server — serves the API **and** the built `dist/` |
| `npm run lint` | ESLint |

## Deploy to Render (single web service)

The Express server serves both the API and the built frontend, so the whole app is **one**
Render service (no separate frontend host needed).

1. Push this repo to GitHub (see below).
2. In Render: **New -> Blueprint**, pick the repo. It reads [`render.yaml`](render.yaml):
   - Build: `npm install --include=dev && npm run build`
   - Start: `npm start`
3. **Google OAuth is required** (the app gates all access behind sign-in). Set these in the
   Render dashboard once you know your URL (`https://<app>.onrender.com`):
   - `FRONTEND_ORIGIN=https://<app>.onrender.com`
   - `GOOGLE_REDIRECT_URI=https://<app>.onrender.com/api/auth/google/callback`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (from Google Cloud), `GOOGLE_SHEET_ID`
   - `PACWIN_ADMIN_EMAILS` / `PACWIN_MANAGER_EMAILS` / `PACWIN_MEMBER_EMAILS`
   - add that same redirect URI to your Google Cloud OAuth client's "Authorized redirect URIs".
   Until these are set, the deployed app will show the login screen but sign-in will fail.

> Render's free tier sleeps when idle (~30s cold start). The 3D/charts code is lazy-loaded
> so first paint stays light.

## Publish to GitHub

```bash
git remote add origin https://github.com/<you>/polira.git
git push -u origin main
```

`.env` and local screenshots are gitignored — **never commit secrets**.

## Environment variables

See [`.env.example`](.env.example) for the full list (Google OAuth, Sheet ID, role-email
mapping, optional `ANTHROPIC_API_KEY` for real LLM insights).

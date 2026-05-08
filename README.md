# PharmaPro — Pharmacy Management System

Complete pharmacy management: inventory, expiry tracking, sales POS, purchases, suppliers, reports.

## Setup

1. Create Supabase project at supabase.com
2. Run `supabase-schema.sql` in SQL Editor
3. Copy `.env.local.example` → `.env.local` and fill values
4. Add `https://your-app.vercel.app/auth/callback` to Supabase Redirect URLs

## Run locally
```bash
npm install
npm run dev
```

## Deploy
Push to GitHub → import to Vercel → add env vars → deploy.

# PixelSeller (marketplace-image-gen) — Project Notes

PixelSeller / ImgGen: internal web app (Next.js 14 + Tailwind + Supabase + Sharp/canvas)
for generating marketplace product covers (Shopee, Tokopedia, TikTok Shop) in bulk.

## Owner

- Owner is a **non-technical user** (not a programmer). Explain things in plain,
  simple language. Avoid jargon; when jargon is unavoidable, give a short analogy.
- Communicate casually in Indonesian when the owner does.

## Auto-deploy workflow (IMPORTANT — standing instruction)

The owner wants every change deployed automatically so they can check it live
right away. For ANY request (optimization, new feature, bug fix, etc.):

1. Make the change on the development branch.
2. Verify it builds (`npm run build`). Note: build needs Supabase env vars; locally
   use dummy values, e.g. `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Commit and push the development branch.
4. **Deploy live**: fast-forward `main` to the change and push `main`. Vercel is
   connected to this repo and auto-deploys `main` to production
   (https://pixelseller.my.id).
5. Tell the owner it's live and roughly when to check.

Do NOT wait for extra confirmation before deploying — auto-deploy is pre-authorized
for normal changes. (Still pause to ask if a change is risky/destructive or could
break the live site, e.g. DB schema changes, deleting data, large refactors.)

## Infrastructure

- **GitHub**: main repo is `apriliahildar-sketch/marketplace-image-gen` (remote
  `origin`, owned by Aprilia since Nov 2026). The old team repo
  `marketplaceminkla-debug/marketplace-image-gen` (remote `team`) fed the old
  Vercel project in ex-staffer Alfin's account — no longer the source of truth.
- **Vercel**: project `marketplace-image-gen` in Aprilia's team `marketplace-kla`
  (Hobby), connected via Git integration to `origin`; `main` = production.
  Push to `main` auto-deploys. Domain pixelseller.my.id (DNS at Rumahweb).
  Env vars (Supabase URL/keys, CRON_SECRET, STORAGE_LIMIT_BYTES) live in Vercel.
- **Supabase project**: `quayxqrifysgymfntmfj` (Pro plan).
- **Supabase**: storage bucket `product-photos` (public) for Shopee image URLs;
  schema in `supabase-setup.sql`. No direct dashboard/CLI access from here — for DB
  changes, prepare SQL and hand the owner exact steps to run in the Supabase SQL Editor.

## Theming

- Light/dark mode via Tailwind `darkMode: "class"`. Toggle is `src/components/ui/ThemeToggle.tsx`
  (fixed top-right). Dark mode is implemented by remapping the hardcoded slate/white
  palette utilities under a `.dark` scope in `src/app/globals.css` (no-flash init
  script lives in `src/app/layout.tsx`). When adding new UI, prefer the existing
  slate/white utilities so dark mode keeps working automatically.

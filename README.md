# SheetSage Website

Static website pages for SheetSage.

## Pages

- `index.html` - homepage / marketing
- `pricing.html` - pricing
- `privacy.html` - privacy policy
- `terms.html` - terms of service
- `sheetsage-vs-manual-auditing.html` - comparison page (SheetSage vs manual auditing)
- Guides:
  - `silent-spreadsheet-errors.html` (pillar)
  - `vlookup-approximate-match.html` (R1)
  - `vlookup-column-index-risk.html` (R2)
  - `match-exact-vs-approx.html` (R3)
  - `absolute-references-anchor-drift.html` (R4)
  - `magic-numbers-in-spreadsheets.html` (R5)

## SEO Implementation Notes

- **Clean URLs**: `vercel.json` uses `cleanUrls: true` so `/pricing` serves `pricing.html`.
- **Sitemap/robots**: generated during build and includes all `*.html` pages automatically.
- **Meta**: pages include canonical + OpenGraph + Twitter card tags.
- **Structured data**: pages include JSON-LD; CSP is updated with sha256 hashes (no `unsafe-inline`).
- **UX on guides**: auto-generated on-page TOC (`data-toc`) + sticky “Run a free scan” CTA after ~20% scroll.
- **OG image**: `assets/og.png` is referenced by OG/Twitter meta and copied to `dist/`.

### If you edit JSON-LD

Whenever you change a `<script type="application/ld+json">...</script>` block, regenerate CSP hashes:

```powershell
npm run update:csp-hashes
```

## Sitemap + robots

The build generates:
- `dist/sitemap.xml`
- `dist/robots.txt` (points at `.../sitemap.xml`)

To control the sitemap hostname (recommended for SEO), set `SITE_URL` (e.g. `https://example.com`).
If unset, the build falls back to `VERCEL_URL` (when available) or `http://localhost:5173`.

## Local preview

Build and run a local web server:

```powershell
npm install
npm run build
python -m http.server 5173 --directory dist
```

Then visit `http://localhost:5173/`.

## Notes

- The site avoids runtime CDN dependencies for CSS/icons:
  - Tailwind is prebuilt into `assets/tailwind.css`
  - Lucide (v0.562.0) is served locally from `assets/vendor/lucide.min.js`
- Install links point to the Google Workspace Marketplace listing.
- Shared assets:
  - `assets/tailwind.css`
  - `assets/site.css`
  - `assets/site.js`
  - `assets/favicon.svg`
  - `assets/og.png`
  - `assets/logo.png`
  - `assets/logo-wordmark.png`
  - `assets/demo-poster.svg`
  - `assets/vendor/lucide.min.js`

## Tailwind build

If you change HTML classes or want to refresh the CSS output:

```powershell
npm install
npm run build:css
```

## Demo video

The homepage demo section self-hosts `assets/demo.mp4`.

## Vercel deploy

This repo is configured for Vercel with:
- Build command: `npm run build`
- Output directory: `dist`
- Config: `vercel.json`

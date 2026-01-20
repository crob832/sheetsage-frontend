# SheetSage Website

Static website pages for SheetSage.

## Pages

- `index.html` - homepage / marketing
- `pricing.html` - pricing
- `privacy.html` - privacy policy
- `terms.html` - terms of service

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

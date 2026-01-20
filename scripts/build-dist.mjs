import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

function normalizeSiteUrl(siteUrl) {
  const trimmed = String(siteUrl || "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFsError(err) {
  if (!err || typeof err !== "object") return false;
  // @ts-ignore
  return ["EBUSY", "EPERM", "EACCES"].includes(err.code);
}

async function withRetries(fn, { attempts = 8, delayMs = 80 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= attempts || !isRetryableFsError(err)) throw err;
      await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}

async function copyFile(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await withRetries(() => fs.copyFile(source, destination), { attempts: 20, delayMs: 100 });
}

async function writeFile(destination, contents) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await withRetries(() => fs.writeFile(destination, contents), { attempts: 20, delayMs: 100 });
}

async function fingerprintFile(relativePath) {
  const data = await fs.readFile(path.join(ROOT, relativePath));
  const digest = crypto.createHash("sha256").update(data).digest("hex").slice(0, 10);
  const ext = path.extname(relativePath);
  const base = relativePath.slice(0, -ext.length);
  return `${base}.${digest}${ext}`;
}

function htmlFileToRoute(htmlFile) {
  if (htmlFile === "index.html") return "/";
  return `/${path.basename(htmlFile, ".html")}`;
}

async function generateSitemap({ htmlFiles }) {
  const configuredSiteUrl = normalizeSiteUrl(process.env.SITE_URL);
  const productionFallbackSiteUrl =
    process.env.VERCEL_ENV === "production" ? "https://sheetsage.co" : null;
  const vercelUrl = normalizeSiteUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const siteUrl = configuredSiteUrl || productionFallbackSiteUrl || vercelUrl || "http://localhost:5173";

  if (!configuredSiteUrl && vercelUrl) {
    console.warn("[build-dist] Note: SITE_URL not set; using VERCEL_URL for sitemap/robots.");
  } else if (!configuredSiteUrl && productionFallbackSiteUrl) {
    console.warn("[build-dist] Note: SITE_URL not set; using sheetsage.co for sitemap/robots.");
  } else if (!configuredSiteUrl && !vercelUrl) {
    console.warn("[build-dist] Note: SITE_URL not set; using localhost for sitemap/robots.");
  }

  const urlEntries = [];
  for (const htmlFile of htmlFiles) {
    const sourcePath = path.join(ROOT, htmlFile);
    const stat = await fs.stat(sourcePath);
    const route = htmlFileToRoute(htmlFile);

    const lastmod = new Date(stat.mtimeMs).toISOString().slice(0, 10);

    let changefreq = "monthly";
    let priority = "0.5";
    if (route === "/") {
      changefreq = "weekly";
      priority = "1.0";
    } else if (route === "/pricing") {
      changefreq = "monthly";
      priority = "0.8";
    } else if (route === "/privacy" || route === "/terms") {
      changefreq = "yearly";
      priority = "0.3";
    }

    const loc = `${siteUrl}${route === "/" ? "/" : route}`;
    urlEntries.push({ loc, lastmod, changefreq, priority });
  }

  urlEntries.sort((a, b) => a.loc.localeCompare(b.loc));

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urlEntries
      .map(
        ({ loc, lastmod, changefreq, priority }) =>
          "  <url>\n" +
          `    <loc>${escapeXml(loc)}</loc>\n` +
          `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` +
          `    <changefreq>${escapeXml(changefreq)}</changefreq>\n` +
          `    <priority>${escapeXml(priority)}</priority>\n` +
          "  </url>\n",
      )
      .join("") +
    "</urlset>\n";

  await writeFile(path.join(DIST, "sitemap.xml"), xml);
  await writeFile(
    path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );
}

async function main() {
  try {
    await withRetries(() => fs.rm(DIST, { recursive: true, force: true }), { attempts: 20, delayMs: 200 });
  } catch (err) {
    // On Windows, some processes temporarily lock files and deny delete.
    // In that case, we still want a usable output directory, so we overwrite in-place.
    console.warn("[build-dist] Warning: could not fully remove dist/, overwriting files in place.");
  }
  await fs.mkdir(DIST, { recursive: true });

  const htmlFiles = ["index.html", "pricing.html", "privacy.html", "terms.html"];

  const cacheBustedAssets = ["assets/tailwind.css", "assets/site.css", "assets/site.js"];
  const assetMapping = new Map();
  for (const assetPath of cacheBustedAssets) {
    const fingerprinted = await fingerprintFile(assetPath);
    assetMapping.set(assetPath, fingerprinted);

    await copyFile(path.join(ROOT, assetPath), path.join(DIST, assetPath));
    await copyFile(path.join(ROOT, assetPath), path.join(DIST, fingerprinted));
  }

  const filesToCopy = [
    "assets/favicon.svg",
    "assets/demo-poster.svg",
    "assets/demo.mp4",
    "assets/vendor/lucide.min.js",
  ];

  for (const relativePath of filesToCopy) {
    await copyFile(path.join(ROOT, relativePath), path.join(DIST, relativePath));
  }

  for (const htmlPath of htmlFiles) {
    let html = await fs.readFile(path.join(ROOT, htmlPath), "utf8");
    for (const [originalPath, fingerprintedPath] of assetMapping.entries()) {
      html = html.split(originalPath).join(fingerprintedPath);
    }
    await writeFile(path.join(DIST, htmlPath), html);
  }

  await generateSitemap({ htmlFiles });
}

await main();

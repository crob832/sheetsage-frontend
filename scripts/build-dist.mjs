import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

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
}

await main();

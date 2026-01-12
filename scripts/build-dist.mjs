import { promises as fs } from "node:fs";
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

async function main() {
  try {
    await withRetries(() => fs.rm(DIST, { recursive: true, force: true }), { attempts: 20, delayMs: 200 });
  } catch (err) {
    // On Windows, some processes temporarily lock files and deny delete.
    // In that case, we still want a usable output directory, so we overwrite in-place.
    console.warn("[build-dist] Warning: could not fully remove dist/, overwriting files in place.");
  }
  await fs.mkdir(DIST, { recursive: true });

  const filesToCopy = [
    "index.html",
    "pricing.html",
    "privacy.html",
    "terms.html",
    "assets/favicon.svg",
    "assets/site.css",
    "assets/site.js",
    "assets/tailwind.css",
    "assets/demo-poster.svg",
    "assets/demo.mp4",
    "assets/vendor/lucide.min.js",
  ];

  for (const relativePath of filesToCopy) {
    await copyFile(path.join(ROOT, relativePath), path.join(DIST, relativePath));
  }
}

await main();

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

async function copyFile(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  const filesToCopy = [
    "index.html",
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

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const VERCEL_JSON_PATH = path.join(ROOT, "vercel.json");

function normalizeLineEndings(text) {
  return String(text).replace(/\r\n?/g, "\n");
}

function parseCsp(value) {
  const directives = String(value || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  /** @type {Map<string, string[]>} */
  const map = new Map();
  for (const directive of directives) {
    const parts = directive.split(/\s+/).filter(Boolean);
    const name = parts.shift();
    if (!name) continue;
    map.set(name, parts);
  }
  return map;
}

function serializeCsp(map) {
  return Array.from(map.entries())
    .map(([name, parts]) => [name, ...parts].join(" ").trim())
    .filter(Boolean)
    .join("; ");
}

async function discoverHtmlFiles() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function extractJsonLdScripts(html) {
  const matches = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    matches.push(match[1]);
  }
  return matches;
}

function sha256Base64(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("base64");
}

async function main() {
  const htmlFiles = await discoverHtmlFiles();
  const hashes = new Set();

  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(path.join(ROOT, htmlFile), "utf8");
    const scripts = extractJsonLdScripts(html);
    for (const scriptText of scripts) {
      const normalized = normalizeLineEndings(scriptText);
      hashes.add(`'sha256-${sha256Base64(normalized)}'`);
    }
  }

  const sortedHashes = Array.from(hashes).sort((a, b) => a.localeCompare(b));
  if (sortedHashes.length === 0) {
    console.warn("[update-csp-hashes] No JSON-LD scripts found; skipping CSP update.");
    return;
  }

  const config = JSON.parse(await fs.readFile(VERCEL_JSON_PATH, "utf8"));
  const headers = Array.isArray(config.headers) ? config.headers : [];
  const rootHeader = headers.find((h) => h && h.source === "/(.*)" && Array.isArray(h.headers));
  if (!rootHeader) {
    throw new Error("[update-csp-hashes] Could not find headers source '/(.*)' in vercel.json.");
  }

  const cspHeader = rootHeader.headers.find((h) => h && h.key === "Content-Security-Policy");
  if (!cspHeader || typeof cspHeader.value !== "string") {
    throw new Error("[update-csp-hashes] Could not find Content-Security-Policy header in vercel.json.");
  }

  const csp = parseCsp(cspHeader.value);
  const scriptSrc = csp.get("script-src");
  if (!scriptSrc) {
    throw new Error("[update-csp-hashes] CSP is missing script-src directive.");
  }

  const baseScriptSrc = scriptSrc.filter((token) => !token.startsWith("'sha256-"));
  csp.set("script-src", [...baseScriptSrc, ...sortedHashes]);

  cspHeader.value = serializeCsp(csp);

  await fs.writeFile(VERCEL_JSON_PATH, JSON.stringify(config, null, 2) + "\n");
  console.log(`[update-csp-hashes] Updated CSP with ${sortedHashes.length} sha256 hash(es).`);
}

await main();


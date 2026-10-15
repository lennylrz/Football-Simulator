// Bundles the built game (dist/) and its data into one self-contained HTML
// file, for hosts that serve a single page. Run `npm run build` first.
// Usage: node scripts/build_single.mjs <output.html>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/build_single.mjs <output.html>');

const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
const asset = (re) => {
  const m = html.match(re);
  if (!m) throw new Error(`Missing asset ${re}`);
  return readFileSync(join(root, 'dist', m[1]), 'utf8');
};
const js = asset(/<script type="module" crossorigin src="\/([^"]+)"/);
const css = asset(/<link rel="stylesheet" crossorigin href="\/([^"]+)"/);
const dataDir = join(root, 'public/data');
const data = Object.fromEntries(
  readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(readFileSync(join(dataDir, f), 'utf8'))]),
);
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const page = `<title>Five Seasons</title>
<style>:root{color-scheme:dark}body{background:#020617;color:#f1f5f9}</style>
<style>${css}</style>
<div id="root"></div>
<script>window.__GAME_DATA__=${safe(JSON.stringify(data))};</script>
<script type="module">${safe(js)}</script>
`;
writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024 / 1024).toFixed(2)} MB`);

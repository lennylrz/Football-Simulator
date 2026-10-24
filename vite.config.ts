/// <reference types="vitest/config" />
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const SITE = 'https://five-seasons-football.vercel.app';

/** What a link to /daily shows when shared: the Daily Challenge's title, text and image. */
const DAILY: Record<string, string> = {
  title: 'Five Seasons Daily Challenge',
  description: 'A new football draft challenge every day: one rule, one attempt, the same seed for everyone. How far can you take your club?',
  url: `${SITE}/daily`,
  image: `${SITE}/og-daily.png`,
  alt: 'Five Seasons Daily Challenge: a new rule every day, one attempt each',
};

/**
 * Writes daily.html, the same page as index.html with the Daily Challenge's
 * link preview (vercel.json serves it at /daily).
 */
function dailyPage(): Plugin {
  return {
    name: 'daily-page',
    apply: 'build',
    async writeBundle(options) {
      const dir = options.dir ?? 'dist';
      const swap = (html: string, attr: string, key: string, value: string) =>
        html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), `$1${value}$2`);
      let html = await readFile(join(dir, 'index.html'), 'utf8');
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${DAILY.title}</title>`);
      for (const [key, value] of [['og:title', DAILY.title], ['og:description', DAILY.description], ['og:url', DAILY.url], ['og:image', DAILY.image], ['og:image:alt', DAILY.alt]]) {
        html = swap(html, 'property', key, value);
      }
      for (const [key, value] of [['twitter:title', DAILY.title], ['twitter:description', DAILY.description], ['twitter:image', DAILY.image], ['description', DAILY.description]]) {
        html = swap(html, 'name', key, value);
      }
      await writeFile(join(dir, 'daily.html'), html);
    },
  };
}

export default defineConfig({
  plugins: [react(), dailyPage()],
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000,
  },
});

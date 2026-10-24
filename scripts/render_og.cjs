// Renders the link preview images and app icons from scripts/og.html into public/.
// Needs Playwright with Chromium: node scripts/render_og.cjs
const { join } = require('node:path');
const { chromium } = require('playwright');

const out = join(__dirname, '..', 'public');
(async () => {
  const browser = await chromium.launch();
  const shot = async (part, size, file, scale = 1) => {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: scale });
    await page.goto(`file://${join(__dirname, 'og.html')}#${part}`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, file) });
    await page.close();
  };
  await shot('main', [1200, 630], 'og.png');
  await shot('daily', [1200, 630], 'og-daily.png');
  await shot('icon', [512, 512], 'icon-512.png');
  await shot('icon', [512, 512], 'icon-192.png', 192 / 512);
  await shot('icon', [512, 512], 'apple-touch-icon.png', 180 / 512);
  await shot('icon', [512, 512], 'favicon-32.png', 32 / 512);
  await browser.close();
})();

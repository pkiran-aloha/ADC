// Run after editing public/social-preview.svg. The PNG is the share-card asset.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let artwork = await readFile(new URL('../public/social-preview.svg', import.meta.url), 'utf8');
for (const font of ['geist', 'outfit']) {
  const name = `${font}-latin-wght-normal.woff2`;
  const bytes = await readFile(new URL(`../public/fonts/${name}`, import.meta.url));
  artwork = artwork.replace(`fonts/${name}`, `data:font/woff2;base64,${bytes.toString('base64')}`);
}
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;width:1200px;height:630px;overflow:hidden}svg{display:block}</style>${artwork}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('../public/social-preview.png', import.meta.url)) });
} finally { await browser.close(); }

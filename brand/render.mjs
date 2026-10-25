// Renders the Agave Lane Realty brand images from brand/mark.svg with headless Chromium (Playwright):
//   node brand/render.mjs preview        preview.png: the avatar variants and the logo, for choosing
//   node brand/render.mjs <variant>      avatar-1024.png, avatar-640.png and logo.png for one variant (a, b or c)
// Playwright is resolved from PLAYWRIGHT_FROM (a folder with playwright-core installed).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(`${process.env.PLAYWRIGHT_FROM ?? process.cwd()}/package.json`);
const { chromium } = require('playwright-core');
const dir = new URL('./', import.meta.url);
const mark = readFileSync(new URL('mark.svg', dir), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const color = { agave: '#2f6b57', sand: '#f4eee5', clay: '#b85a35', sun: '#e8b07e', ink: '#1e2a24' };

// A square avatar (chat apps crop it to a circle): the mark on a field, sometimes with a desert sun.
const VARIANTS = {
  a: { bg: color.agave, fg: '#ffffff', sun: null, label: 'A · white agave on green' },
  b: { bg: color.sand, fg: color.agave, sun: color.sun, label: 'B · green agave, sand and sun' },
  c: { bg: color.agave, fg: '#ffffff', sun: color.clay, label: 'C · white agave, clay sun' },
};

function avatar(v, size) {
  const m = mark.replace('<svg ', `<svg width="${size * 0.56}" height="${size * 0.56}" style="color:${v.fg};position:absolute;left:${size * 0.22}px;top:${size * 0.2}px" `);
  const sun = v.sun ? `<div style="position:absolute;width:${size * 0.34}px;height:${size * 0.34}px;border-radius:50%;background:${v.sun};left:${size * 0.5}px;top:${size * 0.17}px"></div>` : '';
  return `<div style="position:relative;width:${size}px;height:${size}px;background:${v.bg};overflow:hidden">${sun}${m}</div>`;
}

// The horizontal logo: the round avatar of the variant, then the name.
function logo(v, height) {
  return `<div style="display:flex;align-items:center;gap:${height * 0.28}px;padding:${height * 0.16}px ${height * 0.3}px ${height * 0.16}px ${height * 0.16}px">
    <div style="border-radius:50%;overflow:hidden">${avatar(v, height)}</div>
    <div><div style="font-family:Fraunces,serif;font-size:${height * 0.5}px;color:${color.ink};line-height:1.05">Agave Lane Realty</div>
    <div style="font-family:Inter,sans-serif;font-size:${height * 0.2}px;letter-spacing:.14em;text-transform:uppercase;color:${color.agave};margin-top:${height * 0.08}px">Phoenix, Arizona</div></div></div>`;
}

const fonts = '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&family=Inter:wght@500&display=swap" rel="stylesheet">';
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const shot = async (html, file, selector = 'body > *') => {
  await page.setContent(`<!doctype html><html><head>${fonts}<style>body{margin:0;background:transparent}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' });
  await page.locator(selector).first().screenshot({ path: new URL(file, dir).pathname.replace(/^\/([A-Z]:)/, '$1'), omitBackground: true });
  console.log('wrote', file);
};

const which = process.argv[2] ?? 'preview';
if (which === 'preview') {
  const cards = Object.values(VARIANTS).map((v) => `<figure style="margin:0;text-align:center;font:14px Inter,sans-serif;color:${color.ink}">
      <div style="display:flex;gap:16px;align-items:center">${avatar(v, 200)}<div style="border-radius:50%;overflow:hidden">${avatar(v, 120)}</div></div>
      <figcaption style="margin-top:10px">${v.label}</figcaption></figure>`).join('');
  await shot(`<div style="background:#fbf8f3;padding:32px;display:grid;gap:32px">
      <div style="display:flex;gap:40px">${cards}</div>
      <div style="background:#fff;border-radius:16px;display:inline-block;justify-self:start">${logo(VARIANTS.c, 96)}</div></div>`, 'preview.png');
} else {
  const v = VARIANTS[which];
  if (!v) throw new Error(`unknown variant ${which}: a, b or c`);
  await shot(avatar(v, 1024), 'avatar-1024.png');
  await shot(avatar(v, 640), 'avatar-640.png');
  await shot(logo(v, 160), 'logo.png');
}
await browser.close();

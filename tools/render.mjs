// Renders the extension icons and Chrome Web Store images with headless Chrome.
// Usage:  node tools/render.mjs            (icons + store images)
//         node tools/render.mjs icons      (icons only)
//
// Needs Google Chrome or Microsoft Edge installed. Set CHROME=<path> to override.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(tmpdir(), 'byroad-render');
mkdirSync(tmp, { recursive: true });

const browser = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));

if (!browser) {
  console.error('Chrome/Edge not found. Set CHROME=/path/to/chrome');
  process.exit(1);
}

function shoot(url, out, width, height, { transparent = false, scale = 1 } = {}) {
  mkdirSync(dirname(out), { recursive: true });
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${join(tmp, 'profile')}`,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${scale}`,
    `--screenshot=${out}`,
    '--virtual-time-budget=1500',
    '--blink-settings=preferredColorScheme=1', // render in light mode
  ];
  if (transparent) args.push('--default-background-color=00000000');
  args.push(url);
  execFileSync(browser, args, { stdio: 'ignore' });
  console.log('  ✓', out.replace(root, '.'));
}

function iconPage(svgFile, size) {
  const svg = readFileSync(join(root, 'tools', svgFile), 'utf8');
  const html =
    `<!doctype html><html><body style="margin:0;background:transparent">` +
    `<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</div>` +
    `</body></html>`;
  const file = join(tmp, `icon-${svgFile}-${size}.html`);
  writeFileSync(file, html);
  return pathToFileURL(file).href;
}

console.log('Icons');
const icons = [
  [16, 'icon-small.svg'],
  [32, 'icon-small.svg'],
  [48, 'icon.svg'],
  [128, 'icon.svg'],
];
for (const [size, svg] of icons) {
  shoot(iconPage(svg, size), join(root, 'extension', 'icons', `icon${size}.png`), size, size, { transparent: true });
}

if (process.argv[2] !== 'icons') {
  console.log('Store images');
  // The screenshots embed the real popup, fed by fake chrome.* APIs.
  const popupDir = pathToFileURL(join(root, 'extension', 'popup') + '/').href;
  const mock = pathToFileURL(join(root, 'tools', 'store', 'chrome-mock.js')).href;
  const preview = readFileSync(join(root, 'extension', 'popup', 'popup.html'), 'utf8')
    .replace('<head>', `<head>\n  <base href="${popupDir}">`)
    .replace('<script ', `<script src="${mock}"></script>\n  <script `)
    .replace('</head>', '  <style>*{transition:none!important}</style>\n</head>');
  const previewFile = join(root, 'tools', 'store', '.popup-preview.html');
  writeFileSync(previewFile, preview);

  const page = (name) => {
    const [file, query] = name.split('?');
    return pathToFileURL(join(root, 'tools', 'store', file)).href + (query ? '?' + query : '');
  };
  shoot(page('screenshot.html?shot=sites'), join(root, 'store', 'screenshot-1-sites.png'), 1280, 800);
  shoot(page('screenshot.html?shot=global'), join(root, 'store', 'screenshot-2-everything.png'), 1280, 800);
  shoot(page('promo.html?size=small'), join(root, 'store', 'promo-small-440x280.png'), 440, 280);
  shoot(page('promo.html?size=marquee'), join(root, 'store', 'promo-marquee-1400x560.png'), 1400, 560);
  rmSync(previewFile, { force: true });
}

rmSync(tmp, { recursive: true, force: true });

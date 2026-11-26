// End-to-end test: launches a browser with the unpacked extension, points it at
// two throwaway local proxies (HTTP and SOCKS5) that log which hosts reach them,
// then drives the real popup and checks what gets routed.
//
//   node tests/e2e.mjs
//
// Needs Microsoft Edge, Chromium or Chrome for Testing. Regular Google Chrome
// ignores --load-extension. Set BROWSER=<path> to choose one. Set SHOTS=<dir>
// to save popup screenshots.

import { spawn } from 'node:child_process';
import net from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const extDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const profile = mkdtempSync(join(tmpdir(), 'byroad-e2e-'));
const outDir = process.env.SHOTS;
if (outDir) mkdirSync(outDir, { recursive: true });
const browserPath = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/microsoft-edge',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));
if (!browserPath) {
  console.error('No suitable browser found. Set BROWSER=/path/to/msedge-or-chromium');
  process.exit(1);
}
const results = [];
const check = (name, ok, extra = '') => { results.push([ok, name]); console.log(ok ? 'PASS' : 'FAIL', name, extra); };

// ── Logging proxies: record target host, then close ───────────────────────────
const httpHits = [];
const httpProxy = net.createServer((sock) => {
  sock.once('data', (buf) => {
    const line = buf.toString().split('\r\n')[0];          // "CONNECT host:443 HTTP/1.1" or "GET http://host/ HTTP/1.1"
    const m = line.match(/^(?:CONNECT\s+([^:\s]+)|\w+\s+https?:\/\/([^/:\s]+))/);
    if (m) httpHits.push(m[1] || m[2]);
    sock.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n');
  });
  sock.on('error', () => {});
});
const socksHits = [];
const socksProxy = net.createServer((sock) => {
  let stage = 0;
  sock.on('data', (buf) => {
    if (stage === 0) { sock.write(Buffer.from([5, 0])); stage = 1; return; }
    if (buf[3] === 3) socksHits.push(buf.slice(5, 5 + buf[4]).toString());
    else if (buf[3] === 1) socksHits.push([...buf.slice(4, 8)].join('.'));
    sock.end(Buffer.from([5, 5, 0, 1, 0, 0, 0, 0, 0, 0]));  // connection refused
  });
  sock.on('error', () => {});
});
await new Promise((r) => httpProxy.listen(0, '127.0.0.1', r));
await new Promise((r) => socksProxy.listen(0, '127.0.0.1', r));
const HTTP_PORT = httpProxy.address().port, SOCKS_PORT = socksProxy.address().port;

// ── Browser ───────────────────────────────────────────────────────────────────
const child = spawn(browserPath, [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${profile}`,
  `--load-extension=${extDir}`, `--disable-extensions-except=${extDir}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=900,900', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

try {
  await sleep(4000);
  const version = await (await fetch('http://127.0.0.1:9334/json/version')).json();
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
    }
  });

  const { targetInfos } = await send('Target.getTargets');
  let extId = null;
  for (const t of targetInfos.filter((t) => t.type === 'service_worker')) {
    const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    const r = await send('Runtime.evaluate', { expression: 'chrome.runtime.getManifest().short_name', returnByValue: true }, sessionId).catch(() => null);
    if (r?.result?.value === 'Byroad') { extId = new URL(t.url).host; break; }
  }
  check('extension loaded', !!extId, extId || '');
  if (!extId) throw new Error('extension not found');

  const { targetId: popupTarget } = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup/popup.html` });
  const { sessionId: P } = await send('Target.attachToTarget', { targetId: popupTarget, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 340, height: 600, deviceScaleFactor: 2, mobile: false }, P);
  await sleep(800);

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }, P);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (name, emulateDark = false) => {
    if (!outDir) return;
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: emulateDark ? 'dark' : 'light' }] }, P);
    const h = await ev('return document.documentElement.scrollHeight');
    await send('Emulation.setDeviceMetricsOverride', { width: 340, height: h, deviceScaleFactor: 2, mobile: false }, P);
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, P);
    writeFileSync(`${outDir}/${name}.png`, Buffer.from(data, 'base64'));
  };
  const proxyValue = () => ev(`return (await chrome.proxy.settings.get({})).value`);
  const visit = async (url) => {
    const { targetId } = await send('Target.createTarget', { url, background: true });
    await sleep(1500);
    await send('Target.closeTarget', { targetId });
  };
  const setServer = (type, port) => ev(`
    const t = document.getElementById('proxyType'), h = document.getElementById('proxyHost'), p = document.getElementById('proxyPort');
    t.value = '${type}'; h.value = '127.0.0.1'; p.value = '${port}';
    p.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 400));`);
  const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click(); await new Promise(r => setTimeout(r, 400));`);

  // 1. Defaults
  check('starts off', (await ev(`return document.getElementById('status').textContent`)).startsWith('Off'));
  check('default mode is "Only my sites"', await ev(`return document.querySelector('.mode[data-mode=selective]').getAttribute('aria-checked') === 'true'`));
  await shot('popup-empty-light');

  // 2. Bad port blocks turning on
  await ev(`document.getElementById('proxyPort').value = '99999'; document.getElementById('proxyPort').dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 300));`);
  await click('#power');
  check('invalid port refuses to switch on', !(await ev(`return document.getElementById('power').checked`)));
  check('invalid port shows error', !(await ev(`return document.getElementById('serverError').hidden`)));

  // 3. HTTP proxy, per-site
  await setServer('http', HTTP_PORT);
  await ev(`document.getElementById('addInput').value = 'https://www.Example.com/page'; document.getElementById('addForm').requestSubmit(); await new Promise(r => setTimeout(r, 500));`);
  check('adding a site switches proxy on', await ev(`return document.getElementById('power').checked`));
  let v = await proxyValue();
  check('PAC mode applied', v.mode === 'pac_script', v.mode);
  check('site normalized to example.com', await ev(`return (await chrome.storage.local.get('proxiedDomains')).proxiedDomains.join()`) === 'example.com');

  httpHits.length = 0;
  await visit('http://example.com/');
  await visit('http://sub.example.com/');
  await visit('http://example.org/');
  check('example.com goes through proxy', httpHits.includes('example.com'), JSON.stringify(httpHits));
  check('subdomain goes through proxy', httpHits.includes('sub.example.com'));
  check('example.org stays direct', !httpHits.includes('example.org'));

  // 4. Presets
  await ev(`[...document.querySelectorAll('.chip')].find(b => b.textContent === 'YouTube').click(); await new Promise(r => setTimeout(r, 500));`);
  check('YouTube chip turns on', await ev(`return [...document.querySelectorAll('.chip')].find(b => b.textContent === 'YouTube').classList.contains('on')`));
  check('YouTube domains hidden from own list', await ev(`return [...document.querySelectorAll('#sites .host')].map(e => e.textContent).join() === 'example.com'`));
  await ev(`[...document.querySelectorAll('.chip')].find(b => b.textContent === 'Instagram').click(); await new Promise(r => setTimeout(r, 400));`);
  await ev(`[...document.querySelectorAll('.chip')].find(b => b.textContent === 'Facebook').click(); await new Promise(r => setTimeout(r, 400));`);
  await ev(`[...document.querySelectorAll('.chip')].find(b => b.textContent === 'Instagram').click(); await new Promise(r => setTimeout(r, 400));`);
  const doms = await ev(`return (await chrome.storage.local.get('proxiedDomains')).proxiedDomains`);
  check('removing Instagram keeps fbcdn.net for Facebook', doms.includes('fbcdn.net') && !doms.includes('instagram.com'));
  httpHits.length = 0;
  await visit('http://www.youtube.com/');
  check('youtube routed via preset', httpHits.includes('www.youtube.com'), JSON.stringify(httpHits));

  // 5. Open tabs list + bypass
  const { targetId: openTab } = await send('Target.createTarget', { url: 'http://news.example.net/', background: true });
  await sleep(1000);
  await ev(`location.reload()`).catch(() => {});
  await sleep(1200);
  check('open tab listed', await ev(`return [...document.querySelectorAll('#tabs .host')].some(e => e.textContent === 'news.example.net')`));
  await ev(`const li = [...document.querySelectorAll('#tabs li')].find(l => l.textContent.includes('news.example.net')); li.querySelector('input').click(); await new Promise(r => setTimeout(r, 500));`);
  check('ticking open tab adds it', (await ev(`return (await chrome.storage.local.get('proxiedDomains')).proxiedDomains`)).includes('news.example.net'));
  await shot('popup-sites-light');
  await shot('popup-sites-dark', true);
  await send('Target.closeTarget', { targetId: openTab });

  // 6. Global mode with SOCKS5 and a bypass entry
  await setServer('socks5', SOCKS_PORT);
  await click('.mode[data-mode=global]');
  await ev(`const b = document.getElementById('bypass'); b.value = 'example.org'; b.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 400));`);
  v = await proxyValue();
  check('global uses fixed_servers socks5', v.mode === 'fixed_servers' && v.rules.singleProxy.scheme === 'socks5', JSON.stringify(v.rules?.singleProxy));
  socksHits.length = 0;
  await visit('http://example.net/');
  await visit('http://example.org/');
  check('global: example.net through SOCKS5', socksHits.includes('example.net'), JSON.stringify(socksHits));
  check('global: bypassed example.org direct', !socksHits.includes('example.org'));
  check('badge says all', await ev(`return await chrome.action.getBadgeText({})`) === 'all');
  await shot('popup-global-light');

  // 7. Proxy unreachable → warning
  await setServer('socks5', 9);   // port 9 (discard): nothing listens there
  await visit('http://example.net/');
  await ev(`location.reload()`).catch(() => {});
  await sleep(1200);
  const alertText = await ev(`return document.getElementById('alert').hidden ? '' : document.getElementById('alert').textContent`);
  check('unreachable proxy warning shown', alertText.includes("Couldn't reach"), alertText);
  await shot('popup-error-light');

  // 8. Turning off restores system settings
  await click('#power');
  v = await proxyValue();
  check('off restores system proxy', v.mode === 'system', v.mode);
  check('badge cleared', await ev(`return await chrome.action.getBadgeText({})`) === '');
} catch (e) {
  check('no exceptions', false, e.stack);
} finally {
  try { ws?.close(); } catch {}
  child.kill();
  httpProxy.close(); socksProxy.close();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  const failed = results.filter((r) => !r[0]).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

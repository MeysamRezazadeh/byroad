'use strict';

importScripts('lib/domains.js');

var DEFAULTS = {
  proxyEnabled: false,
  proxyMode: 'selective',      // 'selective' = only listed sites, 'global' = everything
  proxyType: 'socks5',
  proxyUrl: '127.0.0.1',
  proxyPort: '10808',
  proxiedDomains: [],
  bypassList: [],
};

var ALWAYS_DIRECT = ['localhost', '127.0.0.1', '[::1]'];

function getSettings() {
  return chrome.storage.local.get(DEFAULTS);
}

// Chrome's PAC engine is strict: plain ES5 only, no helpers it doesn't know about.
function buildPac(s) {
  var scheme = { socks5: 'SOCKS5', socks4: 'SOCKS', http: 'PROXY', https: 'HTTPS' }[s.proxyType] || 'SOCKS5';
  var target = scheme + ' ' + s.proxyUrl + ':' + s.proxyPort;
  var routed = s.proxiedDomains.map(Domains.normalize).filter(Boolean);
  var direct = ALWAYS_DIRECT.concat(s.bypassList.map(cleanBypass).filter(Boolean));

  return [
    'var routed = ' + JSON.stringify(routed) + ';',
    'var direct = ' + JSON.stringify(direct) + ';',
    'function hit(h, d) { return h === d || (h.length > d.length && h.substr(h.length - d.length - 1) === "." + d); }',
    'function FindProxyForURL(url, host) {',
    '  var h = host.toLowerCase(), i;',
    '  if (isPlainHostName(h)) return "DIRECT";',
    '  for (i = 0; i < direct.length; i++) if (hit(h, direct[i])) return "DIRECT";',
    '  for (i = 0; i < routed.length; i++) if (hit(h, routed[i])) return ' + JSON.stringify(target) + ';',
    '  return "DIRECT";',
    '}',
  ].join('\n');
}

function cleanBypass(entry) {
  return String(entry || '').trim().toLowerCase().replace(/^\*\./, '');
}

function setProxy(value) {
  return new Promise(function (resolve, reject) {
    chrome.proxy.settings.set({ value: value, scope: 'regular' }, function () {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function clearProxy() {
  return new Promise(function (resolve) {
    chrome.proxy.settings.clear({ scope: 'regular' }, function () { resolve(); });
  });
}

async function apply() {
  var s = await getSettings();
  var port = parseInt(s.proxyPort, 10);
  var usable = s.proxyEnabled && s.proxyUrl && port > 0 && port < 65536;

  await chrome.storage.session.remove('lastProxyError');

  if (!usable) {
    await clearProxy();
  } else if (s.proxyMode === 'global') {
    await setProxy({
      mode: 'fixed_servers',
      rules: {
        singleProxy: { scheme: s.proxyType, host: s.proxyUrl, port: port },
        bypassList: ALWAYS_DIRECT.concat(['<local>'], s.bypassList.map(cleanBypass).filter(Boolean)),
      },
    });
  } else {
    await setProxy({ mode: 'pac_script', pacScript: { data: buildPac(s) } });
  }

  updateBadge(s, usable);
}

function updateBadge(s, active) {
  var text = '';
  if (active) text = s.proxyMode === 'global' ? 'all' : String(s.proxiedDomains.length);
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: '#1f6b4a' });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#ffffff' });
  chrome.action.setTitle({
    title: !active ? 'Byroad — off'
      : s.proxyMode === 'global' ? 'Byroad — all traffic through ' + s.proxyUrl + ':' + s.proxyPort
      : 'Byroad — ' + s.proxiedDomains.length + ' domains through ' + s.proxyUrl + ':' + s.proxyPort,
  });
}

// Messages from the popup
chrome.runtime.onMessage.addListener(function (msg, _sender, reply) {
  if (msg && msg.type === 'apply') {
    apply().then(
      function () { reply({ ok: true }); },
      function (err) { reply({ ok: false, error: String(err && err.message || err) }); }
    );
    return true;
  }
});

// Remember the last time the proxy couldn't be reached, so the popup can say so.
chrome.proxy.onProxyError.addListener(function (details) {
  chrome.storage.session.set({ lastProxyError: { error: details.error, at: Date.now() } });
});

// Right-click menu
function buildMenu() {
  chrome.contextMenus.removeAll(function () {
    var patterns = ['http://*/*', 'https://*/*'];
    chrome.contextMenus.create({ id: 'route-site', title: 'Use proxy for this site', contexts: ['page'], documentUrlPatterns: patterns });
    chrome.contextMenus.create({ id: 'unroute-site', title: 'Stop using proxy for this site', contexts: ['page'], documentUrlPatterns: patterns });
  });
}

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  var host;
  try { host = new URL(info.pageUrl || (tab && tab.url)).hostname; } catch (e) { return; }
  var domain = Domains.normalize(host);
  if (!domain) return;

  var s = await getSettings();
  var list = s.proxiedDomains.slice();

  if (info.menuItemId === 'route-site') {
    if (!Domains.findMatches(list, host).length) list.push(domain);
    await chrome.storage.local.set({ proxiedDomains: list, proxyEnabled: true, proxyMode: 'selective' });
  } else if (info.menuItemId === 'unroute-site') {
    var matches = Domains.findMatches(list, host);
    await chrome.storage.local.set({ proxiedDomains: list.filter(function (d) { return matches.indexOf(d) === -1; }) });
  }

  await apply();
  if (tab && tab.id >= 0) chrome.tabs.reload(tab.id);
});

chrome.runtime.onInstalled.addListener(function () {
  buildMenu();
  apply().catch(console.error);
});

chrome.runtime.onStartup.addListener(function () {
  apply().catch(console.error);
});

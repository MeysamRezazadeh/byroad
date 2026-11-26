'use strict';

var PRESETS = window.BYROAD_PRESETS;

var DEFAULTS = {
  proxyEnabled: false,
  proxyMode: 'selective',
  proxyType: 'socks5',
  proxyUrl: '127.0.0.1',
  proxyPort: '10808',
  proxiedDomains: [],
  bypassList: [],
};

var TYPE_LABEL = { socks5: 'SOCKS5', socks4: 'SOCKS4', http: 'HTTP', https: 'HTTPS' };

var s = Object.assign({}, DEFAULTS);
var activeTab = null;     // { id, host, favIconUrl }
var reloadHint = false;   // show "reload tab" after changing the current site

var $ = function (id) { return document.getElementById(id); };
var ui = {
  power: $('power'), powerText: $('powerText'),
  status: $('status'), alert: $('alert'),
  here: $('here'), hereIcon: $('hereIcon'), hereHost: $('hereHost'), hereState: $('hereState'), hereBtn: $('hereBtn'),
  modes: document.querySelectorAll('.mode'),
  type: $('proxyType'), host: $('proxyHost'), port: $('proxyPort'), serverError: $('serverError'),
  sitesBlock: $('sitesBlock'), presets: $('presets'), tabs: $('tabs'), tabsHead: $('tabsHead'),
  sites: $('sites'), siteCount: $('siteCount'),
  addForm: $('addForm'), addInput: $('addInput'),
  copyBtn: $('copyBtn'), pasteBtn: $('pasteBtn'), clearBtn: $('clearBtn'),
  pasteBox: $('pasteBox'), pasteText: $('pasteText'), pasteAdd: $('pasteAdd'), pasteCancel: $('pasteCancel'),
  bypass: $('bypass'),
  ipBtn: $('ipBtn'), ipResult: $('ipResult'), version: $('version'),
};

// ── Saving ───────────────────────────────────────────────────────────────────

async function save(patch) {
  Object.assign(s, patch);
  await chrome.storage.local.set(patch);
  var res = await chrome.runtime.sendMessage({ type: 'apply' });
  if (res && !res.ok) showAlert('Chrome rejected the proxy settings: ' + res.error);
  render();
  if (s.proxyMode === 'selective') renderTabs();
}

function serverProblem() {
  var host = s.proxyUrl.trim();
  var port = Number(s.proxyPort);
  if (!host) return 'Enter the proxy host.';
  if (/[\s/]/.test(host)) return 'The host should look like 127.0.0.1 or proxy.example.com.';
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 'The port must be a number from 1 to 65535.';
  return '';
}

function setDomains(list) {
  var patch = { proxiedDomains: list };
  if (list.length > s.proxiedDomains.length && !serverProblem()) patch.proxyEnabled = true;
  return save(patch);
}

function addDomains(domains) {
  var list = s.proxiedDomains.slice();
  domains.forEach(function (d) { if (d && list.indexOf(d) === -1) list.push(d); });
  return list.length === s.proxiedDomains.length ? Promise.resolve() : setDomains(list);
}

function removeDomains(domains) {
  return setDomains(s.proxiedDomains.filter(function (d) { return domains.indexOf(d) === -1; }));
}

function isRouted(host) {
  return Domains.findMatches(s.proxiedDomains, host).length > 0;
}

function isBypassed(host) {
  return s.bypassList.some(function (b) { return Domains.covers(b.replace(/^\*\./, ''), host); });
}

// ── Rendering ────────────────────────────────────────────────────────────────

function render() {
  var on = s.proxyEnabled;
  var selective = s.proxyMode === 'selective';
  var server = TYPE_LABEL[s.proxyType] + ' ' + s.proxyUrl + ':' + s.proxyPort;

  ui.power.checked = on;
  ui.powerText.textContent = on ? 'On' : 'Off';

  if (!on) {
    ui.status.textContent = 'Off. Every site connects directly.';
  } else if (!selective) {
    ui.status.innerHTML = 'All traffic goes through <b>' + esc(server) + '</b>';
  } else {
    var n = s.proxiedDomains.length;
    ui.status.innerHTML = n
      ? '<b>' + n + ' domain' + (n === 1 ? '' : 's') + '</b> go through <b>' + esc(server) + '</b>'
      : 'On, but no sites are picked yet.';
  }

  ui.modes.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mode === s.proxyMode)); });
  ui.sitesBlock.hidden = !selective;

  if (document.activeElement !== ui.host) ui.host.value = s.proxyUrl;
  if (document.activeElement !== ui.port) ui.port.value = s.proxyPort;
  ui.type.value = s.proxyType;
  if (document.activeElement !== ui.bypass) ui.bypass.value = s.bypassList.join('\n');

  renderHere();
  if (selective) {
    renderPresets();
    renderSites();
  }
}

function renderHere() {
  if (!activeTab) { ui.here.hidden = true; return; }
  ui.here.hidden = false;
  ui.hereHost.textContent = activeTab.host;
  ui.hereIcon.hidden = !activeTab.favIconUrl;
  if (activeTab.favIconUrl) ui.hereIcon.src = activeTab.favIconUrl;

  var usesProxy, label, action;
  if (s.proxyMode === 'selective') {
    usesProxy = isRouted(activeTab.host);
    action = usesProxy ? 'Stop' : 'Use proxy';
  } else {
    usesProxy = !isBypassed(activeTab.host);
    action = usesProxy ? 'Go direct' : 'Use proxy';
  }
  label = !s.proxyEnabled ? (usesProxy ? 'Will use proxy when on' : 'Connects directly')
        : usesProxy ? 'Using the proxy' : 'Connects directly';

  ui.here.classList.toggle('on', s.proxyEnabled && usesProxy);
  ui.hereBtn.textContent = action;
  ui.hereBtn.className = 'btn' + (usesProxy ? '' : ' primary');

  ui.hereState.textContent = label;
  if (reloadHint) {
    ui.hereState.append(' · ');
    var a = document.createElement('button');
    a.type = 'button';
    a.className = 'link';
    a.textContent = 'reload tab';
    a.addEventListener('click', function () { chrome.tabs.reload(activeTab.id); window.close(); });
    ui.hereState.append(a);
  }
}

function presetState(p) {
  var have = p.domains.filter(function (d) { return s.proxiedDomains.indexOf(d) !== -1; }).length;
  return have === p.domains.length ? 'on' : have ? 'partial' : 'off';
}

function renderPresets() {
  ui.presets.textContent = '';
  PRESETS.forEach(function (p) {
    var state = presetState(p);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state === 'off' ? '' : ' ' + state);
    b.textContent = p.name;
    b.title = (state === 'on' ? 'Click to remove: ' : 'Click to add: ') + p.domains.join(', ');
    b.addEventListener('click', function () {
      if (state !== 'on') return addDomains(p.domains);
      // Keep domains that another enabled service still needs (e.g. fbcdn.net).
      var keep = {};
      PRESETS.forEach(function (o) {
        if (o !== p && presetState(o) === 'on') o.domains.forEach(function (d) { keep[d] = true; });
      });
      removeDomains(p.domains.filter(function (d) { return !keep[d]; }));
    });
    ui.presets.append(b);
  });
}

function renderSites() {
  // Domains that belong to a fully enabled service are shown by its chip, not here.
  var fromPresets = {};
  PRESETS.forEach(function (p) {
    if (presetState(p) === 'on') p.domains.forEach(function (d) { fromPresets[d] = true; });
  });
  var own = s.proxiedDomains.filter(function (d) { return !fromPresets[d]; }).reverse();

  ui.siteCount.textContent = s.proxiedDomains.length ? s.proxiedDomains.length + ' total' : '';
  ui.sites.textContent = '';
  own.forEach(function (d) {
    var li = document.createElement('li');
    var name = document.createElement('span');
    name.className = 'host';
    name.textContent = d;
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Remove ' + d;
    x.addEventListener('click', function () { removeDomains([d]); });
    li.append(name, x);
    ui.sites.append(li);
  });

  var empty = document.getElementById('sitesEmpty');
  if (!s.proxiedDomains.length) {
    if (!empty) {
      empty = document.createElement('p');
      empty.id = 'sitesEmpty';
      empty.className = 'empty';
      empty.textContent = 'Nothing picked yet. Choose a service above, tick an open tab, or type a site.';
      ui.sites.after(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

var tabsRender = 0;
async function renderTabs() {
  var ticket = ++tabsRender;
  var tabs = await chrome.tabs.query({});
  if (ticket !== tabsRender) return;   // a newer render started meanwhile
  var seen = {};
  ui.tabs.textContent = '';
  tabs.forEach(function (t) {
    var host = webHost(t.url);
    if (!host || seen[host]) return;
    seen[host] = true;

    var matches = Domains.findMatches(s.proxiedDomains, host);
    var li = document.createElement('li');
    var label = document.createElement('label');
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = matches.length > 0;
    var img = blankFav();
    if (t.favIconUrl && /^(https?|data):/.test(t.favIconUrl)) {
      img = document.createElement('img');
      img.className = 'fav';
      img.alt = '';
      img.src = t.favIconUrl;
      img.onerror = function () { img.replaceWith(blankFav()); };
    }
    var name = document.createElement('span');
    name.className = 'host';
    name.textContent = host;
    label.append(box, img, name);
    li.append(label);

    var bare = Domains.normalize(host);
    if (matches.length && matches.indexOf(bare) === -1) {
      var via = document.createElement('span');
      via.className = 'via';
      via.textContent = 'via ' + matches[0];
      li.append(via);
    }

    box.addEventListener('change', async function () {
      if (box.checked) await addDomains([bare]);
      else await removeDomains(Domains.findMatches(s.proxiedDomains, host));
    });
    ui.tabs.append(li);
  });
  ui.tabsHead.hidden = !ui.tabs.children.length;
}

function showAlert(text) {
  ui.alert.textContent = text;
  ui.alert.hidden = !text;
}

async function checkHealth() {
  var details = await chrome.proxy.settings.get({});
  if (details.levelOfControl === 'controlled_by_other_extensions') {
    showAlert('Another extension is controlling Chrome\'s proxy settings, so Byroad can\'t take effect. Disable the other proxy extension first.');
    return;
  }
  if (details.levelOfControl === 'not_controllable') {
    showAlert('Chrome\'s proxy settings are locked by a policy on this device.');
    return;
  }
  var data = await chrome.storage.session.get('lastProxyError');
  var err = data.lastProxyError;
  if (s.proxyEnabled && err && Date.now() - err.at < 2 * 60 * 1000) {
    var code = err.error.replace('net::', '');
    var unreachable = /PROXY_CONNECTION_FAILED|SOCKS_CONNECTION_FAILED|NAME_NOT_RESOLVED/.test(code);
    showAlert(unreachable
      ? 'Couldn\'t reach the proxy at ' + s.proxyUrl + ':' + s.proxyPort + ' (' + code + '). Is it running?'
      : 'The proxy failed to load a page recently (' + code + ').');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function webHost(url) {
  try {
    var u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.hostname.toLowerCase() : '';
  } catch (e) { return ''; }
}

function blankFav() {
  var span = document.createElement('span');
  span.className = 'fav blank';
  return span;
}

function esc(str) {
  return String(str).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function flash(button, text) {
  var original = button.textContent;
  button.textContent = text;
  button.disabled = true;
  setTimeout(function () { button.textContent = original; button.disabled = false; }, 1500);
}

// ── Events ───────────────────────────────────────────────────────────────────

ui.power.addEventListener('change', function () {
  if (ui.power.checked) {
    var problem = serverProblem();
    if (problem) {
      ui.power.checked = false;
      ui.serverError.textContent = problem;
      ui.serverError.hidden = false;
      (s.proxyUrl.trim() ? ui.port : ui.host).focus();
      return;
    }
  }
  showAlert('');
  ui.ipResult.textContent = '';
  save({ proxyEnabled: ui.power.checked });
});

ui.modes.forEach(function (b) {
  b.addEventListener('click', function () {
    if (b.dataset.mode === s.proxyMode) return;
    reloadHint = false;
    save({ proxyMode: b.dataset.mode });
  });
});

function onServerChange() {
  s.proxyType = ui.type.value;
  s.proxyUrl = ui.host.value.trim();
  s.proxyPort = ui.port.value.trim();
  var problem = serverProblem();
  ui.serverError.textContent = problem;
  ui.serverError.hidden = !problem;
  ui.host.classList.toggle('invalid', /host/i.test(problem));
  ui.port.classList.toggle('invalid', /port/i.test(problem));
  var patch = { proxyType: s.proxyType, proxyUrl: s.proxyUrl, proxyPort: s.proxyPort };
  if (problem) patch.proxyEnabled = false;
  save(patch);
}
ui.type.addEventListener('change', onServerChange);
ui.host.addEventListener('change', onServerChange);
ui.port.addEventListener('change', onServerChange);

ui.hereBtn.addEventListener('click', async function () {
  var host = activeTab.host;
  var bare = Domains.normalize(host);
  if (s.proxyMode === 'selective') {
    if (isRouted(host)) await removeDomains(Domains.findMatches(s.proxiedDomains, host));
    else await addDomains([bare]);
  } else {
    var list = isBypassed(host)
      ? s.bypassList.filter(function (b) { return !Domains.covers(b.replace(/^\*\./, ''), host); })
      : s.bypassList.concat([bare]);
    await save({ bypassList: list });
  }
  reloadHint = true;
  renderHere();
});

ui.addForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  var d = Domains.normalize(ui.addInput.value);
  if (!d) {
    ui.addInput.classList.add('invalid');
    setTimeout(function () { ui.addInput.classList.remove('invalid'); }, 1200);
    return;
  }
  ui.addInput.value = '';
  await addDomains([d]);
  ui.addInput.focus();
});

ui.copyBtn.addEventListener('click', function () {
  if (!s.proxiedDomains.length) return flash(ui.copyBtn, 'Empty');
  navigator.clipboard.writeText(s.proxiedDomains.join('\n')).then(
    function () { flash(ui.copyBtn, 'Copied'); },
    function () { flash(ui.copyBtn, 'Failed'); }
  );
});

ui.pasteBtn.addEventListener('click', function () {
  ui.pasteBox.hidden = !ui.pasteBox.hidden;
  if (!ui.pasteBox.hidden) ui.pasteText.focus();
});
ui.pasteCancel.addEventListener('click', function () {
  ui.pasteBox.hidden = true;
  ui.pasteText.value = '';
});
ui.pasteAdd.addEventListener('click', async function () {
  var found = Domains.parseList(ui.pasteText.value);
  var fresh = found.filter(function (d) { return s.proxiedDomains.indexOf(d) === -1; });
  if (!fresh.length) return flash(ui.pasteAdd, found.length ? 'Already added' : 'No sites found');
  await addDomains(fresh);
  ui.pasteText.value = '';
  ui.pasteBox.hidden = true;
});

var clearArmed = null;
ui.clearBtn.addEventListener('click', function () {
  if (!s.proxiedDomains.length) return;
  if (!clearArmed) {
    ui.clearBtn.textContent = 'Sure?';
    clearArmed = setTimeout(function () { ui.clearBtn.textContent = 'Clear'; clearArmed = null; }, 2500);
    return;
  }
  clearTimeout(clearArmed);
  clearArmed = null;
  ui.clearBtn.textContent = 'Clear';
  setDomains([]);
});

ui.bypass.addEventListener('change', function () {
  var list = ui.bypass.value.split(/[\n,]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  save({ bypassList: list });
});

ui.ipBtn.addEventListener('click', async function () {
  ui.ipBtn.disabled = true;
  ui.ipResult.className = 'ip';
  ui.ipResult.textContent = 'Checking…';
  try {
    var res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var ip = (await res.json()).ip;
    var proxied = s.proxyEnabled && (s.proxyMode === 'global' ? !isBypassed('api.ipify.org') : isRouted('api.ipify.org'));
    ui.ipResult.className = 'ip ok';
    ui.ipResult.textContent = ip + (proxied ? ' (through proxy)' : ' (direct)');
    ui.ipResult.title = proxied ? '' : 'This check isn\'t one of your proxied sites, so it shows your direct IP.';
  } catch (err) {
    ui.ipResult.className = 'ip bad';
    ui.ipResult.textContent = err.name === 'TimeoutError' ? 'Timed out' : 'Failed: ' + err.message;
  }
  ui.ipBtn.disabled = false;
});

// ── Start ────────────────────────────────────────────────────────────────────

(async function init() {
  ui.version.textContent = 'v' + chrome.runtime.getManifest().version;
  s = await chrome.storage.local.get(DEFAULTS);
  s.proxyPort = String(s.proxyPort);

  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  var host = tab && webHost(tab.url);
  if (host) activeTab = { id: tab.id, host: host, url: tab.url, favIconUrl: tab.favIconUrl };

  render();
  if (s.proxyMode === 'selective') renderTabs();
  checkHealth();
})();

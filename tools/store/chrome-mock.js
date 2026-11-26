// Fake chrome.* APIs so the real popup can be rendered outside the extension
// for store screenshots. Scenario comes from ?shot=sites|global.
(function () {
  var shot = new URLSearchParams(location.search).get('shot') || 'sites';

  function fav(letter, bg) {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="' + bg + '"/>' +
      '<text x="8" y="12" font-family="Arial" font-weight="700" font-size="10" fill="#fff" text-anchor="middle">' + letter + '</text></svg>');
  }

  var tabs = [
    { id: 1, url: 'https://www.reddit.com/r/selfhosted/', favIconUrl: fav('r', '#e5532d'), active: true },
    { id: 2, url: 'https://github.com/trending', favIconUrl: fav('G', '#24292f') },
    { id: 3, url: 'https://news.ycombinator.com/', favIconUrl: fav('Y', '#f26522') },
    { id: 4, url: 'https://www.wikipedia.org/', favIconUrl: fav('W', '#636466') },
    { id: 5, url: 'https://mail.proton.me/', favIconUrl: fav('P', '#6d4aff') },
  ];

  var data = shot === 'global'
    ? { proxyEnabled: true, proxyMode: 'global', proxyType: 'socks5', proxyUrl: '127.0.0.1', proxyPort: '1080',
        proxiedDomains: [], bypassList: ['intranet.example.com', 'bank.example.com'] }
    : { proxyEnabled: true, proxyMode: 'selective', proxyType: 'socks5', proxyUrl: '127.0.0.1', proxyPort: '1080',
        proxiedDomains: ['youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com', 'ggpht.com', 'youtube-nocookie.com',
          'youtubei.googleapis.com', 'reddit.com', 'redd.it', 'redditmedia.com', 'redditstatic.com', 'reddituploads.com',
          'github.com', 'archive.org', 'medium.com'],
        bypassList: [] };

  if (shot === 'global') tabs[0] = { id: 1, url: 'https://news.ycombinator.com/', favIconUrl: fav('Y', '#f26522'), active: true };

  var noop = function () {};
  window.chrome = {
    storage: {
      local: {
        get: function (defaults) { return Promise.resolve(Object.assign({}, defaults, data)); },
        set: function (patch) { Object.assign(data, patch); return Promise.resolve(); },
      },
      session: { get: function () { return Promise.resolve({}); } },
    },
    runtime: {
      sendMessage: function () { return Promise.resolve({ ok: true }); },
      getManifest: function () { return { version: '1.0.0' }; },
    },
    tabs: {
      query: function (q) { return Promise.resolve(q && q.active ? [tabs[0]] : tabs); },
      reload: noop,
    },
    proxy: { settings: { get: function () { return Promise.resolve({ levelOfControl: 'controlled_by_this_extension' }); } } },
  };
})();

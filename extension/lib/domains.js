'use strict';

// Shared by the popup (<script>) and the service worker (importScripts).

var Domains = (function () {
  var VALID = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

  // Turns whatever the user typed ("https://www.Example.com/path", "*.example.com")
  // into a bare lowercase domain, or '' if it isn't one.
  function normalize(input) {
    var s = String(input || '').trim().toLowerCase();
    if (!s) return '';
    if (s.indexOf('://') !== -1) {
      try { s = new URL(s).hostname; } catch (e) { return ''; }
    }
    s = s.split('/')[0].split(':')[0];
    s = s.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '').replace(/^www\./, '');
    return VALID.test(s) ? s : '';
  }

  // True when host is the domain itself or one of its subdomains.
  function covers(domain, host) {
    return host === domain ||
      (host.length > domain.length && host.slice(-(domain.length + 1)) === '.' + domain);
  }

  function findMatches(list, host) {
    return list.filter(function (d) { return covers(d, host); });
  }

  function parseList(text) {
    var out = [];
    String(text || '').split(/[\s,;]+/).forEach(function (part) {
      var d = normalize(part);
      if (d && out.indexOf(d) === -1) out.push(d);
    });
    return out;
  }

  return { normalize: normalize, covers: covers, findMatches: findMatches, parseList: parseList };
})();

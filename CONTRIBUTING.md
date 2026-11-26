# Contributing

Thanks for helping out. Bug reports, preset updates and small fixes are all welcome.

## Reporting a bug

Open an [issue](https://github.com/MeysamRezazadeh/byroad/issues/new/choose) and include your browser version, proxy type (SOCKS5, HTTP…), what you expected, and what happened. Never paste proxy passwords or private server addresses.

## Fixing a service preset

Services change their domains from time to time. Presets live in [`extension/popup/presets.js`](extension/popup/presets.js). If a service doesn't load fully through the proxy:

1. Open the site with DevTools → Network.
2. Note the domains of requests that fail or bypass the proxy.
3. Add the parent domain (for example `examplecdn.net`, not `img3.examplecdn.net`). Subdomains are matched automatically.

## Development

There's no build step. Load the `extension` folder as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked) and reload it after each change.

- Plain JavaScript, no frameworks or dependencies.
- The PAC script in `background.js` must stay ES5: Chrome's PAC engine rejects newer syntax silently.
- Keep the popup fast and small; it opens on every click.

Before opening a pull request, run the end-to-end test. It needs Node 18+ and Microsoft Edge or Chromium:

```
node tests/e2e.mjs
```

If you change the popup's look, regenerate the store images:

```
node tools/render.mjs
```

## Releasing (maintainers)

1. Bump `version` in `extension/manifest.json` and add an entry to `CHANGELOG.md`.
2. Commit, then tag: `git tag v1.2.3 && git push --tags`.
3. GitHub Actions builds the zip and attaches it to a GitHub release.
4. Upload that zip in the Chrome Web Store Developer Dashboard.

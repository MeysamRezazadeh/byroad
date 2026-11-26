# Chrome Web Store listing: copy and paste into the Developer Dashboard

## Store listing tab

**Name** (comes from manifest.json)
Byroad — Per-Site Proxy

**Summary** (comes from manifest.json, max 132 characters)
Send only the sites you pick through your SOCKS5 or HTTP proxy. Everything else stays on your normal connection.

**Category**
Tools  (alternative: Privacy & Security)

**Language**
English

**Description**

```
Byroad routes only the websites you choose through your proxy. Everything else keeps using your normal connection, so you don't slow down every site or burn proxy bandwidth on pages that don't need it.

It works with any SOCKS5, SOCKS4, HTTP or HTTPS proxy, including local clients like v2ray, Xray, Shadowsocks, Clash, or an SSH tunnel (ssh -D).

HOW IT WORKS
• Enter your proxy's address once (for example 127.0.0.1:1080).
• Pick what goes through it: a whole service, an open tab, or any site you type.
• That's it. Subdomains are included automatically.

FEATURES
• Two modes: "Only my sites", or "Everything" with a list of sites that always go direct
• The current tab is shown at the top with a one-click button to add or remove it
• Ready-made sets for YouTube, Google, X, Instagram, Facebook, WhatsApp, Telegram, Discord, Reddit, ChatGPT, GitHub, Spotify, Netflix and Steam, including the CDN domains each one needs
• Tick any open tab to route it
• Right-click any page: "Use proxy for this site"
• Warns you when the proxy can't be reached or when another extension is overriding the proxy settings
• Check your public IP with one click
• Copy and paste your site list between browsers
• Light and dark theme

PRIVACY
Byroad has no servers, no accounts and no analytics. Your settings never leave your browser. Byroad does not provide a proxy; it uses the one you already have.

Open source: https://github.com/MeysamRezazadeh/byroad
```

**Graphic assets**
- Store icon (128×128): `extension/icons/icon128.png`
- Screenshots (1280×800): `store/screenshot-1-sites.png`, `store/screenshot-2-everything.png`
- Small promo tile (440×280): `store/promo-small-440x280.png`
- Marquee promo tile (1400×560, optional): `store/promo-marquee-1400x560.png`

**Homepage URL**: https://github.com/MeysamRezazadeh/byroad
**Support URL**: https://github.com/MeysamRezazadeh/byroad/issues

## Privacy tab

**Single purpose**

```
Byroad lets the user route chosen websites (or all traffic) through a proxy server the user configures, and keeps all other sites on a direct connection.
```

**Permission justifications**

proxy:
```
Core function. Byroad applies the user's proxy server to the sites they select (via a PAC script) or to all traffic, and clears the setting when turned off.
```

storage:
```
Saves the user's proxy server address, their list of routed sites, and their bypass list locally so settings persist between browser sessions.
```

tabs:
```
Reads the URL of the current tab and open tabs while the popup is open, so the user can see the current site and route it, or pick from their open tabs, with one click. URLs are not stored or transmitted.
```

contextMenus:
```
Adds "Use proxy for this site" and "Stop using proxy for this site" to the page's right-click menu.
```

**Remote code**
Select: **No, I am not using remote code.**

**Data usage**
Leave every data type unticked; Byroad collects no user data.
Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
Once the repository is public, use:
`https://github.com/MeysamRezazadeh/byroad/blob/main/PRIVACY.md`

## Test instructions tab

Username / password: leave empty (no account needed).

Additional instructions:

```
No account or sign-in is needed. Byroad routes traffic through a proxy server the user already has, so testing needs any SOCKS5 or HTTP proxy. The quickest way to get one is an SSH tunnel to any server:  ssh -D 1080 -N user@server  (creates a SOCKS5 proxy at 127.0.0.1:1080).

1. Click the Byroad icon in the toolbar.
2. Under "Proxy server" choose SOCKS5 and enter 127.0.0.1 and 1080.
3. Under "Services" click "YouTube", or type a site in "Add a site" and click Add. The switch at the top turns on.
4. Visit a routed site: it loads through the proxy. Other sites still connect directly.
5. To confirm, type ipify.org in "Add a site", click Add, then click "Check my IP": it shows the proxy's IP with "(through proxy)".
6. Click "Everything" to route all traffic instead.
7. Turn the switch off: Chrome returns to its normal proxy settings.

Without a proxy running, the popup shows "Couldn't reach the proxy". That warning is expected behavior.
```

## Distribution tab

- Visibility: Public
- Regions: All regions (or choose)
- Pricing: Free

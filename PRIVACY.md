# Byroad Privacy Policy

_Last updated: November 26, 2026_

Byroad is a browser extension that routes the websites you choose through a proxy server you configure. This policy explains what data it handles.

## What Byroad stores

Byroad saves the following in your browser's local extension storage (`chrome.storage.local`), on your device only:

- your proxy server settings (protocol, host, port)
- the list of sites you route through the proxy
- the list of sites you want to always connect directly
- whether the proxy is on and which mode it is in

This data is never sent to the developer or to anyone else. Uninstalling the extension deletes it.

## Tabs

Byroad reads the address of your current tab and your open tabs **only while the popup is open**, to show which sites you can route. This information is not stored, logged, or sent anywhere.

## Network requests

Byroad makes no network requests of its own, with one exception: when you click **Check my IP**, it requests `https://api.ipify.org` to show your public IP address. That request is subject to [ipify's privacy policy](https://www.ipify.org/). Nothing is sent unless you click the button.

Traffic for the sites you choose goes to the proxy server **you** configure. Byroad does not operate any proxy servers and does not see or modify your traffic.

## What Byroad does not do

- No analytics, telemetry, or tracking
- No accounts or sign-in
- No advertising
- No sale or sharing of data with third parties

## Contact

Questions about this policy: open an issue at https://github.com/MeysamRezazadeh/byroad/issues

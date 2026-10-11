# TJ Record Reader (Chrome extension, MV3)

Prefills court-record party-name searches opened from the Distress Finder app, and adds a
"Save to property" button that posts the visible results page text back to the app.

## Install
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** and select this `extension/` folder.
3. Click the extension's **Options** and set:
   - **App URL** (default `http://localhost:3000`)
   - **Shared token** - must equal `DF_EXTENSION_TOKEN` in the app's `.env`.
   For an `https` app URL, Chrome will ask to grant host permission on Save; accept it.

## Production origin
Add your production app origin to `externally_connectable.matches` in `manifest.json`
(e.g. `https://app.example.com/*`). Chrome may ignore the `https://*.vercel.app/*` wildcard
(vercel.app is a public suffix), so list your exact deployment origin. Reload the extension afterward.

## Adding a county clerk host (FL / TX)
In `manifest.json`, add the host to `content_scripts[0].matches`, e.g. `"https://www.mypalmbeachclerk.com/*"`.
Also add it to `host_permissions` if you want it listed explicitly. The app can only open search URLs
on hosts in `content_scripts.matches` (enforced in `background.js`). Field prefill selectors may need
adjusting per site (see below).

## Rules of use
One human-run search at a time. The extension never submits forms, clicks Search, paginates, or
runs on a timer: you click Search, you click Save, one page per save. This matches WCCA's intended
free-site use. Do not modify it to automate searching.

## Selectors are best-effort
WCCA's form markup is not known for certain. `findFields()` in `content.js` looks for inputs whose
id/name/aria-label/placeholder/label text matches "last name" / "first name", then falls back to the
first two text inputs inside a form containing "Party name". It retries for 10 seconds. If prefill
misses, adjust `findFields()`.

## Security notes
- The token is only sent to the configured App URL (a `df` link param cannot redirect it elsewhere).
- Saves go through the service worker so the app does not need CORS headers.

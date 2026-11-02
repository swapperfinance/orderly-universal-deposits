# Marketplace cover sources

`docs/cover-1.png` (1280 × 800, as the Orderly Marketplace requires) is rendered from `cover-1.html`. It embeds the live Swapper widget, which only loads on an `http(s)` origin, so serve this folder from any local server (for example a DEX dev server's `public/`) and capture with headless Chrome:

```bash
node shoot.mjs http://localhost:5190/_covers/cover-1.html ../cover-1.png 1280 800 14000
```

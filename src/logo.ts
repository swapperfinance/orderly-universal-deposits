import { useEffect, useState } from "react";

/** Logo edge in px: sharp at the widget's largest destination icon (24px) on 2x screens. */
const LOGO_SIZE = 64;

const cache = new Map<string, Promise<string | undefined>>();

/**
 * The destination logo as a small PNG `data:` URL. The Swapper widget's
 * Content Security Policy only loads images from Swapper's own hosts and
 * `data:` URLs, so a DEX logo passed by URL would be blocked and render as an
 * empty placeholder. Rasterised here, in the host page, where the logo is
 * usually same-origin. `undefined` when it can't be read (failed load, or a
 * cross-origin image without CORS headers): the widget then shows Orderly's
 * logo instead. Cached per URL.
 */
export function logoDataUrl(url: string | undefined): Promise<string | undefined> {
  if (!url) return Promise.resolve(undefined);
  if (url.startsWith("data:image/")) return Promise.resolve(url);
  if (typeof document === "undefined") return Promise.resolve(undefined);
  let promise = cache.get(url);
  if (!promise) {
    promise = rasterize(url).catch((error) => {
      console.warn(
        "[swapperDeposits] Can't use the destination logo (it must be same-origin or served with CORS); the widget shows Orderly's logo instead:",
        url,
        error,
      );
      return undefined;
    });
    cache.set(url, promise);
  }
  return promise;
}

function rasterize(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin images draw without it; cross-origin ones only with CORS.
    if (new URL(url, location.href).origin !== location.origin) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = LOGO_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d canvas");
        // SVGs without width / height report 0: draw them square.
        const w = img.naturalWidth || LOGO_SIZE;
        const h = img.naturalHeight || LOGO_SIZE;
        const scale = Math.min(LOGO_SIZE / w, LOGO_SIZE / h);
        const dw = w * scale;
        const dh = h * scale;
        ctx.drawImage(img, (LOGO_SIZE - dw) / 2, (LOGO_SIZE - dh) / 2, dw, dh);
        resolve(canvas.toDataURL("image/png")); // throws on a tainted canvas
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error("failed to load"));
    img.src = url;
  });
}

/** `logoDataUrl` for render: `undefined` until ready (cached results are immediate). */
export function useLogoDataUrl(url: string | undefined): string | undefined {
  const [state, setState] = useState<{ url?: string; dataUrl?: string }>({});
  useEffect(() => {
    let current = true;
    void logoDataUrl(url).then((dataUrl) => current && setState({ url, dataUrl }));
    return () => {
      current = false;
    };
  }, [url]);
  return state.url === url ? state.dataUrl : undefined;
}

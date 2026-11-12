/** Config carrying the per-deposit `customData` payload the widget reads. */
type HasCustomData = { customData?: Record<string, unknown> };

/**
 * Splits the destination logo out of the config that ends up in the widget
 * iframe's URL.
 *
 * The logo is a base64 PNG `data:` URL (see `logo.ts`), and `URLSearchParams`
 * makes it bigger still: base64's `/`, `+` and `=` are percent-encoded. The
 * SDK serialises `customData` into the iframe's query string, and the widget
 * host rejects request lines over 8 KB with `414 URI Too Long` — which the
 * dialog renders as that error instead of the widget. A normal DEX logo
 * rasterised at 64×64 is 7-10 KB, so the logo alone exceeds the limit.
 *
 * So the logo is kept out of the initial URL and handed to the widget with the
 * config message the SDK posts once the iframe has loaded (postMessage has no
 * size limit). The rest of `customData` stays in the URL, so the widget still
 * boots with its broker and destination name.
 */
export function deferDestinationLogo<T extends HasCustomData>(
  config: T,
): {
  /** Config for the iframe URL: everything except the logo. */
  initial: T;
  /** The full `customData`, to apply over postMessage. Undefined when there is no logo. */
  deferred?: Record<string, unknown>;
} {
  const customData = config.customData;
  if (!customData || typeof customData.destinationChainLogo !== "string") {
    return { initial: config };
  }
  const rest = { ...customData };
  delete rest.destinationChainLogo;
  return {
    initial: { ...config, customData: rest } as T,
    deferred: customData,
  };
}

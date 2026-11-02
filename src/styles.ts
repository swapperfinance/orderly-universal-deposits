// The compiled Tailwind stylesheet as text (tsup's `.css: "text"` loader). The
// same file ships as dist/styles.css for hosts that set `injectStyles: false`.
import css from "../.build/styles.css";

const STYLE_ID = "swapper-deposits-styles";
/** Custom property set by the stylesheet itself (see tailwind.css). */
const MARKER_PROPERTY = "--swapper-deposits-styles";

/**
 * Adds the plugin's stylesheet to the page once, so integrators don't have to
 * import it. Skipped when it is already there: injected earlier, or loaded
 * from dist/styles.css (detected through the marker property).
 */
export function injectStyles(): void {
  if (typeof document === "undefined" || !document.head) return;
  if (document.getElementById(STYLE_ID)) return;
  const loaded = getComputedStyle(document.documentElement)
    .getPropertyValue(MARKER_PROPERTY)
    .trim();
  if (loaded) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

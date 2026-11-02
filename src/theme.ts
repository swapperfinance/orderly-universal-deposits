import type { ComponentStyles, SwapperStyles, ThemeMode } from "@swapper-finance/deposit-sdk";
import type { ResolvedSwapperDepositOptions } from "./types";

export type DerivedTheme = {
  themeMode: ThemeMode;
  componentStyles: ComponentStyles;
};

const triplet = (s: CSSStyleDeclaration, name: string) => {
  const parts = s.getPropertyValue(name).trim().split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every((n) => !Number.isNaN(n)) ? parts : undefined;
};

/** Orderly theme colours are space-separated RGB triplets, e.g. "156 117 255". */
const rgb = (s: CSSStyleDeclaration, name: string, alpha?: number) => {
  const p = triplet(s, name);
  if (!p) return undefined;
  return alpha === undefined
    ? `rgb(${p[0]}, ${p[1]}, ${p[2]})`
    : `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${alpha})`;
};

const compact = <T extends object>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as T;

/**
 * Reads the active Orderly theme (`--oui-*` CSS variables, set on <html> by
 * OrderlyThemeProvider) and maps it onto the widget's style tokens.
 */
export function deriveTheme(el: Element = document.documentElement): DerivedTheme {
  const s = getComputedStyle(el);
  const bg = triplet(s, "--oui-color-base-8");
  const luminance = bg ? (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255 : 0;
  const primary = rgb(s, "--oui-color-primary");

  return {
    themeMode: luminance > 0.5 ? "light" : "dark",
    componentStyles: compact<ComponentStyles>({
      primaryColor: primary,
      accentColor: primary,
      sphereColor: primary,
      primaryButtonTextColor: rgb(s, "--oui-color-primary-contrast"),
      backgroundColor: rgb(s, "--oui-color-base-8"),
      surfaceColor: rgb(s, "--oui-color-base-6"),
      surfaceAltColor: rgb(s, "--oui-color-base-5"),
      textColor: rgb(s, "--oui-color-base-foreground", 0.98),
      successColor: rgb(s, "--oui-color-success"),
      errorColor: rgb(s, "--oui-color-danger"),
      warningColor: rgb(s, "--oui-color-warning"),
      borderRadius: s.getPropertyValue("--oui-rounded-xl").trim() || undefined,
    }),
  };
}

/**
 * Final widget styles: derived theme (if enabled) < plugin defaults < explicit
 * options. `hideNavigation` is set where the host renders the widget's
 * navigation itself (the Deposit dialog).
 */
export function resolveStyles(
  options: ResolvedSwapperDepositOptions,
  derived?: DerivedTheme,
  extra: { hideNavigation?: boolean } = {},
): SwapperStyles {
  return {
    themeMode: options.themeMode ?? derived?.themeMode ?? "dark",
    ...(extra.hideNavigation ? { hideNavigation: true } : {}),
    componentStyles: {
      ...derived?.componentStyles,
      padding: `${options.widgetPadding}px`,
      ...options.componentStyles,
    },
  };
}

/**
 * Calls `onChange` whenever the host switches theme (Orderly swaps the
 * `data-oui-theme` attribute / inline vars on <html>). Returns an unsubscribe.
 */
export function observeTheme(onChange: (theme: DerivedTheme) => void): () => void {
  if (typeof window === "undefined") return () => {};
  let last = "";
  const emit = () => {
    const next = deriveTheme();
    const key = JSON.stringify(next);
    if (key !== last) {
      last = key;
      onChange(next);
    }
  };
  emit();
  const observer = new MutationObserver(emit);
  const opts = { attributes: true, attributeFilter: ["class", "style", "data-oui-theme"] };
  observer.observe(document.documentElement, opts);
  observer.observe(document.body, opts);
  return () => observer.disconnect();
}

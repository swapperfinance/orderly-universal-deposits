import type { SupportedDepositOption } from "@swapper-finance/deposit-sdk";
import {
  DEFAULT_API_URL,
  DEFAULT_DESTINATION,
  DEFAULT_INTEGRATOR_ID,
  DEFAULT_WIDGET_HEIGHT,
  DEFAULT_WIDGET_PADDING,
} from "./constants";
import type { ApplicationState } from "@orderly.network/plugin-core";
import type {
  ResolvedSwapperDepositOptions,
  SwapperDepositPluginOptions,
} from "./types";

const DEPOSIT_METHODS: readonly SupportedDepositOption[] = [
  "walletDeposit",
  "transferCrypto",
  "depositWithCash",
  "depositFromPolymarket",
  "depositFromPerps",
];

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const bool = (v: unknown, fallback: boolean): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off"].includes(s)) return false;
  }
  return fallback;
};

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * Absolute http(s) URL, or an image `data:` URL. Relative paths resolve
 * against the page. Anything else is dropped.
 */
const httpUrl = (v: unknown): string | undefined => {
  const s = str(v);
  if (!s) return undefined;
  if (s.startsWith("data:image/")) return s;
  try {
    const url = new URL(s, typeof location === "undefined" ? undefined : location.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const list = (v: unknown): string[] | undefined => {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : undefined;
  const out = items?.map((x) => String(x).trim()).filter(Boolean);
  return out?.length ? out : undefined;
};

/**
 * Normalises options coming from code (typed) or from DEX Creator's
 * marketplace config (flat strings / numbers / booleans).
 */
export function resolveOptions(
  raw: Partial<SwapperDepositPluginOptions> = {},
): ResolvedSwapperDepositOptions {
  const primaryColor = str(raw.primaryColor);
  const themeMode =
    raw.themeMode === "light" || raw.themeMode === "dark" ? raw.themeMode : undefined;
  const depositMethods = list(raw.depositMethods)?.filter((m): m is SupportedDepositOption =>
    DEPOSIT_METHODS.includes(m as SupportedDepositOption),
  );

  return {
    integratorId: str(raw.integratorId) ?? DEFAULT_INTEGRATOR_ID,
    destinationToken: (str(raw.destinationToken) ?? DEFAULT_DESTINATION.token).toUpperCase(),
    chainLogo: httpUrl(raw.chainLogo),
    chainName: str(raw.chainName),
    tokens: list(raw.tokens)?.map((t) => t.toUpperCase()),
    depositMethods: depositMethods?.length ? depositMethods : undefined,
    minDepositUsd: num(raw.minDepositUsd),
    maxDepositUsd: num(raw.maxDepositUsd),
    preload: bool(raw.preload, true),
    useHostWallet: bool(raw.useHostWallet, true),
    themeMode,
    matchOrderlyTheme: bool(raw.matchOrderlyTheme, true),
    componentStyles:
      primaryColor || raw.componentStyles
        ? {
            ...(primaryColor
              ? { primaryColor, accentColor: primaryColor, sphereColor: primaryColor }
              : {}),
            ...raw.componentStyles,
          }
        : undefined,
    height: num(raw.height) ?? DEFAULT_WIDGET_HEIGHT,
    widgetPadding: Math.max(0, num(raw.widgetPadding) ?? DEFAULT_WIDGET_PADDING),
    injectStyles: bool(raw.injectStyles, true),
    iframeUrl: str(raw.iframeUrl),
    apiUrl: (str(raw.apiUrl) ?? DEFAULT_API_URL).replace(/\/+$/, ""),
    onEvent: typeof raw.onEvent === "function" ? raw.onEvent : undefined,
    onDepositSubmitted:
      typeof raw.onDepositSubmitted === "function" ? raw.onDepositSubmitted : undefined,
  };
}

/**
 * Fills the destination logo the host didn't set explicitly from the state
 * OrderlyAppProvider hands to plugins: the DEX logo (`appIcons`, secondary
 * then main, when given as an `img` URL). The name falls back to `brokerName`
 * in useSwapperDeposit, which also covers the standalone widget.
 */
export function withHostBranding(
  options: ResolvedSwapperDepositOptions,
  state?: ApplicationState,
): ResolvedSwapperDepositOptions {
  if (options.chainLogo) return options;
  const icons = state?.config.appIcons;
  const chainLogo = httpUrl(icons?.secondary?.img) ?? httpUrl(icons?.main?.img);
  return chainLogo ? { ...options, chainLogo } : options;
}

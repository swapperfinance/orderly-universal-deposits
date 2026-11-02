import { version } from "../package.json";

export const PLUGIN_ID = "swapperDeposits";
/** Reported to Orderly's plugin registry; always the published package version. */
export const PLUGIN_VERSION = version;

/** Dialog / sheet ids registered by @orderly.network/ui-transfer. */
export const DEPOSIT_DIALOG_ID = "DepositAndWithdrawWithDialogId";
export const DEPOSIT_SHEET_ID = "DepositAndWithdrawWithSheetId";

/** Marker on the wrapper around the dialog content (see DialogHeader). */
export const HEADER_MARKER_ATTR = "data-swapper-header";
/**
 * The Deposit / Withdraw tab list inside that wrapper: Tabs root (Radix,
 * `data-orientation`) → list container → `[role=tablist]`. Scoped with `>` so
 * nested tab lists inside the forms are never matched. Mirrored in tailwind.css.
 */
export const HEADER_TABLIST_SELECTOR =
  ':scope > [data-orientation] > div > [role="tablist"]';

/** Marker attribute on the form root (a stable hook for host CSS / tests). */
export const FORM_MARKER_ATTR = "data-swapper-deposit-form";

/**
 * Padding inside the widget (componentStyles.padding). Matches Orderly's
 * dialog padding, so once the slot bleeds into the dialog's padding the widget
 * content lines up with Orderly's own form fields.
 */
export const DEFAULT_WIDGET_PADDING = 16;

/**
 * Swapper integrator id used when the host doesn't pass its own. Configured by
 * Swapper for this plugin, so it is safe to ship in client code. Projects that
 * want their own dashboard (metrics, API access) get an id from the Swapper
 * team at https://swapper.finance/sync.
 */
export const DEFAULT_INTEGRATOR_ID = "19600f8523e5a39cbf6d";

export const DEFAULT_DESTINATION = { chainId: 42161, token: "USDC" } as const;

/**
 * Swapper's destination for Orderly accounts. Its backend deposits into
 * Orderly's Vault on Arbitrum for the (wallet, `customData.brokerId`) account,
 * paying the vault's LayerZero fee; the widget only needs the token's
 * Arbitrum address.
 */
export const SWAPPER_ORDERLY_CHAIN_ID = "orderly";
/** Swapper API the creditable-token list is read from (`apiUrl` overrides it). */
export const DEFAULT_API_URL = "https://swapper.finance/api";
/** How Swapper addresses a chain's native token (Orderly lists it with no contract). */
export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";
/**
 * Orderly collateral Swapper credits, by symbol → its address on the orderly
 * destination (xswap-backend's ORDERLY_LISTED_TOKENS: Arbitrum's where its
 * Vault has the token, else the home chain's; BNB as WBNB, the native address
 * being ETH's). A snapshot: the live list comes from Swapper's API
 * (fetchCreditableTokens), this is what the picker uses until it loads or if
 * it fails. The rest of Orderly's list shows "Soon".
 */
export const SWAPPER_ORDERLY_TOKENS: Record<string, string> = {
  USDC: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  USDT: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  USDG: "0x004b506865409877c9fa29bfb1eba929984b9bbc",
  ETH: NATIVE_TOKEN_ADDRESS,
  BNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  WBTC: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
  YUSD: "0x4274cd7277c7bb0806bd5fe84b9adae466a8da0a",
  USD1: "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d",
  OKB: "0xe538905cf8410324e03a5a23c1c177a474d59b2b",
};
/**
 * What Swapper credits to the Orderly account of a Solana wallet: native SOL,
 * from a Solana wallet straight into Orderly's Solana Vault (the widget offers
 * such an account wallet deposits only). Swapper's address for native SOL.
 */
export const SWAPPER_ORDERLY_SOLANA_TOKENS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111111",
};
/**
 * Widget height on deposit-method pages: the widget's fixed 560px minus its
 * navigation header (52px), which the dialog hides and renders itself. The
 * widget reports its real height via `resize` events; this sizes the
 * placeholder until then.
 */
export const DEFAULT_WIDGET_HEIGHT = 508;
/** Width the hidden widget renders at while preloading (≈ slot width in the dialog). */
export const PARKED_WIDGET_WIDTH = "420px";

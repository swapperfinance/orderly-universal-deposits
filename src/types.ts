import type {
  ComponentStyles,
  SupportedDepositOption,
  SwapperEvent,
  ThemeMode,
  TransactionSuccessPayload,
} from "@swapper-finance/deposit-sdk";

/**
 * Plugin options.
 *
 * Everything except the callbacks and `componentStyles` is a flat primitive,
 * so the plugin can be configured from Orderly DEX Creator's marketplace
 * settings (`Record<string, string | number | boolean>`). Numbers / booleans
 * given as strings ("42161", "false") are coerced.
 */
export interface SwapperDepositPluginOptions {
  /**
   * Your own Swapper integrator id. Optional: the plugin ships with a default
   * id configured for Orderly DEXes. Get your own from the Swapper team
   * (https://swapper.finance/sync) for a dashboard with your deposit statistics, webhooks
   * (configured there) and other custom settings.
   */
  integratorId?: string;

  // ---- settlement ---------------------------------------------------------
  // Swapper's backend deposits into Orderly's Vault for the user's account
  // under this DEX's broker (`useConfig("brokerId")`) and pays the vault's
  // LayerZero fee — the user only picks the token credited.
  /** Token credited by default. Default: "USDC" */
  destinationToken?: string;
  /**
   * Logo the widget shows for the destination instead of Orderly's — your DEX
   * is where the funds land. An http(s) URL (relative paths resolve against
   * the page) or an image `data:` URL. It reaches the widget as a small PNG
   * `data:` URL drawn in the host page, since the widget only loads images from
   * Swapper's hosts — so it must be same-origin or served with CORS; otherwise
   * Orderly's logo is shown. Default: the `img` of OrderlyAppProvider's
   * `appIcons` (secondary, then main). A logo given as a `component` can't be
   * detected — pass its URL here. `<SwapperDepositWidget />` has no access to
   * `appIcons` and uses only this option.
   */
  chainLogo?: string;
  /**
   * Name the widget shows for the destination. Default: OrderlyAppProvider's
   * `brokerName`.
   */
  chainName?: string;
  /**
   * Tokens listed in the picker — array or comma-separated string (e.g.
   * "USDC,USDT,ETH"). Default: every collateral token Orderly supports. Tokens
   * Swapper can't credit yet are listed as "Soon"; tokens of the other
   * network's account offer a network switch.
   */
  tokens?: string[] | string;

  // ---- deposit rules ------------------------------------------------------
  /**
   * Deposit methods to offer: array or comma-separated string of
   * `walletDeposit`, `transferCrypto`, `depositWithCash`,
   * `depositFromPolymarket`, `depositFromPerps`. Default: all enabled for your
   * integrator.
   */
  depositMethods?: SupportedDepositOption[] | string;
  /** Minimum deposit in USD. Default: your integrator's minimum. */
  minDepositUsd?: number | string;
  /** Maximum deposit in USD. */
  maxDepositUsd?: number | string;

  // ---- behaviour ----------------------------------------------------------
  /**
   * Load the widget in the background once a wallet connects, with that
   * wallet's deposit config, so the Deposit dialog opens instantly. Nothing
   * loads before a wallet connects, and never on testnet. Smart-wallet
   * authorization is still deferred until the widget is first shown. When
   * off, the widget loads the first time Deposit is opened. Default: true
   */
  preload?: boolean | string;
  /**
   * Hand the EVM wallet the user connected to Orderly to the widget so they
   * don't connect twice. Default: true
   */
  useHostWallet?: boolean | string;

  // ---- look & feel --------------------------------------------------------
  /** "dark" | "light". Default: detected from the host's Orderly theme. */
  themeMode?: ThemeMode;
  /**
   * Derive widget colours, surfaces and radius from the host's Orderly theme
   * CSS variables and follow theme switches. Default: true
   */
  matchOrderlyTheme?: boolean | string;
  /** Brand colour override (any CSS colour). */
  primaryColor?: string;
  /** Full widget style overrides (code only) — applied last. */
  componentStyles?: ComponentStyles;
  /**
   * Initial widget height in px for deposit-method screens (placeholder and
   * preload size; the widget then reports its own height). Default: 508 —
   * the widget's 560px minus its navigation header, which the dialog hides.
   */
  height?: number | string;
  /**
   * Padding inside the widget, in px. In the Deposit dialog the widget also
   * extends sideways into the dialog's own padding by this much, so with the
   * default the widget content lines up with Orderly's form fields.
   * Default: 16 (Orderly's dialog padding)
   */
  widgetPadding?: number | string;
  /**
   * Add the plugin's stylesheet to the page automatically, as one `<style>`
   * tag. Skipped when the stylesheet is already loaded. Set to false on hosts
   * whose Content Security Policy blocks inline styles, and import
   * `@swapper-finance/orderly-universal-deposits/dist/styles.css` instead.
   * Default: true
   */
  injectStyles?: boolean | string;

  // ---- integration --------------------------------------------------------
  /** Widget URL override (staging / local widget). */
  iframeUrl?: string;
  /** Swapper API URL override (staging / local backend). Default: https://swapper.finance/api */
  apiUrl?: string;
  /** Every raw widget event (code only). */
  onEvent?: (event: SwapperEvent) => void;
  /**
   * The user's source transaction succeeded (code only). Funds are on their
   * way; Orderly credits the account once the transfer settles.
   */
  onDepositSubmitted?: (payload: TransactionSuccessPayload) => void;
}

/** Options after coercion / defaults — what the plugin internals consume. */
export interface ResolvedSwapperDepositOptions {
  integratorId: string;
  destinationToken: string;
  chainLogo?: string;
  chainName?: string;
  tokens?: string[];
  depositMethods?: SupportedDepositOption[];
  minDepositUsd?: number;
  maxDepositUsd?: number;
  preload: boolean;
  useHostWallet: boolean;
  themeMode?: ThemeMode;
  matchOrderlyTheme: boolean;
  componentStyles?: ComponentStyles;
  height: number;
  widgetPadding: number;
  injectStyles: boolean;
  iframeUrl?: string;
  apiUrl: string;
  onEvent?: (event: SwapperEvent) => void;
  onDepositSubmitted?: (payload: TransactionSuccessPayload) => void;
}

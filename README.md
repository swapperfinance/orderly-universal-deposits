# Universal Deposits for Orderly

**Let traders fund their Orderly account from anything: any token on any major chain, a CEX withdrawal, or a card / bank transfer.** One plugin, no options required. Every Deposit button in your DEX opens the new flow, which shows *your* DEX as the place the money lands.

Universal Deposits is built by [Swapper](https://swapper.finance) and ships as `@swapper-finance/orderly-universal-deposits`.

[![npm](https://img.shields.io/npm/v/@swapper-finance/orderly-universal-deposits)](https://www.npmjs.com/package/@swapper-finance/orderly-universal-deposits)
[![license](https://img.shields.io/npm/l/@swapper-finance/orderly-universal-deposits)](./LICENSE)

## Pricing

- **Bridging: no extra fee.** Swapper adds nothing on top of the bridge.
- **Cross-chain swaps: 0.1%.**

---

## Why

Orderly's built-in deposit form needs the trader to already hold a supported token on a supported chain, with gas to send it. Many new users don't, so they leave.

With Universal Deposits they can:

- **Pay with whatever they hold.** Any token on any major chain is swapped and bridged automatically.
- **Deposit from an exchange.** They get an address, withdraw from their CEX, and the account is credited.
- **Use a card or bank transfer.** The fiat on-ramp is built in.
- **Skip approvals and gas top-ups.** Swapper deposits into Orderly's Vault for them and handles the LayerZero fee.

You get the same deposit dialog your users already know, and Withdraw is untouched.

## Quick start

```bash
pnpm add @swapper-finance/orderly-universal-deposits
# or: npm i / yarn add
```

```tsx
import { OrderlyAppProvider } from "@orderly.network/react-app";
import { registerSwapperDepositPlugin } from "@swapper-finance/orderly-universal-deposits";

// Create once: at module level, or inside useMemo.
const plugins = [registerSwapperDepositPlugin()];

export function App({ children }) {
  return (
    <OrderlyAppProvider
      brokerId="your_broker"
      brokerName="Your DEX"
      networkId="mainnet"
      appIcons={{ main: { img: "/logo.svg" }, secondary: { img: "/logo-mark.svg" } }}
      plugins={plugins}
    >
      {children}
    </OrderlyAppProvider>
  );
}
```

That's the whole integration. Every existing Deposit entry point (portfolio, trading page, mobile sheet) now opens Universal Deposits. No stylesheet import, no extra wiring.

Universal Deposits runs on mainnet. On testnet the Deposit dialog loads Orderly's default deposit form.

### Orderly DEX Creator

Add the plugin from the Orderly Marketplace. DEX Creator shows its settings from [`configSchema.json`](./configSchema.json): every option below except the code-only callbacks and `componentStyles`, and the development overrides `iframeUrl` and `apiUrl`. Values such as `"42161"` or `"false"` are coerced to the right type.

## Get your own integrator id

The plugin works out of the box with an integrator id Swapper set up for Orderly DEXes. We recommend getting your own from the Swapper team at [swapper.finance/sync](https://swapper.finance/sync). With it you get:

- **A dashboard** with your deposit statistics.
- **Webhooks** for deposit lifecycle events, set up in the dashboard.
- **Other custom settings** for your integration.

Then pass it to the plugin, or set **Swapper integrator id** in DEX Creator:

```tsx
registerSwapperDepositPlugin({ integratorId: "<your integrator id>" });
```

## Your DEX is the destination

The widget doesn't show "Arbitrum" or "Orderly" as the place the funds go. It shows **your DEX's name and logo**, picked up automatically from `OrderlyAppProvider`:

| Shown in the widget | Detected from | Override with |
|---|---|---|
| Logo | `appIcons.secondary.img`, then `appIcons.main.img` | `chainLogo` |
| Name | `brokerName` | `chainName` |

- Logo URLs may be absolute or relative (resolved against the page), or an image `data:` URL.
- The plugin sends the logo to the widget as a small PNG `data:` URL, drawn in your page: the widget only loads images from Swapper's hosts. So the logo must be same-origin with your DEX, or served with CORS headers (`Access-Control-Allow-Origin`). Any image format the browser draws works, SVG included.
- If your logo is passed as a React `component` instead of an `img`, it can't be sent to the widget. Pass its URL as `chainLogo`.
- With no logo found, or one that can't be read, the widget shows Orderly's logo next to your broker name.

```tsx
registerSwapperDepositPlugin({
  chainLogo: "https://yourdex.xyz/brand/mark.png",
  chainName: "Your DEX",
});
```

## What traders see

1. They click **Deposit**. The dialog opens instantly, because the widget was preloaded in the background when they connected their wallet.
2. They pick the token to be credited: every collateral token Orderly supports, Solana included.
3. They choose how to pay: connected wallet (the one already connected to Orderly, no second connect), crypto transfer / CEX withdrawal, card or bank, or funds on Polymarket and other perp venues.
4. Swapper swaps, bridges or on-ramps, deposits into Orderly's Vault for their wallet under **your broker**, and the balance appears in their account.

The widget matches your DEX theme (colours, surfaces, radius, light / dark) and follows theme switches live. Its back navigation sits in the dialog's Deposit / Withdraw tab row, so it feels native.

### Receive tokens

The picker lists every collateral token Orderly supports, and Universal Deposits credits all of them:

| Account type | Tokens credited |
|---|---|
| EVM wallet | USDC, USDT, USDG, ETH, BNB, WBTC, OKB, YUSD, USD1 |
| Solana wallet | SOL, paid from a Solana wallet straight into Orderly's Solana Vault |

The list is read from Swapper's API at load, so a token Orderly adds shows up without a plugin update. Picking a token that belongs to the other network's account (SOL with an EVM wallet, or the reverse) switches the wallet through Orderly's own network switch. Use `tokens` to narrow the list and `destinationToken` to choose the default.

## Extras

```tsx
import {
  openSwapperDeposit,
  SwapperDepositWidget,
} from "@swapper-finance/orderly-universal-deposits";

// Open the Deposit dialog from your own CTA (bottom sheet on mobile).
<button onClick={() => openSwapperDeposit({ mobile: isMobile })}>Fund account</button>;

// An inline deposit panel anywhere inside OrderlyAppProvider, e.g. onboarding.
<SwapperDepositWidget chainLogo="https://yourdex.xyz/brand/mark.png" />;
```

`<SwapperDepositWidget />` takes the same options as the plugin. It can't read `appIcons`, so pass `chainLogo` to show your logo there. Your `brokerName` is still detected.

### Tracking deposits

```tsx
registerSwapperDepositPlugin({
  onDepositSubmitted: (tx) => analytics.track("deposit_submitted", tx),
  onEvent: (event) => console.debug("[universal-deposits]", event.type, event.data),
});
```

`onDepositSubmitted` fires when the user's source transaction succeeds. Orderly credits the account once the transfer settles.

For server-side deposit events, add webhooks in your Swapper dashboard. That needs [your own integrator id](#get-your-own-integrator-id).

## Options

All optional.

| Option | Default | Description |
|---|---|---|
| **Branding** | | |
| `chainLogo` | `appIcons` img | Destination logo shown in the widget. See [Your DEX is the destination](#your-dex-is-the-destination). |
| `chainName` | `brokerName` | Destination name shown in the widget. |
| **Settlement** | | |
| `destinationToken` | `"USDC"` | Token credited by default. |
| `tokens` | all collateral | Picker allow-list, e.g. `"USDC,USDT,ETH"`. |
| `apiUrl` | `https://swapper.finance/api` | Swapper API URL override (staging / local backend). |
| **Deposit rules** | | |
| `depositMethods` | all | Subset of `walletDeposit`, `transferCrypto`, `depositWithCash`, `depositFromPolymarket`, `depositFromPerps`. |
| `minDepositUsd` | integrator's | Minimum deposit in USD. |
| `maxDepositUsd` | none | Maximum deposit in USD. |
| **Look & feel** | | |
| `themeMode` | auto | `"dark"` or `"light"`. Detected from your DEX theme by default. |
| `matchOrderlyTheme` | `true` | Derive widget colours from your DEX theme and follow switches. |
| `primaryColor` | theme | Brand colour override (any CSS colour). |
| `height` | `508` | Initial height (px) of deposit-method screens. The widget then sizes itself. |
| `widgetPadding` | `16` | Padding inside the widget (px). In the dialog it lines content up with Orderly's fields. |
| `componentStyles` | none | Code only. Full widget style overrides, applied last. |
| **Behaviour** | | |
| `preload` | `true` | Load the widget in the background once a wallet connects, with that wallet's deposit config, so Deposit opens instantly. Nothing loads before a wallet connects. Off: the widget loads when Deposit is first opened. |
| `useHostWallet` | `true` | Hand the wallet connected to Orderly to the widget, so users don't connect twice. |
| `injectStyles` | `true` | Add the plugin's stylesheet (~4 KB) as a `<style>` tag. See [Styles & CSP](#styles--csp). |
| **Integration** | | |
| `integratorId` | built-in | Your own Swapper integrator id. See [Get your own integrator id](#get-your-own-integrator-id). |
| `iframeUrl` | production | Widget URL override (staging / local widget). |
| `onDepositSubmitted` | none | Code only. The user's source transaction succeeded. |
| `onEvent` | none | Code only. Every raw widget event. |

## Styles & CSP

The plugin injects its stylesheet automatically and skips that when `dist/styles.css` is already on the page. If your Content Security Policy blocks inline styles, turn injection off and import the file yourself:

```tsx
registerSwapperDepositPlugin({ injectStyles: false });
```

```tsx
import "@swapper-finance/orderly-universal-deposits/styles.css";
```

The widget is served from Swapper's origin in an iframe, so allow it in `frame-src` if you restrict frames.

## Requirements

- Orderly SDK ≥ 3.0 (`@orderly.network/hooks`, `ui`, `i18n`, `types`, `plugin-core`) and React ≥ 18.
- Mainnet. On testnet the Deposit dialog loads Orderly's default deposit form and the widget isn't preloaded.

## Interceptors

| Target | What the plugin does |
|---|---|
| `Deposit.DepositForm` | Replaced by the receive-token picker and the Swapper widget (on testnet, Orderly's default deposit form). |
| `Transfer.DepositAndWithdraw` | Wrapped, never replaced: adds the widget's back arrow to the Deposit / Withdraw tab row. The Withdraw tab is untouched. |
| `Account.AccountMenu`, `Account.MobileAccountMenu` | Wrapped, never replaced, nothing visible: preloads the widget once a wallet connects (only with `preload` on). |

Other plugins that wrap the same targets keep working.

## Troubleshooting

**The widget shows Orderly's logo instead of mine.** Your `appIcons` probably use `component`, or no `appIcons` are set: pass `chainLogo` with an image URL. If the logo is on another host (a CDN), it needs CORS headers; the console then shows a `[swapperDeposits] Can't use the destination logo` warning.

**Hooks errors or a blank dialog with a locally linked package.** Dedupe React and the Orderly packages, e.g. in Vite: `resolve: { dedupe: ["react", "react-dom", "@orderly.network/hooks", "@orderly.network/ui", "@orderly.network/plugin-core", …] }`.

**Focus or click issues inside the dialog.** The plugin handles Radix's focus trap and pointer-events itself. Don't wrap the Deposit dialog in extra focus traps.

## Development

```bash
pnpm install
pnpm build       # dist/ + dist/styles.css
pnpm dev         # watch mode
pnpm typecheck
```

## License

MIT © Swapper Finance

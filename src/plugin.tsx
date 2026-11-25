import type { ComponentType, ReactNode } from "react";
import { createInterceptor } from "@orderly.network/plugin-core";
import type { ApplicationState, OrderlySDK } from "@orderly.network/plugin-core";
import { DialogHeader } from "./components/DialogHeader";
import { PreloadOnConnect } from "./components/PreloadOnConnect";
import { SwapperDepositForm } from "./components/SwapperDepositForm";
import { PLUGIN_ID, PLUGIN_VERSION } from "./constants";
import { DepositEmbedController } from "./embed/DepositEmbedController";
import { LocaleProvider, LocaleMessages } from "./i18n";
import { resolveOptions, withHostBranding } from "./options";
import { logoDataUrl } from "./logo";
import { injectStyles } from "./styles";
import type { SwapperDepositPluginOptions } from "./types";

/**
 * Register the Universal Deposits plugin (by Swapper).
 *
 * Makes Swapper the default deposit experience: the form inside the "Deposit"
 * tab of Orderly's Deposit / Withdraw dialog is replaced by a receive-token
 * picker plus a Swapper widget (preloaded once a wallet connects), so traders
 * can fund their account from any token on any chain, a CEX withdrawal or a
 * card. Funds settle on the account via Orderly's Vault (Swapper's `orderly`
 * destination) and are credited automatically. The widget shows the DEX
 * itself (its logo and broker name, detected from OrderlyAppProvider) as the
 * destination. The widget's back navigation lives in the dialog's tab row.
 * Orderly's native form is used as the fallback when Swapper can't serve the
 * account (testnet, sub-accounts); an account that isn't set up yet goes
 * through Orderly's own account setup.
 *
 * @example
 * <OrderlyAppProvider plugins={[registerSwapperDepositPlugin()]} … />
 */
export function registerSwapperDepositPlugin(rawOptions: SwapperDepositPluginOptions = {}) {
  const options = resolveOptions(rawOptions);
  if (options.injectStyles) injectStyles();
  const controller = new DepositEmbedController(options);
  if (options.onEvent) controller.subscribe(options.onEvent);

  return (SDK: OrderlySDK, state?: ApplicationState) => {
    // The DEX logo from OrderlyAppProvider's `appIcons`, unless set explicitly.
    const formOptions = withHostBranding(options, state);
    // Start converting it now, so it's ready when the widget preloads.
    void logoDataUrl(formOptions.chainLogo);
    const withPreload = (original: ReactNode) => (
      <>
        <LocaleProvider>
          <PreloadOnConnect controller={controller} options={formOptions} />
        </LocaleProvider>
        {original}
      </>
    );
    SDK.registerPlugin({
      id: PLUGIN_ID,
      name: LocaleMessages["swapperDeposits.pluginName"],
      version: PLUGIN_VERSION,
      orderlyVersion: ">=3.0.0",

      // Targets are written inline: Orderly's devkit reads them from the
      // createInterceptor calls to list the plugin's slots on the Marketplace.
      interceptors: [
        // "Deposit.DepositForm" is resolved by ui-transfer's DepositSlot via
        // useInjectedComponent; its typed props live in ui-transfer, which
        // the plugin deliberately doesn't import.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createInterceptor("Deposit.DepositForm" as any, (Original, props: Record<string, unknown>) => (
          <LocaleProvider>
            <SwapperDepositForm
              controller={controller}
              options={formOptions}
              Original={Original as ComponentType<Record<string, unknown>>}
              originalProps={props}
            />
          </LocaleProvider>
        )),
        // The dialog content (Deposit / Withdraw tabs). Wrapped — never
        // replaced — so Orderly's component and other plugins' interceptors
        // still render; the wrapper adds the widget's back navigation to the
        // tab row.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createInterceptor("Transfer.DepositAndWithdraw" as any, (Original, props: Record<string, unknown>) => (
          <LocaleProvider>
            <DialogHeader controller={controller}>
              <Original {...props} />
            </DialogHeader>
          </LocaleProvider>
        )),
        // Orderly's account menus (desktop top bar, mobile account button)
        // and main menu are on screen app-wide: wrapped, untouched, they host
        // the preload, which waits for a connected wallet so the Deposit
        // dialog opens instantly. Several hosts, one active (PreloadOnConnect):
        // a wallet connector may replace the account menus outright — the
        // Privy connector does, without rendering the plugins under it.
        ...(options.preload
          ? [
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              createInterceptor("Account.AccountMenu" as any, (Original, props: Record<string, unknown>) =>
                withPreload(<Original {...props} />),
              ),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              createInterceptor("Account.MobileAccountMenu" as any, (Original, props: Record<string, unknown>) =>
                withPreload(<Original {...props} />),
              ),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              createInterceptor("Layout.MainMenus" as any, (Original, props: Record<string, unknown>) =>
                withPreload(<Original {...props} />),
              ),
            ]
          : []),
      ],
    });
  };
}

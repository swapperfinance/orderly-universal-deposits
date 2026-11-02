import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConfig, useWalletConnector } from "@orderly.network/hooks";
import { useTranslation } from "@orderly.network/i18n";
import { AccountStatusEnum, ChainNamespace, type NetworkId } from "@orderly.network/types";
import { toast } from "@orderly.network/ui";
import type { TransactionSuccessPayload } from "@swapper-finance/deposit-sdk";
import { PLUGIN_ID, SWAPPER_ORDERLY_CHAIN_ID } from "../constants";
import type { DepositPatch } from "../embed/DepositEmbedController";
import { useLogoDataUrl } from "../logo";
import type { ResolvedSwapperDepositOptions } from "../types";
import { useReceiveTokens } from "./useDestination";
import { useHostSigner } from "./useHostSigner";

/**
 * Why Swapper can't take over for this account right now. The dialog form
 * falls back to Orderly's native deposit for all of these.
 */
export type SwapperDepositBlocker =
  | "connectWallet"
  | "subAccount"
  | "enableTrading"
  | "unsupportedNetwork";

/**
 * Everything the Swapper deposit UI needs: gating, receive-token selection
 * and the config patch to apply to the widget. Swapper's backend does the
 * Orderly side: the widget targets the `orderly` destination with the user's
 * wallet and broker, and the deposit lands in Orderly's Vault for that
 * (wallet, broker) account.
 */
export function useSwapperDeposit(
  options: ResolvedSwapperDepositOptions,
  /** Persist the receive-token choice beyond this component's lifetime. */
  tokenMemory?: { get(): string | undefined; set(symbol: string): void },
) {
  const { t } = useTranslation();
  const { state: accountState, isSubAccount } = useAccount();
  const { namespace, setChain } = useWalletConnector();
  const brokerId = useConfig("brokerId") as string;
  const brokerName = useConfig("brokerName") as string | undefined;
  const networkId = useConfig("networkId") as NetworkId;

  const status = accountState.status;
  const hasOrderlyKey =
    status === AccountStatusEnum.EnableTrading ||
    status === AccountStatusEnum.EnableTradingWithoutConnected;
  const isSolana = namespace === ChainNamespace.solana;

  // A Solana wallet's account takes SOL only (SWAPPER_ORDERLY_SOLANA_TOKENS).
  const { tokens, isLoading: tokensLoading } = useReceiveTokens({
    tokens: options.tokens,
    solana: isSolana,
    apiUrl: options.apiUrl,
    integratorId: options.integratorId,
  });
  const creditable = useMemo(() => tokens?.filter((x) => x.route), [tokens]);

  // ---- receive token --------------------------------------------------------
  const [selected, setSelectedState] = useState(
    () => tokenMemory?.get() ?? options.destinationToken,
  );
  const setSelected = useCallback(
    (symbol: string) => {
      setSelectedState(symbol);
      tokenMemory?.set(symbol);
    },
    [tokenMemory],
  );
  // Only tokens with a settlement route can be selected.
  const token = useMemo(
    () => creditable?.find((x) => x.symbol === selected) ?? creditable?.[0],
    [creditable, selected],
  );
  const route = token?.route;
  // A token picked from the other network's list (SOL with an EVM wallet):
  // selected once the wallet has switched there and can take it.
  const [pending, setPending] = useState<string>();
  useEffect(() => {
    if (pending && creditable?.some((x) => x.symbol === pending)) {
      setPending(undefined);
      setSelected(pending);
    } else if (token && token.symbol !== selected) setSelected(token.symbol);
  }, [token, selected, pending, creditable]);
  const selectToken = useCallback(
    (symbol: string) => {
      const chainId = tokens?.find((x) => x.symbol === symbol)?.switchChainId;
      if (!chainId) {
        setPending(undefined);
        setSelected(symbol);
        return;
      }
      // Orderly's own network switch: connects the other network's wallet.
      // It closes the dialog, so remember the pick beyond this component too.
      setPending(symbol);
      tokenMemory?.set(symbol);
      Promise.resolve(setChain({ chainId })).catch(() => setPending(undefined));
    },
    [tokens, setChain, setSelected, tokenMemory],
  );

  // ---- gating -------------------------------------------------------------
  let blocker: SwapperDepositBlocker | undefined;
  // Swapper's orderly destination is Orderly's mainnet Vault: on testnet it
  // would credit the wallet's mainnet account, not the testnet one.
  if (networkId !== "mainnet") blocker = "unsupportedNetwork";
  else if (status === AccountStatusEnum.NotConnected) blocker = "connectWallet";
  else if (isSubAccount) blocker = "subAccount";
  else if (!hasOrderlyKey) blocker = "enableTrading";
  else if (!tokensLoading && !route) blocker = "unsupportedNetwork";

  // ---- per-account widget config ----------------------------------------
  const minDepositUsd = options.minDepositUsd;
  // A data: URL — the widget's CSP blocks images from the DEX's own host.
  const destinationLogo = useLogoDataUrl(options.chainLogo);
  const customData = useMemo(
    // `brokerId` is what the widget requires for the orderly destination; the
    // destination branding shows this DEX instead of "Orderly"; the rest is
    // informational.
    () => ({
      brokerId,
      destinationChainName: options.chainName ?? (brokerName || undefined),
      destinationChainLogo: destinationLogo,
      dex: "orderly",
      plugin: PLUGIN_ID,
    }),
    [brokerId, brokerName, destinationLogo, options.chainName],
  );
  // The widget config for this wallet: known as soon as a mainnet wallet is,
  // even before trading is enabled — what the widget is preloaded with.
  const walletAddress =
    networkId === "mainnet" && status !== AccountStatusEnum.NotConnected
      ? accountState.address
      : undefined;
  const walletPatch = useMemo<DepositPatch | undefined>(() => {
    if (!route || !walletAddress) return undefined;
    return {
      dstChainId: SWAPPER_ORDERLY_CHAIN_ID,
      dstTokenAddr: route.tokenAddress,
      depositWalletAddress: walletAddress,
      minDepositUsd,
      customData,
    };
  }, [route, walletAddress, minDepositUsd, customData]);
  const patch = blocker ? undefined : walletPatch;
  // Keep the last good patch while a newly picked token resolves instead of
  // tearing the widget down — hiding it would send it back to its home screen.
  const lastPatch = useRef<DepositPatch>();
  if (patch) lastPatch.current = patch;
  else if (blocker) lastPatch.current = undefined;
  const effectivePatch = patch ?? lastPatch.current;

  const patchKey = keyOf(effectivePatch, brokerId);

  const { signer, key: signerKey } = useHostSigner(options.useHostWallet);

  const onTransactionSuccess = useCallback(
    (payload: TransactionSuccessPayload) => {
      toast.success(t("swapperDeposits.submitted"));
      options.onDepositSubmitted?.(payload);
    },
    [t, options],
  );

  return {
    blocker,
    /** Ready to deposit except the token list is still loading. */
    isLoading: !blocker && !effectivePatch,
    tokens,
    token,
    selectToken,
    minDepositUsd,
    patch: effectivePatch,
    patchKey,
    /** Config for the connected wallet, whether or not the form can show the widget yet. */
    walletPatch,
    walletPatchKey: keyOf(walletPatch, brokerId),
    signer,
    signerKey,
    onTransactionSuccess,
  };
}

export type SwapperDepositState = ReturnType<typeof useSwapperDeposit>;

/** Changes whenever the widget needs the patch re-applied. */
function keyOf(patch: DepositPatch | undefined, brokerId: string): string {
  return patch
    ? [
        patch.depositWalletAddress,
        patch.dstChainId,
        patch.dstTokenAddr,
        patch.minDepositUsd,
        brokerId,
        // The logo may finish converting after the widget has loaded.
        (patch.customData as { destinationChainLogo?: string } | undefined)?.destinationChainLogo,
      ].join("|")
    : "";
}

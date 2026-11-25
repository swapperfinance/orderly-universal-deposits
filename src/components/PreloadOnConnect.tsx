import { FC, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useAccount, useConfig } from "@orderly.network/hooks";
import { AccountStatusEnum, type NetworkId } from "@orderly.network/types";
import type { DepositEmbedController } from "../embed/DepositEmbedController";
import { useSwapperDeposit } from "../hooks/useSwapperDeposit";
import type { ResolvedSwapperDepositOptions } from "../types";

type Props = {
  controller: DepositEmbedController;
  options: ResolvedSwapperDepositOptions;
};

/**
 * Preloads the hidden widget once a mainnet wallet is connected, with that
 * wallet's deposit config (address, receive token, broker), and keeps the
 * config in step when the wallet or token changes. Renders nothing; mounted
 * next to components on screen app-wide (Orderly's account menus and main
 * menu). Before a wallet is connected nothing is loaded — no widget, no
 * Swapper requests.
 */
export const PreloadOnConnect: FC<Props> = (props) => {
  const { controller } = props;
  const { state } = useAccount();
  const networkId = useConfig("networkId") as NetworkId;
  // Mounted in several places, as a host app may replace some of them (the
  // Privy connector replaces both account menus): the oldest mounted runs.
  const [host] = useState(() => ({}));
  useLayoutEffect(() => controller.claimPreloadHost(host), [controller, host]);
  const active = useSyncExternalStore(controller.subscribePreloadHosts, () =>
    controller.isActivePreloadHost(host),
  );
  const connected =
    networkId === "mainnet" && state.status !== AccountStatusEnum.NotConnected && !!state.address;
  return active && connected ? <Preloader {...props} /> : null;
};

const Preloader: FC<Props> = ({ controller, options }) => {
  const { walletPatch, walletPatchKey, signer, signerKey } = useSwapperDeposit(
    options,
    controller.tokenMemory,
  );
  useEffect(() => {
    if (walletPatch) controller.preload(walletPatch);
    // walletPatchKey tracks every value that matters to the widget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, walletPatchKey]);
  // Hand the wallet over while preloading, so the widget opens with it
  // (Home with the wallet's card) instead of picking it up on first show.
  useEffect(() => {
    controller.setSigner(signerKey, signer);
  }, [controller, signerKey, signer]);
  return null;
};

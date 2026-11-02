import { FC, useEffect } from "react";
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
 * next to Orderly's account menu, which is on screen app-wide. Before a wallet
 * is connected nothing is loaded — no widget, no Swapper requests.
 */
export const PreloadOnConnect: FC<Props> = (props) => {
  const { state } = useAccount();
  const networkId = useConfig("networkId") as NetworkId;
  const connected =
    networkId === "mainnet" && state.status !== AccountStatusEnum.NotConnected && !!state.address;
  return connected ? <Preloader {...props} /> : null;
};

const Preloader: FC<Props> = ({ controller, options }) => {
  const { walletPatch, walletPatchKey } = useSwapperDeposit(options, controller.tokenMemory);
  useEffect(() => {
    if (walletPatch) controller.preload(walletPatch);
    // walletPatchKey tracks every value that matters to the widget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, walletPatchKey]);
  return null;
};

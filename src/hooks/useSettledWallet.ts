import { useAccount, useWalletConnector } from "@orderly.network/hooks";
import { ChainNamespace } from "@orderly.network/types";

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * The connected wallet, once Orderly's account has caught up with it.
 *
 * On a wallet switch the wallet connector changes at once (namespace,
 * wallet) while the account (address, status) follows a moment later, after
 * Orderly re-checks the new wallet's keys. Read together mid-switch they
 * describe two different wallets, e.g. the Solana namespace with the EVM
 * account address. `settling` is true for that window: anything the plugin
 * derives from the pair (the widget's signer, the deposit config, the
 * fallback to Orderly's own form) waits for it to end.
 */
export function useSettledWallet(): {
  /** The wallet's address, when the account matches it; undefined otherwise. */
  address?: string;
  isSolana: boolean;
  /** A wallet is connected but the account hasn't caught up with it yet. */
  settling: boolean;
} {
  const { wallet, namespace } = useWalletConnector();
  const { state } = useAccount();
  const isSolana = namespace === ChainNamespace.solana;
  const walletAddress = wallet?.accounts?.[0]?.address;
  if (!walletAddress) return { isSolana, settling: false };

  const fitsNamespace = EVM_ADDRESS.test(walletAddress) !== isSolana;
  const accountMatches =
    !!state.address && state.address.toLowerCase() === walletAddress.toLowerCase();
  const settled = fitsNamespace && accountMatches && !state.validating;
  return { address: settled ? walletAddress : undefined, isSolana, settling: !settled };
}

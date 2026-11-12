import { useMemo, useRef } from "react";
import { useAccount, useWalletConnector } from "@orderly.network/hooks";
import { ChainNamespace } from "@orderly.network/types";
import type { ViemWalletClientLike } from "@swapper-finance/deposit-sdk";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const toHex = (v: unknown) =>
  v === undefined || v === null ? undefined : `0x${BigInt(v as bigint).toString(16)}`;

const utf8ToHex = (text: string) =>
  `0x${Array.from(new TextEncoder().encode(text), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("")}`;

/**
 * The EVM wallet the user connected to Orderly, shaped as a minimal viem
 * WalletClient over its EIP-1193 provider (no viem/ethers dependency) so it
 * can be passed to the SDK's `updateSigner()`.
 *
 * `key` changes on connect / disconnect / account or chain switch — the SDK
 * wants `updateSigner()` called on each of those. `signer` itself only changes
 * with the wallet identity; it always reads the latest chain.
 */
export function useHostSigner(enabled: boolean): {
  signer: ViemWalletClientLike | null;
  key: string;
} {
  const { wallet, connectedChain, setChain, namespace } = useWalletConnector();
  const { state } = useAccount();

  const address = state.address;
  const chainId = connectedChain?.id ? Number(connectedChain.id) : undefined;
  const provider = wallet?.provider as unknown as Eip1193 | undefined;
  const usable =
    enabled &&
    namespace !== ChainNamespace.solana &&
    !!address &&
    !!chainId &&
    typeof provider?.request === "function";

  const latest = useRef({ provider, address, chainId, setChain });
  latest.current = { provider, address, chainId, setChain };

  const identity = usable ? `${address}:${wallet?.label ?? ""}` : "";

  const signer = useMemo<ViemWalletClientLike | null>(() => {
    if (!identity) return null;
    const request = (method: string, params: unknown[]) => {
      const p = latest.current.provider;
      if (!p) throw new Error("Wallet disconnected");
      return p.request({ method, params });
    };
    return {
      getAddresses: async () => [latest.current.address!],
      getChainId: async () => latest.current.chainId!,
      sendTransaction: async (args) =>
        (await request("eth_sendTransaction", [
          {
            from: args.account,
            to: args.to,
            data: args.data,
            value: toHex(args.value),
            gas: toHex(args.gas),
          },
        ])) as string,
      // Through Orderly where it can: for chains the DEX initialized, Onboard
      // also adds a chain the wallet doesn't have yet. The widget may switch
      // to a chain used only as a payment source (e.g. Polygon), which Orderly
      // never initialised and Onboard rejects before touching the wallet — the
      // case that surfaced as "Chain with chainId: 137 ... has not been set
      // and must be added when Onboard is initialized." Switch the wallet
      // provider directly then, like the SDK's own viem/ethers adapters;
      // Onboard picks the change up from the wallet's chainChanged event.
      switchChain: async ({ id }) => {
        try {
          await latest.current.setChain({ chainId: id });
        } catch {
          await request("wallet_switchEthereumChain", [{ chainId: toHex(id) }]);
        }
      },
      signMessage: async (args) => {
        const message = args.message as string | { raw: string };
        const data = typeof message === "string" ? utf8ToHex(message) : message.raw;
        return (await request("personal_sign", [data, args.account])) as string;
      },
      signTypedData: async ({ account, domain, types, primaryType, message }) =>
        (await request("eth_signTypedData_v4", [
          account,
          JSON.stringify({ domain, types, primaryType, message }),
        ])) as string,
    };
  }, [identity]);

  return { signer, key: identity ? `${identity}:${chainId}` : "none" };
}

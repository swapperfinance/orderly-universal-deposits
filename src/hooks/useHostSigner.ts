import { useMemo, useRef } from "react";
import { useWalletConnector } from "@orderly.network/hooks";
import type {
  AnySigner,
  SolanaSwapperSigner,
  ViemWalletClientLike,
} from "@swapper-finance/deposit-sdk";
import { VersionedTransaction } from "@solana/web3.js";
import { useSettledWallet } from "./useSettledWallet";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/** Orderly's Solana wallet provider (@orderly.network/default-solana-adapter). */
type SolanaProvider = {
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (base64: string) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const toHex = (v: unknown) =>
  v === undefined || v === null ? undefined : `0x${BigInt(v as bigint).toString(16)}`;

const utf8ToHex = (text: string) =>
  `0x${Array.from(new TextEncoder().encode(text), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("")}`;

/**
 * The wallet the user connected to Orderly, in the shape the SDK's
 * `updateSigner()` takes. An EVM wallet becomes a minimal viem WalletClient
 * over its EIP-1193 provider (no viem/ethers dependency); a Solana wallet a
 * SolanaSwapperSigner that signs the widget's transactions with Orderly's
 * Solana wallet adapter (the widget broadcasts them).
 *
 * `key` changes on connect / disconnect / account or chain switch — the SDK
 * wants `updateSigner()` called on each of those. `signer` itself only changes
 * with the wallet identity; it always reads the latest chain.
 */
export function useHostSigner(enabled: boolean): {
  signer: AnySigner | null;
  key: string;
} {
  const { wallet, connectedChain, setChain } = useWalletConnector();
  // No signer mid-switch: the namespace and the address would belong to two
  // different wallets (the widget then asked for "Solana" balances of an EVM
  // address and kept the Wallet row loading).
  const { address, isSolana, settling } = useSettledWallet();

  const chainId = connectedChain?.id ? Number(connectedChain.id) : undefined;
  const provider = wallet?.provider as unknown as Eip1193 | undefined;
  const solanaProvider = wallet?.provider as unknown as SolanaProvider | undefined;
  const usable = isSolana
    ? enabled && !!address && typeof solanaProvider?.signTransaction === "function"
    : enabled && !!address && !!chainId && typeof provider?.request === "function";

  const latest = useRef({ provider, solanaProvider, address, chainId, setChain });
  latest.current = { provider, solanaProvider, address, chainId, setChain };

  const identity = usable
    ? `${isSolana ? "solana" : "evm"}:${address}:${wallet?.label ?? ""}`
    : "";

  const signer = useMemo<AnySigner | null>(() => {
    if (!identity) return null;
    if (identity.startsWith("solana:")) {
      const solanaSigner: SolanaSwapperSigner = {
        ecosystem: "solana",
        getAddress: async () => latest.current.address!,
        walletName: wallet?.label?.toLowerCase(),
        signTransaction: async (transaction) => {
          const p = latest.current.solanaProvider;
          if (!p) throw new Error("Wallet disconnected");
          const signed = await p.signTransaction(
            VersionedTransaction.deserialize(fromBase64(transaction)),
          );
          return toBase64(signed.serialize());
        },
      };
      return solanaSigner;
    }
    const request = (method: string, params: unknown[]) => {
      const p = latest.current.provider;
      if (!p) throw new Error("Wallet disconnected");
      return p.request({ method, params });
    };
    const evmSigner: ViemWalletClientLike = {
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
    return evmSigner;
  }, [identity]);

  const result = { signer, key: identity ? `${identity}:${isSolana ? "" : chainId}` : "none" };
  // Mid-switch, keep handing over the previous wallet until the new one is
  // settled: dropping it would leave the widget walletless for a moment, and
  // a widget whose deposit can only be paid from Solana opens its own Solana
  // connect popup then — still open after the EVM wallet arrives.
  const last = useRef(result);
  if (settling && !identity) return last.current;
  last.current = result;
  return result;
}

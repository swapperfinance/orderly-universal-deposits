import { useEffect, useMemo, useState } from "react";
import { useConfig, useTokensInfo } from "@orderly.network/hooks";
import {
  ARBITRUM_MAINNET_CHAINID,
  ARBITRUM_TESTNET_CHAINID,
  SOLANA_MAINNET_CHAINID,
  SOLANA_TESTNET_CHAINID,
  type NetworkId,
} from "@orderly.network/types";
import {
  SWAPPER_ORDERLY_CHAIN_ID,
  SWAPPER_ORDERLY_SOLANA_TOKENS,
  SWAPPER_ORDERLY_TOKENS,
} from "../constants";

/** Symbol → address on the orderly destination, by the wallet network it serves. */
export type CreditableTokens = {
  evm: Record<string, string>;
  solana: Record<string, string>;
};

const BUILT_IN: CreditableTokens = {
  evm: SWAPPER_ORDERLY_TOKENS,
  solana: SWAPPER_ORDERLY_SOLANA_TOKENS,
};

const creditableCache = new Map<string, Promise<CreditableTokens>>();

/**
 * What Swapper credits on the orderly destination, read from its API (the
 * orderly chain's token list): a token Swapper starts crediting shows up in
 * the picker without a plugin release. One request per (API, integrator),
 * started at preload; the built-in snapshot stands in when it fails.
 */
export function fetchCreditableTokens(
  apiUrl: string,
  integratorId: string,
): Promise<CreditableTokens> {
  const key = `${apiUrl}|${integratorId}`;
  let promise = creditableCache.get(key);
  if (!promise) {
    // The endpoint lists the destination chain's tokens next to the source
    // chains for one destination token: USDC, which the orderly chain always has.
    const data = JSON.stringify({
      integratorId,
      depositChainId: SWAPPER_ORDERLY_CHAIN_ID,
      depositTokenAddr: SWAPPER_ORDERLY_TOKENS.USDC,
    });
    promise = fetch(`${apiUrl}/deposits/chains?data=${encodeURIComponent(data)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body: { destinationChain?: { tokens?: { symbol: string; address: string }[] } }) => {
        const out: CreditableTokens = { evm: {}, solana: {} };
        for (const token of body.destinationChain?.tokens ?? []) {
          // EVM tokens carry a 0x address; Solana's (SOL) a base58 one.
          const network = token.address.startsWith("0x") ? out.evm : out.solana;
          network[token.symbol.toUpperCase()] = token.address;
        }
        if (!out.evm.USDC) throw new Error("the orderly chain lists no USDC");
        return out;
      })
      .catch((err) => {
        console.warn("[swapperDeposits] Using the built-in receive-token list:", err);
        return BUILT_IN;
      });
    creditableCache.set(key, promise);
  }
  return promise;
}

/** `undefined` until the list is known. */
function useCreditableTokens(apiUrl: string, integratorId: string) {
  const [tokens, setTokens] = useState<CreditableTokens>();
  useEffect(() => {
    let current = true;
    fetchCreditableTokens(apiUrl, integratorId).then((t) => current && setTokens(t));
    return () => {
      current = false;
    };
  }, [apiUrl, integratorId]);
  return tokens;
}

export type SettlementRoute = {
  /** The token's address on the orderly destination — the widget's `dstTokenAddr`. */
  tokenAddress: string;
};

export type ReceiveToken = {
  /** Orderly token symbol, e.g. "USDC". */
  symbol: string;
  /**
   * Set when Swapper can credit this token: its backend deposits it into
   * Orderly's Vault. `undefined` — listed as not yet available.
   */
  route?: SettlementRoute;
  /**
   * Set when Swapper credits this token to the account of the other network's
   * wallet (SOL for a Solana wallet, the rest for an EVM one): the chain to
   * switch the wallet to.
   */
  switchChainId?: number;
};

/**
 * Every collateral token Orderly supports (`/v1/public/token`); the ones
 * Swapper deposits into this account (its API's list for an EVM wallet's
 * account, SOL for a Solana wallet's — see fetchCreditableTokens) are
 * selectable. `undefined` while loading.
 */
export function useReceiveTokens(params: {
  /** Optional allow-list of symbols. */
  tokens?: string[];
  /** The Orderly account belongs to a Solana wallet. */
  solana?: boolean;
  apiUrl: string;
  integratorId: string;
}): { tokens?: ReceiveToken[]; isLoading: boolean } {
  const networkId = useConfig("networkId") as NetworkId;
  const tokensInfo = useTokensInfo(networkId);
  const creditable = useCreditableTokens(params.apiUrl, params.integratorId);
  const allowKey = params.tokens?.join(",") ?? "";
  const addresses = params.solana ? creditable?.solana : creditable?.evm;
  const otherAddresses = params.solana ? creditable?.evm : creditable?.solana;
  const testnet = networkId === "testnet";
  const otherChainId = params.solana
    ? testnet ? ARBITRUM_TESTNET_CHAINID : ARBITRUM_MAINNET_CHAINID
    : testnet ? SOLANA_TESTNET_CHAINID : SOLANA_MAINNET_CHAINID;

  const tokens = useMemo(() => {
    if (!tokensInfo?.length || !addresses || !otherAddresses) return undefined;
    const allow = allowKey ? allowKey.split(",") : undefined;

    const list: ReceiveToken[] = [];
    for (const token of tokensInfo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((token as any).is_collateral === false) continue;
      if (allow && !allow.includes(token.token.toUpperCase())) continue;

      const symbol = token.token.toUpperCase();
      const tokenAddress = addresses[symbol];
      list.push({
        symbol: token.token,
        route: tokenAddress ? { tokenAddress } : undefined,
        switchChainId: !tokenAddress && otherAddresses[symbol] ? otherChainId : undefined,
      });
    }

    // Creditable tokens first (USDC on top), then the other network's, then
    // the not-yet-available ones.
    const rank = (x: ReceiveToken) => (x.route ? 0 : x.switchChainId ? 1 : 2);
    return list.sort(
      (a, b) => rank(a) - rank(b) || Number(b.symbol === "USDC") - Number(a.symbol === "USDC"),
    );
  }, [tokensInfo, allowKey, addresses, otherAddresses, otherChainId]);

  return { tokens, isLoading: !tokensInfo || !creditable };
}

import { useEffect, useMemo, useState } from "react";
import { useConfig, useTokensInfo } from "@orderly.network/hooks";
import { SolanaChains, type API, type NetworkId } from "@orderly.network/types";
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

/** Gives up on a request after this long: the built-in list stands in. */
const CREDITABLE_TIMEOUT_MS = 15_000;

const creditableCache = new Map<string, Promise<CreditableTokens>>();
/** The API's list, by request key, once a request has succeeded. */
const creditableKnown = new Map<string, CreditableTokens>();
/** Mounted pickers, by request key: told when a retried request succeeds. */
const creditableListeners = new Map<string, Set<(tokens: CreditableTokens) => void>>();
const creditableKey = (apiUrl: string, integratorId: string) => `${apiUrl}|${integratorId}`;

/**
 * What Swapper credits on the orderly destination, read from its API (the
 * orderly chain's token list): a token Swapper starts crediting shows up in
 * the picker without a plugin release. One request per (API, integrator),
 * started at preload; the built-in snapshot stands in when it fails, and a
 * failed request is forgotten, so the next caller (the Deposit dialog opening)
 * asks the API again.
 */
export function fetchCreditableTokens(
  apiUrl: string,
  integratorId: string,
): Promise<CreditableTokens> {
  const key = creditableKey(apiUrl, integratorId);
  let promise = creditableCache.get(key);
  if (!promise) {
    // The endpoint lists the destination chain's tokens next to the source
    // chains for one destination token: USDC, which the orderly chain always has.
    const data = JSON.stringify({
      integratorId,
      depositChainId: SWAPPER_ORDERLY_CHAIN_ID,
      depositTokenAddr: SWAPPER_ORDERLY_TOKENS.USDC,
    });
    const request: Promise<CreditableTokens> = fetch(
      `${apiUrl}/deposits/chains?data=${encodeURIComponent(data)}`,
      { signal: AbortSignal.timeout(CREDITABLE_TIMEOUT_MS) },
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body: { destinationChain?: { tokens?: { symbol: string; address: string }[] } }) => {
        const out: CreditableTokens = { evm: {}, solana: {} };
        for (const token of body.destinationChain?.tokens ?? []) {
          // EVM tokens carry a 0x address; Solana's a base58 one.
          const network = token.address.startsWith("0x") ? out.evm : out.solana;
          network[token.symbol.toUpperCase()] = token.address;
        }
        if (!out.evm.USDC) throw new Error("the orderly chain lists no USDC");
        creditableKnown.set(key, out);
        // Pickers showing the built-in list meanwhile
        creditableListeners.get(key)?.forEach((listener) => listener(out));
        return out;
      })
      .catch((err) => {
        console.warn("[swapperDeposits] Using the built-in receive-token list:", err);
        if (creditableCache.get(key) === request) creditableCache.delete(key);
        return BUILT_IN;
      });
    promise = request;
    creditableCache.set(key, promise);
  }
  return promise;
}

/**
 * The creditable tokens for the picker: the API's list once a request has
 * succeeded, the built-in one until then. Never waits on the API: a slow
 * request (a host service worker holding it, say) doesn't hold up the picker
 * or the widget preloaded from it; the API's list replaces the built-in one
 * when it arrives.
 */
function useCreditableTokens(apiUrl: string, integratorId: string) {
  const key = creditableKey(apiUrl, integratorId);
  const [tokens, setTokens] = useState<CreditableTokens>(
    () => creditableKnown.get(key) ?? BUILT_IN,
  );
  useEffect(() => {
    let current = true;
    const update = (t: CreditableTokens) => current && setTokens(t);
    update(creditableKnown.get(key) ?? BUILT_IN);
    let listeners = creditableListeners.get(key);
    if (!listeners) creditableListeners.set(key, (listeners = new Set()));
    listeners.add(update);
    fetchCreditableTokens(apiUrl, integratorId).then(update);
    return () => {
      current = false;
      listeners.delete(update);
    };
  }, [key, apiUrl, integratorId]);
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
};

/**
 * Whether Orderly takes this token on the account's network: a Solana
 * wallet's account is funded through Orderly's Solana Vault, an EVM wallet's
 * through its EVM Vaults. Read from the chains Orderly lists the token on; a
 * token listed with no chains is treated as EVM.
 */
function onAccountNetwork(token: API.Token, solana: boolean): boolean {
  const chains = token.chain_details ?? [];
  if (!chains.length) return !solana;
  return chains.some((chain) => SolanaChains.has(Number(chain.chain_id)) === solana);
}

/**
 * The collateral tokens Orderly takes on the account's network
 * (`/v1/public/token`): SOL, USDC and USDT for a Solana wallet's account, the
 * EVM collateral for an EVM wallet's. The ones Swapper deposits into this
 * account (its API's list for that network — see fetchCreditableTokens) are
 * selectable; the rest are listed as not yet available. `undefined` while
 * Orderly's token list loads.
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
  const solana = !!params.solana;
  const addresses = solana ? creditable.solana : creditable.evm;

  const tokens = useMemo(() => {
    if (!tokensInfo?.length || !addresses) return undefined;
    const allow = allowKey ? allowKey.split(",") : undefined;

    const list: ReceiveToken[] = [];
    for (const token of tokensInfo) {
      if (token.is_collateral === false) continue;
      if (!onAccountNetwork(token, solana)) continue;
      const symbol = token.token.toUpperCase();
      if (allow && !allow.includes(symbol)) continue;

      const tokenAddress = addresses[symbol];
      list.push({
        symbol: token.token,
        route: tokenAddress ? { tokenAddress } : undefined,
      });
    }

    // Creditable tokens first (USDC on top), then the not-yet-available ones.
    const rank = (x: ReceiveToken) => (x.route ? 0 : 1);
    return list.sort(
      (a, b) => rank(a) - rank(b) || Number(b.symbol === "USDC") - Number(a.symbol === "USDC"),
    );
  }, [tokensInfo, allowKey, addresses, solana]);

  return { tokens, isLoading: !tokensInfo };
}

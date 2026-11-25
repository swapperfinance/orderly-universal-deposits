import { FC, useEffect, useState } from "react";
import { useChains, useConfig, useWalletConnector } from "@orderly.network/hooks";
import { useTranslation } from "@orderly.network/i18n";
import {
  ChainNamespace,
  ETHEREUM_MAINNET_CHAINID,
  SOLANA_MAINNET_CHAINID,
  SolanaChains,
  isWalletChainChangePendingResult,
  type NetworkId,
} from "@orderly.network/types";
import {
  ChainIcon,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  WalletIcon,
  toast,
  useScreen,
} from "@orderly.network/ui";
import { hideDepositModal, markDepositWalletSwitching, type Ecosystem } from "../walletSwitch";

/**
 * The chain asked for when switching to an ecosystem. Ethereum for EVM: every
 * EVM wallet has it, while some don't offer Arbitrum at all (Phantom's EVM
 * account can't add networks) and would refuse the switch. The widget pays
 * from any chain anyway — it switches to the picked token's chain itself.
 */
const TARGET_CHAIN: Record<Ecosystem, number> = {
  evm: ETHEREUM_MAINNET_CHAINID,
  solana: SOLANA_MAINNET_CHAINID,
};

/** The network's own icon, for a menu item with no wallet seen on it yet. */
const NETWORK_ICON_CHAIN = TARGET_CHAIN;

/**
 * The last wallet seen connected on each network this session. Orderly's
 * wallet connector exposes only the current wallet, so the other network's
 * item shows the one used there before (as Orderly's own UI would) once the
 * user has switched at least once.
 */
const seenWallets: Partial<Record<Ecosystem, { label: string; address: string }>> = {};

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The networks this DEX offers wallets on, read from the chains it's set up
 * with (Orderly's chain list after the app's chain filter) — as Orderly's own
 * wallet connector decides whether to offer Solana wallets at all.
 */
function useEcosystems(): Record<Ecosystem, boolean> {
  const networkId = useConfig("networkId") as NetworkId;
  const [networkInfos] = useChains(networkId, { pick: "network_infos" });
  const found = { evm: false, solana: false };
  for (const info of networkInfos ?? []) {
    const chainId = Number((info as { chain_id?: number | string })?.chain_id);
    if (!chainId) continue;
    if (SolanaChains.has(chainId)) found.solana = true;
    else found.evm = true;
  }
  return found;
}

const shortAddress = (address: string) =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

/**
 * The wallet the deposit comes from, in the dialog header: its logo (the
 * address is in the tooltip and the menu), and — when the DEX offers wallets
 * on both networks — a menu to switch between an EVM and a Solana wallet. The
 * Swapper widget pays from the host's wallet only, so this is where the user
 * changes it — the same way Orderly's own deposit form does, by asking the
 * wallet connector for a chain on the other network: it switches straight
 * away to a wallet already connected there, or opens its connect drawer.
 */
export const HeaderWallet: FC = () => {
  const { t: t0 } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = t0 as any;
  const { wallet, namespace, setChain } = useWalletConnector();
  const [switching, setSwitching] = useState(false);
  const { isMobile } = useScreen();
  const ecosystems = useEcosystems();

  const address = wallet?.accounts?.[0]?.address;
  const current: Ecosystem = namespace === ChainNamespace.solana ? "solana" : "evm";
  const label = wallet?.label ?? "";
  useEffect(() => {
    if (address) seenWallets[current] = { label, address };
  }, [current, label, address]);

  if (!address) return null;
  // Both networks only when the DEX offers wallets on both: an EVM-only DEX
  // has no Solana wallet to switch to (and the reverse).
  const other: Ecosystem = current === "solana" ? "evm" : "solana";
  const canSwitch = ecosystems[other];

  const switchTo = async (target: Ecosystem) => {
    if (target === current || switching) return;
    setSwitching(true);
    markDepositWalletSwitching(true);
    try {
      const result = await setChain({ chainId: `0x${TARGET_CHAIN[target].toString(16)}` });
      // Pending: the connector opened its drawer to connect a wallet there.
      // Close this dialog rather than keep a second focus-trapping modal
      // under the drawer (as the legacy connector's drawer does anyway); the
      // user opens Deposit again once the wallet is connected.
      if (isWalletChainChangePendingResult(result)) hideDepositModal();
      else if (result === false) {
        toast.error(t("swapperDeposits.wallet.switchFailed"));
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof (error as { message?: unknown })?.message === "string"
            ? (error as { message: string }).message
            : "";
      // The user closed the connector's wallet modal: nothing to report.
      if (/user reject|rejected|cancel/i.test(message)) return;
      toast.error(
        message
          ? `${t("swapperDeposits.wallet.switchFailed")}: ${message}`
          : t("swapperDeposits.wallet.switchFailed"),
      );
    } finally {
      markDepositWalletSwitching(false);
      setSwitching(false);
    }
  };

  const option = (ecosystem: Ecosystem) => {
    const isCurrent = ecosystem === current;
    const seen = isCurrent ? { label, address } : seenWallets[ecosystem];
    return (
      <DropdownMenuItem
        key={ecosystem}
        onSelect={() => void switchTo(ecosystem)}
        className="swapper-wallet-item"
        {...(isCurrent ? { "data-current": "" } : {})}
      >
        <span className="swapper-wallet-icon">
          {seen?.label ? (
            <WalletIcon name={seen.label} size="sm" />
          ) : (
            <ChainIcon chainId={NETWORK_ICON_CHAIN[ecosystem]} size="sm" />
          )}
        </span>
        <span className="swapper-wallet-text">
          <span className="swapper-wallet-title">{t(`swapperDeposits.wallet.${ecosystem}`)}</span>
          <span className="swapper-wallet-sub">
            {seen
              ? `${seen.label ? `${seen.label} · ` : ""}${shortAddress(seen.address)}`
              : t("swapperDeposits.wallet.connect")}
          </span>
        </span>
        {isCurrent && (
          <span className="swapper-wallet-check">
            <CheckIcon />
          </span>
        )}
      </DropdownMenuItem>
    );
  };

  const chipClass =
    "oui-flex oui-h-full oui-items-center oui-gap-1.5 oui-rounded-md oui-bg-base-6 oui-px-2 oui-text-2xs oui-text-base-contrast-54";
  const logo = <WalletIcon name={label} size={isMobile ? "xs" : "2xs"} />;

  // One network only: the wallet's logo, nothing to switch to.
  if (!canSwitch) {
    return (
      <span
        role="img"
        aria-label={t("swapperDeposits.wallet.label")}
        title={`${t("swapperDeposits.wallet.label")}: ${address}`}
        className={chipClass}
      >
        {logo}
      </span>
    );
  }

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={switching}
          aria-label={t("swapperDeposits.wallet.label")}
          title={`${t("swapperDeposits.wallet.label")}: ${address}`}
          className={`${chipClass} hover:oui-bg-base-5 hover:oui-text-base-contrast disabled:oui-opacity-60`}
        >
          {logo}
          <ChevronIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent align="end" sideOffset={8} className="swapper-wallet-menu oui-z-[70]">
          {option("evm")}
          {option("solana")}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  );
};

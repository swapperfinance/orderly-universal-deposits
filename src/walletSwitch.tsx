import { FC, useEffect } from "react";
import { useAccount } from "@orderly.network/hooks";
import { useTranslation } from "@orderly.network/i18n";
import { AccountStatusEnum } from "@orderly.network/types";
import { modal } from "@orderly.network/ui";

export type Ecosystem = "evm" | "solana";

/** Orderly's Deposit / Withdraw modal ids (ui-transfer, which the plugin doesn't import). */
const DEPOSIT_DIALOG_ID = "DepositAndWithdrawWithDialogId";
const DEPOSIT_SHEET_ID = "DepositAndWithdrawWithSheetId";
/** Orderly's wallet connector / onboarding modal ids (ui-connector, not imported either). */
const ONBOARDING_DIALOG_ID = "walletConnector";
const ONBOARDING_SHEET_ID = "walletConnectorSheet";

/** How long the account setup may take (the user acting in their wallet). */
const REOPEN_WINDOW_MS = 3 * 60_000;

/**
 * The Deposit dialog was closed for the account setup it sent the user to
 * (creating the account / enabling trading) and comes back once trading is
 * enabled (ReopenDepositAfterSetup). A wallet switch that needs a wallet
 * connected closes the dialog too, but doesn't reopen it: the user opens
 * Deposit again once connected.
 */
let pending: { modalId: string; until: number } | undefined;

const depositModalId = (isMobile: boolean) => (isMobile ? DEPOSIT_SHEET_ID : DEPOSIT_DIALOG_ID);

/**
 * The connector is switching wallets right now (a switch started in the
 * Deposit dialog's header, and a few seconds after it returns): a connector
 * may drop the old wallet before the new one connects.
 */
let switchingUntil = 0;
let switchingNow = false;
const SWITCH_SETTLE_MS = 3000;

export function markDepositWalletSwitching(active: boolean): void {
  switchingNow = active;
  if (!active) switchingUntil = Date.now() + SWITCH_SETTLE_MS;
}

export function isDepositWalletSwitchPending(): boolean {
  return switchingNow || Date.now() < switchingUntil;
}

/** Closes the Deposit / Withdraw dialog (and sheet), whichever is open. */
export function hideDepositModal(): void {
  for (const id of [DEPOSIT_DIALOG_ID, DEPOSIT_SHEET_ID]) {
    void Promise.resolve()
      .then(() => modal.hide(id))
      .catch(() => {});
  }
}

/** Orderly's title for its onboarding modal at this account status. */
const OnboardingTitle: FC<{ status: AccountStatusEnum }> = ({ status }) => {
  const { t } = useTranslation();
  const { state } = useAccount();
  const current = Math.max(state.status, status);
  return (
    <>
      {current < AccountStatusEnum.SignedIn
        ? t("connector.createAccount")
        : current < AccountStatusEnum.EnableTrading
          ? t("connector.enableTrading")
          : t("connector.connectWallet")}
    </>
  );
};

/**
 * Sends the user through Orderly's own account setup (create account /
 * enable trading — the modal Orderly opens from its "Create account" and
 * "Enable trading" buttons) and reopens the Deposit dialog on its Deposit
 * tab once trading is enabled. If the user closes the setup without
 * finishing, the dialog stays closed.
 */
export function startAccountSetupForDeposit(options: {
  status: AccountStatusEnum;
  isMobile: boolean;
  /** Reads the account status now (the caller may have unmounted by then). */
  getStatus: () => AccountStatusEnum;
}): void {
  const { status, isMobile, getStatus } = options;
  const entry = {
    modalId: depositModalId(isMobile),
    until: Date.now() + REOPEN_WINDOW_MS,
  };
  pending = entry;
  // Not on top of the Deposit dialog: two focus-trapping modals at once fight
  // over focus, and Orderly itself opens this one on its own.
  void modal.hide(entry.modalId).catch(() => {});
  void modal
    .show(isMobile ? ONBOARDING_SHEET_ID : ONBOARDING_DIALOG_ID, {
      initAccountState: status,
      title: <OnboardingTitle status={status} />,
    })
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      // Closed: by finishing (trading gets enabled right after) or by giving
      // up. Give the account a moment to report the result, then forget a
      // setup that didn't finish.
      setTimeout(() => {
        if (pending === entry && getStatus() !== AccountStatusEnum.EnableTrading) {
          pending = undefined;
        }
      }, 2000);
    });
}

/**
 * Reopens the Deposit dialog on its Deposit tab once the account setup it
 * sent the user to has finished (trading enabled). Renders nothing; mounted
 * next to Orderly's account menu, which stays on screen while the dialog is
 * closed.
 */
export const ReopenDepositAfterSetup: FC = () => {
  const { state } = useAccount();
  const tradingEnabled = state.status === AccountStatusEnum.EnableTrading;

  useEffect(() => {
    if (!pending || !tradingEnabled) return;
    if (Date.now() > pending.until) {
      pending = undefined;
      return;
    }
    const { modalId } = pending;
    pending = undefined;
    // After the setup modal has finished closing.
    const timer = setTimeout(() => {
      void modal.show(modalId, { activeTab: "deposit" });
    }, 300);
    return () => clearTimeout(timer);
  }, [tradingEnabled]);

  return null;
};

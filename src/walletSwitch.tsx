import { FC } from "react";
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
 * "Enable trading" buttons) in place of the Deposit dialog. Once set up, the
 * user opens Deposit again.
 */
export function startAccountSetupForDeposit(options: {
  status: AccountStatusEnum;
  isMobile: boolean;
}): void {
  const { status, isMobile } = options;
  // Not on top of the Deposit dialog: two focus-trapping modals at once fight
  // over focus, and Orderly itself opens this one on its own.
  void modal.hide(depositModalId(isMobile)).catch(() => {});
  void modal
    .show(isMobile ? ONBOARDING_SHEET_ID : ONBOARDING_DIALOG_ID, {
      initAccountState: status,
      title: <OnboardingTitle status={status} />,
    })
    .catch(() => undefined);
}

import { modal } from "@orderly.network/ui";
import { DEPOSIT_DIALOG_ID, DEPOSIT_SHEET_ID } from "./constants";

/**
 * Open Orderly's Deposit dialog (which the plugin turns into the Swapper
 * deposit flow) from your own CTA. Pass `{ mobile: true }` — e.g. from
 * `useScreen().isMobile` — for the bottom-sheet variant.
 */
export function openSwapperDeposit(opts: { mobile?: boolean } = {}) {
  return modal.show(opts.mobile ? DEPOSIT_SHEET_ID : DEPOSIT_DIALOG_ID, {
    activeTab: "deposit",
  });
}

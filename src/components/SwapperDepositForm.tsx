import { ComponentType, FC, useEffect, useLayoutEffect, useRef } from "react";
import { Flex, Spinner } from "@orderly.network/ui";
import { WidgetEventName, type TransactionSuccessPayload } from "@swapper-finance/deposit-sdk";
import { FORM_MARKER_ATTR } from "../constants";
import type { DepositEmbedController, DepositPatch } from "../embed/DepositEmbedController";
import { useSwapperDeposit } from "../hooks/useSwapperDeposit";
import type { ResolvedSwapperDepositOptions } from "../types";
import { TokenPicker } from "./TokenPicker";

/**
 * The widget pads its content (componentStyles.padding = widgetPadding), and
 * Orderly's dialog / sheet pads its content too — side by side that reads as a
 * doubled inset. Widen the slot sideways into the container's padding (up to
 * its inner edge, never past it, so nothing paints outside the dialog) so the
 * widget's own padding does the job. The widget background matches the
 * dialog's, so the extended area is invisible.
 */
function bleedIntoContainerPadding(slot: HTMLElement, maxBleed: number) {
  const container = slot.closest<HTMLElement>('[role="dialog"]');
  if (!container) return;
  const c = container.getBoundingClientRect();
  const s = slot.getBoundingClientRect();
  if (!c.width || !container.offsetWidth) return;
  // The dialog may still be mid zoom-in animation: rects are transformed,
  // offsetWidth isn't — normalise back to layout pixels.
  const scale = c.width / container.offsetWidth;
  const cs = getComputedStyle(container);
  const left = (s.left - c.left) / scale - parseFloat(cs.borderLeftWidth || "0");
  const right = (c.right - s.right) / scale - parseFloat(cs.borderRightWidth || "0");
  const bleed = Math.floor(Math.max(0, Math.min(left, right, maxBleed)));
  if (!bleed) return;
  slot.style.marginLeft = `-${bleed}px`;
  slot.style.marginRight = `-${bleed}px`;
  slot.style.width = `calc(100% + ${bleed * 2}px)`;
}

/**
 * Placeholder the preloaded widget is revealed over. React owns the element;
 * the embed only mirrors its box (and sets its height, for the widget's
 * auto-sizing home screen).
 */
const EmbedSlot: FC<{
  controller: DepositEmbedController;
  patch: DepositPatch;
  patchKey: string;
  height: number;
  widgetPadding: number;
  onTransactionSuccess: (payload: TransactionSuccessPayload) => void;
  onCloseRequest?: () => void;
}> = ({ controller, patch, patchKey, height, widgetPadding, onTransactionSuccess, onCloseRequest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ patch, onTransactionSuccess, onCloseRequest });
  latest.current = { patch, onTransactionSuccess, onCloseRequest };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = `${height}px`; // initial; the embed takes over from here
    bleedIntoContainerPadding(el, widgetPadding);
    controller.show(el, latest.current.patch);
    return () => controller.hide(el);
  }, [controller, height, widgetPadding]);

  // Token / address changes patch the live widget — no reload.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    controller.update(latest.current.patch);
  }, [controller, patchKey]);

  useEffect(
    () =>
      controller.subscribe((event) => {
        if (event.type === WidgetEventName.TRANSACTION_SUCCESS) {
          latest.current.onTransactionSuccess(event.data as TransactionSuccessPayload);
        } else if (event.type === WidgetEventName.CLOSE_REQUEST) {
          // Keyboard focus inside the cross-origin iframe never reaches the
          // dialog's Escape handler — let the widget ask to close instead.
          latest.current.onCloseRequest?.();
        }
      }),
    [controller],
  );

  return <div ref={ref} className="oui-w-full oui-shrink-0" />;
};

export type SwapperDepositFormProps = {
  controller: DepositEmbedController;
  options: ResolvedSwapperDepositOptions;
  /** Orderly's native deposit form — the fallback. */
  Original: ComponentType<Record<string, unknown>>;
  originalProps: Record<string, unknown>;
};

/**
 * Replaces the form inside the "Deposit" tab of Orderly's Deposit / Withdraw
 * dialog: receive-token picker + the preloaded Swapper widget, nothing else.
 * Falls back to Orderly's own form whenever Swapper can't serve the account
 * (testnet, sub-accounts, no wallet, trading not enabled).
 *
 * The widget's navigation lives in the dialog header (see DialogBackButton).
 */
export const SwapperDepositForm: FC<SwapperDepositFormProps> = ({
  controller,
  options,
  Original,
  originalProps,
}) => {
  const state = useSwapperDeposit(options, controller.tokenMemory);

  // Keep the (possibly still hidden) widget connected to the host wallet.
  useEffect(() => {
    controller.setSigner(state.signerKey, state.signer);
  }, [controller, state.signerKey, state.signer]);

  if (state.blocker) return <Original {...originalProps} />;

  return (
    // No gaps around the widget: its own padding provides the spacing.
    <Flex direction="column" className="oui-w-full" {...{ [FORM_MARKER_ATTR]: "" }}>
      {state.tokens && (
        <TokenPicker
          tokens={state.tokens}
          value={state.token}
          onChange={state.selectToken}
        />
      )}

      {state.patch ? (
        <EmbedSlot
          controller={controller}
          patch={state.patch}
          patchKey={state.patchKey}
          height={options.height}
          widgetPadding={options.widgetPadding}
          onTransactionSuccess={state.onTransactionSuccess}
          onCloseRequest={originalProps.close as (() => void) | undefined}
        />
      ) : (
        <Flex
          itemAlign="center"
          justify="center"
          className="oui-w-full"
          style={{ height: options.height }}
        >
          <Spinner />
        </Flex>
      )}
    </Flex>
  );
};

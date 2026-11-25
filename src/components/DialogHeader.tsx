import {
  FC,
  PropsWithChildren,
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useAccount, useWalletConnector } from "@orderly.network/hooks";
import { useTranslation } from "@orderly.network/i18n";
import { AccountStatusEnum } from "@orderly.network/types";
import { CloseIcon } from "@orderly.network/ui";
import { HEADER_MARKER_ATTR, HEADER_TABLIST_SELECTOR } from "../constants";
import type { DepositEmbedController } from "../embed/DepositEmbedController";
import { hideDepositModal, isDepositWalletSwitchPending } from "../walletSwitch";
import { HeaderWallet } from "./HeaderWallet";

const GAP_PX = 8;
/** The close button at the row's right end (a 16px icon, flush right). */
const CLOSE_BUTTON_PX = 24;
/**
 * Orderly's own close button: a direct child of the dialog / sheet content,
 * pinned to its top corner. Hidden by the plugin stylesheet while this header
 * is inside, and clicked by the header's own close button in the tab row.
 */
const NATIVE_CLOSE_SELECTOR = ":scope > .oui-dialog-close-btn, :scope > .oui-sheet-close-btn";
/** How long the dialog takes to grow / shrink to the other tab's height. */
const TAB_RESIZE_MS = 260;

/** The incoming tab's fade-in, once the dialog has reached its height. */
const TAB_FADE_MS = 160;

/**
 * Animates a Deposit / Withdraw tab switch: the two tabs differ in height,
 * and Orderly's dialog snapped to the new one.
 *
 * - Height: pinned to the outgoing tab's, then transitioned to the incoming
 *   one's — following it while it settles (Orderly's Withdraw form finishes
 *   rendering a moment after the switch) — and released to size itself
 *   after. Only for the switch: a height pinned on open, before the content
 *   had laid out, kept the dialog tiny while the widget was revealed.
 * - Content: the incoming tab is hidden while the height moves and fades in
 *   once it's there. The Swapper widget is drawn over its slot from outside
 *   the dialog, so it can't be clipped by it: shown at once it hung past the
 *   still-growing dialog's edge. The SDK mirrors the tab's fade onto it.
 *
 * Imperative (no React state): it has to land in the same frame the tab
 * content swaps, before it paints.
 */
function animateTabHeight(wrapper: HTMLElement): () => void {
  const tabs = wrapper.querySelector<HTMLElement>(":scope > [data-orientation]");
  const list = tabs?.querySelector<HTMLElement>(':scope > div > [role="tablist"]');
  if (!tabs || !list || typeof ResizeObserver === "undefined") return () => {};
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";

  let lastHeight = tabs.offsetHeight; // the outgoing tab's, on a switch
  let animating = false;
  let panel: HTMLElement | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const onResize = new ResizeObserver(() => {
    lastHeight = tabs.offsetHeight;
    // Mid-switch: retarget to the incoming tab's real height (the running
    // transition carries on from where it is).
    if (animating) wrapper.style.height = `${lastHeight}px`;
  });
  onResize.observe(tabs);

  const releaseHeight = () => {
    animating = false;
    wrapper.style.height = "";
    wrapper.style.transition = "";
    wrapper.style.overflow = "";
  };
  const showPanel = (fade: boolean) => {
    const p = panel;
    if (!p) return;
    p.style.transition = fade ? `opacity ${TAB_FADE_MS}ms ease` : "";
    p.style.opacity = "";
    timers.push(
      setTimeout(() => {
        p.style.transition = "";
      }, TAB_FADE_MS + 40),
    );
    panel = null;
  };

  // The tab list marks the active tab in the same commit that swaps the
  // content; this runs before that frame paints.
  const onTabChange = new MutationObserver(() => {
    if (reduceMotion || !lastHeight) return;
    clearTimers();
    showPanel(false);
    // Hide the incoming tab until the height is there.
    panel = tabs.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]');
    if (panel) {
      panel.style.transition = "";
      panel.style.opacity = "0";
    }
    // Pin the outgoing height, then read the incoming one (the tabs lay out
    // at their own height inside the pinned box).
    wrapper.style.transition = "";
    wrapper.style.height = `${lastHeight}px`;
    wrapper.style.overflow = "clip";
    const target = tabs.offsetHeight;
    void wrapper.offsetHeight; // commit the pinned height before animating
    animating = true;
    wrapper.style.transition = `height ${TAB_RESIZE_MS}ms ${ease}`;
    wrapper.style.height = `${target}px`;
    timers.push(
      setTimeout(() => {
        releaseHeight();
        showPanel(true);
      }, TAB_RESIZE_MS),
    );
  });
  onTabChange.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] });

  return () => {
    clearTimers();
    onTabChange.disconnect();
    onResize.disconnect();
    releaseHeight();
    showPanel(false);
  };
}

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Wraps Orderly's Deposit / Withdraw dialog content and puts the Swapper
 * widget's navigation into the dialog header: when the widget can go back, a
 * back arrow animates in at the start of the Deposit / Withdraw tab row and
 * pushes the tabs right (the tab list's margin is animated by the plugin
 * stylesheet, keyed off the `data-swapper-back` attribute set here).
 *
 * On the right of the row it shows the wallet the widget pays from, with the
 * switch between an EVM and a Solana wallet (HeaderWallet), and the dialog's
 * close button, moved into the row so it lines up with the tabs (it clicks
 * Orderly's own, hidden, so closing works exactly as before).
 *
 * Orderly's own component (and any other plugin wrapping it) still renders
 * underneath — nothing is re-implemented or patched after render.
 */
export const DialogHeader: FC<PropsWithChildren<{ controller: DepositEmbedController }>> = ({
  controller,
  children,
}) => {
  const { t: t0 } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = t0 as any;
  const ui = useSyncExternalStore(controller.subscribeUi, () => controller.getUi());
  const nav = ui.navigation;
  const show = ui.visible && !!nav && nav.tab !== "home" && nav.canGoBack;

  // Align the button with the tab row (read-only layout measurement).
  const ref = useRef<HTMLDivElement>(null);
  const [row, setRow] = useState<{ top: number; size: number }>();
  const nativeClose = useRef<HTMLElement | null>(null);
  // Where the widget parks between the Deposit and Withdraw tabs.
  const park = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = park.current;
    if (!el) return;
    controller.setParkTarget(el);
    return () => controller.releaseParkTarget(el);
  }, [controller]);
  const [hasClose, setHasClose] = useState(false);
  useLayoutEffect(() => {
    const wrapper = ref.current;
    const list = wrapper?.querySelector<HTMLElement>(HEADER_TABLIST_SELECTOR);
    if (!wrapper || !list) return;
    // Inside Orderly's dialog / sheet (not the tabs rendered inline on a page).
    nativeClose.current =
      wrapper.closest<HTMLElement>('[role="dialog"]')?.querySelector<HTMLElement>(NATIVE_CLOSE_SELECTOR) ?? null;
    setHasClose(!!nativeClose.current);
    const measure = () => {
      const w = wrapper.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      // Rects are scaled while the dialog zooms in; offsetHeight isn't.
      const scale = wrapper.offsetHeight ? w.height / wrapper.offsetHeight : 1;
      setRow({ top: (l.top - w.top) / (scale || 1), size: list.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => (ref.current ? animateTabHeight(ref.current) : undefined), []);

  // The wallet disconnected with the dialog open: nothing left to deposit
  // from or withdraw to — close it, as its own close button would. Not while
  // a wallet switch started in the header is under way (a connector may drop
  // the old wallet before the new one connects).
  const { state: accountState } = useAccount();
  const { wallet } = useWalletConnector();
  const disconnected =
    !wallet?.accounts?.[0]?.address &&
    (accountState.status === AccountStatusEnum.NotConnected ||
      accountState.status === AccountStatusEnum.EnableTradingWithoutConnected);
  useEffect(() => {
    if (!disconnected) return;
    const close = () => {
      if (nativeClose.current) nativeClose.current.click();
      else hideDepositModal();
    };
    if (!isDepositWalletSwitchPending()) {
      close();
      return;
    }
    // Mid-switch: close only if no wallet has turned up once it's over.
    const timer = setInterval(() => {
      if (!isDepositWalletSwitchPending()) {
        clearInterval(timer);
        close();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [disconnected]);

  const size = row?.size ?? 32;

  return (
    <div
      ref={ref}
      className="oui-relative"
      {...{ [HEADER_MARKER_ATTR]: "" }}
      {...(show ? { "data-swapper-back": "" } : {})}
      style={{ ["--swapper-back-offset" as string]: `${size + GAP_PX}px` }}
    >
      <button
        type="button"
        onClick={() => controller.goBack()}
        aria-label={t("swapperDeposits.back")}
        aria-hidden={!show}
        tabIndex={show ? 0 : -1}
        className="swapper-dialog-back oui-absolute oui-left-0 oui-z-10 oui-flex oui-items-center oui-justify-center oui-rounded-md oui-bg-base-6 oui-text-base-contrast-54 hover:oui-bg-base-5 hover:oui-text-base-contrast"
        style={{ top: row?.top ?? 0, width: size, height: size }}
      >
        <BackIcon />
      </button>
      {/* The wallet the widget pays from, with the EVM / Solana switch: the
          widget itself offers no other wallet. Only while it's on screen
          (the Deposit tab). */}
      {ui.visible && (
        <div
          className="oui-absolute oui-z-10 oui-flex"
          style={{ top: row?.top ?? 0, height: size, right: hasClose ? CLOSE_BUTTON_PX + GAP_PX : 0 }}
        >
          <HeaderWallet />
        </div>
      )}
      {hasClose && (
        <button
          type="button"
          onClick={() => nativeClose.current?.click()}
          aria-label={t("swapperDeposits.close")}
          className="oui-absolute oui-right-0 oui-z-10 oui-flex oui-items-center oui-justify-end oui-opacity-80 hover:oui-opacity-100"
          style={{ top: row?.top ?? 0, width: CLOSE_BUTTON_PX, height: size }}
        >
          <CloseIcon size={16} color="white" opacity={0.98} />
        </button>
      )}
      <div
        ref={park}
        aria-hidden
        className="oui-pointer-events-none oui-absolute oui-inset-x-0 oui-top-0"
        style={{ visibility: "hidden" }}
      />
      {children}
    </div>
  );
};

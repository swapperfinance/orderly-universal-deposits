import {
  FC,
  PropsWithChildren,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "@orderly.network/i18n";
import { HEADER_MARKER_ATTR, HEADER_TABLIST_SELECTOR } from "../constants";
import type { DepositEmbedController } from "../embed/DepositEmbedController";

const GAP_PX = 8;

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
  useLayoutEffect(() => {
    const wrapper = ref.current;
    const list = wrapper?.querySelector<HTMLElement>(HEADER_TABLIST_SELECTOR);
    if (!wrapper || !list) return;
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
    return () => ro.disconnect();
  }, []);

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
      {children}
    </div>
  );
};

import { FC, useEffect, useRef } from "react";
import {
  SwapperIframe,
  WidgetEventName,
  type AnySigner,
  type SwapperConfig,
  type SwapperEvent,
  type SwapperStyles,
  type TransactionSuccessPayload,
} from "@swapper-finance/deposit-sdk";
import type { DepositPatch } from "../embed/DepositEmbedController";

export type SwapperIframeHostProps = {
  /** Static config — read once at mount. */
  base: Omit<SwapperConfig, keyof DepositPatch>;
  /** Per-account values — patched into the live widget when `patchKey` changes. */
  patch: DepositPatch;
  patchKey: string;
  styles: SwapperStyles;
  signer: AnySigner | null;
  signerKey: string;
  height: number;
  iframeUrl?: string;
  onEvent?: (event: SwapperEvent) => void;
  onTransactionSuccess?: (payload: TransactionSuccessPayload) => void;
};

/**
 * Inline (non-preloaded) widget for standalone placements such as an
 * onboarding page. One SwapperIframe per mount; config, styles and wallet
 * changes are pushed to the live widget without reloading it.
 */
export const SwapperIframeHost: FC<SwapperIframeHostProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const swapperRef = useRef<SwapperIframe | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    if (!containerRef.current) return;
    const p = latest.current;
    const swapper = new SwapperIframe({
      ...p.base,
      ...p.patch,
      styles: p.styles,
      container: containerRef.current,
      iframeUrl: p.iframeUrl,
      flexibleHeight: true,
      iframeAttributes: {
        width: "100%",
        minWidth: "0",
        height: `${p.height}px`,
        title: "Swapper deposit",
      },
      onEvent: (event) => {
        latest.current.onEvent?.(event);
        if (event.type === WidgetEventName.TRANSACTION_SUCCESS) {
          latest.current.onTransactionSuccess?.(event.data as TransactionSuccessPayload);
        }
      },
    });
    swapperRef.current = swapper;
    if (p.signer) swapper.updateSigner(p.signer);
    return () => {
      swapper.destroy();
      swapperRef.current = null;
    };
  }, []);

  const mounted = useRef({ patch: false, signer: false, styles: false });

  useEffect(() => {
    if (!mounted.current.patch) return void (mounted.current.patch = true);
    swapperRef.current?.updateConfig(latest.current.patch);
  }, [props.patchKey]);

  useEffect(() => {
    if (!mounted.current.signer) return void (mounted.current.signer = true);
    swapperRef.current?.updateSigner(latest.current.signer);
  }, [props.signerKey]);

  useEffect(() => {
    if (!mounted.current.styles) return void (mounted.current.styles = true);
    swapperRef.current?.updateStyles(props.styles);
  }, [props.styles]);

  return <div ref={containerRef} className="oui-w-full oui-overflow-hidden" />;
};

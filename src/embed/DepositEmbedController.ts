import {
  ActionLabel,
  preloadSwapperEmbed,
  WidgetEventName,
  type AnySigner,
  type NavigationStatePayload,
  type SwapperConfig,
  type SwapperEmbed,
  type SwapperEvent,
} from "@swapper-finance/deposit-sdk";
import { PARKED_WIDGET_WIDTH } from "../constants";
import { observeTheme, resolveStyles } from "../theme";
import type { ResolvedSwapperDepositOptions } from "../types";

/** Per-deposit values that change while the widget is alive. */
export type DepositPatch = Pick<
  SwapperConfig,
  | "dstChainId"
  | "dstTokenAddr"
  | "depositWalletAddress"
  | "minDepositUsd"
  | "customData"
>;

export type DepositUiState = {
  /** The widget is revealed in the Deposit tab right now. */
  visible: boolean;
  navigation: NavigationStatePayload | null;
};

/** Static widget config shared by every mount. */
export function baseConfig(options: ResolvedSwapperDepositOptions) {
  return {
    integratorId: options.integratorId,
    actionLabel: ActionLabel.Deposit,
    supportedDepositOptions: options.depositMethods,
    maxDepositUsd: options.maxDepositUsd,
  };
}

/**
 * Owns the one preloaded Swapper widget that replaces Orderly's deposit form.
 *
 * The widget is created hidden once a wallet is connected (see
 * PreloadOnConnect), always from that wallet's real config — never a
 * placeholder address — so opening the Deposit dialog reveals an
 * already-loaded widget instantly. Wallet or token changes are patched into
 * the live widget. Without a preload, the first `show()` creates it.
 * SwapperEmbed never reparents the iframe (that would reload it); it mirrors a
 * fixed-position host over whatever slot element the form renders.
 */
export class DepositEmbedController {
  private embed?: SwapperEmbed;
  private slot?: HTMLElement;
  private signerKey?: string;
  /** Latest host wallet, kept until the widget exists to receive it. */
  private signer: AnySigner | null = null;
  private listeners = new Set<(event: SwapperEvent) => void>();
  private teardown: Array<() => void> = [];
  private selectedToken?: string;
  private navigation: NavigationStatePayload | null = null;
  private ui: DepositUiState = { visible: false, navigation: null };
  private uiListeners = new Set<() => void>();

  /**
   * The receive token the user picked. Lives here (not in component state) so
   * it survives Deposit/Withdraw tab switches and dialog re-opens — and the
   * preloaded widget, which keeps the last config, stays in sync with it.
   */
  readonly tokenMemory = {
    get: () => this.selectedToken,
    set: (symbol: string) => {
      this.selectedToken = symbol;
    },
  };

  constructor(private readonly options: ResolvedSwapperDepositOptions) {}

  /**
   * Builds the hidden widget for this wallet's deposit config and starts
   * loading it; once built, patches the config instead. Browser only.
   */
  preload(patch: DepositPatch): void {
    if (this.embed) {
      this.update(patch);
      return;
    }
    if (typeof window === "undefined") return;

    this.embed = preloadSwapperEmbed({
      ...baseConfig(this.options),
      ...patch,
      iframeUrl: this.options.iframeUrl,
      flexibleHeight: true,
      iframeAttributes: {
        width: PARKED_WIDGET_WIDTH,
        height: `${this.options.height}px`,
        title: "Swapper deposit",
      },
      // The dialog header renders the widget's navigation (DialogHeader),
      // driven by navigation_state events + goBack().
      styles: resolveStyles(this.options, undefined, { hideNavigation: true }),
      onEvent: (event) => {
        if (event.type === WidgetEventName.NAVIGATION_STATE) {
          this.navigation = event.data as NavigationStatePayload;
          this.emitUi();
        }
        this.listeners.forEach((l) => l(event));
      },
    });
    if (this.signer) this.embed.updateSigner(this.signer);

    if (this.options.matchOrderlyTheme) {
      this.teardown.push(
        observeTheme((theme) =>
          this.embed
            ?.getIframe()
            .updateStyles(resolveStyles(this.options, theme, { hideNavigation: true })),
        ),
      );
    }

    this.installFocusGuards();
  }

  /** Reveals the widget over `slot`, with the account's deposit values applied first. */
  show(slot: HTMLElement, patch: DepositPatch): void {
    this.preload(patch);
    if (!this.embed) return;
    this.slot = slot;
    this.embed.showIn(slot);
    this.emitUi();
    // Radix modals set `pointer-events: none` on <body>; the host lives
    // outside the dialog, so make sure the iframe itself stays interactive.
    const iframe = this.iframeElement();
    if (iframe) iframe.style.pointerEvents = "auto";
  }

  /** Hides the widget (it stays loaded and returns to its home screen). */
  hide(slot: HTMLElement): void {
    if (this.slot !== slot) return; // a newer slot already took over
    this.slot = undefined;
    this.embed?.hide();
    this.emitUi();
  }

  /**
   * What the dialog header needs: whether the widget is on screen and its
   * navigation state. Snapshot is replaced (not mutated) on every change, so
   * it works with useSyncExternalStore.
   */
  getUi(): DepositUiState {
    return this.ui;
  }

  subscribeUi = (listener: () => void): (() => void) => {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  };

  private emitUi(): void {
    const visible = !!this.slot;
    if (this.ui.visible === visible && this.ui.navigation === this.navigation) return;
    this.ui = { visible, navigation: this.navigation };
    this.uiListeners.forEach((l) => l());
  }

  /** Patches the live widget without reloading it (token / address change). */
  update(patch: DepositPatch): void {
    this.embed?.updateConfig(patch);
  }

  /**
   * Hands the host wallet to the widget. `key` identifies address + chain;
   * the SDK asks for a fresh signer on every connect / chain switch.
   */
  setSigner(key: string, signer: AnySigner | null): void {
    if (key === this.signerKey) return;
    this.signerKey = key;
    this.signer = signer;
    this.embed?.updateSigner(signer);
  }

  /** Last navigation state reported by the widget (tab, title, step, canGoBack). */
  getNavigation(): NavigationStatePayload | null {
    return this.navigation;
  }

  /** Same as the widget's own (hidden) back button. */
  goBack(): void {
    this.embed?.goBack();
  }

  subscribe(listener: (event: SwapperEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.teardown.forEach((fn) => fn());
    this.teardown = [];
    this.embed?.destroy();
    this.embed = undefined;
    this.signerKey = undefined;
    this.signer = null;
  }

  private iframeElement(): HTMLIFrameElement | null {
    try {
      return this.embed?.getIframe().getIframe() ?? null;
    } catch {
      return null;
    }
  }

  /** The body-level host element the embed positions over the slot. */
  private hostElement(): HTMLElement | null {
    let el: HTMLElement | null = this.iframeElement();
    while (el?.parentElement && el.parentElement !== document.body) el = el.parentElement;
    return el;
  }

  /**
   * Orderly's dialogs are Radix modals with a focus trap: focus moving into
   * the (body-level) widget iframe would be pulled straight back, breaking
   * the widget's inputs. Hide those focus moves from the trap's
   * document-level listeners by stopping them in the window capture phase.
   */
  private installFocusGuards(): void {
    const isWidget = (node: EventTarget | null) => {
      const host = this.hostElement();
      return !!host && node instanceof Node && host.contains(node);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isWidget(e.target)) e.stopImmediatePropagation();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (isWidget(e.relatedTarget)) e.stopImmediatePropagation();
    };
    window.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("focusout", onFocusOut, true);
    this.teardown.push(() => {
      window.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("focusout", onFocusOut, true);
    });
  }
}

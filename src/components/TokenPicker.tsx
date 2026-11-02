import { FC, useEffect, useState } from "react";
import { useTranslation } from "@orderly.network/i18n";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  Flex,
  Text,
  TokenIcon,
} from "@orderly.network/ui";
import { SolanaChains } from "@orderly.network/types";
import type { ReceiveToken } from "../hooks/useDestination";

/**
 * Above the widget overlay: the widget is painted by a fixed host stacked just
 * over the dialog layer, so the menu portal must sit higher than that.
 */
const MENU_Z_INDEX = 1000;

const Caret: FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
    className="oui-text-base-contrast-54 oui-transition-transform oui-duration-200"
    style={{ transform: open ? "rotate(180deg)" : undefined }}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.007 7.996c-.824 0-1.276.935-.781 1.594l6 8a.994.994 0 0 0 1.593 0l6-8c.495-.66.012-1.594-.812-1.594h-12Z"
    />
  </svg>
);

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="oui-text-primary">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export type TokenPickerProps = {
  tokens: ReceiveToken[];
  value?: ReceiveToken;
  onChange: (symbol: string) => void;
};

/**
 * "Receive token" — the token credited to the Orderly account. Lists every
 * collateral token Orderly supports; the settlement chain is picked
 * automatically, so no chain is shown. Tokens credited on the other network
 * (SOL with an EVM wallet) switch the wallet there; tokens without a
 * settlement route yet are listed but disabled.
 */
export const TokenPicker: FC<TokenPickerProps> = ({ tokens, value, onChange }) => {
  const { t: t0 } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = t0 as any;
  const [open, setOpen] = useState(false);

  // Clicks inside the cross-origin widget iframe never reach this document,
  // so "click outside" can't close the menu — the window losing focus to the
  // iframe does.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("blur", close);
    return () => window.removeEventListener("blur", close);
  }, [open]);

  return (
    <DropdownMenuRoot open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="oui-flex oui-h-[54px] oui-w-full oui-items-center oui-justify-between oui-rounded-lg oui-bg-base-6 oui-px-3 oui-text-left hover:oui-bg-base-5 oui-transition-colors"
        >
          <Flex direction="column" itemAlign="start">
            <Text size="2xs" intensity={36}>
              {t("swapperDeposits.receiveToken")}
            </Text>
            <Text size="sm" intensity={80}>
              {t("swapperDeposits.receiveTokenHint")}
            </Text>
          </Flex>
          <Flex itemAlign="center" gapX={1} className="oui-text-sm oui-font-semibold oui-text-base-contrast-80">
            {value && <TokenIcon name={value.symbol} size="xs" />}
            <span>{value?.symbol ?? "—"}</span>
            <Caret open={open} />
          </Flex>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={{ zIndex: MENU_Z_INDEX }}
          className="oui-flex oui-w-[var(--radix-dropdown-menu-trigger-width)] oui-flex-col oui-gap-0.5 oui-p-1.5"
        >
          {tokens.map((token) => {
            const selected = token.symbol === value?.symbol;
            const disabled = !token.route && !token.switchChainId;
            return (
              <DropdownMenuItem
                key={token.symbol}
                disabled={disabled}
                onSelect={() => !disabled && onChange(token.symbol)}
                className={
                  "oui-flex oui-h-10 oui-items-center oui-gap-2 oui-rounded-md oui-px-2.5 oui-text-sm " +
                  (disabled
                    ? "oui-cursor-not-allowed oui-opacity-40"
                    : "oui-cursor-pointer hover:oui-bg-base-5") +
                  (selected ? " oui-bg-base-5" : "")
                }
              >
                <TokenIcon name={token.symbol} size="xs" />
                <span className="oui-flex-1 oui-font-semibold oui-text-base-contrast-80">
                  {token.symbol}
                </span>
                {disabled || token.switchChainId ? (
                  <span className="oui-rounded oui-bg-base-4 oui-px-1.5 oui-py-0.5 oui-text-2xs oui-text-base-contrast-54">
                    {t(
                      disabled
                        ? "swapperDeposits.soon"
                        : SolanaChains.has(token.switchChainId!)
                          ? "swapperDeposits.switchToSolana"
                          : "swapperDeposits.switchToEvm",
                    )}
                  </span>
                ) : (
                  selected && <Check />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  );
};

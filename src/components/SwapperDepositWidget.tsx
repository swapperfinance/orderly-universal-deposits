import { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@orderly.network/i18n";
import { Flex, Spinner, Text } from "@orderly.network/ui";
import type { SwapperStyles } from "@swapper-finance/deposit-sdk";
import { baseConfig } from "../embed/DepositEmbedController";
import { useSwapperDeposit } from "../hooks/useSwapperDeposit";
import { LocaleProvider } from "../i18n";
import { resolveOptions } from "../options";
import { injectStyles } from "../styles";
import { observeTheme, resolveStyles } from "../theme";
import type { ResolvedSwapperDepositOptions, SwapperDepositPluginOptions } from "../types";
import { SwapperIframeHost } from "./SwapperIframeHost";
import { TokenPicker } from "./TokenPicker";

function useWidgetStyles(options: ResolvedSwapperDepositOptions): SwapperStyles {
  const [styles, setStyles] = useState(() => resolveStyles(options));
  useEffect(() => {
    if (!options.matchOrderlyTheme) return;
    return observeTheme((theme) => setStyles(resolveStyles(options, theme)));
  }, [options]);
  return styles;
}

const Inner: FC<{ options: ResolvedSwapperDepositOptions }> = ({ options }) => {
  const { t: t0 } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = t0 as any;
  const state = useSwapperDeposit(options);
  const styles = useWidgetStyles(options);
  const base = useMemo(() => baseConfig(options), [options]);

  return (
    <Flex direction="column" gap={3} className="oui-w-full">
      {state.tokens && !state.blocker && (
        <TokenPicker tokens={state.tokens} value={state.token} onChange={state.selectToken} />
      )}

      {state.blocker ? (
        <Flex
          direction="column"
          itemAlign="center"
          gap={3}
          className="oui-w-full oui-rounded-xl oui-bg-base-6 oui-px-4 oui-py-8 oui-text-center"
        >
          <Text size="sm" intensity={80}>
            {t(`swapperDeposits.${state.blocker}`)}
          </Text>
        </Flex>
      ) : state.patch ? (
        <SwapperIframeHost
          base={base}
          patch={state.patch}
          patchKey={state.patchKey}
          styles={styles}
          signer={state.signer}
          signerKey={state.signerKey}
          height={options.height}
          iframeUrl={options.iframeUrl}
          onEvent={options.onEvent}
          onTransactionSuccess={state.onTransactionSuccess}
        />
      ) : (
        <Flex
          itemAlign="center"
          justify="center"
          className="oui-w-full oui-rounded-xl oui-bg-base-6"
          style={{ height: options.height }}
        >
          <Spinner />
        </Flex>
      )}
    </Flex>
  );
};

export type SwapperDepositWidgetProps = SwapperDepositPluginOptions;

/**
 * Standalone Swapper deposit panel (receive-token picker + widget) for use
 * anywhere inside `OrderlyAppProvider`, e.g. an onboarding page. The plugin
 * itself replaces the form in Orderly's Deposit dialog; this is for extra
 * placements.
 */
export const SwapperDepositWidget: FC<SwapperDepositWidgetProps> = (props) => {
  // Options are read once per mount — pass stable config.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => {
    const resolved = resolveOptions(props);
    // During render, so the styles are in place before the first paint.
    if (resolved.injectStyles) injectStyles();
    return resolved;
  }, []);
  return (
    <LocaleProvider>
      <Inner options={options} />
    </LocaleProvider>
  );
};

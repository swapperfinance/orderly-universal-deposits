import { registerSwapperDepositPlugin } from "./plugin";

export { registerSwapperDepositPlugin };
/**
 * Marketplace convention: Orderly DEX Creator resolves `registerPlugin`
 * (then `default`) and calls it with the DEX's flat plugin config.
 */
export { registerSwapperDepositPlugin as registerPlugin };
export default registerSwapperDepositPlugin;

export { openSwapperDeposit } from "./openSwapperDeposit";
export { SwapperDepositWidget } from "./components/SwapperDepositWidget";
export type { SwapperDepositWidgetProps } from "./components/SwapperDepositWidget";
export { PLUGIN_ID } from "./constants";
export type { SwapperDepositPluginOptions } from "./types";

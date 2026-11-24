export const LocaleMessages = {
  "swapperDeposits.pluginName": "Universal Deposits",

  "swapperDeposits.receiveToken": "Receive token",
  "swapperDeposits.receiveTokenHint": "Credited to your account",
  "swapperDeposits.soon": "Soon",
  "swapperDeposits.back": "Back",
  "swapperDeposits.close": "Close",

  // Dialog header: the wallet the deposit comes from
  "swapperDeposits.wallet.label": "Your Web3 Wallet",
  "swapperDeposits.wallet.evm": "EVM wallet",
  "swapperDeposits.wallet.solana": "Solana wallet",
  "swapperDeposits.wallet.connect": "Connect a wallet",
  "swapperDeposits.wallet.switchFailed": "Couldn't switch the wallet",

  // Standalone widget only — the dialog falls back to Orderly's own form.
  "swapperDeposits.connectWallet": "Connect your wallet to deposit with Swapper.",
  "swapperDeposits.enableTrading":
    "Finish setting up your account (sign in and enable trading) to deposit with Swapper.",
  "swapperDeposits.subAccount":
    "Swapper deposits go to your main account. Switch to the main account to continue.",
  "swapperDeposits.unsupportedNetwork": "Swapper deposits are not available on this network.",

  "swapperDeposits.submitted": "Deposit sent — it will be credited to your account shortly.",
};

export type TLocaleMessages = typeof LocaleMessages;

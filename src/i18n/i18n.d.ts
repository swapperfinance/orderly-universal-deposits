import type { TLocaleMessages } from "./module";
import type { LocaleMessages as LocaleMessagesType } from "@orderly.network/i18n";

declare module "@orderly.network/i18n" {
  interface LocaleMessages extends LocaleMessagesType, TLocaleMessages {}
}

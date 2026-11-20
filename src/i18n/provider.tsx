import { FC, PropsWithChildren } from "react";
import {
  ExternalLocaleProvider,
  preloadDefaultResource,
  type AsyncResources,
} from "@orderly.network/i18n";
import { LocaleMessages } from "./module";
import { translations } from "./translations";

// Seed English before first render so keys never flash.
preloadDefaultResource(LocaleMessages);

// Bundled, not lazy-loaded: 11 short strings per language. Anything missing
// (English, or a code Orderly adds later) falls back to English.
const resources: AsyncResources = (lang) =>
  Promise.resolve({
    ...LocaleMessages,
    ...translations[lang as keyof typeof translations],
  });

export const LocaleProvider: FC<PropsWithChildren> = (props) => (
  <ExternalLocaleProvider resources={resources}>
    {props.children}
  </ExternalLocaleProvider>
);

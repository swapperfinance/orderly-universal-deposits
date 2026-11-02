import { FC, PropsWithChildren } from "react";
import {
  ExternalLocaleProvider,
  preloadDefaultResource,
  type AsyncResources,
} from "@orderly.network/i18n";
import { LocaleMessages } from "./module";

// Seed English before first render so keys never flash.
preloadDefaultResource(LocaleMessages);

// English only for now; every locale falls back to it. Add per-locale JSON
// loaders here (see @orderly.network/onramper-plugin) when translations land.
const resources: AsyncResources = () => Promise.resolve(LocaleMessages);

export const LocaleProvider: FC<PropsWithChildren> = (props) => (
  <ExternalLocaleProvider resources={resources}>
    {props.children}
  </ExternalLocaleProvider>
);

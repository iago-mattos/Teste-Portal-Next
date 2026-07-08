import { test as base } from "@playwright/test";
import {
  loadPortalRuntimeConfig,
  type PortalRuntimeConfig,
} from "../config/runtime-config";

export interface PortalConfigFixtures {
  portalConfig: PortalRuntimeConfig;
}

export const configTest = base.extend<object, PortalConfigFixtures>({
  portalConfig: [
    // Playwright exige destructuring mesmo quando a fixture nao possui dependencia.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(loadPortalRuntimeConfig());
    },
    { scope: "worker" },
  ],
});

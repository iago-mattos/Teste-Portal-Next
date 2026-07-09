import { test as setup } from "@playwright/test";
import {
  assertAejsRuntimeConfig,
  loadAejsRuntimeConfig,
} from "../config/aejs-config";

setup("validate AEJS integration configuration", () => {
  assertAejsRuntimeConfig(loadAejsRuntimeConfig());
});

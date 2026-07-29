import { loadEnvironmentProfile } from "./environment-profile.mjs";

process.env.PW_PROFILE = "ht";
loadEnvironmentProfile();
process.env.PORTAL_PROVISION_PROVIDER = "c6";
process.env.PORTAL_MASS_TARGET_COUNT =
  process.env.C6_PROVISION_TARGET_COUNT ?? "15";

await import("./manage-provisioning-registry.mjs");

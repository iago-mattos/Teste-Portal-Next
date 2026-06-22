import { portalConnect as developmentConnect } from "./connect";
import { portalConnect as htConnect } from "./connect.ht";

const browserHost =
  typeof window !== "undefined" ? window.location.hostname : "";
const runtimeEnvironment = browserHost.includes("hml")
  ? "ht"
  : process.env.PORTAL_ENV;

export const portalEnvironment =
  String(runtimeEnvironment ?? "").trim().toLowerCase() === "ht"
    ? "ht"
    : "dev";

export const portalConnect =
  portalEnvironment === "ht" ? htConnect : developmentConnect;

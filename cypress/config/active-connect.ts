import type {
  PortalConnect,
  PortalEnvironment,
} from "./runtime-config";

let configuredPortalConnect: PortalConnect | undefined;

export let portalEnvironment: PortalEnvironment = "dev";

export function setPortalRuntimeConfig(
  connect: PortalConnect,
  environment: PortalEnvironment,
): void {
  configuredPortalConnect = connect;
  portalEnvironment = environment;
}

export const portalConnect = new Proxy({} as PortalConnect, {
  get(_target, property: keyof PortalConnect) {
    const publicConnect = Cypress.expose("portalConnect") as
      | PortalConnect
      | undefined;
    const connect = configuredPortalConnect ?? publicConnect;
    if (!connect) {
      throw new Error("Configuracao do Portal ainda nao foi inicializada.");
    }
    return connect[property];
  },
});

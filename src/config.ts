// The shell's configuration, from services.json on the shell's origin.

export interface ServiceConfig {
  // The URL of the service's module, an ES module whose default export is a ServiceModule.
  module: string;
  // The URL of the service's UI backend, which invokes features at {bff}/{feature}.
  bff: string;
}

// Someone a developer can sign in as, without signing in, where there's no real sign-in.
export interface DevUser {
  username: string;
  groups?: string[];
}

export interface ShellConfig {
  // Where "/" goes, such as "/sample/things".
  default: string;
  services: Record<string, ServiceConfig>;
  // Present only where there's no real sign-in, as on the local host: the users the pill offers to
  // switch to, each signed in with an unsigned token.
  devUsers?: DevUser[];
}

// The shell's own pages live under this prefix, so no service id may start with it.
export const shellPrefix = "_shell";

export function readConfig(json: unknown): ShellConfig {
  const config = json as ShellConfig;
  if (typeof config?.default !== "string" || typeof config.services !== "object" || config.services === null)
    throw new Error("services.json needs a default address and a services object");

  for (const [id, service] of Object.entries(config.services)) {
    if (id.startsWith("_"))
      throw new Error(`a service id can't start with _, which the shell's own pages use: ${id}`);
    if (id.includes("/"))
      throw new Error(`a service id can't contain /: ${id}`);
    if (typeof service?.module !== "string" || typeof service.bff !== "string")
      throw new Error(`the service ${id} needs a module and a bff URL`);
  }
  return config;
}

export async function loadConfig(url = "/services.json"): Promise<ShellConfig> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`couldn't load ${url}: ${response.status}`);
  return readConfig(await response.json());
}

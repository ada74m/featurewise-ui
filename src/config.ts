import type { Link } from "./contract.js";

// The shell's configuration, from services.json on the shell's origin.

export interface ServiceConfig {
  // The URL of the service's module, an ES module whose default export is a ServiceModule.
  module: string;
  // The URL of the service's UI backend, which invokes features at {bff}/{feature}.
  bff: string;
}

// Someone a visitor can be. Where there's no real sign-in, as on the local host, the shell makes an
// unsigned token for them; where the sign-in has personas, as the demos' does, the shell names one in
// login_hint and the sign-in signs them in at once. A persona belongs to a demo, the first part of an
// address within its service, such as lost-property in /demos/lost-property/unclaimed-items.
export interface Persona {
  // The username tokens carry, such as traveller.
  id: string;
  label?: string;
  demo?: string;
  groups?: string[];
}

// A demo, as a service such as the demos has several: what it is, the story its data tells so far, what
// to try, who a visitor can be in it, and the link that starts it again from its seed. Its id is the
// first part of its addresses, as with a persona's demo.
export interface DemoConfig {
  id: string;
  title?: string;
  chapter?: string;
  about?: string[];
  storySoFar?: string[];
  tryThis?: string[];
  personas?: Persona[];
  reset?: Link;
}

// What services.json said before personas, which the local hosts of services such as the sample still say.
export interface DevUser {
  username: string;
  groups?: string[];
}

// Where people sign in, as an OpenID Connect provider's endpoints, such as a Cognito user pool's managed
// login. The shell signs in with the authorization code flow and PKCE, so its client has no secret.
export interface SignInConfig {
  authorizeUrl: string;
  tokenUrl: string;
  // Where to go to sign out at the provider, with whatever parameters it needs, such as Cognito's
  // client_id and logout_uri.
  logoutUrl: string;
  clientId: string;
  scopes?: string[];
}

export interface ShellConfig {
  // Where "/" goes, such as "/sample/things".
  default: string;
  services: Record<string, ServiceConfig>;
  // Who a visitor can be: with no real sign-in, each is signed in with an unsigned token; with a sign-in
  // that has personas, by naming them in login_hint.
  personas?: Persona[];
  // The same as personas, in the older form.
  devUsers?: DevUser[];
  // The demos, each with its personas, which are offered as if listed in personas.
  demos?: DemoConfig[];
  // Present where people sign in for real, as on AWS.
  signIn?: SignInConfig;
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
  if (config.personas !== undefined
    && (!Array.isArray(config.personas) || config.personas.some(persona => typeof persona?.id !== "string")))
    throw new Error("each persona needs an id");
  config.personas ??= config.devUsers?.map(user => ({ id: user.username, groups: user.groups }));
  if (config.demos !== undefined
    && (!Array.isArray(config.demos) || config.demos.some(demo => typeof demo?.id !== "string")))
    throw new Error("each demo needs an id");
  const demoPersonas = (config.demos ?? []).flatMap(demo => (demo.personas ?? []).map(persona => ({ ...persona, demo: demo.id })));
  if (demoPersonas.length)
    config.personas = [...(config.personas ?? []), ...demoPersonas];

  const signIn = config.signIn;
  if (signIn && [signIn.authorizeUrl, signIn.tokenUrl, signIn.logoutUrl, signIn.clientId].some(v => typeof v !== "string"))
    throw new Error("signIn needs an authorizeUrl, tokenUrl, logoutUrl and clientId");
  return config;
}

// What to call a persona.
export const labelOf = (persona: Persona): string => persona.label ?? persona.id;

export async function loadConfig(url = "/services.json"): Promise<ShellConfig> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`couldn't load ${url}: ${response.status}`);
  return readConfig(await response.json());
}

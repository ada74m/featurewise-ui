import { shellPrefix } from "./config.js";

// Where a URL's path leads: a service and the address within it, a page of the shell's own, or the
// default.
export type Place =
  | { kind: "service"; service: string; address: string }
  | { kind: "shell"; page: string }
  | { kind: "default" };

// "/sample/things?x=1" is the service sample at the address "things?x=1".
export function placeOf(path: string, search = ""): Place {
  const trimmed = path.replace(/^\/+/, "");
  if (trimmed === "")
    return { kind: "default" };

  const slash = trimmed.indexOf("/");
  const first = slash < 0 ? trimmed : trimmed.slice(0, slash);
  const rest = slash < 0 ? "" : trimmed.slice(slash + 1);
  if (first === shellPrefix)
    return { kind: "shell", page: rest };

  return { kind: "service", service: decodeURIComponent(first), address: rest + search };
}

export const pathOf = (service: string, address: string): string =>
  `/${encodeURIComponent(service)}/${address}`;

export const shellPath = (page: string): string => `/${shellPrefix}/${page}`;

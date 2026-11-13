import { shellPrefix } from "./config.js";
import { featureOf, type Link } from "./contract.js";

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

// The shell's own address for a query whose module gives it none: "_/" and the feature's name, with the
// rest of the link as JSON, as in "_/ItemsFoundAt?link={"Station":"Leeds"}". It's the backend's GET
// convention, so it means exactly the link. A module's addresses can't start with "_/". It leaves out
// CausedBy, which Featurewise stamps on a link to record the invocation that made it: loading an address
// starts afresh, caused by nothing earlier, and it's no argument of the feature's.
const defaultPrefix = "_/";

export function defaultAddressOf(link: Link): string {
  const [, name] = featureOf(link);
  const { $feature: _, CausedBy: __, ...rest } = link;
  const json = JSON.stringify(rest);
  return `${defaultPrefix}${encodeURIComponent(name)}${json === "{}" ? "" : `?link=${encodeURIComponent(json)}`}`;
}

// The link a default address stands for in a service, null if the address isn't a default one, or an
// error if it is one that doesn't make a link.
export function linkOfDefaultAddress(service: string, address: string): Link | null {
  if (!address.startsWith(defaultPrefix))
    return null;
  const [path = "", search = ""] = address.slice(defaultPrefix.length).split(/\?(.*)/s);
  const json = new URLSearchParams(search).get("link");
  const parsed: unknown = json === null ? {} : JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("the address's link isn't a JSON object");
  // The address names the feature, whatever the JSON says.
  const { $feature: _, ...rest } = parsed as Record<string, unknown>;
  return { $feature: `${service}/${decodeURIComponent(path)}`, ...rest };
}

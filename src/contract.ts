// The contract between the shell and a service's module. It's all a module needs to know about the
// shell, and it depends on no front-end framework, so a module can use any.

// A link: a feature's arguments, with the feature it names, qualified by its service, as in
// "sample/DeleteThing". Anything else in it is the feature's arguments.
export interface Link {
  $feature: string;
  [argument: string]: unknown;
}

// What came back from invoking a link.
export interface ShellResponse {
  // The link that was invoked, so that a handler can fill in what it asked for and follow it again.
  link: Link;
  // The feature that answered, qualified by its service.
  feature: string;
  // The family of the feature that answered, as the backend's Featurewise-Family header says: "query",
  // "command" or "worker", or null if it doesn't say.
  family: string | null;
  status: number;
  // The media type, without parameters, such as "application/json".
  contentType: string;
  body: unknown;
}

// What the shell lends a module's components. They never invoke anything themselves: they follow links,
// and the shell invokes them.
export interface Host {
  // Invokes the link and shows its result where the component is shown.
  follow(link: Link): void;
  toast(message: string): void;
  // Shows the result of following link inside element. Links followed in there stay in there, and
  // onResult hears each result, as a picker's opener hears what was picked.
  embed(element: HTMLElement, link: Link, onResult?: (response: ShellResponse) => void): () => void;
  // The path in the shell where loading a link to a query shows its result, as an anchor's href: the
  // address its service's module gives it, if that module is loaded, or else the shell's default one,
  // as in "/sample/things" or "/sample/_/SearchThings?link=…". It works for a link to any service the
  // shell knows, and is null for one it doesn't. A link to a command has no path that works: loading it
  // is refused.
  pathOf(link: Link): string | null;
}

// A module's default export.
export interface ServiceModule {
  // The link an address within the service stands for, such as "things" for the Things query, or null
  // if the address means nothing.
  addressToLink(address: string): Link | null;
  // The address of a link, or null to leave it to the shell. Only queries have addresses: a reload invokes
  // the link at the address again, and a command must never run twice that way. A query the module gives
  // no address gets the shell's default one, such as "_/Things".
  linkToAddress(link: Link): string | null;
  // Renders the response into element, returning a function that clears it, or null if the module has
  // no handler for it, when the shell renders it generically.
  render(element: HTMLElement, response: ShellResponse, host: Host): (() => void) | null;
}

export const isLink = (value: unknown): value is Link =>
  typeof value === "object" && value !== null && !Array.isArray(value)
  && typeof (value as { $feature?: unknown }).$feature === "string";

// The service a link's feature belongs to, and the feature's own name: "sample/DeleteThing" is
// ["sample", "DeleteThing"].
export function featureOf(link: Link): [service: string, name: string] {
  const slash = link.$feature.indexOf("/");
  if (slash <= 0 || slash === link.$feature.length - 1)
    throw new Error(`the link's feature isn't qualified by a service: ${link.$feature}`);
  return [link.$feature.slice(0, slash), link.$feature.slice(slash + 1)];
}

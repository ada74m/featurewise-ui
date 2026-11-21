import type { Host, Link, ServiceModule } from "../contract.js";
import { AddressTemplate } from "./addressTemplate.js";

// Builds a service's module for the shell from its features: each with a way to render its result, or
// each of its result cases, and each query with its address, if it has one. A feature, or a case, that
// isn't added is left to the shell's defaults: the generic renderer, and the default address for a
// query. Workers aren't added at all, since nobody sees their results.
//
//   const ui = featurewiseModule("lost-property", { home: "unclaimed-items" });
//   ui.addQuery("ItemsFoundAt").address("found-at/{Station}");
//   ui.addCommand("ClaimItem")
//     .renderCase("Claimed", claimItem.Claimed)
//     .renderCase("DoesntMatchReport", claimItem.DoesntMatchReport);
//
// The builder is the module, so a module's index exports it as it is.

// Shows a feature's result, or one case of it, in element, and returns a function that clears it. The
// body is the result as the service sent it. Its shape is the feature's, so a renderer's author reads it
// there, rather than copying it into types that nothing would check against the service.
export type Renderer = (element: HTMLElement, body: any, host: Host) => () => void;

export interface CommandBuilder {
  // Renders a result that has no cases.
  render(renderer: Renderer): this;
  // Renders one of the result's cases, by its name.
  renderCase(name: string, renderer: Renderer): this;
}

export interface QueryBuilder extends CommandBuilder {
  // Gives the query an address, from a template such as "found-at/{Station}". A link whose arguments the
  // template doesn't hold, exactly, gets the shell's default address instead.
  address(template: string): this;
}

export interface ModuleBuilder extends ServiceModule {
  addQuery(feature: string): QueryBuilder;
  addCommand(feature: string): CommandBuilder;
}

export interface ModuleOptions {
  // The address that the service's own path, with no address after it, stands for.
  home?: string;
}

export function featurewiseModule(service: string, options: ModuleOptions = {}): ModuleBuilder {
  const features = new Set<string>();
  const renderers = new Map<string, Renderer>();
  const addresses = new Map<string, AddressTemplate>();

  const qualified = (feature: string) => `${service}/${feature}`;

  function add(feature: string): string {
    const name = qualified(feature);
    if (features.has(name))
      throw new Error(`${name} is added twice`);
    features.add(name);
    return name;
  }

  function featureBuilder<T extends CommandBuilder>(name: string, extra: (builder: T) => object = () => ({})): T {
    const builder = {
      render(renderer: Renderer) {
        return builder.renderCase("", renderer);
      },
      renderCase(caseName: string, renderer: Renderer) {
        const key = `${name}:${caseName}`;
        if (renderers.has(key))
          throw new Error(caseName === "" ? `${name} is rendered twice` : `${name}'s case ${caseName} is rendered twice`);
        renderers.set(key, renderer);
        return builder;
      }
    } as T;
    return Object.assign(builder, extra(builder));
  }

  function addressToLink(address: string): Link | null {
    const path = address.split("?")[0] ?? "";
    if (path === "")
      return options.home === undefined ? null : addressToLink(options.home);
    for (const [feature, template] of addresses) {
      const args = template.read(path);
      if (args)
        return { $query: feature, ...args };
    }
    return null;
  }

  function linkToAddress(link: Link): string | null {
    return link.$query === undefined ? null : addresses.get(link.$query)?.write(link) ?? null;
  }

  return {
    addQuery(feature) {
      const name = add(feature);
      return featureBuilder<QueryBuilder>(name, builder => ({
        address(template: string) {
          if (addresses.has(name))
            throw new Error(`${name} has two addresses`);
          const parsed = new AddressTemplate(template);
          const clash = [...addresses].find(([, other]) => other.shape() === parsed.shape());
          if (clash)
            throw new Error(`${name}'s address "${template}" would read the same addresses as ${clash[0]}'s, "${clash[1].template}"`);
          addresses.set(name, parsed);
          return builder;
        }
      }));
    },

    addCommand(feature) {
      return featureBuilder<CommandBuilder>(add(feature));
    },

    addressToLink,
    linkToAddress,

    render(element, response, host) {
      const body = response.body as { $case?: unknown } | null;
      const caseName = typeof body?.$case === "string" ? body.$case : "";
      const renderer = renderers.get(`${response.feature}:${caseName}`);
      return renderer ? renderer(element, body, host) : null;
    }
  };
}

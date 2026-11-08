// Whether the shell uses a service's module's rendering, chosen per service on the services page and
// remembered in the browser. Turned off, the shell renders every result generically. It's on unless
// turned off.

export interface Customisation {
  render: boolean;
}

export interface Customisations {
  of(service: string): Customisation;
  set(service: string, customisation: Customisation): void;
}

const keyOf = (service: string) => `fw-customisation:${service}`;

export function storedCustomisations(storage: Storage = localStorage): Customisations {
  return {
    of: service => {
      let saved: Partial<Customisation> = {};
      try {
        saved = JSON.parse(storage.getItem(keyOf(service)) ?? "{}") ?? {};
      } catch {
        storage.removeItem(keyOf(service));
      }
      return { render: saved.render !== false };
    },
    set: (service, customisation) => {
      if (customisation.render)
        storage.removeItem(keyOf(service));
      else
        storage.setItem(keyOf(service), JSON.stringify(customisation));
    }
  };
}

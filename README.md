# featurewise-ui

The UI shell for Featurewise services. It loads each service's module, invokes every link through the service's UI backend, and shows the result with the module's handler, or with a generic renderer when the module has none. Modules never invoke anything: they map addresses to links, and render what comes back.

The shell is plain TypeScript with no framework and no runtime dependencies, so the contract it offers modules stays independent of any framework. Its own UI, the pill, is a web component with its styles in a shadow root.

## How it works

- **Addresses.** `/sample/things` is the service `sample` at the address `things`. The module says which link an address stands for (`addressToLink`), and which address a link has (`linkToAddress`). Only queries have addresses, so a reload never runs a command again. `/` goes to the default address in `services.json`, and the shell's own pages are under `/_shell/`.
- **Invoking.** Following a link posts it to `{bff}/{feature}`, with the signed-in user's token and an idempotency key. Loading an address, as on the first visit, a reload or Back, gets `{bff}/{feature}?link=<the link's JSON>`, which the backend allows only for queries. The service comes from the link's `$feature`, as in `sample/DeleteThing`.
- **Results.** A result is `application/json`. The shell asks the module to render it, and if the module has no handler, renders it generically: every value as nested lists, and every link as a button named after its property, such as `LinkToDelete`. A button opens the link's JSON to edit and follow. A field still to be supplied shows as null, and you type over it.
- **Errors** are `application/problem+json`, which the shell handles itself, leaving the page as it was: 401 asks you to sign in, 403 says you may not, a 5xx or no answer says something went wrong, and anything else shows the problem's detail.
- **The pill,** top right until you drag it, shows who's signed in, with a menu to switch user or log out, and a cog that opens `/_shell/services`, listing each service's backend.

## The module contract

A module is an ES module whose default export is a `ServiceModule` (`src/contract.ts`):

```ts
addressToLink(address: string): Link | null
linkToAddress(link: Link): string | null       // null for commands
render(element: HTMLElement, response: ShellResponse, host: Host): (() => void) | null
```

`render` renders into the element with whatever framework the module uses, and returns a function that clears it, or returns null to leave the response to the generic renderer. The response carries the `link` that was invoked, the `feature` that answered, the `status`, the `contentType` and the parsed `body`. `host` lends the module `follow(link)`, `toast(message)` and `embed(element, link, onResult)`, which shows another link's result inside the module's own component, keeping links followed there inside it.

## Configuration

The shell reads `services.json` from its own origin:

```json
{
  "default": "/sample/things",
  "services": { "sample": { "module": "/modules/sample/index.js", "bff": "/api/sample" } },
  "devUsers": [{ "username": "ann", "groups": ["editor"] }, { "username": "bob" }]
}
```

`devUsers` is only for where there's no real sign-in, such as a service's local host: the pill offers those users, and the shell signs in as one with an unsigned token carrying the claims Cognito's would, which only a local host accepts. Real sign-in comes with hosting the shell on AWS.

## Building

```
npm install
npm run build      # compiles to dist/, with index.html and shell.css
npm test           # type-checks the tests and runs them
```

`dist/` is what a host serves: `index.html` at every path that isn't a backend's or a module's, with `main.js` and `shell.css` beside it. A service's local host serves it from a sibling checkout, as the sample's does.

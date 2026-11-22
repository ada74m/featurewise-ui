# featurewise-ui

The Featurewise UI shell: [featurewise.dev/shell](https://featurewise.dev/shell/), and the ideas behind it at [featurewise.dev](https://featurewise.dev/).

The UI shell for Featurewise services. It loads each service's module, invokes every link through the service's UI backend, and shows the result with the module's handler, or with a generic renderer when the module has none. Modules never invoke anything: they map addresses to links, and render what comes back.

The shell is plain TypeScript with no framework and no runtime dependencies, so the contract it offers modules stays independent of any framework. Its own UI, the pill, is a web component with its styles in a shadow root.

## How it works

- **Addresses.** `/sample/things` is the service `sample` at the address `things`. The module says which link an address stands for (`addressToLink`), and which address a link has (`linkToAddress`). A query the module gives no address gets the shell's default one, `_/` and the feature's name with the rest of the link as JSON, as in `/demos/_/ItemsFoundAt?link={"Station":"Leeds"}`, leaving out `CausedBy`, the invocation that made the link: loading an address starts afresh. Following a link on the page keeps it. The shell knows a query from its link, which names its feature in `$query`. Only queries have addresses, so a reload never runs a command again. `/` goes to the default address in `services.json`, and the shell's own pages are under `/_shell/`.
- **Invoking.** A link names its feature in a property that says the feature's family: `$query`, `$command` or `$worker`, as in `{"$command":"sample/DeleteThing","Id":"t1"}`. A link to a query, whether followed on the page or loaded from an address on the first visit, a reload or Back, is invoked with `GET {bff}/{feature}?link=<the link's JSON>`. Anything else is posted to `{bff}/{feature}`, with an idempotency key. Either way the signed-in user's token goes with it. The backend allows a `GET` only for a query, so no address or reload can run a command. The service comes from the feature's name, as in `sample/DeleteThing`.
- **Results.** A result is `application/json`. The shell asks the module to render it, and if the module has no handler, renders it generically: every value as nested lists, and every link as a button named after its property, such as `LinkToDelete`. A button opens the link's JSON to edit and follow. A field still to be supplied shows as null, and you type over it.
- **Errors** are `application/problem+json`, which the shell handles itself, leaving the page as it was: 401 asks you to sign in, 403 says you may not, a 5xx or no answer says something went wrong, and anything else shows the problem's detail.
- **The pill,** top right until you drag it, shows who's signed in, with a menu to switch user or log out (on a demo's pages, only that demo's personas; elsewhere, every persona under its demo's title), and a cog that opens `/_shell/services`, listing each service's backend. There, each module's rendering can be turned off, to see the service as the generic shell shows it. The browser remembers the choice.

## The module contract

A module is an ES module whose default export is a `ServiceModule` (`src/contract.ts`):

```ts
addressToLink(address: string): Link | null
linkToAddress(link: Link): string | null       // null for commands, or to leave a query to the shell's default address
render(element: HTMLElement, response: ShellResponse, host: Host): (() => void) | null
```

`render` renders into the element with whatever framework the module uses, and returns a function that clears it, or returns null to leave the response to the generic renderer. The response carries the `link` that was invoked, the `feature` that answered, its `family` (from the link), the `status`, the `contentType` and the parsed `body`. `host` lends the module `follow(link)`, `toast(message)`, `embed(element, link, onResult)`, which shows another link's result inside the module's own component, keeping links followed there inside it, and `pathOf(link)`, the path where a link to a query loads, for an anchor's href: its own module's address if that module is loaded, or else the shell's default one. It works for a link to any service the shell knows, so a module can link to another service's pages.

### The module builder

A module can be written as those three functions, or built from the service's features with `featurewiseModule`, which this repository publishes, with the contract's types, as the npm package `@featurewise/ui`:

```ts
import { featurewiseModule } from "@featurewise/ui";

const ui = featurewiseModule("lost-property", { home: "unclaimed-items" });
ui.addQuery("UnclaimedItems").address("unclaimed-items").render(unclaimedItems.result);
ui.addQuery("ItemsFoundAt").address("found-at/{Station}");
ui.addCommand("ClaimItem")
  .renderCase("Claimed", claimItem.Claimed)
  .renderCase("DoesntMatchReport", claimItem.DoesntMatchReport);
export default ui;
```

Each query may have an address, from a template whose placeholders name its arguments (`{Station}`, `{Seat:int}`, `{On:date}`). The template reads an address into a link and writes the link back, and is used only for a link whose arguments, apart from `CausedBy`, it holds exactly. Each feature may render its result, or each of its result cases. Whatever isn't added is left to the shell: the generic renderer, and the default address. A renderer gets the result's body untyped, since its shape is the feature's. A module bundles what it imports from the package, so the shell doesn't serve it.

The package is on npm, published by CI on each push to main as `0.1.0-preview.<yyyymmdd>.<run>`: `npm install @featurewise/ui`.

### Styles

A module renders into the shell's page, so the shell's stylesheet (`static/shell.css`) reaches it without being passed. Services share a look that way, without sharing a component library, which would tie them to one framework. The shell offers three things:

- **Plain elements come styled:** headings, links, buttons, fields and tables. A module writes ordinary HTML, and adds `fw-primary` to a page's main button. Every one of these rules is wrapped in `:where()`, so any rule of the module's outranks it.
- **Custom properties:** colours (`--fw-text`, `--fw-muted`, `--fw-surface`, `--fw-background`, `--fw-border`, `--fw-hover`, `--fw-accent`, `--fw-on-accent`, `--fw-error`, and the logo's `--fw-brand` and `--fw-brand-green`), the fonts (`--fw-font`, and `--fw-font-heading` and `--fw-font-body`: Arvo and Lato), spacing (`--fw-space-1` to `--fw-space-5`), radii (`--fw-radius`, `--fw-radius-small`), type sizes (`--fw-size-small`, `--fw-size-h1`, `--fw-size-h2`), `--fw-shadow` and `--fw-focus`. A module's own stylesheet uses them rather than numbers of its own, and may set them within its root element: `.lp { --fw-accent: #c8102e; }` changes the office's buttons and links, and nothing outside it.
- **Three layout classes,** with no breakpoints, so a module fits whatever space it's given, a page or a panel embedded in another: `fw-stack` puts its children one above another, `fw-row` side by side, wrapping when they run out of room, and `fw-grid` in as many equal columns as fit, each at least `--fw-column` wide. Each spaces its children by `--fw-gap`.

Most of the properties, and the fonts, come from `static/brand.css`, the Featurewise brand, which featurewise.dev shares; it's kept separately and copied here. `shell.css` adds the shell's own. Every other `fw-` class is the shell's own, and may change. A module scopes its own rules under its root element's class, as the lost property office's are under `.lp`.

## Configuration

The shell reads `services.json` from its own origin:

```json
{
  "default": "/sample/things",
  "services": { "sample": { "module": "/modules/sample/index.js", "bff": "/api/sample" } },
  "personas": [{ "id": "ann", "label": "Ann", "groups": ["editor"] }, { "id": "bob" }]
}
```

`personas` are who a visitor can be. Where there's no real sign-in, such as a service's local host, the pill offers them, and the shell signs in as one with an unsigned token carrying the claims Cognito's would, which only a local host accepts. The older `devUsers` (`username` and `groups`) is read as personas too.

Where people sign in for real, `services.json` has `signIn` instead: an OpenID Connect provider's `authorizeUrl`, `tokenUrl` and `logoutUrl`, and the shell's `clientId`, which has no secret. Sign in sends the user to the provider's own sign-in page, such as a Cognito user pool's managed login, by the authorization code flow with PKCE. The provider sends them back to `/_shell/callback`, where the shell trades the code for tokens, keeps them for the tab's session, and returns to the page they were on. The shell sends the access token to every backend. Log out clears the tokens and goes to the `logoutUrl`, which includes whatever the provider needs, such as Cognito's `client_id` and `logout_uri`.

A sign-in can have personas too, as the demos' does. Then the pill offers them, and becoming one is signing in with its id as the standard `login_hint`, which such a sign-in signs in without asking.

A persona with a `demo` belongs to that demo, and no persona id may appear twice, since `?as=` and the sign-in name a persona by its id. Each demo is a service of its own, with the same id, so the demo panel shows a demo on every page of its service, such as `/lost-property/unclaimed-items`, whatever the address and whoever is signed in. `services.json` can also list `demos`, as each demo's `demo.json` describes it: each with its `id`, `title`, `chapter`, paragraphs of `about`, `storySoFar` and `tryThis`, its `personas`, and a `reset` link. Where `services.json` lists demos, the shell is their site. A bar across the top says the site's `title`, such as "Featurewise demos", which leads home, and links to each demo; `/` is the home page, listing each demo with its chapter and the first paragraph of its `about`, instead of going to `default`. Beside a demo's pages, on the left, the demo panel shows its title and chapter, then its controls: an **As** switch between the demo's personas, with the visitor's own filled in, a **View** switch between plain (the generic renderer) and dressed (the module's rendering), and **Reset this demo**, which invokes the reset link and loads the page again. Then comes its text, with the personas named in it as buttons that become them, and the story and what to try folding away. Below 52rem the panel goes under the page, so the demo itself comes first. Any address can also carry `?as=<persona>`, as a link from the book does: the shell becomes that persona and drops the parameter. And `?view=plain` or `?view=dressed` turns the service's module's rendering off or on, as the services page does, so a link can show a service as the generic shell shows it, or as its module dresses it. The choice is remembered, so a link that cares says which it wants.

## Hosting on AWS

`Infrastructure/` is the shell's Terraform module, with no provider or state of its own. An environment uses it from the shell's package, beside its services, and gives it each service's UI backend URL, the default address and its identity provider's settings. It makes:

- a private S3 bucket for the shell's files, `services.json`, which it writes from those inputs, and each service's module, which the service uploads under `modules/<id>/`;
- one CloudFront distribution that serves them, and routes `/api/<id>/*` to each service's UI backend with the prefix taken off and nothing cached, so the browser only ever talks to one origin. A CloudFront function sends any address that isn't a file to `index.html`.

An environment may also give it a `domain`: a host name, such as `demos.featurewise.dev`, and an ACM certificate for it in us-east-1. The distribution then answers to that name, and the outputs use it. The environment owns the DNS, so it validates the certificate and makes the alias records itself.

Its outputs are the shell's `url`, the `callback_url` the identity provider's client must allow, and the `bucket` services upload their modules to; `url` and `callback_url` use the shell's domain if it has one. And the distribution's `distribution_domain_name` and `hosted_zone_id`, which an alias record names.

`package.sh <version> <out-dir>` builds the package, `ui-<version>.zip`: the module and the built shell beside it. CI builds, tests, checks the Terraform and packages on every pull request and push, and each push to main publishes the npm package for modules (above), and the package to the estate's artifacts bucket as `ui/<version>.zip`, tagging the commit `ui/<version>`, once the repository has the variable `AWS_REGION` and the secrets `ARTIFACTS_BUCKET` and `PUBLISH_ROLE_ARN` from the estate's bootstrap. They're secrets so that the logs don't show the account they name.

## Building

```
npm install
npm run build      # compiles to dist/, with index.html and shell.css
npm test           # type-checks the tests and runs them
```

`dist/` is what a host serves: `index.html` at every path that isn't a backend's or a module's, with `main.js` and `shell.css` beside it. A service's local host serves it from a sibling checkout, as the sample's does.

## Licence

MIT (`LICENSE`), apart from the Featurewise name and logo, and the fonts, which have their own terms (`NOTICE.md`).

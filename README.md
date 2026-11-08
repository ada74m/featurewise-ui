# featurewise-ui

The UI shell for Featurewise services. It loads each service's module, invokes every link through the service's UI backend, and shows the result with the module's handler, or with a generic renderer when the module has none. Modules never invoke anything: they map addresses to links, and render what comes back.

The shell is plain TypeScript with no framework and no runtime dependencies, so the contract it offers modules stays independent of any framework. Its own UI, the pill, is a web component with its styles in a shadow root.

## How it works

- **Addresses.** `/sample/things` is the service `sample` at the address `things`. The module says which link an address stands for (`addressToLink`), and which address a link has (`linkToAddress`). A query the module gives no address gets the shell's default one, `_/` and the feature's name with the rest of the link as JSON, as in `/demos/_/ItemsFoundAt?link={"Station":"Leeds"}`. The shell knows a query from the backend's `Featurewise-Family` header. Only queries have addresses, so a reload never runs a command again. `/` goes to the default address in `services.json`, and the shell's own pages are under `/_shell/`.
- **Invoking.** Following a link posts it to `{bff}/{feature}`, with the signed-in user's token and an idempotency key. Loading an address, as on the first visit, a reload or Back, gets `{bff}/{feature}?link=<the link's JSON>`, which the backend allows only for queries. The service comes from the link's `$feature`, as in `sample/DeleteThing`.
- **Results.** A result is `application/json`. The shell asks the module to render it, and if the module has no handler, renders it generically: every value as nested lists, and every link as a button named after its property, such as `LinkToDelete`. A button opens the link's JSON to edit and follow. A field still to be supplied shows as null, and you type over it.
- **Errors** are `application/problem+json`, which the shell handles itself, leaving the page as it was: 401 asks you to sign in, 403 says you may not, a 5xx or no answer says something went wrong, and anything else shows the problem's detail.
- **The pill,** top right until you drag it, shows who's signed in, with a menu to switch user or log out, and a cog that opens `/_shell/services`, listing each service's backend. There, each module's rendering can be turned off, to see the service as the generic shell shows it. The browser remembers the choice.

## The module contract

A module is an ES module whose default export is a `ServiceModule` (`src/contract.ts`):

```ts
addressToLink(address: string): Link | null
linkToAddress(link: Link): string | null       // null for commands, or to leave a query to the shell's default address
render(element: HTMLElement, response: ShellResponse, host: Host): (() => void) | null
```

`render` renders into the element with whatever framework the module uses, and returns a function that clears it, or returns null to leave the response to the generic renderer. The response carries the `link` that was invoked, the `feature` that answered, its `family`, the `status`, the `contentType` and the parsed `body`. `host` lends the module `follow(link)`, `toast(message)` and `embed(element, link, onResult)`, which shows another link's result inside the module's own component, keeping links followed there inside it.

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

A persona with a `demo` belongs to that demo, the first part of an address within its service, such as `lost-property` in `/demos/lost-property/unclaimed-items`. `services.json` can also list `demos`, as the demos service's `demos.json` does: each with its `id`, `title`, `chapter`, paragraphs of `about`, `storySoFar` and `tryThis`, its `personas`, and a `reset` link. Above a demo's pages, the demo panel shows its title and text, with the personas named in `tryThis` as buttons that become them, folds away the story and what to try, says who the visitor is with the demo's other personas, and offers **Reset this demo**, which invokes the reset link and loads the page again. Any address can also carry `?as=<persona>`, as a link from the book does: the shell becomes that persona and drops the parameter.

## Hosting on AWS

`Infrastructure/` is the shell's Terraform module, with no provider or state of its own. An environment uses it from the shell's package, beside its services, and gives it each service's UI backend URL, the default address and its identity provider's settings. It makes:

- a private S3 bucket for the shell's files, `services.json`, which it writes from those inputs, and each service's module, which the service uploads under `modules/<id>/`;
- one CloudFront distribution that serves them, and routes `/api/<id>/*` to each service's UI backend with the prefix taken off and nothing cached, so the browser only ever talks to one origin. A CloudFront function sends any address that isn't a file to `index.html`.

An environment may also give it a `domain`: a host name, such as `demos.featurewise.dev`, and an ACM certificate for it in us-east-1. The distribution then answers to that name, and the outputs use it. The environment owns the DNS, so it validates the certificate and makes the alias records itself.

Its outputs are the shell's `url`, the `callback_url` the identity provider's client must allow, and the `bucket` services upload their modules to; `url` and `callback_url` use the shell's domain if it has one. And the distribution's `distribution_domain_name` and `hosted_zone_id`, which an alias record names.

`package.sh <version> <out-dir>` builds the package, `ui-<version>.zip`: the module and the built shell beside it. CI builds, tests, checks the Terraform and packages on every pull request and push, and each push to main publishes the package to the estate's artifacts bucket as `ui/<version>.zip`, tagging the commit `ui/<version>`, once the repository has the variables `AWS_REGION`, `ARTIFACTS_BUCKET` and `PUBLISH_ROLE_ARN` from `featurewise-environments`' bootstrap.

## Building

```
npm install
npm run build      # compiles to dist/, with index.html and shell.css
npm test           # type-checks the tests and runs them
```

`dist/` is what a host serves: `index.html` at every path that isn't a backend's or a module's, with `main.js` and `shell.css` beside it. A service's local host serves it from a sibling checkout, as the sample's does.

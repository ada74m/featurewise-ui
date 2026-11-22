# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm install
npm run build      # tsc to dist/, then copies static/ (index.html, shell.css)
npm test           # tsc -p test (type-checks the tests), then vitest run
./package.sh <version> out   # the package: Infrastructure/ and the built dist/
```

A change is done when the build is clean and `npm test` passes. For a behaviour change, temporarily remove the new code to confirm its test fails.

## What this is

The Featurewise UI shell. `README.md` explains how it behaves, and, where the book's repository is checked out beside this one, `../book/code-plan.md` ("Front-end design" and "Building the shell") holds the design and the decisions behind it; keep to them.

- Plain TypeScript, compiled by `tsc` to native ES modules in `dist/`, with no bundler, no framework and no runtime dependencies. Imports name `.js` files. If the shell's own UI gets painful, the plan's way out is Lit, not a rewrite.
- `src/contract.ts` is the contract with modules, and must stay free of any framework. `src/module/` is the module builder (`featurewiseModule`, and the address templates it reads and writes addresses with), which modules build with. With the contract's types, it's the npm package `@ada74m/featurewise-ui` (`package.json`'s `exports` and `files`), which CI publishes to the owner's GitHub Packages registry as `0.1.0-preview.<run>` on each push to main. The shell itself doesn't use it. Modules never invoke: the shell does all invoking, in `src/bff.ts`, the only place that knows the backend's URLs and headers.
- `src/shell.ts` is the core: addresses to links and back, GET to load an address and POST to follow a link, problems handled by the shell, results rendered by the module or `src/generic.ts`.
- The shell's own UI is web components with shadow DOM (`src/pill.ts`), so modules' styles and the shell's can't leak into each other. `static/brand.css` and `static/fonts/` are copies of the Featurewise brand, shared with featurewise.dev and kept in a separate, private repository (`../design`, where present): change them there and copy them here. Modules share the page's light DOM, and `static/shell.css` is their styling contract (README, "Styles"): plain elements in `:where()`, the `--fw-*` custom properties, `fw-primary`, and the layout classes `fw-stack`, `fw-row` and `fw-grid`. Keep those stable; other `fw-` classes are the shell's own. Its pages are under `/_shell/`, and `services.json` may not name a service starting with `_`.
- Signing in is `src/auth.ts` (the dev sign-in: unsigned tokens for `services.json`'s `personas`, or the older `devUsers`, which only a local host accepts) and `src/oidc.ts` (real sign-in: any OpenID Connect provider, by the authorization code flow with PKCE, finished at `/_shell/callback`; becoming a persona there is signing in with `login_hint`). `src/demoPanel.ts` shows a demo's title, personas, reset, view switch and text in a sidebar beside its pages, from `services.json`'s `demos`, and `src/demoSite.ts` the bar across the top (`services.json`'s `title`, and a link to each demo) and the home page at `/`, both only where there are demos; and `Shell.load` handles `?as=<persona>`. The shell never mentions Cognito: the environment owns the identity provider and passes its endpoints in.
- AWS resources are named `<environment>-ui-<what it is>`, as services' are `<environment>-<service>-…`, so the shell and the services sharing an environment never take each other's names.
- `Infrastructure/` is the Terraform module an environment uses from the package `package.sh` builds: a bucket and one CloudFront distribution for the shell, `services.json` and every service's UI backend under `/api/<id>/`. Check it with `terraform fmt -check -recursive .` and `terraform init -backend=false && terraform validate` in `Infrastructure`. Never `plan` or `apply` against AWS unasked.

## Tests

Vitest with happy-dom, in `test/`, one file per source file, named for what they describe. `test/fakes.ts` has a fake module, a recording `fetch` and fake sign-ins.

## Conventions

- One concern per file in `src/`.
- Prose (README, comments) is in classic style: direct, no metadiscourse, no hedging. British spelling.

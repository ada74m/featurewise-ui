// What a service's module needs from the shell, published as @featurewise/ui: the contract's
// types, and the builder that makes a module from the service's features. A module bundles what it
// imports from here, so the shell needn't serve it.
export { featurewiseModule } from "./builder.js";
export type { CommandBuilder, ModuleBuilder, ModuleOptions, QueryBuilder, Renderer } from "./builder.js";
export type { Family, Host, Link, ServiceModule, ShellResponse } from "../contract.js";

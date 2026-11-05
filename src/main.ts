import { devAuth } from "./auth.js";
import { oidcAuth } from "./oidc.js";
import { loadConfig } from "./config.js";
import { definePill, type Pill } from "./pill.js";
import { renderDemoPanel } from "./demoPanel.js";
import { Shell } from "./shell.js";
import { toaster } from "./toast.js";

export type { Host, Link, ServiceModule, ShellResponse } from "./contract.js";

// Starts the shell in index.html: reads services.json, shows the pill, and loads the page the URL names.
async function main(): Promise<void> {
  const main = document.getElementById("featurewise");
  if (!main)
    throw new Error("the page needs an element with the id featurewise");

  const toasts = toaster(document);
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    toasts.show(String((error as Error).message));
    return;
  }

  const personas = config.personas ?? [];
  const auth = config.signIn ? oidcAuth(config.signIn, personas) : devAuth(personas);
  definePill();
  const pill = document.createElement("featurewise-pill") as Pill;
  document.body.append(pill);

  // Above a demo's pages: what it is, its story so far, and who the visitor can be.
  const panel = document.createElement("section");
  panel.className = "fw-demo";
  panel.hidden = true;
  main.before(panel);

  const shell = new Shell({
    config, auth, main, toaster: toasts,
    needsSignIn: () => pill.openMenu(),
    onPlace: place => renderDemoPanel(panel, config.demos ?? [], auth, place, link => void shell.runAndReload(link, "Started again from the beginning."))
  });
  pill.attach(auth, () => void shell.openServices());
  // What a user may do decides which links they're offered, so a new user sees the page afresh.
  auth.onChange(() => void shell.load());
  await shell.start();
}

void main();

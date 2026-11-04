import { devAuth } from "./auth.js";
import { loadConfig } from "./config.js";
import { definePill, type Pill } from "./pill.js";
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

  const auth = devAuth(config.devUsers ?? []);
  definePill();
  const pill = document.createElement("featurewise-pill") as Pill;
  document.body.append(pill);

  const shell = new Shell({ config, auth, main, toaster: toasts, needsSignIn: () => pill.openMenu() });
  pill.attach(auth, () => void shell.openServices());
  // What a user may do decides which links they're offered, so a new user sees the page afresh.
  auth.onChange(() => void shell.load());
  await shell.start();
}

void main();

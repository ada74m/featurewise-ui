import { devAuth } from "./auth.js";
import { oidcAuth } from "./oidc.js";
import { loadConfig } from "./config.js";
import { fitFrame, isFramed } from "./frame.js";
import { definePill, type Pill } from "./pill.js";
import { renderDemoPanel } from "./demoPanel.js";
import { renderDemoBar } from "./demoSite.js";
import { Shell } from "./shell.js";
import { toaster } from "./toast.js";

export type { Host, Link, ServiceModule, ShellResponse } from "./contract.js";

// Starts the shell in index.html: reads services.json, shows the pill, and loads the page the URL names.
// In a frame, it shows no pill and fits the frame instead.
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
  const framed = isFramed(window);
  let pill: Pill | undefined;
  if (framed)
    fitFrame(window);
  else {
    definePill();
    pill = document.createElement("featurewise-pill") as Pill;
    document.body.append(pill);
  }

  // Beside a demo's pages: what it is, its story so far, and who the visitor can be. Where there are demos,
  // the shell is their site, with a bar across the top, and the panel is a sidebar on the left.
  const demos = config.demos ?? [];
  const panel = document.createElement("aside");
  panel.className = "fw-demo";
  panel.hidden = true;
  const bar = document.createElement("header");
  bar.className = "fw-bar";
  if (demos.length) {
    const site = document.createElement("div");
    site.className = "fw-site";
    main.before(bar, site);
    site.append(panel, main);
  } else
    main.before(panel);

  const shell = new Shell({
    config, auth, main, toaster: toasts,
    needsSignIn: () => pill?.openMenu(),
    onPlace: place => {
      const service = place.kind === "service" ? place.service : undefined;
      const view = service === undefined ? undefined
        : { dressed: shell.rendersModule(service), choose: (dressed: boolean) => void shell.setRendering(service, dressed) };
      renderDemoPanel(panel, demos, auth, place, link => void shell.runAndReload(link, "Started again from the beginning."), view);
      if (demos.length)
        renderDemoBar(bar, config, place);
      pill?.showingService(place.kind === "service" ? place.service : undefined);
    }
  });
  pill?.attach(auth, () => void shell.openServices(), demos);
  // What a user may do decides which links they're offered, so a new user sees the page afresh.
  auth.onChange(() => void shell.load());
  await shell.start();
}

void main();

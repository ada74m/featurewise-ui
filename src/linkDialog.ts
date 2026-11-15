import { isLink, qualifiedFeatureOf, type Link } from "./contract.js";

// Shows a link as JSON that can be edited, with a Follow button. It's how the generic UI follows a
// link: a field still to be supplied shows as null, and the developer types over it.
export function openLinkDialog(document: Document, label: string, link: Link, follow: (link: Link) => void): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "fw-link-dialog";

  const heading = document.createElement("h2");
  heading.textContent = `${label} (${qualifiedFeatureOf(link)})`;

  const editor = document.createElement("textarea");
  editor.value = JSON.stringify(link, null, 2);
  editor.rows = Math.min(20, editor.value.split("\n").length + 1);
  editor.spellcheck = false;

  const error = document.createElement("p");
  error.className = "fw-error";

  const cancel = button(document, "Cancel", () => dialog.close());
  const followButton = button(document, "Follow", () => {
    let edited: unknown;
    try {
      edited = JSON.parse(editor.value);
    } catch {
      error.textContent = "That isn't JSON.";
      return;
    }
    if (!isLink(edited)) {
      error.textContent = "A link must be an object that names its feature in $query, $command or $worker.";
      return;
    }
    dialog.close();
    follow(edited);
  });
  followButton.className = "fw-primary";

  const actions = document.createElement("div");
  actions.className = "fw-actions";
  actions.append(cancel, followButton);

  dialog.append(heading, editor, error, actions);
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal?.();
  return dialog;
}

function button(document: Document, text: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
}

// The shell in a frame, as on a featurewise.dev page: it shows no pill, since nobody signs in inside a
// page that isn't the shell's, it fits the frame without its own margins, and it tells the page around
// it how tall it is whenever that changes, so the page can size the frame to fit. The message isn't
// secret, so it goes to any parent; the page checks where it came from.

export const heightMessage = "featurewise:height";

export function isFramed(window: Window): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

// Marks the page as framed, for the stylesheet, and posts its height now and on every change, which
// observe reports: by default, a ResizeObserver on the body.
export function fitFrame(
  window: Window,
  observe: (body: HTMLElement, changed: () => void) => void = (body, changed) => new ResizeObserver(changed).observe(body)
): void {
  const document = window.document;
  document.documentElement.classList.add("fw-framed");

  let posted = -1;
  const post = () => {
    const height = Math.ceil(Math.max(document.body.scrollHeight, document.body.getBoundingClientRect().height));
    if (height === posted)
      return;
    posted = height;
    window.parent.postMessage({ type: heightMessage, height }, "*");
  };
  observe(document.body, post);
  post();
}

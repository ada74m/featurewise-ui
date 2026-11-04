// Short messages at the foot of the page, each gone after a few seconds.
export interface Toaster {
  show(message: string): void;
}

export function toaster(document: Document, lifetime = 4000): Toaster {
  const container = document.createElement("div");
  container.className = "fw-toasts";
  container.setAttribute("role", "status");
  document.body.append(container);

  return {
    show(message) {
      const toast = document.createElement("div");
      toast.className = "fw-toast";
      toast.textContent = message;
      container.append(toast);
      setTimeout(() => toast.remove(), lifetime);
    }
  };
}

import type { Link } from "../contract.js";

// An address template, such as "found-at/{Station}": segments separated by slashes, each either literal
// or a placeholder naming one of the link's arguments. A placeholder is a string, unless it says
// otherwise: "{Seat:int}" is a whole number, and "{On:date}" a date, such as 2026-11-13. A template reads
// an address into a link's arguments and writes them back, so the two directions can't disagree.

type Kind = "string" | "int" | "date";
type Segment = { literal: string } | { name: string; kind: Kind };

const placeholder = /^\{([A-Za-z_][A-Za-z0-9_]*)(?::(string|int|date))?\}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export class AddressTemplate {
  private readonly segments: Segment[];

  constructor(readonly template: string) {
    if (template === "" || template.startsWith("/") || template.endsWith("/"))
      throw new Error(`an address template is segments separated by slashes: "${template}"`);
    // "_/" starts the shell's default addresses.
    if (template === "_" || template.startsWith("_/"))
      throw new Error(`an address can't start with "_/", which the shell keeps for its own: "${template}"`);

    this.segments = template.split("/").map(segment => {
      const match = placeholder.exec(segment);
      if (match)
        return { name: match[1]!, kind: (match[2] ?? "string") as Kind };
      if (segment.includes("{") || segment.includes("}"))
        throw new Error(`a placeholder must be a whole segment, such as {Station} or {Seat:int}: "${template}"`);
      return { literal: segment };
    });

    const names = this.names();
    if (new Set(names).size !== names.length)
      throw new Error(`an address template names each argument once: "${template}"`);
  }

  names(): string[] {
    return this.segments.flatMap(segment => ("name" in segment ? [segment.name] : []));
  }

  // The template's shape, with its placeholders' names left out: two templates with the same shape would
  // read the same addresses.
  shape(): string {
    return this.segments.map(segment => ("name" in segment ? `{${segment.kind}}` : segment.literal)).join("/");
  }

  // The arguments an address's path holds, or null if the template doesn't match it.
  read(path: string): Record<string, unknown> | null {
    const parts = path.split("/");
    if (parts.length !== this.segments.length)
      return null;

    const args: Record<string, unknown> = {};
    for (const [index, segment] of this.segments.entries()) {
      let part: string;
      try {
        part = decodeURIComponent(parts[index]!);
      } catch {
        return null;
      }
      if ("literal" in segment) {
        if (part !== segment.literal)
          return null;
        continue;
      }
      const value = parse(part, segment.kind);
      if (value === null)
        return null;
      args[segment.name] = value;
    }
    return args;
  }

  // The address for a link, or null unless the template holds every one of its arguments, and only
  // those: an address that left one out would lead back to a different link. CausedBy isn't an argument:
  // Featurewise stamps every link with the invocation that made it, for tracing, and leaves it out of a
  // link's equality, so an address leaves it out too.
  write(link: Link): string | null {
    const { $query: _q, $command: _c, $worker: _w, CausedBy: _, ...args } = link;
    const names = this.names();
    if (Object.keys(args).length !== names.length || !names.every(name => name in args))
      return null;

    const parts: string[] = [];
    for (const segment of this.segments) {
      if ("literal" in segment) {
        parts.push(segment.literal);
        continue;
      }
      const part = format(args[segment.name], segment.kind);
      if (part === null)
        return null;
      parts.push(encodeURIComponent(part));
    }
    return parts.join("/");
  }
}

function parse(part: string, kind: Kind): unknown {
  if (part === "")
    return null;
  switch (kind) {
    case "string":
      return part;
    case "int":
      return /^-?\d+$/.test(part) && Number.isSafeInteger(Number(part)) ? Number(part) : null;
    case "date":
      return isoDate.test(part) ? part : null;
  }
}

function format(value: unknown, kind: Kind): string | null {
  switch (kind) {
    case "string":
      return typeof value === "string" && value !== "" ? value : null;
    case "int":
      return Number.isSafeInteger(value) ? String(value) : null;
    case "date":
      return typeof value === "string" && isoDate.test(value) ? value : null;
  }
}

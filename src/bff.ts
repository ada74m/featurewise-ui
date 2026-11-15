import { familyOf, featureOf, qualifiedFeatureOf, type Link, type ShellResponse } from "./contract.js";

// Every request to a service's UI backend is made here, so nothing else in the shell knows the
// convention. A link says its feature's family, which decides the method: a query, which is safe to
// repeat, is GET {bff}/{feature}?link=<the link's JSON>, and anything else is POST {bff}/{feature} with
// the link as the body. The backend answers a GET for anything but a query with 405, so no address or
// reload can run a command.

export async function invoke(
  bff: string, link: Link, token: string | null, fetcher: typeof fetch = fetch,
): Promise<ShellResponse> {
  const [, name] = featureOf(link);
  const family = familyOf(link);
  const method = family === "query" ? "GET" : "POST";
  const headers: Record<string, string> = {};
  if (token)
    headers["authorization"] = `Bearer ${token}`;

  let url = `${bff.replace(/\/+$/, "")}/${encodeURIComponent(name)}`;
  let body: string | undefined;
  if (method === "GET") {
    url += `?link=${encodeURIComponent(JSON.stringify(link))}`;
  } else {
    headers["content-type"] = "application/json";
    // A double click, or a retry after a lost response, then does the work once.
    headers["idempotency-key"] = crypto.randomUUID();
    body = JSON.stringify(link);
  }

  const response = await fetcher(url, { method, headers, body });
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const text = await response.text();
  return {
    link,
    feature: qualifiedFeatureOf(link),
    family,
    status: response.status,
    contentType,
    body: contentType.endsWith("json") && text ? JSON.parse(text) : text
  };
}

// An error, as RFC 9457 describes it, which the shell handles itself.
export interface Problem {
  title?: string;
  status?: number;
  detail?: string;
}

export const isProblem = (response: ShellResponse): boolean =>
  response.contentType === "application/problem+json" || response.status >= 400;

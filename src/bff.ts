import { featureOf, type Link, type ShellResponse } from "./contract.js";

// Every request to a service's UI backend is made here, so nothing else in the shell knows the
// convention: POST {bff}/{feature} with the link as the body, or, to load an address, which may be
// repeated, GET {bff}/{feature}?link=<the link's JSON>. The backend answers a GET for anything but a
// query with 405.

export type Method = "POST" | "GET";

export async function invoke(
  bff: string, link: Link, method: Method, token: string | null, fetcher: typeof fetch = fetch,
): Promise<ShellResponse> {
  const [, name] = featureOf(link);
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
    feature: link.$feature,
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

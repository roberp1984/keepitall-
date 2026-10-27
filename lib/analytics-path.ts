/** Paths that carry secrets or long tokens are reported as route patterns, never with their ids. */
const REDACTED: [RegExp, string][] = [
  [/^\/pack\/[^/?#]+/, "/pack/[id]"],
  [/^\/result\/[^/?#]+/, "/result/[id]"],
];

/** Strips query, hash and ids from a URL or path; returns "" for anything unparseable. */
export function redactUrl(url: string | undefined | null): string {
  if (!url) return "";
  let path: string;
  let origin = "";
  try {
    const u = new URL(url, "https://placeholder.invalid");
    path = u.pathname;
    if (u.origin !== "https://placeholder.invalid") origin = u.origin;
  } catch {
    return "";
  }
  for (const [pattern, replacement] of REDACTED) path = path.replace(pattern, replacement);
  return origin + path;
}

import { parseAnswers, type CheckAnswers } from "./answers";

/**
 * Stateless result id: the wizard answers as base64url JSON. Contains no
 * personal data. Replace with a Supabase id once claims are stored.
 */
export function encodeAnswers(answers: CheckAnswers): string {
  const bytes = new TextEncoder().encode(JSON.stringify(answers));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeAnswers(token: string): CheckAnswers | null {
  if (!/^[A-Za-z0-9_-]{1,4000}$/.test(token)) return null;
  try {
    const binary = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return parseAnswers(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

import { randomBytes } from "node:crypto";

/** 256-bit random, base64url: the secret in /pack/<token> links. */
export function generatePackToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isPackToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

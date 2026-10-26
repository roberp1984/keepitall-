"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import type { PaddleEnvironment } from "../env";

let instance: Promise<Paddle | undefined> | null = null;

/** Loads Paddle.js once per page. */
function loadPaddle(token: string, environment: PaddleEnvironment): Promise<Paddle | undefined> {
  instance ??= initializePaddle({ token, environment }).catch(() => {
    instance = null;
    return undefined;
  });
  return instance;
}

/** Opens Paddle's checkout overlay for a server-created transaction. Returns false if Paddle.js couldn't load. */
export async function openPaddleCheckout(opts: {
  transactionId: string;
  clientToken: string;
  environment: PaddleEnvironment;
  successUrl?: string;
}): Promise<boolean> {
  const paddle = await loadPaddle(opts.clientToken, opts.environment);
  if (!paddle) return false;
  paddle.Checkout.open({
    transactionId: opts.transactionId,
    settings: { displayMode: "overlay", theme: "light", locale: "en", successUrl: opts.successUrl },
  });
  return true;
}

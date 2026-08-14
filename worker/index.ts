/** Cloudflare Worker entry point for the vinext-starter template. */
import handler from "vinext/server/app-router-entry";
import { runWithRuntimeBindings, type TankRuntimeBindings } from "../lib/request-context";

interface Env extends TankRuntimeBindings {
  ASSETS: Fetcher;
  DB: D1Database;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // TankAI nutzt in diesem Release keine dynamische Bildoptimierung. Die Route
    // bleibt geschlossen, damit fremde Bildinhalte weder Fetch- noch
    // Dekompressionsarbeit auslösen können.
    if (url.pathname === "/_vinext/image") {
      return new Response("Not found", { status: 404 });
    }

    // TankAI verwendet keine Next Server Actions. Unbekannte Action-Requests
    // werden vor dem Framework verworfen.
    if (request.headers.has("next-action")) {
      return new Response("Not found", { status: 404 });
    }

    const method = request.method.toUpperCase();
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (
      method !== "GET" &&
      method !== "HEAD" &&
      Number.isFinite(contentLength) &&
      contentLength > 32_000
    ) {
      return new Response("Payload too large", { status: 413 });
    }

    const response = await runWithRuntimeBindings(env, () =>
      handler.fetch(request, env, ctx),
    );
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("x-frame-options", "DENY");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    headers.set("cross-origin-opener-policy", "same-origin");
    if (method !== "GET" && method !== "HEAD") {
      headers.set("cache-control", "no-store");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default worker;

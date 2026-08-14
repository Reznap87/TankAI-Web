#!/usr/bin/env node
import { lookup } from "node:dns/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 15_000;
const PLACEHOLDER_LANGUAGE = /placeholder|coming soon|platzhalter|demnächst/i;

function normalizeBaseUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:") {
    throw new Error("Die öffentliche TankAI-Adresse muss HTTPS verwenden.");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  url.search = "";
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname || "/";
  return url;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyPublicDeployment(input, dependencies = {}) {
  const baseUrl = normalizeBaseUrl(input);
  const dnsLookup = dependencies.lookup ?? lookup;
  const httpFetch = dependencies.fetch ?? fetchWithTimeout;
  const base = baseUrl.toString().replace(/\/$/, "");
  const startedAt = new Date().toISOString();
  const checks = [];

  let addresses;
  try {
    addresses = await dnsLookup(baseUrl.hostname, { all: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      name: "public_dns",
      passed: false,
      evidence: { hostname: baseUrl.hostname, error: message },
    });
    return {
      contractVersion: "1.0.0",
      target: base,
      startedAt,
      completedAt: new Date().toISOString(),
      passed: false,
      blockedBy: "public_dns",
      checks,
      executionVerified: true,
      factsVerified: false,
    };
  }

  checks.push({
    name: "public_dns",
    passed: Array.isArray(addresses) && addresses.length > 0,
    evidence: Array.isArray(addresses)
      ? addresses.map(({ address, family }) => ({ address, family }))
      : [],
  });

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return {
      contractVersion: "1.0.0",
      target: base,
      startedAt,
      completedAt: new Date().toISOString(),
      passed: false,
      blockedBy: "public_dns",
      checks,
      executionVerified: true,
      factsVerified: false,
    };
  }

  const landingResponse = await httpFetch(`${base}/`, {
    redirect: "follow",
    headers: { Accept: "text/html" },
  });
  const landingHtml = await landingResponse.text();
  checks.push({
    name: "landing_page",
    passed:
      landingResponse.ok &&
      /TANKAI/i.test(landingHtml) &&
      !PLACEHOLDER_LANGUAGE.test(landingHtml),
    evidence: {
      status: landingResponse.status,
      finalUrl: landingResponse.url,
      containsTankAI: /TANKAI/i.test(landingHtml),
      containsPlaceholderLanguage: PLACEHOLDER_LANGUAGE.test(landingHtml),
    },
  });

  const readinessResponse = await httpFetch(
    `${base}/api/public-readiness`,
    {
      redirect: "follow",
      headers: { Accept: "application/json" },
    },
  );
  let readiness = null;
  try {
    readiness = await readinessResponse.json();
  } catch {
    readiness = null;
  }
  checks.push({
    name: "public_readiness_endpoint",
    passed:
      readinessResponse.ok &&
      readiness?.runtimeOnline === true &&
      readiness?.executionVerified === true &&
      readiness?.publicAudience?.controlledExternally === true,
    evidence: {
      status: readinessResponse.status,
      contractVersion: readiness?.contractVersion ?? null,
      releaseVersion: readiness?.releaseVersion ?? null,
      runtimeOnline: readiness?.runtimeOnline ?? null,
      applicationReady: readiness?.applicationReady ?? null,
      modelExecutionReady: readiness?.modelExecutionReady ?? null,
      blockers: Array.isArray(readiness?.blockers) ? readiness.blockers : null,
    },
  });

  const appResponse = await httpFetch(`${base}/app`, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });
  const location = appResponse.headers.get("location");
  const protectedApp =
    [301, 302, 303, 307, 308].includes(appResponse.status) &&
    typeof location === "string" &&
    location.includes("/signin-with-chatgpt");
  checks.push({
    name: "protected_workspace",
    passed: protectedApp,
    evidence: {
      status: appResponse.status,
      location,
    },
  });

  const passed = checks.every((check) => check.passed);
  return {
    contractVersion: "1.0.0",
    target: base,
    startedAt,
    completedAt: new Date().toISOString(),
    passed,
    checks,
    executionVerified: true,
    factsVerified: false,
  };
}

async function main() {
  const target = process.argv[2] ?? process.env.TANKAI_PUBLIC_URL;
  if (!target) {
    console.error(
      "Aufruf: npm run verify:public -- \"$TANKAI_PUBLIC_URL\"",
    );
    process.exitCode = 2;
    return;
  }

  try {
    const receipt = await verifyPublicDeployment(target);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    if (!receipt.passed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

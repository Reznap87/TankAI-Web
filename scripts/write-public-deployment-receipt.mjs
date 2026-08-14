#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_DEPLOYMENT_RECEIPT_CONTRACT = "1.0.0";
export const PUBLIC_DEPLOYMENT_RELEASE = "0.43.0";

const SAFE_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;
const SAFE_STAGE = /^[a-z][a-z0-9_]{1,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function optional(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function bool(value) {
  return value === true || value === "true";
}

function safeRequirements(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(items.map((item) => String(item).trim()).filter((item) => SAFE_NAME.test(item)))].sort();
}

function safeSha(value) {
  const normalized = optional(value);
  return normalized && SHA256.test(normalized) ? normalized : null;
}

function safePublicUrl(value) {
  const normalized = optional(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("publicUrl muss eine HTTPS-Adresse ohne Zugangsdaten sein.");
  }
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function buildPublicDeploymentReceipt(input) {
  const stage = optional(input.stage) ?? "unknown";
  if (!SAFE_STAGE.test(stage)) throw new Error("Ungültige Deployment-Stage.");
  const exitCode = Number(input.exitCode);
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
    throw new Error("Ungültiger Exitcode.");
  }

  const deploymentExecuted = bool(input.deploymentExecuted);
  const verificationPassed = bool(input.publicVerificationPassed);
  const status = exitCode === 0 && verificationPassed
    ? "passed"
    : exitCode === 78
      ? "blocked"
      : "failed";

  return {
    contractVersion: PUBLIC_DEPLOYMENT_RECEIPT_CONTRACT,
    product: "TankAI Web",
    releaseVersion: PUBLIC_DEPLOYMENT_RELEASE,
    startedAt: optional(input.startedAt),
    completedAt: optional(input.completedAt),
    status,
    stage,
    exitCode,
    blockerCode: optional(input.blockerCode),
    missingRequirements: safeRequirements(input.missingRequirements),
    publicUrl: safePublicUrl(input.publicUrl),
    sourceTreeSha256: safeSha(input.sourceTreeSha256),
    publicVerificationSha256: safeSha(input.publicVerificationSha256),
    migrationsApplied: bool(input.migrationsApplied),
    identitySaltInstalled: bool(input.identitySaltInstalled),
    providerSecretsActivated: false,
    deploymentExecuted,
    publicVerificationPassed: verificationPassed,
    executionVerified: true,
    factsVerified: verificationPassed,
  };
}

export async function writePublicDeploymentReceipt(path, input) {
  const receipt = buildPublicDeploymentReceipt(input);
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true, mode: 0o700 });
  await writeFile(absolutePath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return { receipt, path: absolutePath };
}

async function main() {
  const [path, json] = process.argv.slice(2);
  if (!path || !json) {
    throw new Error("Aufruf: write-public-deployment-receipt.mjs DATEI JSON");
  }
  const result = await writePublicDeploymentReceipt(path, JSON.parse(json));
  process.stdout.write(`${JSON.stringify({ path: result.path, status: result.receipt.status })}\n`);
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invoked === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

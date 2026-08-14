#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEPLOY_CONFIG_CONTRACT = "1.0.0";
export const TANKAI_RELEASE_VERSION = "0.43.0";
export const DEFAULT_WORKER_NAME = "tankai-web";
export const DEFAULT_DATABASE_NAME = "tankai-web-production";
export const DEFAULT_COMPATIBILITY_DATE = "2026-07-29";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKER_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DATABASE_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function optionalString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function requireMatch(name, value, pattern, description) {
  const normalized = optionalString(value);
  if (!normalized || !pattern.test(normalized)) {
    throw new Error(`${name} fehlt oder ist kein gültiger ${description}.`);
  }
  return normalized;
}

function normalizeOptionalHostname(value) {
  const hostname = optionalString(value);
  if (!hostname) return undefined;
  if (hostname.includes("://") || hostname.includes("/") || !HOSTNAME.test(hostname)) {
    throw new Error("TANKAI_CUSTOM_DOMAIN muss ein reiner öffentlicher Hostname ohne Protokoll oder Pfad sein.");
  }
  return hostname.toLowerCase();
}

function normalizeCsv(value) {
  const raw = optionalString(value);
  if (!raw) return undefined;
  const entries = [...new Set(raw.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
  return entries.length ? entries.join(",") : undefined;
}

export function buildCloudflareDeployConfig(env = process.env) {
  const workerName = optionalString(env.TANKAI_WORKER_NAME) ?? DEFAULT_WORKER_NAME;
  if (!WORKER_NAME.test(workerName)) {
    throw new Error("TANKAI_WORKER_NAME muss ein gültiger Cloudflare-Worker-Name sein.");
  }

  const databaseName = optionalString(env.TANKAI_D1_DATABASE_NAME) ?? DEFAULT_DATABASE_NAME;
  if (!DATABASE_NAME.test(databaseName)) {
    throw new Error("TANKAI_D1_DATABASE_NAME muss ein gültiger D1-Datenbankname sein.");
  }

  const databaseId = requireMatch(
    "TANKAI_D1_DATABASE_ID",
    env.TANKAI_D1_DATABASE_ID,
    UUID,
    "D1-UUID",
  );
  const customDomain = normalizeOptionalHostname(env.TANKAI_CUSTOM_DOMAIN);
  const egressAllowedHosts = normalizeCsv(env.TANKAI_EGRESS_ALLOWED_HOSTS);
  const egressDeniedHosts = normalizeCsv(env.TANKAI_EGRESS_DENIED_HOSTS);

  const vars = {
    TANKAI_RELEASE_VERSION,
  };
  if (egressAllowedHosts) vars.TANKAI_EGRESS_ALLOWED_HOSTS = egressAllowedHosts;
  if (egressDeniedHosts) vars.TANKAI_EGRESS_DENIED_HOSTS = egressDeniedHosts;

  const config = {
    $schema: "./node_modules/wrangler/config-schema.json",
    name: workerName,
    main: "dist/server/index.js",
    compatibility_date: DEFAULT_COMPATIBILITY_DATE,
    compatibility_flags: ["nodejs_compat"],
    workers_dev: true,
    preview_urls: false,
    assets: {
      directory: "./dist/client",
      binding: "ASSETS",
      run_worker_first: true,
    },
    observability: {
      enabled: true,
      head_sampling_rate: 1,
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: databaseName,
        database_id: databaseId,
        migrations_dir: "drizzle",
      },
    ],
    vars,
  };

  if (customDomain) {
    config.routes = [{ pattern: customDomain, custom_domain: true }];
  }

  return {
    contractVersion: DEPLOY_CONFIG_CONTRACT,
    releaseVersion: TANKAI_RELEASE_VERSION,
    workerName,
    databaseName,
    databaseId,
    customDomain: customDomain ?? null,
    expectedPublicUrl: customDomain ? `https://${customDomain}` : null,
    config,
  };
}

export async function writeCloudflareDeployConfig(outputPath, env = process.env) {
  const result = buildCloudflareDeployConfig(env);
  const absolutePath = resolve(outputPath);
  await mkdir(dirname(absolutePath), { recursive: true, mode: 0o700 });
  await writeFile(absolutePath, `${JSON.stringify(result.config, null, 2)}\n`, { mode: 0o600 });
  return { ...result, outputPath: absolutePath };
}

async function main() {
  const outputPath = process.argv[2] ?? ".wrangler/production.generated.jsonc";
  const result = await writeCloudflareDeployConfig(outputPath);
  process.stdout.write(`${JSON.stringify({
    contractVersion: result.contractVersion,
    releaseVersion: result.releaseVersion,
    workerName: result.workerName,
    databaseName: result.databaseName,
    databaseIdHashInputPresent: true,
    customDomain: result.customDomain,
    expectedPublicUrl: result.expectedPublicUrl,
    outputPath: result.outputPath,
  }, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

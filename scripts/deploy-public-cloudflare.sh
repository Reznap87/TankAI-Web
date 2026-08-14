#!/usr/bin/env bash
set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
cd "${project_root}"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
receipt_dir="${TANKAI_DEPLOY_RECEIPT_DIR:-${project_root}/deployment-receipts}"
receipt="${receipt_dir}/TankAI-Web-v0.43.0_PUBLIC_DEPLOYMENT_RECEIPT.json"
verification_json="${receipt_dir}/public-verification.json"
config_path="${project_root}/.wrangler/production.generated.jsonc"
mkdir -p "${receipt_dir}"

stage="preflight"
blocker_code=""
missing_csv=""
public_url=""
source_hash=""
verification_hash=""
migrations_applied=false
identity_salt_installed=false
deployment_executed=false
public_verification_passed=false

write_exit_receipt() {
  local exit_code="$1"
  local completed_at payload
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  payload="$(node --input-type=module - \
    "${started_at}" "${completed_at}" "${stage}" "${exit_code}" \
    "${blocker_code}" "${missing_csv}" "${public_url}" "${source_hash}" \
    "${verification_hash}" "${migrations_applied}" "${identity_salt_installed}" \
    "${deployment_executed}" "${public_verification_passed}" <<'NODE'
const [
  startedAt, completedAt, stage, exitCode, blockerCode, missingRequirements,
  publicUrl, sourceTreeSha256, publicVerificationSha256, migrationsApplied,
  identitySaltInstalled, deploymentExecuted, publicVerificationPassed,
] = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  startedAt,
  completedAt,
  stage,
  exitCode: Number(exitCode),
  blockerCode,
  missingRequirements,
  publicUrl,
  sourceTreeSha256,
  publicVerificationSha256,
  migrationsApplied,
  identitySaltInstalled,
  deploymentExecuted,
  publicVerificationPassed,
}));
NODE
  )" || return 0
  node scripts/write-public-deployment-receipt.mjs "${receipt}" "${payload}" >/dev/null || true
}

on_exit() {
  local exit_code="$?"
  rm -f "${config_path}"
  write_exit_receipt "${exit_code}"
}
trap on_exit EXIT

command -v node >/dev/null || { blocker_code="node_missing"; echo "Node.js fehlt." >&2; exit 69; }
command -v npm >/dev/null || { blocker_code="npm_missing"; echo "npm fehlt." >&2; exit 69; }
command -v sha256sum >/dev/null || { blocker_code="sha256sum_missing"; echo "sha256sum fehlt." >&2; exit 69; }

required=(
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID
  TANKAI_D1_DATABASE_ID
  TANKAI_ID_SALT
)
missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("${name}")
  fi
done
if (( ${#missing[@]} > 0 )); then
  blocker_code="missing_deployment_values"
  missing_csv="$(IFS=,; echo "${missing[*]}")"
  printf 'Fehlende Deployment-Werte: %s\n' "${missing_csv}" >&2
  exit 78
fi
if (( ${#TANKAI_ID_SALT} < 32 )); then
  blocker_code="identity_salt_too_short"
  echo "TANKAI_ID_SALT muss mindestens 32 Zeichen lang sein." >&2
  exit 78
fi

mkdir -p "$(dirname "${config_path}")"

stage="dependencies"
if [[ ! -x "${project_root}/node_modules/.bin/wrangler" ]]; then
  npm run install:ci
fi

stage="quality_gates"
npm run lint
npm run build
node --test tests/*.test.mjs
[[ -f dist/server/index.js ]] || { blocker_code="worker_artifact_missing"; echo "dist/server/index.js fehlt." >&2; exit 66; }
[[ -d dist/client ]] || { blocker_code="asset_artifact_missing"; echo "dist/client fehlt." >&2; exit 66; }

source_hash="$(find . -type f \
  -not -path './node_modules/*' \
  -not -path './dist/*' \
  -not -path './.wrangler/*' \
  -not -path './.sites-runtime/*' \
  -not -path './deployment-receipts/*' \
  -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')"

stage="configuration"
node scripts/render-cloudflare-deploy-config.mjs "${config_path}" >/dev/null

wrangler="${project_root}/node_modules/.bin/wrangler"
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN

stage="migrations"
"${wrangler}" d1 migrations apply DB --remote --config "${config_path}"
migrations_applied=true

stage="identity_secret"
printf '%s' "${TANKAI_ID_SALT}" | "${wrangler}" secret put TANKAI_ID_SALT --config "${config_path}"
identity_salt_installed=true

# Provider-Schlüssel werden absichtlich nicht automatisch aktiviert. Ein öffentlicher
# Webrelease darf online sein, während /api/public-readiness den Modellpfad ehrlich
# als nicht bereit ausweist.
stage="worker_deploy"
deploy_output="$(mktemp)"
if ! "${wrangler}" deploy --config "${config_path}" 2>&1 | tee "${deploy_output}"; then
  rm -f "${deploy_output}"
  exit 1
fi
deployment_executed=true

public_url="${TANKAI_PUBLIC_URL:-}"
if [[ -z "${public_url}" && -n "${TANKAI_CUSTOM_DOMAIN:-}" ]]; then
  public_url="https://${TANKAI_CUSTOM_DOMAIN}"
fi
if [[ -z "${public_url}" ]]; then
  public_url="$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "${deploy_output}" | tail -1 || true)"
fi
rm -f "${deploy_output}"
if [[ -z "${public_url}" ]]; then
  blocker_code="public_url_unknown"
  echo "Deployment wurde ausgeführt, aber die öffentliche URL konnte nicht sicher bestimmt werden." >&2
  exit 70
fi

stage="public_verification"
node scripts/verify-public-deployment.mjs "${public_url}" | tee "${verification_json}"
verification_hash="$(sha256sum "${verification_json}" | awk '{print $1}')"
public_verification_passed=true
stage="complete"

printf 'TankAI Web öffentlich verifiziert: %s\nReceipt: %s\n' "${public_url}" "${receipt}"

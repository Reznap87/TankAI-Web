#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
cd "${project_root}"

echo "==> TankAI Web – WSL-Entwicklungs-Setup"
echo "Projekt: ${project_root}"

missing=()
for tool in bash curl git flock timeout sha256sum; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    missing+=("${tool}")
  fi
done

if [[ "${#missing[@]}" -gt 0 ]]; then
  echo "Fehlende Tools: ${missing[*]}"
  echo "Installiere Basis-Pakete (sudo-Passwort erforderlich)..."
  sudo apt update
  sudo apt install -y curl git coreutils util-linux
fi

node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [[ "${node_major}" -lt 22 ]]; then
  echo "Node.js >= 22.13.0 erforderlich (aktuell: $(node --version 2>/dev/null || echo fehlt))"
  echo "Installiere Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

echo "==> Abhängigkeiten installieren (npm ci)..."
npm run install:ci

if [[ ! -f "${project_root}/.env" ]]; then
  cp "${project_root}/.env.example" "${project_root}/.env"
  echo "==> .env aus .env.example erstellt"
  echo "    Bitte eintragen:"
  echo "      TANKAI_ID_SALT=$(openssl rand -hex 32 2>/dev/null || echo '<openssl rand -hex 32>')"
  echo "      OPENAI_API_KEY=sk-..."
else
  echo "==> .env existiert bereits – nicht überschrieben"
fi

echo ""
echo "Fertig. Nächste Schritte:"
echo "  1. nano .env   # TANKAI_ID_SALT + mindestens ein Provider-Key"
echo "  2. npm run dev"
echo "  3. npm test    # optional: vollständige Prüfung"

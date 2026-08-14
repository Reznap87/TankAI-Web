import { ToolExecutionError, ToolInputError } from "@/lib/tool-errors";

const encoder = new TextEncoder();
const MAX_PATCH_BYTES = 24_000;
const MAX_PATCH_CHARACTERS = 20_000;

function safePath(value: string): boolean {
  const normalized = value.replace(/^([ab])\//u, "");
  return Boolean(normalized) &&
    normalized !== "/dev/null" &&
    !normalized.startsWith("/") &&
    !normalized.startsWith("~") &&
    !normalized.includes("\\") &&
    !normalized.split("/").includes("..") &&
    !/[\u0000-\u001f\u007f]/u.test(normalized);
}

export function normalizePatch(value: unknown): string {
  if (typeof value !== "string") {
    throw new ToolInputError("Das Feld „patch“ muss einen Unified Diff enthalten.");
  }
  if (
    !value.trim() ||
    value.length > MAX_PATCH_CHARACTERS ||
    encoder.encode(value).byteLength > MAX_PATCH_BYTES ||
    value.includes("\u0000")
  ) {
    throw new ToolInputError("Der Patch fehlt, enthält NUL oder überschreitet 24.000 UTF-8-Bytes.");
  }
  return value.replace(/\r\n?/gu, "\n");
}

export function inspectUnifiedDiff(rawPatch: unknown): Record<string, unknown> {
  const patch = normalizePatch(rawPatch);
  const lines = patch.split("\n");
  const files = new Set<string>();
  const unsafePaths = new Set<string>();
  let additions = 0;
  let deletions = 0;
  let hunks = 0;
  let binary = false;
  let diffHeaders = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      diffHeaders += 1;
      const match = line.match(/^diff --git (\S+) (\S+)$/u);
      if (!match) continue;
      for (const path of [match[1], match[2]]) {
        if (safePath(path)) files.add(path.replace(/^([ab])\//u, ""));
        else unsafePaths.add(path);
      }
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      const path = line.slice(4).split("\t", 1)[0];
      if (path === "/dev/null") continue;
      if (safePath(path)) files.add(path.replace(/^([ab])\//u, ""));
      else unsafePaths.add(path);
      continue;
    }
    if (line.startsWith("@@ ") || line.startsWith("@@@ ")) {
      hunks += 1;
      continue;
    }
    if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      binary = true;
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }

  if (diffHeaders === 0 || hunks === 0) {
    throw new ToolExecutionError(
      "Der Inhalt ist kein vollständiger textueller Unified Diff mit mindestens einem Hunk.",
      "PATCH_FORMAT_INVALID",
    );
  }

  return {
    validUnifiedDiff: unsafePaths.size === 0 && !binary,
    files: [...files].sort(),
    fileCount: files.size,
    hunks,
    additions,
    deletions,
    binaryPatchDetected: binary,
    unsafePaths: [...unsafePaths],
    execution: {
      applied: false,
      codeExecuted: false,
      reason: "TankAI Web prüft den Patch statisch; Anwendung und Codeausführung benötigen eine isolierte Runner-Infrastruktur.",
    },
    limits: {
      maximumPatchBytes: MAX_PATCH_BYTES,
      observedPatchBytes: encoder.encode(patch).byteLength,
    },
  };
}

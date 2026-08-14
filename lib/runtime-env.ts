import { currentRuntimeBindings } from "@/lib/request-context";

export function readRuntimeString(name: string): string | undefined {
  const value = currentRuntimeBindings()[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function readRuntimeInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = readRuntimeString(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    return fallback;
  }
  return value;
}

export function hasRuntimeSecret(name: string): boolean {
  return Boolean(readRuntimeString(name));
}

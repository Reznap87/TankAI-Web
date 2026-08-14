import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  decideTankBenchPromotion,
  TANKBENCH_DIMENSIONS,
  type TankBenchScores,
  type TankBenchSnapshot,
} from "@/lib/tankbench";

export const dynamic = "force-dynamic";

class InvalidBenchmarkError extends Error {
  readonly status = 400;
  readonly code = "INVALID_BENCHMARK";
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidBenchmarkError("Baseline und Candidate müssen Objekte sein.");
  }
  return value as Record<string, unknown>;
}

function text(
  value: unknown,
  label: string,
  maximum: number,
): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new InvalidBenchmarkError(`${label} ist ungültig.`);
  }
  return value.trim();
}

function number(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new InvalidBenchmarkError(`${label} liegt außerhalb des erlaubten Bereichs.`);
  }
  return value;
}

function snapshot(value: unknown, label: string): TankBenchSnapshot {
  const input = record(value);
  const rawScores = record(input.scores);
  const scores = Object.fromEntries(
    TANKBENCH_DIMENSIONS.map((dimension) => [
      dimension.id,
      number(
        rawScores[dimension.id],
        `${label}.${dimension.id}`,
        0,
        1,
      ),
    ]),
  ) as TankBenchScores;
  return {
    systemVersion: text(input.systemVersion, `${label}.systemVersion`, 80),
    datasetFingerprint: text(
      input.datasetFingerprint,
      `${label}.datasetFingerprint`,
      128,
    ).toLowerCase(),
    caseCount: number(input.caseCount, `${label}.caseCount`, 0, 1_000_000, true),
    repeatedRuns: number(
      input.repeatedRuns,
      `${label}.repeatedRuns`,
      0,
      100,
      true,
    ),
    criticalSafetyViolations: number(
      input.criticalSafetyViolations,
      `${label}.criticalSafetyViolations`,
      0,
      1_000_000,
      true,
    ),
    taskSuccessRate: number(
      input.taskSuccessRate,
      `${label}.taskSuccessRate`,
      0,
      1,
    ),
    failureRate: number(input.failureRate, `${label}.failureRate`, 0, 1),
    p95LatencyMs: number(
      input.p95LatencyMs,
      `${label}.p95LatencyMs`,
      0,
      3_600_000,
    ),
    averageCostUsd: number(
      input.averageCostUsd,
      `${label}.averageCostUsd`,
      0,
      100_000,
    ),
    scores,
  };
}

export async function POST(request: Request) {
  try {
    await requireApiIdentity(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 32_000) {
      throw new InvalidBenchmarkError("Der Benchmarkkörper ist zu groß.");
    }
    const body = record(await request.json());
    return jsonResponse(
      decideTankBenchPromotion(
        snapshot(body.baseline, "baseline"),
        snapshot(body.candidate, "candidate"),
      ),
    );
  } catch (error) {
    if (error instanceof InvalidBenchmarkError) {
      return jsonResponse(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return apiErrorResponse(error);
  }
}

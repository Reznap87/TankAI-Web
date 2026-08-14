export const EXECUTION_RECEIPT_VERSION = "1.0.0";

export type ReceiptMode = "fast" | "team" | "deep";

interface ReceiptTrace {
  role: string;
  providerFamily: string;
  status: "completed" | "failed";
}

export interface ExecutionReceipt {
  version: string;
  state: "complete" | "degraded";
  claim: "execution-complete" | "execution-degraded";
  evidence: "runtime-observation";
  attemptedSteps: number;
  completedSteps: number;
  failedSteps: number;
  completedCriticChecks: number;
  providerFamilyCount: number;
  independentProviderReview: boolean;
  verification: {
    executionObserved: true;
    factualClaimsVerified: false;
    benchmarkPassed: false;
  };
  warnings: string[];
}

export function createExecutionReceipt(input: {
  mode: ReceiptMode;
  planSource: "planner" | "fallback";
  agents: ReceiptTrace[];
  reviewers: ReceiptTrace[];
  synthesizer?: ReceiptTrace;
  degraded: boolean;
}): ExecutionReceipt {
  const steps = [
    ...input.agents,
    ...input.reviewers,
    ...(input.synthesizer ? [input.synthesizer] : []),
  ];
  const completedSteps = steps.filter(
    (step) => step.status === "completed",
  ).length;
  const failedSteps = steps.length - completedSteps;
  const completedReviewers = input.reviewers.filter(
    (reviewer) => reviewer.status === "completed",
  );
  const providerFamilies = new Set(
    steps.map((step) => step.providerFamily).filter(Boolean),
  );
  const candidateFamilies = new Set(
    input.agents
      .filter((agent) => agent.role !== "planner")
      .map((agent) => agent.providerFamily),
  );
  const independentProviderReview = completedReviewers.some(
    (reviewer) => !candidateFamilies.has(reviewer.providerFamily),
  );
  const degraded = input.degraded || failedSteps > 0;
  const warnings: string[] = [];

  if (input.mode === "fast") {
    warnings.push("Schnellmodus ohne unabhängige Gegenprüfung.");
  } else {
    if (input.planSource === "fallback") {
      warnings.push("Der Modellplan war ungültig; ein geprüfter Fallback-Plan wurde verwendet.");
    }
    if (completedReviewers.length === 0) {
      warnings.push("Keine Gegenprüfung wurde erfolgreich abgeschlossen.");
    } else if (!independentProviderReview) {
      warnings.push("Die Gegenprüfung stammt aus keiner unabhängigen Modellfamilie.");
    }
  }
  if (failedSteps > 0) {
    warnings.push(`${failedSteps} Ausführungsschritt(e) sind fehlgeschlagen.`);
  }
  warnings.push(
    "Der Ablauf ist belegt; die inhaltliche Richtigkeit braucht weiterhin Quellen, Werkzeuge oder einen eingefrorenen Benchmark.",
  );

  return {
    version: EXECUTION_RECEIPT_VERSION,
    state: degraded ? "degraded" : "complete",
    claim: degraded ? "execution-degraded" : "execution-complete",
    evidence: "runtime-observation",
    attemptedSteps: steps.length,
    completedSteps,
    failedSteps,
    completedCriticChecks: completedReviewers.length,
    providerFamilyCount: providerFamilies.size,
    independentProviderReview,
    verification: {
      executionObserved: true,
      factualClaimsVerified: false,
      benchmarkPassed: false,
    },
    warnings,
  };
}

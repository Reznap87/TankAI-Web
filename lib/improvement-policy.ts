import {
  TANKBENCH_CONTRACT_VERSION,
  TANKBENCH_MINIMUM_CASES,
} from "@/lib/tankbench";

export const IMPROVEMENT_POLICY_VERSION = "1.0.0";

export const IMPROVEMENT_GATES = [
  "Lernsignale bleiben zunächst unveränderbar in einer Prüfwarteschlange.",
  "Korrekturen werden nicht automatisch als Wahrheit übernommen.",
  `Ein Candidate braucht mindestens ${TANKBENCH_MINIMUM_CASES} eingefrorene Eval-Fälle.`,
  "Golden-, Safety-, Red-Team-, Kosten- und Latenzevals müssen bestehen.",
  "Aktivierung erfolgt versioniert; die vorherige Version bleibt rückrollbar.",
] as const;

export function publicImprovementPolicy() {
  return {
    version: IMPROVEMENT_POLICY_VERSION,
    benchmarkContract: TANKBENCH_CONTRACT_VERSION,
    mode: "promotion-gated" as const,
    automaticWeightMutation: false,
    automaticPromptMutation: false,
    minimumEvalCases: TANKBENCH_MINIMUM_CASES,
    gates: IMPROVEMENT_GATES,
  };
}

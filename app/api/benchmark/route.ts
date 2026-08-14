import { jsonResponse } from "@/lib/api-response";
import {
  TANKBENCH_CONTRACT_VERSION,
  TANKBENCH_DIMENSIONS,
  TANKBENCH_MINIMUM_CASES,
  TANKBENCH_PROMOTION_RULES,
} from "@/lib/tankbench";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonResponse({
    contractVersion: TANKBENCH_CONTRACT_VERSION,
    minimumCases: TANKBENCH_MINIMUM_CASES,
    dimensions: TANKBENCH_DIMENSIONS,
    promotionRules: TANKBENCH_PROMOTION_RULES,
    currentPublicComparison: null,
    claim:
      "Ohne eingefrorenen Korpus und vollständiges Promotion Receipt wird keine Überlegenheit behauptet.",
  });
}

import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import { getImprovementStatus } from "@/lib/database";
import { publicImprovementPolicy } from "@/lib/improvement-policy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    return jsonResponse({
      policy: publicImprovementPolicy(),
      ...(await getImprovementStatus(identity.userId)),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

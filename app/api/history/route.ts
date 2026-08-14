import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import { listConversationHistory } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId")?.trim();
    const result = await listConversationHistory(
      identity.userId,
      conversationId || undefined,
    );
    return jsonResponse(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

import { evaluatePublicReadiness } from "@/lib/public-readiness";
import { currentRuntimeBindings } from "@/lib/request-context";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const snapshot = evaluatePublicReadiness(currentRuntimeBindings());

  return Response.json(snapshot, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

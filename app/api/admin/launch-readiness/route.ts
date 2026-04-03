import { apiSuccess } from "@/lib/api/http";
import { createAdminRoute } from "@/lib/api/domains";
import { getLaunchReadinessReport } from "@/lib/launch-readiness";

export const dynamic = "force-dynamic";

export const GET = createAdminRoute({
  cache: "private-realtime",
  runtimeGuardrails: "off",
  handler: async ({ request, meta }) => {
    const payload = await getLaunchReadinessReport();
    return apiSuccess(payload, {
      request,
      requestId: meta.requestId,
      traceId: meta.traceId,
      status: payload.overallState === "fail" ? 503 : 200,
    });
  },
});
